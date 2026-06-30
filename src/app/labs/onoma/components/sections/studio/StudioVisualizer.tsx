"use client";

// src/app/labs/onoma/components/sections/studio/StudioVisualizer.tsx
// Onoma Custom Studio Visualizer Sub-tab View

import { Info } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { MarkovVisualizer } from "../MarkovVisualizer";
import { LexiconExplorer } from "../LexiconExplorer";
import { type StudioState } from "../../../hooks/useStudioState";

interface StudioVisualizerProps {
  state: StudioState;
}

export function StudioVisualizer({ state }: StudioVisualizerProps) {
  const {
    visualizerPrefix,
    setVisualizerPrefix,
    visualizerChain,
    handleCompleteName,
    trainingWords,
  } = state;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Interactive Markov Path Visualizer Panel */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold tracking-tight text-[#0091ff]">
            Interactive Path Workshop
          </h3>
          <p className="text-muted-foreground text-xs leading-normal">
            Explore the Markov transition tree step-by-step. Click green tokens to grow the path and
            click red [End] to finalize name compilation.
          </p>
        </div>

        {visualizerChain ? (
          <MarkovVisualizer
            chain={visualizerChain}
            activePrefix={visualizerPrefix}
            onChangePrefix={setVisualizerPrefix}
            onCompleteName={handleCompleteName}
          />
        ) : (
          <FacetCard className="border-border/40 bg-secondary/5 text-muted-foreground flex h-full min-h-[300px] flex-col items-center justify-center border border-dashed p-8 text-center text-sm">
            <Info className="mb-3 h-8 w-8 text-[#0091ff]/40" />
            <p className="font-semibold">Interactive visualizer is inactive</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Provide training seeds in the Model Workshop tab to build the Markov transition trie.
            </p>
          </FacetCard>
        )}
      </div>

      {/* Lexicon Explorer & Health Panel */}
      <div className="h-full space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold tracking-tight text-[#10b981]">
            Lexicon & Syllable Analysis
          </h3>
          <p className="text-muted-foreground text-xs leading-normal">
            Verify the distinct syllable structure, entropy, and phonotactic naturalness of your
            active conlang seed lists.
          </p>
        </div>
        <LexiconExplorer words={trainingWords} />
      </div>
    </div>
  );
}

export default StudioVisualizer;
