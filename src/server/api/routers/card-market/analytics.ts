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
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketAnalyticsRouter = createTRPCRouter({
  /**
   * A card's value history for the market chart: the card-values cron writes a row each time its value moves.
   */
  getCardValueHistory: protectedProcedure
    .input(z.object({ cardId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.db.cardValueHistory.findMany({
          where: { cardId: input.cardId },
          orderBy: { recordedAt: "asc" },
          take: 100,
        });
      } catch (error) {
        console.error("[Card Market Router] Error getting card value history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch value history",
        });
      }
    }),
});
