"use client";

import React from "react";
import { Lock } from "iconoir-react";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import type { CategoryTheme } from "./constants";

/**
 * Jewel Achievement Icon with Category-Tuned Metallic Gem Gradient Mask
 */
export function JewelAchievementIcon({
  iconPath,
  categoryTheme,
  isUnlocked,
  className = "h-7.5 w-7.5",
}: {
  iconPath: string;
  categoryTheme: CategoryTheme;
  isUnlocked: boolean;
  className?: string;
}) {
  if (!isUnlocked) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <img
          src={iconPath}
          alt=""
          className="h-6 w-6 object-contain opacity-20 blur-[1.5px] filter"
          loading="lazy"
        />
        <Lock className="absolute h-5 w-5 text-muted-foreground/80 drop-shadow-sm" />
      </div>
    );
  }

  return (
    <div
      className={cn(className, "bg-gradient-to-tr drop-shadow-md", categoryTheme.iconGradient)}
      style={{
        maskImage: `url(${iconPath})`,
        WebkitMaskImage: `url(${iconPath})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

/**
 * Unified Achievement Card Backdrop combining:
 * - 140px Ghost SVG Heraldic Watermark
 * - Multi-stop Aurora Wave Mesh
 * - Category Bottom-up Radiance
 * - Holographic Foil Sheen (Legendary / Epic)
 * - Apple Frosted Dots Texture Overlay
 */
export function AchievementCardBackdrop({
  iconPath,
  categoryTheme,
  isUnlocked,
  isLegendaryOrEpic = false,
}: {
  iconPath: string;
  categoryTheme: CategoryTheme;
  isUnlocked: boolean;
  isLegendaryOrEpic?: boolean;
}) {
  return (
    <>
      <TextureOverlay texture="dots" opacity={0.035} />

      {/* Multi-stop Aurora Wave Mesh */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-tr opacity-40 blur-xl transition-opacity duration-300",
          isUnlocked && "group-hover:opacity-75",
          categoryTheme.auroraGradient
        )}
      />

      {/* Category Ambient Radiance from Bottom */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-b opacity-45 transition-opacity duration-300",
          isUnlocked && "group-hover:opacity-70",
          categoryTheme.cardGlow
        )}
      />

      {/* Holographic foil sheen on epic/legendary */}
      {isLegendaryOrEpic && isUnlocked && (
        <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-tr from-amber-500/15 via-transparent to-purple-500/15 opacity-60 blur-xl" />
      )}

      {/* 140px Ghost SVG Watermark in Bottom-Right Corner */}
      <div
        className="pointer-events-none absolute -right-6 -bottom-6 h-36 w-36 opacity-[0.065] blur-[0.3px] select-none dark:opacity-[0.095]"
        style={{
          maskImage: `url(${iconPath})`,
          WebkitMaskImage: `url(${iconPath})`,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          backgroundColor: "currentColor",
        }}
      />
    </>
  );
}
