// src/server/api/routers/cards.ts
// tRPC router for IxCards Phase 1

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
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
import { CardRarity, CardType } from "@prisma/client";

/**
 * Cards router for IxCards system
 * Provides endpoints for card browsing, management, and market operations
 */
export const cardsRouter = createTRPCRouter({
  /**
   * Get cards with filters and pagination
   * Admin-only endpoint
   */
  getCards: adminProcedure
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
  getCardById: adminProcedure
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
  getMyCards: adminProcedure
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

        const ownerships = await getUserCards(
          ctx.db,
          ctx.user.id,
          input.sortBy,
          filterRarity
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
  getCardStats: adminProcedure
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
  getCardsByCountry: adminProcedure
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
   * Admin-only endpoint
   */
  getFeaturedCards: adminProcedure
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
              { rarity: "LEGENDARY" },
              { rarity: "EPIC" },
              { cardType: "SPECIAL" },
            ],
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
   * Get card market value
   * Admin-only endpoint
   */
  getMarketValue: adminProcedure
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
