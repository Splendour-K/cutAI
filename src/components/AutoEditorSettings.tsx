import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EDITING_STYLE_PRESETS } from '@/types/autoEditor';

interface AutoEditorSettingsProps {
  options: {
    targetStyle: 'fast-paced' | 'moderate' | 'documentary' | 'auto';
    targetDurationReduction: number;
    platform: string;
    preferences: {
      enableZooms: boolean;
      enableBRoll: boolean;
      cutFrequency: 'minimal' | 'moderate' | 'aggressive';
    };
  };
  onChange: (options: AutoEditorSettingsProps['options']) => void;
}

export function AutoEditorSettings({ options, onChange }: AutoEditorSettingsProps) {
  const updatePreference = (key: string, value: any) => {
    onChange({
      ...options,
      preferences: {
        ...options.preferences,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-4 p-3 rounded-xl bg-surface-elevated/50 border border-border/50 mb-4">
      {/* Editing Style */}
      <div className="space-y-2">
        <Label className="text-xs">Editing Style</Label>
        <Select
          value={options.targetStyle}
          onValueChange={(value) => onChange({ ...options, targetStyle: value as any })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            <SelectItem value="fast-paced">Fast-paced (YouTube Shorts/TikTok)</SelectItem>
            <SelectItem value="moderate">Moderate (Standard YouTube)</SelectItem>
            <SelectItem value="documentary">Documentary (Slow, cinematic)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Target Platform */}
      <div className="space-y-2">
        <Label className="text-xs">Target Platform</Label>
        <Select
          value={options.platform}
          onValueChange={(value) => onChange({ ...options, platform: value })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="instagram">Instagram Reels</SelectItem>
            <SelectItem value="twitter">X / Twitter</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Duration Reduction */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Target Reduction</Label>
          <span className="text-xs text-muted-foreground">{options.targetDurationReduction}%</span>
        </div>
        <Slider
          value={[options.targetDurationReduction]}
          min={10}
          max={50}
          step={5}
          onValueChange={([value]) => onChange({ ...options, targetDurationReduction: value })}
        />
        <p className="text-[10px] text-muted-foreground">
          How much to shorten the video (10-50%)
        </p>
      </div>

      {/* Cut Frequency */}
      <div className="space-y-2">
        <Label className="text-xs">Cut Frequency</Label>
        <Select
          value={options.preferences.cutFrequency}
          onValueChange={(value) => updatePreference('cutFrequency', value)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minimal">Minimal (8-12s segments)</SelectItem>
            <SelectItem value="moderate">Moderate (5-8s segments)</SelectItem>
            <SelectItem value="aggressive">Aggressive (3-6s segments)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Feature Toggles */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">Dynamic Zooms</Label>
            <p className="text-[10px] text-muted-foreground">Add zoom effects for emphasis</p>
          </div>
          <Switch
            checked={options.preferences.enableZooms}
            onCheckedChange={(checked) => updatePreference('enableZooms', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">B-Roll Suggestions</Label>
            <p className="text-[10px] text-muted-foreground">Suggest supporting footage</p>
          </div>
          <Switch
            checked={options.preferences.enableBRoll}
            onCheckedChange={(checked) => updatePreference('enableBRoll', checked)}
          />
        </div>
      </div>
    </div>
  );
}
