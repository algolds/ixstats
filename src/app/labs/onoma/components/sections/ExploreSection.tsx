"use client";

// src/app/labs/onoma/components/sections/ExploreSection.tsx
// Onoma Lab — EXPLORE Pillar (Language Analysis & Understanding Environment — Pure Reference)
// Features: Acoustics & IPA (with Profile Diff), Grammar & Roots, Writing Systems, Community Packs

import type { ExploreSubTab } from "~/lib/onoma/types";

import { StudioPhonology } from "./studio/StudioPhonology";
import { GrammarRootsSection } from "./GrammarRootsSection";
import WritingSection from "./WritingSection";
import LanguagePacksSection from "./LanguagePacksSection";

interface ExploreSectionProps {
  activeSubTab?: ExploreSubTab;
  setActiveSubTab?: (tab: ExploreSubTab) => void;
  onLoadToStudio?: (words: string[], title: string) => void;
  studioWords?: string[];
}

export function ExploreSection({
  activeSubTab = "phonology",
  setActiveSubTab: _setActiveSubTab,
  onLoadToStudio,
  studioWords = [],
}: ExploreSectionProps = {}) {
  return (
    <div className="w-full">
      {activeSubTab === "phonology" ? (
        <StudioPhonology studioWords={studioWords} />
      ) : activeSubTab === "grammar" ? (
        <GrammarRootsSection />
      ) : activeSubTab === "writing" ? (
        <WritingSection studioWords={studioWords} />
      ) : (
        <LanguagePacksSection
          onLoadToStudio={(title, words) => onLoadToStudio?.(words, title)}
        />
      )}
    </div>
  );
}

export default ExploreSection;
