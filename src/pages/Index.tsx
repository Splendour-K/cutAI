import { useState, useCallback, useEffect } from 'react';
import { UploadZone } from '@/components/UploadZone';
import { EditorWorkspace } from '@/components/EditorWorkspace';
import { Dashboard } from '@/components/Dashboard';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import { useAuth } from '@/hooks/useAuth';
import type { VideoProject, Platform, AspectRatio } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';

const SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

type View = 'dashboard' | 'upload' | 'editor';

const Index = () => {
  const { user } = useAuth();
  const [project, setProject] = useState<VideoProject | null>(null);
  const [view, setView] = useState<View>(user ? 'dashboard' : 'upload');
  const { uploadVideo, isUploading, uploadProgress } = useVideoUpload();

  // Sync view when auth state changes
  useEffect(() => {
    if (user && view === 'upload' && !project) {
      setView('dashboard');
    }
  }, [user]);

  const handleUpload = useCallback(async (file: File, platform: Platform = 'instagram', initialPrompt?: string) => {
    const config = PLATFORM_CONFIGS[platform];
    const result = await uploadVideo(file, platform);
    if (!result) return;

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
    setView('editor');
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
    setView('editor');
  }, []);

  const handleBack = useCallback(() => {
    if (project?.videoUrl && project.videoUrl !== SAMPLE_VIDEO && project.videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(project.videoUrl);
    }
    setProject(null);
    setView(user ? 'dashboard' : 'upload');
  }, [project, user]);

  if (view === 'editor' && project) {
    return <EditorWorkspace project={project} onBack={handleBack} />;
  }

  if (view === 'dashboard' && user) {
    return (
      <Dashboard
        onNewProject={() => setView('upload')}
        onOpenProject={(p) => {
          setProject(p);
          setView('editor');
        }}
      />
    );
  }

  return (
    <UploadZone
      onUpload={handleUpload}
      onDemo={handleDemoMode}
      isUploading={isUploading}
      uploadProgress={uploadProgress}
      onBackToDashboard={user ? () => setView('dashboard') : undefined}
    />
  );
};

export default Index;
