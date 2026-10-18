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
 * - Market fee calculation (admin house rake, default 10%, on sales >100 IxC)
 * - Listing fees (5 IxC standard, 10 IxC featured)
 * - Bid validation (5% minimum increment)
 */

import { vaultService, getVaultConfig, LedgerError } from "~/lib/vault/vault-service";
import { TRPCError } from "@trpc/server";
import type { CardRarity, CardType, Prisma, PrismaClient } from "@prisma/client";
import { notificationAPI } from "~/lib/notifications/api";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { boundCopyError } from "~/lib/cards/bound";
import { notifyCards, type CardNotice } from "~/lib/cards/card-notify";
import { royaltyNotices, type RoyaltyPayout } from "~/lib/cards/market/royalty";
import { settleCardSaleTx, type CardSale } from "~/lib/cards/market/settle-sale";
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

/** An auction whose copy is still there. */
type LiveAuction = AuctionWithCard & {
  CardOwnership: NonNullable<AuctionWithCard["CardOwnership"]>;
};

/** A running auction's copy is locked, so nothing burns it: a copy gone is refused before anything moves. */
function assertCopyOnSale(auction: AuctionWithCard): asserts auction is LiveAuction {
  if (auction.CardOwnership === null) {
    throw new TRPCError({ code: "CONFLICT", message: "This auction's card no longer exists" });
  }
}

/** The sale of an auction's copy to `buyerId` at `price`. */
function auctionSale(
  auction: LiveAuction,
  buyerId: string,
  price: number,
  kind: "AUCTION_END" | "AUCTION_BUYOUT"
): CardSale {
  const copy = auction.CardOwnership;
  return {
    ownershipId: copy.id,
    cardId: copy.cards.id,
    serialNumber: copy.serialNumber,
    finish: copy.finish,
    cardType: copy.cards.cardType,
    countryId: copy.cards.countryId,
    sellerId: auction.sellerId,
    buyerId,
    price,
    action: kind,
    sellerSource: kind === "AUCTION_END" ? "card_sale_auction" : "card_sale_buyout",
    context: { auctionId: auction.id },
    now: new Date(),
  };
}

/** "Royalty paid" notices for an auction's sale; they go out after the commit. */
const auctionRoyaltyNotices = (auction: LiveAuction, royalties: RoyaltyPayout[]): CardNotice[] =>
  royaltyNotices(
    royalties,
    new Map([[auction.CardOwnership.cards.id, auction.CardOwnership.cards.title]])
  );

/**
 * Half the listing fee back to the seller when an auction ends unsold: the seller or an admin cancels it, or it
 * expires with no bids. REFUND is never capped. Returns the amount refunded.
 */
export async function refundListingFeeTx(
  tx: Prisma.TransactionClient,
  auction: { id: string; sellerId: string; isFeatured: boolean },
  reason: "cancelled" | "no_bids" | "admin_cancel"
): Promise<number> {
  const refund = auction.isFeatured ? 5 : 2.5; // half of the 10 or 5 IxC listing fee
  await vaultService.earnCreditsTx(tx, {
    userId: auction.sellerId,
    amount: refund,
    type: "REFUND",
    source: "auction_fee_refund",
    metadata: { auctionId: auction.id, reason },
  });
  return refund;
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
    // Bound cards (trophies, achievement rewards) can't be listed (cards refresh §2.1)
    if (ownership.cards.isBound) throw boundCopyError();

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
            cardId: ownership.cardId,
            serialNumber: ownership.serialNumber,
            sellerId: params.userId,
            startingPrice: params.startingPrice,
            currentBid: params.startingPrice,
            buyoutPrice: params.buyoutPrice,
            endTime: new Date(endTime),
            isFeatured: params.isFeatured ?? false,
            listingFee,
            status: "ACTIVE",
          },
        });

        return newAuction;
      });

      console.log(
        `[Auction Service] Created auction ${auction.id} for card ${params.cardId} by user ${params.userId}`
      );

      await broadcastMarket({ type: "auction_created", data: auction });

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

    assertCopyOnSale(auction);
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
      const settlement = await db.$transaction(async (tx) => {
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

        // 3. Buyer pays the full price (LedgerError rolls the transaction back); the copy, seller and royalty follow
        await vaultService.spendCreditsTx(tx, {
          userId: params.userId,
          amount: buyoutPrice,
          type: "SPEND_MARKET",
          source: "card_purchase_buyout",
          metadata: { auctionId: params.auctionId, cardInstanceId: auction.cardInstanceId },
        });
        return settleCardSaleTx(
          tx,
          auctionSale(auction, params.userId, buyoutPrice, "AUCTION_BUYOUT")
        );
      });

      console.log(
        `[Auction Service] User ${params.userId} bought card instance ${auction.cardInstanceId} via buyout for ${buyoutPrice} IxC`
      );

      await broadcastComplete(params.auctionId, params.userId, buyoutPrice);
      await notifyCards(db, auctionRoyaltyNotices(auction, settlement.royalties));

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
      const notices = await db.$transaction(async (tx): Promise<CardNotice[]> => {
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
          return [];
        }

        if (auction.currentBidderId) {
          // Credits were reserved from the bidder at bid time; pay the seller and hand over the card
          assertCopyOnSale(auction);
          const sale = auctionSale(auction, auction.currentBidderId, finalPrice, "AUCTION_END");
          const settlement = await settleCardSaleTx(tx, sale);

          // Card XP for the winner's copy (the Economy tab's auction-win amount)
          await grantCardXp(tx, sale.ownershipId, "AUCTION_WIN", JSON.stringify({ auctionId }));

          console.log(
            `[Auction Service] Completed auction ${auctionId} - Winner: ${auction.currentBidderId} for ${finalPrice} IxC`
          );

          await broadcastComplete(auctionId, auction.currentBidderId, finalPrice);

          const cardTitle = auction.CardOwnership.cards.title;
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
          return auctionRoyaltyNotices(auction, settlement.royalties);
        } else {
          // No bids - return card to seller (unless it is gone), refund 50% of listing fee
          if (auction.cardInstanceId !== null) {
            await tx.cardOwnership.update({
              where: { id: auction.cardInstanceId },
              data: { isLocked: false },
            });
          }

          const refund = await refundListingFeeTx(tx, auction, "no_bids");

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
          return [];
        }
      });
      await notifyCards(db, notices);
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

        // Unlock card (unless it is gone)
        if (auction.cardInstanceId !== null) {
          await tx.cardOwnership.update({
            where: { id: auction.cardInstanceId },
            data: { isLocked: false },
          });
        }

        // The seller check above makes auction.sellerId the caller
        await refundListingFeeTx(tx, auction, "cancelled");
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

  /** One page of active auctions, with filters. */
  async getActiveAuctions(
    params: {
      cardId?: string;
      realmId?: string;
      sellerId?: string;
      isFeatured?: boolean;
      rarity?: CardRarity;
      cardType?: CardType;
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

    const cards: Prisma.CardWhereInput = {
      ...(params.cardId ? { id: params.cardId } : {}),
      ...(params.rarity ? { rarity: params.rarity } : {}),
      ...(params.cardType ? { cardType: params.cardType } : {}),
      ...(params.realmId ? { realmId: params.realmId } : {}),
    };
    const currentBid: Prisma.IntFilter = {
      ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
      ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
    };
    // Every filter is in the query, so the count and the page agree
    const where: Prisma.CardAuctionWhereInput = {
      status: "ACTIVE",
      endTime: { gt: new Date() },
      ...(params.sellerId ? { sellerId: params.sellerId } : {}),
      ...(params.isFeatured !== undefined ? { isFeatured: params.isFeatured } : {}),
      ...(Object.keys(cards).length > 0 ? { CardOwnership: { cards } } : {}),
      ...(Object.keys(currentBid).length > 0 ? { currentBid } : {}),
    };

    const SORTS: Record<string, Prisma.CardAuctionOrderByWithRelationInput> = {
      newest: { createdAt: "desc" },
      price_low: { currentBid: "asc" },
      price_high: { currentBid: "desc" },
    };
    const orderBy: Prisma.CardAuctionOrderByWithRelationInput[] = [
      { isFeatured: "desc" },
      SORTS[params.sortBy ?? ""] ?? { endTime: "asc" },
    ];

    const [total, auctions] = await Promise.all([
      db.cardAuction.count({ where }),
      db.cardAuction.findMany({
        where,
        include: {
          CardOwnership: { include: { cards: true } },
          AuctionBid: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
    ]);

    return { auctions, total, hasMore: offset + limit < total };
  }
}

// Export singleton instance
export const auctionService = new AuctionService();
