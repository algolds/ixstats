"use client";

// src/app/labs/onoma/components/sections/StudioSection.tsx
// Onoma Lab — Custom Markov Chain Studio Workshop (Facet Rebuild)

import { useStudioState } from "../../hooks/useStudioState";
import { StudioWorkshop } from "./studio/StudioWorkshop";
import { StudioNameSets } from "./studio/StudioNameSets";
import { StudioLexicon } from "./studio/StudioLexicon";
import { StudioPhonology } from "./studio/StudioPhonology";
import { StudioSoundShifts } from "./studio/StudioSoundShifts";
import { StudioVisualizer } from "./studio/StudioVisualizer";
import BatchSection from "../sections/BatchSection";
import LinguisticsSection from "./LinguisticsSection";
import { api } from "~/trpc/react";
import { applyFlanking } from "~/lib/onoma/branding-utils";
import type { StudioSubTab } from "~/lib/onoma/types";

interface StudioSectionProps {
  initialWords?: string[];
  initialTitle?: string;
  onClearInitial?: () => void;
  activeSubTab?: StudioSubTab;
  setActiveSubTab?: (tab: StudioSubTab) => void;
}

export function StudioSection({
  initialWords,
  initialTitle,
  onClearInitial,
  activeSubTab,
  setActiveSubTab,
}: StudioSectionProps = {}) {
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery();
  const state = useStudioState({
    initialWords,
    initialTitle,
    onClearInitial,
    activeSubTab,
    setActiveSubTab,
  });
  const { activeSubTab: currentSubTab } = state;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-border/40 space-y-1 border-b pb-4">
        <h2
          className="text-foreground text-xl font-bold tracking-tight"
          style={{
            fontFamily: speechConfig?.brand?.fontFamily
              ? `'${speechConfig.brand.fontFamily}', sans-serif`
              : undefined,
          }}
        >
          {applyFlanking("Onoma Studio", speechConfig?.brand?.flankingStyle)}
        </h2>
        <p className="text-muted-foreground text-sm">
          Import your own lexicons and linguistic data, simulate historical sound shifts, or leverage our
          ever-growing collection of real-world cultural datasets to create names that feel authentic and resonant.
        </p>
      </div>

      {currentSubTab === "workshop" ? (
        <StudioWorkshop state={state} />
      ) : currentSubTab === "visualizer" ? (
        <StudioVisualizer state={state} />
      ) : currentSubTab === "namesets" ? (
        <StudioNameSets />
      ) : currentSubTab === "phonology" ? (
        <StudioPhonology />
      ) : currentSubTab === "shifts" ? (
        <StudioSoundShifts />
      ) : currentSubTab === "batch" ? (
        <BatchSection />
      ) : currentSubTab === "linguistics" ? (
        <LinguisticsSection />
      ) : (
        <StudioLexicon state={state} />
      )}
    </div>
  );
}

export default StudioSection;
