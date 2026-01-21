import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  AutoEditorWorkflow, 
  EditDecisionList, 
  ARollSegment, 
  BRollSuggestion, 
  ZoomEffect,
  AutoEditorAnalysisRequest 
} from '@/types/autoEditor';
import type { TranscriptSegment } from './useVideoAnalysis';

interface UseAutoEditorProps {
  projectId: string;
}

export function useAutoEditor({ projectId }: UseAutoEditorProps) {
  const [workflow, setWorkflow] = useState<AutoEditorWorkflow>({
    status: 'idle',
    progress: 0,
    edl: null,
    reviewStep: 'cuts',
    hasUnapprovedChanges: false,
  });

  const updateWorkflow = useCallback((updates: Partial<AutoEditorWorkflow>) => {
    setWorkflow(prev => ({ ...prev, ...updates }));
  }, []);

  // Analyze video and generate EDL
  const analyzeAndGenerateEDL = useCallback(async (
    transcript: { fullText: string; segments: TranscriptSegment[] },
    videoDuration: number,
    options?: {
      targetStyle?: 'fast-paced' | 'moderate' | 'documentary' | 'auto';
      targetDurationReduction?: number;
      platform?: string;
      preferences?: {
        enableZooms: boolean;
        enableBRoll: boolean;
        cutFrequency: 'minimal' | 'moderate' | 'aggressive';
      };
    }
  ) => {
    updateWorkflow({ 
      status: 'analyzing', 
      progress: 10,
      errorMessage: undefined,
    });

    try {
      toast.info('AI is analyzing your video...');
      
      const { data, error } = await supabase.functions.invoke('auto-edit-video', {
        body: {
          projectId,
          transcript,
          videoDuration,
          targetStyle: options?.targetStyle || 'auto',
          targetDurationReduction: options?.targetDurationReduction || 20,
          platform: options?.platform || 'youtube',
          preferences: options?.preferences || {
            enableZooms: true,
            enableBRoll: true,
            cutFrequency: 'moderate',
          },
        } as AutoEditorAnalysisRequest
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const edl = data.edl as EditDecisionList;
      
      updateWorkflow({ 
        status: 'reviewing',
        progress: 50,
        edl,
        reviewStep: 'cuts',
        hasUnapprovedChanges: true,
      });

      const reduction = ((edl.originalDuration - edl.editedDuration) / edl.originalDuration * 100).toFixed(0);
      toast.success(`AI created ${edl.aRollSegments.length} segments. Reduced duration by ${reduction}%`);
      
      return edl;

    } catch (error) {
      console.error('Auto-edit analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Auto-edit failed';
      
      updateWorkflow({ 
        status: 'error', 
        errorMessage,
        progress: 0,
      });
      
      toast.error(`Analysis failed: ${errorMessage}`);
      throw error;
    }
  }, [projectId, updateWorkflow]);

  // Toggle segment inclusion
  const toggleSegmentInclusion = useCallback((segmentId: string) => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;
      
      const updatedSegments = prev.edl.aRollSegments.map(seg => 
        seg.id === segmentId ? { ...seg, isIncluded: !seg.isIncluded } : seg
      );
      
      // Recalculate timeline positions
      let currentTime = 0;
      const repositionedSegments = updatedSegments.map(seg => {
        if (seg.isIncluded) {
          const newSeg = {
            ...seg,
            newStartTime: currentTime,
            newEndTime: currentTime + seg.duration,
          };
          currentTime += seg.duration + (seg.transitionDuration || 0);
          return newSeg;
        }
        return seg;
      });
      
      const editedDuration = repositionedSegments
        .filter(s => s.isIncluded)
        .reduce((total, s) => total + s.duration, 0);

      return {
        ...prev,
        edl: {
          ...prev.edl,
          aRollSegments: repositionedSegments,
          editedDuration,
        },
        hasUnapprovedChanges: true,
      };
    });
  }, []);

  // Update segment cut type
  const updateSegmentCut = useCallback((segmentId: string, cutType: ARollSegment['cutType'], transitionDuration?: number) => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;
      
      return {
        ...prev,
        edl: {
          ...prev.edl,
          aRollSegments: prev.edl.aRollSegments.map(seg => 
            seg.id === segmentId ? { ...seg, cutType, transitionDuration } : seg
          ),
        },
        hasUnapprovedChanges: true,
      };
    });
  }, []);

  // Toggle B-roll suggestion
  const toggleBRoll = useCallback((brollId: string) => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;
      
      return {
        ...prev,
        edl: {
          ...prev.edl,
          bRollSuggestions: prev.edl.bRollSuggestions.map(br => 
            br.id === brollId 
              ? { ...br, status: br.status === 'approved' ? 'rejected' : 'approved' as const }
              : br
          ),
        },
        hasUnapprovedChanges: true,
      };
    });
  }, []);

  // Set stock footage for B-roll
  const setBRollFootage = useCallback((brollId: string, stockFootageUrl: string, attribution?: string) => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;
      
      return {
        ...prev,
        edl: {
          ...prev.edl,
          bRollSuggestions: prev.edl.bRollSuggestions.map(br => 
            br.id === brollId 
              ? { 
                  ...br, 
                  stockFootageUrl, 
                  status: 'ready' as const,
                  reason: attribution ? `${br.reason} | ${attribution}` : br.reason,
                }
              : br
          ),
        },
        hasUnapprovedChanges: true,
      };
    });
  }, []);

  // Approve all B-roll suggestions
  const approveAllBRoll = useCallback(() => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;
      
      return {
        ...prev,
        edl: {
          ...prev.edl,
          bRollSuggestions: prev.edl.bRollSuggestions.map(br => ({
            ...br,
            status: br.status === 'suggested' ? 'approved' as const : br.status,
          })),
        },
        hasUnapprovedChanges: true,
      };
    });
  }, []);

  // Toggle zoom effect
  const toggleZoom = useCallback((zoomId: string) => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;
      
      return {
        ...prev,
        edl: {
          ...prev.edl,
          zoomEffects: prev.edl.zoomEffects.map(z => 
            z.id === zoomId ? { ...z, isEnabled: !z.isEnabled } : z
          ),
        },
        hasUnapprovedChanges: true,
      };
    });
  }, []);

  // Update zoom properties
  const updateZoom = useCallback((zoomId: string, updates: Partial<ZoomEffect>) => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;
      
      return {
        ...prev,
        edl: {
          ...prev.edl,
          zoomEffects: prev.edl.zoomEffects.map(z => 
            z.id === zoomId ? { ...z, ...updates } : z
          ),
        },
        hasUnapprovedChanges: true,
      };
    });
  }, []);

  // Enable all zooms
  const enableAllZooms = useCallback(() => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;
      
      return {
        ...prev,
        edl: {
          ...prev.edl,
          zoomEffects: prev.edl.zoomEffects.map(z => ({ ...z, isEnabled: true })),
        },
        hasUnapprovedChanges: true,
      };
    });
  }, []);

  // Navigate review steps
  const goToReviewStep = useCallback((step: AutoEditorWorkflow['reviewStep']) => {
    updateWorkflow({ reviewStep: step });
  }, [updateWorkflow]);

  const nextReviewStep = useCallback(() => {
    setWorkflow(prev => {
      const steps: AutoEditorWorkflow['reviewStep'][] = ['cuts', 'broll', 'zooms', 'preview', 'complete'];
      const currentIndex = steps.indexOf(prev.reviewStep);
      const nextStep = steps[Math.min(currentIndex + 1, steps.length - 1)];
      
      return {
        ...prev,
        reviewStep: nextStep,
        progress: prev.progress + 10,
      };
    });
  }, []);

  const prevReviewStep = useCallback(() => {
    setWorkflow(prev => {
      const steps: AutoEditorWorkflow['reviewStep'][] = ['cuts', 'broll', 'zooms', 'preview', 'complete'];
      const currentIndex = steps.indexOf(prev.reviewStep);
      const prevStep = steps[Math.max(currentIndex - 1, 0)];
      
      return { ...prev, reviewStep: prevStep };
    });
  }, []);

  // Apply all edits
  const applyEdits = useCallback(async () => {
    if (!workflow.edl) return;
    
    updateWorkflow({ status: 'applying', progress: 80 });
    
    // Simulate applying edits (in a real implementation, this would process the video)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    updateWorkflow({ 
      status: 'complete', 
      progress: 100,
      reviewStep: 'complete',
      hasUnapprovedChanges: false,
    });
    
    toast.success('All edits applied successfully!');
  }, [workflow.edl, updateWorkflow]);

  // Reset workflow
  const resetWorkflow = useCallback(() => {
    setWorkflow({
      status: 'idle',
      progress: 0,
      edl: null,
      reviewStep: 'cuts',
      hasUnapprovedChanges: false,
    });
  }, []);

  // Get summary stats
  const getStats = useCallback(() => {
    if (!workflow.edl) return null;
    
    const includedSegments = workflow.edl.aRollSegments.filter(s => s.isIncluded);
    const approvedBRoll = workflow.edl.bRollSuggestions.filter(b => b.status === 'approved');
    const enabledZooms = workflow.edl.zoomEffects.filter(z => z.isEnabled);
    
    return {
      originalDuration: workflow.edl.originalDuration,
      editedDuration: workflow.edl.editedDuration,
      reductionPercent: ((workflow.edl.originalDuration - workflow.edl.editedDuration) / workflow.edl.originalDuration * 100).toFixed(0),
      totalSegments: workflow.edl.aRollSegments.length,
      includedSegments: includedSegments.length,
      removedSections: workflow.edl.removedSections.length,
      bRollCount: workflow.edl.bRollSuggestions.length,
      approvedBRoll: approvedBRoll.length,
      zoomCount: workflow.edl.zoomEffects.length,
      enabledZooms: enabledZooms.length,
      style: workflow.edl.style,
      pacing: workflow.edl.pacing,
    };
  }, [workflow.edl]);

  return {
    workflow,
    analyzeAndGenerateEDL,
    toggleSegmentInclusion,
    updateSegmentCut,
    toggleBRoll,
    setBRollFootage,
    approveAllBRoll,
    toggleZoom,
    updateZoom,
    enableAllZooms,
    goToReviewStep,
    nextReviewStep,
    prevReviewStep,
    applyEdits,
    resetWorkflow,
    getStats,
  };
}
