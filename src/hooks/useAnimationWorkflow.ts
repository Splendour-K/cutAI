import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  AnimationWorkflow, 
  VideoContext, 
  Storyboard, 
  VisualStyle,
  WorkflowStep 
} from '@/types/animation';
import type { TranscriptSegment } from './useVideoAnalysis';

interface UseAnimationWorkflowProps {
  projectId: string;
  videoFile?: File;
  videoUrl?: string;
}

export function useAnimationWorkflow({ projectId, videoFile, videoUrl }: UseAnimationWorkflowProps) {
  const [workflow, setWorkflow] = useState<AnimationWorkflow>({
    status: 'idle',
    currentStep: 'context-analysis',
    progress: 0,
    videoContext: null,
    storyboard: null,
    approvedElements: [],
  });

  const updateWorkflow = useCallback((updates: Partial<AnimationWorkflow>) => {
    setWorkflow(prev => ({ ...prev, ...updates }));
  }, []);

  // Step 1: Analyze video context
  const analyzeContext = useCallback(async (existingTranscript?: { fullText: string; segments: TranscriptSegment[] }) => {
    updateWorkflow({ 
      status: 'analyzing', 
      currentStep: 'context-analysis',
      progress: 10,
      errorMessage: undefined 
    });

    try {
      let requestBody: any = { projectId };

      if (videoFile) {
        const base64 = await fileToBase64(videoFile);
        requestBody.videoBase64 = base64;
        requestBody.mimeType = videoFile.type;
      } else if (videoUrl && !videoUrl.startsWith('blob:')) {
        requestBody.videoUrl = videoUrl;
      } else if (existingTranscript) {
        // For blob URLs, use existing transcript
        requestBody.existingTranscript = existingTranscript;
      } else {
        throw new Error("Video file, URL, or existing transcript required");
      }

      updateWorkflow({ progress: 30 });

      const { data, error } = await supabase.functions.invoke('analyze-context', {
        body: requestBody
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const videoContext = data.context as VideoContext;
      
      updateWorkflow({ 
        videoContext,
        currentStep: 'style-selection',
        progress: 50,
        status: 'reviewing'
      });

      toast.success('Video context analyzed! Select your animation style.');
      return videoContext;

    } catch (error) {
      console.error('Context analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Context analysis failed';
      
      updateWorkflow({ 
        status: 'error', 
        errorMessage,
        progress: 0
      });
      
      toast.error(`Analysis failed: ${errorMessage}`);
      throw error;
    }
  }, [projectId, videoFile, videoUrl, updateWorkflow]);

  // Step 2: Generate storyboard based on selected style
  const generateStoryboard = useCallback(async (selectedStyle: VisualStyle) => {
    if (!workflow.videoContext) {
      throw new Error("Video context required before generating storyboard");
    }

    updateWorkflow({ 
      status: 'generating', 
      currentStep: 'storyboard-generation',
      progress: 60 
    });

    try {
      const { data, error } = await supabase.functions.invoke('generate-storyboard', {
        body: {
          projectId,
          videoContext: workflow.videoContext,
          selectedStyle
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const storyboard = data.storyboard as Storyboard;
      
      updateWorkflow({ 
        storyboard,
        currentStep: 'element-review',
        progress: 80,
        status: 'reviewing'
      });

      toast.success('Storyboard generated! Review and approve animations.');
      return storyboard;

    } catch (error) {
      console.error('Storyboard generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Storyboard generation failed';
      
      updateWorkflow({ 
        status: 'error', 
        errorMessage 
      });
      
      toast.error(`Generation failed: ${errorMessage}`);
      throw error;
    }
  }, [projectId, workflow.videoContext, updateWorkflow]);

  // Step 3: Approve individual elements
  const approveElement = useCallback((elementId: string) => {
    setWorkflow(prev => ({
      ...prev,
      approvedElements: [...prev.approvedElements, elementId]
    }));
  }, []);

  const unapproveElement = useCallback((elementId: string) => {
    setWorkflow(prev => ({
      ...prev,
      approvedElements: prev.approvedElements.filter(id => id !== elementId)
    }));
  }, []);

  const approveAllElements = useCallback(() => {
    if (!workflow.storyboard) return;
    
    const allElementIds = workflow.storyboard.scenes.flatMap(
      scene => scene.elements.map(el => el.id)
    );
    
    setWorkflow(prev => ({
      ...prev,
      approvedElements: allElementIds
    }));
  }, [workflow.storyboard]);

  // Step 4: Move to animation preview
  const proceedToPreview = useCallback(() => {
    updateWorkflow({
      currentStep: 'animation-preview',
      progress: 90,
      status: 'reviewing'
    });
  }, [updateWorkflow]);

  // Step 5: Apply animations (finalize)
  const applyAnimations = useCallback(() => {
    updateWorkflow({
      currentStep: 'final-integration',
      progress: 100,
      status: 'complete'
    });
    
    toast.success('Animations applied! Your video is ready.');
  }, [updateWorkflow]);

  // Reset workflow
  const resetWorkflow = useCallback(() => {
    setWorkflow({
      status: 'idle',
      currentStep: 'context-analysis',
      progress: 0,
      videoContext: null,
      storyboard: null,
      approvedElements: [],
    });
  }, []);

  // Go back to a previous step
  const goToStep = useCallback((step: WorkflowStep) => {
    const stepOrder: WorkflowStep[] = [
      'context-analysis',
      'style-selection',
      'storyboard-generation',
      'element-review',
      'animation-preview',
      'final-integration'
    ];
    
    const stepIndex = stepOrder.indexOf(step);
    const progress = (stepIndex / (stepOrder.length - 1)) * 100;
    
    updateWorkflow({
      currentStep: step,
      progress,
      status: step === 'context-analysis' ? 'idle' : 'reviewing'
    });
  }, [updateWorkflow]);

  return {
    workflow,
    analyzeContext,
    generateStoryboard,
    approveElement,
    unapproveElement,
    approveAllElements,
    proceedToPreview,
    applyAnimations,
    resetWorkflow,
    goToStep,
  };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
