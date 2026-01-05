import { Captions, Type, Palette, Move, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CaptionSettings } from '@/types/video';

interface CaptionSettingsPanelProps {
  settings: CaptionSettings;
  onSettingsChange: (settings: CaptionSettings) => void;
}

const CAPTION_STYLES = [
  { id: 'modern', name: 'Modern', preview: 'Blurred background, rounded' },
  { id: 'minimal', name: 'Minimal', preview: 'Text shadow only' },
  { id: 'bold', name: 'Bold', preview: 'Solid color background' },
  { id: 'subtitle', name: 'Subtitle', preview: 'Classic dark background' },
] as const;

const FONT_FAMILIES = [
  { id: 'Inter', name: 'Inter', sample: 'Clean sans-serif' },
  { id: 'JetBrains Mono', name: 'JetBrains Mono', sample: 'Monospace' },
  { id: 'Georgia', name: 'Georgia', sample: 'Classic serif' },
  { id: 'Arial Black', name: 'Arial Black', sample: 'Bold impact' },
  { id: 'Verdana', name: 'Verdana', sample: 'Wide spacing' },
];

const FONT_SIZES = [
  { id: 'small', name: 'Small' },
  { id: 'medium', name: 'Medium' },
  { id: 'large', name: 'Large' },
  { id: 'xlarge', name: 'X-Large' },
];

const POSITIONS = [
  { id: 'top', name: 'Top', icon: '↑' },
  { id: 'center', name: 'Center', icon: '↔' },
  { id: 'bottom', name: 'Bottom', icon: '↓' },
] as const;

const PRESET_COLORS = [
  { color: 'hsl(185, 85%, 50%)', name: 'Cyan' },
  { color: 'hsl(0, 72%, 55%)', name: 'Red' },
  { color: 'hsl(45, 90%, 55%)', name: 'Yellow' },
  { color: 'hsl(160, 70%, 45%)', name: 'Green' },
  { color: 'hsl(280, 70%, 60%)', name: 'Purple' },
  { color: 'hsl(210, 20%, 95%)', name: 'White' },
];

export function CaptionSettingsPanel({
  settings,
  onSettingsChange
}: CaptionSettingsPanelProps) {
  const updateSetting = <K extends keyof CaptionSettings>(
    key: K,
    value: CaptionSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6 p-4">
      {/* Enable/Disable */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Captions className="w-4 h-4 text-primary" />
          <Label htmlFor="captions-toggle" className="font-medium">
            Show Captions
          </Label>
        </div>
        <Switch
          id="captions-toggle"
          checked={settings.enabled}
          onCheckedChange={(checked) => updateSetting('enabled', checked)}
        />
      </div>

      {settings.enabled && (
        <>
          {/* Style Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Caption Style</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CAPTION_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => updateSetting('style', style.id)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    settings.style === style.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground/50 hover:bg-surface-elevated'
                  )}
                >
                  <span className="text-sm font-medium block">{style.name}</span>
                  <span className="text-xs text-muted-foreground">{style.preview}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Position */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Move className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Position</Label>
            </div>
            <div className="flex gap-2">
              {POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => updateSetting('position', pos.id)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                    settings.position === pos.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  {pos.icon} {pos.name}
                </button>
              ))}
            </div>
          </div>

          {/* Font Family */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Font Family</Label>
            </div>
            <Select
              value={settings.fontFamily || 'Inter'}
              onValueChange={(value) => updateSetting('fontFamily', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font.id} value={font.id}>
                    <span style={{ fontFamily: font.id }}>{font.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({font.sample})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Font Size */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Font Size</Label>
            <div className="flex gap-2">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.id}
                  onClick={() => updateSetting('fontSize', size.id as CaptionSettings['fontSize'])}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-md border text-xs font-medium transition-all',
                    settings.fontSize === size.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </div>

          {/* Text Color */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Text Color</Label>
            </div>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => updateSetting('textColor', preset.color)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    settings.textColor === preset.color
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-muted-foreground/50'
                  )}
                  style={{ backgroundColor: preset.color }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          {/* Brand/Highlight Color */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Highlight Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.slice(0, 5).map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => updateSetting('brandColor', preset.color)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    settings.brandColor === preset.color
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-muted-foreground/50'
                  )}
                  style={{ backgroundColor: preset.color }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          {/* Highlight Keywords Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Label htmlFor="highlight-toggle" className="text-sm">
              Highlight Keywords
            </Label>
            <Switch
              id="highlight-toggle"
              checked={settings.highlightKeywords}
              onCheckedChange={(checked) => updateSetting('highlightKeywords', checked)}
            />
          </div>
        </>
      )}
    </div>
  );
}
