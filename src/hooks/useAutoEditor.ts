import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { analyzeAutoEdit } from '@/lib/broll/localAnalyzer';
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
      }).catch((e) => ({ error: e, data: undefined } as any));

      let rawEdl: EditDecisionList;

      if (!error && data && !data.error) {
        rawEdl = data.edl as EditDecisionList;
      } else {
        // Fallback to local analyzer (suggestions-only). This is used when the server function is not available
        toast.info('Using local analyzer for auto-edit suggestions');
        rawEdl = await analyzeAutoEdit(transcript, videoDuration, {
          projectId,
          targetStyle: options?.targetStyle,
          targetDurationReduction: options?.targetDurationReduction,
          platform: options?.platform,
          preferences: options?.preferences,
        } as any);
      }

      updateWorkflow({ progress: 70 });
      
      // Auto-approve all AI decisions — no intermediate review
      const approvedEdl = autoApproveAll(rawEdl);

      // Auto-fetch stock footage for each approved B-roll suggestion
      updateWorkflow({ progress: 75 });
      toast.info('Fetching stock footage for B-roll...');

      const bRollWithFootage = await Promise.allSettled(
        approvedEdl.bRollSuggestions.map(async (br) => {
          if (!br.searchQuery) return { ...br, status: 'rejected' as const };
          try {
            // First try server-side search (Supabase function)
            const invokeResult = await supabase.functions.invoke('search-stock-footage', {
              body: { query: br.searchQuery, page: 1, perPage: 1, orientation: 'landscape' },
            }).catch(() => ({ data: null, error: true }));

            if (invokeResult && invokeResult.data && invokeResult.data.videos && invokeResult.data.videos.length > 0) {
              const video = invokeResult.data.videos[0];
              return {
                ...br,
                stockFootageUrl: video.previewUrl || video.downloadUrl,
                status: 'ready' as const,
                reason: video.attribution ? `${br.reason} | ${video.attribution}` : br.reason,
              };
            }

            // Fallback to client-side Pexels search with style re-ranking and histogram upload
            try {
              const { searchPexelsVideos } = await import('@/lib/broll/pexels');
              const { computeImageHistogram, computeVideoStyle, histogramSimilarity } = await import('@/lib/broll/style');
              const results = await searchPexelsVideos(br.searchQuery, 4);
              if (results && results.length > 0) {
                // Upload thumbnail histograms for the top results to the server cache (best-effort)
                for (const r of results.slice(0, 4)) {
                  try {
                    const thumb = (r as any).thumbnailUrl || (r as any).previewUrl;
                    if (!thumb) continue;
                    const imgHist = await computeImageHistogram(thumb);
                    // upload to server so it can re-rank later
                    try {
                      await supabase.functions.invoke('search-stock-footage', {
                        body: { action: 'upload_hist', id: `pexels_${r.id}`, histogram: imgHist },
                      }).catch(() => null);
                    } catch (e) {
                      // ignore upload errors
                    }
                  } catch (e) {
                    // ignore individual thumbnail failures
                  }
                }

                // if we have a source style profile in options, try to re-rank by style
                const sourceStyle = (options as any)?.styleProfile as any;
                if (sourceStyle && sourceStyle.histogram) {
                  // compute hist for each candidate thumbnail and pick best similarity
                  const scored = await Promise.all(results.map(async (v) => {
                    try {
                      const thumb = (v as any).thumbnailUrl || v.previewUrl;
                      const imgHist = await computeImageHistogram(thumb);
                      const sim = histogramSimilarity(sourceStyle.histogram, imgHist);
                      return { v, score: sim };
                    } catch (e) {
                      return { v, score: 0 };
                    }
                  }));
                  scored.sort((a,b) => b.score - a.score);
                  const best = scored[0];
                  if (best && best.v) {
                    return {
                      ...br,
                      stockFootageUrl: best.v.previewUrl || best.v.downloadUrl,
                      status: 'ready' as const,
                      reason: best.v.attribution ? `${br.reason} | ${best.v.attribution}` : br.reason,
                    };
                  }
                }

                const video = results[0];
                return {
                  ...br,
                  stockFootageUrl: video.previewUrl || video.downloadUrl,
                  status: 'ready' as const,
                  reason: video.attribution ? `${br.reason} | ${video.attribution}` : br.reason,
                };
              }
            } catch (pexErr) {
              // ignore and fall through to rejected
              console.warn('Pexels search failed for query', br.searchQuery, pexErr);
            }

            return { ...br, status: 'rejected' as const };
          } catch (e) {
            console.error('Stock search error', e);
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

  // Create a baseline EDL from transcript segments (for chat actions before auto-editor runs)
  const createEDLFromSegments = useCallback((
    segments: TranscriptSegment[],
    videoDuration: number
  ): EditDecisionList => {
    const aRollSegments: ARollSegment[] = segments.map((seg, i) => ({
      id: `seg-${i}`,
      originalStartTime: seg.startTime,
      originalEndTime: seg.endTime,
      newStartTime: seg.startTime,
      newEndTime: seg.endTime,
      duration: seg.endTime - seg.startTime,
      content: seg.text,
      isIncluded: true,
      cutType: 'hard' as const,
    }));

    const edl: EditDecisionList = {
      projectId,
      createdAt: new Date().toISOString(),
      originalDuration: videoDuration,
      editedDuration: videoDuration,
      aRollSegments,
      removedSections: [],
      bRollSuggestions: [],
      zoomEffects: [],
      pacing: {
        averageSegmentDuration: videoDuration / Math.max(segments.length, 1),
        suggestedCutFrequency: 0,
        energyLevel: 'medium',
        rhythmPattern: 'natural',
        hooks: [],
        slowSections: [],
      },
      style: 'vlog',
      editingNotes: ['Baseline EDL created from transcript for chat editing'],
    };

    setWorkflow(prev => ({
      ...prev,
      status: 'complete',
      progress: 100,
      edl,
      reviewStep: 'complete',
      hasUnapprovedChanges: false,
    }));

    return edl;
  }, [projectId]);

  // Exclude a time range from the EDL (marks overlapping segments as excluded)
  const excludeTimeRange = useCallback((startTime: number, endTime: number) => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;

      const updatedSegments = prev.edl.aRollSegments.map(seg => {
        const overlaps = seg.originalStartTime < endTime && seg.originalEndTime > startTime;
        if (overlaps) {
          return { ...seg, isIncluded: false, reason: `Excluded ${startTime.toFixed(1)}s–${endTime.toFixed(1)}s` };
        }
        return seg;
      });

      // Recalculate edited duration
      let currentTime = 0;
      const repositioned = updatedSegments.map(seg => {
        if (seg.isIncluded) {
          const newSeg = { ...seg, newStartTime: currentTime, newEndTime: currentTime + seg.duration };
          currentTime += seg.duration + (seg.transitionDuration || 0);
          return newSeg;
        }
        return seg;
      });

      const editedDuration = repositioned.filter(s => s.isIncluded).reduce((t, s) => t + s.duration, 0);

      return {
        ...prev,
        edl: {
          ...prev.edl,
          aRollSegments: repositioned,
          editedDuration,
          removedSections: [
            ...prev.edl.removedSections,
            { startTime, endTime, reason: 'chat-requested cut' },
          ],
        },
        hasUnapprovedChanges: true,
      };
    });
  }, []);

  // Add a zoom effect to the EDL
  const addZoomEffect = useCallback((
    startTime: number,
    endTime: number,
    zoomType: ZoomEffect['type'] = 'slow-zoom-in',
    focalPoint?: { x: number; y: number }
  ) => {
    setWorkflow(prev => {
      if (!prev.edl) return prev;

      // Find matching segment
      const segmentId = prev.edl.aRollSegments.find(
        s => s.originalStartTime <= startTime && s.originalEndTime >= endTime
      )?.id || prev.edl.aRollSegments[0]?.id || 'unknown';

      const presets: Record<string, { startScale: number; endScale: number; easing: ZoomEffect['easing'] }> = {
        'slow-zoom-in': { startScale: 1.0, endScale: 1.15, easing: 'ease-in-out' },
        'slow-zoom-out': { startScale: 1.15, endScale: 1.0, easing: 'ease-in-out' },
        'quick-punch': { startScale: 1.0, endScale: 1.3, easing: 'ease-out' },
        'ken-burns': { startScale: 1.0, endScale: 1.2, easing: 'linear' },
        'focus-shift': { startScale: 1.0, endScale: 1.1, easing: 'ease-in-out' },
      };

      const preset = presets[zoomType] || presets['slow-zoom-in'];

      const newZoom: ZoomEffect = {
        id: `zoom-chat-${Date.now()}`,
        segmentId,
        startTime,
        endTime,
        duration: endTime - startTime,
        type: zoomType,
        startScale: preset.startScale,
        endScale: preset.endScale,
        focalPoint: focalPoint || { x: 50, y: 50 },
        reason: 'Added via chat',
        isEnabled: true,
        easing: preset.easing,
      };

      return {
        ...prev,
        edl: {
          ...prev.edl,
          zoomEffects: [...prev.edl.zoomEffects, newZoom],
        },
        hasUnapprovedChanges: true,
      };
    });
  }, []);

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
    createEDLFromSegments,
    excludeTimeRange,
    addZoomEffect,
  };
}
