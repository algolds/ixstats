"use client";

import { type CSSProperties } from "react";
import { cn } from "~/lib/utils/cn";

/**
 * Facet 3.1 identity layers (spec §16): decorative paint behind a hero or feature card's content.
 * Each renders `aria-hidden`, has no pointer events, is not printed, and is placed with utilities
 * (the paint lives in styles/facet/identity.css). Put them as the first children of a
 * `relative overflow-hidden` surface and keep the content `relative` (FacetCard's parts are).
 */

export type TintGlowPosition =
  "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top" | "center";

const GLOW_POSITION: Record<TintGlowPosition, string> = {
  // v2 DomainSurface / DashboardHero: `absolute -top-10 -right-10 h-40 w-40`.
  "top-right": "-top-10 -right-10",
  "top-left": "-top-10 -left-10",
  "bottom-right": "-right-10 -bottom-10",
  "bottom-left": "-bottom-10 -left-10",
  top: "-top-16 left-1/2 -translate-x-1/2",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

const GLOW_SIZE = {
  sm: "size-28",
  md: "size-40",
  lg: "size-64",
} as const;

export interface TintGlowProps {
  /** Where the blob sits (it bleeds off that corner). @default "top-right" */
  position?: TintGlowPosition;
  /** `md` is the v2 160px blob. @default "md" */
  size?: keyof typeof GLOW_SIZE;
  /**
   * Glow colour: any CSS colour, e.g. `var(--color-green)` for a domain, or a data colour. Default
   * the app tint (`--tint`). Sports surfaces stay flat — no glow.
   */
  color?: string;
  className?: string;
}

/**
 * The v2 domain glow: a soft blurred disc in the app tint (15% opacity under a 64px blur) behind a
 * hero or feature card's content. `FacetCard glow` renders one for you.
 *
 * ```tsx
 * <FacetCard variant="glass" className="overflow-hidden">
 *   <TintGlow position="top-right" />
 *   …
 * </FacetCard>
 * ```
 */
export function TintGlow({ position = "top-right", size = "md", color, className }: TintGlowProps) {
  return (
    <span
      aria-hidden="true"
      data-slot="tint-glow"
      data-position={position}
      className={cn(
        "facet-tint-glow absolute rounded-full print:hidden",
        GLOW_POSITION[position],
        GLOW_SIZE[size],
        className
      )}
      style={color ? ({ "--glow-color": color } as CSSProperties) : undefined}
    />
  );
}

export type RefractionEdges = "top" | "all";

export interface RefractionProps {
  /** `top` (default): the light-catching hairline along the top edge (v2 `.facet-refraction`).
   *  `all`: the four Dynamic Island edges (top/left bright, bottom/right soft) for acrylic chrome. */
  edges?: RefractionEdges;
  /** Inset of the top hairline from the corners, so it never crosses the radius. @default "inset-x-6" */
  className?: string;
}

/**
 * The refraction hairline: a 1px white highlight that fades out toward the corners and brightens
 * while its host is hovered or holds focus. On the glass hero and acrylic chrome (FacetCard
 * `variant="glass"` and FacetMaterial `hero`/`acrylic` add it by default).
 */
export function Refraction({ edges = "top", className }: RefractionProps) {
  if (edges === "all") {
    return (
      <>
        <span
          aria-hidden="true"
          data-slot="refraction"
          data-edge="top"
          className={cn(
            "facet-refraction-line absolute inset-x-0 top-0 h-px print:hidden",
            className
          )}
        />
        <span
          aria-hidden="true"
          data-slot="refraction"
          data-edge="bottom"
          className="facet-refraction-line absolute inset-x-0 bottom-0 h-px print:hidden"
        />
        <span
          aria-hidden="true"
          data-slot="refraction"
          data-edge="left"
          className="facet-refraction-line absolute inset-y-0 left-0 w-px print:hidden"
        />
        <span
          aria-hidden="true"
          data-slot="refraction"
          data-edge="right"
          className="facet-refraction-line absolute inset-y-0 right-0 w-px print:hidden"
        />
      </>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-slot="refraction"
      data-edge="top"
      className={cn("facet-refraction-line absolute inset-x-6 top-0 h-px print:hidden", className)}
    />
  );
}

export interface AcrylicGlowProps {
  /** Gradient axis of the glow layers. @default "horizontal" */
  orientation?: "horizontal" | "vertical";
  /** Overall strength (v2 `glowOpacity`, default .4). */
  opacity?: number;
  className?: string;
}

/**
 * The coloured underlay of the Halo island and acrylic navigation (v2 DynamicIslandEffects: three
 * blurred glow layers, recoloured by the app tint; the looping shimmer is retired). Render it as
 * the first child of a `material-acrylic` surface (`FacetMaterial material="acrylic" glow`).
 */
export function AcrylicGlow({
  orientation = "horizontal",
  opacity = 0.4,
  className,
}: AcrylicGlowProps) {
  const style = {
    opacity,
    "--acrylic-glow-angle": orientation === "vertical" ? "180deg" : "90deg",
  } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      data-slot="acrylic-glow"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] print:hidden",
        className
      )}
      style={style}
    >
      <span data-layer="1" className="facet-acrylic-glow absolute inset-0" />
      <span data-layer="2" className="facet-acrylic-glow absolute inset-0" />
      <span data-layer="3" className="facet-acrylic-glow absolute inset-0" />
    </span>
  );
}
