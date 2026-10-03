"use client";

import React from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { CountrySelector } from "../../CountrySelector";
import type { RealCountryData } from "~/types/builder";
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
      {/* The page title for this sub-step (the hero's visible h1 is gone once a path is chosen). */}
      <h1 className="sr-only">Choose a benchmark country</h1>
      <div className="flex shrink-0 flex-col gap-3 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToHero}
          className="text-footnote text-label-secondary hover:text-label flex items-center gap-2"
          data-cuelume-press
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to starting options
        </Button>

        {/* Segmented Step Indicator with Skip Button */}
        <div className="border-separator bg-surface text-caption flex items-center gap-2 rounded-full border p-1 pl-4 font-semibold select-none">
          <span className="text-tint flex items-center gap-2">
            <span className="bg-tint h-2 w-2 rounded-full" />
            Step 1: Benchmark Country
          </span>
          <span className="text-label-tertiary">•</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onSkipBenchmark}
            className="group rounded-full"
            title="Skip benchmark country and choose an archetype directly"
          >
            <span>Skip to Step 2: Archetype</span>
            <ArrowRight
              aria-hidden
              className="duration-fast ease-out-facet transition-[translate] motion-safe:group-hover:translate-x-0.5 motion-safe:group-focus-visible:translate-x-0.5"
            />
          </Button>
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
