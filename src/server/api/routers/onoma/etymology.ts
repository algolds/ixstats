// src/server/api/routers/onoma/etymology.ts
// Onoma — Etymology Web sub-router

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const onomaEtymologyRouter = createTRPCRouter({
  /**
   * List all etymological roots for the current user.
   */
  listRoots: protectedProcedure
    .input(
      z
        .object({
          languagePackId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      return ctx.db.etymologyRoot.findMany({
        where: {
          userId,
          languagePackId: input?.languagePackId || null,
        },
        orderBy: { root: "asc" },
      });
    }),

  /**
   * Create a new etymology root.
   */
  createRoot: protectedProcedure
    .input(
      z.object({
        root: z.string().min(1),
        meaning: z.string().min(1),
        ipa: z.string().optional(),
        notes: z.string().optional(),
        languagePackId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      return ctx.db.etymologyRoot.create({
        data: {
          userId,
          root: input.root,
          meaning: input.meaning,
          ipa: input.ipa,
          notes: input.notes,
          languagePackId: input.languagePackId || null,
        },
      });
    }),

  /**
   * Delete an etymology root.
   */
  deleteRoot: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      // Ensure ownership
      const root = await ctx.db.etymologyRoot.findFirst({
        where: { id: input.id, userId },
      });

      if (!root) {
        throw new Error("Root not found or unauthorized");
      }

      return ctx.db.etymologyRoot.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Add a child/derivation word to a root or parent derivation.
   */
  addDerivation: protectedProcedure
    .input(
      z.object({
        rootId: z.string(),
        parentId: z.string().optional(),
        word: z.string().min(1),
        meaning: z.string().min(1),
        ipa: z.string().optional(),
        derivationType: z.string(), // prefix | suffix | compound | semantic-shift | reduplication
        morphemeAdded: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      // Validate root ownership
      const root = await ctx.db.etymologyRoot.findFirst({
        where: { id: input.rootId, userId },
      });

      if (!root) {
        throw new Error("Root not found or unauthorized");
      }

      // If parentId is provided, validate it belongs to the same root
      if (input.parentId) {
        const parent = await ctx.db.etymologyDerivation.findFirst({
          where: { id: input.parentId, rootId: input.rootId },
        });
        if (!parent) {
          throw new Error("Parent derivation not found under the same root.");
        }
      }

      return ctx.db.etymologyDerivation.create({
        data: {
          rootId: input.rootId,
          parentId: input.parentId || null,
          word: input.word,
          meaning: input.meaning,
          ipa: input.ipa,
          derivationType: input.derivationType,
          morphemeAdded: input.morphemeAdded,
          notes: input.notes,
        },
      });
    }),

  /**
   * Delete a derivation.
   */
  deleteDerivation: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      const derivation = await ctx.db.etymologyDerivation.findUnique({
        where: { id: input.id },
        include: { root: true },
      });

      if (!derivation || derivation.root.userId !== userId) {
        throw new Error("Derivation not found or unauthorized");
      }

      return ctx.db.etymologyDerivation.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Get the full tree of derivations for a specific root.
   * Returns a flat list of derivations; the client can build a tree structure using parentId.
   */
  getDerivations: protectedProcedure
    .input(
      z.object({
        rootId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      const root = await ctx.db.etymologyRoot.findFirst({
        where: { id: input.rootId, userId },
      });

      if (!root) {
        throw new Error("Root not found or unauthorized");
      }

      const list = await ctx.db.etymologyDerivation.findMany({
        where: { rootId: input.rootId },
        orderBy: { createdAt: "asc" },
      });

      return {
        root,
        derivations: list,
      };
    }),
});
