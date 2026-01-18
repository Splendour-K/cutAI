import { cn } from '@/lib/utils';
import { Check, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BrandPresetsManager } from './BrandPresetsManager';
import type { VisualStyle, VideoContext } from '@/types/animation';
import type { BrandPreset } from '@/hooks/useBrandPresets';
import { ANIMATION_STYLE_PRESETS } from '@/types/animation';

interface AnimationStyleSelectorProps {
  selectedStyle: VisualStyle | null;
  onSelectStyle: (style: VisualStyle) => void;
  videoContext: VideoContext | null;
  brandPresets: BrandPreset[];
  onCreatePreset: (name: string, description: string, style: VisualStyle) => BrandPreset;
  onUpdatePreset: (presetId: string, updates: Partial<Omit<BrandPreset, 'id' | 'createdAt'>>) => void;
  onDeletePreset: (presetId: string) => void;
  onSetDefaultPreset: (presetId: string) => void;
  onDuplicatePreset: (presetId: string) => BrandPreset | undefined;
}

export function AnimationStyleSelector({
  selectedStyle,
  onSelectStyle,
  videoContext,
  brandPresets,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
  onSetDefaultPreset,
  onDuplicatePreset,
}: AnimationStyleSelectorProps) {
  // Get AI recommendation if available
  const recommendedStyleId = videoContext?.animationRecommendations?.suggestedStyle?.toLowerCase();
  const recommendedStyle = ANIMATION_STYLE_PRESETS.find(
    s => s.id === recommendedStyleId || s.name.toLowerCase().includes(recommendedStyleId || '')
  );

  return (
    <div className="space-y-4">
      {/* Brand Presets Section */}
      <BrandPresetsManager
        presets={brandPresets}
        selectedStyle={selectedStyle}
        onCreatePreset={onCreatePreset}
        onUpdatePreset={onUpdatePreset}
        onDeletePreset={onDeletePreset}
        onSetDefault={onSetDefaultPreset}
        onDuplicatePreset={onDuplicatePreset}
        onSelectPreset={onSelectStyle}
      />

      <Separator />

      {/* Built-in Styles */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Built-in Styles</h4>
        <ScrollArea className="h-[220px]">
          <div className="space-y-2 pr-3">
            {ANIMATION_STYLE_PRESETS.map((style) => {
              const isSelected = selectedStyle?.id === style.id;
              const isRecommended = recommendedStyle?.id === style.id;

              return (
                <button
                  key={style.id}
                  onClick={() => onSelectStyle(style)}
                  className={cn(
                    "w-full p-3 rounded-xl border-2 transition-all text-left",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-surface-elevated/50 hover:border-border hover:bg-surface-elevated"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Style Preview */}
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold shrink-0"
                      style={{
                        backgroundColor: style.primaryColor,
                        color: style.secondaryColor,
                        fontFamily: style.fontFamily,
                        textShadow: style.strokeEnabled 
                          ? `0 0 0 2px ${style.strokeColor}` 
                          : undefined,
                      }}
                    >
                      Aa
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground text-sm">
                          {style.name}
                        </span>
                        {isRecommended && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI Pick
                          </Badge>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary ml-auto shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {style.description}
                      </p>
                      
                      {/* Style attributes */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {style.animationIntensity}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {style.fontWeight}
                        </span>
                        {style.strokeEnabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            stroke
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
