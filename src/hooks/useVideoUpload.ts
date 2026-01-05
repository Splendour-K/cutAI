import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Platform } from '@/types/video';

interface UploadResult {
  projectId: string;
  videoUrl: string;
  fileName: string;
}

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
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      const effectiveUserId = userId || user?.id;

      if (!effectiveUserId) {
        // For demo purposes, create a temporary project without storage
        const projectId = crypto.randomUUID();
        const videoUrl = URL.createObjectURL(file);
        
        toast.success('Video loaded for preview');
        setUploadProgress(100);
        
        return {
          projectId,
          videoUrl,
          fileName: file.name,
        };
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop() || 'mp4';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${effectiveUserId}/${fileName}`;

      setUploadProgress(10);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }

      setUploadProgress(60);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      setUploadProgress(70);

      // Create project record
      const { data: project, error: projectError } = await supabase
        .from('video_projects')
        .insert({
          user_id: effectiveUserId,
          title: file.name.replace(/\.[^/.]+$/, ''),
          video_url: publicUrl,
          platform,
          content_type: ['youtube', 'linkedin'].includes(platform) ? 'long' : 'short',
          aspect_ratio: platform === 'youtube' ? '16:9' : '9:16',
          status: 'ready',
        })
        .select()
        .single();

      if (projectError) {
        console.error('Project creation error:', projectError);
        throw new Error(projectError.message);
      }

      setUploadProgress(100);
      toast.success('Video uploaded successfully!');

      return {
        projectId: project.id,
        videoUrl: publicUrl,
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

  return {
    isUploading,
    uploadProgress,
    uploadVideo,
    getSignedUrl,
  };
}
