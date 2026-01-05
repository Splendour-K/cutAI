import { useState, useCallback } from 'react';
import { UploadZone } from '@/components/UploadZone';
import { EditorWorkspace } from '@/components/EditorWorkspace';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import type { VideoProject, Platform, AspectRatio } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';

// Sample video for demo purposes
const SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const Index = () => {
  const [project, setProject] = useState<VideoProject | null>(null);
  const { uploadVideo, isUploading, uploadProgress } = useVideoUpload();

  const handleUpload = useCallback(async (file: File, platform: Platform = 'instagram', initialPrompt?: string) => {
    const config = PLATFORM_CONFIGS[platform];
    
    // Upload to storage (or create local URL for unauthenticated users)
    const result = await uploadVideo(file, platform);
    
    if (!result) {
      return; // Upload failed, error already shown
    }
    
    const newProject: VideoProject = {
      id: result.projectId,
      title: result.fileName.replace(/\.[^/.]+$/, ''),
      videoUrl: result.videoUrl,
      videoFile: file,
      createdAt: new Date(),
      duration: 0,
      aspectRatio: config.aspectRatios[0] as AspectRatio,
      platform,
      status: 'analyzing',
      edits: [],
    };

    setProject(newProject);
  }, [uploadVideo]);

  const handleDemoMode = useCallback((platform: Platform = 'instagram') => {
    const config = PLATFORM_CONFIGS[platform];
    const demoProject: VideoProject = {
      id: 'demo',
      title: 'My Talking Head Video',
      videoUrl: SAMPLE_VIDEO,
      createdAt: new Date(),
      duration: 15,
      aspectRatio: config.aspectRatios[0] as AspectRatio,
      platform,
      status: 'analyzing',
      edits: [],
    };
    setProject(demoProject);
  }, []);

  const handleBack = useCallback(() => {
    if (project?.videoUrl && project.videoUrl !== SAMPLE_VIDEO && project.videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(project.videoUrl);
    }
    setProject(null);
  }, [project]);

  if (project) {
    return <EditorWorkspace project={project} onBack={handleBack} />;
  }

  return <UploadZone onUpload={handleUpload} onDemo={handleDemoMode} isUploading={isUploading} uploadProgress={uploadProgress} />
};

export default Index;
