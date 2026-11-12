/**
 * Fill mechanics for the share market: taking shares off an ask or a bid, paying the seller
 * (with capital gains tax on a secondary sale), crediting the buyer's holding and recording the
 * trade. Every function runs inside the caller's transaction, under the company lock.
 * Spec: docs/specs/2026-11-01-exchange-phase-3-design.md.
 */

import type { Company, ShareBuyOrder, ShareListing } from "@prisma/client";
import { LATEST_GROWTH_SELECT } from "~/lib/economy/effective-growth";
import { ExchangeError, earnSovereignsTx } from "~/lib/vault/exchange-service";
import { refreshFairValue } from "./companies";
import { isFundInsiderPair } from "./fund-insiders";
import { lockWallet, type Db } from "./guards";
import type { ExchangeNotice } from "./notify";
import { fromCents, toCents } from "./ownership";
import { centsOf, dbCents, formatSovereigns } from "./amounts";
import { countryMacroOf } from "./macro";
import { LARGE_TRADE_SOVEREIGNS, publishNewsTx } from "./news";
import { transferToTreasuryTx } from "./treasury";

const MACRO_COUNTRY_SELECT = {
  economicTier: true,
  governmentalEfficiency: true,
  interestRates: true,
  inflationRate: true,
  ...LATEST_GROWTH_SELECT,
  economicProfile: { select: { sectorBreakdown: true } },
  fiscalSystem: {
    select: {
      corporateTaxRates: true,
      personalIncomeTaxRates: true,
      salesTaxRate: true,
      wealthTaxRate: true,
      exciseTaxRates: true,
    },
  },
} as const;

/**
 * A share of `cents` at `rate`, rounded down to a whole cent so the payer never pays more than the
 * rate allows.
 */
export function ratedCents(cents: number, rate: number): number {
  return Math.floor(Number((cents * rate).toFixed(6)));
}

/** A nation's capital gains rate as a fraction in [0, 1]. 0 when the nation no longer exists. */
export async function capGainsRateOf(tx: Db, countryId: string): Promise<number> {
  const country = await tx.country.findUnique({
    where: { id: countryId },
    select: MACRO_COUNTRY_SELECT,
  });
  if (!country) return 0;
  return Math.min(1, Math.max(0, countryMacroOf(country).capGainsTaxRate));
}

/** Lock each distinct wallet in user-id order, so two trades touching the same people can't deadlock. */
export async function lockParties(tx: Db, userIds: ReadonlyArray<string | null>): Promise<void> {
  const ids = [...new Set(userIds.filter((u): u is string => !!u))].sort();
  for (const u of ids) await lockWallet(tx, u);
}

/** Price-time priority for asks: cheapest first, then oldest. */
export function askRank(a: ShareListing, b: ShareListing): number {
  return centsOf(a.pricePerShare) - centsOf(b.pricePerShare) || a.createdIxTime - b.createdIxTime;
}

/** Price-time priority for bids: highest limit first, then oldest. */
export function bidRank(a: ShareBuyOrder, b: ShareBuyOrder): number {
  return (
    centsOf(b.maxPricePerShare) - centsOf(a.maxPricePerShare) || a.createdIxTime - b.createdIxTime
  );
}

/** Order buy-order refunds by buyer user-id (then order id) so wallet locks match dissolution/liquidation order. */
export function refundRank(a: ShareBuyOrder, b: ShareBuyOrder): number {
  if (a.buyerUserId !== b.buyerUserId) return a.buyerUserId < b.buyerUserId ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Whether `bid` crosses `ask` at price and is neither a self-trade nor a wealth-fund insider pair. */
async function bidCrossesAsk(tx: Db, ask: ShareListing, bid: ShareBuyOrder): Promise<boolean> {
  if (centsOf(bid.maxPricePerShare) < centsOf(ask.pricePerShare)) return false;
  if (bid.buyerUserId === ask.sellerUserId) return false;
  return !(await isFundInsiderPair(tx, ask.sellerUserId, bid.buyerUserId));
}

/** Open bids on `ask.companyId` that cross `ask` and are not self-trades or wealth-fund insider pairs, highest first. */
export async function crossingBids(tx: Db, ask: ShareListing): Promise<ShareBuyOrder[]> {
  const candidates = (
    await tx.shareBuyOrder.findMany({ where: { companyId: ask.companyId, status: "OPEN" } })
  ).sort(bidRank);
  const bids: ShareBuyOrder[] = [];
  for (const b of candidates) {
    if (await bidCrossesAsk(tx, ask, b)) {
      bids.push(b);
    }
  }
  return bids;
}

/**
 * Every seller and buyer across the asks and bids that will cross for a company, so `matchCompanyOrders`
 * can lock all party wallets in user-id order before the first fill's capital-gains tax locks the treasury.
 */
export async function crossingParties(
  tx: Db,
  companyId: string,
  asks: readonly ShareListing[]
): Promise<Array<string | null>> {
  const bids = await tx.shareBuyOrder.findMany({ where: { companyId, status: "OPEN" } });
  const remaining = new Map(bids.map((b) => [b.id, b.shares]));
  const sortedBids = [...bids].sort(bidRank);
  const parties: Array<string | null> = [];
  for (const ask of [...asks].sort(askRank)) {
    const eligible: ShareBuyOrder[] = [];
    for (const b of sortedBids) {
      const left = remaining.get(b.id) ?? 0;
      if (left > 0 && (await bidCrossesAsk(tx, ask, b))) {
        eligible.push({ ...b, shares: left });
      }
    }
    const fills = takeFills(eligible, ask.shares);
    if (fills.length > 0) {
      parties.push(ask.sellerUserId);
      for (const f of fills) {
        parties.push(f.order.buyerUserId);
        remaining.set(f.order.id, (remaining.get(f.order.id) ?? 0) - f.shares);
      }
    }
  }
  return parties;
}

/**
 * Walk orders already sorted by priority and take `want` shares from them, one fill per order.
 * Orders are passed in sorted, so the matching rule lives in the sort, not in the query.
 */
export function takeFills<T extends { shares: number }>(
  orders: readonly T[],
  want: number
): Array<{ order: T; shares: number }> {
  const fills: Array<{ order: T; shares: number }> = [];
  let left = want;
  for (const order of orders) {
    if (left <= 0) break;
    const shares = Math.min(left, order.shares);
    fills.push({ order, shares });
    left -= shares;
  }
  return fills;
}

/**
 * Take `shares` off a listing that has `row.shares` left, and return what is left. The update is
 * conditional on that count, so a listing can't sell more than it has even if the company lock
 * were ever missed.
 */
export async function consumeAsk(
  tx: Db,
  row: { id: string; shares: number },
  shares: number
): Promise<number> {
  const left = row.shares - shares;
  const { count } = await tx.shareListing.updateMany({
    where: { id: row.id, status: "OPEN", shares: row.shares },
    data: { shares: left, status: left === 0 ? "FILLED" : "OPEN" },
  });
  if (count !== 1) throw new ExchangeError("CONFLICT", "Those shares were just sold");
  return left;
}

/** Take `shares` off a bid. Its escrow is always exactly the rest of the shares at the limit. */
export async function consumeBid(tx: Db, bid: ShareBuyOrder, shares: number): Promise<void> {
  const left = bid.shares - shares;
  const { count } = await tx.shareBuyOrder.updateMany({
    where: { id: bid.id, status: "OPEN", shares: bid.shares },
    data: {
      shares: left,
      escrow: dbCents(centsOf(bid.maxPricePerShare) * left),
      status: left === 0 ? "FILLED" : "OPEN",
    },
  });
  if (count !== 1) throw new ExchangeError("CONFLICT", "That order was just filled");
}

/** Capital gains on a secondary sale over the seller's average cost, or null when nothing is owed. */
async function capGainsTax(
  tx: Db,
  company: Company,
  seller: string,
  shares: number,
  priceCents: number
): Promise<{ countryId: string; cents: number } | null> {
  if (!company.hqCountryId) return null;
  const rate = await capGainsRateOf(tx, company.hqCountryId);
  if (rate <= 0) return null;
  const holding = await tx.shareholding.findUnique({
    where: { companyId_ownerUserId: { companyId: company.id, ownerUserId: seller } },
    select: { avgCost: true },
  });
  const gainCents = Math.max(
    0,
    (priceCents - (holding ? centsOf(holding.avgCost) : 0)) * shares
  );
  const cents = ratedCents(gainCents, rate);
  return cents > 0 ? { countryId: company.hqCountryId, cents } : null;
}

interface SaleInput {
  /** The selling holder, or null for a primary issue. */
  seller: string | null;
  shares: number;
  price: number;
  /** Base for the ledger keys: `${key}:seller` and `${key}:tax`. */
  key: string;
  metadata: { listingId: string; companyId: string; shares: number; pricePerShare: number };
}

/**
 * Pay a sale's proceeds. A primary issue goes into the company's capital. A secondary sale is
 * credited to the seller at the gross price, then the capital gains tax is moved from the seller's
 * wallet into the HQ treasury. The gross is credited first because the tax is debited from that
 * same wallet, so the seller nets the gross less the tax. Returns the net proceeds.
 */
export async function paySale(tx: Db, company: Company, sale: SaleInput): Promise<number> {
  const grossCents = toCents(sale.price) * sale.shares;
  if (!sale.seller) {
    await tx.company.update({
      where: { id: company.id },
      data: { capital: { increment: dbCents(grossCents) }, sharesOutstanding: { increment: sale.shares } },
    });
    await refreshFairValue(tx, company.id);
    return fromCents(grossCents);
  }
  await earnSovereignsTx(tx, {
    userId: sale.seller,
    amount: fromCents(grossCents),
    type: "SHARE_SELL",
    source: `SHARES:${company.id}`,
    metadata: sale.metadata,
    idempotencyKey: `${sale.key}:seller`,
  });
  const tax = await capGainsTax(tx, company, sale.seller, sale.shares, toCents(sale.price));
  if (tax) {
    await transferToTreasuryTx(tx, {
      from: { kind: "WALLET", userId: sale.seller },
      countryId: tax.countryId,
      realmId: company.realmId,
      amount: fromCents(tax.cents),
      type: "TAX",
      source: `SHARES:${company.id}`,
      key: `${sale.key}:tax`,
    });
  }
  return fromCents(grossCents - (tax?.cents ?? 0));
}

function saleNotice(
  company: Company,
  seller: string | null,
  shares: number,
  net: number
): ExchangeNotice {
  return {
    userId: seller ?? company.founderId,
    title: `${shares.toLocaleString("en-US")} ${company.name} shares sold`,
    message: seller
      ? `${formatSovereigns(net)} is in your wallet.`
      : `${formatSovereigns(net)} from the new issue went to ${company.name}'s capital.`,
    priority: "low",
  };
}

/** Tell the selling side (or the founder, for a primary issue) unless they are the buyer. */
export function pushSaleNotice(
  notices: ExchangeNotice[],
  company: Company,
  seller: string | null,
  buyer: string,
  shares: number,
  net: number
): void {
  const notice = saleNotice(company, seller, shares, net);
  if (notice.userId !== buyer) notices.push(notice);
}

export function boughtNotice(
  company: Company,
  buyer: string,
  shares: number,
  price: number
): ExchangeNotice {
  return {
    userId: buyer,
    title: `${shares.toLocaleString("en-US")} ${company.name} shares bought`,
    message: `Filled at ${formatSovereigns(price)} a share.`,
    priority: "low",
  };
}

/** Add shares to a holding at `cost`, keeping the average cost per share. */
export async function creditHolding(
  tx: Db,
  companyId: string,
  userId: string,
  shares: number,
  cost: number
): Promise<void> {
  const costCents = toCents(cost);
  const holding = await tx.shareholding.findUnique({
    where: { companyId_ownerUserId: { companyId, ownerUserId: userId } },
  });
  if (!holding) {
    await tx.shareholding.create({
      data: {
        companyId,
        ownerUserId: userId,
        shares,
        avgCost: dbCents(Math.round(costCents / shares)),
      },
    });
    return;
  }
  const openListings = await tx.shareListing.findMany({
    where: { companyId, sellerUserId: userId, status: "OPEN" },
    select: { shares: true },
  });
  const escrowedShares = openListings.reduce((sum, l) => sum + l.shares, 0);
  const existingOwned = holding.shares + escrowedShares;
  const total = existingOwned + shares;
  const avgCostCents = Math.round((existingOwned * centsOf(holding.avgCost) + costCents) / total);
  await tx.shareholding.update({
    where: { id: holding.id },
    data: { shares: { increment: shares }, avgCost: dbCents(avgCostCents) },
  });
}

/** Record a fill: the company's last price, and the trade on the live activity feed (a headline when it is large). */
export async function recordTrade(
  tx: Db,
  companyId: string,
  price: number,
  shares: number,
  tradeKey: string
): Promise<void> {
  const before = await tx.company.findUnique({
    where: { id: companyId },
    select: { name: true, realmId: true, lastTradePrice: true },
  });
  await tx.company.update({
    where: { id: companyId },
    data: { lastTradePrice: dbCents(toCents(price)), lastTradeIxTime: Date.now() },
  });
  if (!before) return;
  const value = price * shares;
  const prevPrice = before.lastTradePrice !== null ? fromCents(centsOf(before.lastTradePrice)) : 0;
  await publishNewsTx(tx, {
    realmId: before.realmId,
    kind: "trade",
    prominence: value >= LARGE_TRADE_SOVEREIGNS ? "HEADLINE" : "ACTIVITY",
    sourceKind: "EXCHANGE",
    headline: `${shares.toLocaleString("en-US")} ${shares === 1 ? "share" : "shares"} of ${before.name} traded at ${formatSovereigns(price)}`,
    companyId,
    movePct: prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : undefined,
    key: `news:trade:${tradeKey}`,
  });
}

/**
 * A buyer takes shares from a listing at its price. The buyer's ₷ are already in the caller's hands
 * (wallet or escrow); this moves the shares, the seller's proceeds, and records the trade.
 */
export async function fillBuyerAgainstAsk(
  tx: Db,
  company: Company,
  buyer: string,
  ask: ShareListing,
  shares: number,
  key: string
): Promise<number> {
  const askPrice = fromCents(centsOf(ask.pricePerShare));
  await consumeAsk(tx, ask, shares);
  const net = await paySale(tx, company, {
    seller: ask.sellerUserId,
    shares,
    price: askPrice,
    key,
    metadata: {
      listingId: ask.id,
      companyId: company.id,
      shares,
      pricePerShare: askPrice,
    },
  });
  await creditHolding(
    tx,
    company.id,
    buyer,
    shares,
    fromCents(centsOf(ask.pricePerShare) * shares)
  );
  await recordTrade(tx, company.id, askPrice, shares, key);
  return net;
}

/**
 * Cancel an open share listing under the company lock and return its remaining shares to the
 * seller's holding (or un-issue them for a primary company listing).
 */
export async function returnShareListingTx(
  tx: Db,
  listing: Pick<ShareListing, "id" | "companyId" | "sellerUserId" | "shares">
): Promise<boolean> {
  const { count } = await tx.shareListing.updateMany({
    where: { id: listing.id, status: "OPEN", shares: listing.shares },
    data: { status: "CANCELLED", shares: 0 },
  });
  if (count !== 1) return false;
  if (listing.sellerUserId) {
    await tx.shareholding.update({
      where: {
        companyId_ownerUserId: {
          companyId: listing.companyId,
          ownerUserId: listing.sellerUserId,
        },
      },
      data: { shares: { increment: listing.shares } },
    });
  } else {
    await tx.company.update({
      where: { id: listing.companyId },
      data: { sharesIssued: { decrement: listing.shares } },
    });
  }
  return true;
}

/**
 * Cancel a bid's remaining shares and refund its remaining escrow. Returns false when the bid was
 * already closed, in which case nothing moves.
 */
export async function closeBuyOrder(tx: Db, order: ShareBuyOrder): Promise<boolean> {
  const { count } = await tx.shareBuyOrder.updateMany({
    where: { id: order.id, status: "OPEN" },
    data: { status: "CANCELLED", shares: 0, escrow: 0n },
  });
  if (count !== 1) return false;
  await earnSovereignsTx(tx, {
    userId: order.buyerUserId,
    amount: fromCents(centsOf(order.escrow)),
    type: "SHARE_ORDER_REFUND",
    source: `SHARES:${order.companyId}`,
    metadata: { orderId: order.id, companyId: order.companyId },
    idempotencyKey: `exchange:share-bid-cancel:${order.id}`,
  });
  return true;
}
