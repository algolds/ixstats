// src/server/api/routers/onoma/batch.ts
// Onoma — Batch Generation sub-router

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { MarkovChain, tokenizeIntoSyllables } from "~/lib/onoma/markov-chain";
import { trainLM, naturalnessScore } from "~/lib/onoma/perplexity";
import { CULTURAL_PROFILES } from "~/lib/onoma/cultural-profiles";
import { translateToIPA } from "~/lib/onoma/phonology";
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
  generatePoliticalPartyName,
  generateGovernmentAgencyName,
  generateMediaOutletName,
  generateNgoName,
  generateReligiousOrderName,
} from "~/lib/onoma/group-generator";
import { generateTavernName } from "~/lib/onoma/tavern-generator";
import type { NameCategory, CulturalProfile } from "~/lib/onoma/types";

const FAMILY_PHONOTACTICS: Record<string, any> = {
  austronesian: { maxConsonantCluster: 1 },
  "east-asian": { maxConsonantCluster: 1 },
  arabic: { maxConsonantCluster: 2 },
  persian: { maxConsonantCluster: 2 },
  turkic: { maxConsonantCluster: 2 },
  indic: { maxConsonantCluster: 2 },
  african: { maxConsonantCluster: 2 },
  uralic: { maxConsonantCluster: 2 },
  germanic: { maxConsonantCluster: 3 },
  slavic: { maxConsonantCluster: 4 },
};

function mapCategoryForTraining(cat: NameCategory): "country" | "city" | "province" | "person" {
  if (cat === "city" || cat === "geography") return "city";
  if (cat === "province") return "province";
  if (cat === "military" || cat === "organization" || cat === "person" || cat === "dynasty")
    return "person";
  return "country";
}

function mapCategoryForLexicon(cat: NameCategory, subType?: string): string {
  if (cat === "culture") {
    if (subType === "sports") return "culture_sports";
    if (subType === "cuisine") return "culture_cuisine";
    return "culture_generic";
  }
  if (cat === "geography" && subType === "architecture") return "culture_architecture";
  if (cat === "city" || cat === "geography") return "city";
  if (cat === "province") return "province";
  if (cat === "person" || cat === "dynasty") return "person";
  if (cat === "organization" || cat === "military") return "organization";
  return "country";
}

export const onomaBatchRouter = createTRPCRouter({
  /**
   * Generates a batch of names matching the specified options.
   */
  batchGenerate: protectedProcedure
    .input(
      z.object({
        count: z.number().min(10).max(1000).default(50),
        category: z.string().min(1),
        culturalProfile: z.string().default("any"),
        trainingMode: z.enum(["ixworld", "preset", "lexicon"]).default("preset"),
        subType: z.string().optional().default("generic"),
        gender: z.enum(["male", "female", "neutral"]).optional().default("neutral"),
        selectedPrefix: z.string().optional(),
        customPrefix: z.string().optional(),
        selectedSuffix: z.string().optional(),
        customSuffix: z.string().optional(),
        order: z.number().min(1).max(5).default(2),
        options: z.object({
          minLength: z.number().optional(),
          maxLength: z.number().optional(),
          startsWith: z.string().optional(),
          endsWith: z.string().optional(),
          contains: z.string().optional(),
          excludes: z.string().optional(),
          allowDuplicates: z.boolean().optional(),
          maxConsonantCluster: z.number().optional(),
          maxVowelCluster: z.number().optional(),
          allowDoubleLetters: z.boolean().optional(),
          minSyllables: z.number().optional(),
          maxSyllables: z.number().optional(),
          mustEndWithVowel: z.boolean().optional(),
          mustEndWithConsonant: z.boolean().optional(),
        }).optional().default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const category = input.category as NameCategory;
      const culture = input.culturalProfile;
      const trainingMode = input.trainingMode;
      const order = input.order;

      // 1. Collect training seed words
      const presetSeeds: string[] = [];
      if (culture !== "constructed" && trainingMode === "preset") {
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
      if (trainingMode === "lexicon") {
        let lexiconDict: Record<string, string[]> | null = null;
        const lexiconCat = mapCategoryForLexicon(category, input.subType);
        try {
          // Dynamic import
          const lexiconModule = require(`~/lib/onoma/data/lexicon/${lexiconCat}.json`);
          lexiconDict = lexiconModule.default || lexiconModule;
        } catch (err) {
          console.error("Failed to load lexicon file on server:", err);
        }

        if (lexiconDict) {
          if (culture === "any") {
            lexiconSeeds.push(...Object.values(lexiconDict).flat());
          } else if (culture !== "constructed" && lexiconDict[culture]) {
            lexiconSeeds.push(...(lexiconDict[culture] || []));
          }
        }
      }

      const worldSeeds: string[] = [];
      if (trainingMode === "ixworld") {
        const trainingCategory = mapCategoryForTraining(category);
        if (trainingCategory === "country") {
          const countries = await ctx.db.country.findMany({ select: { name: true }, take: 100 });
          worldSeeds.push(...countries.map((c) => c.name));
        } else if (trainingCategory === "city") {
          const cities = await ctx.db.city.findMany({ select: { name: true }, take: 200 });
          worldSeeds.push(...cities.map((c) => c.name));
        } else if (trainingCategory === "province") {
          const subdivisions = await ctx.db.subdivision.findMany({ select: { name: true }, take: 150 });
          worldSeeds.push(...subdivisions.map((s) => s.name));
        } else {
          const officials = await ctx.db.governmentOfficial.findMany({ select: { name: true }, take: 150 });
          worldSeeds.push(...officials.map((o) => o.name));
        }
      }

      const allSeeds = [...presetSeeds, ...lexiconSeeds, ...worldSeeds];

      // 2. Train Markov Chains
      const characterChain = new MarkovChain(order, "character");
      const syllableChain = new MarkovChain(Math.min(2, Math.max(1, order - 1)), "syllable");

      if (allSeeds.length > 0) {
        characterChain.addWords(allSeeds);
        syllableChain.addWords(allSeeds);
      }

      const lm = allSeeds.length > 0 ? trainLM(allSeeds, 3) : null;
      const scoreNaturalness = (name: string): number | null =>
        lm ? naturalnessScore(name, lm) : null;

      // 3. Generate Loop
      const results: Array<{
        name: string;
        ipa: string;
        syllables: number;
        perplexity: number;
        length: number;
      }> = [];
      const generatedSet = new Set<string>();

      const maxAttempts = input.count * 10;
      let attempts = 0;

      const genOptions = {
        ...(FAMILY_PHONOTACTICS[culture] ?? {}),
        ...input.options,
      };

      while (results.length < input.count && attempts < maxAttempts) {
        attempts++;
        let name: string | null = null;

        // Custom presets logic
        if (category === "person" && input.subType && input.subType !== "generic") {
          if (input.subType === "goblin") name = generateGoblinName();
          else if (input.subType === "orc") name = generateOrcName();
          else if (input.subType === "ogre") name = generateOgreName();
          else if (input.subType === "primitive") name = generatePrimitiveName(input.gender);
          else if (input.subType === "dwarf") name = generateDwarfName(input.gender);
          else if (input.subType === "halfling") name = generateHalflingName(input.gender);
          else if (input.subType === "gnome") name = generateGnomeName(input.gender);
          else if (input.subType === "elf") name = generateElfName(input.gender);
          else if (input.subType === "elf-alt") name = generateElfName(input.gender, true);
          else if (input.subType === "faery") name = generateFaeryName(input.gender);
          else if (input.subType === "faery-alt") name = generateFaeryName(input.gender, true);
          else if (input.subType === "dark-elf") name = generateDarkElfName(input.gender);
          else if (input.subType === "dark-elf-alt") name = generateDarkElfName(input.gender, true);
          else if (input.subType === "half-demon") name = generateHalfDemonName(input.gender);
          else if (input.subType === "dragon") name = generateDragonName(input.gender);
          else if (input.subType === "demon") name = generateDemonName();
          else if (input.subType === "angel") name = generateAngelName(input.gender);
        } else if (category === "organization" && input.subType && input.subType !== "generic") {
          if (input.subType === "mystic-order") name = generateMysticOrderName(characterChain, genOptions);
          else if (input.subType === "military-unit") name = generateMilitaryUnitName(characterChain, genOptions);
          else if (input.subType === "covert-org") name = generateCovertOrgName(characterChain, genOptions);
          else if (input.subType === "tavern") name = generateTavernName(genOptions);
          else if (input.subType === "business-company") name = generateBusinessCompanyName(characterChain, genOptions);
          else if (input.subType === "academic-institution") name = generateAcademicInstitutionName(characterChain, genOptions);
          else if (input.subType === "political-party") name = generatePoliticalPartyName(characterChain, genOptions);
          else if (input.subType === "government-agency") name = generateGovernmentAgencyName(characterChain, genOptions);
          else if (input.subType === "media-outlet") name = generateMediaOutletName(characterChain, genOptions);
          else if (input.subType === "ngo-foundation") name = generateNgoName(characterChain, genOptions);
          else if (input.subType === "religious-order") name = generateReligiousOrderName(characterChain, genOptions);
        } else if (category === "military" && input.subType && input.subType !== "generic") {
          if (input.subType === "military-unit") name = generateMilitaryUnitName(characterChain, genOptions);
          else if (input.subType === "mercenary-band") name = generateMercenaryBandName(characterChain, genOptions);
        } else if (category === "dynasty" && input.subType && input.subType !== "generic") {
          if (input.subType === "fantasy-syllable") name = generateFantasySyllableName();
          else if (input.subType === "noble-surname") name = generateNobleSurname(culture, characterChain, genOptions);
        } else if (category === "city" && input.subType === "settlement-colony") {
          const base = characterChain.generate(genOptions) || syllableChain.generate(genOptions) || generateFantasySyllableName();
          const d3 = Math.floor(Math.random() * 3);
          const capitalized = MarkovChain.capitalize(base);
          if (d3 === 0) name = `New ${capitalized}`;
          else if (d3 === 1) name = `Port ${capitalized}`;
          else name = `${capitalized} Colony`;
        } else if (category === "geography" && input.subType === "natural-landmark") {
          const base = characterChain.generate(genOptions) || syllableChain.generate(genOptions) || generateFantasySyllableName();
          const suffixes = ["River", "Valley", "Mount", "Bay", "Lake", "Ridge", "Coast", "Canyon", "Forest", "Peak", "Hills"];
          const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
          name = `${MarkovChain.capitalize(base)} ${suffix}`;
        }

        if (!name) name = characterChain.generate(genOptions);
        if (!name) name = syllableChain.generate(genOptions);
        if (!name) name = generateFantasySyllableName();

        if (name) {
          let prefixStr = "";
          if (category === "person" && input.selectedPrefix) {
            if (input.selectedPrefix === "custom") {
              prefixStr = input.customPrefix ? input.customPrefix.trim() + " " : "";
            } else {
              prefixStr = input.selectedPrefix + " ";
            }
          }

          let suffixStr = "";
          if ((category === "organization" || category === "country" || category === "province") && input.selectedSuffix) {
            if (input.selectedSuffix === "custom") {
              suffixStr = input.customSuffix ? " " + input.customSuffix.trim() : "";
            } else {
              suffixStr = " " + input.selectedSuffix;
            }
          }

          const fullName = prefixStr + name + suffixStr;
          
          if (generatedSet.has(fullName)) continue;
          generatedSet.add(fullName);

          const ipa = translateToIPA(fullName, culture);
          const syllables = tokenizeIntoSyllables(fullName).length;
          const score = scoreNaturalness(fullName) ?? 50;

          results.push({
            name: fullName,
            ipa,
            syllables,
            perplexity: Math.round(score),
            length: fullName.length,
          });
        }
      }

      // Sort by perplexity score descending (highest naturalness first)
      results.sort((a, b) => b.perplexity - a.perplexity);

      return { names: results };
    }),
});
