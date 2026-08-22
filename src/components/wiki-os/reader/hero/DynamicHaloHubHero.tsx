"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Shuffle, Bookmark, Image as ImageIcon, Clock, Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { WikiOSWordmark } from "~/components/wiki-os/shared/WikiOSWordmark";
import type { WikiHeroProps } from "./types";

export function DynamicHaloHubHero({
  siteStats,
  onOpenSearch,
}: WikiHeroProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  const handleSearchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      );
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 sm:py-10 px-4 select-none">
      {/* ── Morphing Obsidian Dynamic Island / Halo Capsule ── */}
      <motion.div
        layout
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        onClick={() => setIsExpanded((prev) => !prev)}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        className={cn(
          "relative overflow-hidden cursor-pointer",
          "border border-white/20 dark:border-white/15",
          "bg-zinc-950/90 dark:bg-black/95 text-white",
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_16px_48px_rgba(0,0,0,0.4)]",
          "backdrop-blur-3xl transition-colors duration-300",
          isExpanded
            ? "w-full max-w-2xl rounded-[32px] p-5 sm:p-6"
            : "w-auto rounded-full py-2.5 px-5"
        )}
      >
        {/* Specular Top Edge Light */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        {/* Ambient Radial Glow */}
        <div className="pointer-events-none absolute inset-0 bg-radial from-blue-500/15 via-purple-500/5 to-transparent" />

        {/* ── Content Transition ── */}
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            /* Resting Compact Dynamic Pill */
            <motion.div
              key="compact"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3.5"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 border border-white/15">
                <WikiOSLogomark className="h-4 w-auto text-white" />
              </div>
              <WikiOSWordmark className="h-3.5 w-auto text-white" />
              <div className="h-3.5 w-[1px] bg-white/20" />
              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {siteStats?.articles?.toLocaleString() ?? "14,800"} ENTRIES
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500 transition-transform duration-200" />
            </motion.div>
          ) : (
            /* Expanded Full Command Deck */
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4 w-full"
            >
              {/* Header inside Deck */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 border border-white/15">
                    <WikiOSLogomark className="h-5 w-auto text-white" />
                  </div>
                  <div className="flex flex-col">
                    <WikiOSWordmark className="h-4 w-auto text-white" />
                    <span className="text-[9px] font-mono text-zinc-400 tracking-wider uppercase">
                      HALO COMMAND DECK
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400">
                    LIVE REVISION
                  </span>
                </div>
              </div>

              {/* Inline Search Bar Trigger */}
              <div
                onClick={handleSearchClick}
                className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-xs text-zinc-400">
                  <Search className="h-4 w-4 text-blue-400" />
                  <span>Search encyclopedic records, treaties, lore...</span>
                </div>
                <kbd className="text-[10px] font-mono border border-white/15 px-2 py-0.5 rounded-md bg-white/10 text-zinc-300">
                  ⌘K
                </kbd>
              </div>

              {/* Quick Launch Action Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <Link
                  href={withBasePath("/wiki/random")}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95 text-xs text-zinc-300 hover:text-white"
                >
                  <Shuffle className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Random</span>
                </Link>
                <Link
                  href={withBasePath("/stashes")}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95 text-xs text-zinc-300 hover:text-white"
                >
                  <Bookmark className="h-3.5 w-3.5 text-rose-400" />
                  <span>Stashes</span>
                </Link>
                <Link
                  href={withBasePath("/wiki/repository")}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95 text-xs text-zinc-300 hover:text-white"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
                  <span>Repository</span>
                </Link>
                <Link
                  href={withBasePath("/wiki/recent-changes")}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95 text-xs text-zinc-300 hover:text-white"
                >
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Recent</span>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Subtitle / Descriptor */}
      <motion.p
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-xs text-muted-foreground tracking-widest uppercase mt-4 font-mono text-center"
      >
        WORLDBUILDING ENCYCLOPEDIA · EST. MMIII
      </motion.p>
    </div>
  );
}
