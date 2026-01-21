import { memo } from 'react';
import { Scissors } from 'lucide-react';

export const ExcludedSectionOverlay = memo(function ExcludedSectionOverlay() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-destructive/20 flex items-center justify-center">
          <Scissors className="w-6 h-6 text-destructive" />
        </div>
        <p className="text-white text-sm font-medium">Excluded Section</p>
        <p className="text-white/60 text-xs mt-1">This part will be cut from the final video</p>
      </div>
    </div>
  );
});
