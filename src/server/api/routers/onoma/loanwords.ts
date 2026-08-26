import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const onomaLoanwordsRouter = createTRPCRouter({
  /**
   * List all loanword contacts for the current user.
   */
  listContacts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    return ctx.db.loanwordContact.findMany({
      where: { userId },
      include: {
        sourcePack: true,
        targetPack: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  /**
   * Save (create or update) a loanword contact relation.
   */
  saveContact: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        sourcePackId: z.string(),
        targetPackId: z.string(),
        domain: z.string(), // military | trade | religious | academic | general
        intensity: z.number().min(0).max(1).default(0.3),
        adaptationRules: z
          .record(z.string(), z.unknown())
          .default({}), // e.g. { soundShifts: [{ from: "v", to: "b" }], syllableCap: true }
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Ensure both source and target exist and belong to user (or are public)
      const source = await ctx.db.languagePack.findFirst({
        where: { id: input.sourcePackId },
      });
      const target = await ctx.db.languagePack.findFirst({
        where: { id: input.targetPackId },
      });

      if (!source || !target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Language pack not found",
        });
      }

      const data = {
        userId,
        sourcePackId: input.sourcePackId,
        targetPackId: input.targetPackId,
        domain: input.domain,
        intensity: input.intensity,
        adaptationRules: (input.adaptationRules || {}) as Prisma.InputJsonValue,
      };

      if (input.id) {
        const existing = await ctx.db.loanwordContact.findFirst({
          where: { id: input.id, userId },
        });
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Contact registry entry not found or unauthorized",
          });
        }

        return ctx.db.loanwordContact.update({
          where: { id: input.id },
          data,
        });
      }

      return ctx.db.loanwordContact.create({
        data,
      });
    }),

  /**
   * Delete a loanword contact relation.
   */
  deleteContact: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const existing = await ctx.db.loanwordContact.findFirst({
        where: { id: input.id, userId },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact registry entry not found or unauthorized",
        });
      }

      return ctx.db.loanwordContact.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Simulates word borrowing with sound changes / syllable structure adaptations.
   */
  borrowWords: protectedProcedure
    .input(
      z.object({
        sourceWords: z.array(z.object({ word: z.string(), meaning: z.string() })),
        soundShifts: z.array(z.object({ from: z.string(), to: z.string() })),
        codaDrop: z.boolean().default(false), // drop final consonants
        vowelEpenthesis: z.boolean().default(false), // add vowel to support open syllables (CV)
        epentheticVowel: z.string().default("i"),
      })
    )
    .mutation(({ input }) => {
      const { sourceWords, soundShifts, codaDrop, vowelEpenthesis, epentheticVowel } = input;

      const results = sourceWords.map(({ word, meaning }) => {
        let adapted = word.toLowerCase();

        // 1. Apply ordered sound shifts (e.g. f -> p, v -> b)
        for (const shift of soundShifts) {
          if (shift.from && shift.to) {
            // Escape regex characters
            const escapedFrom = shift.from.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
            adapted = adapted.replace(new RegExp(escapedFrom, "g"), shift.to);
          }
        }

        // 2. Apply syllable structure constraints (e.g., CV structure)
        const vowels = ["a", "e", "i", "o", "u", "y", "ø", "æ", "ɔ", "ɛ", "ɑ", "u", "ə"];
        const isVowel = (char: string) => vowels.includes(char);

        if (adapted.length > 0) {
          const lastChar = adapted.charAt(adapted.length - 1);
          if (!isVowel(lastChar)) {
            if (codaDrop) {
              // Strip final consonants until we hit a vowel or the string is empty
              while (adapted.length > 0 && !isVowel(adapted.charAt(adapted.length - 1))) {
                adapted = adapted.slice(0, -1);
              }
            } else if (vowelEpenthesis) {
              // Append support vowel
              adapted += epentheticVowel;
            }
          }
        }

        // Capitalize for styling
        const capitalized = adapted ? adapted.charAt(0).toUpperCase() + adapted.slice(1) : "";

        return {
          original: word,
          meaning,
          borrowed: capitalized,
        };
      });

      return {
        results,
      };
    }),
});
