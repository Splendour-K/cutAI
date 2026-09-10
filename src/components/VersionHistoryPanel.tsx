import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  GitCompare,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  Pencil,
  Check,
  Layers,
} from 'lucide-react';
import { summarizeSnapshot, type ProjectVersion } from '@/hooks/useProjectVersions';

interface VersionHistoryPanelProps {
  versions: ProjectVersion[];
  isLoading: boolean;
  isSaving: boolean;
  onSave: (label: string) => void;
  onRestore: (version: ProjectVersion) => void;
  onRename: (versionId: string, label: string) => void;
  onDelete: (versionId: string) => void;
}

const ROWS: Array<{ key: keyof ReturnType<typeof summarizeSnapshot>; label: string }> = [
  { key: 'duration', label: 'Edited length' },
  { key: 'cuts', label: 'Cuts' },
  { key: 'broll', label: 'Stock footage' },
  { key: 'zooms', label: 'Zooms' },
  { key: 'graphics', label: 'Graphics' },
  { key: 'captions', label: 'Captions' },
  { key: 'format', label: 'Format' },
];

export function VersionHistoryPanel({
  versions,
  isLoading,
  isSaving,
  onSave,
  onRestore,
  onRename,
  onDelete,
}: VersionHistoryPanelProps) {
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-1), id]
    );
  };

  const compareA = versions.find((v) => v.id === selected[0]);
  const compareB = versions.find((v) => v.id === selected[1]);
  const sumA = compareA ? summarizeSnapshot(compareA.snapshot) : null;
  const sumB = compareB ? summarizeSnapshot(compareB.snapshot) : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-border/50 space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name this version (optional)"
            className="h-9 text-xs"
          />
          <Button
            size="sm"
            onClick={() => {
              onSave(label);
              setLabel('');
            }}
            disabled={isSaving}
            className="shrink-0"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save version
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Saved versions are kept in the cloud. Pick two to compare them side by side.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 mx-auto animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No saved versions yet</p>
            <p className="text-xs mt-1">Save one after an edit you like, so you can come back to it.</p>
          </div>
        ) : (
          versions.map((v) => {
            const isSelected = selected.includes(v.id);
            const summary = summarizeSnapshot(v.snapshot);
            return (
              <div
                key={v.id}
                className={cn(
                  'rounded-xl border p-3 transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50 bg-surface-elevated/50'
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => toggleSelect(v.id)}
                    aria-label={isSelected ? 'Unselect version' : 'Select version to compare'}
                    className={cn(
                      'mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0',
                      isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {editingId === v.id ? (
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
                            onRename(v.id, editValue);
                            setEditingId(null);
                          }}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-foreground truncate">
                        <span className="text-primary mr-1.5">v{v.version_number}</span>
                        {v.label}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(v.created_at).toLocaleString()} · {summary.duration} ·{' '}
                      {summary.cuts}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      aria-label="Rename version"
                      onClick={() => {
                        setEditingId(v.id);
                        setEditValue(v.label);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => onRestore(v)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive"
                      aria-label="Delete version"
                      onClick={() => onDelete(v.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {sumA && sumB && compareA && compareB && (
        <div className="border-t border-border/50 p-3 max-h-[45%] overflow-auto">
          <div className="flex items-center gap-2 mb-2">
            <GitCompare className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-medium text-foreground">
              Comparing v{compareA.version_number} and v{compareB.version_number}
            </h4>
          </div>
          <div className="rounded-xl border border-border/50 overflow-hidden text-xs">
            <div className="grid grid-cols-3 bg-surface-elevated/70 font-medium">
              <div className="p-2">What changed</div>
              <div className="p-2">v{compareA.version_number}</div>
              <div className="p-2">v{compareB.version_number}</div>
            </div>
            {ROWS.map((row) => {
              const a = sumA[row.key];
              const b = sumB[row.key];
              const differs = a !== b;
              return (
                <div
                  key={row.key}
                  className={cn(
                    'grid grid-cols-3 border-t border-border/40',
                    differs && 'bg-primary/5'
                  )}
                >
                  <div className="p-2 text-muted-foreground">{row.label}</div>
                  <div className={cn('p-2', differs && 'text-foreground font-medium')}>{a}</div>
                  <div className={cn('p-2', differs && 'text-primary font-medium')}>{b}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
