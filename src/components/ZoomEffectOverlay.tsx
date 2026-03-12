import { forwardRef, memo } from 'react';
import { ZoomIn, ZoomOut, Focus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZoomEffect } from '@/types/autoEditor';

interface ZoomEffectOverlayProps {
  isActive: boolean;
  scale: number;
  focalPoint: { x: number; y: number };
  type?: ZoomEffect['type'];
}

const ZoomEffectOverlayBase = forwardRef<HTMLDivElement, ZoomEffectOverlayProps>(function ZoomEffectOverlay(
  {
    isActive,
    scale,
    focalPoint,
    type,
  }: ZoomEffectOverlayProps,
  ref,
) {
  if (!isActive) return null;

  const isZoomingIn = scale > 1;
  const zoomPercent = Math.round((scale - 1) * 100);

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none z-20">
      {/* Zoom indicator badge */}
      <div
        className={cn(
          'absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-lg',
          'bg-black/60 backdrop-blur-sm text-white text-xs font-medium',
          'animate-fade-in z-20',
        )}
      >
        {isZoomingIn ? <ZoomIn className="w-3.5 h-3.5" /> : <ZoomOut className="w-3.5 h-3.5" />}
        <span>
          {zoomPercent > 0 ? '+' : ''}
          {zoomPercent}%
        </span>
      </div>

      {/* Focal point indicator (subtle) */}
      {type === 'focus-shift' && (
        <div
          className="absolute w-8 h-8 animate-pulse"
          style={{
            left: `calc(${focalPoint.x}% - 16px)`,
            top: `calc(${focalPoint.y}% - 16px)`,
          }}
        >
          <div className="w-full h-full rounded-full border-2 border-white/40 flex items-center justify-center">
            <Focus className="w-4 h-4 text-white/60" />
          </div>
        </div>
      )}

      {/* Corner vignette effect for dramatic zooms */}
      {scale > 1.2 && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at ${focalPoint.x}% ${focalPoint.y}%, transparent 50%, rgba(0,0,0,0.3) 100%)`,
          }}
        />
      )}
    </div>
  );
});

ZoomEffectOverlayBase.displayName = 'ZoomEffectOverlay';

export const ZoomEffectOverlay = memo(ZoomEffectOverlayBase);
ZoomEffectOverlay.displayName = 'ZoomEffectOverlay';

