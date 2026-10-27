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

import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { withAuctionFaces } from "~/lib/cards/hub/market-faces";
import { assertAuthUserId, AUCTION_CARD_INCLUDE } from "./_shared";

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketAuctionQueriesRouter = createTRPCRouter({
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

      // An ended listing stays here until it is settled
      return { auctions: await withAuctionFaces(ctx.db, ctx.user.id, auctions) };
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
});
