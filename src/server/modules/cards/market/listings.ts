/**
 * Fixed-price listings: one copy at one price for the Economy tab's listing days. Listing costs the Economy tab's fee
 * (more when featured), charged after the copy's lock and stored on the listing; cancel and expiry refund a share of
 * what was stored. The copy is locked while listed. A sale settles like an auction: the seller gets the price less the
 * market fee, the royalty comes out of that fee, and the sale is recorded with the serial and finish the listing
 * stored. Notices are built in the transaction and sent after the commit.
 */
import type { CardFinish, CardListing, Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { boundCopyError } from "~/lib/cards/bound";
import { notifyCards, type CardNotice } from "~/lib/cards/card-notify";
import { getEconomyConfig } from "~/lib/cards/economy-config";
import { marketTabHref } from "~/lib/cards/hub-routes";
import { listingRefund, MAX_LISTING_PRICE } from "~/lib/cards/market/fees";
import { royaltyNotices } from "~/lib/cards/market/royalty";
import { settleCardSaleTx, type SaleSettlement } from "~/lib/cards/market/settle-sale";
import { earnCreditsTx, LedgerError, spendCreditsTx } from "~/lib/vault/vault-ledger";
import { getVaultConfig } from "~/lib/vault/vault-perks";

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 30;
const MAX_MY_LISTINGS = 100;
const SELLING_HREF = marketTabHref("selling");

type Code = "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT";
const fail = (code: Code, message: string) => new TRPCError({ code, message });

/** Listings run under the auctions' market switch, and close in maintenance. */
async function assertMarketOpen(db: PrismaClient): Promise<void> {
  const config = await getVaultConfig(db);
  if (config.isMaintenanceMode) {
    throw fail("BAD_REQUEST", "Vault economy is currently in maintenance mode.");
  }
  if (!config.isAuctionsEnabled) throw fail("BAD_REQUEST", "The card market is closed right now.");
}

/** A ledger refusal (not enough credits, a switch off) is a BAD_REQUEST the player can act on. */
async function ledgerSafe<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof LedgerError) throw fail("BAD_REQUEST", error.message);
    throw error;
  }
}

export interface CreateListingInput {
  sellerId: string;
  ownershipId: string;
  price: number;
  isFeatured: boolean;
  now: Date;
}

export async function createListing(
  db: PrismaClient,
  input: CreateListingInput
): Promise<CardListing> {
  await assertMarketOpen(db);
  if (!Number.isInteger(input.price) || input.price < 1 || input.price > MAX_LISTING_PRICE) {
    throw fail(
      "BAD_REQUEST",
      `Set a whole price from 1 to ${MAX_LISTING_PRICE.toLocaleString("en")} IxC.`
    );
  }
  const cfg = await getEconomyConfig(db);
  const fee = input.isFeatured ? cfg.listingFeeFeatured : cfg.listingFee;
  return ledgerSafe(() =>
    db.$transaction(async (tx) => {
      const copy = await tx.cardOwnership.findFirst({
        where: { id: input.ownershipId, ownerId: input.sellerId },
        select: {
          id: true,
          cardId: true,
          serialNumber: true,
          finish: true,
          cards: { select: { isBound: true } },
        },
      });
      if (!copy) throw fail("NOT_FOUND", "You don't own this copy.");
      if (copy.cards.isBound) throw boundCopyError();
      // Two listings of one copy both pass the read above; only one wins the lock, and only it pays
      const locked = await tx.cardOwnership.updateMany({
        where: { id: copy.id, ownerId: input.sellerId, isLocked: false },
        data: { isLocked: true },
      });
      if (locked.count !== 1) throw fail("CONFLICT", "This copy is already listed or in a trade.");
      if (fee > 0) {
        await spendCreditsTx(tx, {
          userId: input.sellerId,
          amount: fee,
          type: "SPEND_MARKET",
          source: "listing_fee",
          metadata: { ownershipId: copy.id, isFeatured: input.isFeatured },
        });
      }
      return tx.cardListing.create({
        data: {
          ownershipId: copy.id,
          cardId: copy.cardId,
          // Stored, so the listing outlives its copy (a fuse or break-down after the sale)
          serialNumber: copy.serialNumber,
          finish: copy.finish,
          sellerId: input.sellerId,
          price: input.price,
          isFeatured: input.isFeatured,
          listingFee: fee,
          expiresAt: new Date(input.now.getTime() + cfg.listingDays * DAY_MS),
        },
      });
    })
  );
}

/** How a listing ended unsold; the refund's ledger row records it. */
export type ListingEnd = "cancelled" | "expired" | "admin_cancel";

type EndableListing = Pick<CardListing, "id" | "ownershipId" | "sellerId" | "listingFee">;

/**
 * Ends an ACTIVE listing unsold, as CANCELLED (the seller or an admin) or EXPIRED (only once it is due): unlocks the
 * copy (unless it is gone) and refunds the Economy tab's share of the fee the listing stored. The one refund path for
 * listings. Returns the refund, or null when the listing was no longer active (it sold, or another run ended it).
 */
export async function endListingTx(
  tx: Prisma.TransactionClient,
  listing: EndableListing,
  end: ListingEnd,
  now: Date
): Promise<number | null> {
  const claimed = await tx.cardListing.updateMany({
    where: {
      id: listing.id,
      status: "ACTIVE",
      ...(end === "expired" ? { expiresAt: { lte: now } } : {}),
    },
    data: { status: end === "expired" ? "EXPIRED" : "CANCELLED" },
  });
  if (claimed.count !== 1) return null;
  if (listing.ownershipId !== null) {
    await tx.cardOwnership.updateMany({
      where: { id: listing.ownershipId, ownerId: listing.sellerId },
      data: { isLocked: false },
    });
  }
  const refund = listingRefund(listing.listingFee, (await getEconomyConfig(tx)).listingRefundPct);
  if (refund > 0) {
    // REFUND is never capped
    await earnCreditsTx(tx, {
      userId: listing.sellerId,
      amount: refund,
      type: "REFUND",
      source: "listing_fee_refund",
      metadata: { listingId: listing.id, reason: end },
    });
  }
  return refund;
}

const ENDABLE_SELECT = {
  id: true,
  ownershipId: true,
  sellerId: true,
  listingFee: true,
} satisfies Prisma.CardListingSelect;

export async function cancelListing(
  db: PrismaClient,
  input: { sellerId: string; listingId: string; now: Date }
): Promise<{ refund: number }> {
  await assertMarketOpen(db);
  const listing = await db.cardListing.findUnique({
    where: { id: input.listingId },
    select: ENDABLE_SELECT,
  });
  if (!listing || listing.sellerId !== input.sellerId) {
    throw fail("NOT_FOUND", "Listing not found.");
  }
  const refund = await ledgerSafe(() =>
    db.$transaction((tx) => endListingTx(tx, listing, "cancelled", input.now))
  );
  if (refund === null) throw fail("CONFLICT", "This listing has already sold or ended.");
  return { refund };
}

export interface ListingPurchase {
  listingId: string;
  ownershipId: string;
  cardId: string;
  sellerId: string;
  price: number;
  settlement: SaleSettlement;
}

/** The seller's "sold" notice and the royalty notices, built inside the sale's transaction and sent after it. */
function soldNotices(
  listing: { id: string; cardId: string; sellerId: string; price: number; title: string },
  settlement: SaleSettlement
): CardNotice[] {
  // A sale at or under the fee threshold pays no market fee
  const feeTaken = settlement.fee > 0 ? " after the market fee" : "";
  return [
    {
      userId: listing.sellerId,
      cardId: listing.cardId,
      title: "Your listing sold",
      message: `${listing.title} sold for ${listing.price} IxC. You received ${settlement.sellerNet} IxC${feeTaken}.`,
      type: "success",
      priority: "high",
      href: SELLING_HREF,
      metadata: { listingId: listing.id },
    },
    ...royaltyNotices(settlement.royalties, new Map([[listing.cardId, listing.title]])),
  ];
}

export async function buyListing(
  db: PrismaClient,
  input: { buyerId: string; listingId: string; now: Date }
): Promise<ListingPurchase> {
  await assertMarketOpen(db);
  const listing = await db.cardListing.findUnique({
    where: { id: input.listingId },
    include: { card: { select: { title: true, cardType: true, countryId: true } } },
  });
  if (!listing || listing.status !== "ACTIVE" || listing.expiresAt <= input.now) {
    throw fail("NOT_FOUND", "This listing is no longer available.");
  }
  if (listing.sellerId === input.buyerId) {
    throw fail("BAD_REQUEST", "You can't buy your own listing.");
  }
  // A live listing's copy is locked, so nothing burns it: a copy gone is refused before anything moves
  const ownershipId = listing.ownershipId;
  if (ownershipId === null) throw fail("CONFLICT", "This listing's card no longer exists.");

  const { settlement, notices } = await ledgerSafe(() =>
    db.$transaction(async (tx) => {
      // The claim: a second buyer, a cancel or the expiry that got there first leaves nothing to pay
      const claimed = await tx.cardListing.updateMany({
        where: { id: listing.id, status: "ACTIVE", expiresAt: { gt: input.now } },
        data: { status: "SOLD", buyerId: input.buyerId, soldAt: input.now },
      });
      if (claimed.count !== 1) throw fail("CONFLICT", "This listing was just sold or withdrawn.");
      await spendCreditsTx(tx, {
        userId: input.buyerId,
        amount: listing.price,
        type: "SPEND_MARKET",
        source: "card_purchase_listing",
        metadata: { listingId: listing.id, ownershipId },
      });
      const settled = await settleCardSaleTx(tx, {
        ownershipId,
        cardId: listing.cardId,
        // The serial and finish the listing stored
        serialNumber: listing.serialNumber,
        finish: listing.finish,
        cardType: listing.card.cardType,
        countryId: listing.card.countryId,
        sellerId: listing.sellerId,
        buyerId: input.buyerId,
        price: listing.price,
        action: "LISTING_SALE",
        sellerSource: "card_sale_listing",
        context: { listingId: listing.id },
        now: input.now,
      });
      return {
        settlement: settled,
        notices: soldNotices({ ...listing, title: listing.card.title }, settled),
      };
    })
  );

  await notifyCards(db, notices);
  return {
    listingId: listing.id,
    ownershipId,
    cardId: listing.cardId,
    sellerId: listing.sellerId,
    price: listing.price,
    settlement,
  };
}

function expiredNotice(
  listing: { id: string; cardId: string; sellerId: string; card: { title: string } },
  refund: number
): CardNotice {
  const refunded = refund > 0 ? ` We refunded ${refund} IxC of the listing fee.` : "";
  return {
    userId: listing.sellerId,
    cardId: listing.cardId,
    title: "Your listing expired",
    message: `${listing.card.title} is back in your collection.${refunded}`,
    priority: "low",
    href: SELLING_HREF,
    metadata: { listingId: listing.id },
  };
}

/**
 * Expires due listings, one transaction each. A listing that sold or ended meanwhile is skipped; one that fails (a
 * refund refused in maintenance) is logged, counted and left active, so a later run ends it.
 */
export async function expireListings(
  db: PrismaClient,
  now: Date,
  limit = 200
): Promise<{ expired: number; failed: number }> {
  const due = await db.cardListing.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    select: { ...ENDABLE_SELECT, cardId: true, card: { select: { title: true } } },
    orderBy: { expiresAt: "asc" },
    take: limit,
  });
  let expired = 0;
  let failed = 0;
  for (const listing of due) {
    try {
      const notice = await db.$transaction(async (tx) => {
        const refund = await endListingTx(tx, listing, "expired", now);
        return refund === null ? null : expiredNotice(listing, refund);
      });
      if (notice === null) continue;
      expired++;
      await notifyCards(db, [notice]);
    } catch (error) {
      failed++;
      console.error(`[Listings] Listing ${listing.id} could not expire:`, error);
    }
  }
  return { expired, failed };
}

export interface CardListingRow {
  id: string;
  price: number;
  isFeatured: boolean;
  expiresAt: Date;
  sellerId: string;
  /** Null once the copy is gone; the serial and finish stay on the listing. */
  ownershipId: string | null;
  finish: CardFinish;
  serialNumber: number;
}

export interface MyListing extends CardListingRow {
  status: CardListing["status"];
  cardId: string;
  cardTitle: string;
  soldAt: Date | null;
}

/** The seller's listings: active first, then the last 30 days' sold, cancelled and expired, as each stored them. */
export async function listMyListings(
  db: Pick<PrismaClient, "cardListing">,
  sellerId: string,
  now: Date = new Date()
): Promise<MyListing[]> {
  const rows = await db.cardListing.findMany({
    where: {
      sellerId,
      OR: [
        { status: "ACTIVE" },
        { updatedAt: { gte: new Date(now.getTime() - HISTORY_DAYS * DAY_MS) } },
      ],
    },
    select: {
      id: true,
      price: true,
      isFeatured: true,
      expiresAt: true,
      sellerId: true,
      ownershipId: true,
      finish: true,
      serialNumber: true,
      status: true,
      cardId: true,
      soldAt: true,
      card: { select: { title: true } },
    },
    // The status enum's order puts ACTIVE first
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
    take: MAX_MY_LISTINGS,
  });
  return rows.map(({ card, ...row }) => ({ ...row, cardTitle: card.title }));
}
