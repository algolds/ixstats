"use client";

import { useMotionValue, useMotionTemplate } from "motion/react";
import { useState, useCallback } from "react";

export interface CursorSpotlightOptions {
  /** Spotlight color (CSS color, e.g. "rgba(255,255,255,0.06)") */
  color?: string;
  /** Spotlight radius in px */
  radius?: number;
  /** Whether the spotlight is enabled */
  enabled?: boolean;
}

/**
 * Shared cursor spotlight hook for Facet and glass surfaces.
 * Tracks pointer position relative to container bounds and generates
 * a reactive CSS radial gradient template.
 */
export function useCursorSpotlight(options: CursorSpotlightOptions = {}) {
  const { color = "rgba(255,255,255,0.06)", radius = 300, enabled = true } = options;
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [hovering, setHovering] = useState(false);

  const spotlight = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, ${color}, transparent 80%)`;

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    },
    [enabled, mouseX, mouseY]
  );

  const onMouseEnter = useCallback(() => {
    if (enabled) setHovering(true);
  }, [enabled]);

  const onMouseLeave = useCallback(() => {
    if (enabled) setHovering(false);
  }, [enabled]);

  return {
    spotlight: enabled && hovering ? spotlight : undefined,
    isHovering: hovering,
    handlers: {
      onMouseMove,
      onMouseEnter,
      onMouseLeave,
    },
  };
}
