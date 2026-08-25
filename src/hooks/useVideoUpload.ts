import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { saveVideoLocally, generateAndCacheThumbnail } from '@/lib/localVideoStore';
import { probeVideoMetadata } from '@/lib/videoAssets';
import type { Platform } from '@/types/video';

interface UploadResult {
  projectId: string;
  videoUrl: string;
  cloudVideoUrl?: string;
  fileName: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

export function useVideoUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadVideo = useCallback(async (
    file: File,
    platform: Platform,
    userId?: string
  ): Promise<UploadResult | null> => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validate the file before touching any infrastructure
      if (!file.type.startsWith('video/')) {
        throw new Error('Please select a valid video file.');
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('This video is too large (max 2GB).');
      }

      const { data: { user } } = await supabase.auth.getUser();
      const effectiveUserId = userId || user?.id;

      if (!effectiveUserId) {
        // Unauthenticated preview only — nothing is persisted.
        const projectId = crypto.randomUUID();
        const videoUrl = URL.createObjectURL(file);

        await saveVideoLocally(projectId, file).catch(() => {});
        generateAndCacheThumbnail(projectId, file).catch(() => {});

        toast.success('Video loaded for preview');
        setUploadProgress(100);

        return { projectId, videoUrl, fileName: file.name };
      }

      setUploadProgress(5);

      // 1. Create the project record first (status: uploading)
      const title = file.name.replace(/\.[^/.]+$/, '');
      const { data: project, error: projectError } = await supabase
        .from('video_projects')
        .insert({
          user_id: effectiveUserId,
          title,
          platform,
          content_type: ['youtube', 'linkedin'].includes(platform) ? 'long' : 'short',
          aspect_ratio: platform === 'youtube' ? '16:9' : '9:16',
          status: 'uploading',
        })
        .select()
        .single();

      if (projectError) throw new Error(projectError.message);

      // 2. Create the asset record (status: uploading) — unique collision-proof path
      const fileExt = file.name.split('.').pop() || 'mp4';
      const assetId = crypto.randomUUID();
      const filePath = `${effectiveUserId}/projects/${project.id}/originals/${assetId}.${fileExt}`;

      const { error: assetError } = await supabase.from('video_assets').insert({
        id: assetId,
        project_id: project.id,
        user_id: effectiveUserId,
        kind: 'original',
        storage_bucket: 'videos',
        storage_path: filePath,
        original_filename: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        status: 'uploading',
      });

      if (assetError) {
        console.error('Asset record creation failed:', assetError);
        // Non-fatal: continue upload, project.video_url remains the reference.
      }

      setUploadProgress(15);

      // 3. Upload the original file to persistent cloud storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        // Mark the failure honestly — never leave a phantom "ready" asset.
        await supabase.from('video_assets')
          .update({ status: 'failed', error_message: uploadError.message })
          .eq('id', assetId);
        await supabase.from('video_projects')
          .update({ status: 'failed' })
          .eq('id', project.id);
        throw new Error(`Upload failed: ${uploadError.message}. Please try again.`);
      }

      setUploadProgress(75);

      // 4. Confirm success: persist the cloud reference + probed metadata
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      const meta = await probeVideoMetadata(file).catch(() => ({}));

      await Promise.all([
        supabase.from('video_projects')
          .update({
            video_url: publicUrl,
            status: 'ready',
            duration_seconds: meta.duration ?? null,
          })
          .eq('id', project.id),
        supabase.from('video_assets')
          .update({
            status: 'ready',
            public_url: publicUrl,
            duration_seconds: meta.duration ?? null,
            width: meta.width ?? null,
            height: meta.height ?? null,
          })
          .eq('id', assetId),
      ]);

      setUploadProgress(100);
      toast.success('Video uploaded successfully!');

      // 5. Local cache for performance only — cloud copy is the source of truth.
      await saveVideoLocally(project.id, file).catch(() => {});
      generateAndCacheThumbnail(project.id, file).catch(() => {});

      return {
        projectId: project.id,
        videoUrl: publicUrl,
        cloudVideoUrl: publicUrl,
        fileName: file.name,
      };

    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const getSignedUrl = useCallback(async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Failed to get signed URL:', error);
      return null;
    }
  }, []);

  const deleteProject = useCallback(async (projectId: string, videoUrl?: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.success('Video removed');
        return true;
      }

      // Collect every storage object for this project (originals + exports)
      const paths = new Set<string>();

      const { data: assets } = await supabase
        .from('video_assets')
        .select('storage_path')
        .eq('project_id', projectId);
      assets?.forEach((a) => a.storage_path && paths.add(a.storage_path));

      // Backward compatibility: legacy projects only have the URL on the project row
      if (videoUrl && videoUrl.includes('/storage/')) {
        const urlParts = videoUrl.split('/videos/');
        if (urlParts[1]) paths.add(decodeURIComponent(urlParts[1].split('?')[0]));
      }

      if (paths.size > 0) {
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([...paths]);
        if (storageError) console.error('Storage deletion error:', storageError);
      }

      await supabase.from('edit_history').delete().eq('project_id', projectId);
      await supabase.from('video_analysis').delete().eq('project_id', projectId);
      await supabase.from('video_assets').delete().eq('project_id', projectId);

      const { error: projectError } = await supabase
        .from('video_projects')
        .delete()
        .eq('id', projectId);

      if (projectError) throw new Error(projectError.message);

      toast.success('Video deleted successfully');
      return true;
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(error instanceof Error ? error.message : 'Delete failed');
      return false;
    }
  }, []);

  return {
    isUploading,
    uploadProgress,
    uploadVideo,
    getSignedUrl,
    deleteProject,
  };
}
