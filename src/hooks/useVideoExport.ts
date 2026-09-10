import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EditDecisionList, BRollSuggestion } from '@/types/autoEditor';
import type { CaptionSettings } from '@/types/video';
import type { TranscriptSegment } from '@/hooks/useVideoAnalysis';

export interface RenderProgress {
  stage: 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface PersistedExport {
  publicUrl: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
}

export type ExportResolution = 'source' | '2160p' | '1440p' | '1080p' | '720p' | '480p';

/** User-facing render settings from the export dialog. */
export interface ExportSettings {
  resolution: ExportResolution;
  /** Video bitrate in bits per second. */
  videoBitrate: number;
  /** Audio bitrate in bits per second. */
  audioBitrate: number;
  fps?: number;
}

export interface RenderContext {
  projectId?: string;
  settings: ExportSettings;
  /** Playback speed baked into the render (1 = normal). */
  playbackRate?: number;
  captions?: {
    settings: CaptionSettings;
    segments: TranscriptSegment[] | null;
    editedCaptions?: Record<number, string>;
  };
}

export const RESOLUTION_HEIGHTS: Record<Exclude<ExportResolution, 'source'>, number> = {
  '2160p': 2160,
  '1440p': 1440,
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  resolution: '1080p',
  videoBitrate: 8_000_000,
  audioBitrate: 128_000,
  fps: 30,
};

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

  /**
   * Render the full edited video: included A-roll segments in order, zooms,
   * B-roll overlays, burned-in captions, playback speed and audio ducking.
   */
  const renderVideoWithEffects = useCallback(async (
    edl: EditDecisionList,
    sourceVideoUrl: string,
    context: RenderContext
  ): Promise<Blob | null> => {
    const settings = context.settings ?? DEFAULT_EXPORT_SETTINGS;
    const fps = settings.fps ?? 30;
    const speed = Math.max(0.25, Math.min(4, context.playbackRate ?? 1));

    setIsExporting(true);
    setRenderProgress({ stage: 'preparing', progress: 0, message: 'Preparing video & audio...' });

    let audioCtx: AudioContext | null = null;
    const bRollEls: HTMLVideoElement[] = [];

    try {
      const video = document.createElement('video');
      video.src = sourceVideoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = false;
      video.volume = 1;
      video.playbackRate = speed;
      videoRef.current = video;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Could not open the source video'));
      });

      // Web Audio graph (ducking + crossfades)
      audioCtx = new AudioContext();
      const sourceNode = audioCtx.createMediaElementSource(video);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.0;
      const audioDest = audioCtx.createMediaStreamDestination();
      sourceNode.connect(gainNode);
      gainNode.connect(audioDest);
      gainNode.connect(audioCtx.destination);

      // Output canvas sized from the chosen resolution
      const canvas = document.createElement('canvas');
      const srcW = video.videoWidth || 1280;
      const srcH = video.videoHeight || 720;
      const targetH = settings.resolution === 'source'
        ? srcH
        : Math.min(srcH * 2, RESOLUTION_HEIGHTS[settings.resolution]);
      const scale = targetH / srcH;
      canvas.width = Math.max(2, Math.round((srcW * scale) / 2) * 2);
      canvas.height = Math.max(2, Math.round(targetH / 2) * 2);
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d')!;

      const segments = edl.aRollSegments
        .filter(s => s.isIncluded)
        .sort((a, b) => a.newStartTime - b.newStartTime);

      if (segments.length === 0) {
        throw new Error('There are no clips left to render');
      }

      const zooms = edl.zoomEffects.filter(z => z.isEnabled);
      const approvedBRoll = edl.bRollSuggestions.filter(
        b => (b.status === 'approved' || b.status === 'ready') && b.stockFootageUrl
      );

      // Preload B-roll clips so they can be composited during the render
      setRenderProgress({ stage: 'preparing', progress: 5, message: 'Loading stock footage...' });
      const bRollMap = new Map<string, HTMLVideoElement>();
      await Promise.all(approvedBRoll.map(async (b) => {
        try {
          const el = document.createElement('video');
          el.src = b.stockFootageUrl!;
          el.crossOrigin = 'anonymous';
          el.muted = true;
          el.playbackRate = speed;
          await new Promise<void>((resolve, reject) => {
            el.onloadeddata = () => resolve();
            el.onerror = () => reject(new Error('broll load failed'));
            setTimeout(() => reject(new Error('broll timeout')), 12000);
          });
          bRollEls.push(el);
          bRollMap.set(b.id, el);
        } catch {
          // A missing stock clip must not fail the whole export
        }
      }));

      const videoStream = canvas.captureStream(fps);
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ]);

      const mimeType = pickMimeType();
      const mediaRecorder = new MediaRecorder(combinedStream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: settings.videoBitrate,
        audioBitsPerSecond: settings.audioBitrate,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const renderComplete = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType?.split(';')[0] || 'video/webm' }));
        };
      });

      mediaRecorder.start(200);
      setRenderProgress({ stage: 'rendering', progress: 10, message: 'Rendering your edit...' });

      const totalSourceDuration = segments.reduce((sum, s) => sum + s.duration, 0) || 1;
      let renderedSourceSeconds = 0;

      for (let segIndex = 0; segIndex < segments.length; segIndex++) {
        const segment = segments[segIndex];

        video.currentTime = segment.originalStartTime;
        await waitForSeek(video);

        scheduleDuckingForSegment(gainNode, audioCtx, segment, approvedBRoll, speed);

        const isFirstSegment = segIndex === 0;
        const isLastSegment = segIndex === segments.length - 1;
        const segNow = audioCtx.currentTime;
        const wallDuration = segment.duration / speed;

        if (!isFirstSegment) {
          gainNode.gain.setValueAtTime(0.01, segNow);
          gainNode.gain.exponentialRampToValueAtTime(1.0, segNow + CROSSFADE_SECONDS);
        }
        if (!isLastSegment && wallDuration > CROSSFADE_SECONDS) {
          const fadeOutTime = segNow + wallDuration - CROSSFADE_SECONDS;
          gainNode.gain.setValueAtTime(1.0, fadeOutTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, fadeOutTime + CROSSFADE_SECONDS);
        }

        await video.play();

        const startWallTime = performance.now();
        const frameDuration = 1000 / fps;
        let lastFrameTime = 0;
        const playingBRoll = new Set<string>();

        await new Promise<void>((resolve) => {
          const renderFrame = () => {
            const wallElapsed = (performance.now() - startWallTime) / 1000;
            const sourceElapsed = wallElapsed * speed;
            const currentVideoTime = segment.originalStartTime + sourceElapsed;

            if (wallElapsed >= wallDuration) {
              video.pause();
              for (const id of playingBRoll) bRollMap.get(id)?.pause();
              gainNode.gain.cancelScheduledValues(audioCtx!.currentTime);
              gainNode.gain.setValueAtTime(1.0, audioCtx!.currentTime);
              renderedSourceSeconds += segment.duration;
              resolve();
              return;
            }

            const now = performance.now();
            if (now - lastFrameTime >= frameDuration) {
              lastFrameTime = now;
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              const activeZoom = zooms.find(z =>
                currentVideoTime >= z.startTime && currentVideoTime <= z.endTime
              );

              if (activeZoom) {
                const progress = activeZoom.duration > 0
                  ? (currentVideoTime - activeZoom.startTime) / activeZoom.duration
                  : 1;
                const eased = applyEasing(progress, activeZoom.easing);
                const zoomScale = activeZoom.startScale + (activeZoom.endScale - activeZoom.startScale) * eased;
                const centerX = (activeZoom.focalPoint.x / 100) * canvas.width;
                const centerY = (activeZoom.focalPoint.y / 100) * canvas.height;

                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.scale(zoomScale, zoomScale);
                ctx.translate(-centerX, -centerY);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ctx.restore();
              } else {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              }

              // Composite active B-roll on top of the A-roll frame
              const activeBRoll = approvedBRoll.find(b =>
                currentVideoTime >= b.timestamp && currentVideoTime <= b.timestamp + b.duration
              );
              if (activeBRoll) {
                const el = bRollMap.get(activeBRoll.id);
                if (el) {
                  if (!playingBRoll.has(activeBRoll.id)) {
                    playingBRoll.add(activeBRoll.id);
                    el.currentTime = 0;
                    el.play().catch(() => undefined);
                  }
                  drawBRollFrame(ctx, canvas, el, activeBRoll);
                }
              } else if (playingBRoll.size) {
                for (const id of playingBRoll) bRollMap.get(id)?.pause();
                playingBRoll.clear();
              }

              // Burn in captions
              if (context.captions?.settings?.enabled) {
                drawCaption(ctx, canvas, currentVideoTime, context.captions);
              }
            }

            requestAnimationFrame(renderFrame);
          };

          requestAnimationFrame(renderFrame);
        });

        setRenderProgress({
          stage: 'rendering',
          progress: 10 + Math.round((renderedSourceSeconds / totalSourceDuration) * 82),
          message: `Rendering clip ${segIndex + 1} of ${segments.length}...`,
        });

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setRenderProgress({ stage: 'encoding', progress: 94, message: 'Finalizing audio & video...' });

      mediaRecorder.stop();
      const blob = await renderComplete;

      if (!blob.size) throw new Error('The render produced an empty file');

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
      for (const el of bRollEls) {
        el.pause();
        el.src = '';
      }
      if (audioCtx && audioCtx.state !== 'closed') await audioCtx.close();
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
  ): Promise<PersistedExport | null> => {
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
        .upload(storagePath, blob, { cacheControl: '3600', upsert: false, contentType: blob.type || 'video/webm' });

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

      return {
        publicUrl,
        storagePath,
        filename,
        mimeType: blob.type || 'video/webm',
        fileSizeBytes: blob.size,
      };
    } catch (err) {
      console.error('Export persistence failed:', err);
      return null;
    }
  }, []);

  // Download rendered video (and save a permanent, shareable copy to the cloud)
  const downloadRenderedVideo = useCallback(async (
    edl: EditDecisionList,
    sourceVideoUrl: string,
    filename: string = 'edited-video.webm',
    context: RenderContext
  ): Promise<PersistedExport | null> => {
    const blob = await renderVideoWithEffects(edl, sourceVideoUrl, context);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Video exported successfully!');

    const projectId = context.projectId || edl.projectId;
    if (!projectId) return null;

    setRenderProgress({ stage: 'encoding', progress: 97, message: 'Uploading to the cloud...' });
    const persisted = await persistExport(projectId, blob, filename);
    setRenderProgress({
      stage: 'complete',
      progress: 100,
      message: persisted ? 'Export saved & shareable link ready' : 'Export complete!',
    });
    return persisted;
  }, [renderVideoWithEffects, persistExport]);

  return {
    isExporting,
    renderProgress,
    exportAsEDL,
    renderVideoWithEffects,
    downloadRenderedVideo,
    persistExport,
  };
}

// --- Helper functions ---

function pickMimeType(): string | undefined {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  if (typeof MediaRecorder === 'undefined') return undefined;
  return candidates.find(t => MediaRecorder.isTypeSupported(t));
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener('seeked', handler);
      resolve();
    };
    video.addEventListener('seeked', handler);
  });
}

/** Draw a B-roll frame, either full-frame or as an inset overlay. */
function drawBRollFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  el: HTMLVideoElement,
  broll: BRollSuggestion
) {
  const inset = broll.type === 'overlay' || broll.type === 'split-screen';
  if (!inset) {
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    return;
  }
  const w = canvas.width * 0.42;
  const h = w * ((el.videoHeight || 9) / (el.videoWidth || 16));
  const x = canvas.width - w - canvas.width * 0.04;
  const y = canvas.height * 0.04;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = canvas.width * 0.01;
  ctx.drawImage(el, x, y, w, h);
  ctx.restore();
}

/** Burn the active caption into the frame using the project's caption settings. */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  time: number,
  captions: NonNullable<RenderContext['captions']>
) {
  const { segments, settings, editedCaptions = {} } = captions;
  if (!segments?.length) return;

  const index = segments.findIndex(s => time >= s.startTime && time <= s.endTime);
  if (index === -1) return;
  const text = (editedCaptions[index] ?? segments[index].text ?? '').trim();
  if (!text) return;

  const sizeFactor = settings.fontSize === 'small' ? 0.035
    : settings.fontSize === 'large' ? 0.06
    : settings.fontSize === 'xlarge' ? 0.075
    : 0.048;
  const fontSize = Math.round(canvas.height * sizeFactor);
  const bold = settings.style === 'bold' || settings.style === 'hormozi';
  ctx.font = `${bold ? '800' : '600'} ${fontSize}px ${settings.fontFamily || 'Inter'}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxWidth = canvas.width * 0.86;
  const lines = wrapText(ctx, text.toUpperCase() === text && bold ? text : text, maxWidth);
  const lineHeight = fontSize * 1.25;
  const blockHeight = lines.length * lineHeight;

  let centerY: number;
  if (settings.customPosition) {
    centerY = (settings.customPosition.y / 100) * canvas.height;
  } else if (settings.position === 'top') {
    centerY = canvas.height * 0.12 + blockHeight / 2;
  } else if (settings.position === 'center') {
    centerY = canvas.height / 2;
  } else {
    centerY = canvas.height * 0.86 - blockHeight / 2;
  }
  const centerX = settings.customPosition
    ? (settings.customPosition.x / 100) * canvas.width
    : canvas.width / 2;

  const padX = fontSize * 0.6;
  const padY = fontSize * 0.35;
  const widest = Math.max(...lines.map(l => ctx.measureText(l).width));

  if (settings.backgroundColor && settings.backgroundColor !== 'transparent') {
    ctx.fillStyle = settings.backgroundColor;
    const boxW = widest + padX * 2;
    const boxH = blockHeight + padY * 2;
    const r = fontSize * 0.3;
    roundRect(ctx, centerX - boxW / 2, centerY - boxH / 2, boxW, boxH, r);
    ctx.fill();
  } else if (settings.style === 'modern' || settings.style === 'subtitle') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const boxW = widest + padX * 2;
    const boxH = blockHeight + padY * 2;
    roundRect(ctx, centerX - boxW / 2, centerY - boxH / 2, boxW, boxH, fontSize * 0.3);
    ctx.fill();
  }

  const strokeWidth = settings.strokeWidth ?? (settings.style === 'minimal' || bold ? 4 : 0);
  lines.forEach((line, i) => {
    const y = centerY - blockHeight / 2 + lineHeight * (i + 0.5);
    if (strokeWidth > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = strokeWidth * (fontSize / 40) * 2;
      ctx.strokeStyle = settings.strokeColor || '#000000';
      ctx.strokeText(line, centerX, y);
    }
    ctx.fillStyle = settings.textColor || settings.brandColor || '#FFFFFF';
    ctx.fillText(line, centerX, y);
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
  speed: number
) {
  const now = audioCtx.currentTime;

  for (const broll of bRollItems) {
    const brollStart = broll.timestamp;
    const brollEnd = broll.timestamp + broll.duration;

    if (brollEnd <= segment.originalStartTime || brollStart >= segment.originalEndTime) {
      continue;
    }

    const duckStartOffset = Math.max(0, brollStart - segment.originalStartTime) / speed;
    const duckEndOffset = Math.min(
      segment.originalEndTime - segment.originalStartTime,
      brollEnd - segment.originalStartTime
    ) / speed;

    const fadeDownTime = now + duckStartOffset;
    gainNode.gain.setValueAtTime(1.0, fadeDownTime);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(DUCK_VOLUME, 0.01),
      fadeDownTime + DUCK_FADE_SECONDS
    );

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
