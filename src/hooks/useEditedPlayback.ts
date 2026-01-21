import { useCallback, useEffect, useRef } from 'react';
import type { EditDecisionList, ARollSegment } from '@/types/autoEditor';

export interface EditedPlaybackConfig {
  edl: EditDecisionList | null;
  isPreviewEnabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onTimeUpdate?: (editedTime: number) => void;
}

/**
 * Hook that handles real-time playback of edited video based on EDL.
 * Automatically skips excluded sections and applies cut transitions.
 */
export function useEditedPlayback({
  edl,
  isPreviewEnabled,
  videoRef,
  onTimeUpdate,
}: EditedPlaybackConfig) {
  const lastValidTimeRef = useRef<number>(0);
  const isSeekingRef = useRef(false);

  // Get the included segments sorted by their new timeline position
  const getIncludedSegments = useCallback((): ARollSegment[] => {
    if (!edl) return [];
    return edl.aRollSegments
      .filter(s => s.isIncluded)
      .sort((a, b) => a.newStartTime - b.newStartTime);
  }, [edl]);

  // Convert original video time to edited timeline time
  const originalToEditedTime = useCallback((originalTime: number): number => {
    if (!edl || !isPreviewEnabled) return originalTime;

    const segments = getIncludedSegments();
    let editedTime = 0;

    for (const segment of segments) {
      if (originalTime >= segment.originalStartTime && originalTime <= segment.originalEndTime) {
        // Current time is within this segment
        const timeIntoSegment = originalTime - segment.originalStartTime;
        return editedTime + timeIntoSegment;
      } else if (originalTime > segment.originalEndTime) {
        // This segment is fully before current time
        editedTime += segment.duration;
      } else {
        // This segment is after current time
        break;
      }
    }

    return editedTime;
  }, [edl, isPreviewEnabled, getIncludedSegments]);

  // Convert edited timeline time to original video time
  const editedToOriginalTime = useCallback((editedTime: number): number => {
    if (!edl || !isPreviewEnabled) return editedTime;

    const segments = getIncludedSegments();
    let accumulatedEditedTime = 0;

    for (const segment of segments) {
      const segmentDuration = segment.duration;
      
      if (editedTime <= accumulatedEditedTime + segmentDuration) {
        // The edited time falls within this segment
        const timeIntoSegment = editedTime - accumulatedEditedTime;
        return segment.originalStartTime + timeIntoSegment;
      }
      
      accumulatedEditedTime += segmentDuration;
    }

    // If we're past all segments, return end of last segment
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      return lastSegment.originalEndTime;
    }

    return editedTime;
  }, [edl, isPreviewEnabled, getIncludedSegments]);

  // Check if current original time is in an excluded section
  const isInExcludedSection = useCallback((originalTime: number): boolean => {
    if (!edl) return false;
    
    return edl.removedSections.some(section => 
      originalTime >= section.startTime && originalTime < section.endTime
    );
  }, [edl]);

  // Find the next valid segment start time after the current time
  const findNextSegmentStart = useCallback((originalTime: number): number | null => {
    if (!edl) return null;
    
    const segments = getIncludedSegments();
    
    for (const segment of segments) {
      if (segment.originalStartTime > originalTime) {
        return segment.originalStartTime;
      }
    }
    
    return null;
  }, [edl, getIncludedSegments]);

  // Handle timeupdate to skip excluded sections
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !edl || !isPreviewEnabled) return;

    const handleTimeUpdate = () => {
      if (isSeekingRef.current) return;

      const currentOriginalTime = video.currentTime;

      // Check if we're in an excluded section
      if (isInExcludedSection(currentOriginalTime)) {
        const nextStart = findNextSegmentStart(currentOriginalTime);
        
        if (nextStart !== null) {
          // Skip to next included segment
          isSeekingRef.current = true;
          video.currentTime = nextStart;
          setTimeout(() => {
            isSeekingRef.current = false;
          }, 100);
        } else {
          // No more segments, pause at end
          video.pause();
        }
        return;
      }

      // Update the edited time for UI display
      const editedTime = originalToEditedTime(currentOriginalTime);
      lastValidTimeRef.current = editedTime;
      onTimeUpdate?.(editedTime);
    };

    const handleSeeked = () => {
      // Small delay to prevent rapid-fire seeks
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 50);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [edl, isPreviewEnabled, isInExcludedSection, findNextSegmentStart, originalToEditedTime, onTimeUpdate, videoRef]);

  // Seek to edited time (converts to original time and seeks video)
  const seekToEditedTime = useCallback((editedTime: number) => {
    const video = videoRef.current;
    if (!video) return;

    if (!isPreviewEnabled || !edl) {
      video.currentTime = editedTime;
      return;
    }

    const originalTime = editedToOriginalTime(editedTime);
    isSeekingRef.current = true;
    video.currentTime = originalTime;
  }, [edl, isPreviewEnabled, editedToOriginalTime, videoRef]);

  // Get current edited time
  const getEditedTime = useCallback((): number => {
    const video = videoRef.current;
    if (!video) return 0;

    if (!isPreviewEnabled || !edl) {
      return video.currentTime;
    }

    return originalToEditedTime(video.currentTime);
  }, [edl, isPreviewEnabled, originalToEditedTime, videoRef]);

  // Get edited duration (sum of all included segment durations)
  const getEditedDuration = useCallback((): number => {
    if (!edl || !isPreviewEnabled) {
      return videoRef.current?.duration || 0;
    }
    return edl.editedDuration;
  }, [edl, isPreviewEnabled, videoRef]);

  return {
    seekToEditedTime,
    getEditedTime,
    getEditedDuration,
    originalToEditedTime,
    editedToOriginalTime,
    isInExcludedSection,
  };
}
