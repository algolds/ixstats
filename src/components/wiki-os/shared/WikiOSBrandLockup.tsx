"use client";

import { cn } from "~/lib/utils";
import { IxWikiLogo } from "./IxWikiLogo";
import { IxWikiWordmark } from "./IxWikiWordmark";
import { motion } from "motion/react";
import { PRESS_SCALE, springSnappy } from "~/lib/design/motion";

interface WikiOSBrandLockupProps {
  className?: string;
  variant?: "hero" | "horizontal" | "compact";
  showSubtitle?: boolean;
  showBadge?: boolean;
}

export function WikiOSBrandLockup({
  className,
  variant = "hero",
  showSubtitle = true,
  // oxlint-disable-next-line eslint/no-unused-vars
  showBadge = true,
}: WikiOSBrandLockupProps) {
  // ── Horizontal / Compact Variant (for navigation / toolbars) ──
  if (variant === "horizontal" || variant === "compact") {
    const isCompact = variant === "compact";
    return (
      <div
        className={cn("group inline-flex cursor-default items-center gap-3 select-none", className)}
      >
        {/* Icon tile */}
        <div
          className={cn(
            "border-separator bg-surface relative flex items-center justify-center overflow-hidden border",
            isCompact ? "rounded-row size-9" : "rounded-card size-11"
          )}
        >
          <IxWikiLogo size={isCompact ? 20 : 24} className="text-tint relative" />
        </div>

        {/* Text Stack */}
        <div className="flex flex-col justify-center text-left">
          <IxWikiWordmark size={isCompact ? "sm" : "md"} className="text-label" />
          {showSubtitle && !isCompact && (
            <span className="text-footnote text-label-secondary mt-0.5">
              Worldbuilding Encyclopedia
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Hero Variant (Apple Editorial Centerpiece for Main Page) ──
  return (
    <div
      className={cn(
        "group flex flex-col items-center justify-center py-2 text-center select-none",
        className
      )}
    >
      {/* 1. Free-Standing Laurel Emblem */}
      <motion.div
        whileTap={{ scale: PRESS_SCALE }}
        transition={springSnappy}
        className="relative mb-2.5 flex cursor-pointer items-center justify-center"
      >
        {/* The Laurel Logo */}
        <IxWikiLogo size={84} className="text-tint relative size-18 sm:size-22" />
      </motion.div>

      {/* 2. Wordmark ("IxWiki") */}
      <div className="mb-1 flex items-center justify-center">
        <IxWikiWordmark size="2xl" className="leading-none" />
      </div>

      {/* 3. Subtitle & Editorial Tagline */}
      {showSubtitle && (
        <div className="mt-1 flex items-center justify-center">
          <span className="text-eyebrow text-label-secondary leading-none">
            Worldbuilding Encyclopedia
          </span>
        </div>
      )}
    </div>
  );
}
