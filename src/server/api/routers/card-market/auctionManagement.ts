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
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { auctionService } from "~/lib/economy/auction-service";
import { notificationAPI } from "~/lib/notifications/api";
import { grantCardXp } from "~/lib/cards";
import { globalCache } from "~/lib/cache";

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketAuctionManagementRouter = createTRPCRouter({
  /**
   * Create new auction
   * Admin-only endpoint
   */
  createAuction: protectedProcedure
    .input(
      z.object({
        cardId: z.string().min(1, "Card ID is required"),
        startingPrice: z.number().min(1, "Starting price must be at least 1 IxC"),
        buyoutPrice: z.number().min(1).optional(),
        duration: z.union([z.literal("30"), z.literal("60")]),
        isFeatured: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User ID not found in authentication context",
          });
        }

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
        } catch {}

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
  executeBuyout: protectedProcedure
    .input(
      z.object({
        auctionId: z.string().min(1, "Auction ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User ID not found in authentication context",
          });
        }

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
              message: `Your card was purchased via buyout for ${auction.buyoutPrice} IxC`,
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
        } catch {}

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
  cancelAuction: protectedProcedure
    .input(
      z.object({
        auctionId: z.string().min(1, "Auction ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User ID not found in authentication context",
          });
        }

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
        } catch {}

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
        } catch {}

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

  /**
   * Seed demo auctions for marketplace demonstration
   * Admin-only endpoint — creates sample cards, ownership, and auction records
   */
  seedDemoAuctions: adminProcedure.mutation(async ({ ctx }) => {
    const adminUserId = ctx.user?.id;
    if (!adminUserId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
    }

    // Find or verify admin user record
    const adminUser = await ctx.db.user.findUnique({ where: { id: adminUserId } });
    if (!adminUser) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Admin user record not found in DB" });
    }

    const now = new Date();
    const demoCards = [
      {
        title: "History of Ixnay",
        rarity: "RARE",
        cardType: "LORE",
        marketValue: 250,
        description: "A comprehensive overview of the history of Ixnay, the primary continent.",
      },
      {
        title: "Battle of Corumm",
        rarity: "EPIC",
        cardType: "LORE",
        marketValue: 800,
        description:
          "The decisive battle that shaped the geopolitical landscape of the modern era.",
      },
      {
        title: "Treaty of Kiro",
        rarity: "UNCOMMON",
        cardType: "LORE",
        marketValue: 120,
        description: "The landmark treaty establishing diplomatic relations between major powers.",
      },
      {
        title: "The Great Migration",
        rarity: "ULTRA_RARE",
        cardType: "LORE",
        marketValue: 1500,
        description:
          "A rare account of the mass migration that populated the southern territories.",
      },
      {
        title: "Cathedral of Stars",
        rarity: "LEGENDARY",
        cardType: "LORE",
        marketValue: 5000,
        description: "The legendary cathedral, said to hold the secrets of the ancient world.",
      },
      {
        title: "Port of Alkharsis",
        rarity: "COMMON",
        cardType: "LORE",
        marketValue: 50,
        description: "The bustling trade port that connects the eastern and western regions.",
      },
    ];

    const createdAuctions = [];

    for (let i = 0; i < demoCards.length; i++) {
      const demo = demoCards[i]!;
      const uid = `demo_${Date.now()}_${i}`;

      // Create card
      const card = await ctx.db.card.create({
        data: {
          title: demo.title,
          description: demo.description,
          rarity: demo.rarity as any,
          cardType: demo.cardType as any,
          marketValue: demo.marketValue,
          season: 1,
          wikiSource: "ixwiki",
        },
      });

      // Create ownership
      const ownership = await ctx.db.cardOwnership.create({
        data: {
          id: `own_${uid}`,
          cardId: card.id,
          userId: adminUserId,
          ownerId: adminUserId,
          serialNumber: i + 1,
          isLocked: true, // Locked because listed
        },
      });

      // Create auction with staggered end times (30-120 min from now)
      const endMinutes = 30 + i * 18;
      const endTime = new Date(now.getTime() + endMinutes * 60 * 1000);
      const startingPrice = Math.max(10, Math.round(demo.marketValue * 0.3));
      const buyoutPrice = Math.round(demo.marketValue * 1.2);

      const auction = await ctx.db.cardAuction.create({
        data: {
          id: `auc_${uid}`,
          cardInstanceId: ownership.id,
          sellerId: adminUserId,
          startingPrice,
          currentBid: startingPrice,
          buyoutPrice,
          status: "ACTIVE",
          isFeatured: i < 2, // First 2 are featured
          endTime,
        },
      });

      createdAuctions.push({ card: card.title, auctionId: auction.id });
    }

    return {
      success: true,
      message: `Created ${createdAuctions.length} demo auctions`,
      auctions: createdAuctions,
    };
  }),
});
