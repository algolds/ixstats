"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { TextureOverlay, type TextureType } from "~/components/ui/texture-overlay";
import { ACCENT_CLASSES, type MyCountryAccent } from "./accents";

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
  accent = "neutral",
  interactive = false,
  texture = "dots",
  textureOpacity = 0.03,
  className,
  onClick,
  children,
}: GlassPanelProps) {
  const a = ACCENT_CLASSES[accent];
  const clickable = interactive || Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card/70 text-card-foreground relative overflow-hidden rounded-xl border backdrop-blur-md",
        a.border,
        clickable && "cursor-pointer transition-shadow duration-300 hover:shadow-lg",
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", a.tint)}
      />
      {texture && texture !== "none" && (
        <TextureOverlay texture={texture} opacity={textureOpacity} />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

