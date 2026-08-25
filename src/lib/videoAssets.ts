import { getLocalVideo, saveVideoLocally } from '@/lib/localVideoStore';

/**
 * Cloud storage is the permanent source of truth for customer videos.
 * The browser's IndexedDB cache is only a performance layer.
 */

export interface ResolvedVideoSource {
  /** Playable URL for the <video> element: local blob (fast) or cloud URL. */
  videoUrl: string;
  /** Permanent cloud URL when the asset exists in cloud storage. */
  cloudVideoUrl?: string;
  /** Local File when a cached copy exists (used for fast analysis). */
  file?: File;
  source: 'local-cache' | 'cloud';
}

/**
 * Resolve a project's video for editing.
 * 1. Use the local cached copy if present (performance).
 * 2. Otherwise fall back to the cloud URL (streams directly, no full download).
 * 3. Return null only when neither exists — a genuinely missing asset.
 */
export async function resolveProjectVideo(
  projectId: string,
  cloudUrl: string | null | undefined
): Promise<ResolvedVideoSource | null> {
  const local = await getLocalVideo(projectId).catch(() => null);
  if (local) {
    return {
      videoUrl: URL.createObjectURL(local),
      file: local,
      cloudVideoUrl: cloudUrl ?? undefined,
      source: 'local-cache',
    };
  }

  if (cloudUrl) {
    // Verify the cloud object actually exists before reporting success.
    try {
      const head = await fetch(cloudUrl, { method: 'HEAD' });
      if (!head.ok) {
        console.error(`Cloud video missing for project ${projectId} (HTTP ${head.status})`);
        return null;
      }
    } catch (err) {
      // Network error — still return the URL and let the player retry/stream.
      console.warn('Could not verify cloud video, attempting playback anyway:', err);
    }

    // Warm the local cache in the background for smoother future sessions.
    cacheFromCloud(projectId, cloudUrl);

    return { videoUrl: cloudUrl, cloudVideoUrl: cloudUrl, source: 'cloud' };
  }

  return null;
}

/** Download a cloud video into the local cache (best-effort, non-blocking). */
async function cacheFromCloud(projectId: string, cloudUrl: string): Promise<void> {
  try {
    const res = await fetch(cloudUrl);
    if (!res.ok) return;
    const blob = await res.blob();
    const file = new File([blob], 'cached-video', { type: blob.type || 'video/mp4' });
    await saveVideoLocally(projectId, file);
  } catch {
    // Caching is a performance optimization — failures are fine.
  }
}

/** Probe duration/dimensions of a video file without uploading anything. */
export function probeVideoMetadata(
  file: File
): Promise<{ duration?: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const done = (result: { duration?: number; width?: number; height?: number }) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    video.onloadedmetadata = () => {
      done({
        duration: Number.isFinite(video.duration) ? video.duration : undefined,
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
      });
    };
    video.onerror = () => done({});
    video.src = url;
  });
}
