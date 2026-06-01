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
import { auctionService } from "~/lib/auction-service";
import { notificationAPI } from "~/lib/notification-api";
import { grantCardXp } from "~/lib/card-xp-utils";
import { globalCache } from "~/lib/advanced-cache-system";

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketRouter = createTRPCRouter({
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
          ...(ctx.auth?.userId ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)] : []),
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
            select: { clerkUserId: true }
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
          ...(ctx.auth?.userId ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)] : []),
          ...(previousBidderId ? [
            globalCache.delete(`user_vault_balance:${previousBidderId}`),
            ...(previousBidderClerkId ? [globalCache.delete(`user_vault_balance:${previousBidderClerkId}`)] : []),
          ] : []),
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
            ...(ctx.auth?.userId ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)] : []),
            // Invalidate seller
            globalCache.delete(`user_vault_stats:${auctionInfo.sellerId}`),
            globalCache.delete(`user_vault_balance:${auctionInfo.sellerId}`),
            ...(auctionInfo.User?.clerkUserId ? [globalCache.delete(`user_vault_balance:${auctionInfo.User.clerkUserId}`)] : []),
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
          ...(ctx.auth?.userId ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)] : []),
          // Invalidate current bidder if refunded
          ...(currentBidderId ? [globalCache.delete(`user_vault_balance:${currentBidderId}`)] : []),
          ...(currentBidderClerkId ? [globalCache.delete(`user_vault_balance:${currentBidderClerkId}`)] : []),
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
   * Get active auctions with filters and pagination
   * Admin-only endpoint
   */
  getActiveAuctions: protectedProcedure
    .input(
      z.object({
        cardId: z.string().optional(),
        sellerId: z.string().optional(),
        isFeatured: z.boolean().optional(),
        rarity: z.string().optional(),
        cardType: z.string().optional(),
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

        return result;
      } catch (error) {
        console.error("[Card Market Router] Error getting active auctions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch active auctions",
        });
      }
    }),

  /**
   * Get auction by ID with full details
   * Admin-only endpoint
   */
  getAuctionById: protectedProcedure
    .input(
      z.object({
        auctionId: z.string().min(1, "Auction ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const auction = await ctx.db.cardAuction.findUnique({
          where: { id: input.auctionId },
          include: {
            CardOwnership: {
              include: {
                cards: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    artwork: true,
                    rarity: true,
                    cardType: true,
                    season: true,
                    marketValue: true,
                    countryId: true,
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
            AuctionBid: {
              orderBy: { createdAt: "desc" },
              take: 10,
              include: {
                User: {
                  select: {
                    id: true,
                    clerkUserId: true,
                  },
                },
              },
            },
          },
        });

        if (!auction) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Auction not found",
          });
        }

        return auction;
      } catch (error) {
        console.error("[Card Market Router] Error getting auction:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch auction",
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
   * Get user's active auctions (selling)
   * Admin-only endpoint
   */
  getMyActiveAuctions: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User ID not found in authentication context",
        });
      }

      const auctions = await ctx.db.cardAuction.findMany({
        where: {
          sellerId: ctx.user.id,
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
          AuctionBid: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { endTime: "asc" },
      });

      return { auctions };
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
   * Get auction history (completed/cancelled)
   * Admin-only endpoint
   */
  getAuctionHistory: protectedProcedure
    .input(
      z.object({
        cardId: z.string().optional(),
        userId: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        let sellerId = input.userId;
        if (sellerId && sellerId.startsWith("user_")) {
          const dbUser = await ctx.db.user.findUnique({
            where: { clerkUserId: sellerId },
            select: { id: true },
          });
          if (dbUser) {
            sellerId = dbUser.id;
          }
        }
        const where = {
          status: { in: ["COMPLETED", "CANCELLED"] },
          ...(sellerId ? { sellerId } : {}),
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

        return {
          auctions,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[Card Market Router] Error getting auction history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch auction history",
        });
      }
    }),

  /**
   * Get market trends and analytics
   * Admin-only endpoint
   */
  getMarketTrends: protectedProcedure
    .input(
      z.object({
        cardId: z.string().optional(),
        timeRange: z.enum(["24h", "7d", "30d"]).optional().default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const trends = await auctionService.getMarketTrends(
          {
            cardId: input.cardId,
            timeRange: input.timeRange,
          },
          ctx.db
        );

        return trends;
      } catch (error) {
        console.error("[Card Market Router] Error getting market trends:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch market trends",
        });
      }
    }),

  /**
   * Get featured auctions (premium listings)
   * Admin-only endpoint
   */
  getFeaturedAuctions: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const auctions = await ctx.db.cardAuction.findMany({
          where: {
            status: "ACTIVE",
            isFeatured: true,
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
                    cardType: true,
                    marketValue: true,
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
          take: input.limit,
        });

        return { auctions };
      } catch (error) {
        console.error("[Card Market Router] Error getting featured auctions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch featured auctions",
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

  /**
   * Get card value history for market chart
   * Returns CardValueHistory records if available, or computes from completed auctions
   */
  getCardValueHistory: protectedProcedure
    .input(z.object({ cardId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const history = await ctx.db.cardValueHistory.findMany({
          where: { cardId: input.cardId },
          orderBy: { recordedAt: "asc" },
          take: 100,
        });

        if (history.length > 0) return history;

        // Fallback: compute from completed auctions for this card
        const ownerships = await ctx.db.cardOwnership.findMany({
          where: { cardId: input.cardId },
          select: { id: true },
        });

        if (ownerships.length === 0) return [];

        const auctions = await ctx.db.cardAuction.findMany({
          where: {
            cardInstanceId: { in: ownerships.map((o) => o.id) },
            status: "COMPLETED",
            finalPrice: { not: null },
          },
          orderBy: { endTime: "asc" },
          select: { finalPrice: true, endTime: true },
          take: 100,
        });

        return auctions.map((a) => ({
          cardId: input.cardId,
          value: a.finalPrice!,
          recordedAt: a.endTime,
        }));
      } catch (error) {
        console.error("[Card Market Router] Error getting card value history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch value history",
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

  /**
   * Dust a card for credits (30% of its market value)
   */
  dustCard: protectedProcedure
    .input(z.object({ cardId: z.string().min(1, "Card ID is required") }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Find the ownership record
      const ownership = await ctx.db.cardOwnership.findFirst({
        where: {
          id: input.cardId,
          ownerId: userId,
          isLocked: false,
        },
        include: {
          cards: true,
        },
      });

      if (!ownership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found or is locked",
        });
      }

      // Calculate dusted credits amount: 30% of card's market value
      const marketValue = ownership.cards.marketValue || 0;
      const creditsAmount = Math.max(1, Math.round(marketValue * 0.3));

      // Retrieve user's vault
      const vault = await ctx.db.myVault.findUnique({
        where: { userId },
      });
      if (!vault) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vault not found for user",
        });
      }

      // Atomically delete ownership and award credits
      await ctx.db.$transaction(async (tx) => {
        // Delete ownership record
        await tx.cardOwnership.delete({
          where: { id: ownership.id },
        });

        // Award credits to the user's vault
        const updatedVault = await tx.myVault.update({
          where: { userId },
          data: { credits: { increment: creditsAmount } },
        });

        // Log the vault transaction
        await tx.vaultTransaction.create({
          data: {
            vaultId: vault.id,
            credits: creditsAmount,
            balanceAfter: updatedVault.credits,
            type: "REFUND",
            source: "CARD_DUST",
            metadata: { cardId: ownership.cardId, serialNumber: ownership.serialNumber, marketValue },
          },
        });
      });

      return {
        success: true,
        creditsAwarded: creditsAmount,
        message: `Successfully dusted card for ${creditsAmount} IxC.`,
      };
    }),

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
  }),

  /**
   * Permanent inscription on a card ownership record
   */
  inscribeCard: protectedProcedure
    .input(
      z.object({
        ownershipId: z.string().min(1, "Ownership ID is required"),
        inscription: z.string().min(1, "Inscription cannot be empty").max(60, "Inscription must be 60 characters or less"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const ownership = await ctx.db.cardOwnership.findFirst({
        where: {
          id: input.ownershipId,
          ownerId: userId,
          isLocked: false,
        },
      });

      if (!ownership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not owned or is locked",
        });
      }

      if (ownership.inscription !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This card is already inscribed",
        });
      }

      const updated = await ctx.db.cardOwnership.update({
        where: { id: ownership.id },
        data: {
          inscription: input.inscription,
          inscribedById: userId,
          inscribedAt: new Date(),
        },
      });

      return {
        success: true,
        message: "Card successfully inscribed!",
        card: updated,
      };
    }),

  getCardTransferHistory: protectedProcedure
    .input(z.object({ ownershipId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const dbAny = ctx.db as any;
      const events = await dbAny.cardTransferEvent.findMany({
        where: { ownershipId: input.ownershipId },
        orderBy: { createdAt: "desc" },
      });

      // Fetch user names for all unique user IDs involved
      const userIds = Array.from(
        new Set(
          events
            .flatMap((e: any) => [e.fromUserId, e.toUserId])
            .filter(Boolean)
        )
      ) as string[];

      const users = await ctx.db.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          country: {
            select: { name: true, flag: true },
          },
        },
      });

      const userMap = new Map(
        users.map((u) => [
          u.id,
          u.country?.name || "System/Unknown",
        ])
      );

      return events.map((event: any) => ({
        ...event,
        fromUserName: event.fromUserId ? (userMap.get(event.fromUserId) || "Unknown") : null,
        toUserName: userMap.get(event.toUserId) || "Unknown",
      }));
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
      { title: "History of Ixnay", rarity: "RARE", cardType: "LORE", marketValue: 250, description: "A comprehensive overview of the history of Ixnay, the primary continent." },
      { title: "Battle of Corumm", rarity: "EPIC", cardType: "LORE", marketValue: 800, description: "The decisive battle that shaped the geopolitical landscape of the modern era." },
      { title: "Treaty of Kiro", rarity: "UNCOMMON", cardType: "LORE", marketValue: 120, description: "The landmark treaty establishing diplomatic relations between major powers." },
      { title: "The Great Migration", rarity: "ULTRA_RARE", cardType: "LORE", marketValue: 1500, description: "A rare account of the mass migration that populated the southern territories." },
      { title: "Cathedral of Stars", rarity: "LEGENDARY", cardType: "LORE", marketValue: 5000, description: "The legendary cathedral, said to hold the secrets of the ancient world." },
      { title: "Port of Alkharsis", rarity: "COMMON", cardType: "LORE", marketValue: 50, description: "The bustling trade port that connects the eastern and western regions." },
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
