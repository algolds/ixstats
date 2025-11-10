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
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { auctionService } from "~/lib/auction-service";

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketRouter = createTRPCRouter({
  /**
   * Create new auction
   * Admin-only endpoint
   */
  createAuction: adminProcedure
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
            userId: ctx.auth.userId,
            cardId: input.cardId,
            startingPrice: input.startingPrice,
            buyoutPrice: input.buyoutPrice,
            duration: parseInt(input.duration) as 30 | 60,
            isFeatured: input.isFeatured,
          },
          ctx.db
        );

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
  placeBid: adminProcedure
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

        await auctionService.placeBid(
          {
            userId: ctx.auth.userId,
            auctionId: input.auctionId,
            amount: input.amount,
          },
          ctx.db
        );

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
  executeBuyout: adminProcedure
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

        await auctionService.executeBuyout(
          {
            userId: ctx.auth.userId,
            auctionId: input.auctionId,
          },
          ctx.db
        );

        return {
          success: true,
          message: "Card purchased successfully!",
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
  cancelAuction: adminProcedure
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

        await auctionService.cancelAuction(
          {
            userId: ctx.auth.userId,
            auctionId: input.auctionId,
          },
          ctx.db
        );

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
  getActiveAuctions: adminProcedure
    .input(
      z.object({
        cardId: z.string().optional(),
        sellerId: z.string().optional(),
        isFeatured: z.boolean().optional(),
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
  getAuctionById: adminProcedure
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
  getBidHistory: adminProcedure
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
  getMyActiveAuctions: adminProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User ID not found in authentication context",
        });
      }

      const auctions = await ctx.db.cardAuction.findMany({
        where: {
          sellerId: ctx.auth.userId,
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
  getMyActiveBids: adminProcedure.query(async ({ ctx }) => {
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
          currentBidderId: ctx.auth.userId,
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
  getAuctionHistory: adminProcedure
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
        const where = {
          status: { in: ["COMPLETED", "CANCELLED"] },
          ...(input.userId ? { sellerId: input.userId } : {}),
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
  getMarketTrends: adminProcedure
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
  getFeaturedAuctions: adminProcedure
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
  getEndingSoon: adminProcedure
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
});
