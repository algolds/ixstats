/**
 * Auction Service
 *
 * Comprehensive auction engine for IxCards marketplace
 * Handles auction creation, bidding, buyouts, completions, and market analytics
 *
 * Features:
 * - Atomic transactions for race condition protection
 * - IxCredits integration via vault-service
 * - real-time auction timing: 24 hours, 3 days or 7 days
 * - Auto-extension for last-minute bids
 * - Market fee calculation (admin house rake, default 10%, on sales >100 IxC)
 * - Listing fees and the unsold refund from the Economy tab; the fee paid is stored on the auction
 * - Bid validation (5% minimum increment)
 * - Notices after the commit
 */

import { vaultService, getVaultConfig, LedgerError } from "~/lib/vault/vault-service";
import { TRPCError } from "@trpc/server";
import type { CardRarity, CardType, Prisma, PrismaClient } from "@prisma/client";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { boundCopyError } from "~/lib/cards/bound";
import { INSCRIPTION_OMIT } from "~/lib/cards/inscription";
import { notifyCard, notifyCards } from "~/lib/cards/card-notify";
import { getEconomyConfig } from "~/lib/cards/economy-config";
import { AUCTION_DURATION_MS, type AuctionDuration } from "~/lib/cards/market/auction-timing";
import { listingRefund } from "~/lib/cards/market/fees";
import { royaltyNotices } from "~/lib/cards/market/royalty";
import {
  settleCardSaleTx,
  type CardSale,
  type SaleSettlement,
} from "~/lib/cards/market/settle-sale";
import { auctionEndNotices, type AuctionEnd } from "~/lib/economy/auction-notices";
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

/** Every broadcast follows a commit, so a failure is logged and never fails the call or skips its notices. */
async function broadcastMarket(message: MarketBroadcastMessage): Promise<void> {
  try {
    publishMarketEvent(message, await getMarketWs());
  } catch (error) {
    console.warn(`[Auction Service] The ${message.type} broadcast failed:`, error);
  }
}

const broadcastComplete = (auctionId: string, winnerId: string | null, finalPrice: number) =>
  broadcastMarket({ type: "auction_complete", data: { auctionId, winnerId, finalPrice } });

/** An auction as a sale reads it: its copy (null once gone) and its card's title, stored with the auction. */
const AUCTION_READ = {
  CardOwnership: { include: { cards: true } },
  card: { select: { title: true } },
} satisfies Prisma.CardAuctionInclude;

type AuctionWithCard = Prisma.CardAuctionGetPayload<{ include: typeof AUCTION_READ }>;

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

/** Auctions are closed during maintenance or while the market switch is off. */
async function assertAuctionsOpen(db: PrismaClient): Promise<void> {
  const config = await getVaultConfig(db);
  if (config.isMaintenanceMode) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Vault economy is currently in maintenance mode.",
    });
  }
  if (!config.isAuctionsEnabled) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The card market is closed right now." });
  }
}

/**
 * Runs an auction call: a ledger refusal is the player's to fix (BAD_REQUEST), a TRPCError passes through, anything
 * else is logged and becomes a 500 with `fallback` as its message.
 */
async function auctionCall<T>(fallback: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof LedgerError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    if (error instanceof TRPCError) throw error;
    console.error(`[Auction Service] ${fallback}:`, error);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
  }
}

/** Everyone who bid on an auction. */
async function biddersOf(db: PrismaClient, auctionId: string): Promise<string[]> {
  const bids = await db.auctionBid.findMany({
    where: { auctionId },
    select: { bidderId: true },
    distinct: ["bidderId"],
  });
  return bids.map((bid) => bid.bidderId);
}

/**
 * The end-of-auction and royalty notices, sent after the commit. A failure, the bidder read included, is logged and
 * never fails the sale that has committed.
 */
async function notifyEnd(
  db: PrismaClient,
  auction: AuctionWithCard,
  end: Pick<AuctionEnd, "winnerId" | "price" | "refund" | "byBuyout">,
  settlement: SaleSettlement | null
): Promise<void> {
  try {
    const bidderIds = end.winnerId ? await biddersOf(db, auction.id) : [];
    await notifyCards(db, [
      ...auctionEndNotices({
        ...end,
        auctionId: auction.id,
        cardId: auction.cardId,
        cardTitle: auction.card.title,
        sellerId: auction.sellerId,
        sellerNet: settlement?.sellerNet ?? 0,
        bidderIds,
      }),
      ...royaltyNotices(
        settlement?.royalties ?? [],
        new Map([[auction.cardId, auction.card.title]])
      ),
    ]);
  } catch (error) {
    console.warn(`[Auction Service] End notices failed for auction ${auction.id}:`, error);
  }
}

/**
 * The seller's share of the listing fee back when an auction ends unsold: the seller or an admin cancels it, or it
 * expires with no bids. The share is the Economy tab's refund percent of the fee the auction stored, so a free
 * listing refunds nothing. REFUND is never capped. Returns the amount refunded.
 */
export async function refundListingFeeTx(
  tx: Prisma.TransactionClient,
  auction: { id: string; sellerId: string; listingFee: number },
  reason: "cancelled" | "no_bids" | "admin_cancel"
): Promise<number> {
  const refund = listingRefund(auction.listingFee, (await getEconomyConfig(tx)).listingRefundPct);
  if (refund > 0) {
    await vaultService.earnCreditsTx(tx, {
      userId: auction.sellerId,
      amount: refund,
      type: "REFUND",
      source: "auction_fee_refund",
      metadata: { auctionId: auction.id, reason },
    });
  }
  return refund;
}

export class AuctionService {
  /**
   * Create new auction listing
   *
   * Locks the copy, charges the Economy tab's listing fee and creates the auction, in one transaction
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
      duration: AuctionDuration;
      isFeatured?: boolean;
    },
    db: PrismaClient
  ) {
    await assertAuctionsOpen(db);
    if (!Number.isInteger(params.startingPrice) || params.startingPrice < 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Starting price must be at least 1 IxC",
      });
    }
    if (params.buyoutPrice !== undefined && params.buyoutPrice <= params.startingPrice) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Buyout price must be higher than starting price",
      });
    }
    const cfg = await getEconomyConfig(db);
    const isFeatured = params.isFeatured ?? false;
    const listingFee = isFeatured ? cfg.listingFeeFeatured : cfg.listingFee;
    // Real-world wall clock: auctions run in real time
    const endTime = new Date(Date.now() + AUCTION_DURATION_MS[params.duration]);

    return auctionCall("Failed to create auction", async () => {
      const auction = await db.$transaction(async (tx) => {
        const copy = await tx.cardOwnership.findFirst({
          where: { id: params.cardId, ownerId: params.userId },
          select: {
            id: true,
            cardId: true,
            serialNumber: true,
            cards: { select: { isBound: true } },
          },
        });
        if (!copy) throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this card" });
        // Bound cards (trophies, achievement rewards) can't be listed
        if (copy.cards.isBound) throw boundCopyError();
        // Two listings of one copy both pass the read above; only one wins the lock, and only it pays
        const locked = await tx.cardOwnership.updateMany({
          where: { id: copy.id, ownerId: params.userId, isLocked: false },
          data: { isLocked: true },
        });
        if (locked.count !== 1) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This card is already listed or in a trade",
          });
        }
        if (listingFee > 0) {
          await vaultService.spendCreditsTx(tx, {
            userId: params.userId,
            amount: listingFee,
            type: "SPEND_MARKET",
            source: "auction_listing_fee",
            metadata: { cardId: params.cardId, isFeatured, duration: params.duration },
          });
        }
        return tx.cardAuction.create({
          data: {
            id: `auction_${Date.now()}_${crypto.randomUUID()}`,
            cardInstanceId: copy.id,
            cardId: copy.cardId,
            serialNumber: copy.serialNumber,
            sellerId: params.userId,
            startingPrice: params.startingPrice,
            currentBid: params.startingPrice,
            buyoutPrice: params.buyoutPrice,
            endTime,
            isFeatured,
            listingFee,
            status: "ACTIVE",
          },
        });
      });

      console.log(
        `[Auction Service] Created auction ${auction.id} for card ${params.cardId} by user ${params.userId}`
      );

      await broadcastMarket({ type: "auction_created", data: auction });

      return auction;
    });
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
    await assertAuctionsOpen(db);

    // 1. Fetch auction with current bid info
    const auction = await db.cardAuction.findUnique({
      where: { id: params.auctionId },
      include: { card: { select: { title: true } } },
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
    return auctionCall("Failed to place bid", async () => {
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
            message: "This auction changed. Reload and try again.",
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

      // 9. Tell the outbid bidder (a failed notice is logged; a muted card sends none)
      if (auction.currentBidderId) {
        await notifyCard(db, {
          userId: auction.currentBidderId,
          cardId: auction.cardId,
          title: "You've been outbid",
          message: `Someone placed a higher bid of ${params.amount} IxC on ${auction.card.title}.`,
          type: "warning",
          priority: "high",
          metadata: { auctionId: params.auctionId, newBid: params.amount },
        });
      }

      return { success: true };
    });
  }

  /**
   * Execute instant buyout
   *
   * Transfers IxCredits and card ownership immediately, ends auction, and grants the buyer's card XP, in one
   * transaction
   *
   * @param params Buyout parameters
   * @param db Prisma client
   * @returns Success result, with the XP granted
   */
  async executeBuyout(
    params: {
      userId: string;
      auctionId: string;
    },
    db: PrismaClient
  ) {
    await assertAuctionsOpen(db);

    const auction = await db.cardAuction.findUnique({
      where: { id: params.auctionId },
      include: AUCTION_READ,
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

    return auctionCall("Failed to execute buyout", async () => {
      const { settlement, xp } = await db.$transaction(async (tx) => {
        // 1. Settle the auction (compare-and-swap on the state read above, while it still runs). If a bid,
        // another buyout or the end got there first, nothing below runs: an ended auction is the high bidder's,
        // even before the cron settles it.
        const claimed = await tx.cardAuction.updateMany({
          where: {
            id: params.auctionId,
            status: "ACTIVE",
            currentBid: auction.currentBid,
            currentBidderId: auction.currentBidderId,
            endTime: { gt: new Date() },
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
        const sale = auctionSale(auction, params.userId, buyoutPrice, "AUCTION_BUYOUT");
        const settled = await settleCardSaleTx(tx, sale);
        // 4. Card XP for the bought copy, as for an auction win
        const granted = await grantCardXp(
          tx,
          sale.ownershipId,
          "AUCTION_WIN",
          JSON.stringify({ auctionId: params.auctionId })
        );
        return { settlement: settled, xp: granted };
      });

      console.log(
        `[Auction Service] User ${params.userId} bought card instance ${auction.cardInstanceId} via buyout for ${buyoutPrice} IxC`
      );

      await broadcastComplete(params.auctionId, params.userId, buyoutPrice);
      await notifyEnd(
        db,
        auction,
        { winnerId: params.userId, price: buyoutPrice, refund: 0, byBuyout: true },
        settlement
      );

      return { success: true as const, xp };
    });
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
      include: AUCTION_READ,
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
    const winnerId = auction.currentBidderId;

    try {
      // Only money and copies move inside; the broadcast and the notices follow the commit
      const outcome = await db.$transaction(async (tx) => {
        // Settle the auction first (compare-and-swap on the state read above). A buyout,
        // a cancel or another cron run that got there first leaves nothing to do.
        const claimed = await tx.cardAuction.updateMany({
          where: {
            id: auctionId,
            status: "ACTIVE",
            currentBidderId: auction.currentBidderId,
            currentBid: auction.currentBid,
          },
          data: winnerId ? { status: "COMPLETED", winnerId, finalPrice } : { status: "CANCELLED" },
        });
        if (claimed.count !== 1) {
          return null;
        }

        if (winnerId) {
          // Credits were reserved from the bidder at bid time; pay the seller and hand over the card
          assertCopyOnSale(auction);
          const sale = auctionSale(auction, winnerId, finalPrice, "AUCTION_END");
          const settlement = await settleCardSaleTx(tx, sale);
          // Card XP for the winner's copy (the Economy tab's auction-win amount)
          await grantCardXp(tx, sale.ownershipId, "AUCTION_WIN", JSON.stringify({ auctionId }));
          return { settlement, refund: 0 };
        }

        // No bids: the copy goes back to the seller (unless it is gone) with their share of the listing fee
        if (auction.cardInstanceId !== null) {
          await tx.cardOwnership.updateMany({
            where: { id: auction.cardInstanceId, ownerId: auction.sellerId },
            data: { isLocked: false },
          });
        }
        return { settlement: null, refund: await refundListingFeeTx(tx, auction, "no_bids") };
      });
      if (!outcome) return;

      console.log(
        `[Auction Service] Completed auction ${auctionId}: ${winnerId ? `won by ${winnerId} for ${finalPrice} IxC` : `no bids, ${outcome.refund} IxC refunded`}`
      );

      // An unsold auction goes out as complete, with the seller and 0, as before
      await broadcastComplete(auctionId, winnerId ?? auction.sellerId, winnerId ? finalPrice : 0);
      await notifyEnd(
        db,
        auction,
        { winnerId, price: winnerId ? finalPrice : 0, refund: outcome.refund, byBuyout: false },
        outcome.settlement
      );
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
   * @returns Success result, with the listing fee refunded
   */
  async cancelAuction(
    params: {
      userId: string;
      auctionId: string;
    },
    db: PrismaClient
  ) {
    await assertAuctionsOpen(db);

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

    return auctionCall("Failed to cancel auction", async () => {
      const refund = await db.$transaction(async (tx) => {
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

        // Unlock the seller's copy (unless it is gone)
        if (auction.cardInstanceId !== null) {
          await tx.cardOwnership.updateMany({
            where: { id: auction.cardInstanceId, ownerId: auction.sellerId },
            data: { isLocked: false },
          });
        }

        // The seller check above makes auction.sellerId the caller
        return refundListingFeeTx(tx, auction, "cancelled");
      });

      console.log(`[Auction Service] User ${params.userId} cancelled auction ${params.auctionId}`);

      await broadcastComplete(params.auctionId, params.userId, 0);

      return { success: true as const, refund };
    });
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
          CardOwnership: { omit: INSCRIPTION_OMIT, include: { cards: true } },
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
