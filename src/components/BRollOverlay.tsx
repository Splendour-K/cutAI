import { memo } from 'react';
import { Film, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BRollSuggestion } from '@/types/autoEditor';

interface BRollOverlayProps {
  bRoll: BRollSuggestion;
  onDismiss?: () => void;
}

export const BRollOverlay = memo(function BRollOverlay({
  bRoll,
  onDismiss,
}: BRollOverlayProps) {
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
      className={cn(
        "absolute z-20 overflow-hidden",
        isPip && "rounded-lg shadow-xl border border-white/20",
        getPositionClasses()
      )}
    >
      {bRoll.stockFootageUrl ? (
        // Actual stock footage
        <video
          src={bRoll.stockFootageUrl}
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
        />
      ) : (
        // Placeholder when no footage is selected yet
        <div className={cn(
          "w-full h-full flex flex-col items-center justify-center",
          "bg-gradient-to-br from-primary/20 to-primary/40 backdrop-blur-sm"
        )}>
          <Film className={cn(
            "text-white/80 mb-2",
            isFullscreen ? "w-12 h-12" : "w-6 h-6"
          )} />
          {isFullscreen && (
            <>
              <p className="text-white/90 text-sm font-medium">B-Roll Suggestion</p>
              <p className="text-white/60 text-xs mt-1 px-4 text-center">
                {bRoll.description}
              </p>
            </>
          )}
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
