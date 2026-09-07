import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EditDecisionList, BRollSuggestion } from '@/types/autoEditor';

export interface RenderProgress {
  stage: 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error';
  progress: number;
  message: string;
}

interface ExportOptions {
  format: 'edl' | 'json' | 'premiere' | 'fcpxml' | 'video';
  quality: 'draft' | 'standard' | 'high';
}

// Audio ducking config for export
const DUCK_VOLUME = 0.15;
const DUCK_FADE_SECONDS = 0.3;
// Crossfade duration at segment boundaries (seconds)
const CROSSFADE_SECONDS = 0.15;

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

  // Render video with effects AND audio using Canvas + Web Audio API
  const renderVideoWithEffects = useCallback(async (
    edl: EditDecisionList,
    sourceVideoUrl: string,
    options: { quality: 'draft' | 'standard' | 'high' } = { quality: 'standard' }
  ): Promise<Blob | null> => {
    setIsExporting(true);
    setRenderProgress({ stage: 'preparing', progress: 0, message: 'Preparing video & audio...' });

    try {
      // Create video element for source
      const video = document.createElement('video');
      video.src = sourceVideoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = false; // Keep audio enabled for capture
      video.volume = 1;
      videoRef.current = video;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
      });

      // Set up Web Audio context for audio processing
      const audioCtx = new AudioContext();
      const sourceNode = audioCtx.createMediaElementSource(video);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.0;
      const audioDest = audioCtx.createMediaStreamDestination();
      sourceNode.connect(gainNode);
      gainNode.connect(audioDest);
      // Also connect to speakers so video.play() works properly
      gainNode.connect(audioCtx.destination);

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

      // Get enabled zooms and approved B-roll
      const zooms = edl.zoomEffects.filter(z => z.isEnabled);
      const approvedBRoll = edl.bRollSuggestions.filter(
        b => (b.status === 'approved' || b.status === 'ready') && b.stockFootageUrl
      );

      // Combine video canvas stream + audio stream
      const videoStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
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

      mediaRecorder.start(100); // Collect data every 100ms
      setRenderProgress({ stage: 'rendering', progress: 10, message: 'Rendering segments with audio...' });

      // Process each segment by playing the video in real-time sections
      for (let segIndex = 0; segIndex < segments.length; segIndex++) {
        const segment = segments[segIndex];
        const segmentProgress = ((segIndex + 1) / segments.length) * 80;

        setRenderProgress({
          stage: 'rendering',
          progress: 10 + segmentProgress * 0.5,
          message: `Rendering segment ${segIndex + 1}/${segments.length}...`,
        });

        // Seek to segment start
        video.currentTime = segment.originalStartTime;
        await waitForSeek(video);

        // Schedule audio ducking for B-roll overlaps within this segment
        scheduleDuckingForSegment(
          gainNode, audioCtx, segment, approvedBRoll,
          segment.originalStartTime
        );

        // Schedule crossfade: fade in at segment start, fade out at segment end
        const isFirstSegment = segIndex === 0;
        const isLastSegment = segIndex === segments.length - 1;
        const segNow = audioCtx.currentTime;

        if (!isFirstSegment) {
          // Fade in from silence to avoid pop at cut point
          gainNode.gain.setValueAtTime(0.01, segNow);
          gainNode.gain.exponentialRampToValueAtTime(1.0, segNow + CROSSFADE_SECONDS);
        }

        // Play segment in real-time to capture audio
        const segmentDuration = segment.duration;

        if (!isLastSegment && segmentDuration > CROSSFADE_SECONDS) {
          // Schedule fade out near end of segment
          const fadeOutTime = segNow + segmentDuration - CROSSFADE_SECONDS;
          gainNode.gain.setValueAtTime(1.0, fadeOutTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, fadeOutTime + CROSSFADE_SECONDS);
        }

        video.play();

        const startWallTime = performance.now();
        const fps = 30;
        const frameDuration = 1000 / fps;
        let lastFrameTime = 0;

        // Render loop: draw frames while audio plays naturally
        await new Promise<void>((resolve) => {
          const renderFrame = () => {
            const elapsed = (performance.now() - startWallTime) / 1000;
            const currentVideoTime = segment.originalStartTime + elapsed;

            if (elapsed >= segmentDuration) {
              video.pause();
              // Reset gain for next segment
              gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
              gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime);
              resolve();
              return;
            }

            const now = performance.now();
            if (now - lastFrameTime >= frameDuration) {
              lastFrameTime = now;

              ctx.clearRect(0, 0, canvas.width, canvas.height);

              // Check for active zoom
              const activeZoom = zooms.find(z =>
                currentVideoTime >= z.startTime && currentVideoTime <= z.endTime
              );

              if (activeZoom) {
                const progress = (currentVideoTime - activeZoom.startTime) / activeZoom.duration;
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
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              }

              // Draw B-roll overlay if active
              // (B-roll video elements would be composited here in a full implementation)
            }

            requestAnimationFrame(renderFrame);
          };

          requestAnimationFrame(renderFrame);
        });

        // Brief pause between segments for clean transitions
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setRenderProgress({ stage: 'encoding', progress: 95, message: 'Finalizing audio & video...' });

      mediaRecorder.stop();
      const blob = await renderComplete;

      // Clean up audio context
      await audioCtx.close();

      setRenderProgress({ stage: 'complete', progress: 100, message: 'Export complete!' });

      return blob;
    } catch (error) {
      console.error('Render error:', error);
      setRenderProgress({
        stage: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Render failed',
      });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Persist a finished export to cloud storage so it survives cache clears
   * and is available from any device.
   */
  const persistExport = useCallback(async (
    projectId: string,
    blob: Blob,
    filename: string
  ): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const exportId = crypto.randomUUID();
      const storagePath = `${user.id}/projects/${projectId}/exports/${exportId}/${filename}`;

      const { error: assetError } = await supabase.from('video_assets').insert({
        id: exportId,
        project_id: projectId,
        user_id: user.id,
        kind: 'export',
        storage_bucket: 'videos',
        storage_path: storagePath,
        original_filename: filename,
        mime_type: blob.type || 'video/webm',
        file_size_bytes: blob.size,
        status: 'uploading',
      });
      if (assetError) console.error('Export asset record failed:', assetError);

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(storagePath, blob, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.error('Export upload failed:', uploadError);
        await supabase.from('video_assets')
          .update({ status: 'failed', error_message: uploadError.message })
          .eq('id', exportId);
        toast.error('Your export downloaded, but saving it to the cloud failed.');
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(storagePath);

      await supabase.from('video_assets')
        .update({ status: 'ready', public_url: publicUrl })
        .eq('id', exportId);

      return publicUrl;
    } catch (err) {
      console.error('Export persistence failed:', err);
      return null;
    }
  }, []);

  // Download rendered video (and save a permanent copy to the cloud)
  const downloadRenderedVideo = useCallback(async (
    edl: EditDecisionList,
    sourceVideoUrl: string,
    filename: string = 'edited-video.webm',
    options?: { quality: 'draft' | 'standard' | 'high'; projectId?: string }
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

      const projectId = options?.projectId || edl.projectId;
      if (projectId) {
        await persistExport(projectId, blob, filename);
      }
    }
  }, [renderVideoWithEffects, persistExport]);

  return {
    isExporting,
    renderProgress,
    exportAsEDL,
    renderVideoWithEffects,
    downloadRenderedVideo,
  };
}

// --- Helper functions ---

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener('seeked', handler);
      resolve();
    };
    video.addEventListener('seeked', handler);
  });
}

/**
 * Schedule Web Audio gain ramps for audio ducking when B-roll overlaps
 * a given A-roll segment. Uses smooth exponential ramps for natural fades.
 */
function scheduleDuckingForSegment(
  gainNode: GainNode,
  audioCtx: AudioContext,
  segment: { originalStartTime: number; originalEndTime: number },
  bRollItems: BRollSuggestion[],
  _segmentStartTime: number
) {
  const now = audioCtx.currentTime;

  for (const broll of bRollItems) {
    const brollStart = broll.timestamp;
    const brollEnd = broll.timestamp + broll.duration;

    // Check if this B-roll overlaps the current segment
    if (brollEnd <= segment.originalStartTime || brollStart >= segment.originalEndTime) {
      continue;
    }

    // Calculate when ducking should happen relative to current audio time
    const duckStartOffset = Math.max(0, brollStart - segment.originalStartTime);
    const duckEndOffset = Math.min(
      segment.originalEndTime - segment.originalStartTime,
      brollEnd - segment.originalStartTime
    );

    // Fade down at B-roll start
    const fadeDownTime = now + duckStartOffset;
    gainNode.gain.setValueAtTime(1.0, fadeDownTime);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(DUCK_VOLUME, 0.01),
      fadeDownTime + DUCK_FADE_SECONDS
    );

    // Fade back up at B-roll end
    const fadeUpTime = now + duckEndOffset;
    gainNode.gain.setValueAtTime(DUCK_VOLUME, fadeUpTime);
    gainNode.gain.exponentialRampToValueAtTime(1.0, fadeUpTime + DUCK_FADE_SECONDS);
  }
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
