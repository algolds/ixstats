"use client";

// src/app/labs/onoma/components/sections/OverviewBanner.tsx
// Onoma Lab — Contextual Overview Intro Bar (⟨ONOMA⟩ Linguistic Engine)
// Graphic Language: sound → structure → pattern → vocabulary → culture → history

import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";

export function OverviewBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-secondary/[0.03] p-4 text-xs transition-all duration-200 sm:flex-row sm:items-center sm:justify-between">
      {/* Contextual Tagline & Description */}
      <div className="space-y-1.5 max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs sm:text-sm font-semibold text-foreground tracking-tight">
            Language, engineered.{" "}
            <span className="text-muted-foreground font-normal">
              Build the language behind your world.
            </span>
          </p>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          A computational environment for phonological modeling,{" "}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline cursor-help items-baseline font-semibold text-foreground underline decoration-[#0091ff]/60 decoration-dotted underline-offset-4 transition-colors hover:text-[#0091ff] focus:outline-none"
              >
                Markov transition networks
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="start"
              className="max-w-sm space-y-1.5 p-3 text-xs leading-relaxed shadow-xl border border-border/60 bg-popover text-popover-foreground"
            >
              <p className="font-semibold text-foreground">
                Statistical N-Gram Language Modeling
              </p>
              <p className="text-muted-foreground">
                Markov chains model the character and syllable transition matrices of training lexicons, ensuring structural and phonotactic naturalism.
              </p>
            </TooltipContent>
          </Tooltip>
          , syllable templates, acoustic vowel spectra, and historical sound shifts.
        </p>
      </div>

      {/* Progression Chain Pill */}
      <div className="flex flex-col sm:items-end gap-1 shrink-0 select-none">
        <span className="rounded-md border border-[#0091ff]/20 bg-[#0091ff]/5 px-2 py-1 font-mono text-[10px] font-semibold text-[#0091ff] tracking-tight">
          sound → structure → pattern → vocabulary → history
        </span>
        <span className="text-[10px] text-muted-foreground/70 font-mono tracking-wider uppercase">
          ⟨ONOMA⟩ Linguistic Engine
        </span>
      </div>
    </div>
  );
}

export default OverviewBanner;
