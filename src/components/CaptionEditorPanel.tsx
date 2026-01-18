import { useState } from 'react';
import { Captions, Type, Palette, Move, Sparkles, Grip, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CaptionSettings, CaptionStyle, CaptionAnimation } from '@/types/video';
import type { TranscriptSegment } from '@/hooks/useVideoAnalysis';
import { CaptionStylePicker } from './CaptionStylePicker';

interface CaptionEditorPanelProps {
  settings: CaptionSettings;
  onSettingsChange: (settings: CaptionSettings) => void;
  segments?: TranscriptSegment[] | null;
  currentTime: number;
  editedCaptions: Record<number, string>;
  onEditCaption: (index: number, text: string) => void;
  onSeek: (time: number) => void;
  isEditMode: boolean;
  onEditModeChange: (editing: boolean) => void;
}

const FONT_FAMILIES = [
  { id: 'Inter', name: 'Inter', sample: 'Clean sans-serif' },
  { id: 'JetBrains Mono', name: 'JetBrains Mono', sample: 'Monospace' },
  { id: 'Georgia', name: 'Georgia', sample: 'Classic serif' },
  { id: 'Arial Black', name: 'Arial Black', sample: 'Bold impact' },
  { id: 'Verdana', name: 'Verdana', sample: 'Wide spacing' },
  { id: 'Impact', name: 'Impact', sample: 'Heavy weight' },
];

const FONT_SIZES = [
  { id: 'small', name: 'S' },
  { id: 'medium', name: 'M' },
  { id: 'large', name: 'L' },
  { id: 'xlarge', name: 'XL' },
];

const POSITIONS = [
  { id: 'top', name: 'Top', icon: '↑' },
  { id: 'center', name: 'Center', icon: '↔' },
  { id: 'bottom', name: 'Bottom', icon: '↓' },
] as const;

const PRESET_COLORS = [
  { color: 'hsl(0, 0%, 100%)', name: 'White' },
  { color: 'hsl(45, 100%, 55%)', name: 'Yellow' },
  { color: 'hsl(185, 85%, 50%)', name: 'Cyan' },
  { color: 'hsl(0, 72%, 55%)', name: 'Red' },
  { color: 'hsl(160, 70%, 45%)', name: 'Green' },
  { color: 'hsl(280, 70%, 60%)', name: 'Purple' },
];

export function CaptionEditorPanel({
  settings,
  onSettingsChange,
  segments,
  currentTime,
  editedCaptions,
  onEditCaption,
  onSeek,
  isEditMode,
  onEditModeChange
}: CaptionEditorPanelProps) {
  const [activeTab, setActiveTab] = useState('style');

  const updateSetting = <K extends keyof CaptionSettings>(
    key: K,
    value: CaptionSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const resetPosition = () => {
    onSettingsChange({ ...settings, customPosition: undefined });
  };

  const activeSegmentIndex = segments?.findIndex(
    seg => currentTime >= seg.startTime && currentTime <= seg.endTime
  ) ?? -1;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-surface/50">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Captions className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Captions</h3>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(checked) => updateSetting('enabled', checked)}
        />
      </div>

      {settings.enabled && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 grid grid-cols-3">
            <TabsTrigger value="style" className="text-xs">Style</TabsTrigger>
            <TabsTrigger value="customize" className="text-xs">Customize</TabsTrigger>
            <TabsTrigger value="text" className="text-xs">Edit Text</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {/* Style Tab */}
            <TabsContent value="style" className="p-4 space-y-4 m-0">
              <CaptionStylePicker
                selectedStyle={settings.style}
                selectedAnimation={settings.animation || 'none'}
                onStyleChange={(style) => updateSetting('style', style)}
                onAnimationChange={(animation) => updateSetting('animation', animation)}
              />
            </TabsContent>

            {/* Customize Tab */}
            <TabsContent value="customize" className="p-4 space-y-5 m-0">
              {/* Position Controls */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Move className="w-4 h-4 text-muted-foreground" />
                    Position
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditModeChange(!isEditMode)}
                    className={cn(
                      "gap-1 text-xs h-7",
                      isEditMode && "bg-primary text-primary-foreground"
                    )}
                  >
                    <Grip className="w-3 h-3" />
                    {isEditMode ? 'Done' : 'Drag'}
                  </Button>
                </div>

                <div className="flex gap-2">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => {
                        updateSetting('position', pos.id);
                        resetPosition();
                      }}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                        settings.position === pos.id && !settings.customPosition
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-muted-foreground/50'
                      )}
                    >
                      {pos.icon} {pos.name}
                    </button>
                  ))}
                </div>

                {settings.customPosition && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetPosition}
                    className="w-full gap-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Custom Position
                  </Button>
                )}
              </div>

              {/* Font Settings */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Type className="w-4 h-4 text-muted-foreground" />
                  Font
                </Label>
                
                <Select
                  value={settings.fontFamily || 'Inter'}
                  onValueChange={(value) => updateSetting('fontFamily', value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((font) => (
                      <SelectItem key={font.id} value={font.id}>
                        <span style={{ fontFamily: font.id }}>{font.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-1">
                  {FONT_SIZES.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => updateSetting('fontSize', size.id as CaptionSettings['fontSize'])}
                      className={cn(
                        'flex-1 py-1.5 rounded-md border text-xs font-medium transition-all',
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

              {/* Colors */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Palette className="w-4 h-4 text-muted-foreground" />
                  Colors
                </Label>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Text Color</p>
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

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Highlight Color</p>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.slice(1).map((preset) => (
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
              </div>

              {/* Highlight Keywords Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Label htmlFor="highlight-toggle" className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  Highlight Keywords
                </Label>
                <Switch
                  id="highlight-toggle"
                  checked={settings.highlightKeywords}
                  onCheckedChange={(checked) => updateSetting('highlightKeywords', checked)}
                />
              </div>
            </TabsContent>

            {/* Text Tab */}
            <TabsContent value="text" className="m-0 h-full">
              {segments && segments.length > 0 ? (
                <div className="divide-y divide-border">
                  {segments.map((segment, index) => {
                    const isActive = index === activeSegmentIndex;
                    const text = editedCaptions[index] ?? segment.text;
                    
                    return (
                      <div
                        key={index}
                        className={cn(
                          'p-3 transition-colors cursor-pointer',
                          isActive && 'bg-primary/5'
                        )}
                        onClick={() => onSeek(segment.startTime)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatTime(segment.startTime)}
                          </span>
                          {isActive && (
                            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                              Playing
                            </span>
                          )}
                        </div>
                        <textarea
                          value={text}
                          onChange={(e) => onEditCaption(index, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            'w-full bg-transparent resize-none text-sm text-foreground',
                            'focus:outline-none focus:bg-surface-elevated focus:rounded-md focus:p-2 focus:-m-2',
                            'transition-all'
                          )}
                          rows={2}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Captions className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No captions available</p>
                  <p className="text-xs mt-1">Generate captions first</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      )}
    </div>
  );
}