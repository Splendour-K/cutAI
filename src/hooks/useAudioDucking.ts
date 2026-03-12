import { useEffect, useRef, useCallback } from 'react';
import type { BRollSuggestion } from '@/types/autoEditor';

export interface AudioDuckingConfig {
  videoRef: React.RefObject<HTMLVideoElement>;
  activeBRoll: BRollSuggestion | null;
  isPreviewEnabled: boolean;
  /** Target volume when B-roll is active (0-1), default 0.15 */
  duckedVolume?: number;
  /** Fade duration in ms, default 300 */
  fadeDuration?: number;
}

/**
 * Hook that handles audio ducking - fading main video volume
 * when B-roll clips are active and restoring when they end.
 */
export function useAudioDucking({
  videoRef,
  activeBRoll,
  isPreviewEnabled,
  duckedVolume = 1.0,
  fadeDuration = 300,
}: AudioDuckingConfig) {
  const animationRef = useRef<number | null>(null);
  const targetVolumeRef = useRef<number>(1);
  const originalVolumeRef = useRef<number>(1);

  // Smoothly animate volume to target
  const animateVolume = useCallback((targetVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    targetVolumeRef.current = targetVolume;
    const startVolume = video.volume;
    const volumeDiff = targetVolume - startVolume;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / fadeDuration, 1);
      
      // Ease-out curve for smooth fade
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const newVolume = startVolume + (volumeDiff * easeOut);
      
      if (video) {
        video.volume = Math.max(0, Math.min(1, newVolume));
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [videoRef, fadeDuration]);

  // Handle B-roll activation/deactivation
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPreviewEnabled) {
      // Reset volume when preview is disabled
      if (video && video.volume !== 1) {
        animateVolume(1);
      }
      return;
    }

    // Store original volume on first render
    if (originalVolumeRef.current === 1 && video.volume !== 1) {
      originalVolumeRef.current = video.volume;
    }

    if (activeBRoll && activeBRoll.stockFootageUrl) {
      // B-roll is active with actual footage - duck the audio
      animateVolume(duckedVolume);
    } else {
      // No B-roll or just placeholder - restore volume
      animateVolume(1);
    }
  }, [activeBRoll, isPreviewEnabled, duckedVolume, animateVolume, videoRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Restore volume on unmount
      const video = videoRef.current;
      if (video) {
        video.volume = 1;
      }
    };
  }, [videoRef]);

  // Manual volume control
  const setDuckedVolume = useCallback((volume: number) => {
    animateVolume(volume);
  }, [animateVolume]);

  const restoreVolume = useCallback(() => {
    animateVolume(1);
  }, [animateVolume]);

  return {
    setDuckedVolume,
    restoreVolume,
    isDucked: activeBRoll !== null && activeBRoll.stockFootageUrl !== undefined,
  };
}
