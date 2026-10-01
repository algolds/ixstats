"use client";

import { createContext, useContext } from "react";

/**
 * Glass never nests (spec §5, §16.2, §16.8). The hero-tier glass primitives — `FacetCard
 * variant="glass"`, `CutoutCard variant="glass"`, `FacetMaterial material="hero" | "acrylic"` —
 * provide `true`; a hero-tier glass primitive rendered inside one renders opaque instead (and warns
 * in development), so glass stacked in glass can't happen through the primitives.
 *
 * Chrome glass (`thin` / `regular` / `thick`) does not provide it: popovers and sheets portal out
 * of their trigger's tree, so React nesting says nothing about visual nesting there.
 */
export const GlassSurfaceContext = createContext(false);

/** True when rendered inside a hero-tier glass surface. */
export function useInsideGlass(): boolean {
  return useContext(GlassSurfaceContext);
}

const warned = new Set<string>();

/** Development warning for a glass primitive that was asked to nest (once per component). */
export function warnNestedGlass(component: string): void {
  if (process.env.NODE_ENV === "production" || warned.has(component)) return;
  warned.add(component);
  console.warn(
    `[Facet] ${component}: glass never nests (spec §16.8) — rendering the opaque surface. ` +
      `Inside a glass hero use opaque roles or FacetCard variant="inset".`
  );
}
