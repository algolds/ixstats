"use client";

import React from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { CountrySelector } from "../../CountrySelector";
import type { RealCountryData } from "~/app/builder/lib/economy-types";
import { stepVariants } from "./foundationUtils";

interface FoundationPathSelectorProps {
  countries: RealCountryData[];
  transitionDirection: number;
  onBackToHero: () => void;
  onSkipBenchmark: () => void;
  onCountrySelect: (country: RealCountryData) => void;
  onBackToIntro?: () => void;
  onCreateFromScratch: () => void;
}

export function FoundationPathSelector({
  countries,
  transitionDirection,
  onBackToHero,
  onSkipBenchmark,
  onCountrySelect,
  onBackToIntro,
  onCreateFromScratch,
}: FoundationPathSelectorProps) {
  return (
    <motion.div
      key="substep-benchmark"
      custom={transitionDirection}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="w-full space-y-3"
    >
      <div className="flex shrink-0 flex-col gap-3 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToHero}
          className="text-footnote text-label-secondary hover:text-label flex items-center gap-1.5 active:scale-[0.98]"
          data-cuelume-press
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to starting options
        </Button>

        {/* Segmented Step Indicator with Skip Button */}
        <div className="border-separator bg-surface text-caption flex items-center gap-2 rounded-full border p-1 pl-3.5 font-semibold select-none">
          <span className="text-tint flex items-center gap-1.5">
            <span className="bg-tint h-2 w-2 rounded-full" />
            Step 1: Benchmark Country
          </span>
          <span className="text-label-tertiary">•</span>
          <button
            type="button"
            onClick={onSkipBenchmark}
            className="group border-tint/30 bg-tint-fill text-caption text-tint hover:bg-tint-hover hover:text-tint-hover shadow-card flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95"
            title="Skip benchmark country and choose an archetype directly"
            data-cuelume-press
          >
            <span>Skip to Step 2: Archetype</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      <CountrySelector
        countries={countries}
        onCountrySelect={onCountrySelect}
        onBackToIntro={onBackToIntro}
        onCreateFromScratch={onCreateFromScratch}
      />
    </motion.div>
  );
}
