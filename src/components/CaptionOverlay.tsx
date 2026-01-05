import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { TranscriptSegment } from '@/hooks/useVideoAnalysis';
import type { CaptionSettings } from '@/types/video';

interface CaptionOverlayProps {
  currentTime: number;
  segments: TranscriptSegment[] | null;
  settings: CaptionSettings;
  onEditCaption?: (segmentIndex: number, newText: string) => void;
  editedCaptions?: Record<number, string>;
}

export function CaptionOverlay({
  currentTime,
  segments,
  settings,
  editedCaptions = {}
}: CaptionOverlayProps) {
  const currentCaption = useMemo(() => {
    if (!segments || !settings.enabled) return null;
    
    const activeSegment = segments.findIndex(
      (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
    );
    
    if (activeSegment === -1) return null;
    
    const segment = segments[activeSegment];
    const text = editedCaptions[activeSegment] ?? segment.text;
    
    return {
      index: activeSegment,
      text,
      speaker: segment.speaker
    };
  }, [currentTime, segments, settings.enabled, editedCaptions]);

  if (!settings.enabled || !currentCaption) return null;

  const getPositionClass = () => {
    switch (settings.position) {
      case 'top':
        return 'top-8';
      case 'center':
        return 'top-1/2 -translate-y-1/2';
      case 'bottom':
      default:
        return 'bottom-20';
    }
  };

  const getStyleClass = () => {
    switch (settings.style) {
      case 'modern':
        return 'bg-background/80 backdrop-blur-md px-6 py-3 rounded-xl shadow-xl';
      case 'minimal':
        return 'bg-transparent text-shadow-lg px-4 py-2';
      case 'bold':
        return 'bg-primary px-6 py-3 rounded-lg font-bold text-primary-foreground';
      case 'subtitle':
      default:
        return 'bg-background/90 px-4 py-2 rounded-md';
    }
  };

  const getFontSizeClass = () => {
    const size = settings.fontSize || 'medium';
    switch (size) {
      case 'small':
        return 'text-sm';
      case 'large':
        return 'text-xl';
      case 'xlarge':
        return 'text-2xl';
      case 'medium':
      default:
        return 'text-base';
    }
  };

  const fontFamily = settings.fontFamily || 'Inter';

  return (
    <div 
      className={cn(
        'absolute left-1/2 -translate-x-1/2 max-w-[90%] text-center z-20 pointer-events-none',
        'transition-all duration-200 ease-out animate-fade-in',
        getPositionClass()
      )}
    >
      <div
        className={cn(
          'inline-block',
          getStyleClass(),
          getFontSizeClass()
        )}
        style={{ 
          fontFamily,
          color: settings.style === 'bold' ? undefined : (settings.textColor || 'hsl(var(--foreground))'),
          textShadow: settings.style === 'minimal' ? '0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6)' : undefined
        }}
      >
        {settings.highlightKeywords ? (
          <HighlightedText text={currentCaption.text} brandColor={settings.brandColor} />
        ) : (
          currentCaption.text
        )}
      </div>
    </div>
  );
}

function HighlightedText({ text, brandColor }: { text: string; brandColor?: string }) {
  const words = text.split(' ');
  const highlightColor = brandColor || 'hsl(var(--primary))';
  
  return (
    <span>
      {words.map((word, i) => {
        const isKeyword = word.length > 6 || /^[A-Z]/.test(word);
        return (
          <span 
            key={i}
            style={{ color: isKeyword ? highlightColor : undefined }}
            className={cn(isKeyword && 'font-semibold')}
          >
            {word}{i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </span>
  );
}
