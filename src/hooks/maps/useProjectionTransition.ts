/**
 * useProjectionTransition Hook
 *
 * Manages map projection state and smooth transitions between different projections.
 * Supports auto-switching between globe and mercator based on zoom level (Google Maps style).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProjectionType } from '~/types/maps';

/**
 * Projection mode determines how projections are selected
 * - auto: Automatically switches between globe (far) and mercator (close) based on zoom
 * - mercator: Forces mercator projection at all zoom levels
 * - globe: Forces globe projection at all zoom levels
 * - manual: Manual projection selection (for custom projections like equalEarth)
 */
export type ProjectionMode = 'auto' | 'mercator' | 'globe' | 'manual';

interface UseProjectionTransitionProps {
  /** Initial projection type */
  initialProjection?: ProjectionType;
  /** Initial projection mode */
  initialMode?: ProjectionMode;
  /** Zoom level threshold for auto-switching (default: 2.8) */
  autoSwitchZoom?: number;
  /** Callback when projection changes */
  onProjectionChange?: (projection: ProjectionType) => void;
}

interface UseProjectionTransitionReturn {
  /** Current active projection */
  currentProjection: ProjectionType;
  /** Current projection mode */
  projectionMode: ProjectionMode;
  /** Whether projection is currently transitioning */
  isTransitioning: boolean;
  /** Set projection mode */
  setProjectionMode: (mode: ProjectionMode) => void;
  /** Set projection directly (sets mode to 'manual') */
  setProjection: (projection: ProjectionType) => void;
  /** Handle zoom changes (for auto mode) */
  handleZoomChange: (zoom: number) => void;
}

export function useProjectionTransition({
  initialProjection = 'globe',
  initialMode = 'auto',
  autoSwitchZoom = 2.8,
  onProjectionChange,
}: UseProjectionTransitionProps = {}): UseProjectionTransitionReturn {
  const [currentProjection, setCurrentProjection] = useState<ProjectionType>(initialProjection);
  const [projectionMode, setProjectionModeState] = useState<ProjectionMode>(initialMode);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastZoomRef = useRef<number>(0);

  /**
   * Set projection with transition handling
   */
  const changeProjection = useCallback((newProjection: ProjectionType) => {
    if (newProjection === currentProjection) return;

    // Start transition
    setIsTransitioning(true);
    setCurrentProjection(newProjection);

    // Clear existing timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // End transition after animation completes (500ms)
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 500);

    // Notify parent
    onProjectionChange?.(newProjection);
  }, [currentProjection, onProjectionChange]);

  /**
   * Set projection mode and update projection accordingly
   */
  const setProjectionMode = useCallback((mode: ProjectionMode) => {
    setProjectionModeState(mode);

    if (mode === 'mercator') {
      changeProjection('mercator');
    } else if (mode === 'globe') {
      changeProjection('globe');
    } else if (mode === 'auto') {
      // Determine projection based on last known zoom
      const targetProjection = lastZoomRef.current >= autoSwitchZoom ? 'mercator' : 'globe';
      changeProjection(targetProjection);
    }
    // 'manual' mode doesn't auto-change projection
  }, [changeProjection, autoSwitchZoom]);

  /**
   * Set projection directly (switches to manual mode)
   */
  const setProjection = useCallback((projection: ProjectionType) => {
    setProjectionModeState('manual');
    changeProjection(projection);
  }, [changeProjection]);

  /**
   * Handle zoom changes for auto mode
   */
  const handleZoomChange = useCallback((zoom: number) => {
    lastZoomRef.current = zoom;

    // Only auto-switch if in auto mode and using globe/mercator
    if (projectionMode === 'auto') {
      const shouldBeMercator = zoom >= autoSwitchZoom;
      const targetProjection = shouldBeMercator ? 'mercator' : 'globe';

      if (targetProjection !== currentProjection && !isTransitioning) {
        changeProjection(targetProjection);
      }
    }
  }, [projectionMode, autoSwitchZoom, currentProjection, isTransitioning, changeProjection]);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentProjection,
    projectionMode,
    isTransitioning,
    setProjectionMode,
    setProjection,
    handleZoomChange,
  };
}
