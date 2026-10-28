/**
 * Account erasure's market step: the user's open listings, auctions and trades end by the existing cancel paths, so
 * locked copies unlock, fees refund and other players' bids are refunded, never deleted. One that cannot end (an
 * auction past its end settles on its own) is logged and left to its cron; it never stops the erasure.
 */
import type { PrismaClient } from "@prisma/client";
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

/** End every open market item of `user`; returns how many ended. */
export async function closeMarketItems(
  db: PrismaClient,
  user: MarketUser,
  now: Date
): Promise<number> {
  return (await endListingsAndAuctions(db, user)) + (await endTrades(db, user, now));
}
