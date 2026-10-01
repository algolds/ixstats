"use client";

import React from "react";
import { AcrylicGlow, Refraction } from "~/components/ui/facet/identity/Glow";

/**
 * The Halo island's acrylic effects (Facet 3.1, spec §16) — the v2 DynamicIslandEffects layers
 * rebuilt on the identity primitives: the coloured glow underlay (`AcrylicGlow`, three blurred
 * layers in the app tint) and the four refraction edges (`Refraction edges="all"`). The looping
 * shimmer stays retired (spec §8).
 *
 * The material itself is the `material-acrylic` utility (v2 `.dynamic-island-shell`: 28px / 190%
 * blur, white 85% / obsidian 88%, inset rim, deep shadow; brighter on hover, focus-within and
 * `data-expanded="true"`). Prefer `<FacetMaterial material="acrylic" glow>` (which renders both
 * layers); use this component when the island animates its own `motion` box:
 *
 * ```tsx
 * <motion.div layout className="material-acrylic relative isolate overflow-hidden rounded-full">
 *   <DynamicIslandEffects />
 *   …
 * </motion.div>
 * ```
 */
export const DYNAMIC_ISLAND_MATERIAL_CLASS = "material-acrylic";

export interface DynamicIslandEffectsProps {
  /** Optional custom class for the glow layer */
  className?: string;
  /** Opacity of the glow underlay (v2 default: 0.4 / 40%) */
  glowOpacity?: number;
  /** Whether to show the glow underlay (default: true) */
  showGlow?: boolean;
  /** Whether to draw the four refraction edges (default: true) */
  showRefraction?: boolean;
  /** @deprecated Ignored — Facet retires looping shimmers (spec §8). */
  showShimmer?: boolean;
  /** Axis of the glow gradients (default: "horizontal") */
  orientation?: "horizontal" | "vertical";
}

export function DynamicIslandEffects({
  className,
  glowOpacity = 0.4,
  showGlow = true,
  showRefraction = true,
  orientation = "horizontal",
}: DynamicIslandEffectsProps) {
  return (
    <>
      {showGlow && (
        <AcrylicGlow
          opacity={glowOpacity}
          orientation={orientation}
          className={className ?? "-z-10"}
        />
      )}
      {showRefraction && <Refraction edges="all" />}
    </>
  );
}
