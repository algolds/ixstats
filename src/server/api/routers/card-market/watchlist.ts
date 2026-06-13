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
export const cardMarketWatchlistRouter = createTRPCRouter({
  /**
   * Add a card to the user's watchlist
   */
  addToWatchlist: protectedProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        targetPrice: z.number().int().min(1).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      // Ensure the card exists
      const cardExists = await ctx.db.card.findUnique({
        where: { id: input.cardId },
      });
      if (!cardExists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found",
        });
      }

      const watch = await ctx.db.cardWatchlist.upsert({
        where: {
          userId_cardId: {
            userId,
            cardId: input.cardId,
          },
        },
        create: {
          userId,
          cardId: input.cardId,
          targetPrice: input.targetPrice,
        },
        update: {
          targetPrice: input.targetPrice,
        },
      });

      return { success: true, watch };
    }),

  /**
   * Remove a card from the user's watchlist
   */
  removeFromWatchlist: protectedProcedure
    .input(z.object({ cardId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      try {
        await ctx.db.cardWatchlist.delete({
          where: {
            userId_cardId: {
              userId,
              cardId: input.cardId,
            },
          },
        });
      } catch (e) {
        // Ignore if doesn't exist
      }
      return { success: true };
    }),

  /**
   * Get user's watchlist
   */
  getWatchlist: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const watchlist = await ctx.db.cardWatchlist.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            CardOwnership: {
              where: { ownerId: userId },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return watchlist;
  })
});
