// src/hooks/useOnomaGenerator.ts
// Onoma Lab — Custom Hook for Client-side Generation

import { useState, useMemo, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { trainLM, naturalnessScore, type NgramLM } from "~/lib/onoma/perplexity";
import { CULTURAL_PROFILES } from "~/lib/onoma/cultural-profiles";
import { generateFantasySyllableName, generateNobleSurname } from "~/lib/onoma/name-generator";
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
  generateBusinessCompanyName,
  generateAcademicInstitutionName,
  generateMercenaryBandName,
} from "~/lib/onoma/group-generator";
import { generateTavernName } from "~/lib/onoma/tavern-generator";
import type { NameCategory, CulturalProfile, GenerateOptions, Gender } from "~/lib/onoma/types";

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

// Prebuilt wiki lexicon dictionaries (one chunk per category, lazy code-split).
type LexiconCat = "country" | "city" | "province" | "person" | "organization";
const LEXICON_LOADERS: Record<LexiconCat, () => Promise<{ default: Record<string, string[]> }>> = {
  country: () => import("~/lib/onoma/data/lexicon/country.json"),
  city: () => import("~/lib/onoma/data/lexicon/city.json"),
  province: () => import("~/lib/onoma/data/lexicon/province.json"),
  person: () => import("~/lib/onoma/data/lexicon/person.json"),
  organization: () => import("~/lib/onoma/data/lexicon/organization.json"),
};

function mapCategoryForLexicon(cat: NameCategory): LexiconCat {
  if (cat === "city" || cat === "geography") return "city";
  if (cat === "province") return "province";
  if (cat === "person" || cat === "dynasty") return "person";
  if (cat === "organization" || cat === "military") return "organization";
  return "country";
}

export function useOnomaGenerator() {
  const [culture, setCulture] = useState<string>("any");
  const [includeWorldData, setIncludeWorldData] = useState<boolean>(false);
  const [lexiconDict, setLexiconDict] = useState<Record<string, string[]> | null>(null);
  const [category, setCategory] = useState<NameCategory>("city");
  const [gender, setGender] = useState<Gender>("neutral");
  const [subType, setSubType] = useState<string>("generic"); // e.g. "dwarf", "elf", "tavern", "military-unit"
  const [order, setOrder] = useState<number>(3);
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

  // tRPC mutation to log activity when names are generated
  const logActivityMutation = api.onoma.logGeneration.useMutation();

  // Lazy-load the prebuilt lexicon dictionary for the active category.
  const lexiconCat = mapCategoryForLexicon(category);
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
  const lmRef = useRef<NgramLM | null>(null);

  // Instantiate client-side Markov Chain engines (both character-based and syllable-based)
  const characterChain = useMemo(() => new MarkovChain(order, "character"), [order]);
  const syllableChain = useMemo(() => new MarkovChain(Math.min(2, Math.max(1, order - 1)), "syllable"), [order]);

  // Train the Markov chains when parameters change
  useEffect(() => {
    characterChain.reset();
    characterChain.setOrder(order);

    syllableChain.reset();
    syllableChain.setOrder(Math.min(2, Math.max(1, order - 1)));

    const presetSeeds: string[] = [];
    if (culture === "any") {
      Object.values(CULTURAL_PROFILES).forEach((profile) => {
        const seeds = profile[category] || [];
        presetSeeds.push(...seeds);
      });
    } else {
      const seeds = CULTURAL_PROFILES[culture as CulturalProfile]?.[category] || [];
      presetSeeds.push(...seeds);
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
    if (allSeeds.length > 0) {
      characterChain.addWords(allSeeds);
      syllableChain.addWords(allSeeds);
    }
    // Phonotactic perplexity model over the same seeds (for naturalness scoring).
    lmRef.current = allSeeds.length > 0 ? trainLM(allSeeds, 3) : null;
  }, [culture, category, dbTrainingNames, lexiconDict, includeWorldData, order, characterChain, syllableChain, lmRef]);

  // Naturalness scorer (0–100) for a generated name, vs the current training set.
  const scoreNaturalness = (name: string): number | null =>
    lmRef.current ? naturalnessScore(name, lmRef.current) : null;

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
        if (subType === "mystic-order") name = generateMysticOrderName(characterChain, options);
        else if (subType === "military-unit") name = generateMilitaryUnitName(characterChain, options);
        else if (subType === "covert-org") name = generateCovertOrgName(characterChain, options);
        else if (subType === "tavern") name = generateTavernName(options);
        else if (subType === "business-company") name = generateBusinessCompanyName(characterChain, options);
        else if (subType === "academic-institution") name = generateAcademicInstitutionName(characterChain, options);
      } else if (category === "military" && subType !== "generic") {
        if (subType === "military-unit") name = generateMilitaryUnitName(characterChain, options);
        else if (subType === "mercenary-band") name = generateMercenaryBandName(characterChain, options);
      } else if (category === "dynasty" && subType !== "generic") {
        if (subType === "fantasy-syllable") name = generateFantasySyllableName();
        else if (subType === "noble-surname") name = generateNobleSurname(culture, characterChain, options);
      } else if (category === "city" && subType === "settlement-colony") {
        const base = characterChain.generate(options) || syllableChain.generate(options) || generateFantasySyllableName();
        const d3 = Math.floor(Math.random() * 3);
        const capitalized = MarkovChain.capitalize(base);
        if (d3 === 0) name = `New ${capitalized}`;
        else if (d3 === 1) name = `Port ${capitalized}`;
        else name = `${capitalized} Colony`;
      } else if (category === "geography" && subType === "natural-landmark") {
        const base = characterChain.generate(options) || syllableChain.generate(options) || generateFantasySyllableName();
        const suffixes = ["River", "Valley", "Mount", "Bay", "Lake", "Ridge", "Coast", "Canyon", "Forest", "Peak", "Hills"];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        name = `${MarkovChain.capitalize(base)} ${suffix}`;
      }

      // 2. Fallback to Markov chain generation
      if (!name) {
        name = characterChain.generate(options);
      }
      if (!name) {
        name = syllableChain.generate(options);
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
      logActivityMutation.mutateAsync({
        count: results.length,
        category: category,
      }).catch((err) => console.error("Failed to log generation activity:", err));
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
