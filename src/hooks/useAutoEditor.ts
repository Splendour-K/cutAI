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

  // Auto-approve all AI decisions in the EDL
  const autoApproveAll = useCallback((edl: EditDecisionList): EditDecisionList => {
    return {
      ...edl,
      bRollSuggestions: edl.bRollSuggestions.map(br => ({
        ...br,
        status: 'approved' as const,
      })),
      zoomEffects: edl.zoomEffects.map(z => ({
        ...z,
        isEnabled: true,
      })),
    };
  }, []);

  // Fully autonomous: analyze → auto-approve → complete
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
      toast.info('AI is auto-editing your video...');
      
      updateWorkflow({ progress: 20 });

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

      updateWorkflow({ progress: 70 });

      const rawEdl = data.edl as EditDecisionList;
      
      // Auto-approve all AI decisions — no intermediate review
      const approvedEdl = autoApproveAll(rawEdl);

      // Auto-fetch stock footage for each approved B-roll suggestion
      updateWorkflow({ progress: 75 });
      toast.info('Fetching stock footage for B-roll...');

      const bRollWithFootage = await Promise.allSettled(
        approvedEdl.bRollSuggestions.map(async (br) => {
          if (!br.searchQuery) return { ...br, status: 'rejected' as const };
          try {
            const { data: searchData, error: searchError } = await supabase.functions.invoke('search-stock-footage', {
              body: { query: br.searchQuery, page: 1, perPage: 1, orientation: 'landscape' },
            });
            if (searchError || !searchData?.videos?.length) {
              return { ...br, status: 'rejected' as const };
            }
            const video = searchData.videos[0];
            return {
              ...br,
              stockFootageUrl: video.previewUrl || video.downloadUrl,
              status: 'ready' as const,
              reason: video.attribution ? `${br.reason} | ${video.attribution}` : br.reason,
            };
          } catch {
            return { ...br, status: 'rejected' as const };
          }
        })
      );

      const resolvedBRoll = bRollWithFootage.map(result =>
        result.status === 'fulfilled' ? result.value : { ...approvedEdl.bRollSuggestions[0], status: 'rejected' as const }
      ).filter(br => br.status === 'ready');

      updateWorkflow({ progress: 90 });

      // Finalize immediately
      const finalizedEdl: EditDecisionList = {
        ...approvedEdl,
        bRollSuggestions: resolvedBRoll,
        createdAt: new Date().toISOString(),
      };

      updateWorkflow({ 
        status: 'complete',
        progress: 100,
        edl: finalizedEdl,
        reviewStep: 'complete',
        hasUnapprovedChanges: false,
      });

      const reduction = ((finalizedEdl.originalDuration - finalizedEdl.editedDuration) / finalizedEdl.originalDuration * 100).toFixed(0);
      toast.success(`Auto-edit complete! Reduced by ${reduction}%. Review the summary below.`);
      
      return finalizedEdl;

    } catch (error) {
      console.error('Auto-edit analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Auto-edit failed';
      
      updateWorkflow({ 
        status: 'error', 
        errorMessage,
        progress: 0,
      });
      
      toast.error(`Auto-edit failed: ${errorMessage}`);
      throw error;
    }
  }, [projectId, updateWorkflow, autoApproveAll]);

  // Enter review mode to adjust AI decisions after auto-edit
  const enterReviewMode = useCallback(() => {
    updateWorkflow({ 
      status: 'reviewing',
      reviewStep: 'cuts',
      hasUnapprovedChanges: false,
    });
  }, [updateWorkflow]);

  // Toggle segment inclusion
  const toggleSegmentInclusion = useCallback((segmentId: string) => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;
      
      const updatedSegments = prev.edl.aRollSegments.map(seg => 
        seg.id === segmentId ? { ...seg, isIncluded: !seg.isIncluded } : seg
      );
      
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
              ? { ...br, stockFootageUrl, status: 'ready' as const, reason: attribution ? `${br.reason} | ${attribution}` : br.reason }
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
      return { ...prev, reviewStep: nextStep, progress: prev.progress + 10 };
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
  const applyEdits = useCallback(async (): Promise<EditDecisionList | null> => {
    if (!workflow.edl) return null;
    
    updateWorkflow({ status: 'applying', progress: 80 });
    
    const includedSegments = workflow.edl.aRollSegments.filter(s => s.isIncluded);
    if (includedSegments.length === 0) {
      toast.error('No segments included in edit');
      updateWorkflow({ status: 'reviewing', progress: 50 });
      return null;
    }

    const finalizedEdl: EditDecisionList = {
      ...workflow.edl,
      createdAt: new Date().toISOString(),
    };
    
    updateWorkflow({ 
      status: 'complete', 
      progress: 100,
      reviewStep: 'complete',
      hasUnapprovedChanges: false,
      edl: finalizedEdl,
    });
    
    toast.success('Edits finalized! Ready for export.');
    return finalizedEdl;
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
    const approvedBRoll = workflow.edl.bRollSuggestions.filter(b => b.status === 'approved' || b.status === 'ready');
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
      editingNotes: workflow.edl.editingNotes,
    };
  }, [workflow.edl]);

  return {
    workflow,
    analyzeAndGenerateEDL,
    enterReviewMode,
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
