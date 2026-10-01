"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { type TextureType } from "~/components/ui/texture-overlay";
import { FacetCard } from "~/components/ui/facet-container";
import { FACET_ACCENT, type MyCountryAccent } from "./accents";

interface GlassPanelProps {
  /** Section accent: re-tints the glass wash, border and shadow (Facet 3.1 `accent`). */
  accent?: MyCountryAccent;
  /** Enables hover elevation (also on when onClick is set). */
  interactive?: boolean;
  texture?: TextureType;
  textureOpacity?: number;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

/**
 * GlassPanel — the v2 (c5c6b382) frosted MyCountry panel on the Facet 3.1 glass hero tier:
 * `FacetCard variant="glass"` with the section `accent` (spec §16.8) re-tinting the glass wash,
 * tinted border and shadow — v2's `ACCENT_CLASSES` border + gradient tint, without a hand-rolled
 * blur. Inside another glass surface it renders opaque (glass never nests).
 */
export function GlassPanel({
  accent = "neutral",
  interactive = false,
  texture = "dots",
  textureOpacity = 0.03,
  className,
  onClick,
  children,
}: GlassPanelProps) {
  const clickable = interactive || Boolean(onClick);

  return (
    <FacetCard
      variant="glass"
      accent={FACET_ACCENT[accent]}
      interactive={clickable ? "hover" : "none"}
      onClick={onClick}
      texture={texture === "none" ? undefined : texture}
      textureOpacity={textureOpacity}
      className={cn("text-label rounded-row overflow-hidden", className)}
    >
      <div className="relative z-10">{children}</div>
    </FacetCard>
  );
}
