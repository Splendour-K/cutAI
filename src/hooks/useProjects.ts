import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { deleteLocalVideo, hasLocalVideo, getVideoThumbnail } from '@/lib/localVideoStore';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type VideoProject = Tables<'video_projects'>;

export interface ProjectWithLocal extends VideoProject {
  hasLocalVideo: boolean;
  localThumbnail: string | null;
}

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithLocal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('video_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Check local availability in parallel
      const enriched = await Promise.all(
        (data || []).map(async (p) => {
          const [hasLocal, thumb] = await Promise.all([
            hasLocalVideo(p.id).catch(() => false),
            getVideoThumbnail(p.id).catch(() => null),
          ]);
          return { ...p, hasLocalVideo: hasLocal, localThumbnail: thumb };
        })
      );

      setProjects(enriched);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      toast.error('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const deleteProject = useCallback(async (projectId: string) => {
    try {
      // Delete related records first
      await supabase.from('edit_history').delete().eq('project_id', projectId);
      await supabase.from('video_analysis').delete().eq('project_id', projectId);
      const { error } = await supabase.from('video_projects').delete().eq('id', projectId);
      if (error) throw error;

      await deleteLocalVideo(projectId).catch(() => {});
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success('Project deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete project');
    }
  }, []);

  const duplicateProject = useCallback(async (projectId: string) => {
    if (!user) return;
    const source = projects.find((p) => p.id === projectId);
    if (!source) return;

    try {
      const { data, error } = await supabase
        .from('video_projects')
        .insert({
          user_id: user.id,
          title: `${source.title} (copy)`,
          platform: source.platform,
          content_type: source.content_type,
          aspect_ratio: source.aspect_ratio,
          video_url: source.video_url,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Project duplicated');
      await fetchProjects();
    } catch (err) {
      console.error('Duplicate failed:', err);
      toast.error('Failed to duplicate project');
    }
  }, [user, projects, fetchProjects]);

  const renameProject = useCallback(async (projectId: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('video_projects')
        .update({ title: newTitle })
        .eq('id', projectId);
      if (error) throw error;
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, title: newTitle } : p))
      );
    } catch (err) {
      console.error('Rename failed:', err);
      toast.error('Failed to rename project');
    }
  }, []);

  return { projects, isLoading, fetchProjects, deleteProject, duplicateProject, renameProject };
}
