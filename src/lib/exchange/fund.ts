/**
 * A nation's wealth fund (spec §11a). Each nation gets a fund account: a system user (`treasury-fund-<countryId>`) and
 * its wallet. The fund trades through the ordinary engine (order book, bonds, sector funds) as that user, so dividends,
 * coupons and sales land in its wallet. The owner moves ₷ between the treasury and the fund. Guardrails:
 * - the fund may hold at most half of treasury plus fund (checked on deposit, holdings at cost);
 * - it may not buy its owner's companies, its own nation's bonds, or more than 25% of any company;
 * - it sells within ±20% of fair value (shares) or face value (bonds), and never fills with its nation's insiders.
 * Guards and execution run under a per-nation lease (`withJobLock`), so concurrent fund orders can't both pass the
 * stake cap.
 */
import type { PrismaClient } from "@prisma/client";
import { withJobLock } from "~/lib/system/job-lock";
import { ExchangeError, earnSovereignsTx, spendSovereignsTx } from "~/lib/vault/exchange-service";
import { centsOf, formatSovereigns, fromCents, round2 } from "./amounts";
import {
  BOND_FACE,
  buyBondListing,
  buyBondPrimary,
  cancelBondListing,
  listBondUnits,
} from "./bonds";
import type { SectorKey } from "./companies";
import { fundUserIdOf } from "./fund-ids";
import { isFundInsiderPair } from "./fund-insiders";
import { assertExchangeOpen, lockWallet, requireCountryOwner, type Db } from "./guards";
import { assertNotOwnersCompany } from "./lending";
import { publishNewsTx } from "./news";
import { buySectorUnits, sellSectorUnits, SECTOR_LABELS } from "./sectors";
import {
  cancelBuyOrder,
  cancelListing,
  listShares,
  placeBuyOrder,
  primaryPricePerShare,
} from "./shares";
import { getPortfolio, type Portfolio } from "./terminal";
import { creditTreasuryTx, debitTreasuryTx, getOrCreateTreasury, lockTreasuryTx } from "./treasury";

export { FUND_USER_PREFIX, fundUserIdOf, isFundUser } from "./fund-ids";

/** The fund may hold at most this share of treasury plus fund. */
export const FUND_SHARE_CAP = 0.5;
/** The fund may own at most this share of any company. */
export const STAKE_CAP = 0.25;
/** The fund must sell within ±20% of fair value (shares) or face value (bonds). */
export const FUND_PRICE_BAND = 0.2;

/** The nation's fund account, created once (user, wallet, and the treasury's pointer to it). */
export async function ensureFundUser(db: Db, countryId: string): Promise<string> {
  const id = fundUserIdOf(countryId);
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { realmId: true },
  });
  if (!country) throw new ExchangeError("NOT_FOUND", "Nation not found");
  await db.user.createMany({ data: [{ id, clerkUserId: `system:${id}` }], skipDuplicates: true });
  await db.exchangeWallet.createMany({
    data: [{ userId: id, sovereigns: 0n }],
    skipDuplicates: true,
  });
  const treasury = await getOrCreateTreasury(db, countryId, country.realmId);
  if (treasury.fundUserId !== id) {
    await db.nationTreasury.update({ where: { id: treasury.id }, data: { fundUserId: id } });
  }
  return id;
}

/** What the fund has invested, at cost: wallet cash, buy-order escrow and holdings. */
async function investedAtCost(db: Db, fundUserId: string): Promise<number> {
  const [wallet, orders, shares, bonds, funds] = await Promise.all([
    db.exchangeWallet.findUnique({ where: { userId: fundUserId }, select: { sovereigns: true } }),
    db.shareBuyOrder.findMany({
      where: { buyerUserId: fundUserId, status: "OPEN" },
      select: { escrow: true },
    }),
    db.shareholding.findMany({
      where: { ownerUserId: fundUserId },
      select: { shares: true, avgCost: true },
    }),
    db.bondHolding.findMany({
      where: { ownerUserId: fundUserId },
      select: { units: true, avgCost: true },
    }),
    db.sectorPosition.findMany({
      where: { ownerUserId: fundUserId },
      select: { units: true, avgCost: true },
    }),
  ]);
  // ponytail: listed shares and units drop out of the cost basis while listed; count them if the cap needs to be exact.
  const held = [
    ...shares.map((s) => s.shares * fromCents(centsOf(s.avgCost))),
    ...bonds.map((b) => b.units * b.avgCost),
    ...funds.map((f) => f.units * f.avgCost),
  ];
  return round2(
    (wallet ? fromCents(centsOf(wallet.sovereigns)) : 0) +
      orders.reduce((s, o) => s + fromCents(centsOf(o.escrow)), 0) +
      held.reduce((s, v) => s + v, 0)
  );
}

function positive(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new ExchangeError("INVALID_AMOUNT", "Amount must be positive");
}

export async function depositToFund(
  db: PrismaClient,
  i: { userId: string; countryId: string; amount: number; requestId: string }
): Promise<FundSummary> {
  positive(i.amount);
  const key = `exchange:fund-in:${i.userId}:${i.requestId}`;
  await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const country = await requireCountryOwner(tx, i.countryId, i.userId);
    const fundUserId = await ensureFundUser(tx, country.id);
    await lockWallet(tx, fundUserId);
    const treasury = await lockTreasuryTx(tx, country.id, country.realmId);
    const invested = await investedAtCost(tx, fundUserId);
    const treasuryBalance = fromCents(centsOf(treasury.balance));
    if (invested + i.amount > FUND_SHARE_CAP * (treasuryBalance + invested) + 1e-9) {
      throw new ExchangeError(
        "LIMIT_REACHED",
        `The wealth fund may hold at most half of the treasury and fund together`
      );
    }
    const source = `FUND:${country.id}`;
    const moved = await debitTreasuryTx(tx, {
      countryId: country.id,
      amount: i.amount,
      type: "SPEND",
      source,
      key,
    });
    if (moved === 0) return;
    await earnSovereignsTx(tx, {
      userId: fundUserId,
      amount: i.amount,
      type: "TREASURY_PAYMENT",
      source,
      idempotencyKey: `${key}:fund`,
    });
  });
  return (await fundSummary(db, i.countryId))!;
}

export async function withdrawFromFund(
  db: PrismaClient,
  i: { userId: string; countryId: string; amount: number; requestId: string }
): Promise<FundSummary> {
  positive(i.amount);
  const key = `exchange:fund-out:${i.userId}:${i.requestId}`;
  await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const country = await requireCountryOwner(tx, i.countryId, i.userId);
    const fundUserId = await ensureFundUser(tx, country.id);
    const source = `FUND:${country.id}`;
    const spent = await spendSovereignsTx(tx, {
      userId: fundUserId,
      amount: i.amount,
      type: "TREASURY_PAYMENT",
      source,
      idempotencyKey: key,
    });
    if (spent.alreadyApplied) return;
    await creditTreasuryTx(tx, {
      countryId: country.id,
      realmId: country.realmId,
      amount: i.amount,
      type: "FUND_RETURN",
      source,
      key: `${key}:treasury`,
    });
  });
  return (await fundSummary(db, i.countryId))!;
}

export type FundOrder =
  | { kind: "shares-buy"; companyId: string; shares: number; maxPricePerShare: number }
  | { kind: "shares-sell"; companyId: string; shares: number; pricePerShare: number }
  | { kind: "shares-cancel-bid"; orderId: string }
  | { kind: "shares-cancel-listing"; listingId: string }
  | { kind: "bond-buy"; bondId: string; units: number }
  | { kind: "bond-sell"; bondId: string; units: number; pricePerUnit: number }
  | { kind: "bond-cancel-listing"; listingId: string }
  | { kind: "fund-buy"; sectorKey: SectorKey; amount: number }
  | { kind: "fund-sell"; sectorKey: SectorKey; fraction: number };

async function assertStakeRoom(
  db: Db,
  fundUserId: string,
  companyId: string,
  adding: number
): Promise<void> {
  const [company, holding, listed, bids] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { sharesOutstanding: true } }),
    db.shareholding.findFirst({
      where: { companyId, ownerUserId: fundUserId },
      select: { shares: true },
    }),
    db.shareListing.findMany({
      where: { companyId, sellerUserId: fundUserId, status: "OPEN" },
      select: { shares: true },
    }),
    db.shareBuyOrder.findMany({
      where: { companyId, buyerUserId: fundUserId, status: "OPEN" },
      select: { shares: true },
    }),
  ]);
  if (!company) throw new ExchangeError("NOT_FOUND", "Company not found");
  const owned =
    (holding?.shares ?? 0) +
    listed.reduce((s, l) => s + l.shares, 0) +
    bids.reduce((s, b) => s + b.shares, 0);
  if (owned + adding > STAKE_CAP * company.sharesOutstanding) {
    throw new ExchangeError("LIMIT_REACHED", "The wealth fund may own at most 25% of a company");
  }
}

function assertSellBand(price: number, fair: number): void {
  const low = round2((1 - FUND_PRICE_BAND) * fair);
  const high = round2((1 + FUND_PRICE_BAND) * fair);
  if (!Number.isFinite(price) || price < low || price > high) {
    throw new ExchangeError(
      "LIMIT_REACHED",
      `The wealth fund sells within 20% of fair value: ${formatSovereigns(low)}–${formatSovereigns(high)}`
    );
  }
}

/** The guardrails for one order (spec §11a). */
async function guardOrder(
  db: Db,
  countryId: string,
  fundUserId: string,
  order: FundOrder
): Promise<void> {
  if (order.kind === "shares-buy") {
    await assertNotOwnersCompany(db, countryId, order.companyId);
    await assertStakeRoom(db, fundUserId, order.companyId, order.shares);
  }
  if (order.kind === "shares-sell") {
    const company = await db.company.findUnique({
      where: { id: order.companyId },
      select: { fairValue: true, sharesOutstanding: true },
    });
    if (!company) throw new ExchangeError("NOT_FOUND", "Company not found");
    assertSellBand(
      order.pricePerShare,
      primaryPricePerShare(fromCents(centsOf(company.fairValue)), company.sharesOutstanding)
    );
  }
  if (order.kind === "bond-buy") {
    const bond = await db.nationBond.findUnique({
      where: { id: order.bondId },
      select: { countryId: true },
    });
    if (bond?.countryId === countryId) {
      throw new ExchangeError("FORBIDDEN", "The wealth fund can't buy its own nation's bonds");
    }
  }
  if (order.kind === "bond-sell") {
    assertSellBand(order.pricePerUnit, BOND_FACE);
  }
}

async function cheapestListing(db: Db, bondId: string, fundUserId: string): Promise<string | null> {
  const listings = await db.bondListing.findMany({
    where: { bondId, status: "OPEN" },
    select: { id: true, pricePerUnit: true, sellerUserId: true },
  });
  for (const listing of [...listings].sort((a, b) => a.pricePerUnit - b.pricePerUnit)) {
    if (!(await isFundInsiderPair(db, fundUserId, listing.sellerUserId))) {
      return listing.id;
    }
  }
  return null;
}

async function executeOrder(
  db: PrismaClient,
  userId: string,
  realmId: string,
  order: FundOrder,
  requestId: string
) {
  switch (order.kind) {
    case "shares-buy":
      return placeBuyOrder(db, {
        userId,
        requestId,
        companyId: order.companyId,
        shares: order.shares,
        maxPricePerShare: order.maxPricePerShare,
      });
    case "shares-sell":
      return listShares(db, {
        userId,
        requestId,
        companyId: order.companyId,
        shares: order.shares,
        pricePerShare: order.pricePerShare,
      });
    case "shares-cancel-bid":
      return cancelBuyOrder(db, { userId, orderId: order.orderId });
    case "shares-cancel-listing":
      return cancelListing(db, { userId, listingId: order.listingId });
    case "bond-buy": {
      const [paidPrimary, paidTake] = await Promise.all([
        db.exchangeTransaction.findUnique({
          where: { idempotencyKey: `exchange:bond-buy:${userId}:${requestId}` },
          select: { id: true },
        }),
        db.exchangeTransaction.findUnique({
          where: { idempotencyKey: `exchange:bond-take:${userId}:${requestId}` },
          select: { id: true },
        }),
      ]);
      if (paidPrimary || paidTake) return { units: order.units, paid: 0, alreadyApplied: true };
      const bond = await db.nationBond.findUnique({
        where: { id: order.bondId },
        select: { unitsIssued: true, unitsSold: true },
      });
      if (bond && bond.unitsIssued - bond.unitsSold > 0) {
        return buyBondPrimary(db, { userId, requestId, bondId: order.bondId, units: order.units });
      }
      const listingId = await cheapestListing(db, order.bondId, userId);
      if (!listingId)
        throw new ExchangeError("LIMIT_REACHED", "No units of that bond are for sale");
      return buyBondListing(db, { userId, requestId, listingId, units: order.units });
    }
    case "bond-sell":
      return listBondUnits(db, {
        userId,
        requestId,
        bondId: order.bondId,
        units: order.units,
        pricePerUnit: order.pricePerUnit,
      });
    case "bond-cancel-listing":
      return cancelBondListing(db, { userId, listingId: order.listingId });
    case "fund-buy":
      return buySectorUnits(db, {
        userId,
        requestId,
        realmId,
        sectorKey: order.sectorKey,
        amount: order.amount,
      });
    case "fund-sell":
      return sellSectorUnits(db, {
        userId,
        requestId,
        realmId,
        sectorKey: order.sectorKey,
        fraction: order.fraction,
      });
  }
}

async function orderHeadline(db: Db, nation: string, order: FundOrder): Promise<string> {
  const who = `${nation} Treasury`;
  if (
    order.kind === "shares-cancel-bid" ||
    order.kind === "shares-cancel-listing" ||
    order.kind === "bond-cancel-listing"
  ) {
    return `${who} withdraws an order`;
  }
  if (order.kind === "bond-buy" || order.kind === "bond-sell") {
    const bond = await db.nationBond.findUnique({
      where: { id: order.bondId },
      select: { countryId: true },
    });
    const issuer = bond
      ? await db.country.findUnique({ where: { id: bond.countryId }, select: { name: true } })
      : null;
    const verb = order.kind === "bond-buy" ? "bought" : "offers";
    return `${who} ${verb} ${order.units} ${issuer?.name ?? "nation"} bonds`;
  }
  if (order.kind === "shares-buy" || order.kind === "shares-sell") {
    const company = await db.company.findUnique({
      where: { id: order.companyId },
      select: { name: true },
    });
    const verb = order.kind === "shares-buy" ? "bids for" : "offers";
    return `${who} ${verb} ${order.shares} shares of ${company?.name ?? "a company"}`;
  }
  const sector = SECTOR_LABELS[order.sectorKey];
  return order.kind === "fund-buy"
    ? `${who} invests ${formatSovereigns(order.amount)} in the ${sector} fund`
    : `${who} sells part of its ${sector} fund`;
}

/** One trade by the wealth fund, after the guardrails; published as live activity. */
export async function fundTrade(
  db: PrismaClient,
  i: { userId: string; countryId: string; order: FundOrder; requestId: string }
): Promise<{ ok: true }> {
  const country = await requireCountryOwner(db, i.countryId, i.userId);
  const locked = await withJobLock(
    db,
    `exchange-fund:${country.id}`,
    async () => {
      const fundUserId = await ensureFundUser(db, country.id);
      await guardOrder(db, country.id, fundUserId, i.order);
      await executeOrder(db, fundUserId, country.realmId, i.order, `fund:${i.requestId}`);
      const headline = await orderHeadline(db, country.name, i.order);
      await db.$transaction((tx) =>
        publishNewsTx(tx, {
          realmId: country.realmId,
          kind: "trade",
          prominence: "ACTIVITY",
          sourceKind: "NATION",
          sourceId: country.id,
          headline,
          countryId: country.id,
          key: `news:fund:${country.id}:${i.requestId}`,
        })
      );
    },
    { timeoutMs: 60_000 }
  );
  if (!locked.ran) {
    throw new ExchangeError("CONFLICT", "The wealth fund is busy; try again");
  }
  return { ok: true };
}

export interface FundSummary {
  countryId: string;
  cash: number;
  invested: number;
  /** How much more the owner may deposit now. */
  room: number;
  portfolio: Portfolio;
}

/** The fund's cash, cost basis, deposit room and holdings (valued at market); null before the fund exists. */
export async function fundSummary(db: Db, countryId: string): Promise<FundSummary | null> {
  const treasury = await db.nationTreasury.findUnique({
    where: { countryId },
    select: { fundUserId: true, balance: true, realmId: true },
  });
  if (!treasury?.fundUserId) return null;
  const [invested, portfolio] = await Promise.all([
    investedAtCost(db, treasury.fundUserId),
    getPortfolio(db, treasury.fundUserId, treasury.realmId),
  ]);
  // invested + room = FUND_SHARE_CAP × (balance − room + invested + room)  →  room = cap×(balance+invested) − invested
  const balance = fromCents(centsOf(treasury.balance));
  const room = Math.max(0, round2(FUND_SHARE_CAP * (balance + invested) - invested));
  return { countryId, cash: portfolio.wallet, invested, room, portfolio };
}
