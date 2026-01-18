import { useState } from 'react';
import { 
  Image, 
  Volume2, 
  Type, 
  Wand2,
  Check,
  X,
  Play,
  Pause,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  GripVertical,
  RefreshCw,
  Trash2,
  Move
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { Enhancement, EnhancementWorkflow, EnhancementType } from '@/types/enhancement';

interface EnhancementReviewPanelProps {
  workflow: EnhancementWorkflow;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
  onGenerate: (id: string) => void;
  onGenerateAll: () => void;
  onRemove: (id: string) => void;
  onUpdatePosition: (id: string, position: { x: number; y: number; scale: number }) => void;
  onUpdateTiming: (id: string, startTime: number, endTime: number) => void;
  onPreview: (enhancement: Enhancement) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

const ENHANCEMENT_ICONS: Record<EnhancementType, typeof Image> = {
  visual: Image,
  sfx: Volume2,
  graphic: Type,
  animation: Wand2,
};

const ENHANCEMENT_COLORS: Record<EnhancementType, string> = {
  visual: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  sfx: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  graphic: 'bg-green-500/20 text-green-400 border-green-500/30',
  animation: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

export function EnhancementReviewPanel({
  workflow,
  onApprove,
  onReject,
  onApproveAll,
  onGenerate,
  onGenerateAll,
  onRemove,
  onUpdatePosition,
  onUpdateTiming,
  onPreview,
  selectedId,
  onSelect,
}: EnhancementReviewPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['all']);

  // Use external selection if provided, otherwise internal
  const selectedEnhancement = selectedId;
  const handleSelect = (id: string | null) => {
    if (onSelect) {
      onSelect(id);
    }
  };

  // Group enhancements by type
  const groupedEnhancements = workflow.enhancements.reduce((acc, e) => {
    if (!acc[e.type]) acc[e.type] = [];
    acc[e.type].push(e);
    return acc;
  }, {} as Record<EnhancementType, Enhancement[]>);

  const suggestedCount = workflow.enhancements.filter(e => e.status === 'suggested').length;
  const approvedCount = workflow.enhancements.filter(e => e.status === 'approved').length;
  const readyCount = workflow.enhancements.filter(e => e.status === 'ready').length;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  if (workflow.status === 'idle') {
    return (
      <div className="p-4 text-center">
        <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h3 className="text-lg font-semibold text-foreground mb-2">AI Editor</h3>
        <p className="text-sm text-muted-foreground">
          Analyze your video to get AI-suggested enhancements like images, sound effects, and animated graphics.
        </p>
      </div>
    );
  }

  if (workflow.status === 'analyzing') {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Analyzing Video</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Finding moments that could use visual or audio enhancements...
          </p>
          <Progress value={workflow.progress} className="h-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header Stats */}
      <div className="p-3 border-b border-border bg-surface/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">AI Suggestions</h3>
          <div className="flex gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {suggestedCount} pending
            </Badge>
            <Badge variant="default" className="text-xs">
              {approvedCount} approved
            </Badge>
          </div>
        </div>

        {workflow.status === 'generating' && (
          <Progress value={workflow.progress} className="h-1.5 mb-2" />
        )}

        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={onApproveAll}
            disabled={suggestedCount === 0 || workflow.status === 'generating'}
            className="flex-1 h-8"
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            Approve All
          </Button>
          <Button 
            size="sm" 
            onClick={onGenerateAll}
            disabled={approvedCount === 0 || workflow.status === 'generating'}
            className="flex-1 h-8"
          >
            {workflow.status === 'generating' ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 mr-1" />
            )}
            Generate
          </Button>
        </div>
      </div>

      {/* Enhancement List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {(['visual', 'sfx', 'graphic', 'animation'] as EnhancementType[]).map(type => {
            const items = groupedEnhancements[type] || [];
            if (items.length === 0) return null;

            const Icon = ENHANCEMENT_ICONS[type];
            const isExpanded = expandedCategories.includes(type) || expandedCategories.includes('all');

            return (
              <Collapsible 
                key={type} 
                open={isExpanded}
                onOpenChange={() => toggleCategory(type)}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full p-2.5 rounded-xl bg-surface-elevated/50 border border-border/50 hover:bg-surface-elevated transition-colors flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center",
                      ENHANCEMENT_COLORS[type]
                    )}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-foreground capitalize flex-1 text-left">
                      {type === 'sfx' ? 'Sound Effects' : type}s
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {items.length}
                    </Badge>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-2 space-y-2">
                  {items.map(enhancement => (
                    <EnhancementCard
                      key={enhancement.id}
                      enhancement={enhancement}
                      isSelected={selectedEnhancement === enhancement.id}
                      onSelect={() => handleSelect(
                        selectedEnhancement === enhancement.id ? null : enhancement.id
                      )}
                      onApprove={() => onApprove(enhancement.id)}
                      onReject={() => onReject(enhancement.id)}
                      onGenerate={() => onGenerate(enhancement.id)}
                      onRemove={() => onRemove(enhancement.id)}
                      onPreview={() => onPreview(enhancement)}
                      formatTime={formatTime}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>

      {/* Summary */}
      {workflow.analysis && (
        <div className="p-3 border-t border-border bg-surface/50 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Style: {workflow.analysis.videoStyle}</span>
            <span>Density: {workflow.analysis.recommendedDensity}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface EnhancementCardProps {
  enhancement: Enhancement;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onGenerate: () => void;
  onRemove: () => void;
  onPreview: () => void;
  formatTime: (seconds: number) => string;
}

function EnhancementCard({
  enhancement,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  onGenerate,
  onRemove,
  onPreview,
  formatTime,
}: EnhancementCardProps) {
  const Icon = ENHANCEMENT_ICONS[enhancement.type];
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useState<HTMLAudioElement | null>(null);

  const handlePlaySFX = () => {
    if (enhancement.type === 'sfx' && enhancement.content?.url) {
      if (isPlaying) {
        // Stop
        setIsPlaying(false);
      } else {
        const audio = new Audio(enhancement.content.url);
        audio.onended = () => setIsPlaying(false);
        audio.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div 
      className={cn(
        "p-3 rounded-xl border transition-all",
        enhancement.status === 'approved' && "bg-primary/5 border-primary/30",
        enhancement.status === 'rejected' && "bg-muted/30 border-muted opacity-60",
        enhancement.status === 'generating' && "bg-amber-500/5 border-amber-500/30",
        enhancement.status === 'ready' && "bg-green-500/5 border-green-500/30",
        enhancement.status === 'error' && "bg-destructive/5 border-destructive/30",
        enhancement.status === 'suggested' && "bg-surface-elevated/50 border-border/50",
        isSelected && "ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Status/Approval Checkbox */}
        <button
          onClick={enhancement.status === 'suggested' ? onApprove : 
                   enhancement.status === 'approved' ? onReject : undefined}
          disabled={!['suggested', 'approved'].includes(enhancement.status)}
          className={cn(
            "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
            enhancement.status === 'approved' && "bg-primary text-primary-foreground",
            enhancement.status === 'ready' && "bg-green-500 text-white",
            enhancement.status === 'rejected' && "bg-muted text-muted-foreground",
            enhancement.status === 'generating' && "bg-amber-500 text-white",
            enhancement.status === 'suggested' && "border border-muted-foreground/30 hover:border-primary"
          )}
        >
          {enhancement.status === 'approved' && <Check className="w-3 h-3" />}
          {enhancement.status === 'ready' && <Check className="w-3 h-3" />}
          {enhancement.status === 'rejected' && <X className="w-3 h-3" />}
          {enhancement.status === 'generating' && <Loader2 className="w-3 h-3 animate-spin" />}
        </button>

        <div className="flex-1 min-w-0" onClick={onSelect}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">
              {formatTime(enhancement.startTime)}
            </span>
            <Badge 
              variant="outline" 
              className={cn("text-[10px] px-1.5 py-0 h-4", ENHANCEMENT_COLORS[enhancement.type])}
            >
              {enhancement.category}
            </Badge>
            {enhancement.confidence >= 0.8 && (
              <span className="text-[10px] text-amber-500">★ High</span>
            )}
          </div>

          <p className="text-sm text-foreground font-medium mb-1 line-clamp-2">
            {enhancement.description}
          </p>

          <p className="text-xs text-muted-foreground italic line-clamp-1">
            "{enhancement.triggerText}"
          </p>

          {/* Preview for ready content */}
          {enhancement.status === 'ready' && enhancement.content?.url && (
            <div className="mt-2">
              {enhancement.type === 'visual' && (
                <img 
                  src={enhancement.content.url} 
                  alt="Generated visual"
                  className="w-full h-20 object-cover rounded-lg"
                />
              )}
              {enhancement.type === 'sfx' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handlePlaySFX}
                  className="h-7 text-xs"
                >
                  {isPlaying ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                  {isPlaying ? 'Stop' : 'Play SFX'}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          {enhancement.status === 'approved' && (
            <button
              onClick={onGenerate}
              className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
              title="Generate now"
            >
              <Wand2 className="w-3.5 h-3.5" />
            </button>
          )}
          {enhancement.status === 'ready' && (
            <button
              onClick={onGenerate}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Regenerate"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
