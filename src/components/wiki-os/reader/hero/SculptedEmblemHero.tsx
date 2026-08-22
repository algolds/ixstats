"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { Search, Sparkles, Shuffle, Bookmark, Image as ImageIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { WikiOSWordmark } from "~/components/wiki-os/shared/WikiOSWordmark";
import type { WikiHeroProps } from "./types";

export function SculptedEmblemHero({
  siteStats,
  onOpenSearch,
}: WikiHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, active: false });
  const reduceMotion = useReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setMousePos((prev) => ({ ...prev, active: false }));
  };

  const handleSearchClick = () => {
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      );
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-4xl mx-auto py-8 sm:py-14 px-4 flex flex-col items-center justify-center text-center select-none overflow-hidden"
    >
      {/* ── Interactive Cursor Spotlight Glare ── */}
      {mousePos.active && !reduceMotion && (
        <div
          className="pointer-events-none absolute h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-radial from-blue-500/15 via-purple-500/5 to-transparent blur-2xl transition-opacity duration-300"
          style={{ left: mousePos.x, top: mousePos.y }}
        />
      )}

      {/* ── Borderless Sculpted Vector Emblem ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-3 cursor-pointer group"
      >
        {/* The Sculpted Mark (No card, pure material vector) */}
        <div className="relative">
          <WikiOSLogomark
            className={cn(
              "h-16 sm:h-20 w-auto text-zinc-900 dark:text-zinc-50",
              "drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]",
              "transition-transform duration-300 group-hover:scale-105"
            )}
          />
        </div>

        {/* Sculpted Wordmark */}
        <WikiOSWordmark className="h-6 sm:h-8 w-auto text-zinc-900 dark:text-zinc-100 transition-all duration-300 group-hover:brightness-110" />
      </motion.div>

      {/* ── Precision Linework Descriptor ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative z-10 mt-4 flex items-center justify-center gap-3 text-[11px] font-mono tracking-[0.2em] text-muted-foreground uppercase"
      >
        <span className="hidden sm:inline-block w-8 h-[1px] bg-border" />
        <span>WORLDBUILDING ENCYCLOPEDIA</span>
        <span>·</span>
        <span className="text-foreground/70 font-semibold">EST. MMIII</span>
        <span className="hidden sm:inline-block w-8 h-[1px] bg-border" />
      </motion.div>

      {/* ── Minimalist Integrated Search Bar ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="relative z-10 mt-6 w-full max-w-md"
      >
        <button
          type="button"
          onClick={handleSearchClick}
          className={cn(
            "w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-full cursor-pointer",
            "border border-border/80 bg-background/80 hover:bg-background hover:border-foreground/30",
            "shadow-xs hover:shadow-md transition-all duration-200"
          )}
        >
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5 text-blue-500" />
            <span>Search {siteStats?.articles?.toLocaleString() ?? "14,800+"} lore chronicles...</span>
          </div>
          <kbd className="text-[10px] font-mono border border-border px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </motion.div>
    </div>
  );
}
