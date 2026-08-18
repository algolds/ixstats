"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { TextureOverlay, type TextureType } from "~/components/ui/texture-overlay";
import { ACCENT_CLASSES, type MyCountryAccent } from "./accents";

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
  accent = "neutral",
  tinted = false,
  texture = "none",
  textureOpacity = 0.03,
  className,
  children,
  ...props
}: PanelCardProps) {
  const a = ACCENT_CLASSES[accent];

  return (
    <div
      className={cn(
        "bg-card text-card-foreground relative overflow-hidden rounded-xl border",
        a.border,
        className
      )}
      {...props}
    >
      {tinted && (
        <div
          aria-hidden="true"
          className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", a.tint)}
        />
      )}
      {texture && texture !== "none" && (
        <TextureOverlay texture={texture} opacity={textureOpacity} />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
