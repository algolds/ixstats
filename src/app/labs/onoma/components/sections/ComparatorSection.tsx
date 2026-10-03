"use client";

// src/app/labs/onoma/components/sections/ComparatorSection.tsx
// Onoma Lab — Side-by-Side Language Profile Comparator

import { useState, useMemo } from "react";
import { GitCompare, SoundHigh as Volume2, WarningCircle as AlertCircle } from "iconoir-react";
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
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

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
    if (dist <= 30) return "border-green/30 bg-green/5 text-green";
    if (dist <= 60) return "border-yellow/30 bg-yellow/5 text-yellow";
    return "border-red/30 bg-red/5 text-red";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="border-separator space-y-1 border-b pb-4">
          <h2 className="text-label text-title-2 font-bold">Linguistic comparison</h2>
          <p className="text-label-secondary text-footnote mt-0.5">
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
        <Card
          variant="inset"
          padding="none"
          className={`flex flex-col items-center justify-center p-4 text-center ${getDistanceColor(
            comparison.linguisticDistance
          )}`}
        >
          <GitCompare className="mb-2 h-6 w-6 opacity-80" />
          <span className="text-large-title font-mono font-bold">
            {comparison.linguisticDistance}
          </span>
          <span className="text-eyebrow mt-1 opacity-85">Linguistic distance</span>
          <span className="text-caption mt-1 opacity-70">
            {comparison.linguisticDistance >= 75
              ? "Mutually Unintelligible (Completely Alien)"
              : comparison.linguisticDistance >= 45
                ? "Divergent (Distinct Dialects)"
                : "Cognate / Close Cousins"}
          </span>
        </Card>

        {/* Phoneme overlap card */}
        <Card variant="inset" padding="none" className="p-4 text-center">
          <span className="text-label text-large-title font-mono font-bold">
            {comparison.phonemeOverlap}%
          </span>
          <span className="text-label-secondary text-eyebrow mt-1 block">
            Phoneme inventory overlap
          </span>
          <span className="text-label-secondary text-caption mt-1 block">
            Jaccard overlap coefficient of sound charts
          </span>
        </Card>

        {/* Bigram similarity card */}
        <Card variant="inset" padding="none" className="p-4 text-center">
          <GitCompare className="text-indigo mx-auto mb-2 h-6 w-6 opacity-80" />
          <span className="text-label text-large-title font-mono font-bold">
            {comparison.bigramSimilarity}%
          </span>
          <span className="text-label-secondary text-eyebrow mt-1 block">
            Bigram cosine similarity
          </span>
          <span className="text-label-secondary text-caption mt-1 block">
            Phonotactic structure vector correlation
          </span>
        </Card>
      </div>

      {/* Phoneme Inventories compare */}
      <div className="space-y-3">
        <h3 className="text-label-secondary text-subhead">Phoneme inventory overlap analysis</h3>
        <Card variant="inset" padding="none" className="space-y-4 p-4">
          {/* Shared sounds */}
          <div className="space-y-2">
            <span className="text-caption text-green font-semibold">
              Shared Phonemes ({comparison.sharedPhonemes.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {comparison.sharedPhonemes.map((ph) => (
                <span
                  key={ph}
                  className="rounded-control-sm border-green/10 bg-green/10 text-body text-green border px-2 py-0.5 font-mono"
                >
                  /{ph}/
                </span>
              ))}
              {comparison.sharedPhonemes.length === 0 && (
                <span className="text-label-secondary text-footnote italic">No shared sounds.</span>
              )}
            </div>
          </div>

          <div className="border-separator grid grid-cols-1 gap-4 border-t pt-2 sm:grid-cols-2">
            {/* Unique to A */}
            <div className="space-y-2">
              <span className="text-tint text-caption font-semibold capitalize">
                Unique to {corpusA.label} ({comparison.uniqueToA.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {comparison.uniqueToA.map((ph) => (
                  <span
                    key={ph}
                    className="border-tint/10 bg-tint/10 text-tint rounded-control-sm text-body border px-2 py-0.5 font-mono"
                  >
                    /{ph}/
                  </span>
                ))}
                {comparison.uniqueToA.length === 0 && (
                  <span className="text-label-secondary text-footnote italic">None.</span>
                )}
              </div>
            </div>

            {/* Unique to B */}
            <div className="space-y-2">
              <span className="text-caption text-indigo font-semibold capitalize">
                Unique to {corpusB.label} ({comparison.uniqueToB.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {comparison.uniqueToB.map((ph) => (
                  <span
                    key={ph}
                    className="rounded-control-sm border-indigo/10 bg-indigo/10 text-body text-indigo border px-2 py-0.5 font-mono"
                  >
                    /{ph}/
                  </span>
                ))}
                {comparison.uniqueToB.length === 0 && (
                  <span className="text-label-secondary text-footnote italic">None.</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Phonetic Diversity / Shannon Entropy comparison */}
      <div className="space-y-3">
        <h3 className="text-label-secondary text-subhead">Phonetic diversity & entropy</h3>
        <Card variant="inset" padding="none" className="p-4">
          <div className="space-y-3">
            <div className="text-label-secondary text-footnote flex items-center justify-between">
              <span>Entropy difference</span>
              <span className="text-label font-mono font-semibold">
                {comparison.entropyDelta.toFixed(3)} bits
              </span>
            </div>
            {/* Visual bar comparing entropy */}
            <div className="space-y-2">
              <div>
                <div className="text-caption mb-1 flex justify-between">
                  <span className="text-label capitalize">{corpusA.label}</span>
                  <span className="font-mono font-semibold">
                    {comparison.entropyA.toFixed(3)} bits
                  </span>
                </div>
                <div className="bg-fill-3 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-tint h-full rounded-full"
                    style={{ width: `${Math.min(100, (comparison.entropyA / 4.7) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="text-caption mb-1 flex justify-between">
                  <span className="text-label capitalize">{corpusB.label}</span>
                  <span className="font-mono font-semibold">
                    {comparison.entropyB.toFixed(3)} bits
                  </span>
                </div>
                <div className="bg-fill-3 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-indigo h-full rounded-full"
                    style={{ width: `${Math.min(100, (comparison.entropyB / 4.7) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Sample outputs Side-by-Side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-label-secondary text-subhead capitalize">
            {corpusA.label} Sample Names
          </h3>
          <div className="border-separator divide-separator bg-surface rounded-control divide-y overflow-hidden border">
            {samplesA.map((item, idx) => (
              <div
                key={idx}
                className="hover:bg-fill-4 text-footnote flex items-center justify-between p-3 transition-colors"
              >
                <div>
                  <span className="text-label font-semibold">{item.name}</span>
                  <span className="text-label-secondary ml-2 font-mono">{item.ipa}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => playName(item.name, item.ipa, corpusA.fallbackCulture)}
                  aria-label="Play pronunciation"
                  className="text-label-secondary hover:text-yellow"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-label-secondary text-subhead capitalize">
            {corpusB.label} Sample Names
          </h3>
          <div className="border-separator divide-separator bg-surface rounded-control divide-y overflow-hidden border">
            {samplesB.map((item, idx) => (
              <div
                key={idx}
                className="hover:bg-fill-4 text-footnote flex items-center justify-between p-3 transition-colors"
              >
                <div>
                  <span className="text-label font-semibold">{item.name}</span>
                  <span className="text-label-secondary ml-2 font-mono">{item.ipa}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => playName(item.name, item.ipa, corpusB.fallbackCulture)}
                  aria-label="Play pronunciation"
                  className="text-label-secondary hover:text-yellow"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Blend preview workbench */}
      <div className="border-separator space-y-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-label-secondary text-subhead">
            Linguistic Hybridization (Blend Preview)
          </h3>
          <Button
            variant="default"
            size="default"
            onClick={handleBlendPreview}
            className="justify-center"
          >
            Blend profiles
          </Button>
        </div>

        {hybridNames.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {hybridNames.map((item, idx) => (
              <div
                key={idx}
                className="border-separator bg-fill-4 rounded-control text-footnote flex items-center justify-between border p-3"
              >
                <div>
                  <span className="text-label font-semibold">{item.name}</span>
                  <span className="text-label-secondary ml-2 font-mono">{item.ipa}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    playName(
                      item.name,
                      item.ipa,
                      `${corpusA.fallbackCulture}+${corpusB.fallbackCulture}`
                    )
                  }
                  aria-label="Play pronunciation"
                  className="text-label-secondary hover:text-yellow"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-separator text-label-secondary bg-fill-4 rounded-control text-footnote border p-6 text-center">
            <AlertCircle className="text-label-secondary mx-auto mb-2 h-5 w-5 opacity-60" />
            Click &quot;Blend Profiles&quot; to generate hybrid names trained on 50/50 combined
            linguistic inputs.
          </div>
        )}
      </div>
    </div>
  );
}
