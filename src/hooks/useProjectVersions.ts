import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { CaptionSettings, AspectRatio, Platform } from '@/types/video';
import type { EditDecisionList } from '@/types/autoEditor';
import type { Enhancement } from '@/types/enhancement';

export interface ProjectVersionSnapshot {
  captions: CaptionSettings | null;
  edl: EditDecisionList | null;
  enhancements: Enhancement[];
  editedCaptions: Record<number, string>;
  aspectRatio: AspectRatio;
  platform: Platform;
  title: string;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  label: string;
  note: string | null;
  snapshot: ProjectVersionSnapshot;
  created_at: string;
}

export interface VersionSummary {
  format: string;
  captions: string;
  cuts: string;
  duration: string;
  broll: string;
  zooms: string;
  graphics: string;
}

export function summarizeSnapshot(snap: ProjectVersionSnapshot): VersionSummary {
  const edl = snap?.edl ?? null;
  const included = edl?.aRollSegments?.filter((s) => s.isIncluded) ?? [];
  const removed = edl?.removedSections?.length ?? 0;
  const broll = edl?.bRollSuggestions?.filter(
    (b) => b.status === 'approved' || b.status === 'ready'
  ).length ?? 0;
  const zooms = edl?.zoomEffects?.filter((z) => z.isEnabled).length ?? 0;
  const graphics = snap?.enhancements?.length ?? 0;
  const fmtTime = (s?: number) =>
    s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  return {
    format: `${snap?.aspectRatio ?? '—'} · ${snap?.platform ?? '—'}`,
    captions: snap?.captions?.enabled
      ? `On · ${snap.captions.style} · ${snap.captions.animation}`
      : 'Off',
    cuts: edl ? `${removed} removed · ${included.length} kept` : 'None',
    duration: edl ? fmtTime(edl.editedDuration) : '—',
    broll: edl ? `${broll} clip${broll === 1 ? '' : 's'}` : 'None',
    zooms: edl ? `${zooms} effect${zooms === 1 ? '' : 's'}` : 'None',
    graphics: `${graphics} item${graphics === 1 ? '' : 's'}`,
  };
}

export function useProjectVersions(projectId: string) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      setVersions((data ?? []) as unknown as ProjectVersion[]);
    } catch (err) {
      console.error('Failed to load versions:', err);
      toast.error("Couldn't load saved versions");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const saveVersion = useCallback(
    async (snapshot: ProjectVersionSnapshot, label?: string, note?: string) => {
      if (!user) {
        toast.error('Sign in to save a version');
        return null;
      }
      setIsSaving(true);
      try {
        const { data, error } = await supabase
          .from('project_versions')
          .insert({
            project_id: projectId,
            user_id: user.id,
            label: label?.trim() || `Saved ${new Date().toLocaleString()}`,
            note: note?.trim() || null,
            snapshot: snapshot as never,
            version_number: 0,
          })
          .select()
          .single();
        if (error) throw error;
        const created = data as unknown as ProjectVersion;
        setVersions((prev) => [created, ...prev]);
        toast.success(`Version ${created.version_number} saved`);
        return created;
      } catch (err) {
        console.error('Failed to save version:', err);
        toast.error("Couldn't save this version");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [projectId, user]
  );

  const renameVersion = useCallback(async (versionId: string, label: string) => {
    const clean = label.trim();
    if (!clean) return;
    setVersions((prev) => prev.map((v) => (v.id === versionId ? { ...v, label: clean } : v)));
    const { error } = await supabase
      .from('project_versions')
      .update({ label: clean })
      .eq('id', versionId);
    if (error) {
      console.error(error);
      toast.error("Couldn't rename this version");
      fetchVersions();
    }
  }, [fetchVersions]);

  const deleteVersion = useCallback(async (versionId: string) => {
    const { error } = await supabase.from('project_versions').delete().eq('id', versionId);
    if (error) {
      console.error(error);
      toast.error("Couldn't delete this version");
      return;
    }
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    toast.success('Version deleted');
  }, []);

  return { versions, isLoading, isSaving, fetchVersions, saveVersion, renameVersion, deleteVersion };
}
