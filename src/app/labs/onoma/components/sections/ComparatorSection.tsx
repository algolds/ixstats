"use client";

// src/app/labs/onoma/components/sections/ComparatorSection.tsx
// Onoma Lab — Side-by-Side Language Profile Comparator

import { useState, useMemo } from "react";
import { GitCompare, Volume2, Sparkles, AlertCircle } from "lucide-react";
import { FacetMaterial } from "~/components/ui/facet";
import { compareProfiles, getAllProfileSeeds, type ComparisonResult } from "~/lib/onoma/comparator";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { translateToIPA } from "~/lib/onoma/phonology";
import { speakName } from "~/lib/onoma/browser-speech";
import { api } from "~/trpc/react";
import type { CulturalProfile } from "~/lib/onoma/types";

const PROFILES = [
  { value: "latin", label: "Latin / Roman" },
  { value: "germanic", label: "Germanic / Norse" },
  { value: "celtic", label: "Celtic / Gaelic" },
  { value: "slavic", label: "Slavic / Eastern European" },
  { value: "arabic", label: "Arabic / Near Eastern" },
  { value: "east-asian", label: "East Asian" },
  { value: "austronesian", label: "Austronesian" },
  { value: "persian", label: "Persian" },
  { value: "turkic", label: "Turkic" },
  { value: "african", label: "African" },
  { value: "indic", label: "Indic" },
  { value: "uralic", label: "Uralic" },
];

export default function ComparatorSection() {
  const [profileA, setProfileA] = useState<CulturalProfile>("latin");
  const [profileB, setProfileB] = useState<CulturalProfile>("germanic");

  // Blend Preview state
  const [hybridNames, setHybridNames] = useState<Array<{ name: string; ipa: string }>>([]);

  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

  const comparison = useMemo<ComparisonResult>(() => {
    return compareProfiles(profileA, profileB);
  }, [profileA, profileB]);

  // Generate 10 sample names for A and B
  const samplesA = useMemo(() => {
    const seeds = getAllProfileSeeds(profileA);
    const chain = new MarkovChain(2, "character");
    chain.addWords(seeds);
    const list: string[] = [];
    for (let i = 0; i < 10; i++) {
      const name = chain.generate({ minLength: 4, maxLength: 10 }) || "Alcius";
      list.push(name);
    }
    return list.map((name) => ({ name, ipa: translateToIPA(name, profileA) }));
  }, [profileA]);

  const samplesB = useMemo(() => {
    const seeds = getAllProfileSeeds(profileB);
    const chain = new MarkovChain(2, "character");
    chain.addWords(seeds);
    const list: string[] = [];
    for (let i = 0; i < 10; i++) {
      const name = chain.generate({ minLength: 4, maxLength: 10 }) || "Alcius";
      list.push(name);
    }
    return list.map((name) => ({ name, ipa: translateToIPA(name, profileB) }));
  }, [profileB]);

  const handleBlendPreview = () => {
    const seedsA = getAllProfileSeeds(profileA);
    const seedsB = getAllProfileSeeds(profileB);
    const combinedSeeds = [...seedsA, ...seedsB];

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
        ipa: translateToIPA(name, `${profileA}+${profileB}`),
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
      defaultVoice: speechConfig?.kokoro?.voice,
      forceDefaultVoice: false,
    });
  };

  const getDistanceColor = (distance: number) => {
    if (distance >= 75) return "text-red-500 border-red-500/20 bg-red-500/5";
    if (distance >= 45) return "text-amber-500 border-amber-500/20 bg-amber-500/5";
    return "text-emerald-500 border-emerald-500/20 bg-emerald-500/5";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-foreground text-xl font-bold tracking-tight">
          Linguistic Profile Comparator
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Compare phonemes, bigram frequencies, entropy, and linguistic distance between profiles.
        </p>
      </div>

      {/* Selectors grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-semibold">Language Profile A</label>
          <select
            value={profileA}
            onChange={(e) => {
              setProfileA(e.target.value as CulturalProfile);
              setHybridNames([]);
            }}
            className="bg-background/50 border-border/40 text-foreground w-full rounded-lg border px-3 py-2 text-sm"
          >
            {PROFILES.map((prof) => (
              <option key={prof.value} value={prof.value} disabled={prof.value === profileB}>
                {prof.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-semibold">Language Profile B</label>
          <select
            value={profileB}
            onChange={(e) => {
              setProfileB(e.target.value as CulturalProfile);
              setHybridNames([]);
            }}
            className="bg-background/50 border-border/40 text-foreground w-full rounded-lg border px-3 py-2 text-sm"
          >
            {PROFILES.map((prof) => (
              <option key={prof.value} value={prof.value} disabled={prof.value === profileA}>
                {prof.label}
              </option>
            ))}
          </select>
        </div>
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
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-[#0091ff] opacity-80" />
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
              <span className="text-[11px] font-bold text-[#0091ff] capitalize">
                Unique to {PROFILES.find((p) => p.value === profileA)?.label} (
                {comparison.uniqueToA.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {comparison.uniqueToA.map((ph) => (
                  <span
                    key={ph}
                    className="rounded border border-[#0091ff]/10 bg-[#0091ff]/10 px-2 py-0.5 font-mono text-sm text-[#0091ff]"
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
                Unique to {PROFILES.find((p) => p.value === profileB)?.label} (
                {comparison.uniqueToB.length})
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
                  <span className="text-foreground capitalize">
                    {PROFILES.find((p) => p.value === profileA)?.label}
                  </span>
                  <span className="font-mono font-semibold">
                    {comparison.entropyA.toFixed(3)} bits
                  </span>
                </div>
                <div className="bg-secondary/30 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-[#0091ff]"
                    style={{ width: `${(comparison.entropyA / 4.7) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-foreground capitalize">
                    {PROFILES.find((p) => p.value === profileB)?.label}
                  </span>
                  <span className="font-mono font-semibold">
                    {comparison.entropyB.toFixed(3)} bits
                  </span>
                </div>
                <div className="bg-secondary/30 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${(comparison.entropyB / 4.7) * 100}%` }}
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
            {PROFILES.find((p) => p.value === profileA)?.label} Sample Names
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
                  onClick={() => playName(item.name, item.ipa, profileA)}
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
            {PROFILES.find((p) => p.value === profileB)?.label} Sample Names
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
                  onClick={() => playName(item.name, item.ipa, profileB)}
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
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-amber-600 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
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
                  onClick={() => playName(item.name, item.ipa, `${profileA}+${profileB}`)}
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
            Click &quot;Blend Profiles&quot; to synthesize hybrid names trained on 50/50 combined
            linguistic inputs.
          </div>
        )}
      </div>
    </div>
  );
}
