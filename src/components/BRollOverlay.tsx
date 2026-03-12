import { forwardRef, memo, useRef, useEffect, useState, useMemo } from 'react';
import { Film, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BRollSuggestion } from '@/types/autoEditor';

interface BRollOverlayProps {
  bRoll: BRollSuggestion;
  isPlaying?: boolean;
  currentTime?: number;
  onDismiss?: () => void;
}

const FADE_DURATION = 0.3; // seconds

const BRollOverlayBase = forwardRef<HTMLDivElement, BRollOverlayProps>(function BRollOverlay(
  {
    bRoll,
    isPlaying = true,
    currentTime = 0,
    onDismiss,
  }: BRollOverlayProps,
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Calculate fade opacity based on proximity to clip boundaries
  const fadeOpacity = useMemo(() => {
    const clipStart = bRoll.timestamp;
    const clipEnd = clipStart + (bRoll.duration || 3);
    const timeIntoClip = currentTime - clipStart;
    const timeUntilEnd = clipEnd - currentTime;

    // Fade in during first FADE_DURATION seconds
    if (timeIntoClip < FADE_DURATION) {
      return Math.max(0, Math.min(1, timeIntoClip / FADE_DURATION));
    }
    // Fade out during last FADE_DURATION seconds
    if (timeUntilEnd < FADE_DURATION) {
      return Math.max(0, Math.min(1, timeUntilEnd / FADE_DURATION));
    }
    return 1;
  }, [currentTime, bRoll.timestamp, bRoll.duration]);

  // Sync playback with main video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !bRoll.stockFootageUrl) return;

    // Calculate time within B-roll clip
    const bRollStartTime = bRoll.timestamp;
    const timeIntoClip = currentTime - bRollStartTime;

    // Keep video time synced
    if (Math.abs(video.currentTime - timeIntoClip) > 0.5) {
      video.currentTime = Math.max(0, timeIntoClip);
    }

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, currentTime, bRoll.timestamp, bRoll.stockFootageUrl]);

  // Determine position classes based on B-roll position setting
  const getPositionClasses = () => {
    switch (bRoll.position) {
      case 'pip-topright':
        return 'top-3 right-3 w-1/3 aspect-video';
      case 'pip-topleft':
        return 'top-3 left-3 w-1/3 aspect-video';
      case 'pip-bottomright':
        return 'bottom-16 right-3 w-1/3 aspect-video';
      case 'pip-bottomleft':
        return 'bottom-16 left-3 w-1/3 aspect-video';
      case 'split-left':
        return 'inset-y-0 left-0 w-1/2';
      case 'split-right':
        return 'inset-y-0 right-0 w-1/2';
      case 'fullscreen':
      default:
        return 'inset-0';
    }
  };

  const isFullscreen = bRoll.position === 'fullscreen' || !bRoll.position;
  const isPip = bRoll.position?.startsWith('pip-');

  return (
    <div
      ref={ref}
      style={{ opacity: fadeOpacity, transition: 'opacity 0.15s ease-out' }}
      className={cn(
        'absolute z-20 overflow-hidden',
        isPip && 'rounded-lg shadow-xl border border-white/20',
        getPositionClasses(),
      )}
    >
      {bRoll.stockFootageUrl ? (
        // Actual stock footage - synced playback
        <video
          ref={videoRef}
          src={bRoll.stockFootageUrl}
          className="w-full h-full object-cover"
          muted
          loop
          playsInline
        />
      ) : (
        // Placeholder when no footage is selected yet
        <div className={cn('w-full h-full flex flex-col items-center justify-center', 'bg-gradient-to-br from-primary/20 to-primary/40 backdrop-blur-sm')}>
          <Loader2 className={cn('text-white/80 mb-2 animate-spin', isFullscreen ? 'w-10 h-10' : 'w-5 h-5')} />
          {isFullscreen && (
            <>
              <p className="text-white/90 text-sm font-medium">Loading B-Roll...</p>
              <p className="text-white/60 text-xs mt-1 px-4 text-center">{bRoll.description}</p>
            </>
          )}
        </div>
      )}

      {/* B-Roll indicator badge */}
      {bRoll.stockFootageUrl && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
          <Film className="w-3 h-3 text-white/80" />
          <span className="text-[10px] text-white/80 font-medium">B-Roll</span>
        </div>
      )}

      {/* Info badge for PIP mode */}
      {isPip && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1">
          <p className="text-white text-[10px] truncate">{bRoll.description}</p>
        </div>
      )}

      {/* Dismiss button */}
      {onDismiss && isPip && (
        <button
          onClick={onDismiss}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      )}
    </div>
  );
});

BRollOverlayBase.displayName = 'BRollOverlay';

export const BRollOverlay = memo(BRollOverlayBase);
BRollOverlay.displayName = 'BRollOverlay';

