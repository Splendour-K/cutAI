import { useState } from 'react';
import { Download, FileJson, FileText, Film, Loader2, Check, X, Copy, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_EXPORT_SETTINGS, type ExportResolution, type ExportSettings, type RenderProgress } from '@/hooks/useVideoExport';

type ExportFormat = 'video' | 'edl' | 'json' | 'premiere' | 'fcpxml';
type ExportQuality = 'draft' | 'standard' | 'high';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportVideo: (settings: ExportSettings) => void;
  onExportEDL: (format: 'edl' | 'json' | 'premiere' | 'fcpxml') => void;
  isExporting: boolean;
  renderProgress: RenderProgress | null;
  hasEDL: boolean;
  hasVideo: boolean;
  /** Public link to the most recent cloud-saved export. */
  shareUrl?: string | null;
}

const FORMAT_OPTIONS: { id: ExportFormat; label: string; description: string; icon: React.ReactNode; group: 'render' | 'file' }[] = [
  { id: 'video', label: 'Download Video', description: 'Render edited video as WebM with cuts & zooms applied', icon: <Film className="w-5 h-5" />, group: 'render' },
  { id: 'json', label: 'JSON (EDL)', description: 'Full edit decision list as structured JSON', icon: <FileJson className="w-5 h-5" />, group: 'file' },
  { id: 'edl', label: 'CMX 3600 EDL', description: 'Standard EDL for DaVinci Resolve, Avid, etc.', icon: <FileText className="w-5 h-5" />, group: 'file' },
  { id: 'premiere', label: 'Premiere XML', description: 'Adobe Premiere Pro project XML', icon: <FileText className="w-5 h-5" />, group: 'file' },
  { id: 'fcpxml', label: 'FCPXML', description: 'Final Cut Pro X project file', icon: <FileText className="w-5 h-5" />, group: 'file' },
];

const RESOLUTION_OPTIONS: { id: ExportResolution; label: string }[] = [
  { id: 'source', label: 'Same as original' },
  { id: '2160p', label: '4K · 2160p' },
  { id: '1440p', label: 'QHD · 1440p' },
  { id: '1080p', label: 'Full HD · 1080p' },
  { id: '720p', label: 'HD · 720p' },
  { id: '480p', label: 'Small · 480p' },
];

const VIDEO_BITRATE_OPTIONS: { value: number; label: string }[] = [
  { value: 2_000_000, label: 'Light · 2 Mbps (smallest file)' },
  { value: 4_000_000, label: 'Balanced · 4 Mbps' },
  { value: 8_000_000, label: 'Sharp · 8 Mbps' },
  { value: 16_000_000, label: 'Very sharp · 16 Mbps' },
  { value: 30_000_000, label: 'Maximum · 30 Mbps (largest file)' },
];

const AUDIO_BITRATE_OPTIONS: { value: number; label: string }[] = [
  { value: 96_000, label: 'Voice · 96 kbps' },
  { value: 128_000, label: 'Standard · 128 kbps' },
  { value: 192_000, label: 'High · 192 kbps' },
  { value: 256_000, label: 'Studio · 256 kbps' },
];

export function ExportDialog({
  open,
  onOpenChange,
  onExportVideo,
  onExportEDL,
  isExporting,
  renderProgress,
  hasEDL,
  hasVideo,
  shareUrl,
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('video');
  const [selectedQuality, setSelectedQuality] = useState<ExportQuality>('standard');
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    if (selectedFormat === 'video') {
      onExportVideo(selectedQuality);
    } else {
      onExportEDL(selectedFormat as 'edl' | 'json' | 'premiere' | 'fcpxml');
    }
  };

  const isRendering = isExporting && renderProgress;
  const isComplete = renderProgress?.stage === 'complete';
  const isError = renderProgress?.stage === 'error';

  return (
    <Dialog open={open} onOpenChange={isExporting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Export Project
          </DialogTitle>
          <DialogDescription>
            Choose a format and quality for your export.
          </DialogDescription>
        </DialogHeader>

        {isRendering ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              {isComplete ? (
                <Check className="w-5 h-5 text-primary" />
              ) : isError ? (
                <X className="w-5 h-5 text-destructive" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              )}
              <span className="text-sm font-medium text-foreground">
                {renderProgress.message}
              </span>
            </div>
            <Progress value={renderProgress.progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {renderProgress.stage === 'preparing' && 'Loading source video...'}
              {renderProgress.stage === 'rendering' && 'Processing frames with effects...'}
              {renderProgress.stage === 'encoding' && 'Saving your video to the cloud...'}
              {renderProgress.stage === 'complete' && 'Your file downloaded and is saved in the cloud.'}
              {renderProgress.stage === 'error' && 'Something went wrong. Please try again.'}
            </p>

            {isComplete && shareUrl && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-primary" />
                  Share link
                </p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={shareUrl} className="h-8 text-xs" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={async () => {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Anyone with this link can watch your edited video.
                </p>
              </div>
            )}

            {(isComplete || isError) && (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Format selection */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Render</p>
              {FORMAT_OPTIONS.filter(f => f.group === 'render').map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  disabled={fmt.id === 'video' && !hasVideo}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                    selectedFormat === fmt.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30',
                    fmt.id === 'video' && !hasVideo && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className={cn('mt-0.5', selectedFormat === fmt.id ? 'text-primary' : 'text-muted-foreground')}>
                    {fmt.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{fmt.label}</p>
                    <p className="text-xs text-muted-foreground">{fmt.description}</p>
                  </div>
                </button>
              ))}

              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">Project Files</p>
              {FORMAT_OPTIONS.filter(f => f.group === 'file').map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  disabled={!hasEDL}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                    selectedFormat === fmt.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30',
                    !hasEDL && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className={cn('mt-0.5', selectedFormat === fmt.id ? 'text-primary' : 'text-muted-foreground')}>
                    {fmt.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{fmt.label}</p>
                    <p className="text-xs text-muted-foreground">{fmt.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Quality selector (only for video) */}
            {selectedFormat === 'video' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quality</p>
                <div className="flex gap-2">
                  {QUALITY_OPTIONS.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuality(q.id)}
                      className={cn(
                        'flex-1 p-2 rounded-lg border text-center transition-colors',
                        selectedQuality === q.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      )}
                    >
                      <p className="text-sm font-medium text-foreground">{q.label}</p>
                      <p className="text-[10px] text-muted-foreground">{q.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleExport} className="w-full gap-2" variant="ai">
              <Download className="w-4 h-4" />
              {selectedFormat === 'video' ? 'Render & Download' : `Export as ${selectedFormat.toUpperCase()}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
