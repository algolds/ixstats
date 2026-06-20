/**
 * MyVault Router
 *
 * tRPC router for IxCredits economy operations
 * Provides endpoints for:
 * - Balance queries
 * - Transaction history
 * - Daily bonuses and streaks
 * - Credit spending
 * - Vault level and earnings summaries
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";

/**
 * Vault transaction type enum for validation
 */
const vaultTransactionTypeEnum = z.enum([
  "EARN_PASSIVE",
  "EARN_ACTIVE",
  "EARN_CARDS",
  "EARN_SOCIAL",
  "SPEND_PACKS",
  "SPEND_MARKET",
  "SPEND_CRAFT",
  "SPEND_BOOST",
  "SPEND_COSMETIC",
  "ADMIN_ADJUSTMENT",
]);

export const vaultCollectionsRouter = createTRPCRouter({
  /**
   * Get vault balance and stats for a user
   */
  getMyCollections: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where = { userId: ctx.user.id };
        const [collections, total] = await Promise.all([
          ctx.db.cardCollection.findMany({
            where,
            include: {
              items: {
                include: {
                  cardOwnership: {
                    include: { cards: true },
                  },
                },
              },
              _count: { select: { likes: true, comments: true } },
            },
            orderBy: { updatedAt: "desc" },
            skip: input.offset,
            take: input.limit,
          }),
          ctx.db.cardCollection.count({ where }),
        ]);

        return {
          collections: collections.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
            description: c.description,
            isPublic: c.isPublic,
            cardCount: c.items.length,
            totalValue: c.items.reduce(
              (sum, i) => sum + (i.cardOwnership.cards?.marketValue ?? 0),
              0
            ),
            thumbnailCards: c.items
              .slice(0, 4)
              .map((i) => i.cardOwnership.cards?.id)
              .filter(Boolean),
            createdAt: c.createdAt,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[Vault Router] Error getting my collections:", error);
        throw new Error("Failed to retrieve collections");
      }
    }),

  /**
   * Create a new collection
   */
  createCollection: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        isPublic: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const collection = await ctx.db.cardCollection.create({
          data: {
            userId: ctx.user.id,
            name: input.name,
            description: input.description ?? null,
            isPublic: input.isPublic,
          },
        });

        return {
          success: true,
          collection: {
            ...collection,
            slug: collection.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
          },
        };
      } catch (error) {
        console.error("[Vault Router] Error creating collection:", error);
        throw new Error("Failed to create collection");
      }
    }),

  /**
   * Update collection (owner only)
   */
  updateCollection: protectedProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional().nullable(),
        isPublic: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.cardCollection.findUnique({
          where: { id: input.collectionId },
        });
        if (!existing || existing.userId !== ctx.user.id) {
          throw new Error("Collection not found or not owned by you");
        }

        await ctx.db.cardCollection.update({
          where: { id: input.collectionId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
          },
        });

        return { success: true };
      } catch (error) {
        console.error("[Vault Router] Error updating collection:", error);
        throw new Error("Failed to update collection");
      }
    }),

  /**
   * Delete collection (owner only)
   */
  deleteCollection: protectedProcedure
    .input(z.object({ collectionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.cardCollection.findUnique({
          where: { id: input.collectionId },
        });
        if (!existing || existing.userId !== ctx.user.id) {
          throw new Error("Collection not found or not owned by you");
        }

        await ctx.db.cardCollection.delete({ where: { id: input.collectionId } });
        return { success: true };
      } catch (error) {
        console.error("[Vault Router] Error deleting collection:", error);
        throw new Error("Failed to delete collection");
      }
    }),

  // ============================================
  // COLLECTION SOCIAL FEATURES
  // ============================================

  /**
   * Get public collections (browse all)
   */
  getPublicCollections: rateLimitedPublicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
        sortBy: z
          .enum(["newest", "mostValuable", "mostCards", "topRated"])
          .optional()
          .default("newest"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { limit, offset, sortBy } = input;

        const collections = await ctx.db.cardCollection.findMany({
          where: { isPublic: true },
          include: {
            User: { select: { id: true, clerkUserId: true } },
            items: {
              include: {
                cardOwnership: { include: { cards: { select: { marketValue: true, id: true } } } },
              },
            },
            _count: { select: { likes: true, comments: true } },
          },
          skip: offset,
          take: limit,
        });

        const total = await ctx.db.cardCollection.count({ where: { isPublic: true } });

        const enriched = collections.map((c) => ({
          ...c,
          cardCount: c.items.length,
          totalValue: c.items.reduce((s, i) => s + (i.cardOwnership.cards?.marketValue ?? 0), 0),
          likes: c._count.likes,
          comments: c._count.comments,
          slug: c.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        }));

        if (sortBy === "mostValuable") enriched.sort((a, b) => b.totalValue - a.totalValue);
        else if (sortBy === "mostCards") enriched.sort((a, b) => b.cardCount - a.cardCount);
        else if (sortBy === "topRated") enriched.sort((a, b) => b.likes - a.likes);

        return { collections: enriched.slice(0, limit), total, hasMore: offset + limit < total };
      } catch (error) {
        console.error("[Vault Router] Error getting public collections:", error);
        throw new Error("Failed to retrieve public collections");
      }
    }),

  /**
   * Get collection leaderboard with real aggregations
   */
  getCollectionLeaderboard: rateLimitedPublicProcedure
    .input(
      z.object({
        category: z.enum(["mostValuable", "mostComplete", "mostCards"]),
        limit: z.number().min(1).max(50).optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const collections = await ctx.db.cardCollection.findMany({
          where: { isPublic: true },
          include: {
            User: { select: { id: true, clerkUserId: true } },
            items: {
              include: {
                cardOwnership: { include: { cards: { select: { marketValue: true } } } },
              },
            },
            _count: { select: { likes: true } },
          },
        });

        const enriched = collections.map((c) => ({
          id: c.id,
          userId: c.userId,
          name: c.name,
          description: c.description,
          isPublic: c.isPublic,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          User: c.User,
          cardCount: c.items.length,
          value: c.items.reduce((s, i) => s + (i.cardOwnership.cards?.marketValue ?? 0), 0),
          completeness: 0,
          likes: c._count.likes,
          slug: c.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        }));

        const sorted = [...enriched];
        if (input.category === "mostValuable") sorted.sort((a, b) => b.value - a.value);
        else if (input.category === "mostCards") sorted.sort((a, b) => b.cardCount - a.cardCount);
        else if (input.category === "mostComplete")
          sorted.sort((a, b) => b.cardCount - a.cardCount);

        return {
          category: input.category,
          collections: sorted.slice(0, input.limit).map((c, i) => ({ ...c, rank: i + 1 })),
        };
      } catch (error) {
        console.error("[Vault Router] Error getting collection leaderboard:", error);
        throw new Error("Failed to retrieve collection leaderboard");
      }
    }),

  /**
   * Like/unlike a collection
   */
  likeCollection: protectedProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
        unlike: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.unlike) {
          await ctx.db.collectionLike.deleteMany({
            where: { collectionId: input.collectionId, userId: ctx.user.id },
          });
        } else {
          await ctx.db.collectionLike.upsert({
            where: {
              collectionId_userId: {
                collectionId: input.collectionId,
                userId: ctx.user.id,
              },
            },
            update: {},
            create: { collectionId: input.collectionId, userId: ctx.user.id },
          });
        }

        return {
          success: true,
          liked: !input.unlike,
          collectionId: input.collectionId,
          message: input.unlike ? "Collection unliked" : "Collection liked",
        };
      } catch (error) {
        console.error("[Vault Router] Error liking collection:", error);
        throw new Error("Failed to like collection");
      }
    }),

  /**
   * Add comment to collection
   */
  addCollectionComment: protectedProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
        content: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const comment = await ctx.db.collectionComment.create({
          data: {
            collectionId: input.collectionId,
            userId: ctx.user.id,
            content: input.content,
          },
        });

        return { success: true, comment };
      } catch (error) {
        console.error("[Vault Router] Error adding comment:", error);
        throw new Error("Failed to add comment");
      }
    }),

  /**
   * Get comments for a collection
   */
  getCollectionComments: rateLimitedPublicProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const [comments, total] = await Promise.all([
          ctx.db.collectionComment.findMany({
            where: { collectionId: input.collectionId },
            include: { User: { select: { id: true, clerkUserId: true } } },
            orderBy: { createdAt: "desc" },
            skip: input.offset,
            take: input.limit,
          }),
          ctx.db.collectionComment.count({ where: { collectionId: input.collectionId } }),
        ]);

        return { comments, total, hasMore: input.offset + input.limit < total };
      } catch (error) {
        console.error("[Vault Router] Error getting comments:", error);
        throw new Error("Failed to retrieve comments");
      }
    }),

  /**
   * Get collection details with real stats
   */
  getCollectionDetails: rateLimitedPublicProcedure
    .input(
      z.object({
        collectionId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const collection = await ctx.db.cardCollection.findUnique({
          where: { id: input.collectionId },
          include: {
            User: { select: { id: true, clerkUserId: true } },
            items: {
              include: {
                cardOwnership: { include: { cards: { select: { marketValue: true } } } },
              },
            },
            _count: { select: { likes: true, comments: true } },
          },
        });

        if (!collection) {
          throw new Error("Collection not found");
        }

        if (!collection.isPublic && collection.userId !== ctx.auth?.userId) {
          throw new Error("Collection is private");
        }

        const cardCount = collection.items.length;
        const totalValue = collection.items.reduce(
          (s, i) => s + (i.cardOwnership.cards?.marketValue ?? 0),
          0
        );

        return {
          collection: {
            ...collection,
            items: undefined,
            _count: undefined,
            slug: collection.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
          },
          stats: {
            cardCount,
            totalValue,
            likes: collection._count.likes,
            comments: collection._count.comments,
          },
        };
      } catch (error) {
        console.error("[Vault Router] Error getting collection details:", error);
        throw new Error("Failed to retrieve collection details");
      }
    }),

  /**
   * List all user vaults for admin credit controls
   */
});
