import { useState } from 'react';
import { Check, X, Scissors, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ARollSegment } from '@/types/autoEditor';

interface AutoEditorCutsPanelProps {
  segments: ARollSegment[];
  removedSections: Array<{ startTime: number; endTime: number; reason: string }>;
  onToggleSegment: (id: string) => void;
  onUpdateCut: (id: string, cutType: ARollSegment['cutType'], transitionDuration?: number) => void;
  onSeek?: (time: number) => void;
  currentTime: number;
}

export function AutoEditorCutsPanel({
  segments,
  removedSections,
  onToggleSegment,
  onUpdateCut,
  onSeek,
  currentTime,
}: AutoEditorCutsPanelProps) {
  const [showRemoved, setShowRemoved] = useState(false);

  const includedSegments = segments.filter(s => s.isIncluded);
  const excludedSegments = segments.filter(s => !s.isIncluded);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated/50 border border-border/50">
        <div>
          <p className="text-sm font-medium text-foreground">
            {includedSegments.length} segments included
          </p>
          <p className="text-xs text-muted-foreground">
            {excludedSegments.length} segments removed • {removedSections.length} dead sections cut
          </p>
        </div>
        <Scissors className="w-5 h-5 text-primary" />
      </div>

      {/* Included Segments */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          Included Segments
        </h4>
        <div className="space-y-2">
          {includedSegments.map((seg, index) => (
            <div
              key={seg.id}
              className={cn(
                "p-3 rounded-xl border transition-colors",
                currentTime >= seg.newStartTime && currentTime < seg.newEndTime
                  ? "bg-primary/10 border-primary/30"
                  : "bg-surface-elevated/50 border-border/50 hover:border-border"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/20 text-primary text-[10px] font-bold">
                    {index + 1}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(seg.originalStartTime)} - {formatTime(seg.originalEndTime)}
                  </span>
                  <span className="text-xs text-foreground">
                    ({seg.duration.toFixed(1)}s)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {onSeek && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSeek(seg.originalStartTime)}
                      className="h-6 w-6 p-0"
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleSegment(seg.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-foreground line-clamp-2 mb-2">
                {seg.content}
              </p>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Cut:</span>
                <Select
                  value={seg.cutType}
                  onValueChange={(value) => onUpdateCut(seg.id, value as ARollSegment['cutType'])}
                >
                  <SelectTrigger className="h-6 text-xs w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="dissolve">Dissolve</SelectItem>
                    <SelectItem value="fade">Fade</SelectItem>
                  </SelectContent>
                </Select>
                {seg.reason && (
                  <span className="text-[10px] text-green-600 dark:text-green-400">
                    ✓ {seg.reason}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Removed Segments */}
      {excludedSegments.length > 0 && (
        <Collapsible open={showRemoved} onOpenChange={setShowRemoved}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <span className="text-xs text-muted-foreground">
                Removed Segments ({excludedSegments.length})
              </span>
              {showRemoved ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {excludedSegments.map(seg => (
                <div
                  key={seg.id}
                  className="p-2 rounded-lg bg-muted/20 border border-dashed border-border/50 opacity-60"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(seg.originalStartTime)} - {formatTime(seg.originalEndTime)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSegment(seg.id)}
                      className="h-5 px-2 text-[10px]"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Restore
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {seg.content}
                  </p>
                  {seg.reason && (
                    <span className="text-[10px] text-red-500">
                      Removed: {seg.reason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Dead Sections */}
      {removedSections.length > 0 && (
        <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
          <h5 className="text-xs font-medium text-muted-foreground mb-2">
            Auto-Removed ({removedSections.length} sections)
          </h5>
          <div className="flex flex-wrap gap-1">
            {removedSections.slice(0, 10).map((section, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 text-[10px]"
              >
                {section.reason}
              </span>
            ))}
            {removedSections.length > 10 && (
              <span className="text-[10px] text-muted-foreground">
                +{removedSections.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
