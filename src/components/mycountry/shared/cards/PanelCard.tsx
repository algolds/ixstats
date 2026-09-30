"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { type TextureType } from "~/components/ui/texture-overlay";
import { FacetCard } from "~/components/ui/facet-container";
import { type MyCountryAccent } from "./accents";

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
 * A theme-compliant card (`bg-card` + token border) with an optional accent
 * tint and texture overlay. Use for the bulk of content panels. For glassy
 * hero/feature surfaces use `GlassPanel`; for nav/widget framing use `CutoutPanel`.
 */
export function PanelCard({
  accent: _accent = "neutral",
  tinted: _tinted = false,
  texture = "none",
  textureOpacity = 0.03,
  className,
  children,
  ...props
}: PanelCardProps) {
  // An opaque Facet surface: PanelCards sit inside tab shells and sheets, so they never blur.
  // `accent`/`tinted` are kept for API compatibility; the accent now belongs on icons/text only.
  return (
    <FacetCard
      surface="solid"
      className={cn("text-card-foreground overflow-hidden rounded-xl", className)}
      texture={texture === "none" ? undefined : texture}
      textureOpacity={textureOpacity}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </FacetCard>
  );
}
