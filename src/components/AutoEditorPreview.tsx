import { Clock, Scissors, Film, ZoomIn, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditDecisionList, PacingAnalysis } from '@/types/autoEditor';
import { AutoEditorTimeline } from './AutoEditorTimeline';

interface AutoEditorPreviewProps {
  edl: EditDecisionList;
  stats: {
    originalDuration: number;
    editedDuration: number;
    reductionPercent: string;
    totalSegments: number;
    includedSegments: number;
    removedSections: number;
    bRollCount: number;
    approvedBRoll: number;
    zoomCount: number;
    enabledZooms: number;
    style: string;
    pacing: PacingAnalysis;
  } | null;
}

export function AutoEditorPreview({ edl, stats }: AutoEditorPreviewProps) {
  if (!stats) return null;

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Overview Card */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20">
        <h3 className="text-sm font-medium text-foreground mb-3">Edit Summary</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Duration</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {formatTime(stats.originalDuration)} → {formatTime(stats.editedDuration)}
            </p>
            <span className="text-xs text-green-600">-{stats.reductionPercent}%</span>
          </div>

          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <Scissors className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Clips</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {stats.includedSegments}
            </p>
            <span className="text-xs text-muted-foreground">{stats.removedSections} sections removed</span>
          </div>

          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <Film className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">B-Roll</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {stats.approvedBRoll}
            </p>
            <span className="text-xs text-muted-foreground">of {stats.bRollCount} suggested</span>
          </div>

          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Zooms</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {stats.enabledZooms}
            </p>
            <span className="text-xs text-muted-foreground">of {stats.zoomCount} suggested</span>
          </div>
        </div>
      </div>

      {/* Timeline Preview */}
      <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
        <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Timeline Preview
        </h4>
        <AutoEditorTimeline
          segments={edl.aRollSegments}
          bRoll={edl.bRollSuggestions}
          zooms={edl.zoomEffects}
          duration={edl.originalDuration}
          editedDuration={edl.editedDuration}
          currentTime={0}
        />
      </div>

      {/* Pacing Analysis */}
      {stats.pacing && (
        <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pacing Analysis
            </h4>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground">Avg Segment</p>
              <p className="text-sm font-medium text-foreground">
                {stats.pacing.averageSegmentDuration?.toFixed(1) || '--'}s
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground">Cut Rate</p>
              <p className="text-sm font-medium text-foreground">
                {stats.pacing.suggestedCutFrequency?.toFixed(1) || '--'}/min
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground">Energy</p>
              <p className="text-sm font-medium text-foreground capitalize">
                {stats.pacing.energyLevel || '--'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground">Style</p>
              <p className="text-sm font-medium text-foreground capitalize">
                {stats.style || '--'}
              </p>
            </div>
          </div>

          {stats.pacing.hooks && stats.pacing.hooks.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Detected Hooks:</p>
              <div className="flex flex-wrap gap-1">
                {stats.pacing.hooks.slice(0, 3).map((hook, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                    {formatTime(hook.timestamp)}: {hook.description}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {edl.editingNotes && edl.editingNotes.length > 0 && (
        <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              AI Notes
            </h4>
          </div>
          <ul className="space-y-1">
            {edl.editingNotes.map((note, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-amber-500">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
