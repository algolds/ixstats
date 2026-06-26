"use client";

// src/app/labs/onoma/components/sections/StudioSection.tsx
// Onoma Lab — Custom Markov Chain Studio Workshop (Facet Rebuild)

import { useStudioState } from "../../hooks/useStudioState";
import { StudioWorkshop } from "./studio/StudioWorkshop";
import { StudioLexicon } from "./studio/StudioLexicon";

interface StudioSectionProps {
  initialWords?: string[];
  initialTitle?: string;
  onClearInitial?: () => void;
  activeSubTab?: "workshop" | "lexicon";
  setActiveSubTab?: (tab: "workshop" | "lexicon") => void;
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
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1 border-b border-border/40 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Onoma Studio</h2>
        <p className="text-sm text-muted-foreground">
          Import your own lexicons and linguistic data, or leverage our ever-growing collection of real-world cultural datasets to create names that feel authentic, resonant, and unique to your world.
        </p>
      </div>

      {currentSubTab === "workshop" ? (
        <StudioWorkshop state={state} />
      ) : (
        <StudioLexicon state={state} />
      )}
    </div>
  );
}

export default StudioSection;
