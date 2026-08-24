"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { IxWikiLogo } from "./IxWikiLogo";
import { IxWikiWordmark } from "./IxWikiWordmark";
import { motion } from "motion/react";

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
  showBadge = true,
}: WikiOSBrandLockupProps) {
  // ── Horizontal / Compact Variant (for navigation / toolbars) ──
  if (variant === "horizontal" || variant === "compact") {
    const isCompact = variant === "compact";
    return (
      <div
        className={cn(
          "inline-flex items-center gap-3 select-none group cursor-default",
          className
        )}
      >
        {/* Apple-grade glass icon tile */}
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/15 dark:border-white/10",
            "bg-gradient-to-b from-white/90 via-white/70 to-white/50 dark:from-zinc-800/80 dark:via-zinc-900/80 dark:to-black/80",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_8px_24px_rgba(0,0,0,0.4)]",
            "backdrop-blur-xl transition-all duration-300 ease-out group-hover:scale-105 group-active:scale-95",
            isCompact ? "h-9 w-9 rounded-xl" : "h-11 w-11 rounded-2xl"
          )}
        >
          {/* Ambient inner glow */}
          <div className="absolute inset-0 bg-radial from-blue-500/10 via-purple-500/5 to-transparent opacity-60 dark:opacity-80" />

          {/* Logomark */}
          <IxWikiLogo
            size={isCompact ? 20 : 24}
            className={cn(
              "relative z-10 text-wiki dark:text-blue-400 transition-transform duration-300 group-hover:scale-105"
            )}
          />

          {/* Shimmer sweep */}
          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full" />
        </div>

        {/* Text Stack */}
        <div className="flex flex-col justify-center text-left">
          <IxWikiWordmark
            size={isCompact ? "sm" : "md"}
            className="text-foreground"
          />
          {showSubtitle && !isCompact && (
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase mt-0.5">
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
        "flex flex-col items-center justify-center text-center select-none group py-2",
        className
      )}
    >
      {/* 1. Free-Standing Laurel Emblem */}
      <motion.div
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 360, damping: 24 }}
        className="relative mb-2.5 cursor-pointer flex items-center justify-center"
      >
        {/* The Laurel Logo */}
        <IxWikiLogo
          size={84}
          className="relative z-10 h-18 w-18 sm:h-22 sm:w-22 text-wiki dark:text-blue-400 drop-shadow-[0_4px_16px_rgba(29,78,137,0.2)] dark:drop-shadow-[0_4px_20px_rgba(96,165,250,0.35)] transition-transform duration-300 group-hover:scale-105"
        />
      </motion.div>

      {/* 2. Wordmark ("IxWiki") */}
      <div className="mb-1 flex items-center justify-center">
        <IxWikiWordmark size="2xl" className="leading-none transition-all duration-300 group-hover:brightness-110" />
      </div>

      {/* 3. Subtitle & Editorial Tagline */}
      {showSubtitle && (
        <div className="flex items-center justify-center text-xs text-muted-foreground/80 font-medium tracking-wide mt-1">
          <span className="tracking-[0.18em] uppercase text-[11px] sm:text-xs font-semibold text-muted-foreground/80 leading-none">
            Worldbuilding Encyclopedia
          </span>
        </div>
      )}
    </div>
  );
}
