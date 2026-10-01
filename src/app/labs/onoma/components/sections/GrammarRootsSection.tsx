"use client";

// src/app/labs/onoma/components/sections/GrammarRootsSection.tsx
// Onoma Lab — Unified Grammar & Roots (Root Word Derivations & Syntactic Sentence Builder)

import React, { useState } from "react";
import { GitFork, ControlSlider as SlidersHorizontal } from "iconoir-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import EtymologySection from "./EtymologySection";
import SyntaxSection from "./SyntaxSection";

export type GrammarMode = "roots" | "syntax";

export function GrammarRootsSection() {
  const [mode, setMode] = useState<GrammarMode>("roots");
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="border-separator flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-label text-body font-semibold">
            {mode === "roots"
              ? "Etymological Web & Root Derivations"
              : "Syntactic Sandbox & Sentence Grammar"}
          </h2>
          <p className="text-label-secondary text-footnote leading-normal">
            {mode === "roots"
              ? "Track word roots, prefixes, suffixes, semantic shifts, and construct a morphological derivation tree."
              : "Define sentence structure (SOV, SVO, VSO), word order, adposition rules, and compile syntax sentences."}
          </p>
        </div>

        {/* Apple Segmented Switcher */}
        <div className="border-separator bg-fill-4 rounded-row shadow-card flex shrink-0 items-center gap-1 self-start border p-1 select-none sm:self-center">
          <button
            type="button"
            onClick={() => setMode("roots")}
            className={cn(
              "rounded-control text-footnote flex cursor-pointer items-center gap-1.5 px-3 py-1.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95",
              mode === "roots"
                ? "bg-background text-label shadow-card font-semibold"
                : "text-label-secondary hover:text-label"
            )}
          >
            <GitFork className="text-indigo h-3.5 w-3.5" />
            <span>Root Derivations</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("syntax")}
            className={cn(
              "rounded-control text-footnote flex cursor-pointer items-center gap-1.5 px-3 py-1.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95",
              mode === "syntax"
                ? "bg-background text-label shadow-card font-semibold"
                : "text-label-secondary hover:text-label"
            )}
          >
            <SlidersHorizontal className="text-tint h-3.5 w-3.5" />
            <span>Sentence Grammar</span>
          </button>
        </div>
      </div>

      {/* Content Canvas */}
      <motion.div
        key={mode}
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        {mode === "roots" ? <EtymologySection /> : <SyntaxSection />}
      </motion.div>
    </div>
  );
}

export default GrammarRootsSection;
