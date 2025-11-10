/**
 * Auction Service
 *
 * Comprehensive auction engine for IxCards marketplace
 * Handles auction creation, bidding, buyouts, completions, and market analytics
 *
 * Features:
 * - Atomic transactions for race condition protection
 * - IxCredits integration via vault-service
 * - IxTime-based auction timing
 * - Auto-extension for last-minute bids
 * - Market fee calculation (10% on sales >100 IxC)
 * - Listing fees (5 IxC standard, 10 IxC featured)
 * - Bid validation (5% minimum increment)
 */

import { prisma } from "~/server/db";
import { vaultService } from "./vault-service";
import { IxTime } from "./ixtime";
import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";

export class AuctionService {
  /**
   * Create new auction listing
   *
   * Validates ownership, deducts listing fee, creates auction, locks card
   *
   * @param params Auction creation parameters
   * @param db Prisma client
   * @returns Created auction record
   */
  async createAuction(
    params: {
      userId: string;
      cardId: string;
      startingPrice: number;
      buyoutPrice?: number;
      duration: 30 | 60; // minutes (30 = express, 60 = standard)
      isFeatured?: boolean;
    },
    db: PrismaClient
  ) {
    // 1. Validate card ownership
    const ownership = await db.cardOwnership.findFirst({
      where: {
        ownerId: params.userId,
        cardId: params.cardId,
        isLocked: false,
      },
      include: {
        cards: true,
      },
    });

    if (!ownership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not own this card or it is already locked",
      });
    }

    // 2. Validate pricing
    if (params.startingPrice < 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Starting price must be at least 1 IxC",
      });
    }

    if (params.buyoutPrice && params.buyoutPrice <= params.startingPrice) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Buyout price must be higher than starting price",
      });
    }

    // 3. Calculate listing fees
    const listingFee = params.isFeatured ? 10 : 5; // Featured costs 10 IxC, standard 5 IxC
    const balanceResult = await vaultService.getBalance(params.userId, db);

    if (balanceResult.credits < listingFee) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Insufficient balance for listing fee. Need ${listingFee} IxC, have ${balanceResult.credits} IxC`,
      });
    }

    // 4. Deduct listing fee
    const spendResult = await vaultService.spendCredits(
      params.userId,
      listingFee,
      "SPEND_MARKET",
      "auction_listing_fee",
      db,
      {
        cardId: params.cardId,
        isFeatured: params.isFeatured ?? false,
        duration: params.duration,
      }
    );

    if (!spendResult.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: spendResult.message ?? "Failed to deduct listing fee",
      });
    }

    // 5. Calculate end time (using IxTime)
    const now = IxTime.getCurrentIxTime();
    const endTime = now + params.duration * 60 * 1000; // Convert minutes to ms

    // 6. Create auction and lock card (atomic transaction)
    try {
      const auction = await db.$transaction(async (tx) => {
        const newAuction = await tx.cardAuction.create({
          data: {
            id: `auction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            cardInstanceId: ownership.id,
            sellerId: params.userId,
            startingPrice: params.startingPrice,
            currentBid: params.startingPrice,
            buyoutPrice: params.buyoutPrice,
            endTime: new Date(endTime),
            isFeatured: params.isFeatured ?? false,
            status: "ACTIVE",
          },
        });

        // Lock the card ownership
        await tx.cardOwnership.update({
          where: {
            id: ownership.id,
          },
          data: { isLocked: true },
        });

        return newAuction;
      });

      console.log(
        `[Auction Service] Created auction ${auction.id} for card ${params.cardId} by user ${params.userId}`
      );

      return auction;
    } catch (error) {
      // Refund listing fee if auction creation fails
      await vaultService.earnCredits(
        params.userId,
        listingFee,
        "EARN_ACTIVE",
        "auction_listing_fee_refund",
        db,
        { error: String(error) }
      );

      console.error("[Auction Service] Failed to create auction:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create auction. Listing fee has been refunded.",
      });
    }
  }

  /**
   * Place bid on auction
   *
   * Validates bid amount, reserves credits, refunds previous bidder, extends auction if needed
   *
   * @param params Bid parameters
   * @param db Prisma client
   * @returns Success result
   */
  async placeBid(
    params: {
      userId: string;
      auctionId: string;
      amount: number;
    },
    db: PrismaClient
  ) {
    // 1. Fetch auction with current bid info
    const auction = await db.cardAuction.findUnique({
      where: { id: params.auctionId },
      include: {
        CardOwnership: {
          include: {
            cards: true,
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

    if (auction.status !== "ACTIVE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Auction is not active",
      });
    }

    // Cannot bid on own auction
    if (auction.sellerId === params.userId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot bid on your own auction",
      });
    }

    // Check if auction expired
    const now = IxTime.getCurrentIxTime();
    if (new Date(auction.endTime).getTime() < now) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Auction has expired",
      });
    }

    // 2. Validate bid amount (must exceed current by 5%)
    const minBid = Math.ceil((auction.currentBid ?? auction.startingPrice) * 1.05);
    if (params.amount < minBid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Bid must be at least ${minBid} IxC (5% higher than current bid)`,
      });
    }

    // 3. Check bidder balance
    const userBalance = await vaultService.getBalance(params.userId, db);
    if (userBalance.credits < params.amount) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Insufficient balance. You have ${userBalance.credits} IxC but need ${params.amount} IxC`,
      });
    }

    // 4. Execute bid in atomic transaction
    try {
      await db.$transaction(async (tx) => {
        // Reserve from new bidder
        const spendResult = await vaultService.spendCredits(
          params.userId,
          params.amount,
          "SPEND_MARKET",
          "auction_bid_reserve",
          tx as PrismaClient,
          {
            auctionId: params.auctionId,
            cardInstanceId: auction.cardInstanceId,
          }
        );

        if (!spendResult.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: spendResult.message ?? "Failed to reserve bid amount",
          });
        }

        // Refund previous bidder (if any)
        if (auction.currentBidderId && auction.currentBidderId !== params.userId) {
          await vaultService.earnCredits(
            auction.currentBidderId,
            auction.currentBid ?? auction.startingPrice,
            "EARN_ACTIVE",
            "auction_bid_refund",
            tx as PrismaClient,
            {
              auctionId: params.auctionId,
              reason: "outbid",
            }
          );
        }

        // 5. Extend auction by 1 minute if <5min remaining
        const timeRemaining = new Date(auction.endTime).getTime() - now;
        const newEndTime =
          timeRemaining < 5 * 60 * 1000
            ? new Date(new Date(auction.endTime).getTime() + 60 * 1000) // +1 min
            : auction.endTime;

        // 6. Update auction
        await tx.cardAuction.update({
          where: { id: params.auctionId },
          data: {
            currentBid: params.amount,
            currentBidderId: params.userId,
            endTime: newEndTime,
            bidCount: { increment: 1 },
          },
        });

        // 7. Create bid record
        await tx.auctionBid.create({
          data: {
            id: `bid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            auctionId: params.auctionId,
            bidderId: params.userId,
            amount: params.amount,
          },
        });
      });

      console.log(
        `[Auction Service] User ${params.userId} placed bid of ${params.amount} IxC on auction ${params.auctionId}`
      );

      // 8. Broadcast bid event (will be handled by WebSocket server)
      await this.broadcastBidEvent({
        auctionId: params.auctionId,
        bidderId: params.userId,
        amount: params.amount,
      });

      return { success: true };
    } catch (error) {
      console.error("[Auction Service] Failed to place bid:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to place bid",
      });
    }
  }

  /**
   * Execute instant buyout
   *
   * Transfers IxCredits and card ownership immediately, ends auction
   *
   * @param params Buyout parameters
   * @param db Prisma client
   * @returns Success result
   */
  async executeBuyout(
    params: {
      userId: string;
      auctionId: string;
    },
    db: PrismaClient
  ) {
    const auction = await db.cardAuction.findUnique({
      where: { id: params.auctionId },
      include: {
        CardOwnership: {
          include: {
            cards: true,
          },
        },
      },
    });

    if (!auction || !auction.buyoutPrice) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Buyout not available for this auction",
      });
    }

    if (auction.status !== "ACTIVE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Auction is not active",
      });
    }

    if (auction.sellerId === params.userId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot buy your own auction",
      });
    }

    // Extract buyoutPrice for use throughout function
    const buyoutPrice = auction.buyoutPrice;

    // Check buyer balance
    const userBalance = await vaultService.getBalance(params.userId, db);
    if (userBalance.credits < buyoutPrice) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Insufficient balance. You have ${userBalance.credits} IxC but need ${buyoutPrice} IxC`,
      });
    }

    // Execute buyout transaction
    try {
      await db.$transaction(async (tx) => {
        // 1. Refund current bidder (if any)
        if (auction.currentBidderId) {
          await vaultService.earnCredits(
            auction.currentBidderId,
            auction.currentBid ?? auction.startingPrice,
            "EARN_ACTIVE",
            "auction_bid_refund",
            tx as PrismaClient,
            {
              auctionId: params.auctionId,
              reason: "buyout",
            }
          );
        }

        // 2. Transfer IxCredits from buyer to seller
        const marketplaceFee =
          buyoutPrice > 100 ? Math.floor(buyoutPrice * 0.1) : 0; // 10% fee on >100 IxC
        const sellerProceeds = buyoutPrice - marketplaceFee;

        const spendResult = await vaultService.spendCredits(
          params.userId,
          buyoutPrice,
          "SPEND_MARKET",
          "card_purchase_buyout",
          tx as PrismaClient,
          {
            auctionId: params.auctionId,
            cardInstanceId: auction.cardInstanceId,
            marketplaceFee,
          }
        );

        if (!spendResult.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: spendResult.message ?? "Failed to process payment",
          });
        }

        await vaultService.earnCredits(
          auction.sellerId,
          sellerProceeds,
          "EARN_CARDS",
          "card_sale_buyout",
          tx as PrismaClient,
          {
            auctionId: params.auctionId,
            cardInstanceId: auction.cardInstanceId,
            marketplaceFee,
            grossSale: buyoutPrice,
          }
        );

        // 3. Transfer card ownership - change ownerId
        await tx.cardOwnership.update({
          where: {
            id: auction.cardInstanceId,
          },
          data: {
            ownerId: params.userId,
            userId: params.userId,
            isLocked: false,
            lastSalePrice: buyoutPrice,
            lastSaleDate: new Date(),
          },
        });

        // 4. Update card market value
        if (auction.CardOwnership?.cards) {
          await tx.card.update({
            where: { id: auction.CardOwnership.cards.id },
            data: {
              marketValue: buyoutPrice,
            },
          });
        }

        // 5. Complete auction
        await tx.cardAuction.update({
          where: { id: params.auctionId },
          data: {
            status: "COMPLETED",
            winnerId: params.userId,
            finalPrice: buyoutPrice,
          },
        });
      });

      console.log(
        `[Auction Service] User ${params.userId} bought card instance ${auction.cardInstanceId} via buyout for ${buyoutPrice} IxC`
      );

      return { success: true };
    } catch (error) {
      console.error("[Auction Service] Failed to execute buyout:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to execute buyout",
      });
    }
  }

  /**
   * Complete expired auction
   *
   * Called by cron job to finalize expired auctions
   * Transfers card to winner or refunds seller
   *
   * @param auctionId Auction ID
   * @param db Prisma client
   */
  async completeAuction(auctionId: string, db: PrismaClient) {
    const auction = await db.cardAuction.findUnique({
      where: { id: auctionId },
      include: {
        CardOwnership: {
          include: {
            cards: true,
          },
        },
      },
    });

    if (!auction || auction.status !== "ACTIVE") {
      return; // Already completed or doesn't exist
    }

    // Check if expired
    const now = IxTime.getCurrentIxTime();
    if (new Date(auction.endTime).getTime() > now) {
      return; // Not expired yet
    }

    try {
      await db.$transaction(async (tx) => {
        if (auction.currentBidderId) {
          // Auction had bids - transfer card to winner
          const finalPrice = auction.currentBid ?? auction.startingPrice;
          const marketplaceFee = finalPrice > 100 ? Math.floor(finalPrice * 0.1) : 0;
          const sellerProceeds = finalPrice - marketplaceFee;

          // Credits already reserved from bidder, now finalize transfer to seller
          await vaultService.earnCredits(
            auction.sellerId,
            sellerProceeds,
            "EARN_CARDS",
            "card_sale_auction",
            tx as PrismaClient,
            {
              auctionId,
              cardInstanceId: auction.cardInstanceId,
              marketplaceFee,
              grossSale: finalPrice,
            }
          );

          // Transfer card ownership - change ownerId
          await tx.cardOwnership.update({
            where: {
              id: auction.cardInstanceId,
            },
            data: {
              ownerId: auction.currentBidderId,
              userId: auction.currentBidderId,
              isLocked: false,
              lastSalePrice: finalPrice,
              lastSaleDate: new Date(),
            },
          });

          // Update card market value
          if (auction.CardOwnership?.cards) {
            await tx.card.update({
              where: { id: auction.CardOwnership.cards.id },
              data: {
                marketValue: finalPrice,
              },
            });
          }

          // Complete auction
          await tx.cardAuction.update({
            where: { id: auctionId },
            data: {
              status: "COMPLETED",
              winnerId: auction.currentBidderId,
              finalPrice,
            },
          });

          console.log(
            `[Auction Service] Completed auction ${auctionId} - Winner: ${auction.currentBidderId} for ${finalPrice} IxC`
          );
        } else {
          // No bids - return card to seller, refund 50% of listing fee
          await tx.cardOwnership.update({
            where: {
              id: auction.cardInstanceId,
            },
            data: { isLocked: false },
          });

          // Update auction status to CANCELLED (no bids = expired without sale)
          await tx.cardAuction.update({
            where: { id: auctionId },
            data: {
              status: "CANCELLED",
            },
          });

          const refund = auction.isFeatured ? 5 : 2.5; // 50% refund
          await vaultService.earnCredits(
            auction.sellerId,
            refund,
            "EARN_ACTIVE",
            "auction_fee_refund",
            tx as PrismaClient,
            {
              auctionId,
              reason: "no_bids",
            }
          );

          console.log(
            `[Auction Service] Expired auction ${auctionId} with no bids - Refunded ${refund} IxC to seller`
          );
        }
      });
    } catch (error) {
      console.error(`[Auction Service] Failed to complete auction ${auctionId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel auction (only if no bids)
   *
   * Allows seller to cancel auction before any bids are placed
   *
   * @param params Cancel parameters
   * @param db Prisma client
   * @returns Success result
   */
  async cancelAuction(
    params: {
      userId: string;
      auctionId: string;
    },
    db: PrismaClient
  ) {
    const auction = await db.cardAuction.findUnique({
      where: { id: params.auctionId },
      include: {
        AuctionBid: true,
      },
    });

    if (!auction || auction.sellerId !== params.userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not authorized to cancel this auction",
      });
    }

    if (auction.status !== "ACTIVE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Auction is not active",
      });
    }

    if (auction.AuctionBid.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot cancel auction with bids. Let it expire or wait for buyout.",
      });
    }

    try {
      await db.$transaction(async (tx) => {
        // Unlock card
        await tx.cardOwnership.update({
          where: {
            id: auction.cardInstanceId,
          },
          data: { isLocked: false },
        });

        // Cancel auction
        await tx.cardAuction.update({
          where: { id: params.auctionId },
          data: {
            status: "CANCELLED",
          },
        });

        // Refund 50% of listing fee
        const refund = auction.isFeatured ? 5 : 2.5;
        await vaultService.earnCredits(
          params.userId,
          refund,
          "EARN_ACTIVE",
          "auction_fee_refund",
          tx as PrismaClient,
          {
            auctionId: params.auctionId,
            reason: "cancelled",
          }
        );
      });

      console.log(`[Auction Service] User ${params.userId} cancelled auction ${params.auctionId}`);

      return { success: true };
    } catch (error) {
      console.error("[Auction Service] Failed to cancel auction:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to cancel auction",
      });
    }
  }

  /**
   * Get market trends and analytics
   *
   * Calculates market statistics for a time range
   *
   * @param params Analytics parameters
   * @param db Prisma client
   * @returns Market trend data
   */
  async getMarketTrends(
    params: {
      cardId?: string;
      timeRange: "24h" | "7d" | "30d";
    },
    db: PrismaClient
  ) {
    const timeRangeMs = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(Date.now() - timeRangeMs[params.timeRange]);

    const sales = await db.cardAuction.findMany({
      where: {
        status: "COMPLETED",
        finalPrice: { not: null },
        updatedAt: { gte: since },
      },
      include: {
        CardOwnership: {
          include: {
            cards: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Filter by cardId if provided
    const filteredSales = params.cardId
      ? sales.filter((s) => s.CardOwnership?.cards?.id === params.cardId)
      : sales;

    const totalVolume = filteredSales.reduce((sum, s) => sum + (s.finalPrice ?? 0), 0);
    const averagePrice = filteredSales.length > 0 ? totalVolume / filteredSales.length : 0;

    return {
      totalSales: filteredSales.length,
      totalVolume,
      averagePrice: Math.round(averagePrice * 100) / 100,
      priceHistory: filteredSales.map((s) => ({
        timestamp: s.updatedAt.toISOString(),
        price: s.finalPrice ?? 0,
        cardId: s.CardOwnership?.cards?.id ?? "",
        cardTitle: s.CardOwnership?.cards?.title ?? "Unknown",
        cardRarity: s.CardOwnership?.cards?.rarity ?? "COMMON",
      })),
    };
  }

  /**
   * Get active auctions with filters
   *
   * @param params Query parameters
   * @param db Prisma client
   * @returns Paginated auction results
   */
  async getActiveAuctions(
    params: {
      cardId?: string;
      sellerId?: string;
      isFeatured?: boolean;
      limit?: number;
      offset?: number;
    },
    db: PrismaClient
  ) {
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = params.offset ?? 0;

    const where = {
      status: "ACTIVE" as const,
      ...(params.sellerId ? { sellerId: params.sellerId } : {}),
      ...(params.isFeatured !== undefined ? { isFeatured: params.isFeatured } : {}),
    };

    const [total, auctions] = await Promise.all([
      db.cardAuction.count({ where }),
      db.cardAuction.findMany({
        where,
        include: {
          CardOwnership: {
            include: {
              cards: true,
            },
          },
          AuctionBid: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: [{ isFeatured: "desc" }, { endTime: "asc" }],
        take: limit,
        skip: offset,
      }),
    ]);

    // Filter by cardId if provided
    const filteredAuctions = params.cardId
      ? auctions.filter((a) => a.CardOwnership?.cards?.id === params.cardId)
      : auctions;

    return {
      auctions: filteredAuctions,
      total: filteredAuctions.length,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Broadcast bid event via WebSocket
   * Placeholder for WebSocket integration
   */
  private async broadcastBidEvent(event: {
    auctionId: string;
    bidderId: string;
    amount: number;
  }) {
    // This will be implemented by WebSocket server
    // For now, just log the event
    console.log("[Auction Service] Bid event:", event);
  }
}

// Export singleton instance
export const auctionService = new AuctionService();
