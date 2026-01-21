import { useMemo, useCallback } from 'react';
import type { ZoomEffect, ARollSegment, BRollSuggestion, EditDecisionList } from '@/types/autoEditor';

export interface ActiveZoom {
  scale: number;
  focalPoint: { x: number; y: number };
  isActive: boolean;
}

export interface VideoZoomPreviewConfig {
  edl: EditDecisionList | null;
  currentTime: number;
  isPreviewEnabled: boolean;
}

export function useVideoZoomPreview({ edl, currentTime, isPreviewEnabled }: VideoZoomPreviewConfig) {
  // Calculate active zoom effect at current time
  const activeZoom = useMemo((): ActiveZoom => {
    if (!edl || !isPreviewEnabled) {
      return { scale: 1, focalPoint: { x: 50, y: 50 }, isActive: false };
    }

    const enabledZooms = edl.zoomEffects.filter(z => z.isEnabled);
    
    // Find active zoom at current time
    const activeZoomEffect = enabledZooms.find(z => 
      currentTime >= z.startTime && currentTime <= z.endTime
    );

    if (!activeZoomEffect) {
      return { scale: 1, focalPoint: { x: 50, y: 50 }, isActive: false };
    }

    // Calculate progress through the zoom (0 to 1)
    const progress = (currentTime - activeZoomEffect.startTime) / activeZoomEffect.duration;
    const clampedProgress = Math.max(0, Math.min(1, progress));
    
    // Apply easing
    const easedProgress = applyEasing(clampedProgress, activeZoomEffect.easing);
    
    // Interpolate scale
    const scale = activeZoomEffect.startScale + 
      (activeZoomEffect.endScale - activeZoomEffect.startScale) * easedProgress;

    return {
      scale,
      focalPoint: activeZoomEffect.focalPoint,
      isActive: true,
    };
  }, [edl, currentTime, isPreviewEnabled]);

  // Get current active segment based on edited timeline
  const activeSegment = useMemo(() => {
    if (!edl) return null;

    const includedSegments = edl.aRollSegments.filter(s => s.isIncluded);
    return includedSegments.find(s => 
      currentTime >= s.newStartTime && currentTime <= s.newEndTime
    ) || null;
  }, [edl, currentTime]);

  // Get active B-roll at current time
  const activeBRoll = useMemo(() => {
    if (!edl) return null;

    const approvedBRoll = edl.bRollSuggestions.filter(
      b => b.status === 'approved' || b.status === 'ready'
    );
    
    return approvedBRoll.find(b => {
      const bRollEnd = b.timestamp + b.duration;
      return currentTime >= b.timestamp && currentTime <= bRollEnd;
    }) || null;
  }, [edl, currentTime]);

  // Calculate CSS transform for zoom effect
  const zoomStyle = useMemo(() => {
    if (!activeZoom.isActive) {
      return {
        transform: 'scale(1) translate(0, 0)',
        transformOrigin: 'center center',
        transition: 'transform 0.1s ease-out',
      };
    }

    // Calculate transform origin from focal point
    const originX = activeZoom.focalPoint.x;
    const originY = activeZoom.focalPoint.y;

    return {
      transform: `scale(${activeZoom.scale})`,
      transformOrigin: `${originX}% ${originY}%`,
      transition: 'transform 0.05s linear',
    };
  }, [activeZoom]);

  // Check if current time is within an excluded section
  const isInExcludedSection = useMemo(() => {
    if (!edl) return false;
    
    return edl.removedSections.some(section => 
      currentTime >= section.startTime && currentTime <= section.endTime
    );
  }, [edl, currentTime]);

  return {
    activeZoom,
    activeSegment,
    activeBRoll,
    zoomStyle,
    isInExcludedSection,
  };
}

// Easing functions
function applyEasing(t: number, easing: ZoomEffect['easing']): number {
  switch (easing) {
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'linear':
    default:
      return t;
  }
}
