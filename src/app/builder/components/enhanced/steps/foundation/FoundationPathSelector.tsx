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
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground active:scale-[0.98]"
          data-cuelume-press
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to starting options
        </Button>

        {/* Segmented Step Indicator with Skip Button */}
        <div className="flex items-center gap-2 rounded-full border border-border/40 bg-card/40 p-1 pl-3.5 text-xs font-semibold backdrop-blur-md select-none">
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Step 1: Benchmark Country
          </span>
          <span className="text-muted-foreground/30">•</span>
          <button
            type="button"
            onClick={onSkipBenchmark}
            className="group flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-all cursor-pointer active:scale-95 shadow-xs shadow-amber-500/10"
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
