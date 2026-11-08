/**
 * Corporate operations on each market tick: the operating P&L, the operating revenue mint and
 * the settlement of each company's charges. Distress and liquidation are in distress.ts, and the
 * Central Bank credit line is in credit.ts. Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 *
 * Money. Operating revenue is the only organic mint, and a realm's total per tick is capped at
 * its operating budget. Every other move takes ₷ from one holder and gives it to another: upkeep
 * is burned, and interest and tax go to the HQ treasury. Company capital is a float, so a tick
 * writes it back in whole cents before each debit; that keeps a debit of the whole balance inside
 * its conditional check.
 *
 * A realm's tick runs in one transaction. Its first write claims a marker row for the realm and
 * the tick, so a retried tick finds the marker and mints nothing.
 */

import type { Company, PrismaClient } from "@prisma/client";
import { round2 } from "./amounts";
import { INDEX_BASE, SECTOR_KEYS, type SectorKey } from "./companies";
import { borrowRateOf, creditLimitFor } from "./credit";
import { applyDistressTx, distressDecision, setCapitalTx, type DistressAction } from "./distress";
import type { Db } from "./guards";
import { countryMacroOf, sectorAdvantageOf, type CountryMacro } from "./macro";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { fromCents, lockCompany, toCents } from "./ownership";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import { SUB_INDUSTRIES, creditRatingFor, supplyChainFactor } from "./taxonomy";
import { transferToTreasuryTx, type TreasuryInflowType } from "./treasury";
import { lendingTermsFor, type LendingTerms } from "./lending";

const DAY_MS = 24 * 60 * 60 * 1000;
export const TICKS_PER_DAY = 4;
const OPERATING_TICK_MS = DAY_MS / TICKS_PER_DAY;
const CAPITAL_BASE_CAP = 50_000;
const CAPITAL_BASE_WEIGHT = 0.5;
const STANDING_BASE_WEIGHT = 250;
const GROWTH_FLOOR = -0.05;
const GROWTH_CEILING = 0.1;
const INFLATION_FLOOR = 0.02;
const TAX_RELIEF_FACTOR = 0.75;
const DAYS_PER_YEAR = 365;
const UPSTREAM_WINDOW_MS = 30 * DAY_MS;
const RUN_KEY_PREFIX = "exchange-operations:";
const RUN_MARKER_TTL_MS = 3 * DAY_MS;
const REALM_TX_TIMEOUT_MS = 120_000;
const OPERATING_STATUSES = ["ACTIVE", "DISTRESSED"];
const EPS_CENTS = 1e-6;

export interface OperatingMint {
  companyId: string;
  amount: number;
}

export interface OperationsSummary {
  realms: number;
  skippedRealms: number;
  companies: number;
  revenueMinted: number;
  distressed: number;
  bankrupt: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isSectorKey(key: string): key is SectorKey {
  return (SECTOR_KEYS as readonly string[]).includes(key);
}

export function operatingTickKey(nowMs: number): string {
  return String(Math.floor(nowMs / OPERATING_TICK_MS));
}

function productiveBaseOf(c: Pick<Company, "decisionValue" | "capital" | "standing">): number {
  return (
    c.decisionValue +
    CAPITAL_BASE_WEIGHT * Math.min(c.capital, CAPITAL_BASE_CAP) +
    STANDING_BASE_WEIGHT * Math.max(0, c.standing)
  );
}

function sectorFactorOf(index: number): number {
  return clamp(index / INDEX_BASE, 0.6, 1.8);
}

/** Demand from the HQ nation's growth, plus the comparative-advantage bonus of the sector. */
function hqDemandFactorOf(growth: number | null, advantage: number): number {
  return 1 + 2 * clamp(growth ?? 0, GROWTH_FLOOR, GROWTH_CEILING) + advantage;
}

function pricingFactorOf(strategy: string, standing: number): number {
  if (strategy === "undercut") return 0.9;
  if (strategy === "premium") return standing >= 5 ? 1.15 : 0.85;
  return 1;
}

/**
 * Each company's revenue in cents, scaled down pro rata when the gross total would exceed the
 * budget. The floor keeps the sum at or under the budget even with float rounding.
 */
export function scaledRevenuesCents(grossCents: readonly number[], budgetCents: number): number[] {
  const total = grossCents.reduce((sum, g) => sum + g, 0);
  const scale = total > budgetCents ? budgetCents / total : 1;
  return grossCents.map((g) => Math.max(0, Math.floor(g * scale + EPS_CENTS)));
}

/**
 * The one primitive that mints operating revenue. It claims the realm's marker for the tick
 * first, so a retry of the same tick finds the marker and mints nothing. Returns false when the
 * tick was already run.
 */
async function mintOperatingRevenueTx(
  tx: Db,
  input: { realmId: string; tickKey: string; nowMs: number; mints: readonly OperatingMint[] }
): Promise<boolean> {
  await tx.systemConfig.deleteMany({
    where: {
      key: { startsWith: RUN_KEY_PREFIX },
      createdAt: { lt: new Date(input.nowMs - RUN_MARKER_TTL_MS) },
    },
  });
  const key = `${RUN_KEY_PREFIX}${input.realmId}:${input.tickKey}`;
  const claimed = await tx.systemConfig.findUnique({ where: { key }, select: { id: true } });
  if (claimed) return false;
  const minted = input.mints.reduce((sum, m) => sum + m.amount, 0);
  await tx.systemConfig.create({
    data: {
      key,
      value: JSON.stringify({ minted: round2(minted), companies: input.mints.length }),
      description: "Exchange operating revenue minted for this realm and tick",
    },
  });
  for (const m of input.mints) {
    if (m.amount <= 0) continue;
    await tx.company.update({
      where: { id: m.companyId },
      data: { capital: { increment: m.amount } },
    });
  }
  return true;
}

interface RealmContext {
  realmId: string;
  tickKey: string;
  nowMs: number;
  indexOf: ReadonlyMap<string, number>;
  macros: ReadonlyMap<string, CountryMacro>;
  terms: ReadonlyMap<string, LendingTerms>;
  realmSubIndustries: string[];
  suppliedByContract: ReadonlySet<string>;
}

interface Draft {
  company: Company;
  hq: string | null;
  taxRate: number;
  grossCents: number;
  upkeepCents: number;
  interestCents: number;
}

interface CompanyPlan extends Draft {
  revenueCents: number;
  taxCents: number;
}

interface RealmOutcome {
  skipped: boolean;
  companies: number;
  mintedCents: number;
  distressed: number;
  bankrupt: number;
  notices: ExchangeNotice[];
}

const IDLE: RealmOutcome = {
  skipped: false,
  companies: 0,
  mintedCents: 0,
  distressed: 0,
  bankrupt: 0,
  notices: [],
};

async function loadMacros(tx: Db, ids: readonly string[]): Promise<Map<string, CountryMacro>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const countries = await tx.country.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      adjustedGdpGrowth: true,
      economicTier: true,
      governmentalEfficiency: true,
      interestRates: true,
      inflationRate: true,
      economicProfile: true,
      fiscalSystem: true,
      historicalData: {
        orderBy: { ixTimeTimestamp: "desc" },
        take: 1,
        select: { gdpGrowthRate: true },
      },
    },
  });
  return new Map(countries.map((c) => [c.id, countryMacroOf(c)]));
}

function isUpstreamOf(buyerSubIndustry: string, supplierSubIndustry: string): boolean {
  const upstream = SUB_INDUSTRIES.find((s) => s.key === buyerSubIndustry)?.upstream ?? [];
  return upstream.some((key) => key === supplierSubIndustry);
}

/** The buyers in this realm that completed a B2B contract with an upstream supplier recently. */
async function suppliedByContractTx(
  tx: Db,
  realmId: string,
  rows: readonly Company[],
  nowMs: number
): Promise<Set<string>> {
  const buyers = new Map(rows.map((r) => [r.id, r.subIndustryKey]));
  const contracts = await tx.contract.findMany({
    where: {
      realmId,
      type: "B2B",
      status: "COMPLETED",
      closedIxTime: { gte: nowMs - UPSTREAM_WINDOW_MS },
      issuerCompanyId: { in: [...buyers.keys()] },
      winnerCompanyId: { not: null },
    },
    select: { issuerCompanyId: true, winnerCompanyId: true },
  });
  const supplierIds = contracts.flatMap((k) => (k.winnerCompanyId ? [k.winnerCompanyId] : []));
  if (supplierIds.length === 0) return new Set();
  const suppliers = new Map(
    (
      await tx.company.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, subIndustryKey: true },
      })
    ).map((s) => [s.id, s.subIndustryKey])
  );
  const supplied = new Set<string>();
  for (const k of contracts) {
    const buyer = k.issuerCompanyId ? buyers.get(k.issuerCompanyId) : undefined;
    const supplier = k.winnerCompanyId ? suppliers.get(k.winnerCompanyId) : undefined;
    if (k.issuerCompanyId && buyer && supplier && isUpstreamOf(buyer, supplier)) {
      supplied.add(k.issuerCompanyId);
    }
  }
  return supplied;
}

async function realmContextTx(
  tx: Db,
  realmId: string,
  rows: readonly Company[],
  nowMs: number
): Promise<RealmContext> {
  const indices = await tx.sectorIndex.findMany({
    where: { realmId },
    select: { sectorKey: true, value: true },
  });
  const hqIds = rows.flatMap((r) => (r.hqCountryId ? [r.hqCountryId] : []));
  const macros = await loadMacros(tx, hqIds);
  const terms = await lendingTermsFor(tx, hqIds);
  const suppliedByContract = await suppliedByContractTx(tx, realmId, rows, nowMs);
  return {
    realmId,
    tickKey: operatingTickKey(nowMs),
    nowMs,
    indexOf: new Map(indices.map((i) => [i.sectorKey, i.value])),
    macros,
    terms,
    realmSubIndustries: rows.map((r) => r.subIndustryKey),
    suppliedByContract,
  };
}

/** Everything a company owes this tick except its share of the revenue budget. */
function draftOf(c: Company, ctx: RealmContext): Draft | null {
  const sub = SUB_INDUSTRIES.find((s) => s.key === c.subIndustryKey);
  if (!sub) return null;
  const macro = c.hqCountryId ? (ctx.macros.get(c.hqCountryId) ?? null) : null;
  const base = productiveBaseOf(c);
  const advantage = macro && isSectorKey(c.sectorKey) ? sectorAdvantageOf(macro, c.sectorKey) : 0;
  const supply = supplyChainFactor(c.subIndustryKey, ctx.realmSubIndustries, {
    recentUpstreamContract: ctx.suppliedByContract.has(c.id),
  });
  const gross =
    ((base * sub.baseMargin) / TICKS_PER_DAY) *
    sectorFactorOf(ctx.indexOf.get(c.sectorKey) ?? INDEX_BASE) *
    hqDemandFactorOf(macro?.growth ?? null, advantage) *
    supply *
    pricingFactorOf(c.pricingStrategy, c.standing);
  const inflation = macro?.inflation ?? 0;
  const upkeep =
    ((base * sub.upkeepRate) / TICKS_PER_DAY) * (1 + Math.max(0, inflation - INFLATION_FLOOR));
  const spread = c.hqCountryId ? (ctx.terms.get(c.hqCountryId)?.spread ?? 0) : 0;
  const rate = macro ? borrowRateOf(macro.interestRate, c.creditRating, spread) : 0;
  const interest = (c.creditDrawn * rate) / (DAYS_PER_YEAR * TICKS_PER_DAY);
  const relief = c.lobbyBuffType === "tax_relief" && (c.lobbyBuffUntilIxTime ?? 0) > ctx.nowMs;
  return {
    company: c,
    hq: macro ? c.hqCountryId : null,
    taxRate: macro ? macro.corporateTaxRate * (relief ? TAX_RELIEF_FACTOR : 1) : 0,
    grossCents: gross * 100,
    upkeepCents: Math.round(upkeep * 100),
    interestCents: Math.round(interest * 100),
  };
}

function planOf(d: Draft, revenueCents: number): CompanyPlan {
  const pretax = revenueCents - d.upkeepCents - d.interestCents;
  const taxCents = pretax > 0 ? Math.floor(pretax * d.taxRate + EPS_CENTS) : 0;
  return { ...d, revenueCents, taxCents };
}

/** Send a charge to the HQ treasury. Nothing moves when there is no HQ or nothing to pay. */
async function remitTx(
  tx: Db,
  c: Company,
  hq: string | null,
  cents: number,
  type: Extract<TreasuryInflowType, "INTEREST" | "TAX">,
  source: string,
  key: string
): Promise<void> {
  if (!hq || cents <= 0) return;
  await transferToTreasuryTx(tx, {
    from: { kind: "COMPANY", companyId: c.id },
    countryId: hq,
    realmId: c.realmId,
    amount: fromCents(cents),
    type,
    source,
    key,
  });
}

/**
 * Settle one company's tick: pay upkeep (burned), interest and tax from its capital in that
 * order, capitalise any unpaid interest into the credit line, then move its status.
 */
async function settleTx(
  tx: Db,
  plan: CompanyPlan,
  ctx: RealmContext,
  notices: ExchangeNotice[]
): Promise<DistressAction> {
  const c = plan.company;
  const key = `op:${ctx.realmId}:${ctx.tickKey}:${c.id}`;
  let cash = toCents(c.capital) + plan.revenueCents;
  await setCapitalTx(tx, c.id, cash);

  const upkeepPaid = Math.min(plan.upkeepCents, cash);
  cash -= upkeepPaid;
  await setCapitalTx(tx, c.id, cash);

  const interestPaid = Math.min(plan.interestCents, cash);
  await remitTx(
    tx,
    c,
    plan.hq,
    interestPaid,
    "INTEREST",
    `OPERATING_INTEREST:${c.id}`,
    `${key}:interest`
  );
  cash -= interestPaid;
  await setCapitalTx(tx, c.id, cash);

  const taxPaid = Math.min(plan.taxCents, cash);
  await remitTx(tx, c, plan.hq, taxPaid, "TAX", `CORPORATE_TAX:${c.id}`, `${key}:tax`);
  cash -= taxPaid;
  await setCapitalTx(tx, c.id, cash);

  const interestUnpaid = plan.interestCents - interestPaid;
  const unpaid =
    plan.upkeepCents - upkeepPaid > 0 || interestUnpaid > 0 || plan.taxCents - taxPaid > 0;
  const creditDrawn = c.creditDrawn + fromCents(interestUnpaid);
  const netCents = plan.revenueCents - plan.upkeepCents - plan.interestCents - plan.taxCents;
  const capital = fromCents(cash);
  const rating = creditRatingFor({
    standing: c.standing,
    debtToEquity: creditDrawn / Math.max(1, capital + c.decisionValue),
    lastTickNetIncome: fromCents(netCents),
  });
  await tx.company.update({
    where: { id: c.id },
    data: {
      lastTickRevenue: fromCents(plan.revenueCents),
      lastTickExpenses: fromCents(plan.upkeepCents + plan.interestCents),
      lastTickTax: fromCents(plan.taxCents),
      lastTickNetIncome: fromCents(netCents),
      creditDrawn: { increment: fromCents(interestUnpaid) },
      creditRating: rating,
    },
  });

  const action = distressDecision({
    status: c.status,
    distressedSinceIxTime: c.distressedSinceIxTime,
    unpaid,
    capital,
    creditDrawn,
    creditLimit: creditLimitFor(c, c.hqCountryId ? ctx.terms.get(c.hqCountryId)?.cap : undefined),
    nowMs: ctx.nowMs,
  });
  await applyDistressTx(
    tx,
    action,
    {
      company: c,
      hq: plan.hq,
      cashCents: cash,
      creditDrawn,
      tickKey: ctx.tickKey,
      nowMs: ctx.nowMs,
    },
    notices
  );
  return action;
}

/** Run one realm's tick inside the caller's transaction. */
async function operateRealmTx(tx: Db, realmId: string, nowMs: number): Promise<RealmOutcome> {
  const cfg = await getExchangeConfig(tx);
  const candidates = await tx.company.findMany({
    where: { realmId, status: { in: OPERATING_STATUSES } },
    select: { id: true },
  });
  if (candidates.length === 0) return IDLE;
  const ids = candidates.map((c) => c.id).sort();
  for (const id of ids) await lockCompany(tx, id);
  const rows = (await tx.company.findMany({ where: { id: { in: ids } } })).filter((r) =>
    OPERATING_STATUSES.includes(r.status)
  );
  if (rows.length === 0) return IDLE;

  const ctx = await realmContextTx(tx, realmId, rows, nowMs);
  const drafts = rows.flatMap((r) => {
    const draft = draftOf(r, ctx);
    return draft ? [draft] : [];
  });
  const revenues = scaledRevenuesCents(
    drafts.map((d) => d.grossCents),
    Math.floor(cfg.realmOperatingBudget * 100)
  );
  const plans = drafts.map((d, i) => planOf(d, revenues[i] ?? 0));
  const claimed = await mintOperatingRevenueTx(tx, {
    realmId,
    tickKey: ctx.tickKey,
    nowMs,
    mints: plans
      .filter((p) => p.revenueCents > 0)
      .map((p) => ({ companyId: p.company.id, amount: fromCents(p.revenueCents) })),
  });
  if (!claimed) return { ...IDLE, skipped: true };

  const outcome: RealmOutcome = { ...IDLE, notices: [], companies: plans.length };
  for (const plan of plans) {
    outcome.mintedCents += plan.revenueCents;
    const action = await settleTx(tx, plan, ctx, outcome.notices);
    if (action === "DISTRESS") outcome.distressed++;
    if (action === "BANKRUPT") outcome.bankrupt++;
  }
  return outcome;
}

/**
 * Run every realm's company operations for the tick at `nowMs`. Each realm is its own
 * transaction and its notices go out after it commits. A realm that fails is logged and the
 * rest still run.
 */
export async function runCompanyOperations(
  db: PrismaClient,
  nowMs: number = Date.now()
): Promise<OperationsSummary> {
  const summary: OperationsSummary = {
    realms: 0,
    skippedRealms: 0,
    companies: 0,
    revenueMinted: 0,
    distressed: 0,
    bankrupt: 0,
  };
  const realms = await db.company.findMany({
    where: { status: { in: OPERATING_STATUSES } },
    distinct: ["realmId"],
    select: { realmId: true },
  });
  for (const { realmId } of realms) {
    try {
      const outcome = await db.$transaction((tx) => operateRealmTx(tx, realmId, nowMs), {
        timeout: REALM_TX_TIMEOUT_MS,
      });
      notifyExchange(outcome.notices);
      summary.realms++;
      if (outcome.skipped) summary.skippedRealms++;
      summary.companies += outcome.companies;
      summary.revenueMinted += outcome.mintedCents / 100;
      summary.distressed += outcome.distressed;
      summary.bankrupt += outcome.bankrupt;
    } catch (error) {
      console.error(`[Exchange] company operations in realm ${realmId} failed:`, error);
    }
  }
  summary.revenueMinted = round2(summary.revenueMinted);
  return summary;
}
