// src/server/api/routers/cards.ts
// tRPC router for IxCards Phase 1

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import {
  getCard,
  getCards,
  calculateCardRarity,
  getCardMarketValue,
} from "~/lib/cards/card-service";
import { CardRarity, CardType } from "@prisma/client";
import { searchForumThreads } from "~/server/modules/forum";

/**
 * Cards router for IxCards system
 * Provides endpoints for card browsing, management, and market operations
 */
export const cardsBrowseRouter = createTRPCRouter({
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
        cteFilter: z.enum(["all", "cte_only", "active_only"]).optional(),
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
          cteFilter: input.cteFilter,
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

  /**
   * Search XenForo forum for threads related to a card/article title
   */
  searchForumForCard: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const threads = await searchForumThreads(input.query, 5);
      return threads;
    }),
});
