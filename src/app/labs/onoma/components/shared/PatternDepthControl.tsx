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
import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, Xmark as X } from "iconoir-react";
import { FacetTabs, type FacetTabItem } from "~/components/ui/facet";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";

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
    textClassName: "text-teal",
    bgClassName: "bg-teal/10",
    borderClassName: "border-teal/30",
    dotClassName: "bg-teal",
  },
  {
    depth: 2,
    label: "Organic",
    editorialTier: "Organic",
    tag: "Recommended",
    description:
      "Natural linguistic cadence; optimal conlang sweet spot balancing novelty & cohesion.",
    color: "#0091ff",
    textClassName: "text-tint",
    bgClassName: "bg-tint/10",
    borderClassName: "border-tint/30",
    dotClassName: "bg-tint",
  },
  {
    depth: 3,
    label: "Faithful",
    editorialTier: "Faithful",
    tag: "Strong Resonance",
    description: "Strong structural fidelity; generates forms closely echoing seed language roots.",
    color: "#6366f1",
    textClassName: "text-indigo",
    bgClassName: "bg-indigo/10",
    borderClassName: "border-indigo/30",
    dotClassName: "bg-indigo",
  },
  {
    depth: 4,
    label: "Strict",
    editorialTier: "Strict",
    tag: "Corpus Lock",
    description:
      "High pattern constraints; closely preserves literal word structures from training data.",
    color: "#f59e0b",
    textClassName: "text-yellow",
    bgClassName: "bg-yellow/10",
    borderClassName: "border-yellow/30",
    dotClassName: "bg-yellow",
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
          <span className="flex items-center justify-center gap-2 leading-none">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                isSelected ? level.dotClassName : "bg-label-secondary"
              )}
            />
            <span className="text-footnote font-mono font-semibold">{level.depth}</span>
            <span className="text-caption leading-none font-medium">{level.editorialTier}</span>
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
            <label className="text-footnote text-label block font-semibold">Pattern Depth</label>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowHelp(!showHelp)}
              title="What is Pattern Depth?"
              aria-label="What is Pattern Depth?"
              className="text-label-tertiary hover:text-label"
            >
              <HelpCircle className="h-3 w-3" />
            </Button>
          </div>
        )}
        <div className="rounded-row border-separator bg-fill-4 shadow-card flex h-9 w-full items-center justify-between border p-1 select-none">
          <Button
            variant="secondary"
            size="icon-sm"
            type="button"
            onClick={() => onChange(Math.max(1, value - 1))}
            disabled={value <= 1}
            className="w-7 justify-center"
            title="Broader patterns / higher variation"
          >
            -
          </Button>
          <div className="flex items-center gap-2 leading-none">
            <span
              className={cn("text-footnote font-mono font-semibold", currentLevel.textClassName)}
            >
              {value}
            </span>
            <span
              className={cn("text-caption leading-none font-semibold", currentLevel.textClassName)}
            >
              {currentLevel.editorialTier}
            </span>
          </div>
          <Button
            variant="secondary"
            size="icon-sm"
            type="button"
            onClick={() => onChange(Math.min(4, value + 1))}
            disabled={value >= 4}
            className="w-7 justify-center"
            title="Deeper patterns / tighter corpus fidelity"
          >
            +
          </Button>
        </div>
      </div>
    );
  }

  // PRIMARY FACET TABS CONTROL (For segmented & inspector views)
  return (
    <div className={cn("space-y-2", className)}>
      {showLabels && (
        <div className="flex items-center gap-2 pb-0.5">
          <label className="text-footnote text-label font-semibold">Pattern Depth</label>

          {/* Help / Info Trigger Icon */}
          <Toggle
            size="sm"
            pressed={showHelp}
            onPressedChange={setShowHelp}
            className="text-label-tertiary min-w-0 rounded-full px-1"
            title="What is Pattern Depth?"
            aria-label="What is Pattern Depth?"
          >
            <HelpCircle className="h-3 w-3" />
          </Toggle>
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
            <div className="border-separator bg-fill-3 text-label-secondary rounded-row text-caption space-y-2 border p-3">
              <div className="text-label flex items-center justify-between font-semibold">
                <span className="text-label">About Pattern Depth</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowHelp(false)}
                  aria-label="Close help"
                  className="text-label-secondary hover:text-label"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="leading-relaxed font-normal">
                Controls the depth of preceding linguistic context used to model and generate forms.
                Higher depth creates tighter fidelity to the seed language, while lower depth
                introduces abstract phonetic variation.
              </p>
              <div className="border-separator text-caption grid grid-cols-2 gap-2 border-t pt-2">
                <div className="flex items-center gap-2">
                  <span className="bg-teal h-1.5 w-1.5 rounded-full" />
                  <span className="text-teal font-semibold">1 Fluid:</span>
                  <span>High variation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-tint h-1.5 w-1.5 rounded-full" />
                  <span className="text-tint font-semibold">2 Organic:</span>
                  <span>Natural flow (★)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo h-1.5 w-1.5 rounded-full" />
                  <span className="text-indigo font-semibold">3 Faithful:</span>
                  <span>Strong resonance</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-yellow h-1.5 w-1.5 rounded-full" />
                  <span className="text-yellow font-semibold">4 Strict:</span>
                  <span>Corpus lock</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Contextual Micro-Description if enabled */}
      {showDescription && !showHelp && (
        <p className="text-label-secondary animate-in fade-in text-caption px-0.5 leading-relaxed font-normal duration-200">
          <strong className={cn("font-semibold", currentLevel.textClassName)}>
            {currentLevel.editorialTier}:
          </strong>{" "}
          {currentLevel.description}
        </p>
      )}
    </div>
  );
}
