import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  Enhancement, 
  EnhancementAnalysis, 
  EnhancementWorkflow,
  EnhancementSuggestion 
} from '@/types/enhancement';
import type { TranscriptSegment } from './useVideoAnalysis';

interface UseEnhancementWorkflowProps {
  projectId: string;
}

export function useEnhancementWorkflow({ projectId }: UseEnhancementWorkflowProps) {
  const [workflow, setWorkflow] = useState<EnhancementWorkflow>({
    status: 'idle',
    progress: 0,
    enhancements: [],
    analysis: null,
  });

  const updateWorkflow = useCallback((updates: Partial<EnhancementWorkflow>) => {
    setWorkflow(prev => ({ ...prev, ...updates }));
  }, []);

  // Analyze video for enhancement opportunities
  const analyzeForEnhancements = useCallback(async (
    transcript: { fullText: string; segments: TranscriptSegment[] },
    videoContext?: { genre?: string; mood?: string[]; pacing?: string }
  ) => {
    updateWorkflow({ 
      status: 'analyzing', 
      progress: 10,
      errorMessage: undefined 
    });

    try {
      const { data, error } = await supabase.functions.invoke('analyze-enhancements', {
        body: {
          projectId,
          transcript,
          videoContext,
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const analysis = data.analysis as EnhancementAnalysis;
      
      // Convert suggestions to enhancements
      const enhancements: Enhancement[] = analysis.suggestions.map((s, index) => ({
        id: `enhancement_${Date.now()}_${index}`,
        type: s.type,
        status: 'suggested',
        startTime: s.timestamp,
        endTime: s.endTime,
        duration: s.endTime - s.timestamp,
        description: s.description,
        triggerText: s.triggerText,
        reason: s.reason,
        confidence: s.confidence,
        category: s.category,
        tags: s.tags,
        position: s.position,
        content: s.suggestedPrompt ? { 
          type: s.type === 'visual' ? 'image' : s.type === 'sfx' ? 'audio' : 'graphic',
          prompt: s.suggestedPrompt 
        } : undefined,
        animation: s.animationType ? {
          enter: s.animationType,
          exit: 'fade',
          duration: 0.3,
        } : undefined,
      }));

      updateWorkflow({ 
        status: 'reviewing',
        progress: 50,
        analysis,
        enhancements,
      });

      toast.success(`Found ${enhancements.length} enhancement opportunities!`);
      return analysis;

    } catch (error) {
      console.error('Enhancement analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Enhancement analysis failed';
      
      updateWorkflow({ 
        status: 'error', 
        errorMessage,
        progress: 0
      });
      
      toast.error(`Analysis failed: ${errorMessage}`);
      throw error;
    }
  }, [projectId, updateWorkflow]);

  // Approve an enhancement (marks it for generation)
  const approveEnhancement = useCallback((enhancementId: string) => {
    setWorkflow(prev => ({
      ...prev,
      enhancements: prev.enhancements.map(e => 
        e.id === enhancementId ? { ...e, status: 'approved' as const } : e
      )
    }));
  }, []);

  // Reject an enhancement
  const rejectEnhancement = useCallback((enhancementId: string) => {
    setWorkflow(prev => ({
      ...prev,
      enhancements: prev.enhancements.map(e => 
        e.id === enhancementId ? { ...e, status: 'rejected' as const } : e
      )
    }));
  }, []);

  // Approve all suggested enhancements
  const approveAll = useCallback(() => {
    setWorkflow(prev => ({
      ...prev,
      enhancements: prev.enhancements.map(e => 
        e.status === 'suggested' ? { ...e, status: 'approved' as const } : e
      )
    }));
  }, []);

  // Update enhancement properties
  const updateEnhancement = useCallback((enhancementId: string, updates: Partial<Enhancement>) => {
    setWorkflow(prev => ({
      ...prev,
      enhancements: prev.enhancements.map(e => 
        e.id === enhancementId ? { ...e, ...updates } : e
      )
    }));
  }, []);

  // Generate content for a single enhancement
  const generateEnhancementContent = useCallback(async (enhancementId: string) => {
    const enhancement = workflow.enhancements.find(e => e.id === enhancementId);
    if (!enhancement) return;

    setWorkflow(prev => ({
      ...prev,
      enhancements: prev.enhancements.map(e => 
        e.id === enhancementId ? { ...e, status: 'generating' as const } : e
      )
    }));

    try {
      if (enhancement.type === 'visual') {
        const { data, error } = await supabase.functions.invoke('generate-enhancement-image', {
          body: {
            prompt: enhancement.content?.prompt || enhancement.description,
            style: 'cartoon',
          }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        updateEnhancement(enhancementId, {
          status: 'ready',
          content: {
            type: 'image',
            url: data.imageUrl,
            prompt: data.prompt,
          }
        });

        toast.success('Image generated!');

      } else if (enhancement.type === 'sfx') {
        const { data, error } = await supabase.functions.invoke('generate-enhancement-sfx', {
          body: {
            prompt: enhancement.content?.prompt || enhancement.description,
            duration: Math.min(enhancement.duration, 5),
          }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        updateEnhancement(enhancementId, {
          status: 'ready',
          content: {
            type: 'audio',
            url: data.audioUrl,
            prompt: data.prompt,
          }
        });

        toast.success('Sound effect generated!');

      } else {
        // Graphics and animations are handled client-side
        updateEnhancement(enhancementId, { status: 'ready' });
      }

    } catch (error) {
      console.error('Enhancement generation error:', error);
      updateEnhancement(enhancementId, { status: 'error' });
      toast.error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [workflow.enhancements, updateEnhancement]);

  // Generate all approved enhancements
  const generateApproved = useCallback(async () => {
    const approved = workflow.enhancements.filter(e => e.status === 'approved');
    if (approved.length === 0) {
      toast.error('No approved enhancements to generate');
      return;
    }

    updateWorkflow({ status: 'generating', progress: 50 });

    let completed = 0;
    for (const enhancement of approved) {
      try {
        await generateEnhancementContent(enhancement.id);
        completed++;
        updateWorkflow({ 
          progress: 50 + Math.round((completed / approved.length) * 50) 
        });
      } catch (error) {
        // Continue with other enhancements
        console.error(`Failed to generate ${enhancement.id}:`, error);
      }
    }

    updateWorkflow({ status: 'complete', progress: 100 });
    toast.success(`Generated ${completed} of ${approved.length} enhancements!`);
  }, [workflow.enhancements, generateEnhancementContent, updateWorkflow]);

  // Remove an enhancement entirely
  const removeEnhancement = useCallback((enhancementId: string) => {
    setWorkflow(prev => ({
      ...prev,
      enhancements: prev.enhancements.filter(e => e.id !== enhancementId)
    }));
  }, []);

  // Reposition an enhancement
  const repositionEnhancement = useCallback((
    enhancementId: string, 
    position: { x: number; y: number; scale: number }
  ) => {
    updateEnhancement(enhancementId, { position });
  }, [updateEnhancement]);

  // Update timing
  const retimeEnhancement = useCallback((
    enhancementId: string,
    startTime: number,
    endTime: number
  ) => {
    updateEnhancement(enhancementId, { 
      startTime, 
      endTime, 
      duration: endTime - startTime 
    });
  }, [updateEnhancement]);

  // Reset workflow
  const resetWorkflow = useCallback(() => {
    setWorkflow({
      status: 'idle',
      progress: 0,
      enhancements: [],
      analysis: null,
    });
  }, []);

  return {
    workflow,
    analyzeForEnhancements,
    approveEnhancement,
    rejectEnhancement,
    approveAll,
    updateEnhancement,
    generateEnhancementContent,
    generateApproved,
    removeEnhancement,
    repositionEnhancement,
    retimeEnhancement,
    resetWorkflow,
  };
}
