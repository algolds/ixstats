/**
 * Nation bonds (docs/specs/2026-11-06-exchange-overhaul-design.md §7, R1). A nation's owner issues units of BOND_FACE
 * ₷ at an annual coupon for 1–12 weeks. Players buy units from the treasury (primary) or from each other (listings).
 * Each week the market tick pays every holder's coupon from the treasury, and principal with the last one. A treasury
 * that can't cover a week defaults: holders get their pro-rata cents of what it holds, the bond is DEFAULTED, and the
 * nation is rated D and can't issue for DEFAULT_BAN_DAYS.
 *
 * Lock order: the bond row, then wallets in user-id order, then the treasury row. Schedules run on real time.
 */
import type { NationBond, PrismaClient } from "@prisma/client";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import {
  ExchangeError,
  earnSovereignsTx,
  isUniqueViolation,
  spendSovereignsTx,
} from "~/lib/vault/exchange-service";
import { centsOf, dbCents, formatSovereigns, fromCents, round2, toCents } from "./amounts";
import { lockParties } from "./fills";
import { fundUserIdOf } from "./fund-ids";
import { assertNotFundInsiderPair } from "./fund-insiders";
import { assertExchangeOpen, requireCountryOwner, type Db } from "./guards";
import { macroOfCountry } from "./tariffs";
import { alertWatchers, publishNewsTx, type PublishedHeadline } from "./news";
import { CREDIT_RATINGS, CREDIT_SPREADS, type CreditRating } from "./taxonomy";
import {
  debitTreasuryTx,
  getOrCreateTreasury,
  lockTreasuryTx,
  transferToTreasuryTx,
} from "./treasury";

export const BOND_FACE_CENTS = 10_000;
export const BOND_FACE = fromCents(BOND_FACE_CENTS);
export const BOND_UNITS_MIN = 10;
export const BOND_UNITS_MAX = 10_000;
export const COUPON_MIN = 0.005;
export const COUPON_MAX = 0.25;
export const TERM_WEEKS_MIN = 1;
export const TERM_WEEKS_MAX = 12;
/** Outstanding principal per nation, as a multiple of the treasury cap. */
export const OUTSTANDING_CAP_MULTIPLE = 4;
export const DEFAULT_BAN_DAYS = 30;
export const MAX_OPEN_BOND_LISTINGS = 5;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A defaulted bond's model price, as a share of face (what holders might still recover). */
const DEFAULTED_PRICE_SHARE = 0.1;
const PRICE_FLOOR_SHARE = 0.1;
const PRICE_CEILING_SHARE = 2;
const LISTING_PRICE_CEILING_SHARE = 10;

// ---------------------------------------------------------------------------------------------------------------
// Pure rules

const COVERAGE_LADDER: ReadonlyArray<readonly [number, CreditRating]> = [
  [1, "AAA"],
  [0.5, "AA"],
  [0.25, "A"],
  [0.1, "BBB"],
  [0.05, "B"],
];

export interface NationRatingInput {
  balance: number;
  outstandingPrincipal: number;
  growth: number | null;
  governmentEfficiency: number;
  banned: boolean;
}

/** A nation's credit rating: treasury cover for its outstanding bonds, a notch off for shrinking or weak government. */
export function nationRatingFor(i: NationRatingInput): CreditRating {
  if (i.banned) return "D";
  // A nation that owes nothing is fully covered, whatever its balance.
  const coverage = i.outstandingPrincipal <= 0 ? Infinity : i.balance / i.outstandingPrincipal;
  const base = COVERAGE_LADDER.find(([floor]) => coverage >= floor)?.[1] ?? "CCC";
  const notches =
    (i.growth !== null && i.growth < 0 ? 1 : 0) + (i.governmentEfficiency < 0.3 ? 1 : 0);
  const index = Math.min(CREDIT_RATINGS.indexOf(base) + notches, CREDIT_RATINGS.indexOf("CCC"));
  return CREDIT_RATINGS[index]!;
}

export interface ModelPriceInput {
  faceValue: number;
  couponRate: number;
  rating: CreditRating;
  baseRate: number;
  weeksLeft: number;
  defaulted: boolean;
}

/** An untraded bond's price: par when the coupon pays the rating's yield, more or less for the weeks left. */
export function modelBondPrice(i: ModelPriceInput): number {
  if (i.defaulted) return round2(i.faceValue * DEFAULTED_PRICE_SHARE);
  const yieldDue = i.baseRate + (CREDIT_SPREADS[i.rating] ?? 0.1);
  const raw = i.faceValue * (1 + ((i.couponRate - yieldDue) * i.weeksLeft) / 52);
  const clamped = Math.min(
    i.faceValue * PRICE_CEILING_SHARE,
    Math.max(i.faceValue * PRICE_FLOOR_SHARE, raw)
  );
  return round2(clamped);
}

/** The price shown for a bond: the cheapest ask, else the last trade, else the model price. */
export function bondPriceOf(
  bond: { lastTradePrice: bigint | null },
  bestAsk: number | null,
  model: number
): number {
  const lastPrice = bond.lastTradePrice !== null ? fromCents(centsOf(bond.lastTradePrice)) : null;
  return bestAsk ?? lastPrice ?? model;
}

/** Weeks of a bond's term still to run at `nowMs`. */
export function weeksLeftOf(
  bond: Pick<NationBond, "issuedAt" | "termWeeks">,
  nowMs: number
): number {
  const elapsed = Math.floor((nowMs - bond.issuedAt.getTime()) / WEEK_MS);
  return Math.max(0, bond.termWeeks - elapsed);
}

/** One holder's payment for a week, in cents: the week's coupon, plus principal in the last week. */
export function weekOwedCents(
  units: number,
  bond: Pick<NationBond, "faceValue" | "couponRate">,
  final: boolean
) {
  const faceCents = centsOf(bond.faceValue);
  const coupon = Math.floor(units * faceCents * bond.couponRate * (7 / 365));
  return coupon + (final ? units * faceCents : 0);
}

// ---------------------------------------------------------------------------------------------------------------
// Shared steps

export async function lockBond(tx: Db, bondId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "exchange_nation_bonds" WHERE id = ${bondId} FOR UPDATE`;
}

async function lockedBond(tx: Db, bondId: string): Promise<NationBond> {
  await lockBond(tx, bondId);
  const bond = await tx.nationBond.findUnique({ where: { id: bondId } });
  if (!bond) throw new ExchangeError("NOT_FOUND", "Bond not found");
  return bond;
}

function assertTradable(bond: NationBond): void {
  if (bond.status !== "OPEN") throw new ExchangeError("CONFLICT", "This bond no longer trades");
}

/** A nation's owner, anyone acting as the nation, and its wealth fund can't buy the nation's own bonds. */
async function assertNotNationInsider(tx: Db, countryId: string, userId: string): Promise<void> {
  const owns = await requireCountryOwner(tx, countryId, userId)
    .then(() => true)
    .catch(() => false);
  if (userId === fundUserIdOf(countryId) || owns) {
    throw new ExchangeError("FORBIDDEN", "A nation's owner can't buy its own bonds");
  }
}

async function nationNameOf(tx: Db, countryId: string): Promise<string> {
  const country = await tx.country.findUnique({ where: { id: countryId }, select: { name: true } });
  return country?.name ?? "A nation";
}

/** Open bond principal for `countryId`, counting either sold units (rating coverage) or all issued units (cap). */
async function openPrincipalOf(tx: Db, countryId: string, field: "unitsSold" | "unitsIssued") {
  const bonds = await tx.nationBond.findMany({
    where: { countryId, status: "OPEN" },
    select: { unitsSold: true, unitsIssued: true, faceValue: true },
  });
  return fromCents(bonds.reduce((s, b) => s + b[field] * centsOf(b.faceValue), 0));
}

/** Recompute and store a nation's rating. Returns it. */
export async function refreshNationRatingTx(
  tx: Db,
  countryId: string,
  realmId: string,
  nowMs: number
) {
  const treasury = await getOrCreateTreasury(tx, countryId, realmId);
  const macro = await macroOfCountry(tx, countryId);
  const rating = nationRatingFor({
    balance: fromCents(centsOf(treasury.balance)),
    outstandingPrincipal: await openPrincipalOf(tx, countryId, "unitsSold"),
    growth: macro?.growth ?? null,
    governmentEfficiency: macro?.governmentEfficiency ?? 0.5,
    banned: !!treasury.bondBanUntil && treasury.bondBanUntil.getTime() > nowMs,
  });
  await tx.nationTreasury.update({ where: { id: treasury.id }, data: { creditRating: rating } });
  return rating;
}

async function creditHoldingTx(
  tx: Db,
  bondId: string,
  userId: string,
  units: number,
  costCents: number
) {
  const existing = await tx.bondHolding.findUnique({
    where: { bondId_ownerUserId: { bondId, ownerUserId: userId } },
  });
  if (!existing) {
    await tx.bondHolding.create({
      data: { bondId, ownerUserId: userId, units, avgCost: dbCents(Math.round(costCents / units)) },
    });
    return;
  }
  const total = existing.units + units;
  const avgCostCents = Math.round((centsOf(existing.avgCost) * existing.units + costCents) / total);
  await tx.bondHolding.update({
    where: { id: existing.id },
    data: { units: total, avgCost: dbCents(avgCostCents) },
  });
}

async function alreadyPaid(tx: Db, key: string): Promise<boolean> {
  const row = await tx.exchangeTransaction.findUnique({
    where: { idempotencyKey: key },
    select: { id: true },
  });
  return row !== null;
}

function assertInt(value: number, min: number, max: number, what: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ExchangeError(
      "INVALID_AMOUNT",
      `${what} must be a whole number from ${min} to ${max}`
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Issue

export interface IssueBondInput {
  userId: string;
  countryId: string;
  units: number;
  couponRate: number;
  termWeeks: number;
  requestId: string;
}

function validateIssue(input: IssueBondInput): void {
  assertInt(input.units, BOND_UNITS_MIN, BOND_UNITS_MAX, "Units");
  assertInt(input.termWeeks, TERM_WEEKS_MIN, TERM_WEEKS_MAX, "The term in weeks");
  const r = input.couponRate;
  if (!Number.isFinite(r) || r < COUPON_MIN || r > COUPON_MAX) {
    throw new ExchangeError("INVALID_AMOUNT", "The coupon must be from 0.5% to 25%");
  }
}

const couponLabel = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;

/** The nation's owner issues a bond. A retry with the same request returns the first bond. */
export async function issueBond(
  db: PrismaClient,
  input: IssueBondInput
): Promise<{ bondId: string }> {
  validateIssue(input);
  const key = `exchange:bond-issue:${input.userId}:${input.requestId}`;
  const existing = () =>
    db.nationBond.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
  let headline: PublishedHeadline | null = null;
  try {
    const bondId = await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      const prior = await tx.nationBond.findUnique({
        where: { idempotencyKey: key },
        select: { id: true },
      });
      if (prior) return prior.id;
      const country = await requireCountryOwner(tx, input.countryId, input.userId);
      const now = Date.now();
      const treasury = await lockTreasuryTx(tx, country.id, country.realmId);
      if (treasury.bondBanUntil && treasury.bondBanUntil.getTime() > now) {
        throw new ExchangeError("CONFLICT", "This nation can't issue bonds while it is in default");
      }
      const cfg = await getExchangeConfig(tx);
      const principal = fromCents(input.units * BOND_FACE_CENTS);
      const issued = await openPrincipalOf(tx, country.id, "unitsIssued");
      if (issued + principal > OUTSTANDING_CAP_MULTIPLE * cfg.treasuryCap) {
        throw new ExchangeError("LIMIT_REACHED", "That would take the nation's bonds past their cap");
      }
      const bond = await tx.nationBond.create({
        data: {
          countryId: country.id,
          realmId: country.realmId,
          issuerUserId: input.userId,
          faceValue: dbCents(BOND_FACE_CENTS),
          unitsIssued: input.units,
          couponRate: input.couponRate,
          termWeeks: input.termWeeks,
          idempotencyKey: key,
        },
      });
      headline = await publishNewsTx(tx, {
        realmId: country.realmId,
        kind: "bond_issued",
        prominence: "HEADLINE",
        sourceKind: "NATION",
        sourceId: country.id,
        headline: `${country.name} issues ${formatSovereigns(principal)} in ${input.termWeeks}-week bonds at ${couponLabel(input.couponRate)}`,
        bondId: bond.id,
        countryId: country.id,
        key: `news:bond_issued:${bond.id}`,
      });
      await refreshNationRatingTx(tx, country.id, country.realmId, now);
      return bond.id;
    });
    if (headline) await alertWatchers(db, [headline]);
    return { bondId };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const prior = await existing();
      if (prior) return { bondId: prior.id };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Primary purchase

export interface BondTradeResult {
  units: number;
  paid: number;
  alreadyApplied: boolean;
}

/** Buy units from the treasury at face. */
export async function buyBondPrimary(
  db: PrismaClient,
  input: { userId: string; bondId: string; units: number; requestId: string }
): Promise<BondTradeResult> {
  assertInt(input.units, 1, BOND_UNITS_MAX, "Units");
  const key = `exchange:bond-buy:${input.userId}:${input.requestId}`;
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const bond = await lockedBond(tx, input.bondId);
    const paidCents = input.units * centsOf(bond.faceValue);
    const paid = fromCents(paidCents);
    if (await alreadyPaid(tx, key)) return { units: input.units, paid, alreadyApplied: true };
    await assertNotNationInsider(tx, bond.countryId, input.userId);
    assertTradable(bond);
    if (input.units > bond.unitsIssued - bond.unitsSold) {
      throw new ExchangeError("LIMIT_REACHED", "There aren't that many units left on sale");
    }
    await transferToTreasuryTx(tx, {
      from: { kind: "WALLET", userId: input.userId },
      countryId: bond.countryId,
      realmId: bond.realmId,
      amount: paid,
      type: "BOND_SALE",
      source: `BOND:${bond.id}`,
      key,
    });
    await tx.nationBond.update({
      where: { id: bond.id },
      data: { unitsSold: { increment: input.units } },
    });
    await refreshNationRatingTx(tx, bond.countryId, bond.realmId, Date.now());
    await creditHoldingTx(tx, bond.id, input.userId, input.units, paidCents);
    await publishNewsTx(tx, {
      realmId: bond.realmId,
      kind: "bond_bought",
      prominence: "ACTIVITY",
      sourceKind: "EXCHANGE",
      headline: `A private investor bought ${input.units.toLocaleString("en-US")} ${await nationNameOf(tx, bond.countryId)} bonds`,
      bondId: bond.id,
      countryId: bond.countryId,
      key: `news:bond_bought:${key}`,
    });
    return { units: input.units, paid, alreadyApplied: false };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Listings

/** A holder offers units at a price; the units leave their holding until sold or cancelled. */
export async function listBondUnits(
  db: PrismaClient,
  input: { userId: string; bondId: string; units: number; pricePerUnit: number; requestId: string }
): Promise<{ listingId: string }> {
  assertInt(input.units, 1, BOND_UNITS_MAX, "Units");
  const key = `exchange:bond-list:${input.userId}:${input.requestId}`;
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const bond = await lockedBond(tx, input.bondId);
    const prior = await tx.bondListing.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
    if (prior) return { listingId: prior.id };
    assertTradable(bond);
    if (
      !Number.isFinite(input.pricePerUnit) ||
      input.pricePerUnit < 0.01 ||
      input.pricePerUnit > fromCents(centsOf(bond.faceValue)) * LISTING_PRICE_CEILING_SHARE
    ) {
      throw new ExchangeError("INVALID_AMOUNT", "That price is out of range");
    }
    const open = await tx.bondListing.count({
      where: { bondId: bond.id, sellerUserId: input.userId, status: "OPEN" },
    });
    if (open >= MAX_OPEN_BOND_LISTINGS) throw new ExchangeError("LIMIT_REACHED", "Too many open listings");
    const { count } = await tx.bondHolding.updateMany({
      where: { bondId: bond.id, ownerUserId: input.userId, units: { gte: input.units } },
      data: { units: { decrement: input.units } },
    });
    if (count !== 1) throw new ExchangeError("INSUFFICIENT_SOVEREIGNS", "You don't hold that many units");
    const listing = await tx.bondListing.create({
      data: {
        bondId: bond.id,
        sellerUserId: input.userId,
        units: input.units,
        unitsListed: input.units,
        pricePerUnit: dbCents(toCents(input.pricePerUnit)),
        idempotencyKey: key,
      },
    });
    return { listingId: listing.id };
  });
}

/** A buyer takes units from a listing at its price. */
export async function buyBondListing(
  db: PrismaClient,
  input: { userId: string; listingId: string; units: number; requestId: string }
): Promise<BondTradeResult> {
  assertInt(input.units, 1, BOND_UNITS_MAX, "Units");
  const key = `exchange:bond-take:${input.userId}:${input.requestId}`;
  const found = await db.bondListing.findUnique({ where: { id: input.listingId }, select: { bondId: true } });
  if (!found) throw new ExchangeError("NOT_FOUND", "Listing not found");
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const bond = await lockedBond(tx, found.bondId);
    const listing = await tx.bondListing.findUniqueOrThrow({ where: { id: input.listingId } });
    const priceCents = centsOf(listing.pricePerUnit);
    const paidCents = input.units * priceCents;
    const paid = fromCents(paidCents);
    if (await alreadyPaid(tx, key)) return { units: input.units, paid, alreadyApplied: true };
    await assertNotNationInsider(tx, bond.countryId, input.userId);
    await assertNotFundInsiderPair(tx, input.userId, listing.sellerUserId);
    assertTradable(bond);
    if (listing.status !== "OPEN") throw new ExchangeError("CONFLICT", "That listing is closed");
    if (listing.sellerUserId === input.userId) throw new ExchangeError("CONFLICT", "That's your own listing");
    if (input.units > listing.units) throw new ExchangeError("LIMIT_REACHED", "The listing doesn't have that many");
    await lockParties(tx, [input.userId, listing.sellerUserId]);
    const source = `BOND:${bond.id}`;
    await spendSovereignsTx(tx, { userId: input.userId, amount: paid, type: "BOND_BUY", source, idempotencyKey: key });
    await earnSovereignsTx(tx, {
      userId: listing.sellerUserId,
      amount: paid,
      type: "BOND_SELL",
      source,
      idempotencyKey: `${key}:seller`,
    });
    const left = listing.units - input.units;
    await tx.bondListing.update({
      where: { id: listing.id },
      data: { units: left, status: left === 0 ? "FILLED" : "OPEN" },
    });
    await creditHoldingTx(tx, bond.id, input.userId, input.units, paidCents);
    await tx.nationBond.update({
      where: { id: bond.id },
      data: { lastTradePrice: listing.pricePerUnit },
    });
    await publishNewsTx(tx, {
      realmId: bond.realmId,
      kind: "bond_bought",
      prominence: "ACTIVITY",
      sourceKind: "EXCHANGE",
      headline: `A private investor bought ${input.units.toLocaleString("en-US")} ${await nationNameOf(tx, bond.countryId)} bonds at ${formatSovereigns(fromCents(priceCents))}`,
      bondId: bond.id,
      countryId: bond.countryId,
      key: `news:bond_bought:${key}`,
    });
    return { units: input.units, paid, alreadyApplied: false };
  });
}

async function returnListingTx(
  tx: Db,
  listing: { id: string; bondId: string; sellerUserId: string; units: number }
) {
  if (listing.units > 0) {
    await tx.bondHolding.updateMany({
      where: { bondId: listing.bondId, ownerUserId: listing.sellerUserId },
      data: { units: { increment: listing.units } },
    });
  }
  await tx.bondListing.update({
    where: { id: listing.id },
    data: { units: 0, status: "CANCELLED" },
  });
}

/** The seller takes an open listing down; its units return to their holding. */
export async function cancelBondListing(
  db: PrismaClient,
  input: { userId: string; listingId: string }
) {
  const found = await db.bondListing.findUnique({
    where: { id: input.listingId },
    select: { bondId: true },
  });
  if (!found) throw new ExchangeError("NOT_FOUND", "Listing not found");
  await db.$transaction(async (tx) => {
    await lockBond(tx, found.bondId);
    const listing = await tx.bondListing.findUniqueOrThrow({ where: { id: input.listingId } });
    if (listing.sellerUserId !== input.userId)
      throw new ExchangeError("FORBIDDEN", "That isn't your listing");
    if (listing.status !== "OPEN") return;
    await returnListingTx(tx, listing);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Payments (the market tick)

type WeekOutcome = "paid" | "defaulted" | "skipped";

interface WeekContext {
  bond: NationBond;
  week: number;
  nowMs: number;
  news: PublishedHeadline[];
}

/** Each holder's units, counting those listed for sale (in the last week, listings are returned first). */
async function unitsByHolder(
  tx: Db,
  bond: NationBond,
  final: boolean
): Promise<Map<string, number>> {
  const listings = await tx.bondListing.findMany({ where: { bondId: bond.id, status: "OPEN" } });
  if (final) for (const l of listings) await returnListingTx(tx, l);
  const holdings = await tx.bondHolding.findMany({ where: { bondId: bond.id, units: { gt: 0 } } });
  const units = new Map<string, number>();
  for (const h of holdings) units.set(h.ownerUserId, h.units);
  if (!final) {
    for (const l of listings) units.set(l.sellerUserId, (units.get(l.sellerUserId) ?? 0) + l.units);
  }
  return units;
}

async function payHolderTx(
  tx: Db,
  bond: NationBond,
  week: number,
  userId: string,
  cents: number,
  final: boolean
) {
  if (cents <= 0) return;
  const amount = cents / 100;
  const type = final ? "BOND_PRINCIPAL" : "BOND_COUPON";
  const key = `bond-pay:${bond.id}:${week}:${userId}`;
  await debitTreasuryTx(tx, {
    countryId: bond.countryId,
    amount,
    type,
    source: `BOND:${bond.id}`,
    key,
  });
  await earnSovereignsTx(tx, {
    userId,
    amount,
    type,
    source: `BOND:${bond.id}`,
    idempotencyKey: key,
  });
}

async function defaultTx(
  tx: Db,
  ctx: WeekContext,
  owed: Map<string, number>,
  balanceCents: number,
  total: number
) {
  const { bond, week, nowMs } = ctx;
  for (const [userId, cents] of owed) {
    await payHolderTx(tx, bond, week, userId, Math.floor((cents * balanceCents) / total), false);
  }
  await tx.nationBond.update({ where: { id: bond.id }, data: { status: "DEFAULTED" } });
  await tx.nationTreasury.update({
    where: { countryId: bond.countryId },
    data: { creditRating: "D", bondBanUntil: new Date(nowMs + DEFAULT_BAN_DAYS * DAY_MS) },
  });
  const nation = await nationNameOf(tx, bond.countryId);
  const headline = await publishNewsTx(tx, {
    realmId: bond.realmId,
    kind: "bond_defaulted",
    prominence: "HEADLINE",
    sourceKind: "EXCHANGE",
    headline: `${nation} defaults on its ${bond.termWeeks}-week bonds; holders get what the treasury held`,
    bondId: bond.id,
    countryId: bond.countryId,
    key: `news:bond_defaulted:${bond.id}`,
  });
  if (headline) ctx.news.push(headline);
}

async function payWeekTx(tx: Db, ctx: WeekContext): Promise<WeekOutcome> {
  const bond = await lockedBond(tx, ctx.bond.id);
  if (bond.status !== "OPEN" || bond.weeksPaid >= ctx.week) return "skipped";
  const final = ctx.week === bond.termWeeks;
  const holders = await unitsByHolder(tx, bond, final);
  const owed = new Map(
    [...holders].map(([userId, units]) => [userId, weekOwedCents(units, bond, final)])
  );
  const total = [...owed.values()].reduce((s, c) => s + c, 0);
  await lockParties(tx, [...owed.keys()]);
  const treasury = await lockTreasuryTx(tx, bond.countryId, bond.realmId);
  const balanceCents = Math.max(0, centsOf(treasury.balance));
  if (total > balanceCents) {
    await defaultTx(tx, { ...ctx, bond }, owed, balanceCents, total);
    return "defaulted";
  }
  for (const [userId, cents] of owed) await payHolderTx(tx, bond, ctx.week, userId, cents, final);
  await tx.nationBond.update({
    where: { id: bond.id },
    data: { weeksPaid: ctx.week, ...(final ? { status: "MATURED" } : {}) },
  });
  if (final) {
    const nation = await nationNameOf(tx, bond.countryId);
    const headline = await publishNewsTx(tx, {
      realmId: bond.realmId,
      kind: "bond_repaid",
      prominence: "HEADLINE",
      sourceKind: "NATION",
      sourceId: bond.countryId,
      headline: `${nation} repays its ${bond.termWeeks}-week bonds in full`,
      bondId: bond.id,
      countryId: bond.countryId,
      key: `news:bond_repaid:${bond.id}`,
    });
    if (headline) ctx.news.push(headline);
  }
  return "paid";
}

export interface BondPaymentsSummary {
  couponsPaid: number;
  matured: number;
  defaulted: number;
  news: PublishedHeadline[];
}

/** Pay every week that has come due on every open bond, then re-rate the nations touched. */
export async function runBondPayments(
  db: PrismaClient,
  nowMs: number
): Promise<BondPaymentsSummary> {
  const summary: BondPaymentsSummary = { couponsPaid: 0, matured: 0, defaulted: 0, news: [] };
  const touched = new Map<string, string>();
  for (const bond of await db.nationBond.findMany({ where: { status: "OPEN" } })) {
    const due = Math.min(bond.termWeeks, Math.floor((nowMs - bond.issuedAt.getTime()) / WEEK_MS));
    for (let week = bond.weeksPaid + 1; week <= due; week++) {
      let outcome: WeekOutcome;
      try {
        outcome = await db.$transaction((tx) =>
          payWeekTx(tx, { bond, week, nowMs, news: summary.news })
        );
      } catch (error) {
        console.error(`[Exchange] bond ${bond.id} week ${week} failed:`, error);
        break;
      }
      if (outcome === "skipped") continue;
      touched.set(bond.countryId, bond.realmId);
      if (outcome === "defaulted") {
        summary.defaulted++;
        break;
      }
      summary.couponsPaid++;
      if (week === bond.termWeeks) summary.matured++;
    }
  }
  for (const [countryId, realmId] of touched) {
    await db.$transaction((tx) => refreshNationRatingTx(tx, countryId, realmId, nowMs));
  }
  return summary;
}
