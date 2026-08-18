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
import { auctionService } from "~/lib/economy/auction-service";
import { notificationAPI } from "~/lib/notifications/api";
import { globalCache } from "~/lib/advanced-cache-system";

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketBidsRouter = createTRPCRouter({
  /**
   * Place bid on auction
   * Admin-only endpoint
   */
  placeBid: protectedProcedure
    .input(
      z.object({
        auctionId: z.string().min(1, "Auction ID is required"),
        amount: z.number().min(1, "Bid amount must be at least 1 IxC"),
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

        const auctionBefore = await ctx.db.cardAuction.findUnique({
          where: { id: input.auctionId },
          select: { currentBidderId: true },
        });
        const previousBidderId = auctionBefore?.currentBidderId;
        let previousBidderClerkId: string | null = null;
        if (previousBidderId) {
          const prevUser = await ctx.db.user.findUnique({
            where: { id: previousBidderId },
            select: { clerkUserId: true },
          });
          previousBidderClerkId = prevUser?.clerkUserId ?? null;
        }

        await auctionService.placeBid(
          {
            userId: ctx.user.id,
            auctionId: input.auctionId,
            amount: input.amount,
          },
          ctx.db
        );

        // Notification: notify auction seller about new bid (fire-and-forget)
        try {
          const auction = await ctx.db.cardAuction.findUnique({
            where: { id: input.auctionId },
            select: {
              sellerId: true,
              User: {
                select: { clerkUserId: true },
              },
            },
          });
          if (auction && auction.User?.clerkUserId !== ctx.auth.userId) {
            await notificationAPI.create({
              userId: auction.User.clerkUserId,
              title: "New Bid on Your Auction",
              message: `Someone bid ${input.amount} IxC on your auction`,
              type: "info",
              category: "economic",
              priority: "medium",
              metadata: { auctionId: input.auctionId, amount: input.amount },
            });
          }
        } catch {}

        await Promise.all([
          globalCache.delete(`user_vault_balance:${ctx.user.id}`),
          ...(ctx.auth?.userId
            ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)]
            : []),
          ...(previousBidderId
            ? [
                globalCache.delete(`user_vault_balance:${previousBidderId}`),
                ...(previousBidderClerkId
                  ? [globalCache.delete(`user_vault_balance:${previousBidderClerkId}`)]
                  : []),
              ]
            : []),
        ]);

        return {
          success: true,
          message: `Bid of ${input.amount} IxC placed successfully!`,
        };
      } catch (error) {
        console.error("[Card Market Router] Error placing bid:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to place bid",
        });
      }
    }),

  /**
   * Get bid history for an auction
   * Admin-only endpoint
   */
  getBidHistory: protectedProcedure
    .input(
      z.object({
        auctionId: z.string().min(1, "Auction ID is required"),
        limit: z.number().int().min(1).max(100).optional().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const bids = await ctx.db.auctionBid.findMany({
          where: { auctionId: input.auctionId },
          orderBy: { createdAt: "desc" },
          take: input.limit,
          include: {
            User: {
              select: {
                id: true,
                clerkUserId: true,
              },
            },
          },
        });

        return { bids };
      } catch (error) {
        console.error("[Card Market Router] Error getting bid history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch bid history",
        });
      }
    }),

  /**
   * Get user's active bids
   * Admin-only endpoint
   */
  getMyActiveBids: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User ID not found in authentication context",
        });
      }

      // Get auctions where user is current bidder
      const auctions = await ctx.db.cardAuction.findMany({
        where: {
          currentBidderId: ctx.user.id,
          status: "ACTIVE",
        },
        include: {
          CardOwnership: {
            include: {
              cards: {
                select: {
                  id: true,
                  title: true,
                  artwork: true,
                  rarity: true,
                },
              },
            },
          },
          User: {
            select: {
              id: true,
              clerkUserId: true,
            },
          },
        },
        orderBy: { endTime: "asc" },
      });

      return { auctions };
    } catch (error) {
      console.error("[Card Market Router] Error getting user bids:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch your bids",
      });
    }
  }),

  /**
   * Get past auctions the current user participated in
   * Returns completed/cancelled auctions where user was seller, winner, or bidder
   */
  getMyAuctionParticipation: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.user.id;

        const where = {
          status: { in: ["COMPLETED", "CANCELLED"] as string[] },
          OR: [
            { sellerId: userId },
            { winnerId: userId },
            { AuctionBid: { some: { bidderId: userId } } },
          ],
        };

        const [total, auctions] = await Promise.all([
          ctx.db.cardAuction.count({ where }),
          ctx.db.cardAuction.findMany({
            where,
            include: {
              CardOwnership: {
                include: {
                  cards: {
                    select: {
                      id: true,
                      title: true,
                      artwork: true,
                      rarity: true,
                      cardType: true,
                    },
                  },
                },
              },
              User: {
                select: {
                  id: true,
                  clerkUserId: true,
                },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: input.limit,
            skip: input.offset,
          }),
        ]);

        const enriched = auctions.map((a) => {
          let role: "won" | "sold" | "bid" | "cancelled" = "bid";
          if (a.status === "CANCELLED") {
            role = "cancelled";
          } else if (a.winnerId === userId) {
            role = "won";
          } else if (a.sellerId === userId) {
            role = "sold";
          }
          return { ...a, participation: role };
        });

        return {
          auctions: enriched,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[Card Market Router] Error getting auction participation:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch auction history",
        });
      }
    }),
});
