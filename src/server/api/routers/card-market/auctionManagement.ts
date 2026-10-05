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
import { grantCardXp } from "~/lib/cards/xp-utils";
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
        startingPrice: z.number().min(1, "Starting price must be at least 1 IxCredit"),
        buyoutPrice: z.number().min(1).optional(),
        duration: z.union([z.literal("30"), z.literal("60")]),
        isFeatured: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        assertAuthUserId(ctx);

        // Validate buyout price if provided
        if (input.buyoutPrice && input.buyoutPrice <= input.startingPrice) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Buyout price must be higher than starting price",
          });
        }

        const auction = await auctionService.createAuction(
          {
            userId: ctx.user.id,
            cardId: input.cardId,
            startingPrice: input.startingPrice,
            buyoutPrice: input.buyoutPrice,
            duration: parseInt(input.duration) as 30 | 60,
            isFeatured: input.isFeatured,
          },
          ctx.db
        );

        // Notification: auction listed (fire-and-forget)
        try {
          await notificationAPI.create({
            userId: ctx.auth.userId,
            title: "Auction Listed",
            message: `Your card is now up for auction. Ends in ${input.duration} minutes.`,
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

        return {
          success: true,
          auction,
          message: `Auction created successfully! Ends in ${input.duration} minutes.`,
        };
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

        await auctionService.executeBuyout(
          {
            userId: ctx.user.id,
            auctionId: input.auctionId,
          },
          ctx.db
        );

        // Notification: notify seller about buyout (fire-and-forget)
        let auctionXpResult: Awaited<ReturnType<typeof grantCardXp>> | null = null;
        try {
          const auction = await ctx.db.cardAuction.findUnique({
            where: { id: input.auctionId },
            select: {
              sellerId: true,
              buyoutPrice: true,
              cardInstanceId: true,
              User: {
                select: { clerkUserId: true },
              },
            },
          });
          if (auction && auction.User?.clerkUserId !== ctx.auth.userId) {
            await notificationAPI.create({
              userId: auction.User.clerkUserId,
              title: "Card Sold!",
              message: `Your card was purchased via buyout for ${auction.buyoutPrice} IxCredits`,
              type: "info",
              category: "economic",
              priority: "high",
              metadata: { auctionId: input.auctionId },
            });
          }

          // Grant XP to the purchased card (50 XP for winning via buyout)
          if (auction?.cardInstanceId) {
            auctionXpResult = await grantCardXp(ctx.db, auction.cardInstanceId, 50, "BUYOUT");
          }
        } catch (err) {
          console.warn(
            "[Card Market Router] Buyout notification/XP grant failed for auction",
            input.auctionId,
            err
          );
        }

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
          message: "Card purchased successfully!",
          leveledUp: auctionXpResult?.leveledUp ?? false,
          newLevel: auctionXpResult?.newLevel,
          xpGained: auctionXpResult?.xpGained,
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

        // Get bidder before cancellation (fire-and-forget notification)
        let currentBidderClerkId: string | null = null;
        let currentBidderId: string | null = null;
        try {
          const auction = await ctx.db.cardAuction.findUnique({
            where: { id: input.auctionId },
            select: { currentBidderId: true },
          });
          currentBidderId = auction?.currentBidderId ?? null;
          if (currentBidderId) {
            const bidder = await ctx.db.user.findUnique({
              where: { id: currentBidderId },
              select: { clerkUserId: true },
            });
            currentBidderClerkId = bidder?.clerkUserId ?? null;
          }
        } catch (err) {
          console.warn(
            "[Card Market Router] Bidder lookup failed for auction",
            input.auctionId,
            err
          );
        }

        await auctionService.cancelAuction(
          {
            userId: ctx.user.id,
            auctionId: input.auctionId,
          },
          ctx.db
        );

        // Notification: notify current bidder about cancellation
        try {
          if (currentBidderClerkId && currentBidderClerkId !== ctx.auth.userId) {
            await notificationAPI.create({
              userId: currentBidderClerkId,
              title: "Auction Cancelled",
              message: "An auction you bid on has been cancelled",
              type: "info",
              category: "economic",
              priority: "medium",
              metadata: { auctionId: input.auctionId },
            });
          }
        } catch (err) {
          console.warn(
            "[Card Market Router] Cancellation notification failed for auction",
            input.auctionId,
            err
          );
        }

        await Promise.all([
          // Invalidate seller
          globalCache.delete(`user_vault_stats:${ctx.user.id}`),
          globalCache.delete(`user_vault_balance:${ctx.user.id}`),
          ...(ctx.auth?.userId
            ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)]
            : []),
          // Invalidate current bidder if refunded
          ...(currentBidderId ? [globalCache.delete(`user_vault_balance:${currentBidderId}`)] : []),
          ...(currentBidderClerkId
            ? [globalCache.delete(`user_vault_balance:${currentBidderClerkId}`)]
            : []),
        ]);

        return {
          success: true,
          message: "Auction cancelled successfully. 50% of listing fee has been refunded.",
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
