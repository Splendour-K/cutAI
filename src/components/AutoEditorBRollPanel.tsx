import { useState } from 'react';
import { Check, X, Film, Play, Sparkles, Search, Download, ExternalLink, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BRollSuggestion } from '@/types/autoEditor';
import { StockFootageSearch } from './StockFootageSearch';
import type { StockVideo } from '@/hooks/useStockFootage';

interface AutoEditorBRollPanelProps {
  suggestions: BRollSuggestion[];
  onToggle: (id: string) => void;
  onApproveAll: () => void;
  onSeek?: (time: number) => void;
  onSetFootage?: (id: string, url: string, attribution?: string) => void;
}

export function AutoEditorBRollPanel({
  suggestions,
  onToggle,
  onApproveAll,
  onSeek,
  onSetFootage,
}: AutoEditorBRollPanelProps) {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activeBRollId, setActiveBRollId] = useState<string | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  const approved = suggestions.filter(s => s.status === 'approved' || s.status === 'ready');
  const suggested = suggestions.filter(s => s.status === 'suggested');
  const ready = suggestions.filter(s => s.status === 'ready');

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

  const getStatusBadge = (status: BRollSuggestion['status']) => {
    switch (status) {
      case 'ready':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 text-[10px] font-medium">
            <Download className="w-3 h-3" />
            Ready
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 text-[10px] font-medium">
            <Check className="w-3 h-3" />
            Approved
          </span>
        );
      default:
        return null;
    }
  };

  const handleSearchClick = (br: BRollSuggestion) => {
    setActiveBRollId(br.id);
    setActiveSearchQuery(br.searchQuery);
    setSearchModalOpen(true);
  };

  const handleSelectFootage = (video: StockVideo) => {
    if (activeBRollId && onSetFootage) {
      onSetFootage(activeBRollId, video.downloadUrl, video.attribution);
    }
    setSearchModalOpen(false);
    setActiveBRollId(null);
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
            {ready.length} ready • {approved.length - ready.length} approved • {suggested.length} pending
          </p>
        </div>
        <Film className="w-5 h-5 text-blue-500" />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        {suggested.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onApproveAll}
            className="flex-1 gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Approve All ({suggested.length})
          </Button>
        )}
      </div>

      {/* B-Roll List */}
      <div className="space-y-2">
        {suggestions.map(br => {
          const isApproved = br.status === 'approved';
          const isReady = br.status === 'ready';
          const isRejected = br.status === 'rejected';

          return (
            <div
              key={br.id}
              className={cn(
                "p-3 rounded-xl border transition-all",
                isReady && "bg-green-500/5 border-green-500/30",
                isApproved && !isReady && "bg-blue-500/5 border-blue-500/30",
                isRejected && "bg-muted/30 border-border/30 opacity-60",
                !isApproved && !isRejected && !isReady && "bg-surface-elevated/50 border-border/50"
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
                  {getStatusBadge(br.status)}
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
                      (isApproved || isReady)
                        ? "text-blue-500 hover:text-blue-600" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {(isApproved || isReady) ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              <p className="text-sm text-foreground mb-2">
                {br.description}
              </p>

              {/* Stock footage thumbnail if ready */}
              {isReady && br.stockFootageUrl && (
                <div className="mb-2 rounded-lg overflow-hidden border border-border/50 relative group">
                  <video
                    src={br.stockFootageUrl}
                    className="w-full h-24 object-cover"
                    muted
                    loop
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSearchClick(br)}
                      className="gap-1"
                    >
                      <Search className="w-3 h-3" />
                      Change
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {/* Search button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSearchClick(br)}
                  className="h-7 gap-1.5 text-xs"
                >
                  {isReady ? (
                    <>
                      <Image className="w-3 h-3" />
                      Change Footage
                    </>
                  ) : (
                    <>
                      <Search className="w-3 h-3" />
                      Find Footage
                    </>
                  )}
                </Button>

                {!isReady && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50 text-xs text-muted-foreground">
                    <Search className="w-3 h-3" />
                    {br.searchQuery}
                  </div>
                )}
                
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

      {/* Stock Footage Search Modal */}
      <StockFootageSearch
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
        initialQuery={activeSearchQuery}
        onSelect={handleSelectFootage}
        selectedId={
          activeBRollId 
            ? suggestions.find(s => s.id === activeBRollId)?.stockFootageUrl?.split('pexels_')[1]
            : undefined
        }
      />
    </div>
  );
}
