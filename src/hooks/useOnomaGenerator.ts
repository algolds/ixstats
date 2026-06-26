// src/hooks/useOnomaGenerator.ts
// Onoma Lab — Custom Hook for Client-side Generation

import { useState, useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { CULTURAL_PROFILES } from "~/lib/onoma/cultural-profiles";
import { generateFantasySyllableName } from "~/lib/onoma/name-generator";
import {
  generateGoblinName,
  generateOrcName,
  generateOgreName,
  generatePrimitiveName,
  generateDwarfName,
  generateHalflingName,
  generateGnomeName,
  generateElfName,
  generateFaeryName,
  generateDarkElfName,
  generateHalfDemonName,
  generateDragonName,
  generateDemonName,
  generateAngelName,
} from "~/lib/onoma/species-generator";
import {
  generateMysticOrderName,
  generateMilitaryUnitName,
  generateCovertOrgName,
} from "~/lib/onoma/group-generator";
import { generateTavernName } from "~/lib/onoma/tavern-generator";
import { NameCategory, CulturalProfile, TrainingMode, GenerateOptions, Gender } from "~/lib/onoma/types";

/**
 * Maps NameCategory to training data types fetched from backend.
 */
// Must return one of the categories the onoma.getTrainingData router accepts.
function mapCategoryForTraining(cat: NameCategory): "country" | "city" | "province" | "person" {
  if (cat === "city" || cat === "geography") return "city";
  if (cat === "province") return "province";
  if (cat === "military" || cat === "organization" || cat === "person" || cat === "dynasty") return "person";
  return "country";
}

// Prebuilt wiki corpus dictionaries (one chunk per category, lazy code-split).
type CorpusCat = "country" | "city" | "province" | "person" | "organization";
const CORPUS_LOADERS: Record<CorpusCat, () => Promise<{ default: Record<string, string[]> }>> = {
  country: () => import("~/lib/onoma/data/corpus/country.json"),
  city: () => import("~/lib/onoma/data/corpus/city.json"),
  province: () => import("~/lib/onoma/data/corpus/province.json"),
  person: () => import("~/lib/onoma/data/corpus/person.json"),
  organization: () => import("~/lib/onoma/data/corpus/organization.json"),
};

function mapCategoryForCorpus(cat: NameCategory): CorpusCat {
  if (cat === "city" || cat === "geography") return "city";
  if (cat === "province") return "province";
  if (cat === "person" || cat === "dynasty") return "person";
  if (cat === "organization" || cat === "military") return "organization";
  return "country";
}

export function useOnomaGenerator() {
  const [trainingMode, setTrainingMode] = useState<TrainingMode>("corpus");
  const [corpusBucket, setCorpusBucket] = useState<string>("any");
  const [corpusDict, setCorpusDict] = useState<Record<string, string[]> | null>(null);
  const [culturalProfile, setCulturalProfile] = useState<CulturalProfile>("latin");
  const [category, setCategory] = useState<NameCategory>("city");
  const [gender, setGender] = useState<Gender>("neutral");
  const [subType, setSubType] = useState<string>("generic"); // e.g. "dwarf", "elf", "tavern", "military-unit"
  const [order, setOrder] = useState<number>(3);
  const [options, setOptions] = useState<GenerateOptions>({
    minLength: 4,
    maxLength: 12,
    allowDuplicates: false,
  });

  // Track generation logs
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // tRPC query to fetch live database names
  const trainingCategory = mapCategoryForTraining(category);
  const { data: dbTrainingNames, refetch: refetchTraining } = api.onoma.getTrainingData.useQuery(
    { category: trainingCategory },
    { enabled: trainingMode === "ixworld", staleTime: 600000 }
  );

  // tRPC mutation to log activity when names are generated
  const logActivityMutation = api.onoma.logGeneration.useMutation();

  // Lazy-load the prebuilt corpus dictionary for the active category.
  const corpusCat = mapCategoryForCorpus(category);
  useEffect(() => {
    if (trainingMode !== "corpus") return;
    let cancelled = false;
    setCorpusDict(null);
    CORPUS_LOADERS[corpusCat]().then((m) => {
      if (!cancelled) setCorpusDict(m.default ?? (m as unknown as Record<string, string[]>));
    });
    return () => {
      cancelled = true;
    };
  }, [trainingMode, corpusCat]);

  // Instantiate client-side Markov Chain engine
  const chain = useMemo(() => new MarkovChain(order), [order]);

  // Train the Markov chain when parameters change
  useEffect(() => {
    chain.reset();
    chain.setOrder(order);

    if (trainingMode === "preset") {
      const seeds = CULTURAL_PROFILES[culturalProfile]?.[category] || [];
      if (seeds.length > 0) {
        chain.addWords(seeds);
      }
    } else if (trainingMode === "ixworld" && dbTrainingNames && dbTrainingNames.length > 0) {
      chain.addWords(dbTrainingNames);
    } else if (trainingMode === "corpus" && corpusDict) {
      const names =
        corpusBucket === "any"
          ? Object.values(corpusDict).flat()
          : corpusDict[corpusBucket] || [];
      if (names.length > 0) chain.addWords(names);
    }
  }, [trainingMode, culturalProfile, category, dbTrainingNames, corpusDict, corpusBucket, order, chain]);

  // Bucket options for the corpus culture facet (singles + compounds present in this dict).
  const corpusBuckets = useMemo(
    () => (corpusDict ? Object.keys(corpusDict).sort() : []),
    [corpusDict]
  );

  /**
   * Generates a batch of names based on current configuration and rule-based presets.
   */
  const generate = (count = 10): string[] => {
    setIsGenerating(true);
    const results: string[] = [];

    for (let i = 0; i < count; i++) {
      let name: string | null = null;

      // 1. Check if generating rule-based custom presets (non-Markov)
      if (category === "person" && subType !== "generic") {
        if (subType === "goblin") name = generateGoblinName();
        else if (subType === "orc") name = generateOrcName();
        else if (subType === "ogre") name = generateOgreName();
        else if (subType === "primitive") name = generatePrimitiveName(gender);
        else if (subType === "dwarf") name = generateDwarfName(gender);
        else if (subType === "halfling") name = generateHalflingName(gender);
        else if (subType === "gnome") name = generateGnomeName(gender);
        else if (subType === "elf") name = generateElfName(gender);
        else if (subType === "elf-alt") name = generateElfName(gender, true);
        else if (subType === "faery") name = generateFaeryName(gender);
        else if (subType === "faery-alt") name = generateFaeryName(gender, true);
        else if (subType === "dark-elf") name = generateDarkElfName(gender);
        else if (subType === "dark-elf-alt") name = generateDarkElfName(gender, true);
        else if (subType === "half-demon") name = generateHalfDemonName(gender);
        else if (subType === "dragon") name = generateDragonName(gender);
        else if (subType === "demon") name = generateDemonName();
        else if (subType === "angel") name = generateAngelName(gender);
      } else if (category === "organization" && subType !== "generic") {
        if (subType === "mystic-order") name = generateMysticOrderName();
        else if (subType === "military-unit") name = generateMilitaryUnitName();
        else if (subType === "covert-org") name = generateCovertOrgName();
        else if (subType === "tavern") name = generateTavernName(options);
      } else if (category === "dynasty" && subType === "fantasy-syllable") {
        name = generateFantasySyllableName();
      }

      // 2. Fallback to Markov chain generation
      if (!name) {
        name = chain.generate(options);
      }

      // 3. Fallback to generic syllable concatenation if Markov chain is empty or fails
      if (!name) {
        name = generateFantasySyllableName();
      }

      if (name) {
        results.push(name);
      }
    }

    setGeneratedNames(results);
    setIsGenerating(false);

    // Asynchronously log generation activity in feed
    if (results.length > 0) {
      logActivityMutation.mutateAsync({
        count: results.length,
        category: category,
      }).catch((err) => console.error("Failed to log generation activity:", err));
    }

    return results;
  };

  return {
    trainingMode,
    setTrainingMode,
    culturalProfile,
    setCulturalProfile,
    corpusBucket,
    setCorpusBucket,
    corpusBuckets,
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
    refetchTraining,
  };
}
