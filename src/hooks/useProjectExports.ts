import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { ProjectVersionSnapshot } from '@/hooks/useProjectVersions';

export interface ProjectExport {
  id: string;
  project_id: string;
  version_number: number;
  label: string;
  quality: string;
  storage_bucket: string;
  storage_path: string;
  public_url: string | null;
  filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  snapshot: ProjectVersionSnapshot | null;
  created_at: string;
}

export interface ExportSummary {
  quality: string;
  size: string;
  duration: string;
  cuts: string;
  broll: string;
  zooms: string;
  captions: string;
  format: string;
}

const fmtTime = (s?: number | null) =>
  s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const fmtSize = (bytes?: number | null) => {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
};

export function summarizeExport(exp: ProjectExport): ExportSummary {
  const snap = exp.snapshot;
  const edl = snap?.edl ?? null;
  const included = edl?.aRollSegments?.filter((s) => s.isIncluded) ?? [];
  const removed = edl?.removedSections?.length ?? 0;
  const broll =
    edl?.bRollSuggestions?.filter((b) => b.status === 'approved' || b.status === 'ready').length ?? 0;
  const zooms = edl?.zoomEffects?.filter((z) => z.isEnabled).length ?? 0;

  return {
    quality: exp.quality,
    size: fmtSize(exp.file_size_bytes),
    duration: fmtTime(exp.duration_seconds ?? edl?.editedDuration),
    cuts: edl ? `${removed} removed · ${included.length} kept` : 'None',
    broll: `${broll} clip${broll === 1 ? '' : 's'}`,
    zooms: `${zooms} effect${zooms === 1 ? '' : 's'}`,
    captions: snap?.captions?.enabled
      ? `On · ${snap.captions.style} · ${snap.captions.animation}`
      : 'Off',
    format: `${snap?.aspectRatio ?? '—'} · ${snap?.platform ?? '—'}`,
  };
}

export interface NewExportRecord {
  storagePath: string;
  publicUrl: string | null;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  quality: string;
  durationSeconds?: number | null;
  label?: string;
  snapshot: ProjectVersionSnapshot;
}

export function useProjectExports(projectId: string) {
  const { user } = useAuth();
  const [exports, setExports] = useState<ProjectExport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchExports = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_exports')
        .select('*')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      setExports((data ?? []) as unknown as ProjectExport[]);
    } catch (err) {
      console.error('Failed to load exports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  const recordExport = useCallback(
    async (record: NewExportRecord) => {
      if (!user) return null;
      try {
        const { data, error } = await supabase
          .from('project_exports')
          .insert({
            project_id: projectId,
            user_id: user.id,
            label: record.label?.trim() || `Export ${new Date().toLocaleString()}`,
            quality: record.quality,
            storage_path: record.storagePath,
            public_url: record.publicUrl,
            filename: record.filename,
            mime_type: record.mimeType,
            file_size_bytes: record.fileSizeBytes,
            duration_seconds: record.durationSeconds ?? null,
            snapshot: record.snapshot as never,
            version_number: 0,
          })
          .select()
          .single();
        if (error) throw error;
        const created = data as unknown as ProjectExport;
        setExports((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        console.error('Failed to record export:', err);
        return null;
      }
    },
    [projectId, user]
  );

  const renameExport = useCallback(async (id: string, label: string) => {
    const clean = label.trim();
    if (!clean) return;
    setExports((prev) => prev.map((e) => (e.id === id ? { ...e, label: clean } : e)));
    const { error } = await supabase.from('project_exports').update({ label: clean }).eq('id', id);
    if (error) {
      console.error(error);
      toast.error("Couldn't rename this export");
      fetchExports();
    }
  }, [fetchExports]);

  const deleteExport = useCallback(async (id: string) => {
    const target = exports.find((e) => e.id === id);
    const { error } = await supabase.from('project_exports').delete().eq('id', id);
    if (error) {
      console.error(error);
      toast.error("Couldn't delete this export");
      return;
    }
    if (target) {
      await supabase.storage.from(target.storage_bucket).remove([target.storage_path]);
    }
    setExports((prev) => prev.filter((e) => e.id !== id));
    toast.success('Export deleted');
  }, [exports]);

  return { exports, isLoading, fetchExports, recordExport, renameExport, deleteExport };
}
