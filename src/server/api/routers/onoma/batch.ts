// src/server/api/routers/onoma/batch.ts
// Onoma — Batch Generation sub-router

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { MarkovChain, tokenizeIntoSyllables } from "~/lib/onoma/markov-chain";
import { trainLM, naturalnessScore } from "~/lib/onoma/perplexity";
import { CULTURAL_PROFILES } from "~/lib/onoma/cultural-profiles";
import { translateToIPA } from "~/lib/onoma/phonology";
import { generateFantasySyllableName, generatePresetName } from "~/lib/onoma/name-generator";
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

const LEXICON_LOADERS: Record<string, () => Promise<{ default: Record<string, string[]> }>> = {
  country: () => import("~/lib/onoma/data/lexicon/country.json"),
  city: () => import("~/lib/onoma/data/lexicon/city.json"),
  province: () => import("~/lib/onoma/data/lexicon/province.json"),
  person: () => import("~/lib/onoma/data/lexicon/person.json"),
  organization: () => import("~/lib/onoma/data/lexicon/organization.json"),
  culture_generic: () => import("~/lib/onoma/data/lexicon/culture_generic.json"),
  culture_sports: () => import("~/lib/onoma/data/lexicon/culture_sports.json"),
  culture_cuisine: () => import("~/lib/onoma/data/lexicon/culture_cuisine.json"),
  culture_architecture: () => import("~/lib/onoma/data/lexicon/culture_architecture.json"),
};

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
        options: z
          .object({
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
          })
          .optional()
          .default({}),
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
        const lexiconCat = mapCategoryForLexicon(category, input.subType);
        const loader = LEXICON_LOADERS[lexiconCat];
        if (loader) {
          try {
            const lexiconModule = await loader();
            const lexiconDict = lexiconModule.default || lexiconModule;
            if (lexiconDict) {
              if (culture === "any") {
                lexiconSeeds.push(...Object.values(lexiconDict).flat());
              } else if (culture !== "constructed" && lexiconDict[culture]) {
                lexiconSeeds.push(...(lexiconDict[culture] || []));
              }
            }
          } catch (err) {
            console.error("Failed to load lexicon file on server:", err);
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
          const subdivisions = await ctx.db.subdivision.findMany({
            select: { name: true },
            take: 150,
          });
          worldSeeds.push(...subdivisions.map((s) => s.name));
        } else {
          const officials = await ctx.db.governmentOfficial.findMany({
            select: { name: true },
            take: 150,
          });
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
        name = generatePresetName({
          category,
          subType: input.subType,
          gender: input.gender,
          culture,
          characterChain,
          syllableChain,
          options: genOptions,
        });

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
          if (
            (category === "organization" || category === "country" || category === "province") &&
            input.selectedSuffix
          ) {
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
