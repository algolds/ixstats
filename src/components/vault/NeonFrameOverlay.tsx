"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import type { NeonFrameConfig } from "~/hooks/useActiveCosmetics";
import { CosmeticParticles } from "~/components/vault/CosmeticParticles";

interface NeonFrameOverlayProps {
  neonFrame: NeonFrameConfig;
  className?: string;
}

const PRESET_FRAME_STYLES: ReadonlySet<string> = new Set(["ruby", "winter"]);

export function NeonFrameOverlay({ neonFrame, className }: NeonFrameOverlayProps) {
  const reduceMotion = useFacetReducedMotion();

  if (!neonFrame.enabled) return null;

  const styleKey = neonFrame.style || undefined;
  const isPreset = Boolean(styleKey && PRESET_FRAME_STYLES.has(styleKey));
  const customStyle: React.CSSProperties | undefined =
    !isPreset && neonFrame.color
      ? ({ "--cosmetic-color": neonFrame.color } as React.CSSProperties)
      : undefined;

  return (
    <div
      data-frame-style={styleKey}
      className={cn(
        "cosmetic-neon-frame rounded-card pointer-events-none absolute inset-0 z-30",
        className
      )}
      style={customStyle}
    >
      {!reduceMotion && styleKey && (
        <CosmeticParticles style={styleKey} containerType="frame" className="rounded-[inherit]" />
      )}
      {styleKey === "ruby" && !reduceMotion && (
        <div className="rounded-card absolute inset-0 overflow-hidden">
          <div className="cosmetic-neon-shimmer absolute inset-0" />
        </div>
      )}
    </div>
  );
}
