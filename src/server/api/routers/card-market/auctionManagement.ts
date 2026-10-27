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
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { auctionService } from "~/lib/economy/auction-service";
import { notificationAPI } from "~/lib/notifications/api";
import { AUCTION_DURATIONS, AUCTION_DURATION_LABEL } from "~/lib/cards/market/auction-timing";
import { globalCache } from "~/lib/cache";
import { assertAuthUserId } from "./_shared";

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketAuctionManagementRouter = createTRPCRouter({
  /**
   * Create new auction
   * Admin-only endpoint
   */
  createAuction: rateLimitedMutationProcedure
    .input(
      z.object({
        cardId: z.string().min(1, "Card ID is required"),
        startingPrice: z.number().int().min(1, "Starting price must be at least 1 IxCredit"),
        buyoutPrice: z.number().int().min(1).optional(),
        duration: z.enum(AUCTION_DURATIONS),
        isFeatured: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        assertAuthUserId(ctx);

        // The service owns the price rules (a buy-now price above the start)
        const auction = await auctionService.createAuction(
          {
            userId: ctx.user.id,
            cardId: input.cardId,
            startingPrice: input.startingPrice,
            buyoutPrice: input.buyoutPrice,
            duration: input.duration,
            isFeatured: input.isFeatured,
          },
          ctx.db
        );
        const message = `Auction created. It ends in ${AUCTION_DURATION_LABEL[input.duration]}.`;

        // Notification: auction listed (fire-and-forget)
        try {
          await notificationAPI.create({
            userId: ctx.auth.userId,
            title: "Auction listed",
            message,
            type: "info",
            category: "economic",
            priority: "low",
            metadata: { auctionId: auction.id },
          });
        } catch (err) {
          console.warn(
            "[Card Market Router] Listing notification failed for auction",
            auction.id,
            err
          );
        }

        await Promise.all([
          globalCache.delete(`user_vault_stats:${ctx.user.id}`),
          globalCache.delete(`user_vault_balance:${ctx.user.id}`),
          ...(ctx.auth?.userId
            ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)]
            : []),
        ]);

        return { success: true, auction, message };
      } catch (error) {
        console.error("[Card Market Router] Error creating auction:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create auction",
        });
      }
    }),

  /**
   * Execute buyout (instant purchase)
   * Admin-only endpoint
   */
  executeBuyout: rateLimitedMutationProcedure
    .input(
      z.object({
        auctionId: z.string().min(1, "Auction ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        assertAuthUserId(ctx);

        const auctionInfo = await ctx.db.cardAuction.findUnique({
          where: { id: input.auctionId },
          select: {
            sellerId: true,
            User: {
              select: { clerkUserId: true },
            },
          },
        });

        // The service grants the copy's XP inside the buyout and tells the seller and bidders after it
        const { xp } = await auctionService.executeBuyout(
          {
            userId: ctx.user.id,
            auctionId: input.auctionId,
          },
          ctx.db
        );

        if (auctionInfo) {
          await Promise.all([
            // Invalidate buyer
            globalCache.delete(`user_vault_stats:${ctx.user.id}`),
            globalCache.delete(`user_vault_balance:${ctx.user.id}`),
            ...(ctx.auth?.userId
              ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)]
              : []),
            // Invalidate seller
            globalCache.delete(`user_vault_stats:${auctionInfo.sellerId}`),
            globalCache.delete(`user_vault_balance:${auctionInfo.sellerId}`),
            ...(auctionInfo.User?.clerkUserId
              ? [globalCache.delete(`user_vault_balance:${auctionInfo.User.clerkUserId}`)]
              : []),
          ]);
        }

        return {
          success: true,
          message: "Card purchased.",
          leveledUp: xp.leveledUp,
          newLevel: xp.newLevel,
          xpGained: xp.xpGained,
        };
      } catch (error) {
        console.error("[Card Market Router] Error executing buyout:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to execute buyout",
        });
      }
    }),

  /**
   * Cancel auction (only if no bids)
   * Admin-only endpoint
   */
  cancelAuction: rateLimitedMutationProcedure
    .input(
      z.object({
        auctionId: z.string().min(1, "Auction ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        assertAuthUserId(ctx);

        // An auction with a bid cannot be cancelled, so there is never a bidder to tell or refund
        const { refund } = await auctionService.cancelAuction(
          {
            userId: ctx.user.id,
            auctionId: input.auctionId,
          },
          ctx.db
        );

        await Promise.all([
          // Invalidate seller
          globalCache.delete(`user_vault_stats:${ctx.user.id}`),
          globalCache.delete(`user_vault_balance:${ctx.user.id}`),
          ...(ctx.auth?.userId
            ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)]
            : []),
        ]);

        return {
          success: true,
          message:
            refund > 0
              ? `Auction cancelled. We refunded ${refund} IxC of the listing fee.`
              : "Auction cancelled.",
        };
      } catch (error) {
        console.error("[Card Market Router] Error cancelling auction:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel auction",
        });
      }
    }),
});
