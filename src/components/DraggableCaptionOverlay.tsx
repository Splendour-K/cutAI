import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { TranscriptSegment } from '@/hooks/useVideoAnalysis';
import type { CaptionSettings, CaptionAnimation } from '@/types/video';

interface DraggableCaptionOverlayProps {
  currentTime: number;
  segments: TranscriptSegment[] | null;
  settings: CaptionSettings;
  onPositionChange?: (position: { x: number; y: number }) => void;
  editedCaptions?: Record<number, string>;
  containerRef?: React.RefObject<HTMLDivElement>;
  isEditing?: boolean;
}

export function DraggableCaptionOverlay({
  currentTime,
  segments,
  settings,
  onPositionChange,
  editedCaptions = {},
  containerRef,
  isEditing = false
}: DraggableCaptionOverlayProps) {
  const captionRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [localPosition, setLocalPosition] = useState(settings.customPosition);

  // Get current caption and word timing data
  const captionData = useMemo(() => {
    if (!segments || !settings.enabled) return null;
    
    const activeIndex = segments.findIndex(
      (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
    );
    
    if (activeIndex === -1) return null;
    
    const segment = segments[activeIndex];
    const text = editedCaptions[activeIndex] ?? segment.text;
    const words = text.split(' ');
    
    // Calculate word timing for animations
    const segmentDuration = segment.endTime - segment.startTime;
    const timePerWord = segmentDuration / words.length;
    const elapsedTime = currentTime - segment.startTime;
    const currentWordIndex = Math.floor(elapsedTime / timePerWord);
    const wordProgress = (elapsedTime % timePerWord) / timePerWord;
    
    return {
      index: activeIndex,
      text,
      words,
      speaker: segment.speaker,
      currentWordIndex: Math.min(currentWordIndex, words.length - 1),
      wordProgress,
      segmentProgress: elapsedTime / segmentDuration
    };
  }, [currentTime, segments, settings.enabled, editedCaptions]);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    setIsDragging(true);
    const rect = captionRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - rect.width / 2,
        y: e.clientY - rect.top - rect.height / 2
      });
    }
  }, [isEditing]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    setIsDragging(true);
    const touch = e.touches[0];
    const rect = captionRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: touch.clientX - rect.left - rect.width / 2,
        y: touch.clientY - rect.top - rect.height / 2
      });
    }
  }, [isEditing]);

  // Handle drag move
  useEffect(() => {
    if (!isDragging || !containerRef?.current) return;

    const handleMove = (clientX: number, clientY: number) => {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const x = ((clientX - dragOffset.x - containerRect.left) / containerRect.width) * 100;
      const y = ((clientY - dragOffset.y - containerRect.top) / containerRect.height) * 100;
      
      const clampedX = Math.max(10, Math.min(90, x));
      const clampedY = Math.max(5, Math.min(95, y));
      
      setLocalPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleEnd = () => {
      setIsDragging(false);
      if (localPosition) {
        onPositionChange?.(localPosition);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset, containerRef, localPosition, onPositionChange]);

  // Update local position when settings change
  useEffect(() => {
    setLocalPosition(settings.customPosition);
  }, [settings.customPosition]);

  if (!settings.enabled || !captionData) return null;

  const position = localPosition || settings.customPosition;

  const getPositionStyle = (): React.CSSProperties => {
    if (position) {
      return {
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)'
      };
    }
    
    switch (settings.position) {
      case 'top':
        return { top: '8%', left: '50%', transform: 'translateX(-50%)' };
      case 'center':
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'bottom':
      default:
        return { bottom: '15%', left: '50%', transform: 'translateX(-50%)' };
    }
  };

  const getAnimationClass = (): string => {
    if (settings.animation === 'none') return '';
    
    switch (settings.animation) {
      case 'pop':
        return 'animate-caption-pop';
      case 'pulse':
        return 'animate-caption-pulse';
      case 'glide':
        return 'animate-caption-glide';
      case 'bounce':
        return 'animate-caption-bounce';
      case 'typewriter':
        return 'animate-caption-typewriter';
      default:
        return '';
    }
  };

  return (
    <div
      ref={captionRef}
      className={cn(
        'absolute max-w-[90%] z-20',
        'transition-all duration-100',
        isEditing && 'cursor-move ring-2 ring-primary/50 ring-offset-2',
        isDragging && 'opacity-80',
        getAnimationClass()
      )}
      style={getPositionStyle()}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <CaptionContent
        captionData={captionData}
        settings={settings}
        isDragging={isDragging}
      />
      
      {isEditing && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded whitespace-nowrap">
          Drag to reposition
        </div>
      )}
    </div>
  );
}

interface CaptionContentProps {
  captionData: {
    text: string;
    words: string[];
    currentWordIndex: number;
    wordProgress: number;
    segmentProgress: number;
  };
  settings: CaptionSettings;
  isDragging: boolean;
}

function CaptionContent({ captionData, settings, isDragging }: CaptionContentProps) {
  const { words, currentWordIndex, wordProgress } = captionData;
  const fontFamily = settings.fontFamily || 'Inter';
  const strokeColor = settings.strokeColor || 'hsl(0, 0%, 0%)';
  const strokeWidth = settings.strokeWidth || 0;

  const getStyleClass = () => {
    switch (settings.style) {
      case 'hormozi':
        return 'bg-transparent px-1';
      case 'karaoke':
        return 'bg-background/60 backdrop-blur-sm px-6 py-3 rounded-xl';
      case 'pop':
      case 'bounce':
        return 'bg-transparent';
      case 'glide':
        return 'bg-gradient-to-r from-background/0 via-background/80 to-background/0 px-8 py-4';
      case 'modern':
        return 'bg-background/80 backdrop-blur-md px-6 py-3 rounded-xl shadow-xl';
      case 'minimal':
        return 'bg-transparent px-4 py-2';
      case 'bold':
        return 'bg-primary px-6 py-3 rounded-lg';
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
        return 'text-2xl';
      case 'xlarge':
        return 'text-3xl md:text-4xl';
      case 'medium':
      default:
        return 'text-lg';
    }
  };

  const getTextStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      fontFamily,
      color: settings.style === 'bold' ? undefined : (settings.textColor || 'hsl(var(--foreground))'),
    };

    if (settings.style === 'minimal') {
      style.textShadow = '0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6)';
    }

    if (strokeWidth > 0) {
      style.WebkitTextStroke = `${strokeWidth}px ${strokeColor}`;
      style.paintOrder = 'stroke fill';
    }

    return style;
  };

  // Hormozi style - Bold, high contrast, kinetic
  if (settings.style === 'hormozi') {
    return (
      <div className="text-center">
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
          {words.map((word, i) => {
            const isCurrentWord = i === currentWordIndex;
            const isPastWord = i < currentWordIndex;
            const isKeyWord = word.length > 4 || /^[A-Z]/.test(word);
            
            return (
              <span
                key={i}
                className={cn(
                  'font-black uppercase tracking-wide transition-all duration-150',
                  getFontSizeClass(),
                  isCurrentWord && 'scale-125 text-primary',
                  isPastWord && 'opacity-100',
                  !isPastWord && !isCurrentWord && 'opacity-40',
                  isKeyWord && isCurrentWord && 'text-yellow-400',
                )}
                style={{
                  ...getTextStyle(),
                  textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 4px 8px rgba(0,0,0,0.8)',
                  transform: isCurrentWord ? `scale(${1.1 + wordProgress * 0.15})` : undefined,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // Karaoke style - Word by word highlight
  if (settings.style === 'karaoke' || settings.animation === 'word-by-word') {
    const highlightColor = settings.brandColor || 'hsl(var(--primary))';
    
    return (
      <div className={cn('text-center', getStyleClass())}>
        <div className="flex flex-wrap justify-center gap-x-2" style={getTextStyle()}>
          {words.map((word, i) => {
            const isCurrentWord = i === currentWordIndex;
            const isPastWord = i < currentWordIndex;
            
            return (
              <span
                key={i}
                className={cn(
                  'transition-all duration-200 inline-block',
                  getFontSizeClass(),
                  isCurrentWord && 'font-bold',
                )}
                style={{
                  color: isPastWord || isCurrentWord ? highlightColor : settings.textColor,
                  transform: isCurrentWord ? 'scale(1.1)' : undefined,
                  opacity: isPastWord || isCurrentWord ? 1 : 0.6,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // Pop style - Words pop in one by one
  if (settings.style === 'pop' || settings.animation === 'pop') {
    return (
      <div className="text-center">
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
          {words.map((word, i) => {
            const isVisible = i <= currentWordIndex;
            const isCurrentWord = i === currentWordIndex;
            
            return (
              <span
                key={i}
                className={cn(
                  'font-bold transition-all duration-200',
                  getFontSizeClass(),
                  isVisible ? 'opacity-100' : 'opacity-0 scale-50',
                  isCurrentWord && 'animate-pop-in',
                )}
                style={{
                  ...getTextStyle(),
                  textShadow: '2px 2px 0 rgba(0,0,0,0.8)',
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // Bounce style
  if (settings.style === 'bounce' || settings.animation === 'bounce') {
    return (
      <div className="text-center">
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
          {words.map((word, i) => {
            const isCurrentWord = i === currentWordIndex;
            
            return (
              <span
                key={i}
                className={cn(
                  'font-bold inline-block',
                  getFontSizeClass(),
                  isCurrentWord && 'animate-bounce',
                )}
                style={{
                  ...getTextStyle(),
                  textShadow: '2px 2px 0 rgba(0,0,0,0.8)',
                  color: isCurrentWord ? settings.brandColor : settings.textColor,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // Glide style - Smooth sliding text
  if (settings.style === 'glide' || settings.animation === 'glide') {
    return (
      <div className={cn('text-center overflow-hidden', getStyleClass())}>
        <div 
          className={cn('font-medium whitespace-nowrap', getFontSizeClass())}
          style={{
            ...getTextStyle(),
            animation: 'glide-scroll 4s linear infinite',
          }}
        >
          {captionData.text}
        </div>
      </div>
    );
  }

  // Default/Standard styles
  return (
    <div className={cn('text-center', getStyleClass())}>
      <div className={getFontSizeClass()} style={getTextStyle()}>
        {settings.highlightKeywords ? (
          <HighlightedText text={captionData.text} brandColor={settings.brandColor} />
        ) : (
          captionData.text
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