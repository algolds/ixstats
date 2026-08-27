"use client";

// src/app/labs/onoma/components/shared/PatternDepthControl.tsx
// Facet Tabs × Apple Design × Emil Kowalski Design Engineering UX for Pattern Depth
// Features: FacetTabs with fluid spring physics, drag gestures, and dynamic proximity color interpolation
// LLM Thought Levels Chromatic System:
//   Level 1: Cyan (#06b6d4) — Fluid / High Variation
//   Level 2: Azure (#0091ff) — Organic / Balanced (Recommended)
//   Level 3: Violet (#8b5cf6) — Faithful / Strong Resonance
//   Level 4: Amber (#f59e0b) — Strict / Corpus Lock
// Philosophy: "Expose the linguistic concept. Hide the implementation."

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Xmark as X } from "iconoir-react";
import { FacetTabs, type FacetTabItem } from "~/components/ui/facet";
import { cn } from "~/lib/utils";

export interface PatternDepthLevel {
  depth: number;
  label: string;
  editorialTier: string;
  tag: string;
  description: string;
  color: string;
  textClassName: string;
  bgClassName: string;
  borderClassName: string;
  dotClassName: string;
}

export const PATTERN_DEPTH_LEVELS: PatternDepthLevel[] = [
  {
    depth: 1,
    label: "Fluid",
    editorialTier: "Fluid",
    tag: "High Variation",
    description:
      "Broad linguistic patterns; high phonetic variation and exploratory sound combinations.",
    color: "#06b6d4",
    textClassName: "text-cyan-600 dark:text-cyan-400",
    bgClassName: "bg-cyan-500/10 dark:bg-cyan-500/15",
    borderClassName: "border-cyan-500/30",
    dotClassName: "bg-cyan-500",
  },
  {
    depth: 2,
    label: "Organic",
    editorialTier: "Organic",
    tag: "Recommended",
    description:
      "Natural linguistic cadence; optimal conlang sweet spot balancing novelty & cohesion.",
    color: "#0091ff",
    textClassName: "text-onoma-primary dark:text-onoma-primary-light",
    bgClassName: "bg-onoma-primary/10 dark:bg-onoma-primary/15",
    borderClassName: "border-onoma-primary/30",
    dotClassName: "bg-onoma-primary",
  },
  {
    depth: 3,
    label: "Faithful",
    editorialTier: "Faithful",
    tag: "Strong Resonance",
    description: "Strong structural fidelity; generates forms closely echoing seed language roots.",
    color: "#8b5cf6",
    textClassName: "text-violet-600 dark:text-violet-400",
    bgClassName: "bg-violet-500/10 dark:bg-violet-500/15",
    borderClassName: "border-violet-500/30",
    dotClassName: "bg-violet-500",
  },
  {
    depth: 4,
    label: "Strict",
    editorialTier: "Strict",
    tag: "Corpus Lock",
    description:
      "High pattern constraints; closely preserves literal word structures from training data.",
    color: "#f59e0b",
    textClassName: "text-amber-600 dark:text-amber-400",
    bgClassName: "bg-amber-500/10 dark:bg-amber-500/15",
    borderClassName: "border-amber-500/30",
    dotClassName: "bg-amber-500",
  },
];

interface PatternDepthControlProps {
  value: number;
  onChange: (depth: number) => void;
  variant?: "segmented" | "slider" | "inspector" | "compact";
  showDescription?: boolean;
  showLabels?: boolean;
  className?: string;
}

export function PatternDepthControl({
  value,
  onChange,
  variant = "segmented",
  showDescription = false,
  showLabels = true,
  className,
}: PatternDepthControlProps) {
  const [showHelp, setShowHelp] = useState(false);
  const currentLevel =
    PATTERN_DEPTH_LEVELS.find((l) => l.depth === value) ?? PATTERN_DEPTH_LEVELS[1]!;

  // Memoize FacetTabs items with chromatic thought level themes
  const depthFacetTabs = useMemo<FacetTabItem[]>(() => {
    return PATTERN_DEPTH_LEVELS.map((level) => {
      const isSelected = level.depth === value;
      return {
        id: String(level.depth),
        label: (
          <span className="flex items-center justify-center gap-1.5 leading-none">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                isSelected ? level.dotClassName : "bg-muted-foreground/35"
              )}
            />
            <span className="font-mono text-xs font-bold">{level.depth}</span>
            <span className="text-[11px] leading-none font-medium tracking-tight">
              {level.editorialTier}
            </span>
          </span>
        ),
        themeColor: level.color,
        activeTextClassName: cn(level.textClassName, "font-semibold"),
      };
    });
  }, [value]);

  // COMPACT STEPPER VARIANT (For tight 2-column grid placements)
  if (variant === "compact") {
    return (
      <div className={cn("space-y-1", className)}>
        {showLabels && (
          <div className="flex items-center gap-1">
            <label className="block text-xs font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
              Pattern Depth
            </label>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="text-muted-foreground/60 hover:text-foreground cursor-pointer"
              title="What is Pattern Depth?"
            >
              <HelpCircle className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex h-9 w-full items-center justify-between rounded-xl border border-zinc-200/85 bg-zinc-100/75 p-1 shadow-2xs select-none dark:border-zinc-700/70 dark:bg-zinc-800/60">
          <button
            type="button"
            onClick={() => onChange(Math.max(1, value - 1))}
            disabled={value <= 1}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white text-xs font-bold text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 active:scale-95 disabled:opacity-30 disabled:shadow-none dark:bg-zinc-700 dark:text-zinc-200"
            title="Broader patterns / higher variation"
          >
            -
          </button>
          <div className="flex items-center gap-1.5 leading-none">
            <span className={cn("font-mono text-xs font-bold", currentLevel.textClassName)}>
              {value}
            </span>
            <span
              className={cn(
                "text-[11px] leading-none font-semibold tracking-tight",
                currentLevel.textClassName
              )}
            >
              {currentLevel.editorialTier}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange(Math.min(4, value + 1))}
            disabled={value >= 4}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white text-xs font-bold text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 active:scale-95 disabled:opacity-30 disabled:shadow-none dark:bg-zinc-700 dark:text-zinc-200"
            title="Deeper patterns / tighter corpus fidelity"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  // PRIMARY FACET TABS CONTROL (For segmented & inspector views)
  return (
    <div className={cn("space-y-1.5", className)}>
      {showLabels && (
        <div className="flex items-center gap-1.5 pb-0.5">
          <label className="text-xs font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
            Pattern Depth
          </label>

          {/* Help / Info Trigger Icon */}
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className={cn(
              "flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-all",
              showHelp
                ? "bg-secondary text-foreground font-bold"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40"
            )}
            title="What is Pattern Depth?"
            aria-label="What is Pattern Depth?"
          >
            <HelpCircle className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Seamless FacetTabs Glass Physics & Dynamic Proximity Color Blending */}
      <FacetTabs
        tabs={depthFacetTabs}
        activeTab={String(value)}
        onChange={(id) => onChange(parseInt(id, 10))}
        size="sm"
        springPreset="fluid"
        tone="neutral"
        className="w-full"
      />

      {/* Expandable Help / Info Card */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="border-border/60 bg-secondary/25 text-muted-foreground space-y-1.5 rounded-xl border p-2.5 text-[11px] backdrop-blur-md">
              <div className="text-foreground flex items-center justify-between font-semibold">
                <span className="text-foreground">About Pattern Depth</span>
                <button
                  type="button"
                  onClick={() => setShowHelp(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="leading-relaxed font-normal">
                Controls the depth of preceding linguistic context used to model and generate forms.
                Higher depth creates tighter fidelity to the seed language, while lower depth
                introduces abstract phonetic variation.
              </p>
              <div className="border-border/30 grid grid-cols-2 gap-1.5 border-t pt-1.5 text-[10.5px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  <span className="font-semibold text-cyan-600 dark:text-cyan-400">1 Fluid:</span>
                  <span>High variation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="bg-onoma-primary h-1.5 w-1.5 rounded-full" />
                  <span className="text-onoma-primary font-semibold">2 Organic:</span>
                  <span>Natural flow (★)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  <span className="font-semibold text-violet-600 dark:text-violet-400">
                    3 Faithful:
                  </span>
                  <span>Strong resonance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    4 Strict:
                  </span>
                  <span>Corpus lock</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Contextual Micro-Description if enabled */}
      {showDescription && !showHelp && (
        <p className="text-muted-foreground animate-in fade-in px-0.5 text-[11px] leading-relaxed font-normal duration-200">
          <strong className={cn("font-semibold", currentLevel.textClassName)}>
            {currentLevel.editorialTier}:
          </strong>{" "}
          {currentLevel.description}
        </p>
      )}
    </div>
  );
}
