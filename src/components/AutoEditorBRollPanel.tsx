import { Check, X, Film, Play, Sparkles, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BRollSuggestion } from '@/types/autoEditor';

interface AutoEditorBRollPanelProps {
  suggestions: BRollSuggestion[];
  onToggle: (id: string) => void;
  onApproveAll: () => void;
  onSeek?: (time: number) => void;
}

export function AutoEditorBRollPanel({
  suggestions,
  onToggle,
  onApproveAll,
  onSeek,
}: AutoEditorBRollPanelProps) {
  const approved = suggestions.filter(s => s.status === 'approved');
  const suggested = suggestions.filter(s => s.status === 'suggested');
  const rejected = suggestions.filter(s => s.status === 'rejected');

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTypeColor = (type: BRollSuggestion['type']) => {
    switch (type) {
      case 'contextual': return 'bg-blue-500/20 text-blue-600';
      case 'reaction': return 'bg-yellow-500/20 text-yellow-600';
      case 'cutaway': return 'bg-purple-500/20 text-purple-600';
      case 'overlay': return 'bg-green-500/20 text-green-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPositionLabel = (position?: string) => {
    switch (position) {
      case 'fullscreen': return 'Full';
      case 'pip-topright': return 'PiP TR';
      case 'pip-topleft': return 'PiP TL';
      case 'pip-bottomright': return 'PiP BR';
      case 'pip-bottomleft': return 'PiP BL';
      case 'split-left': return 'Split L';
      case 'split-right': return 'Split R';
      default: return 'Full';
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated/50 border border-border/50">
        <div>
          <p className="text-sm font-medium text-foreground">
            {suggestions.length} B-Roll Suggestions
          </p>
          <p className="text-xs text-muted-foreground">
            {approved.length} approved • {suggested.length} pending
          </p>
        </div>
        <Film className="w-5 h-5 text-blue-500" />
      </div>

      {/* Quick Actions */}
      {suggested.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onApproveAll}
          className="w-full gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Approve All Suggestions ({suggested.length})
        </Button>
      )}

      {/* B-Roll List */}
      <div className="space-y-2">
        {suggestions.map(br => {
          const isApproved = br.status === 'approved';
          const isRejected = br.status === 'rejected';

          return (
            <div
              key={br.id}
              className={cn(
                "p-3 rounded-xl border transition-all",
                isApproved && "bg-blue-500/5 border-blue-500/30",
                isRejected && "bg-muted/30 border-border/30 opacity-60",
                !isApproved && !isRejected && "bg-surface-elevated/50 border-border/50"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    getTypeColor(br.type)
                  )}>
                    {br.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(br.timestamp)}
                  </span>
                  <span className="text-xs text-foreground">
                    ({br.duration}s)
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {getPositionLabel(br.position)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {onSeek && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSeek(br.timestamp)}
                      className="h-6 w-6 p-0"
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggle(br.id)}
                    className={cn(
                      "h-6 w-6 p-0",
                      isApproved 
                        ? "text-blue-500 hover:text-blue-600" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isApproved ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              <p className="text-sm text-foreground mb-2">
                {br.description}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50 text-xs text-muted-foreground">
                  <Search className="w-3 h-3" />
                  {br.searchQuery}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Confidence: {(br.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {br.reason && (
                <p className="text-[10px] text-muted-foreground mt-2 italic">
                  💡 {br.reason}
                </p>
              )}
            </div>
          );
        })}

        {suggestions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No B-roll suggestions for this video</p>
          </div>
        )}
      </div>
    </div>
  );
}
