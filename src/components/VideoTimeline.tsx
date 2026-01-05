import { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Pause, KeyMoment, SceneChange } from '@/hooks/useVideoAnalysis';
import { AlertCircle, Star, Scissors, Film, Zap, MessageCircle, PlayCircle } from 'lucide-react';

interface VideoTimelineProps {
  duration: number;
  currentTime: number;
  pauses?: Pause[] | null;
  keyMoments?: KeyMoment[] | null;
  sceneChanges?: SceneChange[] | null;
  onSeek: (time: number) => void;
  className?: string;
}

const MOMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  hook: Zap,
  highlight: Star,
  climax: PlayCircle,
  transition: Film,
  callToAction: MessageCircle,
};

const PAUSE_COLORS: Record<string, string> = {
  silence: 'bg-yellow-500/60',
  filler: 'bg-orange-500/60',
  hesitation: 'bg-red-500/60',
};

export function VideoTimeline({
  duration,
  currentTime,
  pauses,
  keyMoments,
  sceneChanges,
  onSeek,
  className,
}: VideoTimelineProps) {
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  const getPositionPercent = useCallback((time: number) => {
    if (!duration || duration === 0) return 0;
    return Math.min(100, Math.max(0, (time / duration) * 100));
  }, [duration]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;
    onSeek(time);
  }, [duration, onSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    setHoveredTime(percent * duration);
  }, [duration]);

  const handleMouseLeave = useCallback(() => {
    setHoveredTime(null);
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Memoize the pause markers
  const pauseMarkers = useMemo(() => {
    if (!pauses || pauses.length === 0) return null;
    
    return pauses.map((pause, index) => {
      const left = getPositionPercent(pause.startTime);
      const width = getPositionPercent(pause.endTime) - left;
      
      return (
        <TooltipProvider key={`pause-${index}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "absolute top-0 h-full cursor-pointer hover:brightness-125 transition-all",
                  PAUSE_COLORS[pause.type] || 'bg-yellow-500/60'
                )}
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 0.5)}%`,
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-surface-elevated border-border">
              <div className="text-xs">
                <p className="font-medium capitalize">{pause.type}</p>
                <p className="text-muted-foreground">
                  {formatTime(pause.startTime)} - {formatTime(pause.endTime)}
                </p>
                <p className="text-muted-foreground">{pause.duration.toFixed(1)}s duration</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    });
  }, [pauses, getPositionPercent]);

  // Memoize the key moment markers
  const momentMarkers = useMemo(() => {
    if (!keyMoments || keyMoments.length === 0) return null;
    
    return keyMoments.map((moment, index) => {
      const left = getPositionPercent(moment.timestamp);
      const Icon = MOMENT_ICONS[moment.type] || Star;
      
      return (
        <TooltipProvider key={`moment-${index}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(moment.timestamp);
                }}
                className={cn(
                  "absolute -top-3 -translate-x-1/2 z-10 p-1 rounded-full transition-all hover:scale-125",
                  moment.importance === 'high' 
                    ? 'bg-primary text-primary-foreground' 
                    : moment.importance === 'medium'
                      ? 'bg-yellow-500 text-yellow-950'
                      : 'bg-muted text-muted-foreground'
                )}
                style={{ left: `${left}%` }}
              >
                <Icon className="w-3 h-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-surface-elevated border-border max-w-xs">
              <div className="text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs capitalize",
                    moment.importance === 'high' 
                      ? 'bg-primary/20 text-primary' 
                      : moment.importance === 'medium'
                        ? 'bg-yellow-500/20 text-yellow-600'
                        : 'bg-muted text-muted-foreground'
                  )}>
                    {moment.type}
                  </span>
                  <span className="text-muted-foreground">{formatTime(moment.timestamp)}</span>
                </div>
                <p className="text-foreground">{moment.description}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    });
  }, [keyMoments, getPositionPercent, onSeek]);

  // Memoize scene change markers
  const sceneMarkers = useMemo(() => {
    if (!sceneChanges || sceneChanges.length === 0) return null;
    
    return sceneChanges.map((scene, index) => {
      const left = getPositionPercent(scene.timestamp);
      
      return (
        <TooltipProvider key={`scene-${index}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute top-0 h-full w-0.5 bg-border/80 cursor-pointer hover:bg-foreground/60 transition-colors"
                style={{ left: `${left}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(scene.timestamp);
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-surface-elevated border-border">
              <div className="text-xs">
                <p className="font-medium">Scene Change</p>
                <p className="text-muted-foreground">{formatTime(scene.timestamp)}</p>
                <p className="text-foreground">{scene.description}</p>
                {scene.transitionType && (
                  <p className="text-muted-foreground capitalize">{scene.transitionType}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    });
  }, [sceneChanges, getPositionPercent, onSeek]);

  const hasMarkers = (pauses && pauses.length > 0) || (keyMoments && keyMoments.length > 0) || (sceneChanges && sceneChanges.length > 0);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Legend */}
      {hasMarkers && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {pauses && pauses.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-yellow-500/60" />
              <span>Pauses ({pauses.length})</span>
            </div>
          )}
          {keyMoments && keyMoments.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Star className="w-3 h-3 text-primary" />
              <span>Key Moments ({keyMoments.length})</span>
            </div>
          )}
          {sceneChanges && sceneChanges.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 bg-border" />
              <span>Scenes ({sceneChanges.length})</span>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div 
        className="relative h-8 bg-surface-elevated rounded-lg cursor-pointer overflow-visible"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Background track */}
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          {/* Pause regions */}
          {pauseMarkers}
          
          {/* Scene change markers */}
          {sceneMarkers}
        </div>

        {/* Key moment markers (above the track) */}
        {momentMarkers}

        {/* Progress bar */}
        <div 
          className="absolute top-0 left-0 h-full bg-primary/30 rounded-l-lg transition-all duration-75"
          style={{ width: `${getPositionPercent(currentTime)}%` }}
        />

        {/* Playhead */}
        <div 
          className="absolute top-0 h-full w-1 bg-primary rounded-full shadow-lg shadow-primary/50 transition-all duration-75"
          style={{ left: `${getPositionPercent(currentTime)}%`, transform: 'translateX(-50%)' }}
        />

        {/* Hover indicator */}
        {hoveredTime !== null && (
          <>
            <div 
              className="absolute top-0 h-full w-0.5 bg-foreground/30 pointer-events-none"
              style={{ left: `${getPositionPercent(hoveredTime)}%` }}
            />
            <div 
              className="absolute -top-6 px-2 py-1 bg-surface-elevated border border-border rounded text-xs text-foreground pointer-events-none"
              style={{ left: `${getPositionPercent(hoveredTime)}%`, transform: 'translateX(-50%)' }}
            >
              {formatTime(hoveredTime)}
            </div>
          </>
        )}
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
