"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { type TextureType } from "~/components/ui/texture-overlay";
import { FacetCard } from "~/components/ui/facet-container";
import { FACET_ACCENT, type MyCountryAccent } from "./accents";

interface PanelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section accent; defaults to neutral (plain themed card). */
  accent?: MyCountryAccent;
  /** Render a subtle accent gradient wash over the card surface. */
  tinted?: boolean;
  /** Tactile texture overlay (set to "none" to disable). */
  texture?: TextureType;
  textureOpacity?: number;
  children: React.ReactNode;
}

/**
 * PanelCard — the workhorse MyCountry surface.
 *
 * A theme-compliant opaque card (`bg-surface` + token border) with an optional accent
 * (v2: a hairline border in the section colour) and `tinted` wash, plus a texture overlay. Use for the bulk of content panels. For glassy
 * hero/feature surfaces use `GlassPanel`; for nav/widget framing use `CutoutPanel`.
 */
export function PanelCard({
  accent = "neutral",
  tinted = false,
  texture = "none",
  textureOpacity = 0.03,
  className,
  children,
  ...props
}: PanelCardProps) {
  // An opaque Facet surface: PanelCards sit inside tab shells and sheets, so they never blur.
  // The accent paints only the hairline and the optional wash; text stays on label roles.
  const facetAccent = FACET_ACCENT[accent];
  return (
    <FacetCard
      accent={facetAccent}
      className={cn(
        "text-label rounded-row overflow-hidden",
        facetAccent && "border-facet-accent/20",
        className
      )}
      texture={texture === "none" ? undefined : texture}
      textureOpacity={textureOpacity}
      {...props}
    >
      {tinted && facetAccent ? (
        <div
          aria-hidden="true"
          className="bg-facet-accent/5 pointer-events-none absolute inset-0"
        />
      ) : null}
      <div className="relative z-10">{children}</div>
    </FacetCard>
  );
}
