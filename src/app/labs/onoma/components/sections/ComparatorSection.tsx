"use client";

// src/app/labs/onoma/components/sections/ComparatorSection.tsx
// Onoma Lab — Side-by-Side Language Profile Comparator

import { useState, useMemo } from "react";
import { GitCompare, SoundHigh as Volume2, WarningCircle as AlertCircle } from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { translateToIPA } from "~/lib/onoma/phonology";
import { speakName } from "~/lib/onoma/browser-speech";
import { api } from "~/trpc/react";
import { useNameBank } from "~/hooks/useNameBank";
import { CorpusSelector } from "../shared/CorpusSelector";
import {
  resolveCorpusWords,
  compareDynamicWordLists,
  type DynamicComparisonResult,
} from "~/lib/onoma/data-bridge";

interface ComparatorSectionProps {
  hideHeader?: boolean;
  studioWords?: string[];
}

export default function ComparatorSection({
  hideHeader = false,
  studioWords = [],
}: ComparatorSectionProps = {}) {
  const [profileA, setProfileA] = useState<string>("latin");
  const [profileB, setProfileB] = useState<string>("germanic");

  const bank = useNameBank();
  const customDicts = useMemo(() => {
    return bank.nameBank?.filter((d) => d.type === "dictionary" && d.values?.length > 0) || [];
  }, [bank.nameBank]);

  // Resolve active corpus data for A and B
  const corpusA = useMemo(() => {
    return resolveCorpusWords(profileA, customDicts, studioWords);
  }, [profileA, customDicts, studioWords]);

  const corpusB = useMemo(() => {
    return resolveCorpusWords(profileB, customDicts, studioWords);
  }, [profileB, customDicts, studioWords]);

  // Dynamic phonetic & entropy comparison
  const comparison = useMemo<DynamicComparisonResult>(() => {
    return compareDynamicWordLists(
      corpusA.words,
      corpusA.label,
      corpusA.fallbackCulture,
      corpusB.words,
      corpusB.label,
      corpusB.fallbackCulture
    );
  }, [corpusA, corpusB]);

  // Blend Preview state
  const [hybridNames, setHybridNames] = useState<Array<{ name: string; ipa: string }>>([]);

  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

  // Generate 10 sample names for A and B dynamically
  const samplesA = useMemo(() => {
    const chain = new MarkovChain(2, "character");
    chain.addWords(corpusA.words);
    const list: string[] = [];
    for (let i = 0; i < 10; i++) {
      const name = chain.generate({ minLength: 4, maxLength: 10 }) || corpusA.words[0] || "Alcius";
      list.push(name);
    }
    return list.map((name) => ({ name, ipa: translateToIPA(name, corpusA.fallbackCulture) }));
  }, [corpusA]);

  const samplesB = useMemo(() => {
    const chain = new MarkovChain(2, "character");
    chain.addWords(corpusB.words);
    const list: string[] = [];
    for (let i = 0; i < 10; i++) {
      const name = chain.generate({ minLength: 4, maxLength: 10 }) || corpusB.words[0] || "Alcius";
      list.push(name);
    }
    return list.map((name) => ({ name, ipa: translateToIPA(name, corpusB.fallbackCulture) }));
  }, [corpusB]);

  const handleBlendPreview = () => {
    const combinedSeeds = [...corpusA.words, ...corpusB.words];
    const chain = new MarkovChain(2, "character");
    chain.addWords(combinedSeeds);

    const list: string[] = [];
    const generatedSet = new Set<string>();

    let attempts = 0;
    while (list.length < 10 && attempts < 100) {
      attempts++;
      const name = chain.generate({ minLength: 4, maxLength: 11 });
      if (name && !generatedSet.has(name)) {
        generatedSet.add(name);
        list.push(name);
      }
    }

    setHybridNames(
      list.map((name) => ({
        name,
        ipa: translateToIPA(name, `${corpusA.fallbackCulture}+${corpusB.fallbackCulture}`),
      }))
    );
  };

  const playName = (name: string, ipa: string, culture: string) => {
    speakName({
      name,
      ipa,
      culture,
      kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
      voice: undefined,
    });
  };

  const getDistanceColor = (dist: number) => {
    if (dist <= 30) return "border-emerald-500/30 bg-emerald-500/5 text-emerald-500";
    if (dist <= 60) return "border-amber-500/30 bg-amber-500/5 text-amber-500";
    return "border-rose-500/30 bg-rose-500/5 text-rose-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="border-border/40 space-y-1 border-b pb-4">
          <h2 className="text-foreground text-xl font-bold tracking-tight">
            Linguistic Comparison
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Analyze phonetic distance, bigram entropy, and synthesize hybrid vocabulary between
            natural cultures and custom conlangs.
          </p>
        </div>
      )}

      {/* Selectors grid with Universal Corpus Selectors */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CorpusSelector
          label="Corpus / Language Profile A"
          value={profileA}
          onChange={(val) => {
            setProfileA(val);
            setHybridNames([]);
          }}
          studioWords={studioWords}
        />
        <CorpusSelector
          label="Corpus / Language Profile B"
          value={profileB}
          onChange={(val) => {
            setProfileB(val);
            setHybridNames([]);
          }}
          studioWords={studioWords}
        />
      </div>

      {/* Linguistic Distance Dashboard */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Composite distance card */}
        <FacetMaterial
          material="satin"
          className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center ${getDistanceColor(
            comparison.linguisticDistance
          )}`}
        >
          <GitCompare className="mb-2 h-6 w-6 opacity-80" />
          <span className="font-mono text-3xl font-extrabold tracking-tight">
            {comparison.linguisticDistance}
          </span>
          <span className="mt-1 text-xs font-bold tracking-wider uppercase opacity-85">
            Linguistic Distance
          </span>
          <span className="mt-1 text-[10px] opacity-70">
            {comparison.linguisticDistance >= 75
              ? "Mutually Unintelligible (Completely Alien)"
              : comparison.linguisticDistance >= 45
                ? "Divergent (Distinct Dialects)"
                : "Cognate / Close Cousins"}
          </span>
        </FacetMaterial>

        {/* Phoneme overlap card */}
        <FacetMaterial material="satin" className="border-border/20 border p-4 text-center">
          <span className="text-foreground font-mono text-3xl font-extrabold tracking-tight">
            {comparison.phonemeOverlap}%
          </span>
          <span className="text-muted-foreground mt-1 block text-xs font-bold tracking-wider uppercase">
            Phoneme Inventory Overlap
          </span>
          <span className="text-muted-foreground mt-1 block text-[10px]">
            Jaccard overlap coefficient of sound charts
          </span>
        </FacetMaterial>

        {/* Bigram similarity card */}
        <FacetMaterial material="satin" className="border-border/20 border p-4 text-center">
          <GitCompare className="mx-auto mb-2 h-6 w-6 text-purple-500 opacity-80" />
          <span className="text-foreground font-mono text-3xl font-extrabold tracking-tight">
            {comparison.bigramSimilarity}%
          </span>
          <span className="text-muted-foreground mt-1 block text-xs font-bold tracking-wider uppercase">
            Bigram Cosine Similarity
          </span>
          <span className="text-muted-foreground mt-1 block text-[10px]">
            Phonotactic structure vector correlation
          </span>
        </FacetMaterial>
      </div>

      {/* Phoneme Inventories compare */}
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          Phoneme Inventory Overlap Analysis
        </h3>
        <FacetMaterial material="satin" className="border-border/20 space-y-4 border p-4">
          {/* Shared sounds */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-emerald-500">
              Shared Phonemes ({comparison.sharedPhonemes.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {comparison.sharedPhonemes.map((ph) => (
                <span
                  key={ph}
                  className="rounded border border-emerald-500/10 bg-emerald-500/10 px-2 py-0.5 font-mono text-sm text-emerald-600 dark:text-emerald-400"
                >
                  /{ph}/
                </span>
              ))}
              {comparison.sharedPhonemes.length === 0 && (
                <span className="text-muted-foreground text-xs italic">No shared sounds.</span>
              )}
            </div>
          </div>

          <div className="border-border/10 grid grid-cols-1 gap-4 border-t pt-2 sm:grid-cols-2">
            {/* Unique to A */}
            <div className="space-y-1.5">
              <span className="text-onoma-primary text-[11px] font-bold capitalize">
                Unique to {corpusA.label} ({comparison.uniqueToA.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {comparison.uniqueToA.map((ph) => (
                  <span
                    key={ph}
                    className="border-onoma-primary/10 bg-onoma-primary/10 text-onoma-primary rounded border px-2 py-0.5 font-mono text-sm"
                  >
                    /{ph}/
                  </span>
                ))}
                {comparison.uniqueToA.length === 0 && (
                  <span className="text-muted-foreground text-xs italic">None.</span>
                )}
              </div>
            </div>

            {/* Unique to B */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-purple-500 capitalize">
                Unique to {corpusB.label} ({comparison.uniqueToB.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {comparison.uniqueToB.map((ph) => (
                  <span
                    key={ph}
                    className="rounded border border-purple-500/10 bg-purple-500/10 px-2 py-0.5 font-mono text-sm text-purple-600 dark:text-purple-400"
                  >
                    /{ph}/
                  </span>
                ))}
                {comparison.uniqueToB.length === 0 && (
                  <span className="text-muted-foreground text-xs italic">None.</span>
                )}
              </div>
            </div>
          </div>
        </FacetMaterial>
      </div>

      {/* Phonetic Diversity / Shannon Entropy comparison */}
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          Phonetic Diversity & Entropy
        </h3>
        <FacetMaterial material="satin" className="border-border/20 border p-4">
          <div className="space-y-3">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Entropy Difference</span>
              <span className="text-foreground font-mono font-bold">
                {comparison.entropyDelta.toFixed(3)} bits
              </span>
            </div>
            {/* Visual bar comparing entropy */}
            <div className="space-y-2">
              <div>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-foreground capitalize">{corpusA.label}</span>
                  <span className="font-mono font-semibold">
                    {comparison.entropyA.toFixed(3)} bits
                  </span>
                </div>
                <div className="bg-secondary/30 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-onoma-primary h-full rounded-full"
                    style={{ width: `${Math.min(100, (comparison.entropyA / 4.7) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-foreground capitalize">{corpusB.label}</span>
                  <span className="font-mono font-semibold">
                    {comparison.entropyB.toFixed(3)} bits
                  </span>
                </div>
                <div className="bg-secondary/30 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${Math.min(100, (comparison.entropyB / 4.7) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </FacetMaterial>
      </div>

      {/* Sample outputs Side-by-Side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-muted-foreground text-xs font-bold tracking-wider capitalize uppercase">
            {corpusA.label} Sample Names
          </h3>
          <div className="border-border/20 divide-border/10 bg-background/35 divide-y overflow-hidden rounded-lg border">
            {samplesA.map((item, idx) => (
              <div
                key={idx}
                className="hover:bg-secondary/15 flex items-center justify-between p-2.5 text-xs transition-colors"
              >
                <div>
                  <span className="text-foreground font-semibold">{item.name}</span>
                  <span className="text-muted-foreground ml-2 font-mono">{item.ipa}</span>
                </div>
                <button
                  onClick={() => playName(item.name, item.ipa, corpusA.fallbackCulture)}
                  className="hover:bg-secondary/40 text-muted-foreground cursor-pointer rounded p-1 transition-colors hover:text-amber-500"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-muted-foreground text-xs font-bold tracking-wider capitalize uppercase">
            {corpusB.label} Sample Names
          </h3>
          <div className="border-border/20 divide-border/10 bg-background/35 divide-y overflow-hidden rounded-lg border">
            {samplesB.map((item, idx) => (
              <div
                key={idx}
                className="hover:bg-secondary/15 flex items-center justify-between p-2.5 text-xs transition-colors"
              >
                <div>
                  <span className="text-foreground font-semibold">{item.name}</span>
                  <span className="text-muted-foreground ml-2 font-mono">{item.ipa}</span>
                </div>
                <button
                  onClick={() => playName(item.name, item.ipa, corpusB.fallbackCulture)}
                  className="hover:bg-secondary/40 text-muted-foreground cursor-pointer rounded p-1 transition-colors hover:text-amber-500"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Blend preview workbench */}
      <div className="border-border/10 space-y-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            Linguistic Hybridization (Blend Preview)
          </h3>
          <button
            onClick={handleBlendPreview}
            className="flex cursor-pointer items-center justify-center rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-amber-600 active:scale-95"
          >
            Blend Profiles
          </button>
        </div>

        {hybridNames.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {hybridNames.map((item, idx) => (
              <div
                key={idx}
                className="border-border/20 bg-secondary/10 flex items-center justify-between rounded-lg border p-2.5 text-xs"
              >
                <div>
                  <span className="text-foreground font-bold">{item.name}</span>
                  <span className="text-muted-foreground ml-2 font-mono">{item.ipa}</span>
                </div>
                <button
                  onClick={() =>
                    playName(
                      item.name,
                      item.ipa,
                      `${corpusA.fallbackCulture}+${corpusB.fallbackCulture}`
                    )
                  }
                  className="hover:bg-secondary/45 text-muted-foreground cursor-pointer rounded p-1 transition-colors hover:text-amber-500"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-border/10 text-muted-foreground bg-secondary/5 rounded-lg border p-6 text-center text-xs">
            <AlertCircle className="text-muted-foreground mx-auto mb-2 h-5 w-5 opacity-60" />
            Click &quot;Blend Profiles&quot; to generate hybrid names trained on 50/50 combined
            linguistic inputs.
          </div>
        )}
      </div>
    </div>
  );
}
