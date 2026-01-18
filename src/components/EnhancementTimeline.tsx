import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Enhancement, EnhancementType } from '@/types/enhancement';
import { 
  Image, 
  Volume2, 
  Sparkles, 
  Play,
  GripHorizontal,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

interface EnhancementTimelineProps {
  enhancements: Enhancement[];
  duration: number;
  currentTime: number;
  onSeek?: (time: number) => void;
  onUpdateTiming?: (id: string, startTime: number, endTime: number) => void;
  onRemove?: (id: string) => void;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  className?: string;
}

// Enhancement type icons and colors
const ENHANCEMENT_CONFIG: Record<EnhancementType, { 
  icon: typeof Image; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  visual: { 
    icon: Image, 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/30 border-blue-500/50',
    label: 'Image'
  },
  sfx: { 
    icon: Volume2, 
    color: 'text-green-400', 
    bgColor: 'bg-green-500/30 border-green-500/50',
    label: 'Sound Effect'
  },
  graphic: { 
    icon: Sparkles, 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/30 border-purple-500/50',
    label: 'Graphic'
  },
  animation: { 
    icon: Play, 
    color: 'text-orange-400', 
    bgColor: 'bg-orange-500/30 border-orange-500/50',
    label: 'Animation'
  },
};

type DragMode = 'move' | 'resize-start' | 'resize-end' | null;

interface DragState {
  enhancementId: string;
  mode: DragMode;
  startX: number;
  originalStart: number;
  originalEnd: number;
}

export function EnhancementTimeline({
  enhancements,
  duration,
  currentTime,
  onSeek,
  onUpdateTiming,
  onRemove,
  onSelect,
  selectedId,
  className,
}: EnhancementTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hiddenTracks, setHiddenTracks] = useState<Set<EnhancementType>>(new Set());

  // Group enhancements by type for track layout
  const tracks = useMemo(() => {
    const grouped: Record<EnhancementType, Enhancement[]> = {
      visual: [],
      sfx: [],
      graphic: [],
      animation: [],
    };
    
    enhancements
      .filter(e => e.status === 'approved' || e.status === 'ready' || e.status === 'generating')
      .forEach(e => grouped[e.type].push(e));
    
    return Object.entries(grouped)
      .filter(([_, items]) => items.length > 0)
      .map(([type, items]) => ({
        type: type as EnhancementType,
        items: items.sort((a, b) => a.startTime - b.startTime),
      }));
  }, [enhancements]);

  // Calculate position percentage
  const getPositionPercent = useCallback((time: number) => {
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(100, (time / duration) * 100));
  }, [duration]);

  // Convert pixel position to time
  const pixelToTime = useCallback((pixelX: number): number => {
    if (!timelineRef.current || duration <= 0) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const percent = (pixelX - rect.left) / rect.width;
    return Math.max(0, Math.min(duration, percent * duration));
  }, [duration]);

  // Handle timeline click for seeking
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (dragState || !onSeek) return;
    const time = pixelToTime(e.clientX);
    onSeek(time);
  }, [dragState, onSeek, pixelToTime]);

  // Start dragging
  const handleDragStart = useCallback((
    e: React.MouseEvent, 
    enhancement: Enhancement, 
    mode: DragMode
  ) => {
    e.stopPropagation();
    e.preventDefault();
    
    setDragState({
      enhancementId: enhancement.id,
      mode,
      startX: e.clientX,
      originalStart: enhancement.startTime,
      originalEnd: enhancement.endTime,
    });
  }, []);

  // Handle drag move
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || !onUpdateTiming) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = (deltaX / rect.width) * duration;
      
      let newStart = dragState.originalStart;
      let newEnd = dragState.originalEnd;
      
      if (dragState.mode === 'move') {
        const shift = deltaTime;
        newStart = Math.max(0, dragState.originalStart + shift);
        newEnd = Math.min(duration, dragState.originalEnd + shift);
        
        // Keep duration constant when moving
        const originalDuration = dragState.originalEnd - dragState.originalStart;
        if (newStart === 0) {
          newEnd = originalDuration;
        }
        if (newEnd === duration) {
          newStart = duration - originalDuration;
        }
      } else if (dragState.mode === 'resize-start') {
        newStart = Math.max(0, Math.min(newEnd - 0.1, dragState.originalStart + deltaTime));
      } else if (dragState.mode === 'resize-end') {
        newEnd = Math.min(duration, Math.max(newStart + 0.1, dragState.originalEnd + deltaTime));
      }
      
      onUpdateTiming(dragState.enhancementId, newStart, newEnd);
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, duration, onUpdateTiming]);

  // Toggle track visibility
  const toggleTrack = useCallback((type: EnhancementType) => {
    setHiddenTracks(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Format time display
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (tracks.length === 0) {
    return (
      <div className={cn(
        "flex items-center justify-center p-4 text-sm text-muted-foreground bg-surface/30 rounded-lg border border-border/50",
        className
      )}>
        <Sparkles className="w-4 h-4 mr-2 opacity-50" />
        Approve enhancements to see them on the timeline
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("space-y-2", className)}>
        {/* Track legend */}
        <div className="flex items-center gap-3 px-2">
          {tracks.map(({ type }) => {
            const config = ENHANCEMENT_CONFIG[type];
            const Icon = config.icon;
            const isHidden = hiddenTracks.has(type);
            
            return (
              <button
                key={type}
                onClick={() => toggleTrack(type)}
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-opacity",
                  isHidden ? "opacity-40" : "opacity-100"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", config.color)} />
                <span className="text-muted-foreground capitalize">{type}</span>
                {isHidden ? (
                  <EyeOff className="w-3 h-3 text-muted-foreground/50" />
                ) : (
                  <Eye className="w-3 h-3 text-muted-foreground/50" />
                )}
              </button>
            );
          })}
        </div>

        {/* Timeline container */}
        <div 
          ref={timelineRef}
          className="relative bg-surface-elevated/30 rounded-lg border border-border/50 overflow-hidden"
          onClick={handleTimelineClick}
          style={{ cursor: dragState ? 'grabbing' : 'pointer' }}
        >
          {/* Time markers */}
          <div className="absolute inset-x-0 top-0 h-5 border-b border-border/30 flex items-end text-[10px] text-muted-foreground/60">
            {Array.from({ length: 11 }, (_, i) => (
              <div 
                key={i} 
                className="absolute flex flex-col items-center"
                style={{ left: `${i * 10}%` }}
              >
                <span className="mb-0.5">{formatTime((i / 10) * duration)}</span>
                <div className="w-px h-1.5 bg-border/50" />
              </div>
            ))}
          </div>

          {/* Tracks */}
          <div className="pt-6 pb-2 space-y-1">
            {tracks.map(({ type, items }) => {
              const config = ENHANCEMENT_CONFIG[type];
              const Icon = config.icon;
              const isHidden = hiddenTracks.has(type);
              
              if (isHidden) return null;
              
              return (
                <div key={type} className="relative h-8 mx-2">
                  {/* Track label */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-1 z-10">
                    <Icon className={cn("w-3.5 h-3.5", config.color)} />
                  </div>
                  
                  {/* Track background */}
                  <div className="absolute inset-0 ml-4 bg-surface/20 rounded" />
                  
                  {/* Enhancement clips */}
                  {items.map((enhancement) => {
                    const left = getPositionPercent(enhancement.startTime);
                    const width = getPositionPercent(enhancement.endTime) - left;
                    const isSelected = selectedId === enhancement.id;
                    const isHovered = hoveredId === enhancement.id;
                    const isDragging = dragState?.enhancementId === enhancement.id;
                    
                    return (
                      <Tooltip key={enhancement.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "absolute top-0.5 bottom-0.5 rounded border transition-all",
                              config.bgColor,
                              isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                              isHovered && !isSelected && "brightness-110",
                              isDragging && "opacity-80",
                              enhancement.status === 'generating' && "animate-pulse"
                            )}
                            style={{ 
                              left: `calc(1rem + ${left}% * (100% - 1.5rem) / 100)`,
                              width: `calc(${width}% * (100% - 1.5rem) / 100)`,
                              minWidth: '20px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect?.(enhancement.id);
                            }}
                            onMouseEnter={() => setHoveredId(enhancement.id)}
                            onMouseLeave={() => setHoveredId(null)}
                          >
                            {/* Resize handle - start */}
                            <div
                              className={cn(
                                "absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize",
                                "hover:bg-white/20 transition-colors rounded-l"
                              )}
                              onMouseDown={(e) => handleDragStart(e, enhancement, 'resize-start')}
                            />
                            
                            {/* Move handle - center */}
                            <div
                              className="absolute inset-x-2 top-0 bottom-0 cursor-grab active:cursor-grabbing flex items-center justify-center"
                              onMouseDown={(e) => handleDragStart(e, enhancement, 'move')}
                            >
                              <GripHorizontal className="w-3 h-3 text-white/50" />
                            </div>
                            
                            {/* Resize handle - end */}
                            <div
                              className={cn(
                                "absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize",
                                "hover:bg-white/20 transition-colors rounded-r"
                              )}
                              onMouseDown={(e) => handleDragStart(e, enhancement, 'resize-end')}
                            />
                            
                            {/* Status indicator */}
                            {enhancement.status === 'ready' && enhancement.content?.url && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Icon className={cn("w-3.5 h-3.5", config.color)} />
                              <span className="font-medium text-xs">{config.label}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatTime(enhancement.startTime)} - {formatTime(enhancement.endTime)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {enhancement.description}
                            </p>
                            {enhancement.status === 'generating' && (
                              <p className="text-[10px] text-primary">Generating...</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-5 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
            style={{ left: `calc(1rem + ${getPositionPercent(currentTime)}% * (100% - 1.5rem) / 100)` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full" />
          </div>
        </div>

        {/* Selected enhancement actions */}
        {selectedId && (
          <div className="flex items-center justify-between px-2 py-1.5 bg-surface/50 rounded-lg border border-border/30">
            <div className="flex items-center gap-2">
              {(() => {
                const selected = enhancements.find(e => e.id === selectedId);
                if (!selected) return null;
                const config = ENHANCEMENT_CONFIG[selected.type];
                const Icon = config.icon;
                return (
                  <>
                    <Icon className={cn("w-4 h-4", config.color)} />
                    <span className="text-xs text-foreground truncate max-w-[150px]">
                      {selected.description}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({formatTime(selected.startTime)} - {formatTime(selected.endTime)})
                    </span>
                  </>
                );
              })()}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
              onClick={() => onRemove?.(selectedId)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
