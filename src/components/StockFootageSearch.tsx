import { useState, useEffect } from 'react';
import { Search, Loader2, Play, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useStockFootage, type StockVideo } from '@/hooks/useStockFootage';

interface StockFootageSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery: string;
  onSelect: (video: StockVideo) => void;
  selectedId?: string;
}

export function StockFootageSearch({
  open,
  onOpenChange,
  initialQuery,
  onSelect,
  selectedId,
}: StockFootageSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const { isLoading, results, hasMore, searchVideos, loadMore, clearResults } = useStockFootage();

  // Auto-search when dialog opens with initial query
  useEffect(() => {
    if (open && initialQuery && results.length === 0) {
      setQuery(initialQuery);
      searchVideos(initialQuery);
    }
  }, [open, initialQuery, results.length, searchVideos]);

  // Clear when dialog closes
  useEffect(() => {
    if (!open) {
      clearResults();
      setPreviewVideo(null);
    }
  }, [open, clearResults]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchVideos(query);
    }
  };

  const handleSelect = (video: StockVideo) => {
    onSelect(video);
    onOpenChange(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Stock Footage
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for stock videos..."
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </form>

        <ScrollArea className="h-[50vh]">
          {results.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {results.map((video) => {
                  const isSelected = video.id === selectedId;
                  const isPreviewing = previewVideo === video.id;

                  return (
                    <div
                      key={video.id}
                      className={cn(
                        "relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer",
                        isSelected 
                          ? "border-primary ring-2 ring-primary/20" 
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => handleSelect(video)}
                    >
                      {/* Thumbnail/Preview */}
                      <div className="aspect-video bg-muted relative">
                        {isPreviewing ? (
                          <video
                            src={video.previewUrl}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={video.thumbnailUrl}
                            alt="Stock footage"
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Duration badge */}
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs">
                          {formatDuration(video.duration)}
                        </span>

                        {/* Hover overlay */}
                        <div className={cn(
                          "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity",
                          isPreviewing ? "opacity-0" : "opacity-0 group-hover:opacity-100"
                        )}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewVideo(isPreviewing ? null : video.id);
                            }}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                        </div>

                        {/* Selected checkmark */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Attribution */}
                      <div className="p-2 bg-surface-elevated text-xs text-muted-foreground truncate">
                        {video.attribution}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Load More
                  </Button>
                </div>
              )}

              {/* Pexels attribution */}
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-2">
                <span>Videos provided by</span>
                <a
                  href="https://www.pexels.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  Pexels
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm">Searching for videos...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Search className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Search for stock footage to add as B-roll</p>
              <p className="text-xs mt-1">Try: "technology", "nature", "city"</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
