/**
 * Auction Service
 *
 * Comprehensive auction engine for IxCards marketplace
 * Handles auction creation, bidding, buyouts, completions, and market analytics
 *
 * Features:
 * - Atomic transactions for race condition protection
 * - IxCredits integration via vault-service
 * - real-time auction timing
 * - Auto-extension for last-minute bids
 * - Market fee calculation (10% on sales >100 IxC)
 * - Listing fees (5 IxC standard, 10 IxC featured)
 * - Bid validation (5% minimum increment)
 */

import { vaultService, getVaultConfig } from "~/lib/vault";
import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";
import { notificationAPI } from "~/lib/notifications/api";
import { grantCardXp } from "~/lib/card-xp-utils";
import { SYSTEM_OWNER_IDS } from "~/lib/auth";

// market-websocket-server is marked `server-only`; importing it in a pure backend
// process (the cron under plain Bun) throws. Load it lazily + best-effort so auction
// completion still runs there — the WS broadcast is just skipped when it can't load.
// ponytail: best-effort WS; cron skips broadcasts, web server still gets them.
let _marketWs: { getMarketWebSocketServer: () => any } | null | undefined;
async function getMarketWs() {
  if (_marketWs === undefined) {
    try {
      _marketWs = await import("~/lib/websocket");
    } catch {
      _marketWs = null;
    }
  }
  return _marketWs?.getMarketWebSocketServer() ?? null;
}

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
    const config = await getVaultConfig(db);
    if (config.isMaintenanceMode) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Vault economy is currently in maintenance mode.",
      });
    }
    if (!config.isAuctionsEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "P2P card auctions are currently disabled globally.",
      });
    }

    // 1. Validate card ownership
    const ownership = await db.cardOwnership.findFirst({
      where: {
        id: params.cardId,
        ownerId: params.userId,
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

    // 5. Calculate end time (real-world wall clock — auctions run in real time)
    const now = Date.now();
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

      (await getMarketWs())?.broadcastAuctionCreated(auction);

      // Trigger watchlist price alerts (fire-and-forget)
      try {
        const watchlists = await db.cardWatchlist.findMany({
          where: {
            cardId: params.cardId,
            userId: { not: params.userId }, // Don't notify the seller
            OR: [
              { targetPrice: null },
              { targetPrice: { gte: params.startingPrice } },
              params.buyoutPrice ? { targetPrice: { gte: params.buyoutPrice } } : {},
            ],
          },
          include: {
            user: {
              select: { clerkUserId: true },
            },
          },
        });

        const cardTitle = ownership.cards.title;
        for (const watch of watchlists) {
          if (watch.user?.clerkUserId) {
            await notificationAPI.create({
              userId: watch.user.clerkUserId,
              title: "Watchlist Card Listed!",
              message: `A card on your watchlist (${cardTitle}) has been listed for auction starting at ${params.startingPrice} IxC!`,
              type: "info",
              category: "cards",
              priority: "medium",
              metadata: { auctionId: auction.id, cardId: params.cardId },
            });
          }
        }
      } catch (e) {
        console.error("[Auction Service] Failed to trigger watchlist alerts:", e);
      }

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
    const config = await getVaultConfig(db);
    if (config.isMaintenanceMode) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Vault economy is currently in maintenance mode.",
      });
    }
    if (!config.isAuctionsEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "P2P card auctions are currently disabled globally.",
      });
    }

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

    // Check if auction expired (real time)
    const now = Date.now();
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

      // 8. Broadcast bid event via WebSocket
      {
        const ws = await getMarketWs();
        if (ws) {
          const bidder = await db.user.findUnique({
            where: { id: params.userId },
            select: { clerkUserId: true },
          });
          ws.broadcastBid({
            id: `bid_${Date.now()}`,
            auctionId: params.auctionId,
            bidderId: params.userId,
            bidderName: bidder?.clerkUserId ?? params.userId,
            amount: params.amount,
            timestamp: Date.now(),
            isAutoBid: false,
          });
        }
      }

      // 9. Notify previous bidder if outbid (fire-and-forget)
      if (auction.currentBidderId && auction.currentBidderId !== params.userId) {
        try {
          const cardTitle = auction.CardOwnership?.cards?.title ?? "Unknown Card";
          await notificationAPI.create({
            userId: auction.currentBidderId,
            title: "You've Been Outbid!",
            message: `Someone placed a higher bid of ${params.amount} IxC on ${cardTitle}`,
            type: "warning",
            category: "cards",
            priority: "high",
            metadata: { auctionId: params.auctionId, newBid: params.amount },
          });
        } catch {}
      }

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
    const config = await getVaultConfig(db);
    if (config.isMaintenanceMode) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Vault economy is currently in maintenance mode.",
      });
    }
    if (!config.isAuctionsEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "P2P card auctions are currently disabled globally.",
      });
    }

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
        const marketplaceFee = buyoutPrice > 100 ? Math.floor(buyoutPrice * 0.1) : 0; // 10% fee on >100 IxC
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

        // 2.5. Award nation card royalties (2% of sale price to nation owner with fallback)
        if (
          auction.CardOwnership?.cards?.cardType === "NATION" &&
          auction.CardOwnership?.cards?.countryId
        ) {
          const royaltyAmount = Math.round(buyoutPrice * 0.02 * 100) / 100; // 2% royalty

          // Find the nation owner
          const nationOwner = await (tx as PrismaClient).user.findFirst({
            where: { countryId: auction.CardOwnership.cards.countryId },
          });

          let royaltyRecipientClerkId: string | null = null;

          if (
            nationOwner &&
            nationOwner.clerkUserId !== auction.sellerId &&
            nationOwner.clerkUserId !== params.userId
          ) {
            royaltyRecipientClerkId = nationOwner.clerkUserId;
          } else {
            // Fallback: earliest non-system user pull of this cardId
            const earliestOwnerships = await (tx as PrismaClient).cardOwnership.findMany({
              where: { cardId: auction.CardOwnership.cards.id },
              orderBy: { createdAt: "asc" },
              include: { User: true },
            });
            const firstHuman = earliestOwnerships.find((o) => {
              const clerkId = o.User.clerkUserId;
              return (
                clerkId &&
                clerkId.startsWith("user_") &&
                !SYSTEM_OWNER_IDS.includes(clerkId) &&
                clerkId !== auction.sellerId &&
                clerkId !== params.userId
              );
            });
            if (firstHuman) {
              royaltyRecipientClerkId = firstHuman.User.clerkUserId;
            }
          }

          if (royaltyRecipientClerkId) {
            // Award royalty
            await vaultService.earnCredits(
              royaltyRecipientClerkId,
              royaltyAmount,
              "EARN_PASSIVE",
              "nation_card_royalty",
              tx as PrismaClient,
              {
                auctionId: params.auctionId,
                cardId: auction.CardOwnership.cards.id,
                countryId: auction.CardOwnership.cards.countryId,
                salePrice: buyoutPrice,
                royaltyRate: 0.02,
              }
            );

            console.log(
              `[Auction Service] Awarded ${royaltyAmount} IxC royalty to ${royaltyRecipientClerkId} ` +
                `for nation card sale`
            );
          }
        }

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

      (await getMarketWs())?.broadcastAuctionComplete({
        auctionId: params.auctionId,
        winnerId: params.userId,
        finalPrice: buyoutPrice,
      });

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

    // Check if expired (real time)
    const now = Date.now();
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

          // Award nation card royalties (2% of sale price to nation owner with fallback)
          if (
            auction.CardOwnership?.cards?.cardType === "NATION" &&
            auction.CardOwnership?.cards?.countryId
          ) {
            const royaltyAmount = Math.round(finalPrice * 0.02 * 100) / 100; // 2% royalty

            // Find the nation owner
            const nationOwner = await (tx as PrismaClient).user.findFirst({
              where: { countryId: auction.CardOwnership.cards.countryId },
            });

            let royaltyRecipientClerkId: string | null = null;

            if (
              nationOwner &&
              nationOwner.clerkUserId !== auction.sellerId &&
              nationOwner.clerkUserId !== auction.currentBidderId
            ) {
              royaltyRecipientClerkId = nationOwner.clerkUserId;
            } else {
              // Fallback: earliest non-system user pull of this cardId
              const earliestOwnerships = await (tx as PrismaClient).cardOwnership.findMany({
                where: { cardId: auction.CardOwnership.cards.id },
                orderBy: { createdAt: "asc" },
                include: { User: true },
              });
              const firstHuman = earliestOwnerships.find((o) => {
                const clerkId = o.User.clerkUserId;
                return (
                  clerkId &&
                  clerkId.startsWith("user_") &&
                  !SYSTEM_OWNER_IDS.includes(clerkId) &&
                  clerkId !== auction.sellerId &&
                  clerkId !== auction.currentBidderId
                );
              });
              if (firstHuman) {
                royaltyRecipientClerkId = firstHuman.User.clerkUserId;
              }
            }

            if (royaltyRecipientClerkId) {
              // Award royalty to nation owner (only if they're not the buyer or seller)
              await vaultService.earnCredits(
                royaltyRecipientClerkId,
                royaltyAmount,
                "EARN_PASSIVE",
                "nation_card_royalty",
                tx as PrismaClient,
                {
                  auctionId,
                  cardId: auction.CardOwnership.cards.id,
                  countryId: auction.CardOwnership.cards.countryId,
                  salePrice: finalPrice,
                  royaltyRate: 0.02,
                }
              );

              console.log(
                `[Auction Service] Awarded ${royaltyAmount} IxC royalty to ${royaltyRecipientClerkId} ` +
                  `for nation card sale`
              );
            }
          }

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

          // Grant 50 XP to the winner's card instance
          await grantCardXp(
            tx as any,
            auction.cardInstanceId,
            50,
            "AUCTION_COMPLETE",
            JSON.stringify({ auctionId })
          );

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

          (await getMarketWs())?.broadcastAuctionComplete({
            auctionId,
            winnerId: auction.currentBidderId,
            finalPrice,
          });

          // Notify winner (fire-and-forget)
          try {
            const cardTitle = auction.CardOwnership?.cards?.title ?? "Unknown Card";
            await notificationAPI.create({
              userId: auction.currentBidderId,
              title: "You Won an Auction!",
              message: `Congratulations! You won ${cardTitle} for ${finalPrice} IxC`,
              type: "success",
              category: "cards",
              priority: "high",
              metadata: { auctionId, cardInstanceId: auction.cardInstanceId, finalPrice },
            });
          } catch {}

          // Notify seller (fire-and-forget)
          try {
            const cardTitle = auction.CardOwnership?.cards?.title ?? "Unknown Card";
            await notificationAPI.create({
              userId: auction.sellerId,
              title: "Card Sold!",
              message: `Your ${cardTitle} sold for ${finalPrice} IxC`,
              type: "success",
              category: "cards",
              priority: "high",
              metadata: { auctionId, buyerId: auction.currentBidderId, finalPrice },
            });
          } catch {}
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

          // No bids expired — treat as complete/cancelled for WS
          (await getMarketWs())?.broadcastAuctionComplete({
            auctionId,
            winnerId: auction.sellerId,
            finalPrice: 0,
          });

          // Notify seller (fire-and-forget)
          try {
            const cardTitle = auction.CardOwnership?.cards?.title ?? "Unknown Card";
            await notificationAPI.create({
              userId: auction.sellerId,
              title: "Auction Ended — No Bids",
              message: `Your auction for ${cardTitle} ended without any bids`,
              type: "info",
              category: "cards",
              priority: "low",
              metadata: { auctionId },
            });
          } catch {}
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
    const config = await getVaultConfig(db);
    if (config.isMaintenanceMode) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Vault economy is currently in maintenance mode.",
      });
    }
    if (!config.isAuctionsEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "P2P card auctions are currently disabled globally.",
      });
    }

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

      (await getMarketWs())?.broadcastAuctionComplete({
        auctionId: params.auctionId,
        winnerId: params.userId,
        finalPrice: 0,
      });

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
      rarity?: string;
      cardType?: string;
      minPrice?: number;
      maxPrice?: number;
      sortBy?: "ending_soon" | "newest" | "price_low" | "price_high";
      limit?: number;
      offset?: number;
    },
    db: PrismaClient
  ) {
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = params.offset ?? 0;

    const where: any = {
      status: "ACTIVE",
      endTime: { gt: new Date() },
      ...(params.sellerId ? { sellerId: params.sellerId } : {}),
      ...(params.isFeatured !== undefined ? { isFeatured: params.isFeatured } : {}),
    };

    // Card-owned filters (rarity + cardType are on Card model through CardOwnership)
    const cardsFilter: any = {};
    if (params.rarity) cardsFilter.rarity = params.rarity;
    if (params.cardType) cardsFilter.cardType = params.cardType;
    if (Object.keys(cardsFilter).length > 0) {
      where.CardOwnership = { cards: cardsFilter };
    }

    // Price range filters (currentBid is on the auction)
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.currentBid = {};
      if (params.minPrice !== undefined) where.currentBid.gte = params.minPrice;
      if (params.maxPrice !== undefined) where.currentBid.lte = params.maxPrice;
    }

    // Sorting
    // eslint-disable-next-line prefer-const
    let orderBy: any[] = [{ isFeatured: "desc" }];
    if (params.sortBy === "newest") {
      orderBy.push({ createdAt: "desc" });
    } else if (params.sortBy === "price_low") {
      orderBy.push({ currentBid: "asc" });
    } else if (params.sortBy === "price_high") {
      orderBy.push({ currentBid: "desc" });
    } else {
      // Default: ending soon
      orderBy.push({ endTime: "asc" });
    }

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
        orderBy,
        take: limit,
        skip: offset,
      }),
    ]);

    // Filter by cardId if provided (post-query since it's on related model)
    const filteredAuctions = params.cardId
      ? auctions.filter((a) => a.CardOwnership?.cards?.id === params.cardId)
      : auctions;

    return {
      auctions: filteredAuctions,
      total: filteredAuctions.length,
      hasMore: offset + limit < total,
    };
  }
}

// Export singleton instance
export const auctionService = new AuctionService();
