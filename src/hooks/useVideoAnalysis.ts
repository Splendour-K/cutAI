import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

export interface Transcription {
  fullText: string;
  segments: TranscriptSegment[];
  language: string;
  confidence: number;
}

export interface Pause {
  startTime: number;
  endTime: number;
  duration: number;
  type: 'silence' | 'filler' | 'hesitation';
}

export interface KeyMoment {
  timestamp: number;
  endTime?: number;
  type: 'highlight' | 'hook' | 'climax' | 'transition' | 'callToAction';
  description: string;
  importance: 'high' | 'medium' | 'low';
}

export interface SceneChange {
  timestamp: number;
  description: string;
  transitionType?: string;
}

export interface SuggestedEdit {
  type: 'cut' | 'trim' | 'speed' | 'caption' | 'transition' | 'effect';
  startTime: number;
  endTime?: number;
  description: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface VideoAnalysis {
  transcription: Transcription | null;
  pauses: Pause[] | null;
  keyMoments: KeyMoment[] | null;
  sceneChanges: SceneChange[] | null;
  suggestedEdits: SuggestedEdit[] | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export function useVideoAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);

  const analyzeVideo = useCallback(async (
    projectId: string,
    videoFile?: File,
    videoUrl?: string
  ) => {
    setIsAnalyzing(true);
    setAnalysis({
      transcription: null,
      pauses: null,
      keyMoments: null,
      sceneChanges: null,
      suggestedEdits: null,
      status: 'processing'
    });

    try {
      let requestBody: { projectId: string; videoUrl?: string; videoBase64?: string; mimeType?: string } = {
        projectId
      };

      if (videoFile) {
        // Convert file to base64
        const base64 = await fileToBase64(videoFile);
        requestBody.videoBase64 = base64;
        requestBody.mimeType = videoFile.type;
      } else if (videoUrl) {
        requestBody.videoUrl = videoUrl;
      } else {
        throw new Error("Either a video file or URL is required");
      }

      const { data, error } = await supabase.functions.invoke('analyze-video', {
        body: requestBody
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const result = data.analysis;
      setAnalysis({
        transcription: result.transcription,
        pauses: result.pauses,
        keyMoments: result.keyMoments,
        sceneChanges: result.sceneChanges,
        suggestedEdits: result.suggestedEdits,
        status: 'completed'
      });

      toast.success('Video analysis completed!');
      return result;

    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      
      setAnalysis(prev => ({
        ...prev!,
        status: 'error',
        errorMessage
      }));

      if (errorMessage.includes('Rate limit')) {
        toast.error('Rate limit exceeded. Please try again in a moment.');
      } else if (errorMessage.includes('credits')) {
        toast.error('AI credits exhausted. Please add more credits.');
      } else {
        toast.error(`Analysis failed: ${errorMessage}`);
      }
      
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const generateCaptions = useCallback(async (
    projectId: string,
    videoFile?: File,
    videoUrl?: string,
    skipPersistence = false
  ) => {
    setIsGeneratingCaptions(true);
    
    // Set processing state but preserve existing analysis data
    setAnalysis(prev => prev ? {
      ...prev,
      status: 'processing'
    } : {
      transcription: null,
      pauses: null,
      keyMoments: null,
      sceneChanges: null,
      suggestedEdits: null,
      status: 'processing'
    });

    try {
      let finalVideoUrl = videoUrl;

      // If we have a file, upload it to storage first to avoid memory issues
      if (videoFile) {
        // Check file size - if > 5MB, we need to upload to storage
        const fileSizeMB = videoFile.size / (1024 * 1024);
        
        if (fileSizeMB > 5) {
          toast.info('Uploading video for processing...');
          
          // Upload to Supabase storage
          const fileName = `temp_${projectId}_${Date.now()}.${videoFile.name.split('.').pop()}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('videos')
            .upload(fileName, videoFile, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error('Failed to upload video for processing');
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('videos')
            .getPublicUrl(fileName);
          
          finalVideoUrl = urlData.publicUrl;
        } else {
          // For small files, still try to use URL if available, otherwise use a temp blob URL
          if (!videoUrl) {
            // Create a temporary object URL - note this won't work for server-side
            // We'll need to upload for caption generation
            toast.info('Uploading video for processing...');
            
            const fileName = `temp_${projectId}_${Date.now()}.${videoFile.name.split('.').pop()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('videos')
              .upload(fileName, videoFile, {
                cacheControl: '3600',
                upsert: true
              });

            if (uploadError) {
              throw new Error('Failed to upload video for processing');
            }

            const { data: urlData } = supabase.storage
              .from('videos')
              .getPublicUrl(fileName);
            
            finalVideoUrl = urlData.publicUrl;
          }
        }
      }

      if (!finalVideoUrl) {
        throw new Error("Could not get a valid video URL for processing");
      }

      // For blob URLs, we can't process server-side
      if (finalVideoUrl.startsWith('blob:')) {
        throw new Error("Video needs to be uploaded to storage for caption generation. Please save your project first.");
      }

      const { data, error } = await supabase.functions.invoke('generate-captions', {
        body: {
          projectId,
          videoUrl: finalVideoUrl,
          skipPersistence
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        if (data.code === 'VIDEO_TOO_LARGE') {
          throw new Error('Video is too large for processing. Please use a shorter video (under 2 minutes).');
        }
        throw new Error(data.error);
      }

      const transcription = data.transcription;
      setAnalysis(prev => ({
        ...prev!,
        transcription,
        status: 'completed'
      }));

      toast.success('Captions generated!');
      return transcription;

    } catch (error) {
      console.error('Caption generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Caption generation failed';
      
      setAnalysis(prev => ({
        ...prev!,
        status: 'error',
        errorMessage
      }));

      if (errorMessage.includes('Rate limit')) {
        toast.error('Rate limit exceeded. Please try again in a moment.');
      } else if (errorMessage.includes('credits')) {
        toast.error('AI credits exhausted. Please add more credits.');
      } else if (errorMessage.includes('too large')) {
        toast.error(errorMessage);
      } else {
        toast.error(`Caption generation failed: ${errorMessage}`);
      }
      
      throw error;
    } finally {
      setIsGeneratingCaptions(false);
    }
  }, []);

  const fetchAnalysis = useCallback(async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('video_analysis')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAnalysis({
          transcription: data.transcription as unknown as Transcription | null,
          pauses: data.pauses as unknown as Pause[] | null,
          keyMoments: data.key_moments as unknown as KeyMoment[] | null,
          sceneChanges: data.scene_changes as unknown as SceneChange[] | null,
          suggestedEdits: data.suggested_edits as unknown as SuggestedEdit[] | null,
          status: data.analysis_status as VideoAnalysis['status'],
          errorMessage: data.error_message || undefined
        });
      }

      return data;
    } catch (error) {
      console.error('Error fetching analysis:', error);
      return null;
    }
  }, []);

  return {
    isAnalyzing,
    isGeneratingCaptions,
    analysis,
    analyzeVideo,
    generateCaptions,
    fetchAnalysis,
    setAnalysis
  };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just the base64 content
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
