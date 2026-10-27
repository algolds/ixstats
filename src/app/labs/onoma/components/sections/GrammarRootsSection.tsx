"use client";

// src/app/labs/onoma/components/sections/GrammarRootsSection.tsx
// Onoma Lab — Unified Grammar & Roots (Root Word Derivations & Syntactic Sentence Builder)

import React, { useState } from "react";
import { GitFork, ControlSlider as SlidersHorizontal } from "iconoir-react";
import { motion, useReducedMotion } from "motion/react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import EtymologySection from "./EtymologySection";
import SyntaxSection from "./SyntaxSection";

type GrammarMode = "roots" | "syntax";

export function GrammarRootsSection() {
  const [mode, setMode] = useState<GrammarMode>("roots");
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="space-y-6">
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

        <SegmentedControl
          asTabs
          aria-label="Grammar workspace"
          className="shrink-0 self-start sm:self-center"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "roots", label: "Root derivations", icon: <GitFork /> },
            { value: "syntax", label: "Sentence grammar", icon: <SlidersHorizontal /> },
          ]}
        />
      </div>

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
