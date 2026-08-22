"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Shuffle, Bookmark, Image as ImageIcon, Clock, Globe } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath, navigateWithBasePath } from "~/lib/base-path";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { WikiOSWordmark } from "~/components/wiki-os/shared/WikiOSWordmark";
import type { WikiHeroProps } from "./types";

const SEARCH_PLACEHOLDERS = [
  "Search 14,800+ articles, nations, treaties...",
  "Look up lore entries, characters, dynasties...",
  "Explore sovereign states, pacts, timelines...",
  "Search by battle, conflict, or geography...",
];

export function SystemCommandDockHero({
  siteStats,
  onOpenSearch,
}: WikiHeroProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Cycle search hint text gently
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleSearchClick = () => {
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      // Trigger global search shortcut event
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      );
    }
  };

  const articleCount = siteStats?.articles?.toLocaleString() ?? "14,800+";

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 sm:py-8 px-2">
      {/* ── Main Unified Liquid Glass Masthead Dock ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "w-full max-w-4xl relative flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 p-2 sm:p-2.5 rounded-3xl md:rounded-full",
          "border border-white/20 dark:border-white/10",
          "bg-white/75 dark:bg-zinc-950/80 backdrop-blur-2xl",
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_16px_48px_rgba(0,0,0,0.5)]",
          "transition-all duration-300"
        )}
      >
        {/* Left: Brand Monogram & Wordmark */}
        <Link
          href={withBasePath("/wiki/Main_Page")}
          className="group flex items-center gap-3 pl-2 sm:pl-3 pr-2 py-1 select-none outline-none"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-white/25 dark:border-white/15 bg-gradient-to-b from-white/95 to-white/60 dark:from-zinc-800/90 dark:to-black/90 shadow-sm transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
            <WikiOSLogomark className="h-6 w-auto text-zinc-900 dark:text-zinc-100 transition-transform duration-300 group-hover:scale-105" />
            <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </div>
          <div className="flex flex-col text-left">
            <WikiOSWordmark className="h-4 w-auto text-zinc-900 dark:text-zinc-100 transition-colors group-hover:text-blue-500 dark:group-hover:text-blue-400" />
            <span className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
              ARCHIVE OS
            </span>
          </div>
        </Link>

        {/* Center: Universal Interactive Search Prompt */}
        <button
          type="button"
          onClick={handleSearchClick}
          className={cn(
            "flex-1 w-full md:w-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-full cursor-pointer",
            "border border-black/[0.06] dark:border-white/[0.08]",
            "bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]",
            "transition-all duration-200 group/search"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Search className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0 transition-transform duration-200 group-hover/search:scale-110" />
            <span className="text-xs sm:text-sm text-muted-foreground/80 truncate text-left font-normal">
              {SEARCH_PLACEHOLDERS[placeholderIndex]}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-800/80 px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground shadow-xs">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </div>
        </button>

        {/* Right: Live Telemetry Status Pill */}
        <div className="hidden lg:flex items-center gap-3 pl-2 pr-3 py-1 text-xs text-muted-foreground select-none">
          <div className="flex items-center gap-2 rounded-full border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-medium text-foreground text-[11px]">
              {articleCount}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal">
              Articles
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Secondary Quick-Action Pill Chips ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-2 select-none"
      >
        <Link
          href={withBasePath("/wiki/random")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer",
            "border border-border/40 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-border/70",
            "text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95"
          )}
        >
          <Shuffle className="h-3.5 w-3.5 text-indigo-400" />
          <span>Random Article</span>
        </Link>

        <Link
          href={withBasePath("/stashes")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer",
            "border border-border/40 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-border/70",
            "text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95"
          )}
        >
          <Bookmark className="h-3.5 w-3.5 text-rose-400" />
          <span>Stashes</span>
        </Link>

        <Link
          href={withBasePath("/wiki/repository")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer",
            "border border-border/40 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-border/70",
            "text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95"
          )}
        >
          <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
          <span>Repository</span>
        </Link>

        <Link
          href={withBasePath("/wiki/recent-changes")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer",
            "border border-border/40 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-border/70",
            "text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95"
          )}
        >
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span>Recent Changes</span>
        </Link>

        <Link
          href={withBasePath("/maps")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer",
            "border border-border/40 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-border/70",
            "text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95"
          )}
        >
          <Globe className="h-3.5 w-3.5 text-emerald-400" />
          <span>World Map</span>
        </Link>
      </motion.div>
    </div>
  );
}
