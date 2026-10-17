/**
 * Card Market Router
 *
 * tRPC router for IxCards marketplace and auction system
 * Provides endpoints for:
 * - Auction creation and management
 * - Bidding and buyouts
 * - Market analytics and trends
 * - Auction history and active listings
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { CardRarity, CardType } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { auctionService } from "~/lib/economy/auction-service";
import { withAuctionFaces } from "~/lib/cards/hub/market-faces";
import { assertAuthUserId, AUCTION_WITH_SELLER_INCLUDE, AUCTION_CARD_INCLUDE } from "./_shared";

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketAuctionQueriesRouter = createTRPCRouter({
  /**
   * Get active auctions with filters and pagination
   * Any signed-in user
   */
  getActiveAuctions: protectedProcedure
    .input(
      z.object({
        cardId: z.string().optional(),
        realmId: z.string().min(1).max(64).optional(),
        sellerId: z.string().optional(),
        isFeatured: z.boolean().optional(),
        rarity: z.nativeEnum(CardRarity).optional(),
        cardType: z.nativeEnum(CardType).optional(),
        minPrice: z.number().int().min(0).optional(),
        maxPrice: z.number().int().min(0).optional(),
        sortBy: z.enum(["ending_soon", "newest", "price_low", "price_high"]).optional(),
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const result = await auctionService.getActiveAuctions(
          {
            cardId: input.cardId,
            realmId: input.realmId,
            sellerId: input.sellerId,
            isFeatured: input.isFeatured,
            rarity: input.rarity,
            cardType: input.cardType,
            minPrice: input.minPrice,
            maxPrice: input.maxPrice,
            sortBy: input.sortBy,
            limit: input.limit,
            offset: input.offset,
          },
          ctx.db
        );

        return {
          ...result,
          auctions: await withAuctionFaces(ctx.db, ctx.user.id, result.auctions, true),
        };
      } catch (error) {
        console.error("[Card Market Router] Error getting active auctions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch active auctions",
        });
      }
    }),

  /**
   * Get user's active auctions (selling)
   * The signed-in seller's own listings
   */
  getMyActiveAuctions: protectedProcedure.query(async ({ ctx }) => {
    try {
      assertAuthUserId(ctx);

      const auctions = await ctx.db.cardAuction.findMany({
        where: {
          sellerId: ctx.user.id,
          status: "ACTIVE",
        },
        include: {
          ...AUCTION_CARD_INCLUDE,
          AuctionBid: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { endTime: "asc" },
      });

      // An ended listing stays here until it is settled, so the rule decides (the seller holds the copy)
      return { auctions: await withAuctionFaces(ctx.db, ctx.user.id, auctions, false) };
    } catch (error) {
      console.error("[Card Market Router] Error getting user auctions:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch your auctions",
      });
    }
  }),

  /**
   * Get ending soon auctions
   * Admin-only endpoint
   */
  getEndingSoon: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const now = new Date();
        const soon = new Date(now.getTime() + 60 * 60 * 1000); // Next hour

        const auctions = await ctx.db.cardAuction.findMany({
          where: {
            status: "ACTIVE",
            endTime: {
              gte: now,
              lte: soon,
            },
          },
          include: AUCTION_WITH_SELLER_INCLUDE,
          orderBy: { endTime: "asc" },
          take: input.limit,
        });

        return { auctions };
      } catch (error) {
        console.error("[Card Market Router] Error getting ending soon auctions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch ending soon auctions",
        });
      }
    }),
});
