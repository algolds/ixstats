"use client";

// src/app/labs/onoma/components/sections/StudioSection.tsx
// Onoma Lab — STUDIO Pillar (Language Construction Environment)
// Features: Model Workshop, Path Visualizer, Name Sets, Sound Shifts, Lexicon Dictionary, Batch Synthesis

import { useStudioState } from "../../hooks/useStudioState";
import { StudioWorkshop } from "./studio/StudioWorkshop";
import { StudioNameSets } from "./studio/StudioNameSets";
import { StudioSoundShifts } from "./studio/StudioSoundShifts";
import { StudioVisualizer } from "./studio/StudioVisualizer";
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
  const state = useStudioState({
    initialWords,
    initialTitle,
    onClearInitial,
    activeSubTab,
    setActiveSubTab,
  });
  const { activeSubTab: currentSubTab } = state;

  return (
    <div className="w-full">
      {currentSubTab === "visualizer" ? (
        <StudioVisualizer state={state} />
      ) : currentSubTab === "namesets" ? (
        <StudioNameSets />
      ) : currentSubTab === "shifts" ? (
        <StudioSoundShifts studioWords={state.trainingWords} />
      ) : (
        <StudioWorkshop state={state} />
      )}
    </div>
  );
}

export default StudioSection;
