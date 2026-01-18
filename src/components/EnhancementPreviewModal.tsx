import { useState } from 'react';
import { Play, Pause, X, Volume2, Image, Type, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Enhancement } from '@/types/enhancement';

interface EnhancementPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  enhancement: Enhancement | null;
}

export function EnhancementPreviewModal({
  isOpen,
  onClose,
  enhancement,
}: EnhancementPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!enhancement) return null;

  const handlePlayAudio = () => {
    if (enhancement.type === 'sfx' && enhancement.content?.url) {
      if (isPlaying) {
        setIsPlaying(false);
      } else {
        const audio = new Audio(enhancement.content.url);
        audio.onended = () => setIsPlaying(false);
        audio.play();
        setIsPlaying(true);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const typeIcons = {
    visual: Image,
    sfx: Volume2,
    graphic: Type,
    animation: Wand2,
  };
  const Icon = typeIcons[enhancement.type];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span className="capitalize">{enhancement.type} Enhancement</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview Area */}
          <div className="relative bg-zinc-900 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
            {enhancement.type === 'visual' && enhancement.content?.url ? (
              <img 
                src={enhancement.content.url} 
                alt="Enhancement preview"
                className="max-w-full max-h-full object-contain"
              />
            ) : enhancement.type === 'sfx' ? (
              <div className="text-center">
                <Volume2 className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                {enhancement.content?.url ? (
                  <Button onClick={handlePlayAudio} variant="outline" className="gap-2">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? 'Playing...' : 'Play Sound Effect'}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Not generated yet</p>
                )}
              </div>
            ) : enhancement.type === 'graphic' ? (
              <div 
                className={cn(
                  "px-6 py-4 text-center text-2xl font-bold text-white",
                  enhancement.animation?.enter === 'pop' && "animate-scale-in",
                  enhancement.animation?.enter === 'bounce' && "animate-bounce",
                  enhancement.animation?.enter === 'shake' && "animate-pulse",
                )}
              >
                {enhancement.description}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <Wand2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Animation preview</p>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">Description</h4>
              <p className="text-sm text-muted-foreground">{enhancement.description}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">Trigger</h4>
              <p className="text-sm text-muted-foreground italic">"{enhancement.triggerText}"</p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">Why suggested</h4>
              <p className="text-sm text-muted-foreground">{enhancement.reason}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {formatTime(enhancement.startTime)} - {formatTime(enhancement.endTime)}
              </Badge>
              <Badge variant="secondary">{enhancement.category}</Badge>
              <Badge variant="secondary" className={cn(
                enhancement.confidence >= 0.8 ? "text-green-500" :
                enhancement.confidence >= 0.5 ? "text-amber-500" : "text-muted-foreground"
              )}>
                {Math.round(enhancement.confidence * 100)}% confidence
              </Badge>
            </div>

            {enhancement.content?.prompt && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-1">Generation Prompt</h4>
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  {enhancement.content.prompt}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
