"use client";

// src/app/labs/onoma/components/sections/GrammarRootsSection.tsx
// Onoma Lab — Unified Grammar & Roots (Root Word Derivations & Syntactic Sentence Builder)

import React, { useState } from "react";
import { GitFork, ControlSlider as SlidersHorizontal } from "iconoir-react";
import { motion, useReducedMotion } from "framer-motion";
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h2 className="text-foreground text-base font-bold tracking-tight">
            {mode === "roots" ? "Etymological Web & Root Derivations" : "Syntactic Sandbox & Sentence Grammar"}
          </h2>
          <p className="text-muted-foreground text-xs leading-normal">
            {mode === "roots"
              ? "Track word roots, prefixes, suffixes, semantic shifts, and construct a morphological derivation tree."
              : "Define sentence structure (SOV, SVO, VSO), word order, adposition rules, and compile syntax sentences."}
          </p>
        </div>

        {/* Apple Segmented Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-secondary/20 p-1 select-none shadow-2xs shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setMode("roots")}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
              mode === "roots"
                ? "bg-background text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GitFork className="h-3.5 w-3.5 text-purple-500" />
            <span>Root Derivations</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("syntax")}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
              mode === "syntax"
                ? "bg-background text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-fuchsia-500" />
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
