// src/server/api/routers/cards.ts
// tRPC router for IxCards Phase 1

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import {
  getCard,
  getCards,
  getUserCards,
  calculateCardRarity,
  updateCardStats,
  transferCard,
  getCardMarketValue,
} from "~/lib/card-service";
import { CardRarity, CardType } from "@prisma/client";
import { searchForumThreads } from "~/modules/forum";

/**
 * Cards router for IxCards system
 * Provides endpoints for card browsing, management, and market operations
 */
export const cardsRouter = createTRPCRouter({
  /**
   * Get cards with filters and pagination
   * Admin-only endpoint
   */
  getCards: protectedProcedure
    .input(
      z.object({
        season: z.number().int().min(1).optional(),
        rarity: z.string().optional(),
        type: z.string().optional(),
        search: z.string().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Validate and cast rarity enum if provided
        let rarity: CardRarity | undefined;
        if (input.rarity) {
          if (Object.values(CardRarity).includes(input.rarity as CardRarity)) {
            rarity = input.rarity as CardRarity;
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid rarity value: ${input.rarity}`,
            });
          }
        }

        // Validate and cast type enum if provided
        let type: CardType | undefined;
        if (input.type) {
          if (Object.values(CardType).includes(input.type as CardType)) {
            type = input.type as CardType;
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid card type value: ${input.type}`,
            });
          }
        }

        const result = await getCards(ctx.db, {
          season: input.season,
          rarity,
          type,
          search: input.search,
          limit: input.limit,
          offset: input.offset,
        });

        return result;
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getCards:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch cards",
        });
      }
    }),

  /**
   * Get card by ID with full details
   * Admin-only endpoint
   */
  getCardById: protectedProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const card = await getCard(ctx.db, input.cardId);
        return card;
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getCardById:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch card",
        });
      }
    }),

  /**
   * Get authenticated user's card inventory
   * Admin-only endpoint
   */
  getMyCards: protectedProcedure
    .input(
      z.object({
        sortBy: z.enum(["rarity", "acquired", "value"]).optional().default("acquired"),
        filterRarity: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User ID not found",
          });
        }

        // Validate and cast filterRarity enum if provided
        let filterRarity: CardRarity | undefined;
        if (input.filterRarity) {
          if (Object.values(CardRarity).includes(input.filterRarity as CardRarity)) {
            filterRarity = input.filterRarity as CardRarity;
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid rarity filter: ${input.filterRarity}`,
            });
          }
        }

        const ownerships = await getUserCards(ctx.db, ctx.user.id, input.sortBy, filterRarity);

        return ownerships;
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getMyCards:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user cards",
        });
      }
    }),

  /**
   * Get another user's card inventory (for trading/viewing collections)
   * Protected endpoint - requires authentication
   */
  getUserCards: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        sortBy: z.enum(["rarity", "acquired", "value"]).optional().default("acquired"),
        filterRarity: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Validate and cast filterRarity enum if provided
        let filterRarity: CardRarity | undefined;
        if (input.filterRarity) {
          if (Object.values(CardRarity).includes(input.filterRarity as CardRarity)) {
            filterRarity = input.filterRarity as CardRarity;
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid rarity filter: ${input.filterRarity}`,
            });
          }
        }

        // Get user's cards (respecting limit)
        const ownerships = await ctx.db.cardOwnership.findMany({
          where: {
            ownerId: input.userId,
            ...(filterRarity && {
              cards: {
                rarity: filterRarity,
              },
            }),
          },
          include: {
            cards: true,
          },
          orderBy:
            input.sortBy === "rarity"
              ? { cards: { rarity: "desc" } }
              : input.sortBy === "value"
                ? { cards: { marketValue: "desc" } }
                : { acquiredAt: "desc" },
          take: input.limit,
        });

        return ownerships;
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getUserCards:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user cards",
        });
      }
    }),

  /**
   * Get card statistics (supply, market value, recent trades)
   * Admin-only endpoint
   */
  getCardStats: protectedProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const card = await getCard(ctx.db, input.cardId);

        // Calculate current market value
        const marketValue = await getCardMarketValue(ctx.db, input.cardId);

        // Get recent trades (placeholder - will be implemented when CardTrade model is added)
        const recentTrades: any[] = [];

        // Get owners count from CardOwnership
        const ownersCount = await ctx.db.cardOwnership.count({
          where: { cardId: input.cardId },
        });

        return {
          totalSupply: card.totalSupply,
          marketValue,
          recentTrades,
          ownersCount,
        };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getCardStats:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch card statistics",
        });
      }
    }),

  /**
   * Get all cards for a specific country
   * Admin-only endpoint
   */
  getCardsByCountry: protectedProcedure
    .input(
      z.object({
        countryId: z.string().min(1),
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Verify country exists
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { id: true, name: true },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Get cards for this country
        const [total, cards] = await Promise.all([
          ctx.db.card.count({
            where: {
              countryId: input.countryId,
            },
          }),
          ctx.db.card.findMany({
            where: {
              countryId: input.countryId,
            },
            orderBy: [{ season: "desc" }, { rarity: "desc" }, { createdAt: "desc" }],
            take: input.limit,
            skip: input.offset,
          }),
        ]);

        return {
          cards,
          total,
          hasMore: input.offset + input.limit < total,
          country,
        };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getCardsByCountry:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch country cards",
        });
      }
    }),

  /**
   * Get featured cards (high rarity, special editions, trending)
   * Admin-only endpoint
   */
  getFeaturedCards: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get featured cards (legendary, epic, or special type)
        const cards = await ctx.db.card.findMany({
          where: {
            OR: [{ rarity: "LEGENDARY" }, { rarity: "EPIC" }, { cardType: "SPECIAL" }],
          },
          orderBy: [{ rarity: "desc" }, { marketValue: "desc" }, { createdAt: "desc" }],
          take: input.limit,
        });

        return cards;
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getFeaturedCards:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch featured cards",
        });
      }
    }),

  /**
   * Update card stats from nation data
   * Admin-only endpoint
   */
  updateCardStats: adminProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedCard = await updateCardStats(ctx.db, input.cardId);
        return updatedCard;
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in updateCardStats:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update card stats",
        });
      }
    }),

  /**
   * Transfer card to another user
   * Admin-only endpoint
   */
  transferCard: adminProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        toUserId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User ID not found",
          });
        }

        const result = await transferCard(ctx.db, ctx.user.id, input.toUserId, input.cardId);

        return result;
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in transferCard:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to transfer card",
        });
      }
    }),

  /**
   * Calculate card rarity
   * Admin-only endpoint for testing/preview
   */
  calculateRarity: adminProcedure
    .input(
      z.object({
        type: z.string(),
        economicTier: z.number().int().min(1).max(7).optional(),
        leaderboardRank: z.number().int().min(1).optional(),
        achievementCount: z.number().int().min(0).optional(),
        embassyCount: z.number().int().min(0).optional(),
        accountAge: z.number().int().min(0).optional(),
        articleLength: z.number().int().min(0).optional(),
        referenceCount: z.number().int().min(0).optional(),
        isFeatured: z.boolean().optional(),
        nsRarity: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        // Validate type enum if provided
        if (input.type && !Object.values(CardType).includes(input.type as CardType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid card type: ${input.type}`,
          });
        }

        const rarity = calculateCardRarity({
          type: input.type as CardType,
          economicTier: input.economicTier,
          leaderboardRank: input.leaderboardRank,
          achievementCount: input.achievementCount,
          embassyCount: input.embassyCount,
          accountAge: input.accountAge,
          articleLength: input.articleLength,
          referenceCount: input.referenceCount,
          isFeatured: input.isFeatured,
          nsRarity: input.nsRarity,
        });

        return { rarity };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in calculateRarity:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate rarity",
        });
      }
    }),

  /**
   * Get NS Import cards for the NS Library tab
   * Accessible to all authenticated users
   */
  getNSCards: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
        search: z.string().max(100).optional(),
        season: z.number().int().min(1).optional(),
        rarity: z.string().optional(),
        region: z.string().max(100).optional(),
        sortBy: z.enum(["marketValue", "rarity", "recent", "name"]).optional().default("rarity"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: Record<string, unknown> = {
          cardType: "NS_IMPORT",
        };

        if (input.season) {
          where.season = input.season;
        }

        if (input.rarity && Object.values(CardRarity).includes(input.rarity as CardRarity)) {
          where.rarity = input.rarity;
        }

        if (input.search) {
          where.OR = [
            { title: { contains: input.search.trim(), mode: "insensitive" } },
            { name: { contains: input.search.trim(), mode: "insensitive" } },
          ];
        }

        if (input.region) {
          where.stats = {
            path: ["region"],
            string_contains: input.region,
          };
        }

        let orderBy: Record<string, string>[];
        switch (input.sortBy) {
          case "marketValue":
            orderBy = [{ marketValue: "desc" }];
            break;
          case "name":
            orderBy = [{ title: "asc" }];
            break;
          case "recent":
            orderBy = [{ createdAt: "desc" }];
            break;
          case "rarity":
          default:
            orderBy = [{ marketValue: "desc" }];
            break;
        }

        const [total, cards] = await Promise.all([
          ctx.db.card.count({ where: where as any }),
          ctx.db.card.findMany({
            where: where as any,
            orderBy,
            take: input.limit,
            skip: input.offset,
          }),
        ]);

        return {
          cards,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getNSCards:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch NS cards",
        });
      }
    }),

  /**
   * Get NS Library statistics
   * Accessible to all authenticated users
   */
  getNSLibraryStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const [totalCards, cardsByRegion, lastSync] = await Promise.all([
        ctx.db.card.count({ where: { cardType: "NS_IMPORT" } }),
        ctx.db.$queryRaw`
            SELECT stats->>'region' as region, COUNT(*)::int as count
            FROM cards
            WHERE "cardType" = 'NS_IMPORT' AND stats->>'region' IS NOT NULL AND stats->>'region' != ''
            GROUP BY stats->>'region'
            ORDER BY count DESC
            LIMIT 20
          ` as Promise<Array<{ region: string; count: number }>>,
        ctx.db.syncLog.findFirst({
          where: { syncType: { startsWith: "NS_" } },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true, status: true, syncType: true },
        }),
      ]);

      return {
        totalCards,
        cardsByRegion: cardsByRegion ?? [],
        lastSync: lastSync
          ? { at: lastSync.startedAt, status: lastSync.status, type: lastSync.syncType }
          : null,
      };
    } catch (error) {
      console.error("[CARDS_ROUTER] Error in getNSLibraryStats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch NS library stats",
      });
    }
  }),

  /**
   * Get card market value
   * Admin-only endpoint
   */
  getMarketValue: protectedProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const marketValue = await getCardMarketValue(ctx.db, input.cardId);
        return { marketValue };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getMarketValue:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate market value",
        });
      }
    }),

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
      const userId = ctx.auth.userId;
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
    const userId = ctx.auth.userId;
    return ctx.db.cardCollection.findMany({
      where: { userId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
  }),

  getCollectionCards: protectedProcedure
    .input(z.object({ collectionId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
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
              cards: {
                include: {
                  country: {
                    select: { id: true, name: true, continent: true, region: true, flag: true },
                  },
                },
              },
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
      const userId = ctx.auth.userId;
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
      const userId = ctx.auth.userId;
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
      const userId = ctx.auth.userId;
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
   * Search XenForo forum for threads related to a card/article title
   */
  searchForumForCard: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const threads = await searchForumThreads(input.query, 5);
      return threads;
    }),

  /**
   * Fetch wiki article excerpt on-demand for lore cards without stored fullExcerpt
   */
  getWikiArticleExcerpt: protectedProcedure
    .input(
      z.object({
        articleTitle: z.string().min(1),
        wikiSource: z.enum(["ixwiki", "iiwiki"]),
      })
    )
    .query(async ({ input }) => {
      const { getArticleIntro } = await import("~/lib/wiki-bridge");
      const result = await getArticleIntro(
        input.articleTitle,
        input.wikiSource as "ixwiki" | "iiwiki"
      );
      return { extract: result?.text ?? null };
    }),
});
