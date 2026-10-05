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

import { vaultService, getVaultConfig, LedgerError } from "~/lib/vault/vault-service";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { notificationAPI } from "~/lib/notifications/api";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { SYSTEM_OWNER_IDS } from "~/lib/auth";
import {
  publishMarketEvent,
  type MarketBroadcastMessage,
  type MarketBroadcastTarget,
} from "~/server/market-broadcast-bridge";

// market-websocket-server is marked `server-only`; importing it in a pure backend process
// (the cron under plain Bun) throws, so it loads lazily and best-effort. Events go through
// the Redis market bridge either way, so cron completions still reach browsers.
let _marketWs: { getMarketWebSocketServer: () => MarketBroadcastTarget | null } | null | undefined;
async function getMarketWs(): Promise<MarketBroadcastTarget | null> {
  if (_marketWs === undefined) {
    try {
      _marketWs = await import("~/lib/websocket/market-websocket-server");
    } catch {
      _marketWs = null;
    }
  }
  return _marketWs?.getMarketWebSocketServer() ?? null;
}

async function broadcastMarket(message: MarketBroadcastMessage): Promise<void> {
  publishMarketEvent(message, await getMarketWs());
}

const broadcastComplete = (auctionId: string, winnerId: string | null, finalPrice: number) =>
  broadcastMarket({ type: "auction_complete", data: { auctionId, winnerId, finalPrice } });

type AuctionWithCard = Prisma.CardAuctionGetPayload<{
  include: { CardOwnership: { include: { cards: true } } };
}>;

/** 10% marketplace fee on sales over 100 IxC. */
const marketplaceFee = (price: number) => (price > 100 ? Math.floor(price * 0.1) : 0);

/** Fire-and-forget notification: a failure is logged, never thrown. */
async function notifyQuietly(
  label: string,
  auctionId: string,
  payload: Parameters<typeof notificationAPI.create>[0]
) {
  try {
    await notificationAPI.create(payload);
  } catch (err) {
    console.warn(`[Auction Service] ${label} notification failed for auction`, auctionId, err);
  }
}

/**
 * Nation-card royalty: 2% of the sale to the nation's owner, else the earliest human puller of
 * the card (never the seller, the buyer or a system account). Optional: must not block the sale.
 */
async function payNationRoyalty(
  tx: Prisma.TransactionClient,
  auction: AuctionWithCard,
  buyerId: string,
  price: number
) {
  const card = auction.CardOwnership?.cards;
  if (card?.cardType !== "NATION" || !card.countryId) return;

  const royaltyAmount = Math.round(price * 0.02 * 100) / 100;
  const isParty = (clerkId: string | null | undefined) =>
    clerkId === auction.sellerId || clerkId === buyerId;

  const nationOwner = await tx.user.findFirst({
    where: { ownedCountries: { some: { id: card.countryId } } },
  });
  let recipient: string | null = null;
  if (nationOwner && !isParty(nationOwner.clerkUserId)) {
    recipient = nationOwner.clerkUserId;
  } else {
    const earliestOwnerships = await tx.cardOwnership.findMany({
      where: { cardId: card.id },
      orderBy: { createdAt: "asc" },
      include: { User: true },
    });
    const firstHuman = earliestOwnerships.find((o) => {
      const clerkId = o.User.clerkUserId;
      return (
        clerkId &&
        clerkId.startsWith("user_") &&
        !SYSTEM_OWNER_IDS.includes(clerkId) &&
        !isParty(clerkId)
      );
    });
    recipient = firstHuman?.User.clerkUserId ?? null;
  }
  if (!recipient) return;

  try {
    await vaultService.earnCreditsTx(tx, {
      userId: recipient,
      amount: royaltyAmount,
      type: "EARN_PASSIVE",
      source: "nation_card_royalty",
      metadata: {
        auctionId: auction.id,
        cardId: card.id,
        countryId: card.countryId,
        salePrice: price,
        royaltyRate: 0.02,
      },
    });
    console.log(
      `[Auction Service] Awarded ${royaltyAmount} IxC royalty to ${recipient} for nation card sale`
    );
  } catch (e) {
    if (!(e instanceof LedgerError)) throw e;
    console.warn("[Auction Service] Royalty skipped:", e.message);
  }
}

/** Pays the seller (net of the marketplace fee) and royalty, hands the card to the buyer, records the price. */
async function settleSale(
  tx: Prisma.TransactionClient,
  auction: AuctionWithCard,
  sale: { buyerId: string; price: number; sellerSource: string }
) {
  const { buyerId, price } = sale;
  const fee = marketplaceFee(price);
  await vaultService.earnCreditsTx(tx, {
    userId: auction.sellerId,
    amount: price - fee,
    type: "EARN_CARDS",
    source: sale.sellerSource,
    metadata: {
      auctionId: auction.id,
      cardInstanceId: auction.cardInstanceId,
      marketplaceFee: fee,
      grossSale: price,
    },
  });
  await payNationRoyalty(tx, auction, buyerId, price);

  await tx.cardOwnership.update({
    where: { id: auction.cardInstanceId },
    data: {
      ownerId: buyerId,
      userId: buyerId,
      isLocked: false,
      lastSalePrice: price,
      lastSaleDate: new Date(),
    },
  });
  if (auction.CardOwnership?.cards) {
    await tx.card.update({
      where: { id: auction.CardOwnership.cards.id },
      data: { marketValue: price },
    });
  }
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
        // Lock the card ownership first, only if it is still unlocked and ours. Two
        // concurrent listings of one card both pass the check above; only one wins here.
        const locked = await tx.cardOwnership.updateMany({
          where: { id: ownership.id, ownerId: params.userId, isLocked: false },
          data: { isLocked: true },
        });
        if (locked.count !== 1) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This card is already listed or locked",
          });
        }

        const newAuction = await tx.cardAuction.create({
          data: {
            id: `auction_${Date.now()}_${crypto.randomUUID()}`,
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

        return newAuction;
      });

      console.log(
        `[Auction Service] Created auction ${auction.id} for card ${params.cardId} by user ${params.userId}`
      );

      await broadcastMarket({ type: "auction_created", data: auction });

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
        "REFUND",
        "auction_listing_fee_refund",
        db,
        { error: String(error) }
      );

      if (error instanceof TRPCError) {
        throw new TRPCError({
          code: error.code,
          message: `${error.message}. Listing fee has been refunded.`,
        });
      }
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

    // Rejecting a self-outbid avoids charging the same user twice for one hold
    if (auction.currentBidderId === params.userId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You are already the highest bidder",
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
        // 4a. Extend auction by 1 minute if <5min remaining
        const timeRemaining = new Date(auction.endTime).getTime() - now;
        const newEndTime =
          timeRemaining < 5 * 60 * 1000
            ? new Date(new Date(auction.endTime).getTime() + 60 * 1000) // +1 min
            : auction.endTime;

        // 4b. Claim the auction state read above (compare-and-swap). If another bid,
        // a buyout or expiry changed it, nothing below runs and no money moves.
        const claimed = await tx.cardAuction.updateMany({
          where: {
            id: params.auctionId,
            status: "ACTIVE",
            currentBid: auction.currentBid,
            currentBidderId: auction.currentBidderId,
            endTime: { gt: new Date(now) },
          },
          data: {
            currentBid: params.amount,
            currentBidderId: params.userId,
            endTime: newEndTime,
            bidCount: { increment: 1 },
          },
        });
        if (claimed.count !== 1) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Auction changed while you were bidding — refresh and try again",
          });
        }

        // 5. Reserve from new bidder (LedgerError rolls the transaction back)
        await vaultService.spendCreditsTx(tx, {
          userId: params.userId,
          amount: params.amount,
          type: "SPEND_MARKET",
          source: "auction_bid_reserve",
          metadata: {
            auctionId: params.auctionId,
            cardInstanceId: auction.cardInstanceId,
          },
        });

        // 6. Refund previous bidder (if any) — REFUND is never capped
        if (auction.currentBidderId) {
          await vaultService.earnCreditsTx(tx, {
            userId: auction.currentBidderId,
            amount: auction.currentBid ?? auction.startingPrice,
            type: "REFUND",
            source: "auction_bid_refund",
            metadata: {
              auctionId: params.auctionId,
              reason: "outbid",
            },
          });
        }

        // 7. Create bid record
        await tx.auctionBid.create({
          data: {
            id: `bid_${Date.now()}_${crypto.randomUUID()}`,
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
        const bidder = await db.user.findUnique({
          where: { id: params.userId },
          select: { clerkUserId: true },
        });
        await broadcastMarket({
          type: "bid",
          data: {
            id: `bid_${Date.now()}`,
            auctionId: params.auctionId,
            bidderId: params.userId,
            bidderName: bidder?.clerkUserId ?? params.userId,
            amount: params.amount,
            timestamp: Date.now(),
            isAutoBid: false,
          },
        });
      }

      // 9. Notify previous bidder if outbid (fire-and-forget)
      if (auction.currentBidderId) {
        await notifyQuietly("Outbid", params.auctionId, {
          userId: auction.currentBidderId,
          title: "You've Been Outbid!",
          message: `Someone placed a higher bid of ${params.amount} IxC on ${auction.CardOwnership?.cards?.title ?? "Unknown Card"}`,
          type: "warning",
          category: "cards",
          priority: "high",
          metadata: { auctionId: params.auctionId, newBid: params.amount },
        });
      }

      return { success: true };
    } catch (error) {
      console.error("[Auction Service] Failed to place bid:", error);
      if (error instanceof LedgerError) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }
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
        // 1. Settle the auction (compare-and-swap on the state read above). If a bid,
        // another buyout or the expiry cron got there first, nothing below runs.
        const claimed = await tx.cardAuction.updateMany({
          where: {
            id: params.auctionId,
            status: "ACTIVE",
            currentBid: auction.currentBid,
            currentBidderId: auction.currentBidderId,
          },
          data: {
            status: "COMPLETED",
            winnerId: params.userId,
            finalPrice: buyoutPrice,
          },
        });
        if (claimed.count !== 1) {
          throw new TRPCError({ code: "CONFLICT", message: "Auction is no longer available" });
        }

        // 2. Refund current bidder (if any) — REFUND is never capped
        if (auction.currentBidderId) {
          await vaultService.earnCreditsTx(tx, {
            userId: auction.currentBidderId,
            amount: auction.currentBid ?? auction.startingPrice,
            type: "REFUND",
            source: "auction_bid_refund",
            metadata: {
              auctionId: params.auctionId,
              reason: "buyout",
            },
          });
        }

        // 3. Buyer pays the full price (LedgerError rolls the transaction back); seller, royalty, card follow
        await vaultService.spendCreditsTx(tx, {
          userId: params.userId,
          amount: buyoutPrice,
          type: "SPEND_MARKET",
          source: "card_purchase_buyout",
          metadata: {
            auctionId: params.auctionId,
            cardInstanceId: auction.cardInstanceId,
            marketplaceFee: marketplaceFee(buyoutPrice),
          },
        });
        await settleSale(tx, auction, {
          buyerId: params.userId,
          price: buyoutPrice,
          sellerSource: "card_sale_buyout",
        });
      });

      console.log(
        `[Auction Service] User ${params.userId} bought card instance ${auction.cardInstanceId} via buyout for ${buyoutPrice} IxC`
      );

      await broadcastComplete(params.auctionId, params.userId, buyoutPrice);

      return { success: true };
    } catch (error) {
      console.error("[Auction Service] Failed to execute buyout:", error);
      if (error instanceof LedgerError) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }
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

    const finalPrice = auction.currentBid ?? auction.startingPrice;

    try {
      await db.$transaction(async (tx) => {
        // Settle the auction first (compare-and-swap on the state read above). A buyout,
        // a cancel or another cron run that got there first leaves nothing to do.
        const claimed = await tx.cardAuction.updateMany({
          where: {
            id: auctionId,
            status: "ACTIVE",
            currentBidderId: auction.currentBidderId,
            currentBid: auction.currentBid,
          },
          data: auction.currentBidderId
            ? { status: "COMPLETED", winnerId: auction.currentBidderId, finalPrice }
            : { status: "CANCELLED" },
        });
        if (claimed.count !== 1) {
          return;
        }

        if (auction.currentBidderId) {
          // Credits were reserved from the bidder at bid time; pay the seller and hand over the card
          await settleSale(tx, auction, {
            buyerId: auction.currentBidderId,
            price: finalPrice,
            sellerSource: "card_sale_auction",
          });

          // Grant 50 XP to the winner's card instance
          await grantCardXp(
            tx as any,
            auction.cardInstanceId,
            50,
            "AUCTION_COMPLETE",
            JSON.stringify({ auctionId })
          );

          console.log(
            `[Auction Service] Completed auction ${auctionId} - Winner: ${auction.currentBidderId} for ${finalPrice} IxC`
          );

          await broadcastComplete(auctionId, auction.currentBidderId, finalPrice);

          const cardTitle = auction.CardOwnership?.cards?.title ?? "Unknown Card";
          await notifyQuietly("Winner", auctionId, {
            userId: auction.currentBidderId,
            title: "You Won an Auction!",
            message: `Congratulations! You won ${cardTitle} for ${finalPrice} IxC`,
            type: "success",
            category: "cards",
            priority: "high",
            metadata: { auctionId, cardInstanceId: auction.cardInstanceId, finalPrice },
          });
          await notifyQuietly("Seller", auctionId, {
            userId: auction.sellerId,
            title: "Card Sold!",
            message: `Your ${cardTitle} sold for ${finalPrice} IxC`,
            type: "success",
            category: "cards",
            priority: "high",
            metadata: { auctionId, buyerId: auction.currentBidderId, finalPrice },
          });
        } else {
          // No bids - return card to seller, refund 50% of listing fee
          await tx.cardOwnership.update({
            where: {
              id: auction.cardInstanceId,
            },
            data: { isLocked: false },
          });

          const refund = auction.isFeatured ? 5 : 2.5; // 50% refund
          await vaultService.earnCreditsTx(tx, {
            userId: auction.sellerId,
            amount: refund,
            type: "REFUND",
            source: "auction_fee_refund",
            metadata: {
              auctionId,
              reason: "no_bids",
            },
          });

          console.log(
            `[Auction Service] Expired auction ${auctionId} with no bids - Refunded ${refund} IxC to seller`
          );

          // No bids expired — treat as complete/cancelled for WS
          await broadcastComplete(auctionId, auction.sellerId, 0);

          await notifyQuietly("No-bid", auctionId, {
            userId: auction.sellerId,
            title: "Auction Ended — No Bids",
            message: `Your auction for ${auction.CardOwnership?.cards?.title ?? "Unknown Card"} ended without any bids`,
            type: "info",
            category: "cards",
            priority: "low",
            metadata: { auctionId },
          });
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
        // Cancel auction (compare-and-swap: still ACTIVE, still ours, still no bids)
        const claimed = await tx.cardAuction.updateMany({
          where: {
            id: params.auctionId,
            status: "ACTIVE",
            sellerId: params.userId,
            bidCount: 0,
          },
          data: { status: "CANCELLED" },
        });
        if (claimed.count !== 1) {
          throw new TRPCError({ code: "CONFLICT", message: "Auction can no longer be cancelled" });
        }

        // Unlock card
        await tx.cardOwnership.update({
          where: {
            id: auction.cardInstanceId,
          },
          data: { isLocked: false },
        });

        // Refund 50% of listing fee — REFUND is never capped
        const refund = auction.isFeatured ? 5 : 2.5;
        await vaultService.earnCreditsTx(tx, {
          userId: params.userId,
          amount: refund,
          type: "REFUND",
          source: "auction_fee_refund",
          metadata: {
            auctionId: params.auctionId,
            reason: "cancelled",
          },
        });
      });

      console.log(`[Auction Service] User ${params.userId} cancelled auction ${params.auctionId}`);

      await broadcastComplete(params.auctionId, params.userId, 0);

      return { success: true };
    } catch (error) {
      console.error("[Auction Service] Failed to cancel auction:", error);
      if (error instanceof LedgerError) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to cancel auction",
      });
    }
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
