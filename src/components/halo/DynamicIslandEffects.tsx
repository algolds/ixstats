"use client";

import React from "react";
import { cn } from "~/lib/utils";

/**
 * Shared style constants for surfaces that mimic the Halo island outside Halo itself (e.g. the
 * WikiOS editor header). Facet 3 (spec §5): this is `material-regular` — surface @ 80% with a
 * 20px / 170% blur — expressed inline for callers that animate their own box. Prefer the
 * `material-regular` utility in new code.
 */
export const DYNAMIC_ISLAND_STYLE = {
  background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
  backdropFilter: "blur(20px) saturate(170%)",
  WebkitBackdropFilter: "blur(20px) saturate(170%)",
} as const;

export const DYNAMIC_ISLAND_BORDER_CLASS = "border border-separator-opaque shadow-floating";

export interface DynamicIslandEffectsProps {
  /** Optional custom class for the glow layer */
  className?: string;
  /** Opacity of the tint glow (default: 0.4 / 40%) */
  glowOpacity?: number;
  /** Whether to show the tint glow (default: true) */
  showGlow?: boolean;
  /** @deprecated Ignored — Facet 3 retires looping shimmers (spec §8). */
  showShimmer?: boolean;
  /** @deprecated Ignored — the glow is uniform. */
  orientation?: "horizontal" | "vertical";
}

/**
 * A soft app-tint glow behind a Halo-style island. The glass edge highlight now comes from the
 * material itself, and the looping shimmer is gone (spec §8: only live indicators loop).
 */
export function DynamicIslandEffects({
  className,
  glowOpacity = 0.4,
  showGlow = true,
}: DynamicIslandEffectsProps) {
  if (!showGlow) return null;
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 z-0", className)}
      style={{ opacity: glowOpacity }}
    >
      <div className="bg-tint/20 absolute inset-0 rounded-[inherit] blur-xl" />
    </div>
  );
}
