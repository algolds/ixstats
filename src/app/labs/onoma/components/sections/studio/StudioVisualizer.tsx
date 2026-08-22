"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import dynamic from "next/dynamic";
import { LexiconExplorer } from "../LexiconExplorer";

const MarkovVisualizer = dynamic(
  () => import("../MarkovVisualizer").then((m) => m.MarkovVisualizer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full animate-pulse items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/5">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    ),
  }
);

import { type StudioState } from "../../../hooks/useStudioState";
import { CorpusSelector } from "../../shared/CorpusSelector";
import { resolveCorpusWords } from "~/lib/onoma/data-bridge";
import { useNameBank } from "~/hooks/useNameBank";

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
    setInputText,
  } = state;

  const bank = useNameBank();
  const customDicts = useMemo(() => {
    return bank.nameBank?.filter((d) => d.type === "dictionary" && d.values?.length > 0) || [];
  }, [bank.nameBank]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Interactive Markov Path Visualizer Panel */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-sm font-bold tracking-tight text-[#0091ff]">
              Interactive Path Workshop
            </h3>
            <p className="text-muted-foreground text-xs leading-normal">
              Explore the Markov transition tree step-by-step. Click tokens to traverse paths.
            </p>
          </div>
          <div className="w-48">
            <CorpusSelector
              value=""
              onChange={(val) => {
                const resolved = resolveCorpusWords(val, customDicts, trainingWords);
                if (resolved.words?.length > 0) {
                  setInputText(resolved.words.join(", "));
                  setVisualizerPrefix("");
                }
              }}
              studioWords={trainingWords}
            />
          </div>
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
              Select a corpus or provide training seeds to build the Markov transition trie.
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
