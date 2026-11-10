/**
 * Sector indices and sector funds, one set per realm. Spec: docs/specs/2026-10-06-exchange-economy-design.md.
 *
 * Index: one per macro sector (agriculture, industry, services, government) in each realm,
 * recomputed by the `exchange-market` job from Exchange activity in that sector:
 *   activity = Σ capital + 100 × positive standing of the realm's ACTIVE companies in the sector
 *            + Σ value of the sector's contracts completed in the last 30 days
 *   target   = 1,000 × (1 + dmModifier) × (1 + macroTilt) × (activity + 10,000) ÷ (base + 10,000)
 * where `base` is the activity captured on the first compute. Each run moves the index at
 * most 5% toward its target, so one large deposit can't jump it. The macro tilt moves the
 * target by at most ±10%, by how far the sector's share of the realm's nominal GDP sits above
 * or below a neutral 25%. A SectorIndexHistory row records every run.
 *
 * Funds (SectorPosition): a player buys units of a realm's sector fund with ₷ and sells them
 * back at the unit price, fund ₷ ÷ units outstanding. After each index run the four funds of
 * the realm are rebalanced by relative performance: fund_s × growth_s, scaled so the total is
 * unchanged and rounded to whole cents with the remainder placed exactly. No ₷ is ever created
 * or destroyed, so pumping an index can at most move ₷ between fund holders, never mint it.
 * No leverage, no shorting; a sale must wait 24 hours after the seller's last buy in that
 * sector of that realm, so nobody can buy just before a known run and sell just after it.
 */

import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  ExchangeError,
  earnSovereignsTx,
  isUniqueViolation,
  spendSovereignsTx,
} from "~/lib/vault/exchange-service";
import { INDEX_BASE, SECTOR_KEYS, type SectorKey } from "./companies";
import { DAY_MS } from "./contracts";
import { assertExchangeOpen, lockWallet, type Db } from "./guards";
import { countryMacroOf } from "./macro";
import { OPERATING_TICK_MS } from "./operations";
import { centsOf, fromCents, toCents } from "./amounts";

export const SECTOR_LABELS: Record<SectorKey, string> = {
  agriculture: "Agriculture",
  industry: "Industry",
  services: "Services",
  government: "Government",
};

/** Smoothing added to activity and base, so a near-empty sector doesn't swing wildly. */
export const ACTIVITY_FLOOR = 10_000;
/** Largest move per run, as a fraction of the current value. */
export const MAX_STEP = 0.05;
export const INDEX_MIN = 100;
export const INDEX_MAX = 100_000;
export const ACTIVITY_WINDOW_DAYS = 30;
/** Real time a seller must wait after their last buy in a sector. */
export const SELL_HOLD_MS = 24 * 60 * 60 * 1000;
/** Unit price of an empty fund. */
export const UNIT_START_PRICE = 1;

export const DM_MODIFIER_MIN = -0.5;
export const DM_MODIFIER_MAX = 2;

/** A sector with a quarter of the realm's GDP is neutral: it neither lifts nor drags the target. */
export const MACRO_NEUTRAL_WEIGHT = 0.25;
const MACRO_TILT_SLOPE = 0.5;
export const MACRO_TILT_LIMIT = 0.1;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Row-lock a realm's sector indices (and so its funds) until the transaction ends. */
async function lockRealmSectors(tx: Db, realmId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "exchange_sector_indices" WHERE "realmId" = ${realmId} FOR UPDATE`;
}

/** Create a realm's four index rows at 1,000 if they don't exist yet. */
export async function ensureSectorIndices(db: Db, realmId: string): Promise<void> {
  await db.sectorIndex.createMany({
    data: SECTOR_KEYS.map((sectorKey) => ({ realmId, sectorKey, label: SECTOR_LABELS[sectorKey] })),
    skipDuplicates: true,
  });
}

/** The macro tilt on an index target: at most ±10%, scaled by the sector's GDP weight. */
export function macroTiltOf(macroWeight: number): number {
  const tilt = (macroWeight - MACRO_NEUTRAL_WEIGHT) * MACRO_TILT_SLOPE;
  return Math.min(MACRO_TILT_LIMIT, Math.max(-MACRO_TILT_LIMIT, tilt));
}

/** The next index value: a step of at most MAX_STEP toward the activity target. */
export function nextIndexValue(
  previous: number,
  activity: number,
  base: number,
  dmModifier = 0,
  macroWeight = MACRO_NEUTRAL_WEIGHT
): number {
  const target =
    INDEX_BASE *
    (1 + dmModifier) *
    (1 + macroTiltOf(macroWeight)) *
    ((activity + ACTIVITY_FLOOR) / (base + ACTIVITY_FLOOR));
  const ratio = previous > 0 ? target / previous : 1;
  const step = Math.min(1 + MAX_STEP, Math.max(1 - MAX_STEP, ratio));
  return Math.min(INDEX_MAX, Math.max(INDEX_MIN, round2(previous * step)));
}

/** One nation's contribution to its realm's sector weights. */
export interface NationSectorShare {
  nominalGDP: number | null;
  sectorShares: Record<SectorKey, number>;
  hasRecordedSector: boolean;
}

function neutralWeights(): Record<SectorKey, number> {
  return Object.fromEntries(SECTOR_KEYS.map((key) => [key, MACRO_NEUTRAL_WEIGHT])) as Record<
    SectorKey,
    number
  >;
}

function positiveGdp(nominalGDP: number | null): number {
  return nominalGDP != null && Number.isFinite(nominalGDP) && nominalGDP > 0 ? nominalGDP : 0;
}

/**
 * A realm's share of GDP per macro sector: each nation's recorded sector shares, weighted by
 * its nominal GDP. With no GDP on record every nation counts equally. With no sector breakdown
 * anywhere the weights stay neutral, so a realm with no data is not tilted.
 */
export function macroWeightsOf(nations: readonly NationSectorShare[]): Record<SectorKey, number> {
  if (!nations.some((n) => n.hasRecordedSector)) return neutralWeights();
  const gdpTotal = nations.reduce((sum, n) => sum + positiveGdp(n.nominalGDP), 0);
  const weightOf = (n: NationSectorShare) => (gdpTotal > 0 ? positiveGdp(n.nominalGDP) : 1);
  const total = gdpTotal > 0 ? gdpTotal : nations.length;
  return Object.fromEntries(
    SECTOR_KEYS.map((key) => [
      key,
      nations.reduce((sum, n) => sum + weightOf(n) * n.sectorShares[key], 0) / total,
    ])
  ) as Record<SectorKey, number>;
}

async function realmMacroWeights(db: Db, realmId: string): Promise<Record<SectorKey, number>> {
  const countries = await db.country.findMany({
    where: { realmId },
    select: { nominalGDP: true, economicProfile: true },
  });
  return macroWeightsOf(
    countries.map((c) => {
      const macro = countryMacroOf(c);
      return {
        nominalGDP: c.nominalGDP,
        sectorShares: macro.sectorShares,
        hasRecordedSector: macro.hasRecordedSector,
      };
    })
  );
}

/**
 * Rebalance fund balances (whole cents) by each sector's growth, keeping the total exact:
 * new_s = floor(total × fund_s × growth_s ÷ Σ fund × growth), then the leftover cents go one
 * each to the largest fractional parts.
 */
export function rebalanceFunds(
  funds: ReadonlyArray<{ sectorKey: string; cents: number; growth: number }>
): Map<string, number> {
  const out = new Map(funds.map((f) => [f.sectorKey, f.cents]));
  const total = funds.reduce((s, f) => s + f.cents, 0);
  const weights = funds.map((f) => ({ key: f.sectorKey, w: f.cents * Math.max(0, f.growth) }));
  const weightSum = weights.reduce((s, x) => s + x.w, 0);
  if (total <= 0 || weightSum <= 0) return out;
  const shares = weights.map((x) => {
    const exact = (total * x.w) / weightSum;
    return { key: x.key, cents: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let left = total - shares.reduce((s, x) => s + x.cents, 0);
  for (const x of [...shares].sort((a, b) => b.frac - a.frac || (a.key < b.key ? -1 : 1))) {
    if (left <= 0) break;
    x.cents++;
    left--;
  }
  for (const x of shares) out.set(x.key, x.cents);
  return out;
}

/** Activity per sector in one realm right now (see the header for the formula). */
export async function measureSectorActivity(
  db: Db,
  realmId: string,
  nowMs: number
): Promise<Record<SectorKey, number>> {
  const since = nowMs - ACTIVITY_WINDOW_DAYS * DAY_MS;
  const [companies, contracts] = await Promise.all([
    db.company.findMany({
      where: { realmId, status: "ACTIVE" },
      select: { sectorKey: true, capital: true, standing: true },
    }),
    db.contract.findMany({
      where: { realmId, status: "COMPLETED", closedIxTime: { gte: since } },
      select: { sectorKey: true, value: true },
    }),
  ]);
  const activity = Object.fromEntries(SECTOR_KEYS.map((k) => [k, 0])) as Record<SectorKey, number>;
  const add = (key: string, n: number) => {
    if (key in activity) activity[key as SectorKey] += n;
  };
  for (const c of companies) {
    add(c.sectorKey, fromCents(centsOf(c.capital)) + 100 * Math.max(0, c.standing));
  }
  for (const k of contracts) add(k.sectorKey, k.value);
  return activity;
}

export interface IndexRun {
  realmId: string;
  sectorKey: string;
  previous: number;
  value: number;
  activity: number;
  fund: number;
}

/** Every realm with companies, plus Ixnay, which always has its indices. */
async function indexedRealmIds(db: Db): Promise<string[]> {
  const rows = await db.company.findMany({ distinct: ["realmId"], select: { realmId: true } });
  return [...new Set([DEFAULT_REALM_ID, ...rows.map((r) => r.realmId)])];
}

/** Recompute one realm's indices, rebalance its funds and record history, in one transaction. */
async function computeRealmSectorIndices(
  db: PrismaClient,
  realmId: string,
  nowMs: number
): Promise<IndexRun[]> {
  await ensureSectorIndices(db, realmId);
  const [activity, weights] = await Promise.all([
    measureSectorActivity(db, realmId, nowMs),
    realmMacroWeights(db, realmId),
  ]);
  return db.$transaction(async (tx) => {
    await lockRealmSectors(tx, realmId);
    const rows = await tx.sectorIndex.findMany({
      where: { realmId, sectorKey: { in: [...SECTOR_KEYS] } },
    });
    const tick = Math.floor(nowMs / OPERATING_TICK_MS);
    if (
      rows.some(
        (row) =>
          row.computedIxTime !== null &&
          Math.floor(row.computedIxTime / OPERATING_TICK_MS) === tick
      )
    ) {
      return [];
    }
    const next = rows.map((row) => {
      const key = row.sectorKey as SectorKey;
      const a = activity[key] ?? 0;
      const base = row.baseTotal ?? a;
      const macroWeight = weights[key];
      const value = nextIndexValue(row.value, a, base, row.dmModifier, macroWeight);
      return {
        row,
        base,
        activity: a,
        value,
        macroWeight,
        growth: row.value > 0 ? value / row.value : 1,
      };
    });
    const funds = rebalanceFunds(
      next.map((n) => ({
        sectorKey: n.row.sectorKey,
        cents: toCents(n.row.fundSovereigns),
        growth: n.growth,
      }))
    );
    const runs: IndexRun[] = [];
    for (const n of next) {
      const fund = fromCents(funds.get(n.row.sectorKey) ?? toCents(n.row.fundSovereigns));
      await tx.sectorIndex.update({
        where: { id: n.row.id },
        data: {
          value: n.value,
          baseTotal: n.base,
          computedIxTime: nowMs,
          fundSovereigns: fund,
          macroWeight: n.macroWeight,
        },
      });
      await tx.sectorIndexHistory.create({
        data: { realmId, sectorKey: n.row.sectorKey, value: n.value, recordedIxTime: nowMs },
      });
      runs.push({
        realmId,
        sectorKey: n.row.sectorKey,
        previous: n.row.value,
        value: n.value,
        activity: round2(n.activity),
        fund,
      });
    }
    return runs;
  });
}

/** Recompute the indices of every realm (each in its own transaction). */
export async function computeSectorIndices(
  db: PrismaClient,
  nowMs: number = Date.now()
): Promise<IndexRun[]> {
  const runs: IndexRun[] = [];
  for (const realmId of await indexedRealmIds(db)) {
    runs.push(...(await computeRealmSectorIndices(db, realmId, nowMs)));
  }
  return runs;
}

/**
 * Set a realm sector's DM lever, clamped to its allowed range, and record the change in the
 * admin audit log. The router checks who may do this.
 */
export async function setSectorDmModifier(
  db: PrismaClient,
  input: { realmId: string; sectorKey: SectorKey; value: number; actorUserId: string }
) {
  if (!Number.isFinite(input.value)) {
    throw new ExchangeError("INVALID_AMOUNT", "The modifier must be a number");
  }
  const dmModifier = Math.min(DM_MODIFIER_MAX, Math.max(DM_MODIFIER_MIN, input.value));
  const where = {
    realmId_sectorKey: { realmId: input.realmId, sectorKey: input.sectorKey },
  };
  await ensureSectorIndices(db, input.realmId);
  return db.$transaction(async (tx) => {
    const before = await tx.sectorIndex.findUniqueOrThrow({ where, select: { dmModifier: true } });
    const row = await tx.sectorIndex.update({ where, data: { dmModifier } });
    await tx.adminAuditLog.create({
      data: {
        action: "EXCHANGE_SECTOR_DM",
        targetType: "SectorIndex",
        targetId: `${input.realmId}:${input.sectorKey}`,
        targetName: SECTOR_LABELS[input.sectorKey],
        changes: JSON.stringify({ from: before.dmModifier, to: dmModifier }),
        adminId: input.actorUserId,
        adminName: input.actorUserId,
      },
    });
    return row;
  });
}

/** What one unit of a fund is worth now. */
export function unitPrice(fund: { fundSovereigns: number; unitsOutstanding: number }): number {
  if (fund.unitsOutstanding > 1e-6 && fund.fundSovereigns > 0) {
    return fund.fundSovereigns / fund.unitsOutstanding;
  }
  return UNIT_START_PRICE;
}

export interface FundTradeResult {
  units: number;
  sovereigns: number;
  alreadyApplied: boolean;
}

/** The ledger source of a realm sector's fund trades; the sell hold reads it back. */
function fundSource(realmId: string, sectorKey: string): string {
  return `SECTOR_FUND:${realmId}:${sectorKey}`;
}

async function appliedTrade(db: Db, key: string): Promise<FundTradeResult | null> {
  const row = await db.exchangeTransaction.findUnique({ where: { idempotencyKey: key } });
  if (!row) return null;
  const meta = (row.metadata ?? {}) as { units?: number };
  return {
    units: meta.units ?? 0,
    sovereigns: fromCents(Math.abs(centsOf(row.sovereigns))),
    alreadyApplied: true,
  };
}

async function keyed(
  db: PrismaClient,
  key: string,
  run: () => Promise<FundTradeResult>
): Promise<FundTradeResult> {
  try {
    return await run();
  } catch (error) {
    if (isUniqueViolation(error)) {
      const applied = await appliedTrade(db, key);
      if (applied) return applied;
    }
    throw error;
  }
}

/** Buy fund units for `amount` ₷ at the current unit price. */
export async function buySectorUnits(
  db: PrismaClient,
  input: {
    userId: string;
    realmId: string;
    sectorKey: SectorKey;
    amount: number;
    requestId: string;
  }
): Promise<FundTradeResult> {
  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    toCents(input.amount) / 100 !== input.amount
  ) {
    throw new ExchangeError("INVALID_AMOUNT", "Amount must be positive, in whole cents");
  }
  const key = `exchange:sector-buy:${input.userId}:${input.requestId}`;
  const source = fundSource(input.realmId, input.sectorKey);
  const fundWhere = {
    realmId_sectorKey: { realmId: input.realmId, sectorKey: input.sectorKey },
  };
  await ensureSectorIndices(db, input.realmId);
  return keyed(db, key, () =>
    db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockRealmSectors(tx, input.realmId);
      await lockWallet(tx, input.userId);
      const applied = await appliedTrade(tx, key);
      if (applied) return applied;

      const fund = await tx.sectorIndex.findUniqueOrThrow({ where: fundWhere });
      const units = input.amount / unitPrice(fund);
      await spendSovereignsTx(tx, {
        userId: input.userId,
        amount: input.amount,
        type: "SECTOR_BUY",
        source,
        metadata: { realmId: input.realmId, sectorKey: input.sectorKey, units },
        idempotencyKey: key,
      });
      await tx.sectorIndex.update({
        where: { id: fund.id },
        data: {
          fundSovereigns: fromCents(toCents(fund.fundSovereigns) + toCents(input.amount)),
          unitsOutstanding: fund.unitsOutstanding + units,
        },
      });
      const where = {
        ownerUserId_realmId_sectorKey: {
          ownerUserId: input.userId,
          realmId: input.realmId,
          sectorKey: input.sectorKey,
        },
      };
      const position = await tx.sectorPosition.findUnique({ where });
      if (position) {
        const total = position.units + units;
        await tx.sectorPosition.update({
          where: { id: position.id },
          data: {
            units: total,
            avgCost: (position.units * position.avgCost + input.amount) / total,
          },
        });
      } else {
        await tx.sectorPosition.create({
          data: {
            ownerUserId: input.userId,
            realmId: input.realmId,
            sectorKey: input.sectorKey,
            units,
            avgCost: input.amount / units,
          },
        });
      }
      return { units, sovereigns: input.amount, alreadyApplied: false };
    })
  );
}

/** Sell a fraction (0 to 1; 1 sells everything) of your units at the current unit price. */
export async function sellSectorUnits(
  db: PrismaClient,
  input: {
    userId: string;
    realmId: string;
    sectorKey: SectorKey;
    fraction: number;
    requestId: string;
  }
): Promise<FundTradeResult> {
  if (!Number.isFinite(input.fraction) || input.fraction <= 0 || input.fraction > 1) {
    throw new ExchangeError("INVALID_AMOUNT", "Sell between 0 and 100% of your units");
  }
  const key = `exchange:sector-sell:${input.userId}:${input.requestId}`;
  const source = fundSource(input.realmId, input.sectorKey);
  return keyed(db, key, () =>
    db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockRealmSectors(tx, input.realmId);
      const wallet = await lockWallet(tx, input.userId);
      const applied = await appliedTrade(tx, key);
      if (applied) return applied;

      const position = await tx.sectorPosition.findUnique({
        where: {
          ownerUserId_realmId_sectorKey: {
            ownerUserId: input.userId,
            realmId: input.realmId,
            sectorKey: input.sectorKey,
          },
        },
      });
      if (!position || position.units <= 0) {
        throw new ExchangeError("INVALID_AMOUNT", "You hold no units in this sector");
      }
      const recentBuy = await tx.exchangeTransaction.findFirst({
        where: {
          walletId: wallet.id,
          type: "SECTOR_BUY",
          source,
          createdAt: { gt: new Date(Date.now() - SELL_HOLD_MS) },
        },
        select: { id: true },
      });
      if (recentBuy) {
        throw new ExchangeError(
          "CONFLICT",
          "You can sell 24 hours after your last buy in a sector"
        );
      }

      const fund = await tx.sectorIndex.findUniqueOrThrow({
        where: { realmId_sectorKey: { realmId: input.realmId, sectorKey: input.sectorKey } },
      });
      const units = input.fraction === 1 ? position.units : position.units * input.fraction;
      const fundCents = toCents(fund.fundSovereigns);
      const sellsAll = units >= fund.unitsOutstanding * (1 - 1e-9);
      const payoutCents = sellsAll
        ? fundCents
        : Math.floor((fundCents * units) / fund.unitsOutstanding);
      if (payoutCents <= 0) throw new ExchangeError("INVALID_AMOUNT", "That is too little to sell");

      const { count } = await tx.sectorPosition.updateMany({
        where: { id: position.id, units: position.units },
        data: { units: input.fraction === 1 ? 0 : position.units - units },
      });
      if (count !== 1) throw new ExchangeError("CONFLICT", "Your position changed; try again");
      await tx.sectorIndex.update({
        where: { id: fund.id },
        data: {
          fundSovereigns: fromCents(fundCents - payoutCents),
          unitsOutstanding: sellsAll ? 0 : Math.max(0, fund.unitsOutstanding - units),
        },
      });
      const sovereigns = fromCents(payoutCents);
      await earnSovereignsTx(tx, {
        userId: input.userId,
        amount: sovereigns,
        type: "SECTOR_SELL",
        source,
        metadata: { realmId: input.realmId, sectorKey: input.sectorKey, units },
        idempotencyKey: key,
      });
      return { units, sovereigns, alreadyApplied: false };
    })
  );
}

/** A realm's indices with recent history and fund prices, plus the caller's positions there. */
export async function getSectorMarket(db: Db, userId: string, realmId: string) {
  const [indices, history, positions] = await Promise.all([
    db.sectorIndex.findMany({ where: { realmId, sectorKey: { in: [...SECTOR_KEYS] } } }),
    db.sectorIndexHistory.findMany({
      where: { realmId, sectorKey: { in: [...SECTOR_KEYS] } },
      orderBy: { recordedIxTime: "desc" },
      take: 4 * 60,
      select: { sectorKey: true, value: true, recordedAt: true },
    }),
    db.sectorPosition.findMany({
      where: { ownerUserId: userId, realmId, units: { gt: 0 } },
    }),
  ]);
  return SECTOR_KEYS.map((sectorKey) => {
    const row = indices.find((i) => i.sectorKey === sectorKey);
    const fund = {
      fundSovereigns: row?.fundSovereigns ?? 0,
      unitsOutstanding: row?.unitsOutstanding ?? 0,
    };
    const price = unitPrice(fund);
    const position = positions.find((p) => p.sectorKey === sectorKey);
    return {
      sectorKey,
      label: SECTOR_LABELS[sectorKey],
      value: row?.value ?? INDEX_BASE,
      macroWeight: row?.macroWeight ?? 0,
      dmModifier: row?.dmModifier ?? 0,
      computedIxTime: row?.computedIxTime ?? null,
      fund: fund.fundSovereigns,
      unitPrice: Math.round(price * 10_000) / 10_000,
      history: history
        .filter((h) => h.sectorKey === sectorKey)
        .slice(0, 60)
        .reverse()
        .map((h) => ({ value: h.value, at: h.recordedAt })),
      position: position
        ? {
            units: position.units,
            avgCost: position.avgCost,
            value: Math.floor(position.units * price * 100) / 100,
          }
        : null,
    };
  });
}
