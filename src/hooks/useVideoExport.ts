import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EditDecisionList } from '@/types/autoEditor';

export interface RenderProgress {
  stage: 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error';
  progress: number;
  message: string;
}

interface ExportOptions {
  format: 'edl' | 'json' | 'premiere' | 'fcpxml' | 'video';
  quality: 'draft' | 'standard' | 'high';
}

export function useVideoExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Export as EDL file format for professional editing software
  const exportAsEDL = useCallback(async (
    edl: EditDecisionList,
    format: 'edl' | 'json' | 'premiere' | 'fcpxml',
    videoUrl?: string
  ) => {
    setIsExporting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('export-video', {
        body: {
          projectId: edl.projectId,
          edl,
          format,
          videoUrl,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Create and download the file
      const blob = new Blob([data.content], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported as ${format.toUpperCase()}`);
      return data;
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Render video with effects using Canvas API (client-side)
  const renderVideoWithEffects = useCallback(async (
    edl: EditDecisionList,
    sourceVideoUrl: string,
    options: { quality: 'draft' | 'standard' | 'high' } = { quality: 'standard' }
  ): Promise<Blob | null> => {
    setIsExporting(true);
    setRenderProgress({ stage: 'preparing', progress: 0, message: 'Preparing video...' });

    try {
      // Create video element for source
      const video = document.createElement('video');
      video.src = sourceVideoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      videoRef.current = video;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
      });

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      const qualityMultiplier = options.quality === 'high' ? 1 : options.quality === 'standard' ? 0.75 : 0.5;
      canvas.width = video.videoWidth * qualityMultiplier;
      canvas.height = video.videoHeight * qualityMultiplier;
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d')!;

      // Get included segments
      const segments = edl.aRollSegments
        .filter(s => s.isIncluded)
        .sort((a, b) => a.newStartTime - b.newStartTime);

      // Get enabled zooms
      const zooms = edl.zoomEffects.filter(z => z.isEnabled);

      // Set up MediaRecorder
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: options.quality === 'high' ? 8000000 : options.quality === 'standard' ? 4000000 : 2000000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const renderComplete = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          resolve(blob);
        };
      });

      mediaRecorder.start();
      setRenderProgress({ stage: 'rendering', progress: 10, message: 'Rendering segments...' });

      // Process each segment
      for (let segIndex = 0; segIndex < segments.length; segIndex++) {
        const segment = segments[segIndex];
        const segmentProgress = ((segIndex + 1) / segments.length) * 80;
        
        setRenderProgress({
          stage: 'rendering',
          progress: 10 + segmentProgress,
          message: `Rendering segment ${segIndex + 1}/${segments.length}...`,
        });

        // Set video to segment start
        video.currentTime = segment.originalStartTime;
        await new Promise<void>(resolve => {
          video.onseeked = () => resolve();
        });

        // Render frames for this segment
        const fps = 30;
        const frameCount = Math.ceil(segment.duration * fps);
        
        for (let frame = 0; frame < frameCount; frame++) {
          const currentTime = segment.originalStartTime + (frame / fps);
          video.currentTime = currentTime;
          
          await new Promise(resolve => setTimeout(resolve, 1000 / fps / 2)); // Wait for frame

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Check for active zoom
          const activeZoom = zooms.find(z => 
            currentTime >= z.startTime && currentTime <= z.endTime
          );

          if (activeZoom) {
            // Apply zoom effect
            const progress = (currentTime - activeZoom.startTime) / activeZoom.duration;
            const easedProgress = applyEasing(progress, activeZoom.easing);
            const scale = activeZoom.startScale + (activeZoom.endScale - activeZoom.startScale) * easedProgress;
            
            const centerX = (activeZoom.focalPoint.x / 100) * canvas.width;
            const centerY = (activeZoom.focalPoint.y / 100) * canvas.height;
            
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(scale, scale);
            ctx.translate(-centerX, -centerY);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          } else {
            // Draw normal frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        }
      }

      setRenderProgress({ stage: 'encoding', progress: 95, message: 'Encoding video...' });
      
      mediaRecorder.stop();
      const blob = await renderComplete;

      setRenderProgress({ stage: 'complete', progress: 100, message: 'Export complete!' });
      
      return blob;
    } catch (error) {
      console.error('Render error:', error);
      setRenderProgress({ 
        stage: 'error', 
        progress: 0, 
        message: error instanceof Error ? error.message : 'Render failed' 
      });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Download rendered video
  const downloadRenderedVideo = useCallback(async (
    edl: EditDecisionList,
    sourceVideoUrl: string,
    filename: string = 'edited-video.webm',
    options?: { quality: 'draft' | 'standard' | 'high' }
  ) => {
    const blob = await renderVideoWithEffects(edl, sourceVideoUrl, options);
    
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Video exported successfully!');
    }
  }, [renderVideoWithEffects]);

  return {
    isExporting,
    renderProgress,
    exportAsEDL,
    renderVideoWithEffects,
    downloadRenderedVideo,
  };
}

// Easing function helper
function applyEasing(t: number, easing: string): number {
  const clampedT = Math.max(0, Math.min(1, t));
  
  switch (easing) {
    case 'ease-in':
      return clampedT * clampedT;
    case 'ease-out':
      return 1 - (1 - clampedT) * (1 - clampedT);
    case 'ease-in-out':
      return clampedT < 0.5 
        ? 2 * clampedT * clampedT 
        : 1 - Math.pow(-2 * clampedT + 2, 2) / 2;
    case 'linear':
    default:
      return clampedT;
  }
}
