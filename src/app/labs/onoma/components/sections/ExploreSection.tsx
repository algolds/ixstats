"use client";

// src/app/labs/onoma/components/sections/ExploreSection.tsx
// Onoma Lab — EXPLORE Pillar (Language Analysis & Understanding Environment)
// Features: Acoustics & IPA, Etymological Web, Syntax & Grammar, Writing Systems, Loanwords, Comparator

import { TextureOverlay } from "~/components/ui/texture-overlay";
import { api } from "~/trpc/react";
import { applyFlanking } from "~/lib/onoma/branding-utils";
import type { ExploreSubTab } from "~/lib/onoma/types";

import { StudioPhonology } from "./studio/StudioPhonology";
import EtymologySection from "./EtymologySection";
import SyntaxSection from "./SyntaxSection";
import WritingSection from "./WritingSection";
import LoanwordsSection from "./LoanwordsSection";
import ComparatorSection from "./ComparatorSection";
import LanguagePacksSection from "./LanguagePacksSection";

interface ExploreSectionProps {
  activeSubTab?: ExploreSubTab;
  setActiveSubTab?: (tab: ExploreSubTab) => void;
  onLoadToStudio?: (words: string[], title: string) => void;
}

export function ExploreSection({
  activeSubTab = "phonology",
  setActiveSubTab: _setActiveSubTab,
  onLoadToStudio,
}: ExploreSectionProps = {}) {
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery();

  return (
    <div className="space-y-5">
      {/* Pillar Context Header Card with subtle colors and light specular line */}
      <div className="relative overflow-hidden rounded-xl border border-violet-500/20 bg-violet-500/[0.04] dark:bg-violet-500/[0.08] p-4 sm:p-5 shadow-xs">
        {/* Specular top edge highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-violet-500/40 via-violet-400/25 to-transparent" />


        <div className="relative z-10 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              className="text-foreground text-xl font-bold tracking-tight"
              style={{
                fontFamily: speechConfig?.brand?.fontFamily
                  ? `'${speechConfig.brand.fontFamily}', sans-serif`
                  : undefined,
              }}
            >
              {applyFlanking("Onoma Explore", speechConfig?.brand?.flankingStyle)}
            </h2>
            <span className="font-mono text-xs text-violet-600 dark:text-violet-400 font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
              EXPLORE · F₁ vs F₂ · σ · #_ · V_V
            </span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-3xl leading-relaxed">
            Inspect underlying linguistic mechanics: acoustic formants, grapheme-to-phoneme rules, etymological root trees, syntax structures, and community language packs.
          </p>
        </div>
      </div>


      {activeSubTab === "phonology" ? (
        <StudioPhonology />
      ) : activeSubTab === "etymology" ? (
        <EtymologySection />
      ) : activeSubTab === "syntax" ? (
        <SyntaxSection />
      ) : activeSubTab === "writing" ? (
        <WritingSection />
      ) : activeSubTab === "loanwords" ? (
        <LoanwordsSection />
      ) : activeSubTab === "packs" ? (
        <LanguagePacksSection
          onLoadToStudio={(title, words) => onLoadToStudio?.(words, title)}
        />
      ) : (
        <ComparatorSection />
      )}
    </div>
  );
}

export default ExploreSection;
