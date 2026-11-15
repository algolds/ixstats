/**
 * The share market: a two-sided limit order book per company. Spec: docs/specs/2026-11-01-exchange-phase-3-design.md.
 *
 * Asks (ShareListing) are primary issues (sellerUserId null: new shares, proceeds to the company's
 * capital) and secondary holder listings (shares escrowed out of the holding until sold or cancelled,
 * proceeds to the seller's wallet). Bids (ShareBuyOrder) are limit orders: the buyer's ₷ is escrowed at
 * the limit and the unfilled remainder rests until it fills or is cancelled. Crossing orders trade at
 * the resting order's price, cheapest ask or highest bid first, then oldest first. A secondary seller's
 * gain over their average cost is taxed at the HQ nation's capital gains rate, paid into its treasury.
 *
 * Founder controls: trading on or off (`Company.tradingOpen`), issuing new shares, cancelling the issue,
 * dividends (dividends.ts). Control never moves with shares.
 *
 * Every trade locks the company row first, then wallets in user-id order, and moves ₷ with the wallet
 * ledger's conditional decrement under an idempotency key: a retried order is applied once, a buyer
 * can't overdraw, and a listing or bid can't trade more shares than it has.
 */

import type { Company, PrismaClient, ShareListing } from "@prisma/client";
import {
  ExchangeError,
  earnSovereignsTx,
  isUniqueViolation,
  spendSovereignsTx,
} from "~/lib/vault/exchange-service";
import { assertNoVoteNeeded, requireOwnedCompany } from "./companies";
import { assertNotFundInsiderPair, isFundInsiderPair } from "./fund-insiders";
import { assertExchangeOpen, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { centsOf, dbCents } from "./amounts";
import { fromCents, lockCompany, toCents } from "./ownership";
import {
  askRank,
  closeBuyOrder,
  consumeAsk,
  consumeBid,
  creditHolding,
  crossingBids,
  crossingParties,
  fillBuyerAgainstAsk,
  lockParties,
  paySale,
  pushSaleNotice,
  recordTrade,
  refundRank,
  returnShareListingTx,
  takeFills,
  boughtNotice,
} from "./fills";

/** Most shares a company may ever have issued. */
export const MAX_SHARES_ISSUED = 1_000_000;
/** Open secondary listings one holder may have per company. */
export const MAX_OPEN_LISTINGS_PER_HOLDER = 5;
/** Open buy orders one buyer may rest per company. */
export const MAX_OPEN_BIDS_PER_HOLDER = 5;

export interface PlaceBuyOrderInput {
  userId: string;
  companyId: string;
  shares: number;
  maxPricePerShare: number;
  requestId: string;
}

/** `sharesBought` and `sharesResting` count this order's shares to date. */
export interface BuyOrderResult {
  orderId: string | null;
  sharesBought: number;
  sharesResting: number;
  alreadyApplied: boolean;
}

export interface IssueSharesInput {
  userId: string;
  companyId: string;
  shares: number;
  requestId: string;
  viaVote?: boolean;
}

function assertWholeShares(shares: number): void {
  if (!Number.isInteger(shares) || shares <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Shares must be a whole number above zero");
  }
}

function assertPrice(price: number): void {
  if (!Number.isFinite(price) || price < 0.01 || toCents(price) / 100 !== price) {
    throw new ExchangeError("INVALID_AMOUNT", "Price must be at least ₷0.01, in whole cents");
  }
}

/** Primary issue price: fair value per outstanding share, rounded down to a cent, at least ₷0.01. */
export function primaryPricePerShare(fairValue: number, sharesOutstanding: number): number {
  if (sharesOutstanding <= 0) return 0.01;
  return Math.max(0.01, Math.floor((fairValue * 100) / sharesOutstanding) / 100);
}

async function requireTradable(tx: Db, companyId: string): Promise<Company> {
  const company = await tx.company.findUnique({ where: { id: companyId } });
  if (!company) throw new ExchangeError("NOT_FOUND", "Company not found");
  if (company.status !== "ACTIVE") {
    throw new ExchangeError("CONFLICT", "This company is no longer active");
  }
  if (!company.tradingOpen) {
    throw new ExchangeError("CONFLICT", `Share trading in ${company.name} is closed`);
  }
  return company;
}

/** Founder control: open or close trading in the company's shares. */
export async function setShareTrading(
  db: PrismaClient,
  input: { userId: string; companyId: string; open: boolean }
) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await lockCompany(tx, input.companyId);
    await requireOwnedCompany(tx, input.companyId, input.userId);
    await tx.company.update({ where: { id: input.companyId }, data: { tradingOpen: input.open } });
    return { tradingOpen: input.open };
  });
}

function issueKey(input: IssueSharesInput): string {
  return `exchange:share-issue:${input.userId}:${input.requestId}`;
}

const listingView = (l: ShareListing) => ({ ...l, pricePerShare: fromCents(centsOf(l.pricePerShare)) });

/**
 * The founder's primary issue inside the caller's transaction, under the company lock. Matches the new
 * shares against resting bids it crosses. The notices go out once the transaction commits.
 */
export async function issueSharesTx(
  tx: Db,
  input: IssueSharesInput
) {
  assertWholeShares(input.shares);
  await assertExchangeOpen(tx);
  await lockCompany(tx, input.companyId);
  const key = issueKey(input);
  const existing = await tx.shareListing.findUnique({ where: { idempotencyKey: key } });
  if (existing) return { listing: listingView(existing), alreadyApplied: true, notices: [] };

  await requireOwnedCompany(tx, input.companyId, input.userId);
  const company = await requireTradable(tx, input.companyId);
  if (!input.viaVote) await assertNoVoteNeeded(tx, company);
  const open = await tx.shareListing.count({
    where: { companyId: company.id, status: "OPEN", sellerUserId: null },
  });
  if (open > 0) throw new ExchangeError("CONFLICT", "This company already has shares on sale");
  if (input.shares > company.sharesIssued) {
    throw new ExchangeError(
      "LIMIT_REACHED",
      `An issue can at most double the shares: up to ${company.sharesIssued.toLocaleString("en-US")} now`
    );
  }
  if (company.sharesIssued + input.shares > MAX_SHARES_ISSUED) {
    throw new ExchangeError(
      "LIMIT_REACHED",
      `A company can issue at most ${MAX_SHARES_ISSUED.toLocaleString("en-US")} shares`
    );
  }

  const now = Date.now();
  const pricePerShare = dbCents(
    toCents(primaryPricePerShare(fromCents(centsOf(company.fairValue)), company.sharesOutstanding))
  );
  await tx.company.update({
    where: { id: company.id },
    data: { sharesIssued: { increment: input.shares } },
  });
  await tx.shareIssuance.create({
    data: { companyId: company.id, shares: input.shares, pricePerShare, issuedIxTime: now },
  });
  const created = await tx.shareListing.create({
    data: {
      companyId: company.id,
      sellerUserId: null,
      shares: input.shares,
      sharesListed: input.shares,
      pricePerShare,
      createdIxTime: now,
      idempotencyKey: key,
    },
  });
  const notices = await matchCompanyOrders(tx, company.id);
  const listing = await tx.shareListing.findUniqueOrThrow({ where: { id: created.id } });
  return { listing: listingView(listing), alreadyApplied: false, notices };
}

/** Founder issues new shares as a primary listing at fair value per share. */
export async function issueShares(db: PrismaClient, input: IssueSharesInput) {
  const key = issueKey(input);
  try {
    const { notices, ...result } = await db.$transaction((tx) => issueSharesTx(tx, input));
    notifyExchange(notices);
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const listing = await db.shareListing.findUnique({ where: { idempotencyKey: key } });
      if (listing) return { listing: listingView(listing), alreadyApplied: true };
    }
    throw error;
  }
}

/** A holder lists shares they own for sale; the shares leave their holding until sold or cancelled. */
export async function listShares(
  db: PrismaClient,
  input: {
    userId: string;
    companyId: string;
    shares: number;
    pricePerShare: number;
    requestId: string;
  }
) {
  assertWholeShares(input.shares);
  assertPrice(input.pricePerShare);
  const key = `exchange:share-list:${input.userId}:${input.requestId}`;
  const notices: ExchangeNotice[] = [];
  try {
    const result = await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      const existing = await tx.shareListing.findUnique({ where: { idempotencyKey: key } });
      if (existing) return { listing: listingView(existing), alreadyApplied: true };

      const company = await requireTradable(tx, input.companyId);
      const open = await tx.shareListing.count({
        where: { companyId: input.companyId, sellerUserId: input.userId, status: "OPEN" },
      });
      if (open >= MAX_OPEN_LISTINGS_PER_HOLDER) {
        throw new ExchangeError(
          "LIMIT_REACHED",
          `You can have up to ${MAX_OPEN_LISTINGS_PER_HOLDER} open listings per company`
        );
      }
      const { count } = await tx.shareholding.updateMany({
        where: {
          companyId: input.companyId,
          ownerUserId: input.userId,
          shares: { gte: input.shares },
        },
        data: { shares: { decrement: input.shares } },
      });
      if (count !== 1) throw new ExchangeError("INVALID_AMOUNT", "You don't hold that many shares");

      const listing = await tx.shareListing.create({
        data: {
          companyId: input.companyId,
          sellerUserId: input.userId,
          shares: input.shares,
          sharesListed: input.shares,
          pricePerShare: dbCents(toCents(input.pricePerShare)),
          createdIxTime: Date.now(),
          idempotencyKey: key,
        },
      });
      await matchAsk(tx, company, listing, notices);
      const current = await tx.shareListing.findUniqueOrThrow({ where: { id: listing.id } });
      return { listing: listingView(current), alreadyApplied: false };
    });
    notifyExchange(notices);
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const listing = await db.shareListing.findUnique({ where: { idempotencyKey: key } });
      if (listing) return { listing: listingView(listing), alreadyApplied: true };
    }
    throw error;
  }
}

/**
 * Withdraw what is left of a listing: the seller's shares go back to their holding; an
 * unsold primary issue (founder only) is un-issued. Works while trading is closed.
 */
export async function cancelListing(
  db: PrismaClient,
  input: { userId: string; listingId: string }
) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const found = await tx.shareListing.findUnique({ where: { id: input.listingId } });
    if (!found) throw new ExchangeError("NOT_FOUND", "Listing not found");
    await lockCompany(tx, found.companyId);
    const listing = await tx.shareListing.findUnique({ where: { id: input.listingId } });
    if (!listing || listing.status !== "OPEN") {
      throw new ExchangeError("CONFLICT", "This listing is already closed");
    }
    if (listing.sellerUserId === null) {
      await requireOwnedCompany(tx, listing.companyId, input.userId);
    } else if (listing.sellerUserId !== input.userId) {
      throw new ExchangeError("FORBIDDEN", "This is not your listing");
    }
    if (!(await returnShareListingTx(tx, listing))) {
      throw new ExchangeError("CONFLICT", "The listing changed; try again");
    }
    return { returned: listing.shares };
  });
}

/** Buy `shares` from a listing at its price. A retry with the same requestId is applied once. */
export async function buyShares(
  db: PrismaClient,
  input: { userId: string; listingId: string; shares: number; requestId: string }
) {
  assertWholeShares(input.shares);
  const key = `exchange:share-buy:${input.userId}:${input.requestId}`;
  const notices: ExchangeNotice[] = [];
  try {
    const result = await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      const found = await tx.shareListing.findUnique({ where: { id: input.listingId } });
      if (!found) throw new ExchangeError("NOT_FOUND", "Listing not found");
      await lockCompany(tx, found.companyId);
      await lockParties(tx, [input.userId, found.sellerUserId]);
      const applied = await tx.exchangeTransaction.findUnique({ where: { idempotencyKey: key } });
      if (applied) {
        return {
          shares: input.shares,
          cost: fromCents(-centsOf(applied.sovereigns)),
          alreadyApplied: true,
        };
      }

      const listing = await tx.shareListing.findUnique({ where: { id: input.listingId } });
      if (!listing || listing.status !== "OPEN") {
        throw new ExchangeError("CONFLICT", "This listing is closed");
      }
      const company = await requireTradable(tx, listing.companyId);
      if (listing.sellerUserId === input.userId) {
        throw new ExchangeError("FORBIDDEN", "You can't buy your own listing");
      }
      await assertNotFundInsiderPair(tx, input.userId, listing.sellerUserId);
      if (input.shares > listing.shares) {
        throw new ExchangeError("CONFLICT", `Only ${listing.shares} shares are left`);
      }

      const askPrice = fromCents(centsOf(listing.pricePerShare));
      const cost = fromCents(centsOf(listing.pricePerShare) * input.shares);
      await spendSovereignsTx(tx, {
        userId: input.userId,
        amount: cost,
        type: "SHARE_BUY",
        source: `SHARES:${company.id}`,
        metadata: {
          listingId: listing.id,
          companyId: company.id,
          shares: input.shares,
          pricePerShare: askPrice,
        },
        idempotencyKey: key,
      });
      const net = await fillBuyerAgainstAsk(tx, company, input.userId, listing, input.shares, key);
      pushSaleNotice(notices, company, listing.sellerUserId, input.userId, input.shares, net);
      return { shares: input.shares, cost, alreadyApplied: false };
    });
    notifyExchange(notices);
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const applied = await db.exchangeTransaction.findUnique({ where: { idempotencyKey: key } });
      if (applied) {
        return {
          shares: input.shares,
          cost: fromCents(-centsOf(applied.sovereigns)),
          alreadyApplied: true,
        };
      }
    }
    throw error;
  }
}

/**
 * Fill a sell order against the resting bids it crosses: bids at or above its price, highest first,
 * oldest first, each at its own limit. The seller's own bids are skipped.
 */
async function matchAsk(
  tx: Db,
  company: Company,
  ask: ShareListing,
  notices: ExchangeNotice[],
  partiesLocked = false
): Promise<void> {
  const fills = takeFills(await crossingBids(tx, ask), ask.shares);
  if (fills.length === 0) return;
  if (!partiesLocked) {
    await lockParties(tx, [ask.sellerUserId, ...fills.map((f) => f.order.buyerUserId)]);
  }

  let left = ask.shares;
  for (const { order: bid, shares } of fills) {
    const price = fromCents(centsOf(bid.maxPricePerShare));
    left = await consumeAsk(tx, { id: ask.id, shares: left }, shares);
    await consumeBid(tx, bid, shares);
    const net = await paySale(tx, company, {
      seller: ask.sellerUserId,
      shares,
      price,
      key: `exchange:share-fill:${ask.id}:${bid.id}`,
      metadata: { listingId: ask.id, companyId: company.id, shares, pricePerShare: price },
    });
    await creditHolding(tx, company.id, bid.buyerUserId, shares, fromCents(centsOf(bid.maxPricePerShare) * shares));
    await recordTrade(tx, company.id, price, shares, `exchange:share-fill:${ask.id}:${bid.id}`);
    pushSaleNotice(notices, company, ask.sellerUserId, bid.buyerUserId, shares, net);
    notices.push(boughtNotice(company, bid.buyerUserId, shares, price));
  }
}

/**
 * Match every open ask against the bids it crosses. Runs in the caller's transaction under the company
 * lock, and only while the company is trading. Returns the notices to send once the transaction commits.
 */
export async function matchCompanyOrders(tx: Db, companyId: string): Promise<ExchangeNotice[]> {
  await lockCompany(tx, companyId);
  const notices: ExchangeNotice[] = [];
  const company = await tx.company.findUnique({ where: { id: companyId } });
  if (!company || company.status !== "ACTIVE" || !company.tradingOpen) return notices;
  const asks = await tx.shareListing.findMany({ where: { companyId, status: "OPEN" } });
  await lockParties(tx, await crossingParties(tx, companyId, asks));
  for (const ask of asks.sort(askRank)) {
    await matchAsk(tx, company, ask, notices, true);
  }
  return notices;
}

async function appliedBid(tx: Db, key: string, shares: number): Promise<BuyOrderResult | null> {
  const applied = await tx.exchangeTransaction.findUnique({
    where: { idempotencyKey: `${key}:escrow` },
    select: { id: true },
  });
  if (!applied) return null;
  const order = await tx.shareBuyOrder.findUnique({
    where: { idempotencyKey: key },
    select: { id: true, shares: true },
  });
  const resting = order?.shares ?? 0;
  return {
    orderId: order?.id ?? null,
    sharesBought: shares - resting,
    sharesResting: resting,
    alreadyApplied: true,
  };
}

/**
 * The asks a bid crosses, cheapest first. Refuses when one of them is the buyer's own, since a buyer
 * can't trade with themselves.
 */
async function crossingAsks(tx: Db, input: PlaceBuyOrderInput): Promise<ShareListing[]> {
  const asks = (
    await tx.shareListing.findMany({ where: { companyId: input.companyId, status: "OPEN" } })
  )
    .filter((a) => centsOf(a.pricePerShare) <= toCents(input.maxPricePerShare))
    .sort(askRank);
  if (asks.some((a) => a.sellerUserId === input.userId)) {
    throw new ExchangeError("FORBIDDEN", "Your own listing is at or below that price");
  }
  const eligible: ShareListing[] = [];
  for (const a of asks) {
    if (!(await isFundInsiderPair(tx, input.userId, a.sellerUserId))) {
      eligible.push(a);
    }
  }
  return eligible;
}

/** Only a bid that rests becomes an open order, so only a resting bid counts against the limit. */
async function assertBidRoom(tx: Db, input: PlaceBuyOrderInput): Promise<void> {
  const open = await tx.shareBuyOrder.count({
    where: { companyId: input.companyId, buyerUserId: input.userId, status: "OPEN" },
  });
  if (open >= MAX_OPEN_BIDS_PER_HOLDER) {
    throw new ExchangeError(
      "LIMIT_REACHED",
      `You can have up to ${MAX_OPEN_BIDS_PER_HOLDER} open buy orders per company`
    );
  }
}

/**
 * Place a limit buy order. The full limit is escrowed up front; each fill against a crossing ask is
 * paid at the ask's price and the difference refunded; the unfilled remainder rests with its escrow.
 * A retry with the same requestId is applied once.
 */
export async function placeBuyOrder(
  db: PrismaClient,
  input: PlaceBuyOrderInput
): Promise<BuyOrderResult> {
  assertWholeShares(input.shares);
  assertPrice(input.maxPricePerShare);
  const key = `exchange:share-bid:${input.userId}:${input.requestId}`;
  const notices: ExchangeNotice[] = [];
  try {
    const result = await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      const applied = await appliedBid(tx, key, input.shares);
      if (applied) return applied;

      const company = await requireTradable(tx, input.companyId);
      const asks = await crossingAsks(tx, input);
      const fills = takeFills(asks, input.shares);
      if (fills.reduce((s, f) => s + f.shares, 0) < input.shares) await assertBidRoom(tx, input);
      await lockParties(tx, [input.userId, ...fills.map((f) => f.order.sellerUserId)]);

      const escrowed = fromCents(toCents(input.maxPricePerShare) * input.shares);
      await spendSovereignsTx(tx, {
        userId: input.userId,
        amount: escrowed,
        type: "SHARE_ORDER_ESCROW",
        source: `SHARES:${company.id}`,
        metadata: {
          companyId: company.id,
          shares: input.shares,
          maxPricePerShare: input.maxPricePerShare,
        },
        idempotencyKey: `${key}:escrow`,
      });

      let bought = 0;
      for (const { order: ask, shares } of fills) {
        const fillKey = `${key}:fill:${ask.id}`;
        const net = await fillBuyerAgainstAsk(tx, company, input.userId, ask, shares, fillKey);
        const priceCents = centsOf(ask.pricePerShare);
        const refund = fromCents((toCents(input.maxPricePerShare) - priceCents) * shares);
        if (refund > 0) {
          await earnSovereignsTx(tx, {
            userId: input.userId,
            amount: refund,
            type: "SHARE_ORDER_REFUND",
            source: `SHARES:${company.id}`,
            metadata: { companyId: company.id, listingId: ask.id, shares },
            idempotencyKey: `${fillKey}:refund`,
          });
        }
        pushSaleNotice(notices, company, ask.sellerUserId, input.userId, shares, net);
        bought += shares;
      }

      const resting = input.shares - bought;
      let orderId: string | null = null;
      if (resting > 0) {
        const order = await tx.shareBuyOrder.create({
          data: {
            companyId: company.id,
            buyerUserId: input.userId,
            shares: resting,
            sharesOrdered: input.shares,
            maxPricePerShare: dbCents(toCents(input.maxPricePerShare)),
            escrow: dbCents(toCents(input.maxPricePerShare) * resting),
            status: "OPEN",
            createdIxTime: Date.now(),
            idempotencyKey: key,
          },
        });
        orderId = order.id;
      }
      return { orderId, sharesBought: bought, sharesResting: resting, alreadyApplied: false };
    });
    notifyExchange(notices);
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const applied = await appliedBid(db, key, input.shares);
      if (applied) return applied;
    }
    throw error;
  }
}

/** Cancel a company's open bids and refund their escrow. Dissolution and bankruptcy use it. */
export async function returnBuyOrders(tx: Db, companyId: string): Promise<number> {
  const open = await tx.shareBuyOrder.findMany({ where: { companyId, status: "OPEN" } });
  let refundedCents = 0;
  for (const order of open.sort(refundRank)) {
    if (await closeBuyOrder(tx, order)) refundedCents += centsOf(order.escrow);
  }
  return fromCents(refundedCents);
}

/** Withdraw a buy order: its remaining escrow goes back to the buyer. Works while trading is closed. */
export async function cancelBuyOrder(db: PrismaClient, input: { userId: string; orderId: string }) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const found = await tx.shareBuyOrder.findUnique({ where: { id: input.orderId } });
    if (!found) throw new ExchangeError("NOT_FOUND", "Order not found");
    if (found.buyerUserId !== input.userId) {
      throw new ExchangeError("FORBIDDEN", "This is not your order");
    }
    await lockCompany(tx, found.companyId);
    const order = await tx.shareBuyOrder.findUnique({ where: { id: input.orderId } });
    if (!order || order.status !== "OPEN") {
      throw new ExchangeError("CONFLICT", "This order is already closed");
    }
    if (!(await closeBuyOrder(tx, order))) {
      throw new ExchangeError("CONFLICT", "The order changed; try again");
    }
    return { refunded: fromCents(centsOf(order.escrow)) };
  });
}

interface DepthLevel {
  price: number;
  shares: number;
  count: number;
}

function depthOf<T extends { shares: number }>(
  rows: readonly T[],
  priceCentsOf: (row: T) => number
): DepthLevel[] {
  const levels = new Map<number, { shares: number; count: number }>();
  for (const row of rows) {
    const cents = priceCentsOf(row);
    const level = levels.get(cents) ?? { shares: 0, count: 0 };
    level.shares += row.shares;
    level.count += 1;
    levels.set(cents, level);
  }
  return [...levels].map(([cents, level]) => ({ price: fromCents(cents), ...level }));
}

/**
 * The company's open book by price level, bids highest first and asks lowest first, with the last
 * traded price.
 */
export async function getOrderBook(db: Db, companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { lastTradePrice: true },
  });
  if (!company) throw new ExchangeError("NOT_FOUND", "Company not found");
  const [bids, asks] = await Promise.all([
    db.shareBuyOrder.findMany({
      where: { companyId, status: "OPEN" },
      select: { maxPricePerShare: true, shares: true },
    }),
    db.shareListing.findMany({
      where: { companyId, status: "OPEN" },
      select: { pricePerShare: true, shares: true },
    }),
  ]);
  return {
    bids: depthOf(bids, (b) => centsOf(b.maxPricePerShare))
      .sort((a, b) => b.price - a.price)
      .map(({ price, shares, count }) => ({ price, shares, orders: count })),
    asks: depthOf(asks, (a) => centsOf(a.pricePerShare))
      .sort((a, b) => a.price - b.price)
      .map(({ price, shares, count }) => ({ price, shares, listings: count })),
    lastTradePrice:
      company.lastTradePrice !== null ? fromCents(centsOf(company.lastTradePrice)) : null,
  };
}
