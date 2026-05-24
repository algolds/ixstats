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
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { auctionService } from "~/lib/auction-service";
import { notificationAPI } from "~/lib/notification-api";

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
            type: "CARD",
            category: "economic",
            priority: "low",
            metadata: { auctionId: auction.id },
          }, ctx.db);
        } catch {}

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
              type: "CARD",
              category: "economic",
              priority: "medium",
              metadata: { auctionId: input.auctionId, amount: input.amount },
            }, ctx.db);
          }
        } catch {}

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

        await auctionService.executeBuyout(
          {
            userId: ctx.user.id,
            auctionId: input.auctionId,
          },
          ctx.db
        );

        // Notification: notify seller about buyout (fire-and-forget)
        try {
          const auction = await ctx.db.cardAuction.findUnique({
            where: { id: input.auctionId },
            select: {
              sellerId: true,
              buyoutPrice: true,
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
              type: "CARD",
              category: "economic",
              priority: "high",
              metadata: { auctionId: input.auctionId },
            }, ctx.db);
          }
        } catch {}

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
        try {
          const auction = await ctx.db.cardAuction.findUnique({
            where: { id: input.auctionId },
            select: { currentBidderId: true },
          });
          if (auction?.currentBidderId) {
            const bidder = await ctx.db.user.findUnique({
              where: { id: auction.currentBidderId },
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
              type: "CARD",
              category: "economic",
              priority: "medium",
              metadata: { auctionId: input.auctionId },
            }, ctx.db);
          }
        } catch {}

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
          rarity: demo.rarity,
          cardType: demo.cardType,
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
