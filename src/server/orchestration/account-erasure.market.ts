/**
 * Account erasure's market step: the user's open listings, auctions, trades and Exchange orders end by the existing
 * cancel paths, so locked copies unlock, fees/escrow refund, shares/bonds return to holdings and other players' bids
 * are refunded, never deleted. One that cannot end (an auction past its end settles on its own) is logged and left to
 * its cron; it never stops the erasure.
 */
import type { PrismaClient } from "@prisma/client";
import { lockBond, returnListingTx } from "~/lib/exchange/bonds";
import { closeBuyOrder, returnShareListingTx } from "~/lib/exchange/fills";
import { lockCompany } from "~/lib/exchange/ownership";
import { adminCancelAuction, adminCancelListing } from "~/server/modules/cards/cards.tools";
import { cancelTradeOffer, rejectTradeOffer } from "~/server/modules/cards/trading/trade-service";

/** The card audit's actor for what an erasure cancels. */
const ERASURE_ACTOR_ID = "system:account-erasure";
const REASON = "The seller closed their account.";

interface MarketUser {
  id: string;
  clerkUserId: string;
}

/** End each item, logging (never throwing) the ones that cannot end; returns how many ended. */
async function endEach<T extends { id: string }>(
  kind: string,
  items: readonly T[],
  end: (item: T) => Promise<object | void>
): Promise<number> {
  let ended = 0;
  for (const item of items) {
    try {
      await end(item);
      ended++;
    } catch (error) {
      console.error(
        `[account-erasure] could not end ${kind} ${item.id}:`,
        (error as Error).message
      );
    }
  }
  return ended;
}

async function endListingsAndAuctions(db: PrismaClient, user: MarketUser): Promise<number> {
  const actor = { dbId: user.id, clerkId: ERASURE_ACTOR_ID };
  const open = { where: { sellerId: user.id, status: "ACTIVE" as const }, select: { id: true } };
  const [listings, auctions] = await Promise.all([
    db.cardListing.findMany(open),
    db.cardAuction.findMany(open),
  ]);
  const listingsEnded = await endEach("listing", listings, ({ id }) =>
    adminCancelListing(db, actor, { listingId: id, reason: REASON })
  );
  const auctionsEnded = await endEach("auction", auctions, ({ id }) =>
    adminCancelAuction(db, actor, { auctionId: id, reason: REASON })
  );
  return listingsEnded + auctionsEnded;
}

/** Open trades: the user withdraws the ones they proposed and turns down the ones waiting on them. */
async function endTrades(db: PrismaClient, user: MarketUser, now: Date): Promise<number> {
  const trades = await db.tradeOffer.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: now },
      OR: [{ initiatorId: user.id }, { recipientId: user.id }],
    },
    select: { id: true, proposerId: true },
  });
  return endEach("trade", trades, (trade) => {
    const end = trade.proposerId === user.id ? cancelTradeOffer : rejectTradeOffer;
    return end(db, { user, tradeId: trade.id, now });
  });
}

/**
 * Open Exchange orders: return listed shares to the user's holding, refund buy-order escrow to the wallet, and return
 * listed bond units to the holding via the transaction-level internals (working even while the Exchange is closed).
 */
async function endExchangeOrders(db: PrismaClient, user: MarketUser): Promise<number> {
  const [shareListings, buyOrders, bondListings] = await Promise.all([
    db.shareListing.findMany({
      where: { sellerUserId: user.id, status: "OPEN" },
      select: { id: true, companyId: true },
    }),
    db.shareBuyOrder.findMany({
      where: { buyerUserId: user.id, status: "OPEN" },
      select: { id: true, companyId: true },
    }),
    db.bondListing.findMany({
      where: { sellerUserId: user.id, status: "OPEN" },
      select: { id: true, bondId: true },
    }),
  ]);
  const sharesEnded = await endEach("share listing", shareListings, ({ id, companyId }) =>
    db.$transaction(async (tx) => {
      await lockCompany(tx, companyId);
      const listing = await tx.shareListing.findUnique({ where: { id } });
      if (!listing || listing.status !== "OPEN" || listing.sellerUserId !== user.id) return;
      await returnShareListingTx(tx, listing);
    })
  );
  const bidsEnded = await endEach("share buy order", buyOrders, ({ id, companyId }) =>
    db.$transaction(async (tx) => {
      await lockCompany(tx, companyId);
      const order = await tx.shareBuyOrder.findUnique({ where: { id } });
      if (!order || order.status !== "OPEN" || order.buyerUserId !== user.id) return;
      await closeBuyOrder(tx, order);
    })
  );
  const bondsEnded = await endEach("bond listing", bondListings, ({ id, bondId }) =>
    db.$transaction(async (tx) => {
      await lockBond(tx, bondId);
      const listing = await tx.bondListing.findUnique({ where: { id } });
      if (!listing || listing.status !== "OPEN" || listing.sellerUserId !== user.id) return;
      await returnListingTx(tx, listing);
    })
  );
  return sharesEnded + bidsEnded + bondsEnded;
}

/** End every open market item of `user`; returns how many ended. */
export async function closeMarketItems(
  db: PrismaClient,
  user: MarketUser,
  now: Date
): Promise<number> {
  return (
    (await endListingsAndAuctions(db, user)) +
    (await endTrades(db, user, now)) +
    (await endExchangeOrders(db, user))
  );
}
