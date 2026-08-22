"use client";

import React from "react";
import Link from "next/link";
import { Search, Compass, BookOpen, Layers, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { WikiOSWordmark } from "~/components/wiki-os/shared/WikiOSWordmark";
import type { WikiHeroProps } from "./types";

export function TypographicMastheadHero({
  siteStats,
  onOpenSearch,
}: WikiHeroProps) {
  const reduceMotion = useReducedMotion();

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
    <div className="w-full max-w-5xl mx-auto py-6 sm:py-10 px-4 select-none">
      {/* ── Top Running Header Rule ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scaleX: 0.96 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full flex items-center justify-between border-t border-b border-foreground/10 py-2 text-[10px] font-mono tracking-[0.22em] text-muted-foreground uppercase"
      >
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span>WIKIOS ARCHIVE SYSTEM // RELEASE OGMA</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-muted-foreground/60">
          <span>LATITUDE 0.0° N</span>
          <span>·</span>
          <span>CANVAS ENGINE V1.4</span>
        </div>
        <div className="flex items-center gap-2">
          <span>EDITION MMIII</span>
        </div>
      </motion.div>

      {/* ── Monumental Editorial Centerpiece ── */}
      <div className="py-8 sm:py-12 flex flex-col md:flex-row items-baseline justify-between gap-6 sm:gap-8">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-4">
            {/* Sculptural Drop-Cap Mark */}
            <WikiOSLogomark className="h-12 sm:h-16 w-auto text-foreground drop-shadow-sm transition-transform duration-300 hover:scale-105" />
            <WikiOSWordmark className="h-7 sm:h-10 w-auto text-foreground" />
          </div>
          <p className="text-sm sm:text-base text-muted-foreground font-normal tracking-wide max-w-lg mt-2 leading-relaxed">
            The Living Canonical Encyclopedia of Ixnay, sovereign nations, geopolitical treaties, and world history.
          </p>
        </motion.div>

        {/* Search & Navigation Action Tile */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3 w-full md:w-auto shrink-0"
        >
          <button
            type="button"
            onClick={handleSearchClick}
            className={cn(
              "flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl border border-foreground/15",
              "bg-foreground/[0.03] hover:bg-foreground/[0.07] hover:border-foreground/30",
              "transition-all duration-200 cursor-pointer shadow-xs group"
            )}
          >
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5 text-blue-500 transition-transform group-hover:scale-110" />
              <span>Search knowledge base...</span>
            </div>
            <kbd className="text-[10px] font-mono border border-foreground/15 px-1.5 py-0.5 rounded bg-background/50 text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href={withBasePath("/wiki/random")}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-border/50 bg-background/40 hover:bg-foreground/[0.04] text-muted-foreground hover:text-foreground text-[11px] transition-colors"
            >
              <Compass className="h-3 w-3 text-indigo-400" />
              <span>Random</span>
            </Link>
            <Link
              href={withBasePath("/wiki/repository")}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-border/50 bg-background/40 hover:bg-foreground/[0.04] text-muted-foreground hover:text-foreground text-[11px] transition-colors"
            >
              <Layers className="h-3 w-3 text-purple-400" />
              <span>Repository</span>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* ── Editorial Stats Ribbon ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="w-full border-t border-foreground/10 pt-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-muted-foreground"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {siteStats?.articles?.toLocaleString() ?? "14,821"}
            </span>
            <span className="text-[11px] text-muted-foreground/70 uppercase">Chronicles</span>
          </div>
          <span className="text-foreground/20">/</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {siteStats?.edits?.toLocaleString() ?? "24,190"}
            </span>
            <span className="text-[11px] text-muted-foreground/70 uppercase">Revisions</span>
          </div>
          <span className="text-foreground/20 hidden sm:inline">/</span>
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-semibold text-foreground">82</span>
            <span className="text-[11px] text-muted-foreground/70 uppercase">Nations</span>
          </div>
        </div>

        <Link
          href={withBasePath("/wiki/recent-changes")}
          className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-400 hover:underline uppercase tracking-wider font-semibold"
        >
          <span>Live Dispatch Feed</span>
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </motion.div>
    </div>
  );
}
