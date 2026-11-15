"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import type { AvatarGlowConfig } from "~/hooks/useActiveCosmetics";
import { CosmeticParticles } from "~/components/vault/CosmeticParticles";

interface AvatarGlowProps {
  avatarGlow: AvatarGlowConfig;
  children: React.ReactNode;
  className?: string;
  roundedClass?: string;
}

const PRESET_GLOW_STYLES: ReadonlySet<string> = new Set(["summer", "emerald", "imperial"]);

export function AvatarGlow({
  avatarGlow,
  children,
  className,
  roundedClass = "rounded-full",
}: AvatarGlowProps) {
  const reduceMotion = useFacetReducedMotion();

  if (!avatarGlow.enabled) {
    return (
      <div
        className={cn(
          "border-separator relative flex shrink-0 items-center justify-center border",
          roundedClass,
          className
        )}
      >
        {children}
      </div>
    );
  }

  const styleKey = avatarGlow.style || undefined;
  const isPreset = Boolean(styleKey && PRESET_GLOW_STYLES.has(styleKey));
  const customVars: Record<string, string> = {};
  if (!isPreset) {
    if (avatarGlow.color) customVars["--cosmetic-color"] = avatarGlow.color;
    if (avatarGlow.intensity) customVars["--cosmetic-radius"] = avatarGlow.intensity;
  }
  const customStyle =
    Object.keys(customVars).length > 0 ? (customVars as React.CSSProperties) : undefined;

  return (
    <div
      data-glow-style={styleKey}
      className={cn(
        "cosmetic-avatar-glow relative flex shrink-0 items-center justify-center",
        roundedClass,
        className
      )}
      style={customStyle}
    >
      {!reduceMotion && styleKey && (
        <CosmeticParticles style={styleKey} containerType="glow" className="rounded-[inherit]" />
      )}
      <span
        aria-hidden="true"
        className={cn("cosmetic-avatar-aura absolute inset-0 -z-10", roundedClass)}
      />
      {children}
    </div>
  );
}
