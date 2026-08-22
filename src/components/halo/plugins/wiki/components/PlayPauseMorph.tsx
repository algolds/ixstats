// src/components/halo/plugins/wiki/components/PlayPauseMorph.tsx
// Apple Design Play ↔ Pause vector morphing component.
// Smoothly interpolates dual SVG polygon paths between a right-facing play wedge and dual pause pillars
// with fluid cubic-bezier easing, optical centering, and spring dynamics.

"use client";

import React from "react";
import { cn } from "~/lib/utils";

export interface PlayPauseMorphProps {
  /** Whether currently in Playing state (shows Pause glyph) or Paused state (shows Play glyph) */
  isPlaying: boolean;
  /** Size in pixels (width and height) */
  size?: number;
  /** Additional CSS class names for styling or color */
  className?: string;
  /** Custom fill color (defaults to currentColor) */
  fill?: string;
}

export function PlayPauseMorph({
  isPlaying,
  size = 18,
  className,
  fill = "currentColor",
}: PlayPauseMorphProps) {
  // SVG coordinates in a 24x24 viewBox:
  // Pause state: Left bar (x: 5 to 9.5), Right bar (x: 14.5 to 19), y: 4.5 to 19.5
  // Play state: Left wedge (M 6.5 4.5 L 13.5 8.8 L 13.5 15.2 L 6.5 19.5), Right wedge (M 13.5 8.8 L 19.5 12 L 19.5 12 L 13.5 15.2)

  const leftPath = isPlaying
    ? "M 5 4.5 L 9.5 4.5 L 9.5 19.5 L 5 19.5 Z"
    : "M 6.5 4.5 L 13.5 8.8 L 13.5 15.2 L 6.5 19.5 Z";

  const rightPath = isPlaying
    ? "M 14.5 4.5 L 19 4.5 L 19 19.5 L 14.5 19.5 Z"
    : "M 13.5 8.8 L 19.5 12 L 19.5 12 L 13.5 15.2 Z";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center select-none",
        className
      )}
      style={{
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="overflow-visible transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{
          // Optical centering compensation: Play triangle center of mass is slightly left,
          // so we nudge right by 1px in play mode to look perfectly centered in circular buttons.
          transform: isPlaying ? "scale(1) translateX(0px)" : "scale(1.02) translateX(1px)",
        }}
      >
        {/* Left Morphing Pillar / Wedge */}
        <path
          d={leftPath}
          fill={fill}
          className="transition-all duration-260 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            transformOrigin: "center",
          }}
        />

        {/* Right Morphing Pillar / Wedge */}
        <path
          d={rightPath}
          fill={fill}
          className="transition-all duration-260 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            transformOrigin: "center",
          }}
        />
      </svg>
    </span>
  );
}
