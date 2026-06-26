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
function mapCategoryForTraining(cat: NameCategory): "country" | "city" | "province" | "geography" | "military" {
  if (cat === "city") return "city";
  if (cat === "province") return "province";
  if (cat === "geography") return "geography";
  if (cat === "military" || cat === "organization" || cat === "person" || cat === "dynasty") return "military";
  return "country";
}

export function useOnomaGenerator() {
  const [trainingMode, setTrainingMode] = useState<TrainingMode>("preset");
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
  const logActivityMutation = api.onoma.logActivity.useMutation();

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
    }
  }, [trainingMode, culturalProfile, category, dbTrainingNames, order, chain]);

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
