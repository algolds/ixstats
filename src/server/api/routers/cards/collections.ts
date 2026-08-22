// src/server/api/routers/cards.ts
// tRPC router for IxCards Phase 1

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

/**
 * Cards router for IxCards system
 * Provides endpoints for card browsing, management, and market operations
 */
export const cardsCollectionsRouter = createTRPCRouter({
  // ─── Collection CRUD ─────────────────────────────────────────────

  createCollection: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        isPublic: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const collection = await ctx.db.cardCollection.create({
        data: {
          userId,
          name: input.name,
          description: input.description,
          isPublic: input.isPublic,
        },
      });
      return collection;
    }),

  getMyCollections: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    return ctx.db.cardCollection.findMany({
      where: { userId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
  }),

  getCollectionCards: protectedProcedure
    .input(z.object({ collectionId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      // Verify ownership
      const collection = await ctx.db.cardCollection.findFirst({
        where: { id: input.collectionId, userId },
      });
      if (!collection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
      }
      return ctx.db.cardCollectionItem.findMany({
        where: { collectionId: input.collectionId },
        include: {
          cardOwnership: {
            include: {
              cards: true,
            },
          },
        },
        orderBy: { addedAt: "desc" },
      });
    }),

  addToCollection: protectedProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
        cardOwnershipId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      // Verify collection ownership
      const collection = await ctx.db.cardCollection.findFirst({
        where: { id: input.collectionId, userId },
      });
      if (!collection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
      }
      // Verify card ownership
      const card = await ctx.db.cardOwnership.findFirst({
        where: { id: input.cardOwnershipId, ownerId: userId },
      });
      if (!card) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Card not found in your inventory" });
      }
      return ctx.db.cardCollectionItem.create({
        data: {
          collectionId: input.collectionId,
          cardOwnershipId: input.cardOwnershipId,
        },
      });
    }),

  removeFromCollection: protectedProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
        cardOwnershipId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      // Verify collection ownership
      const collection = await ctx.db.cardCollection.findFirst({
        where: { id: input.collectionId, userId },
      });
      if (!collection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
      }
      return ctx.db.cardCollectionItem.deleteMany({
        where: {
          collectionId: input.collectionId,
          cardOwnershipId: input.cardOwnershipId,
        },
      });
    }),

  deleteCollection: protectedProcedure
    .input(z.object({ collectionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const collection = await ctx.db.cardCollection.findFirst({
        where: { id: input.collectionId, userId },
      });
      if (!collection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
      }
      await ctx.db.cardCollection.delete({ where: { id: input.collectionId } });
      return { success: true };
    }),

  /**
   * Fetch wiki article wikitext/excerpt on-demand for lore cards
   */
  getWikiArticleExcerpt: publicProcedure
    .input(
      z.object({
        articleTitle: z.string().min(1),
        wikiSource: z.enum(["ixwiki", "iiwiki"]),
      })
    )
    .query(async ({ input }) => {
      const { getArticleWikitext, getArticleIntro } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");
      const article = await getArticleWikitext(
        input.articleTitle,
        input.wikiSource as "ixwiki" | "iiwiki"
      );
      if (article?.wikitext) {
        return { extract: article.wikitext, wikitext: article.wikitext };
      }
      const result = await getArticleIntro(
        input.articleTitle,
        input.wikiSource as "ixwiki" | "iiwiki"
      );
      return { extract: result?.text ?? null, wikitext: result?.text ?? null };
    }),
});
