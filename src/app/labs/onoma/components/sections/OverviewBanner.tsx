"use client";

// src/app/labs/onoma/components/sections/OverviewBanner.tsx
// Onoma Lab — Contextual Overview Intro Bar (⟨ONOMA⟩ Linguistic Engine)

import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";

interface OverviewBannerProps {
  speechConfig?: any;
  playPronunciation?: () => void;
  isHeroHovered?: boolean;
  setIsHeroHovered?: (hovered: boolean) => void;
  publicDictsCount?: number;
  stashedCount?: number;
}

export function OverviewBanner({
  speechConfig: _speechConfig,
  playPronunciation: _playPronunciation,
  isHeroHovered: _isHeroHovered,
  setIsHeroHovered: _setIsHeroHovered,
  publicDictsCount: _publicDictsCount,
  stashedCount: _stashedCount,
}: OverviewBannerProps) {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/40 bg-secondary/[0.03] p-4 text-xs transition-all duration-200">
      {/* Contextual Tagline & Description */}
      <div className="space-y-1 max-w-2xl">
        <p className="text-xs sm:text-sm font-medium text-foreground tracking-tight">
          Language, engineered.{" "}
          <span className="text-muted-foreground font-normal">
            Build the language behind your world.
          </span>
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          A computational environment for phonology,{" "}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline cursor-help items-baseline font-semibold text-foreground underline decoration-[#0091ff]/60 decoration-dotted underline-offset-4 transition-colors hover:text-[#0091ff] focus:outline-none"
              >
                language modeling
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
                A Markov model analyzes the character, syllable, and phonotactic transition probabilities of a training lexicon.
              </p>
              <p className="text-muted-foreground">
                Instead of arbitrary generation, it computes mathematical probabilities — preserving authentic cultural flavor with 0% AI hallucination.
              </p>
            </TooltipContent>
          </Tooltip>
          , lexicon construction, and historical sound change.
        </p>
      </div>

      {/* Subtle Disclaimer Pill */}
      <div className="text-muted-foreground/60 flex items-center gap-1.5 shrink-0 select-none text-[11px]">
        <Info className="h-3.5 w-3.5 shrink-0 text-[#0091ff]/50" />
        <span>Deterministic linguistic engine · 0% LLM</span>
      </div>
    </div>
  );
}

export default OverviewBanner;
