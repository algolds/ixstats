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
import { auctionService } from "~/lib/auction-service";

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketAuctionQueriesRouter = createTRPCRouter({
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
    })
});
