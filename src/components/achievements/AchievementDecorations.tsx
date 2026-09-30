"use client";

import React from "react";
import { Lock } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { CategoryTheme } from "./constants";

/**
 * Achievement icon painted in its category colour through the icon mask (locked: a faint
 * blurred icon under a lock)
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
          className="size-6 object-contain opacity-20 blur-[1.5px]"
          loading="lazy"
        />
        <Lock aria-label="Locked" className="text-label-secondary absolute size-5" />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={cn(className, categoryTheme.iconFill)}
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
 * Achievement card backdrop: the achievement's icon as a faint ghost watermark in the
 * bottom-right corner (decorative, `aria-hidden`, behind the content). Facet 3 cards are opaque,
 * so the old aurora, radiance and foil gradients are gone.
 */
export function AchievementCardBackdrop({
  iconPath,
  categoryTheme,
  isUnlocked,
}: {
  iconPath: string;
  categoryTheme: CategoryTheme;
  isUnlocked: boolean;
  /** @deprecated Ignored — the foil sheen was removed in Facet 3. */
  isLegendaryOrEpic?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -right-6 -bottom-6 size-36 opacity-[0.06] select-none print:hidden",
        isUnlocked ? categoryTheme.iconFill : "bg-label"
      )}
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
