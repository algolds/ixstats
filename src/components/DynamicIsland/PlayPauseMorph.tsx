"use client";

// Shared play↔pause icon that morphs (cross-fade + scale) between states. Just the
// glyph — each call site wraps it in its own <button> so it can match local styling.

import { Play, Pause } from "lucide-react";
import { cn } from "~/lib/utils";

export function PlayPauseMorph({
  isPlaying,
  size = 16,
  className,
}: {
  isPlaying: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Play
        className={cn("absolute transition-all duration-300 ease-out", className)}
        style={{
          width: size,
          height: size,
          opacity: isPlaying ? 0 : 1,
          transform: `scale(${isPlaying ? 0.4 : 1})`,
        }}
      />
      <Pause
        className={cn("absolute transition-all duration-300 ease-out", className)}
        style={{
          width: size,
          height: size,
          opacity: isPlaying ? 1 : 0,
          transform: `scale(${isPlaying ? 1 : 0.4})`,
        }}
      />
    </span>
  );
}
