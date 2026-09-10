import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Check,
  Copy,
  Download,
  GitCompare,
  Loader2,
  Pencil,
  RotateCcw,
  Share2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { summarizeExport, type ExportSummary, type ProjectExport } from '@/hooks/useProjectExports';

interface ExportHistoryPanelProps {
  exports: ProjectExport[];
  isLoading: boolean;
  onRestore: (exp: ProjectExport) => void;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
}

const ROWS: Array<{ key: keyof ExportSummary; label: string }> = [
  { key: 'duration', label: 'Length' },
  { key: 'size', label: 'File size' },
  { key: 'quality', label: 'Quality' },
  { key: 'cuts', label: 'Cuts' },
  { key: 'broll', label: 'Stock footage' },
  { key: 'zooms', label: 'Zooms' },
  { key: 'captions', label: 'Captions' },
  { key: 'format', label: 'Format' },
];

export function ExportHistoryPanel({
  exports,
  isLoading,
  onRestore,
  onRename,
  onDelete,
}: ExportHistoryPanelProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-1), id]
    );

  const a = exports.find((e) => e.id === selected[0]);
  const b = exports.find((e) => e.id === selected[1]);
  const sumA = a ? summarizeExport(a) : null;
  const sumB = b ? summarizeExport(b) : null;

  const copyLink = async (url: string | null) => {
    if (!url) {
      toast.error('This export has no share link yet');
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Share link copied');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-border/50">
        <p className="text-[11px] text-muted-foreground">
          Every export is saved in the cloud with its own share link. Pick two to compare them.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 mx-auto animate-spin" />
          </div>
        ) : exports.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            <Share2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No exports yet</p>
            <p className="text-xs mt-1">Export your video and it will show up here with a link to share.</p>
          </div>
        ) : (
          exports.map((exp) => {
            const isSelected = selected.includes(exp.id);
            const summary = summarizeExport(exp);
            return (
              <div
                key={exp.id}
                className={cn(
                  'rounded-xl border p-3 transition-colors',
                  isSelected ? 'border-primary bg-primary/5' : 'border-border/50 bg-surface-elevated/50'
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => toggleSelect(exp.id)}
                    aria-label={isSelected ? 'Unselect export' : 'Select export to compare'}
                    className={cn(
                      'mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0',
                      isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {editingId === exp.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 text-xs"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => {
                            onRename(exp.id, editValue);
                            setEditingId(null);
                          }}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-foreground truncate">
                        <span className="text-primary mr-1.5">v{exp.version_number}</span>
                        {exp.label}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(exp.created_at).toLocaleString()} · {summary.duration} · {summary.size}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      aria-label="Rename export"
                      onClick={() => {
                        setEditingId(exp.id);
                        setEditValue(exp.label);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive"
                      aria-label="Delete export"
                      onClick={() => onDelete(exp.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => copyLink(exp.public_url)}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy link
                  </Button>
                  {exp.public_url && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
                      <a href={exp.public_url} target="_blank" rel="noreferrer">
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Open
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs ml-auto"
                    onClick={() => onRestore(exp)}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Restore these edits
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {sumA && sumB && a && b && (
        <div className="border-t border-border/50 p-3 max-h-[45%] overflow-auto">
          <div className="flex items-center gap-2 mb-2">
            <GitCompare className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-medium text-foreground">
              Comparing export v{a.version_number} and v{b.version_number}
            </h4>
          </div>
          <div className="rounded-xl border border-border/50 overflow-hidden text-xs">
            <div className="grid grid-cols-3 bg-surface-elevated/70 font-medium">
              <div className="p-2">What changed</div>
              <div className="p-2">v{a.version_number}</div>
              <div className="p-2">v{b.version_number}</div>
            </div>
            {ROWS.map((row) => {
              const va = sumA[row.key];
              const vb = sumB[row.key];
              const differs = va !== vb;
              return (
                <div
                  key={row.key}
                  className={cn('grid grid-cols-3 border-t border-border/40', differs && 'bg-primary/5')}
                >
                  <div className="p-2 text-muted-foreground">{row.label}</div>
                  <div className={cn('p-2', differs && 'text-foreground font-medium')}>{va}</div>
                  <div className={cn('p-2', differs && 'text-primary font-medium')}>{vb}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
