import { z } from "zod";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";

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
      const userId = ctx.user.id;
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
  saveProfile: rateLimitedMutationProcedure
    .input(
      z.object({
        id: z.string().optional(),
        languagePackId: z.string().optional(),
        name: z.string().min(1),
        wordOrder: z.string().default("SVO"),
        caseSystem: z.record(z.string(), z.unknown()).default({}),
        verbConjugation: z.record(z.string(), z.unknown()).default({}),
        articles: z.record(z.string(), z.unknown()).default({}),
        numberSystem: z.record(z.string(), z.unknown()).default({}),
        adjectiveOrder: z.string().default("before"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const data = {
        userId,
        languagePackId: input.languagePackId || null,
        name: input.name,
        wordOrder: input.wordOrder,
        caseSystem: (input.caseSystem ?? {}) as Prisma.InputJsonValue,
        verbConjugation: (input.verbConjugation ?? {}) as Prisma.InputJsonValue,
        articles: (input.articles ?? {}) as Prisma.InputJsonValue,
        numberSystem: (input.numberSystem ?? {}) as Prisma.InputJsonValue,
        adjectiveOrder: input.adjectiveOrder,
      };

      if (input.id) {
        // Verify ownership
        const existing = await ctx.db.grammarProfile.findFirst({
          where: { id: input.id, userId },
        });
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Profile not found or unauthorized",
          });
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
  deleteProfile: rateLimitedMutationProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const existing = await ctx.db.grammarProfile.findFirst({
        where: { id: input.id, userId },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found or unauthorized",
        });
      }

      return ctx.db.grammarProfile.delete({
        where: { id: input.id },
      });
    }),
});
