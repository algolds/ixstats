"use client";

import { useMemo } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { InfoCircle as Info } from "iconoir-react";
import dynamic from "next/dynamic";
import { LexiconExplorer } from "../LexiconExplorer";

const MarkovVisualizer = dynamic(
  () => import("../MarkovVisualizer").then((m) => m.MarkovVisualizer),
  {
    ssr: false,
    loading: () => <Skeleton className="rounded-row h-64 w-full" />,
  }
);

import { type StudioState } from "../../../hooks/useStudioState";
import { CorpusSelector } from "../../shared/CorpusSelector";
import { resolveCorpusWords } from "~/lib/onoma/data-bridge";
import { useNameBank } from "~/hooks/useNameBank";
import { Card } from "~/components/ui/card";

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
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h3 className="text-tint text-body font-semibold">Interactive path workshop</h3>
            <p className="text-label-secondary text-footnote leading-normal">
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
          <Card
            variant="inset"
            padding="none"
            className="text-label-secondary text-body flex h-full min-h-[300px] flex-col items-center justify-center border-dashed p-8 text-center"
          >
            <Info className="text-tint/40 mb-3 h-8 w-8" />
            <p className="font-semibold">Interactive visualizer is inactive</p>
            <p className="text-label-secondary text-footnote mt-1">
              Select a corpus or provide training seeds to build the Markov transition trie.
            </p>
          </Card>
        )}
      </div>

      {/* Lexicon Explorer & Health Panel */}
      <div className="h-full space-y-4">
        <div className="space-y-1">
          <h3 className="text-body text-green font-semibold">Lexicon & syllable analysis</h3>
          <p className="text-label-secondary text-footnote leading-normal">
            Verify the distinct syllable structure, entropy, and phonotactic naturalness of your
            active conlang seed lists.
          </p>
        </div>
        <LexiconExplorer words={trainingWords} />
      </div>
    </div>
  );
}
