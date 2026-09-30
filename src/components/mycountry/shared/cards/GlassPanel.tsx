"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { type TextureType } from "~/components/ui/texture-overlay";
import { FacetContainer } from "~/components/ui/facet-container";
import { type MyCountryAccent } from "./accents";

interface GlassPanelProps {
  /** Section accent applied to the border and tint. */
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
 * GlassPanel — theme-compliant frosted surface with the Builder's "glass" feel
 * (backdrop blur + accent tint), built on theme tokens (`bg-card/70`) instead
 * of white-based layers so it reads in light + dark.
 */
export function GlassPanel({
  accent: _accent = "neutral",
  interactive = false,
  texture = "dots",
  textureOpacity = 0.03,
  className,
  onClick,
  children,
}: GlassPanelProps) {
  // A page-level Facet shell (depth 1). `accent` is kept for API compatibility; the accent
  // now belongs on icons/text inside the panel, not on a tinted wash.
  const clickable = interactive || Boolean(onClick);

  return (
    <FacetContainer
      depth={1}
      interactive={clickable ? "hover" : "none"}
      enableRefraction={false}
      onClick={onClick}
      texture={texture === "none" ? undefined : texture}
      textureOpacity={textureOpacity}
      className={cn("text-card-foreground overflow-hidden rounded-xl", className)}
    >
      <div className="relative z-10">{children}</div>
    </FacetContainer>
  );
}
