import { useState, useEffect, useRef } from 'react';
import { Edit3, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { TranscriptSegment } from '@/hooks/useVideoAnalysis';

interface CaptionEditorProps {
  segments: TranscriptSegment[] | null;
  currentTime: number;
  editedCaptions: Record<number, string>;
  onEditCaption: (index: number, text: string) => void;
  onSeek: (time: number) => void;
}

export function CaptionEditor({
  segments,
  currentTime,
  editedCaptions,
  onEditCaption,
  onSeek
}: CaptionEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const activeIndex = segments?.findIndex(
    seg => currentTime >= seg.startTime && currentTime <= seg.endTime
  ) ?? -1;

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  const startEditing = (index: number) => {
    const text = editedCaptions[index] ?? segments?.[index]?.text ?? '';
    setEditText(text);
    setEditingIndex(index);
  };

  const saveEdit = () => {
    if (editingIndex !== null) {
      onEditCaption(editingIndex, editText);
      setEditingIndex(null);
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const navigateSegment = (direction: 'prev' | 'next') => {
    if (!segments) return;
    
    const targetIndex = direction === 'prev' 
      ? Math.max(0, activeIndex - 1)
      : Math.min(segments.length - 1, activeIndex + 1);
    
    if (targetIndex >= 0 && segments[targetIndex]) {
      onSeek(segments[targetIndex].startTime);
    }
  };

  if (!segments || segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Edit3 className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No transcription available</p>
        <p className="text-xs mt-1">Upload and analyze a video to edit captions</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Navigation header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateSegment('prev')}
          disabled={activeIndex <= 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Segment {activeIndex >= 0 ? activeIndex + 1 : '-'} of {segments.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateSegment('next')}
          disabled={activeIndex >= segments.length - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Segments list */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-1">
          {segments.map((segment, index) => {
            const isActive = index === activeIndex;
            const isEditing = editingIndex === index;
            const displayText = editedCaptions[index] ?? segment.text;
            const isEdited = editedCaptions[index] !== undefined;

            return (
              <div
                key={index}
                ref={isActive ? activeRef : undefined}
                className={cn(
                  'group rounded-lg p-2 transition-all cursor-pointer',
                  isActive 
                    ? 'bg-primary/10 border border-primary/30' 
                    : 'hover:bg-surface-elevated border border-transparent',
                  isEditing && 'bg-surface-elevated border-primary/50'
                )}
                onClick={() => !isEditing && onSeek(segment.startTime)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5">
                    {formatTime(segment.startTime)}
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={saveEdit}>
                          <Check className="w-3 h-3 text-success" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={cancelEdit}>
                          <X className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          'text-sm leading-relaxed',
                          isActive ? 'text-foreground' : 'text-muted-foreground',
                          isEdited && 'text-primary'
                        )}>
                          {displayText}
                        </p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(index);
                          }}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {segment.speaker && (
                  <span className="text-xs text-primary/70 ml-12">
                    {segment.speaker}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
