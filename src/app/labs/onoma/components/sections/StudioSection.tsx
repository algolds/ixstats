"use client";

// src/app/labs/onoma/components/sections/StudioSection.tsx
// Onoma Lab — STUDIO Pillar (Language Construction Environment)
// Features: Model Workshop, Path Visualizer, Name Sets, Sound Shifts, Lexicon Dictionary, Batch Synthesis

import { useStudioState } from "../../hooks/useStudioState";
import { StudioWorkshop } from "./studio/StudioWorkshop";
import { StudioNameSets } from "./studio/StudioNameSets";
import { StudioLexicon } from "./studio/StudioLexicon";
import { StudioSoundShifts } from "./studio/StudioSoundShifts";
import { StudioVisualizer } from "./studio/StudioVisualizer";
import BatchSection from "../sections/BatchSection";
import { TextureOverlay } from "~/components/ui/texture-overlay";
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
      {/* Pillar Context Header Card with subtle colors and light specular line */}
      <div className="relative overflow-hidden rounded-xl border border-pink-500/20 bg-pink-500/[0.04] dark:bg-pink-500/[0.08] p-4 sm:p-5 shadow-xs">
        {/* Specular top edge highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-pink-500/40 via-pink-400/25 to-transparent" />


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
              {applyFlanking("Onoma Studio", speechConfig?.brand?.flankingStyle)}
            </h2>
            <span className="font-mono text-xs text-pink-600 dark:text-pink-400 font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/20">
              STUDIO · X → Y / V_V · P(x|w)
            </span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-3xl leading-relaxed">
            Construct and evolve language machinery: train Markov models on custom lexicons, build multi-part name sets, simulate historical sound change rules, and derive batch matrices.
          </p>
        </div>
      </div>


      {currentSubTab === "workshop" ? (
        <StudioWorkshop state={state} />
      ) : currentSubTab === "visualizer" ? (
        <StudioVisualizer state={state} />
      ) : currentSubTab === "namesets" ? (
        <StudioNameSets />
      ) : currentSubTab === "shifts" ? (
        <StudioSoundShifts />
      ) : currentSubTab === "batch" ? (
        <BatchSection />
      ) : (
        <StudioLexicon state={state} />
      )}
    </div>
  );
}

export default StudioSection;
