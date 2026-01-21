import { useMemo, useCallback, useState, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { ARollSegment, BRollSuggestion, ZoomEffect } from '@/types/autoEditor';

// Wrapper component with forwardRef for TooltipTrigger compatibility
const TimelineBlock = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { style?: React.CSSProperties }>(
  ({ className, style, children, ...props }, ref) => (
    <div ref={ref} className={className} style={style} {...props}>
      {children}
    </div>
  )
);
TimelineBlock.displayName = 'TimelineBlock';

interface AutoEditorTimelineProps {
  segments: ARollSegment[];
  bRoll: BRollSuggestion[];
  zooms: ZoomEffect[];
  duration: number;
  editedDuration: number;
  currentTime: number;
  onSeek?: (time: number) => void;
  className?: string;
}

export function AutoEditorTimeline({
  segments,
  bRoll,
  zooms,
  duration,
  editedDuration,
  currentTime,
  onSeek,
  className,
}: AutoEditorTimelineProps) {
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  const getPositionPercent = useCallback((time: number) => {
    return (time / editedDuration) * 100;
  }, [editedDuration]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * editedDuration;
    onSeek(Math.max(0, Math.min(time, editedDuration)));
  }, [onSeek, editedDuration]);

  const includedSegments = useMemo(() => 
    segments.filter(s => s.isIncluded),
  [segments]);

  const approvedBRoll = useMemo(() =>
    bRoll.filter(b => b.status === 'approved'),
  [bRoll]);

  const enabledZooms = useMemo(() =>
    zooms.filter(z => z.isEnabled),
  [zooms]);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TooltipProvider>
      <div className={cn("space-y-2", className)}>
        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-primary" />
            <span>A-Roll</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-blue-500" />
            <span>B-Roll</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-purple-500" />
            <span>Zooms</span>
          </div>
        </div>

        {/* Main Timeline */}
        <div 
          className="relative h-16 bg-muted/30 rounded-lg overflow-hidden cursor-pointer"
          onClick={handleClick}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            setHoveredTime(percent * editedDuration);
          }}
          onMouseLeave={() => setHoveredTime(null)}
        >
          {/* A-Roll Segments */}
          <div className="absolute inset-x-0 top-0 h-6">
            {includedSegments.map((seg, index) => (
              <Tooltip key={seg.id}>
                <TooltipTrigger asChild>
                  <TimelineBlock
                    className="absolute top-0 h-full bg-primary/80 border-r border-background hover:bg-primary transition-colors"
                    style={{
                      left: `${getPositionPercent(seg.newStartTime)}%`,
                      width: `${getPositionPercent(seg.duration)}%`,
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                      <span className="text-[9px] text-primary-foreground font-medium truncate px-1">
                        {index + 1}
                      </span>
                    </div>
                  </TimelineBlock>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="max-w-48">
                    <p className="font-medium">Segment {index + 1}</p>
                    <p className="text-muted-foreground truncate">{seg.content}</p>
                    <p className="text-muted-foreground">{seg.duration.toFixed(1)}s</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* B-Roll Track */}
          <div className="absolute inset-x-0 top-7 h-4">
            {approvedBRoll.map(br => (
              <Tooltip key={br.id}>
                <TooltipTrigger asChild>
                  <TimelineBlock
                    className="absolute top-0 h-full bg-blue-500/80 rounded-sm hover:bg-blue-500 transition-colors"
                    style={{
                      left: `${getPositionPercent(br.timestamp)}%`,
                      width: `${getPositionPercent(br.duration)}%`,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">{br.type}</p>
                  <p className="text-muted-foreground">{br.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Zoom Track */}
          <div className="absolute inset-x-0 bottom-0 h-4">
            {enabledZooms.map(zoom => (
              <Tooltip key={zoom.id}>
                <TooltipTrigger asChild>
                  <TimelineBlock
                    className="absolute top-0 h-full bg-purple-500/60 rounded-sm hover:bg-purple-500/80 transition-colors"
                    style={{
                      left: `${getPositionPercent(zoom.startTime)}%`,
                      width: `${getPositionPercent(zoom.duration)}%`,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">{zoom.type}</p>
                  <p className="text-muted-foreground">{zoom.startScale}x → {zoom.endScale}x</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
            style={{ left: `${getPositionPercent(currentTime)}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" />
          </div>

          {/* Hover Indicator */}
          {hoveredTime !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-foreground/30 pointer-events-none"
              style={{ left: `${getPositionPercent(hoveredTime)}%` }}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-foreground text-background text-[10px] rounded whitespace-nowrap">
                {formatTime(hoveredTime)}
              </div>
            </div>
          )}
        </div>

        {/* Time Labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground px-1">
          <span>0:00</span>
          <span>{formatTime(editedDuration)}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
