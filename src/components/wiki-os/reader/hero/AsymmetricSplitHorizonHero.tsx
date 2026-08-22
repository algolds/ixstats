"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { Search, Shuffle, ArrowRight, Sparkles, BookOpen, Compass, Shield } from "lucide-react";
import { motion, useMotionValue, useTransform, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { WikiOSWordmark } from "~/components/wiki-os/shared/WikiOSWordmark";
import type { WikiHeroProps } from "./types";

export function AsymmetricSplitHorizonHero({
  siteStats,
  onOpenSearch,
}: WikiHeroProps) {
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  // Pointer tracking for 3D card tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-100, 100], [6, -6]);
  const rotateY = useTransform(mouseX, [-100, 100], [-6, 6]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
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
    <div className="w-full max-w-6xl mx-auto py-8 sm:py-12 px-4 select-none">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* ── Left Column: Brand Thesis & Actions (col-span-7) ── */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7 flex flex-col items-start text-left gap-4"
        >
          {/* Brand Lockup Row */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 shadow-md backdrop-blur-md">
              <WikiOSLogomark className="h-6 w-auto text-zinc-900 dark:text-zinc-100" />
            </div>
            <div className="flex flex-col">
              <WikiOSWordmark className="h-4.5 w-auto text-zinc-900 dark:text-zinc-100" />
              <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                EST. MMIII · V1.4
              </span>
            </div>
          </div>

          {/* Editorial Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            The living canonical encyclopedia of sovereign lore.
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
            Over {siteStats?.articles?.toLocaleString() ?? "14,800"} documented articles spanning 82 sovereign nations, geopolitical treaties, dynasties, and historical chronicles.
          </p>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3 pt-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSearchClick}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-full",
                "bg-foreground text-background font-semibold text-xs",
                "hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer"
              )}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search Archive (⌘K)</span>
            </button>

            <Link
              href={withBasePath("/wiki/random")}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium",
                "border border-border bg-background/60 hover:bg-foreground/[0.04] text-foreground",
                "transition-all active:scale-95 shadow-xs"
              )}
            >
              <Shuffle className="h-3.5 w-3.5 text-indigo-500" />
              <span>Random Chronicle</span>
            </Link>
          </div>
        </motion.div>

        {/* ── Right Column: 3D Refraction Featured Tome Card (col-span-5) ── */}
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={reduceMotion ? {} : { rotateX, rotateY, transformStyle: "preserve-3d" }}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 relative"
        >
          {/* Ambient Glow */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-blue-500/20 via-purple-500/15 to-transparent blur-xl opacity-75" />

          {/* 3D Glass Artifact Card */}
          <div
            className={cn(
              "relative flex flex-col justify-between p-6 rounded-3xl",
              "border border-white/20 dark:border-white/10",
              "bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl",
              "shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_16px_48px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_20px_56px_rgba(0,0,0,0.6)]"
            )}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground uppercase">
                  ACTIVE TELEMETRY
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                82 REALMS
              </span>
            </div>

            <div className="flex flex-col gap-2 mb-5">
              <div className="flex items-center gap-2 text-blue-500 text-xs font-semibold">
                <BookOpen className="h-3.5 w-3.5" />
                <span>Featured Repository</span>
              </div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                The Great Cartography & Lore Archive
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Explore thousands of cross-referenced historical documents, treaty transcripts, and geopolitical records curated across 20+ years.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase font-mono">Total Edits</span>
                <span className="font-bold text-foreground">{siteStats?.edits?.toLocaleString() ?? "24,190"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase font-mono">Articles</span>
                <span className="font-bold text-foreground">{siteStats?.articles?.toLocaleString() ?? "14,821"}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
