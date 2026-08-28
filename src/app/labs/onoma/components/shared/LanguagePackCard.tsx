"use client";

import { BookmarkBook, GitFork, Star, Translate } from "iconoir-react";

// src/app/labs/onoma/components/shared/LanguagePackCard.tsx
// Onoma Lab — Tactile 3D Language Pack Card (Vault-Style Spatial Physics & Facet Material)

import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export interface LanguagePack {
  id: string;
  name: string;
  description: string | null;
  authorId?: string | null;
  authorName?: string | null;
  culturalFamily: string;
  ratingAvg: number;
  ratingCount: number;
  forkCount?: number;
  isOfficial?: boolean;
  tags: string[];
  phonologyRules?: any;
  morphologyRules?: any;
  createdAt?: string | Date;
}

interface LanguagePackCardProps {
  pack: LanguagePack;
  isSelected?: boolean;
  onSelect?: (pack: LanguagePack) => void;
  onFork?: (pack: LanguagePack) => void;
  isForking?: boolean;
}

const FAMILY_THEMES: Record<string, { border: string; glow: string; bg: string; text: string }> = {
  latin: {
    border: "border-amber-500/40",
    glow: "rgba(245, 158, 11, 0.25)",
    bg: "from-amber-500/10 via-amber-500/5 to-transparent",
    text: "text-amber-500",
  },
  germanic: {
    border: "border-sky-500/40",
    glow: "rgba(14, 165, 233, 0.25)",
    bg: "from-sky-500/10 via-sky-500/5 to-transparent",
    text: "text-sky-400",
  },
  celtic: {
    border: "border-emerald-500/40",
    glow: "rgba(16, 185, 129, 0.25)",
    bg: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    text: "text-emerald-400",
  },
  slavic: {
    border: "border-rose-500/40",
    glow: "rgba(244, 63, 94, 0.25)",
    bg: "from-rose-500/10 via-rose-500/5 to-transparent",
    text: "text-rose-400",
  },
  "east-asian": {
    border: "border-red-500/40",
    glow: "rgba(239, 68, 68, 0.25)",
    bg: "from-red-500/10 via-red-500/5 to-transparent",
    text: "text-red-400",
  },
  persian: {
    border: "border-teal-500/40",
    glow: "rgba(20, 184, 166, 0.25)",
    bg: "from-teal-500/10 via-teal-500/5 to-transparent",
    text: "text-teal-400",
  },
  constructed: {
    border: "border-purple-500/40",
    glow: "rgba(168, 85, 247, 0.25)",
    bg: "from-purple-500/10 via-purple-500/5 to-transparent",
    text: "text-purple-400",
  },
  default: {
    border: "border-onoma-primary/40",
    glow: "rgba(0, 145, 255, 0.25)",
    bg: "from-onoma-primary/10 via-onoma-primary/5 to-transparent",
    text: "text-onoma-primary",
  },
};

export function LanguagePackCard({
  pack,
  isSelected = false,
  onSelect,
  onFork,
  isForking = false,
}: LanguagePackCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D tactile physics springs
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-100, 100], [10, -10]), {
    stiffness: 140,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(x, [-100, 100], [-10, 10]), {
    stiffness: 140,
    damping: 18,
  });
  const scale = useSpring(1, { stiffness: 140, damping: 18 });
  const translateY = useSpring(0, { stiffness: 140, damping: 18 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseEnter = () => {
    scale.set(1.025);
    translateY.set(-6);
  };

  const handleMouseLeave = () => {
    scale.set(1);
    translateY.set(0);
    x.set(0);
    y.set(0);
  };

  const familyKey = (pack.culturalFamily || "").toLowerCase();
  const theme = FAMILY_THEMES[familyKey] || FAMILY_THEMES.default;

  return (
    <div className="group relative flex w-full flex-col items-center select-none">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => onSelect?.(pack)}
        className={cn(
          "relative flex h-full min-h-[300px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border p-4.5 shadow-lg backdrop-blur-xl transition-all",
          "bg-background/80 hover:shadow-2xl",
          theme.border,
          isSelected &&
            "ring-offset-background shadow-[0_0_24px_var(--glow)] ring-2 ring-amber-500/60 ring-offset-2"
        )}
        style={{
          transformStyle: "preserve-3d",
          rotateX,
          rotateY,
          scale,
          y: translateY,
          perspective: "1000px",
          ["--glow" as string]: theme.glow,
        }}
      >
        {/* Dynamic theme glow background */}
        <div
          className={cn(
            "absolute inset-0 -z-10 bg-gradient-to-b opacity-60 transition-opacity duration-300 group-hover:opacity-100",
            theme.bg
          )}
        />

        {/* Card Header: Category Badge + Rating */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className={cn(
              "border px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider uppercase",
              theme.text,
              theme.border,
              "bg-secondary/40 backdrop-blur-md"
            )}
          >
            {pack.culturalFamily}
          </Badge>

          <div className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-500">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>{pack.ratingAvg > 0 ? pack.ratingAvg.toFixed(1) : "New"}</span>
            {pack.ratingCount > 0 && (
              <span className="text-muted-foreground text-[9px] font-normal">
                ({pack.ratingCount})
              </span>
            )}
          </div>
        </div>

        {/* Card Body / Emblem & Typography */}
        <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
          <div
            className={cn(
              "mb-3 rounded-2xl border bg-black/10 p-3.5 shadow-inner backdrop-blur-md dark:bg-black/40",
              theme.border
            )}
          >
            <BookmarkBook className={cn("h-7 w-7", theme.text)} />
          </div>

          <h3 className="text-foreground line-clamp-1 text-sm font-bold tracking-tight">
            {pack.name}
          </h3>

          {pack.authorName && (
            <span className="text-muted-foreground mt-0.5 font-mono text-[10px]">
              by @{pack.authorName}
            </span>
          )}

          <p className="text-muted-foreground mt-2 line-clamp-2 max-w-[260px] text-xs leading-relaxed">
            {pack.description ||
              "Comprehensive phonological rules, syllabic weights, and lexicon seeds."}
          </p>

          {/* Tags */}
          {pack.tags && pack.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1">
              {pack.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="bg-secondary/40 text-muted-foreground border-border/40 py-0.2 rounded border px-1.5 font-mono text-[9px]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card Footer: Action Buttons */}
        <div className="border-border/40 mt-1 flex w-full items-center gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(pack);
            }}
            className="border-border/60 bg-background/80 hover:bg-background text-foreground h-8 flex-1 rounded-xl text-xs font-semibold"
          >
            <Translate className="text-muted-foreground mr-1 h-3.5 w-3.5" />
            <span>Inspect</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isForking}
            onClick={(e) => {
              e.stopPropagation();
              onFork?.(pack);
            }}
            className="bg-onoma-primary hover:bg-onoma-primary-light h-8 flex-1 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-95"
          >
            <GitFork className="mr-1 h-3.5 w-3.5" />
            <span>Fork Pack</span>
          </Button>
        </div>
      </motion.div>

      {/* Grounding soft shadow */}
      <div className="pointer-events-none mt-2 h-1.5 w-40 rounded-full bg-black/20 blur-[5px] dark:bg-black/50" />
    </div>
  );
}
