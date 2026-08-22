"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { WikiOSLogomark } from "./WikiOSLogomark";
import { WikiOSWordmark } from "./WikiOSWordmark";
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
          <WikiOSLogomark
            className={cn(
              "relative z-10 text-zinc-900 dark:text-zinc-100 transition-transform duration-300 group-hover:scale-105",
              isCompact ? "h-5" : "h-6"
            )}
          />

          {/* Shimmer sweep */}
          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full" />
        </div>

        {/* Text Stack */}
        <div className="flex flex-col justify-center text-left">
          <WikiOSWordmark
            className={cn(
              "text-zinc-900 dark:text-zinc-100 transition-colors duration-200",
              isCompact ? "h-3.5" : "h-4.5"
            )}
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
        "flex flex-col items-center justify-center text-center select-none group py-4",
        className
      )}
    >
      {/* 1. Monogram Tile Icon */}
      <motion.div
        whileHover={{ scale: 1.04, y: -2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="relative mb-5 cursor-pointer"
      >
        {/* Ambient background bloom */}
        <div className="absolute -inset-2 rounded-[28px] bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-amber-500/10 opacity-70 blur-xl transition-all duration-500 group-hover:opacity-100 group-hover:blur-2xl dark:from-blue-500/25 dark:via-purple-500/20 dark:to-amber-500/15" />

        {/* Apple continuous squircle container */}
        <div
          className={cn(
            "relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center overflow-hidden rounded-[24px] sm:rounded-[28px]",
            "border border-white/30 dark:border-white/15",
            "bg-gradient-to-b from-white/95 via-white/80 to-white/60 dark:from-zinc-800/90 dark:via-zinc-900/90 dark:to-black/95",
            "shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.8),0_12px_36px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_16px_48px_rgba(0,0,0,0.5)]",
            "backdrop-blur-2xl transition-all duration-300"
          )}
        >
          {/* Subtle specular top-edge light */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/40 to-transparent" />

          {/* Radial depth glow */}
          <div className="absolute inset-0 bg-radial from-blue-500/15 via-indigo-500/10 to-transparent opacity-80 dark:opacity-100" />

          {/* The Monogram Mark */}
          <WikiOSLogomark className="relative z-10 h-12 w-auto sm:h-14 text-zinc-900 dark:text-zinc-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-105" />

          {/* Dynamic shimmer sweep */}
          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/15 to-transparent transition-transform duration-1000 ease-in-out group-hover:translate-x-full" />
        </div>
      </motion.div>

      {/* 2. Wordmark ("wikiOS") */}
      <div className="mb-2 flex items-center justify-center">
        <WikiOSWordmark className="h-6 sm:h-7 w-auto text-zinc-900 dark:text-zinc-100 transition-all duration-300 group-hover:brightness-110" />
      </div>

      {/* 3. Subtitle & Editorial Tagline */}
      {showSubtitle && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground/80 font-medium tracking-wide">
          <span className="tracking-[0.14em] uppercase text-[11px] sm:text-xs text-muted-foreground">
            Worldbuilding Encyclopedia
          </span>
          {showBadge && (
            <>
              <span className="text-muted-foreground/40 text-[10px]">·</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-foreground/[0.03] px-2 py-0.5 text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
                EST. MMIII
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
