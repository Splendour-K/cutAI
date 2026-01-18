import { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { StoryboardElement, VisualStyle } from '@/types/animation';

interface AnimationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: StoryboardElement | null;
  style?: VisualStyle;
}

export function AnimationPreviewModal({
  isOpen,
  onClose,
  element,
  style,
}: AnimationPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'enter' | 'during' | 'exit'>('idle');
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setAnimationPhase('idle');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isPlaying || !element) return;

    const duration = element.animation.duration * 1000;
    const enterDuration = duration * 0.2;
    const duringDuration = duration * 0.6;
    const exitDuration = duration * 0.2;

    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;

      if (elapsed < enterDuration) {
        setAnimationPhase('enter');
      } else if (elapsed < enterDuration + duringDuration) {
        setAnimationPhase('during');
      } else if (elapsed < enterDuration + duringDuration + exitDuration) {
        setAnimationPhase('exit');
      } else {
        setAnimationPhase('idle');
        setIsPlaying(false);
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, element]);

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setAnimationPhase('idle');
    } else {
      setIsPlaying(true);
    }
  };

  const handleReplay = () => {
    setIsPlaying(false);
    setAnimationPhase('idle');
    setTimeout(() => setIsPlaying(true), 50);
  };

  if (!element) return null;

  // Get animation classes based on phase
  const getAnimationClass = () => {
    const enterName = element.animation.enter.name.toLowerCase();
    const exitName = element.animation.exit.name.toLowerCase();
    const duringName = element.animation.during?.name?.toLowerCase() || 'none';

    switch (animationPhase) {
      case 'enter':
        if (enterName.includes('fade')) return 'animate-fade-in';
        if (enterName.includes('slide')) return 'animate-slide-in-right';
        if (enterName.includes('scale') || enterName.includes('pop')) return 'animate-scale-in';
        if (enterName.includes('typewriter')) return 'animate-fade-in';
        return 'animate-enter';
      case 'during':
        if (duringName.includes('pulse') || duringName.includes('emphasis')) return 'animate-pulse';
        if (duringName.includes('glow')) return 'animate-pulse';
        return '';
      case 'exit':
        if (exitName.includes('fade')) return 'animate-fade-out';
        if (exitName.includes('slide')) return 'animate-slide-out-right';
        if (exitName.includes('scale')) return 'animate-scale-out';
        return 'animate-exit';
      default:
        return 'opacity-0';
    }
  };

  // Get computed styles from the element and style preset
  const computedStyle: React.CSSProperties = {
    fontFamily: style?.fontFamily || element.style.fontFamily || 'Inter',
    fontWeight: style?.fontWeight || element.style.fontWeight || 'bold',
    fontSize: `${element.style.fontSize || 32}px`,
    color: style?.primaryColor || element.style.color || 'hsl(0, 0%, 100%)',
    textTransform: style?.textTransform || 'none',
    textShadow: style?.shadowStyle === 'hard' 
      ? '2px 2px 0 hsl(0, 0%, 0%), -2px -2px 0 hsl(0, 0%, 0%), 2px -2px 0 hsl(0, 0%, 0%), -2px 2px 0 hsl(0, 0%, 0%)'
      : style?.shadowStyle === 'glow'
        ? `0 0 20px ${style.primaryColor || 'hsl(220, 100%, 60%)'}`
        : style?.shadowStyle === 'soft'
          ? '0 4px 12px hsla(0, 0%, 0%, 0.5)'
          : undefined,
    WebkitTextStroke: style?.strokeEnabled 
      ? `${style.strokeWidth || 2}px ${style.strokeColor || 'hsl(0, 0%, 0%)'}`
      : undefined,
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Animation Preview</span>
            <span className="text-xs font-normal text-muted-foreground capitalize">
              ({element.type})
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Preview Area */}
        <div className="relative bg-zinc-900 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
          <div 
            className={cn(
              "px-6 py-4 text-center transition-all",
              getAnimationClass()
            )}
            style={computedStyle}
          >
            {element.content}
          </div>

          {/* Phase indicator */}
          <div className="absolute bottom-3 left-3 flex gap-1">
            {['enter', 'during', 'exit'].map((phase) => (
              <div
                key={phase}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                  animationPhase === phase
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
                {phase}
              </div>
            ))}
          </div>
        </div>

        {/* Animation Details */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
              Enter: <span className="text-foreground font-medium">{element.animation.enter.name}</span>
            </div>
            {element.animation.during?.name && element.animation.during.name !== 'none' && (
              <div className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
                During: <span className="text-foreground font-medium">{element.animation.during.name}</span>
              </div>
            )}
            <div className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
              Exit: <span className="text-foreground font-medium">{element.animation.exit.name}</span>
            </div>
            <div className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
              Timing: <span className="text-foreground font-medium">{element.animation.timing}</span>
            </div>
            <div className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
              Duration: <span className="text-foreground font-medium">{element.animation.duration.toFixed(1)}s</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlayPause}
              className="flex-1 gap-2"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Play Animation
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReplay}
              disabled={!isPlaying && animationPhase === 'idle'}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
