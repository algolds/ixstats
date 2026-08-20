// src/hooks/useOnomaGenerator.ts
// Onoma Lab — Custom Hook for Client-side Generation

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { trainLM, naturalnessScore, type NgramLM } from "~/lib/onoma/perplexity";
import { CULTURAL_PROFILES } from "~/lib/onoma/cultural-profiles";
import { generateFantasySyllableName, generatePresetName } from "~/lib/onoma/name-generator";
import type { NameCategory, CulturalProfile, GenerateOptions, Gender } from "~/lib/onoma/types";

import {
  LEXICON_LOADERS,
  mapCategoryForTraining,
  mapCategoryForLexicon,
  FAMILY_PHONOTACTICS,
} from "~/lib/onoma/lexicon-loader";

export function useOnomaGenerator() {
  const [culture, setCulture] = useState<string>("any");
  const [includeWorldData, setIncludeWorldData] = useState<boolean>(false);
  const [lexiconDict, setLexiconDict] = useState<Record<string, string[]> | null>(null);
  const [category, setCategory] = useState<NameCategory>("city");
  const [gender, setGender] = useState<Gender>("neutral");
  const [subType, setSubType] = useState<string>("generic"); // e.g. "dwarf", "elf", "tavern", "military-unit"
  const [order, setOrder] = useState<number>(2);
  const [options, setOptions] = useState<GenerateOptions>({
    minLength: 4,
    maxLength: 12,
    allowDuplicates: false,
  });

  // Prefix and Suffix configuration
  const [selectedPrefix, setSelectedPrefix] = useState<string>("");
  const [customPrefix, setCustomPrefix] = useState<string>("");
  const [selectedSuffix, setSelectedSuffix] = useState<string>("");
  const [customSuffix, setCustomSuffix] = useState<string>("");

  // Track generation logs
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // tRPC query to fetch live database names
  const trainingCategory = mapCategoryForTraining(category);
  const { data: dbTrainingNames, refetch: refetchTraining } = api.onoma.getTrainingData.useQuery(
    { category: trainingCategory },
    { enabled: includeWorldData, staleTime: 600000 }
  );

  const utils = api.useUtils();
  const logActivityMutation = api.onoma.logGeneration.useMutation();
  const logHistoryMutation = api.onoma.logEvent.useMutation();
  const sessionIdRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15)
  );

  // Lazy-load the prebuilt lexicon dictionary for the active category.
  const lexiconCat = mapCategoryForLexicon(category, subType);
  useEffect(() => {
    let cancelled = false;
    setLexiconDict(null);
    LEXICON_LOADERS[lexiconCat]().then((m) => {
      if (!cancelled) setLexiconDict(m.default ?? (m as unknown as Record<string, string[]>));
    });
    return () => {
      cancelled = true;
    };
  }, [lexiconCat]);

  // Phonotactic perplexity model over the current training set (naturalness scoring).
  const activeSeedsRef = useRef<string[]>([]);
  const lmCacheRef = useRef<{ key: string; lm: NgramLM | null }>({ key: "", lm: null });

  // Instantiate client-side Markov Chain engines (both character-based and syllable-based)
  const characterChain = useMemo(() => new MarkovChain(order, "character"), [order]);
  const syllableChain = useMemo(
    () => new MarkovChain(Math.min(2, Math.max(1, order - 1)), "syllable"),
    [order]
  );

  // Train the Markov chains when parameters change
  useEffect(() => {
    characterChain.reset();
    characterChain.setOrder(order);

    syllableChain.reset();
    syllableChain.setOrder(Math.min(2, Math.max(1, order - 1)));

    // CULTURAL_PROFILES["culture"] is the ethnonym list — correct for the generic
    // Culture subtype, but wrong dictionary for sports/cuisine, which train purely
    // on their own curated lexicon. Skip presets for those.
    const presetSeeds: string[] = [];
    const usePresets = !(category === "culture" && subType !== "generic");
    if (usePresets) {
      if (culture === "any") {
        Object.values(CULTURAL_PROFILES).forEach((profile) => {
          const seeds = profile[category] || [];
          presetSeeds.push(...seeds);
        });
      } else {
        const seeds = CULTURAL_PROFILES[culture as CulturalProfile]?.[category] || [];
        presetSeeds.push(...seeds);
      }
    }

    const lexiconSeeds: string[] = [];
    if (lexiconDict) {
      if (culture === "any") {
        lexiconSeeds.push(...Object.values(lexiconDict).flat());
      } else if (culture !== "constructed" && lexiconDict[culture]) {
        lexiconSeeds.push(...(lexiconDict[culture] || []));
      }
    }

    const worldSeeds: string[] = [];
    if (includeWorldData && dbTrainingNames && dbTrainingNames.length > 0) {
      worldSeeds.push(...dbTrainingNames);
    }

    const allSeeds = [...presetSeeds, ...lexiconSeeds, ...worldSeeds];
    activeSeedsRef.current = allSeeds;
    if (allSeeds.length > 0) {
      characterChain.addWords(allSeeds);
      syllableChain.addWords(allSeeds);
    }
  }, [
    culture,
    category,
    subType,
    dbTrainingNames,
    lexiconDict,
    includeWorldData,
    order,
    characterChain,
    syllableChain,
  ]);

  const getOrTrainLM = useCallback((): NgramLM | null => {
    const seeds = activeSeedsRef.current;
    if (!seeds || seeds.length === 0) return null;
    const cacheKey = `${culture}:${category}:${subType}:${seeds.length}`;
    if (lmCacheRef.current.key === cacheKey && lmCacheRef.current.lm) {
      return lmCacheRef.current.lm;
    }
    const trained = trainLM(seeds, 3);
    lmCacheRef.current = { key: cacheKey, lm: trained };
    return trained;
  }, [culture, category, subType]);

  // Naturalness scorer (0–100) for a generated name, vs the current training set.
  const scoreNaturalness = useCallback(
    (name: string): number | null => {
      const lm = getOrTrainLM();
      return lm ? naturalnessScore(name, lm) : null;
    },
    [getOrTrainLM]
  );

  /**
   * Generates a batch of names based on current configuration and rule-based presets.
   */
  const generate = (count = 15): string[] => {
    setIsGenerating(true);
    const results: string[] = [];

    // Family phonotactic floor first, user options win on conflict (advanced
    // panel keys only exist once the user touches them, so the floor survives).
    const genOptions = { ...(FAMILY_PHONOTACTICS[culture] ?? {}), ...options };

    for (let i = 0; i < count; i++) {
      let name: string | null = null;

      // 1. Check if generating rule-based custom presets (non-Markov)
      name = generatePresetName({
        category,
        subType,
        gender,
        culture,
        characterChain,
        syllableChain,
        options: genOptions,
      });

      // 2. Fallback to Markov chain generation
      if (!name) {
        name = characterChain.generate(genOptions);
      }
      if (!name) {
        name = syllableChain.generate(genOptions);
      }

      // 3. Fallback to generic syllable concatenation if Markov chain is empty or fails
      if (!name) {
        name = generateFantasySyllableName();
      }

      if (name) {
        let prefixStr = "";
        if (category === "person") {
          if (selectedPrefix === "custom") {
            prefixStr = customPrefix.trim() ? customPrefix.trim() + " " : "";
          } else if (selectedPrefix) {
            prefixStr = selectedPrefix + " ";
          }
        }

        let suffixStr = "";
        if (category === "organization" || category === "country" || category === "province") {
          if (selectedSuffix === "custom") {
            suffixStr = customSuffix.trim() ? " " + customSuffix.trim() : "";
          } else if (selectedSuffix) {
            suffixStr = " " + selectedSuffix;
          }
        }

        results.push(prefixStr + name + suffixStr);
      }
    }

    setGeneratedNames(results);
    setIsGenerating(false);

    // Asynchronously log generation activity in feed
    if (results.length > 0) {
      const runHash = `onoma-${Math.random().toString(36).substring(2, 7)}${Date.now().toString(36).slice(-4)}`;

      logActivityMutation
        .mutateAsync({
          count: results.length,
          category: category,
        })
        .catch(() => {});

      // Also log to generation history with unique run hash
      logHistoryMutation
        .mutateAsync({
          sessionId: runHash,
          names: results,
          category,
          culturalProfile: culture,
          trainingMode: includeWorldData ? "ixworld" : "preset",
          parameters: options as Record<string, unknown>,
          count: results.length,
        })
        .then(() => {
          void utils.onoma.getHistory.invalidate();
          void utils.onoma.getStats.invalidate();
        })
        .catch(() => {});
    }

    return results;
  };

  return {
    culture,
    setCulture,
    includeWorldData,
    setIncludeWorldData,
    selectedPrefix,
    setSelectedPrefix,
    customPrefix,
    setCustomPrefix,
    selectedSuffix,
    setSelectedSuffix,
    customSuffix,
    setCustomSuffix,
    category,
    setCategory,
    gender,
    setGender,
    subType,
    setSubType,
    order,
    setOrder,
    options,
    setOptions,
    generatedNames,
    isGenerating,
    generate,
    scoreNaturalness,
    refetchTraining,
  };
}
