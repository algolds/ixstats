// src/server/api/routers/cards.ts
// tRPC router for IxCards Phase 1

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";
import { CardType, CardRarity } from "@prisma/client";
import {
  createCard,
  getCard,
  getCards,
  getUserCards,
  calculateCardRarity,
  updateCardStats,
  transferCard,
  getCardMarketValue,
} from "~/lib/card-service";

/**
 * Cards router for IxCards system
 * Provides endpoints for card browsing, management, and market operations
 */
export const cardsRouter = createTRPCRouter({
  /**
   * Get cards with filters and pagination
   * Public endpoint with rate limiting (30 req/min)
   */
  getCards: rateLimitedPublicProcedure
    .input(
      z.object({
        season: z.number().int().min(1).optional(),
        rarity: z.nativeEnum(CardRarity).optional(),
        type: z.nativeEnum(CardType).optional(),
        search: z.string().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const result = await getCards(ctx.db, {
          season: input.season,
          rarity: input.rarity,
          type: input.type,
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
   * Public endpoint (no auth required)
   */
  getCardById: publicProcedure
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
   * Protected endpoint (requires authentication)
   */
  getMyCards: protectedProcedure
    .input(
      z.object({
        sortBy: z.enum(["rarity", "acquired", "value"]).optional().default("acquired"),
        filterRarity: z.nativeEnum(CardRarity).optional(),
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

        const ownerships = await getUserCards(
          ctx.db,
          ctx.user.id,
          input.sortBy,
          input.filterRarity
        );

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
   * Get card statistics (supply, market value, recent trades)
   * Public endpoint
   */
  getCardStats: publicProcedure
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

        return {
          totalSupply: card.totalSupply,
          marketValue,
          recentTrades,
          ownersCount: card.owners?.length || 0,
          lastTrade: card.lastTrade,
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
   * Public endpoint
   */
  getCardsByCountry: publicProcedure
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
            include: {
              country: {
                select: {
                  id: true,
                  name: true,
                  continent: true,
                  region: true,
                  flag: true,
                },
              },
            },
            orderBy: [
              { season: "desc" },
              { rarity: "desc" },
              { createdAt: "desc" },
            ],
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
   * Public endpoint with rate limiting
   */
  getFeaturedCards: rateLimitedPublicProcedure
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
            OR: [
              { rarity: CardRarity.LEGENDARY },
              { rarity: CardRarity.EPIC },
              { cardType: CardType.SPECIAL },
            ],
          },
          include: {
            country: {
              select: {
                id: true,
                name: true,
                continent: true,
                region: true,
                flag: true,
              },
            },
          },
          orderBy: [
            { rarity: "desc" },
            { marketValue: "desc" },
            { createdAt: "desc" },
          ],
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
   * Protected endpoint (admin or card owner)
   */
  updateCardStats: protectedProcedure
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
   * Protected endpoint (requires authentication)
   */
  transferCard: protectedProcedure
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

        const result = await transferCard(
          ctx.db,
          ctx.user.id,
          input.toUserId,
          input.cardId
        );

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
   * Public utility endpoint for testing/preview
   */
  calculateRarity: publicProcedure
    .input(
      z.object({
        type: z.nativeEnum(CardType),
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
        const rarity = calculateCardRarity({
          type: input.type,
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
   * Get card market value
   * Public endpoint
   */
  getMarketValue: publicProcedure
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
});
