import { cn } from '@/lib/utils';
import type { Platform } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';

interface PlatformSelectorProps {
  selected: Platform;
  onSelect: (platform: Platform) => void;
}

const platforms: Platform[] = ['youtube', 'instagram', 'tiktok', 'twitter', 'linkedin', 'custom'];

export function PlatformSelector({ selected, onSelect }: PlatformSelectorProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {platforms.map((platformId) => {
        const config = PLATFORM_CONFIGS[platformId];
        const isSelected = selected === platformId;
        
        return (
          <button
            key={platformId}
            onClick={() => onSelect(platformId)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-200",
              isSelected
                ? "bg-primary/10 border-primary text-foreground"
                : "bg-card/30 border-border/30 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            <span className="text-lg">{config.icon}</span>
            <span className="text-sm font-medium">{config.name}</span>
          </button>
        );
      })}
    </div>
  );
}
