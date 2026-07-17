// src/server/api/routers/onoma/syntax.ts
// Onoma — Syntax & Sentence Builder sub-router

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const onomaSyntaxRouter = createTRPCRouter({
  /**
   * List all grammar profiles for the user.
   */
  listProfiles: protectedProcedure
    .input(
      z
        .object({
          languagePackId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      return ctx.db.grammarProfile.findMany({
        where: {
          userId,
          languagePackId: input?.languagePackId || null,
        },
        orderBy: { name: "asc" },
      });
    }),

  /**
   * Save (create or update) a grammar profile.
   */
  saveProfile: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        languagePackId: z.string().optional(),
        name: z.string().min(1),
        wordOrder: z.string().default("SVO"),
        caseSystem: z.any().default({}),
        verbConjugation: z.any().default({}),
        articles: z.any().default({}),
        numberSystem: z.any().default({}),
        adjectiveOrder: z.string().default("before"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      const data = {
        userId,
        languagePackId: input.languagePackId || null,
        name: input.name,
        wordOrder: input.wordOrder,
        caseSystem: input.caseSystem || {},
        verbConjugation: input.verbConjugation || {},
        articles: input.articles || {},
        numberSystem: input.numberSystem || {},
        adjectiveOrder: input.adjectiveOrder,
      };

      if (input.id) {
        // Verify ownership
        const existing = await ctx.db.grammarProfile.findFirst({
          where: { id: input.id, userId },
        });
        if (!existing) {
          throw new Error("Profile not found or unauthorized");
        }

        return ctx.db.grammarProfile.update({
          where: { id: input.id },
          data,
        });
      }

      return ctx.db.grammarProfile.create({
        data,
      });
    }),

  /**
   * Delete a grammar profile.
   */
  deleteProfile: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      const existing = await ctx.db.grammarProfile.findFirst({
        where: { id: input.id, userId },
      });
      if (!existing) {
        throw new Error("Profile not found or unauthorized");
      }

      return ctx.db.grammarProfile.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Compile and translate a structured sentence based on the grammar profile rules.
   */
  compileAndTranslate: protectedProcedure
    .input(
      z.object({
        profile: z.object({
          wordOrder: z.string(), // SVO, SOV, VSO, VOS, OVS, OSV
          caseSystem: z.record(z.string(), z.string()), // e.g. { nominative: "", accusative: "m", genitive: "s" }
          verbConjugation: z.record(z.string(), z.string()), // e.g. { past: "ed", present: "s", future: "lo" }
          articles: z.record(z.string(), z.string()), // e.g. { definite: "te", indefinite: "un" }
          numberSystem: z.record(z.string(), z.string()), // e.g. { plural: "s" }
          adjectiveOrder: z.string(), // before | after
        }),
        sentence: z.object({
          subject: z.string(),
          subjectPlural: z.boolean().default(false),
          subjectDefinite: z.boolean().default(true),
          subjectAdjectives: z.array(z.string()).default([]),

          object: z.string().optional(),
          objectPlural: z.boolean().default(false),
          objectDefinite: z.boolean().default(false),
          objectAdjectives: z.array(z.string()).default([]),

          verb: z.string().optional(),
          verbTense: z.string().default("present"), // present | past | future
        }),
        dictionary: z.record(z.string(), z.string()), // English word -> Conlang word mapping
      })
    )
    .mutation(({ input }) => {
      const { profile, sentence, dictionary } = input;

      const translateWord = (word: string) => {
        return dictionary[word.toLowerCase()] || `[${word}]`;
      };

      // Helper to build a noun phrase (Article + Adjectives + Noun + Case + Number)
      const buildNounPhrase = (
        noun: string,
        isPlural: boolean,
        isDefinite: boolean,
        adjectives: string[],
        caseType: "nominative" | "accusative"
      ) => {
        const translatedNoun = translateWord(noun);
        let inflectedNoun = translatedNoun;

        // Apply number inflection (e.g., plural suffix)
        if (isPlural && profile.numberSystem?.plural) {
          inflectedNoun += profile.numberSystem.plural;
        }

        // Apply case inflection (e.g., case suffix)
        const caseSuffix = profile.caseSystem?.[caseType];
        if (caseSuffix) {
          inflectedNoun += caseSuffix;
        }

        // Translate and format adjectives
        const transAdjectives = adjectives.map((adj) => translateWord(adj));

        // Get article
        let articleWord = "";
        if (isDefinite && profile.articles?.definite) {
          articleWord = profile.articles.definite;
        } else if (!isDefinite && profile.articles?.indefinite) {
          articleWord = profile.articles.indefinite;
        }

        // Combine based on adjective order rule
        const components: string[] = [];
        if (articleWord) {
          components.push(articleWord);
        }

        if (profile.adjectiveOrder === "before") {
          components.push(...transAdjectives);
          components.push(inflectedNoun);
        } else {
          components.push(inflectedNoun);
          components.push(...transAdjectives);
        }

        return components.join(" ");
      };

      // 1. Build Subject Phrase
      const subjectPhrase = buildNounPhrase(
        sentence.subject,
        sentence.subjectPlural,
        sentence.subjectDefinite,
        sentence.subjectAdjectives,
        "nominative"
      );

      // 2. Build Object Phrase (if exists)
      const objectPhrase = sentence.object
        ? buildNounPhrase(
            sentence.object,
            sentence.objectPlural,
            sentence.objectDefinite,
            sentence.objectAdjectives,
            "accusative"
          )
        : "";

      // 3. Build Verb Phrase (if exists)
      let verbPhrase = "";
      if (sentence.verb) {
        const translatedVerb = translateWord(sentence.verb);
        const tenseSuffix = profile.verbConjugation?.[sentence.verbTense] || "";
        verbPhrase = translatedVerb + tenseSuffix;
      }

      // 4. Arrange based on Word Order
      const order = profile.wordOrder; // SVO, SOV, VSO, VOS, OVS, OSV
      let finalSentence = "";

      if (!sentence.object || !sentence.verb) {
        // Intransitive or incomplete sentence
        if (sentence.verb) {
          finalSentence = order.startsWith("V")
            ? `${verbPhrase} ${subjectPhrase}`
            : `${subjectPhrase} ${verbPhrase}`;
        } else {
          finalSentence = subjectPhrase;
        }
      } else {
        // Transitive sentence: align S, V, O
        const parts = order.split(""); // ['S', 'V', 'O']
        const orderedWords = parts.map((part) => {
          if (part === "S") return subjectPhrase;
          if (part === "O") return objectPhrase;
          if (part === "V") return verbPhrase;
          return "";
        });
        finalSentence = orderedWords.filter(Boolean).join(" ");
      }

      // Capitalize first letter
      if (finalSentence.length > 0) {
        finalSentence = finalSentence.charAt(0).toUpperCase() + finalSentence.slice(1) + ".";
      }

      return {
        compiledText: finalSentence,
        steps: [
          `Dictionary lookup completed.`,
          `Subject phrase: "${subjectPhrase}" (Nominative case: "${profile.caseSystem?.nominative || "none"}", Plural: ${sentence.subjectPlural ? `"${profile.numberSystem?.plural || "none"}"` : "no"}).`,
          sentence.object
            ? `Object phrase: "${objectPhrase}" (Accusative case: "${profile.caseSystem?.accusative || "none"}", Plural: ${sentence.objectPlural ? `"${profile.numberSystem?.plural || "none"}"` : "no"}).`
            : `No object specified.`,
          sentence.verb
            ? `Verb phrase: "${verbPhrase}" conjugated for ${sentence.verbTense} tense (Suffix: "${profile.verbConjugation?.[sentence.verbTense] || "none"}").`
            : `No verb specified.`,
          `Word order pattern: ${order} applied to produce final clause.`,
        ].filter(Boolean),
      };
    }),
});
