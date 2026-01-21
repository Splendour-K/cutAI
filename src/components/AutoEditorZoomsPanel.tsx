import { Check, ZoomIn, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ZoomEffect } from '@/types/autoEditor';

interface AutoEditorZoomsPanelProps {
  zooms: ZoomEffect[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ZoomEffect>) => void;
  onEnableAll: () => void;
  onSeek?: (time: number) => void;
}

export function AutoEditorZoomsPanel({
  zooms,
  onToggle,
  onUpdate,
  onEnableAll,
  onSeek,
}: AutoEditorZoomsPanelProps) {
  const enabled = zooms.filter(z => z.isEnabled);
  const disabled = zooms.filter(z => !z.isEnabled);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTypeIcon = (type: ZoomEffect['type']) => {
    switch (type) {
      case 'quick-punch': return '💥';
      case 'slow-zoom-in': return '🔍';
      case 'slow-zoom-out': return '🔭';
      case 'ken-burns': return '🎬';
      case 'focus-shift': return '🎯';
      default: return '🔍';
    }
  };

  const getTypeLabel = (type: ZoomEffect['type']) => {
    switch (type) {
      case 'quick-punch': return 'Punch Zoom';
      case 'slow-zoom-in': return 'Slow Zoom In';
      case 'slow-zoom-out': return 'Slow Zoom Out';
      case 'ken-burns': return 'Ken Burns';
      case 'focus-shift': return 'Focus Shift';
      default: return type;
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated/50 border border-border/50">
        <div>
          <p className="text-sm font-medium text-foreground">
            {zooms.length} Zoom Effects
          </p>
          <p className="text-xs text-muted-foreground">
            {enabled.length} enabled • {disabled.length} disabled
          </p>
        </div>
        <ZoomIn className="w-5 h-5 text-purple-500" />
      </div>

      {/* Quick Actions */}
      {disabled.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEnableAll}
          className="w-full gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Enable All Zooms ({disabled.length})
        </Button>
      )}

      {/* Zoom List */}
      <div className="space-y-3">
        {zooms.map(zoom => (
          <div
            key={zoom.id}
            className={cn(
              "p-3 rounded-xl border transition-all",
              zoom.isEnabled 
                ? "bg-purple-500/5 border-purple-500/30" 
                : "bg-muted/30 border-border/30 opacity-60"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getTypeIcon(zoom.type)}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {getTypeLabel(zoom.type)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(zoom.startTime)} - {formatTime(zoom.endTime)} ({zoom.duration.toFixed(1)}s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onSeek && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSeek(zoom.startTime)}
                    className="h-6 w-6 p-0"
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggle(zoom.id)}
                  className={cn(
                    "h-6 w-6 p-0",
                    zoom.isEnabled 
                      ? "text-purple-500 hover:text-purple-600" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Check className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {zoom.isEnabled && (
              <div className="space-y-3">
                {/* Zoom Type */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Type:</span>
                  <Select
                    value={zoom.type}
                    onValueChange={(value) => onUpdate(zoom.id, { type: value as ZoomEffect['type'] })}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick-punch">Quick Punch</SelectItem>
                      <SelectItem value="slow-zoom-in">Slow Zoom In</SelectItem>
                      <SelectItem value="slow-zoom-out">Slow Zoom Out</SelectItem>
                      <SelectItem value="ken-burns">Ken Burns</SelectItem>
                      <SelectItem value="focus-shift">Focus Shift</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Scale */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Scale:</span>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs text-foreground w-8">{zoom.startScale.toFixed(1)}x</span>
                    <Slider
                      value={[zoom.startScale, zoom.endScale]}
                      min={1}
                      max={1.5}
                      step={0.05}
                      onValueChange={([start, end]) => onUpdate(zoom.id, { 
                        startScale: start, 
                        endScale: end 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs text-foreground w-8">{zoom.endScale.toFixed(1)}x</span>
                  </div>
                </div>

                {/* Easing */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Easing:</span>
                  <Select
                    value={zoom.easing}
                    onValueChange={(value) => onUpdate(zoom.id, { easing: value as ZoomEffect['easing'] })}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="ease-in">Ease In</SelectItem>
                      <SelectItem value="ease-out">Ease Out</SelectItem>
                      <SelectItem value="ease-in-out">Ease In-Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {zoom.reason && (
              <p className="text-[10px] text-muted-foreground mt-2 italic">
                💡 {zoom.reason}
              </p>
            )}
          </div>
        ))}

        {zooms.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ZoomIn className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No zoom effects suggested</p>
          </div>
        )}
      </div>
    </div>
  );
}
