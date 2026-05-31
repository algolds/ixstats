"use client";

import React from "react";
import { cn } from "~/lib/utils";

/**
 * Shared Style Constants for the Dynamic Island glass aesthetic
 */
export const DYNAMIC_ISLAND_STYLE = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
  backdropFilter: "blur(20px) saturate(190%)",
  WebkitBackdropFilter: "blur(20px) saturate(190%)",
} as const;

export const DYNAMIC_ISLAND_BORDER_CLASS =
  "border border-white/20 dark:border-white/10 shadow-lg shadow-black/20";

interface DynamicIslandEffectsProps {
  /** Optional custom class for the outer wrappers */
  className?: string;
  /** Opacity level for the colorful background glow layers (default: 0.4 / 40%) */
  glowOpacity?: number;
  /** Whether to show the colorful glow layers (default: true) */
  showGlow?: boolean;
  /** Whether to show the pulse shimmer animation (default: true) */
  showShimmer?: boolean;
  /** The primary axis orientation of the gradients and shimmers (default: "horizontal") */
  orientation?: "horizontal" | "vertical";
}

/**
 * Reusable component containing the multi-layer glows, refraction edges,
 * and shimmer animations that form the Dynamic Island visual style.
 */
export function DynamicIslandEffects({
  className,
  glowOpacity = 0.4,
  showGlow = true,
  showShimmer = true,
  orientation = "horizontal",
}: DynamicIslandEffectsProps) {
  const isVertical = orientation === "vertical";
  const gradientDirection = isVertical ? "bg-gradient-to-b" : "bg-gradient-to-r";

  return (
    <>
      {/* Multi-layer colorful background glow (exactly like the hero card) */}
      {showGlow && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-0 transition-opacity duration-350",
            className
          )}
          style={{ opacity: glowOpacity }}
        >
          <div
            className={cn(
              "absolute inset-0 blur-xl",
              gradientDirection,
              "from-blue-500/30 via-purple-500/30 to-blue-500/30"
            )}
          />
          <div
            className={cn(
              "absolute inset-0 blur-lg",
              gradientDirection,
              "from-cyan-400/20 via-indigo-500/20 to-purple-400/20"
            )}
          />
          <div
            className={cn(
              "absolute inset-0 blur-md",
              gradientDirection,
              "from-blue-300/15 via-purple-300/15 to-blue-300/15"
            )}
          />
        </div>
      )}

      {/* Refraction edges (exactly like the hero card) */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/35 to-transparent" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/35 to-transparent" />
        <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />

        {/* Inner Shimmer */}
        {showShimmer && (
          <div
            className={cn(
              "absolute inset-0 animate-pulse",
              gradientDirection,
              "from-transparent via-white/10 to-transparent"
            )}
            style={{ animationDuration: "3s", animationTimingFunction: "ease-in-out" }}
          />
        )}
      </div>
    </>
  );
}
