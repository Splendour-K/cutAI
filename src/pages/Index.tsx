import { useState, useCallback } from 'react';
import { UploadZone } from '@/components/UploadZone';
import { EditorWorkspace } from '@/components/EditorWorkspace';
import type { VideoProject } from '@/types/video';

// Sample video for demo purposes
const SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const Index = () => {
  const [project, setProject] = useState<VideoProject | null>(null);

  const handleUpload = useCallback((file: File) => {
    const videoUrl = URL.createObjectURL(file);
    
    const newProject: VideoProject = {
      id: Date.now().toString(),
      title: file.name.replace(/\.[^/.]+$/, ''),
      videoUrl,
      videoFile: file,
      createdAt: new Date(),
      duration: 0,
      aspectRatio: '9:16', // Default to vertical for short-form
      status: 'analyzing',
    };

    setProject(newProject);
  }, []);

  const handleDemoMode = useCallback(() => {
    const demoProject: VideoProject = {
      id: 'demo',
      title: 'My Talking Head Video',
      videoUrl: SAMPLE_VIDEO,
      createdAt: new Date(),
      duration: 15,
      aspectRatio: '9:16',
      status: 'analyzing',
    };
    setProject(demoProject);
  }, []);

  const handleBack = useCallback(() => {
    if (project?.videoUrl && project.videoUrl !== SAMPLE_VIDEO) {
      URL.revokeObjectURL(project.videoUrl);
    }
    setProject(null);
  }, [project]);

  if (project) {
    return <EditorWorkspace project={project} onBack={handleBack} />;
  }

  return <UploadZone onUpload={handleUpload} onDemo={handleDemoMode} />
};

export default Index;
