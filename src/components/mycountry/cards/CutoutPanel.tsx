"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";
import type { TextureType } from "~/components/ui/texture-overlay";

interface CutoutPanelProps {
  className?: string;
  contentClassName?: string;
  texture?: TextureType;
  textureOpacity?: number;
  /** When true the card tracks pointer hover (for clickable cards). Default false (static framing). */
  trackPointerHover?: boolean;
  children: React.ReactNode;
}

/**
 * CutoutPanel — themed framing surface for navigation rails and sidebar widgets.
 *
 * Thin wrapper over the (already theme-compliant) CutoutCard, giving the
 * distinctive textured "cutout" framing without the clickable surface chrome.
 */
export function CutoutPanel({
  className,
  contentClassName,
  texture = "dots",
  textureOpacity = 0.04,
  trackPointerHover = false,
  children,
}: CutoutPanelProps) {
  return (
    <CutoutCard
      texture={texture}
      textureOpacity={textureOpacity}
      trackPointerHover={trackPointerHover}
      className={cn(
        "bg-card text-card-foreground border-border/70 relative overflow-hidden rounded-2xl border",
        className
      )}
    >
      <CutoutCardContent className={cn("p-4", contentClassName)}>{children}</CutoutCardContent>
    </CutoutCard>
  );
}
