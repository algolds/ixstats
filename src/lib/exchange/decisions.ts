/**
 * Company decisions. Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 *
 * A founder queues one strategic decision at a time. Its cost leaves the company's capital
 * at once and the `exchange-market` job applies the effect once a real day has passed.
 * A queued decision can't be withdrawn.
 *   EXPAND: fair value rises by the amount invested (`Company.decisionValue`). Burned.
 *   ENTER_SECTOR: the company moves to another sector and sub-industry. Burned.
 *   RND: the spend becomes productive plant, either steadily (efficiency) or as a roll
 *     that can pay off many times over (breakthrough). Burned.
 *   LOBBY: a buff for 14 days. Half the cost goes into the HQ nation's treasury, so policy
 *     spending reaches the state; the rest is burned. Without an HQ it is all burned.
 *   PRICE: changes the company's pricing strategy. Burned.
 *   ACQUIRE: an offer for another company. The offer is escrowed in the decision until the target's
 *     shareholders vote on it; a refused, expired or impossible offer goes back to capital.
 * The breakthrough roll hashes the decision id, so a decision always resolves the same way.
 * Every decision is keyed on its requestId: a retry returns the decision it first created, whenever
 * that decision was made.
 */

import type { CompanyDecision, Prisma, PrismaClient } from "@prisma/client";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { SECTOR_KEYS, refreshFairValue, requireOwnedCompany, type SectorKey } from "./companies";
import { DAY_MS } from "./contracts";
import { assertExchangeOpen, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { lockCompany } from "./ownership";
import { formatSovereigns, round2 } from "./amounts";
import { subIndustriesOf, type SubIndustryKey } from "./taxonomy";
import { macroOfCountry } from "./tariffs";
import { transferToTreasuryTx } from "./treasury";
import { acquisitionBlocker } from "./acquisition";
import { resolveAcquireDecision } from "./governance";

export const DECISION_TYPES = [
  "EXPAND",
  "ENTER_SECTOR",
  "RND",
  "LOBBY",
  "PRICE",
  "ACQUIRE",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const RND_FOCI = ["efficiency", "breakthrough"] as const;
export type RndFocus = (typeof RND_FOCI)[number];

export const LOBBY_TARGETS = ["sector", "b2g", "tax_relief"] as const;
export type LobbyTarget = (typeof LOBBY_TARGETS)[number];

export const PRICING_STRATEGIES = ["undercut", "balanced", "premium"] as const;
export type PricingStrategy = (typeof PRICING_STRATEGIES)[number];

export const ENTER_SECTOR_COST = 500;
export const EXPAND_MIN = 100;
export const EXPAND_MAX = 1_000_000;
export const RND_MIN = 250;
export const RND_MAX = 250_000;
export const LOBBY_COST = 500;
export const PRICE_COST = 200;
export const ACQUIRE_MIN = 100;
export const ACQUIRE_MAX = 10_000_000;
/** Real days a LOBBY buff lasts once its decision resolves. */
export const LOBBY_BUFF_DAYS = 14;
/** Real days between queuing a decision and the job applying it. */
export const DECISION_DELAY_DAYS = 1;

const RND_EFFICIENCY_MULTIPLIER = 1.15;
const RND_EFFICIENCY_STANDING = 1;
/** Each breakthrough outcome pays this multiple of the amount, with this much standing. */
const BREAKTHROUGHS = {
  low: { multiplier: 0.6, standing: 1 },
  mid: { multiplier: 1.35, standing: 2 },
  top: { multiplier: 2.1, standing: 3 },
};
const LOW_ODDS = 0.5;
const TOP_ODDS = 0.15;
const NEUTRAL_EFFICIENCY = 0.5;
/**
 * How far the HQ's government efficiency moves the odds. At the extremes (0 or 1) the low
 * band shifts by 10 points, which is why the swing is 0.2 around the neutral point.
 */
const EFFICIENCY_SWING = 0.2;

interface DecisionPayload {
  requestId: string;
  cost: number;
  amount?: number;
  focus?: RndFocus;
  sectorKey?: SectorKey;
  subIndustryKey?: SubIndustryKey;
  target?: LobbyTarget;
  strategy?: PricingStrategy;
  targetCompanyId?: string;
  offerAmount?: number;
}

type DecisionEffect = Record<string, string | number>;

export interface SubmitDecisionInput {
  userId: string;
  companyId: string;
  type: DecisionType;
  /** EXPAND and RND: ₷ to invest. */
  amount?: number;
  /** RND: efficiency adds steadily; breakthrough is a roll. */
  focus?: RndFocus;
  /** ENTER_SECTOR: the new sector. */
  sectorKey?: SectorKey;
  /** ENTER_SECTOR: one of the new sector's sub-industries; defaults to its first. */
  subIndustryKey?: SubIndustryKey;
  /** LOBBY: which buff to buy. */
  target?: LobbyTarget;
  /** PRICE: the new pricing strategy. */
  strategy?: PricingStrategy;
  /** ACQUIRE: the company to buy. */
  targetCompanyId?: string;
  /** ACQUIRE: the offer in ₷, escrowed from capital until the shareholders decide. */
  offerAmount?: number;
  requestId: string;
}

function wholeAmount(amount: number, min: number, max: number, verb: string): number {
  if (!Number.isInteger(amount) || amount < min || amount > max) {
    throw new ExchangeError(
      "INVALID_AMOUNT",
      `${verb} a whole ${formatSovereigns(min)} to ${formatSovereigns(max)}`
    );
  }
  return amount;
}

function choice<T extends string>(value: T | undefined, options: readonly T[], message: string): T {
  if (!value || !options.includes(value)) throw new ExchangeError("INVALID_AMOUNT", message);
  return value;
}

function enterSectorPayload(input: SubmitDecisionInput, currentSector: string): DecisionPayload {
  const sectorKey = choice(input.sectorKey, SECTOR_KEYS, "Choose a sector to enter");
  if (sectorKey === currentSector) {
    throw new ExchangeError("CONFLICT", "The company is already in that sector");
  }
  const subs = subIndustriesOf(sectorKey).map((sub) => sub.key);
  const subIndustryKey = input.subIndustryKey ?? subs[0];
  if (!subIndustryKey || !subs.includes(subIndustryKey)) {
    throw new ExchangeError("INVALID_AMOUNT", "That sub-industry isn't part of the sector");
  }
  return {
    requestId: input.requestId,
    cost: ENTER_SECTOR_COST,
    sectorKey,
    subIndustryKey,
  };
}

/** The payload a decision is queued with, and the cost it charges. Throws on bad input. */
function payloadFor(input: SubmitDecisionInput, currentSector: string): DecisionPayload {
  const { requestId } = input;
  switch (input.type) {
    case "EXPAND": {
      const amount = wholeAmount(input.amount ?? 0, EXPAND_MIN, EXPAND_MAX, "Invest");
      return { requestId, cost: amount, amount };
    }
    case "RND": {
      const amount = wholeAmount(input.amount ?? 0, RND_MIN, RND_MAX, "Put");
      const focus = choice(input.focus, RND_FOCI, "Choose efficiency or breakthrough");
      return { requestId, cost: amount, amount, focus };
    }
    case "ENTER_SECTOR":
      return enterSectorPayload(input, currentSector);
    case "LOBBY": {
      const target = choice(input.target, LOBBY_TARGETS, "Choose what the lobbying targets");
      return { requestId, cost: LOBBY_COST, target };
    }
    case "PRICE": {
      const strategy = choice(input.strategy, PRICING_STRATEGIES, "Choose a pricing strategy");
      return { requestId, cost: PRICE_COST, strategy };
    }
    case "ACQUIRE": {
      const offerAmount = wholeAmount(input.offerAmount ?? 0, ACQUIRE_MIN, ACQUIRE_MAX, "Offer");
      if (!input.targetCompanyId) {
        throw new ExchangeError("INVALID_AMOUNT", "Choose the company to buy");
      }
      return {
        requestId,
        cost: offerAmount,
        offerAmount,
        targetCompanyId: input.targetCompanyId,
      };
    }
  }
}

interface ChargeTarget {
  id: string;
  realmId: string;
  hqCountryId: string | null;
}

/**
 * Take the cost from capital. A LOBBY with an HQ sends half to that nation's treasury as a
 * transfer; the rest is burned. An ACQUIRE offer isn't burned: it stays in the decision payload
 * until its proposal settles. The debit is conditional, so capital never goes negative.
 */
async function chargeCost(
  tx: Db,
  company: ChargeTarget,
  type: DecisionType,
  payload: DecisionPayload
): Promise<void> {
  const hq = type === "LOBBY" ? company.hqCountryId : null;
  const toTreasury = hq ? round2(payload.cost / 2) : 0;
  if (hq) {
    await transferToTreasuryTx(tx, {
      from: { kind: "COMPANY", companyId: company.id },
      countryId: hq,
      realmId: company.realmId,
      amount: toTreasury,
      type: "LOBBY",
      source: `LOBBY:${company.id}`,
      key: `exchange:decision:${company.id}:${payload.requestId}`,
    });
  }
  const burned = round2(payload.cost - toTreasury);
  const { count } = await tx.company.updateMany({
    where: { id: company.id, status: "ACTIVE", capital: { gte: burned } },
    data: { capital: { decrement: burned } },
  });
  if (count !== 1) {
    throw new ExchangeError("INSUFFICIENT_SOVEREIGNS", "The company's capital doesn't cover it");
  }
}

/**
 * The decision a company already queued under this requestId, applied or not. The payload is
 * filtered in code because the fake client can't match inside JSON.
 */
async function decisionForRequest(
  tx: Db,
  companyId: string,
  requestId: string
): Promise<CompanyDecision | null> {
  const decisions = await tx.companyDecision.findMany({ where: { companyId } });
  return (
    decisions.find((d) => (d.payload as DecisionPayload | null)?.requestId === requestId) ?? null
  );
}

/** Queue a decision and pay its cost from capital. One pending decision per company. */
export async function submitDecision(db: PrismaClient, input: SubmitDecisionInput) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await lockCompany(tx, input.companyId);
    const company = await requireOwnedCompany(tx, input.companyId, input.userId);
    const earlier = await decisionForRequest(tx, company.id, input.requestId);
    if (earlier) return { decision: earlier, alreadyApplied: true };
    const pending = await tx.companyDecision.findFirst({
      where: { companyId: company.id, appliedIxTime: null },
    });
    if (pending) {
      throw new ExchangeError("CONFLICT", "This company already has a decision pending");
    }
    const payload = payloadFor(input, company.sectorKey);
    if (input.type === "ACQUIRE") {
      const blocked = await acquisitionBlocker(
        tx,
        company,
        payload.targetCompanyId ?? "",
        payload.offerAmount ?? 0
      );
      if (blocked) throw new ExchangeError("CONFLICT", blocked);
    }
    await chargeCost(tx, company, input.type, payload);
    const decision = await tx.companyDecision.create({
      data: {
        companyId: company.id,
        type: input.type,
        payload: { ...payload },
        submittedIxTime: Date.now(),
      },
    });
    await refreshFairValue(tx, company.id);
    return { decision, alreadyApplied: false };
  });
}

/** FNV-1a over the id, mapped to [0, 1). The same id always rolls the same number. */
function rollFor(decisionId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < decisionId.length; i++) {
    hash ^= decisionId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

/** The HQ's government efficiency (0..1), or the neutral point when there is no HQ. */
async function efficiencyOf(tx: Db, countryId: string | null): Promise<number> {
  if (!countryId) return NEUTRAL_EFFICIENCY;
  const macro = await macroOfCountry(tx, countryId);
  return macro?.governmentEfficiency ?? NEUTRAL_EFFICIENCY;
}

function breakthroughFor(roll: number, efficiency: number) {
  const lift = (efficiency - NEUTRAL_EFFICIENCY) * EFFICIENCY_SWING;
  if (roll < LOW_ODDS - lift) return BREAKTHROUGHS.low;
  if (roll < 1 - (TOP_ODDS + lift / 2)) return BREAKTHROUGHS.mid;
  return BREAKTHROUGHS.top;
}

interface Settlement {
  effect: DecisionEffect;
  data: Prisma.CompanyUpdateInput;
  message: string;
}

async function rndSettlement(
  tx: Db,
  company: { hqCountryId: string | null },
  decisionId: string,
  payload: Partial<DecisionPayload>
): Promise<Settlement> {
  const amount = payload.amount ?? 0;
  if (payload.focus === "efficiency") {
    const gain = round2(RND_EFFICIENCY_MULTIPLIER * amount);
    return {
      effect: {
        focus: "efficiency",
        decisionValueDelta: gain,
        standingDelta: RND_EFFICIENCY_STANDING,
      },
      data: {
        decisionValue: { increment: gain },
        standing: { increment: RND_EFFICIENCY_STANDING },
      },
      message: `Research added ${formatSovereigns(gain)} of productive plant.`,
    };
  }
  const roll = rollFor(decisionId);
  const efficiency = await efficiencyOf(tx, company.hqCountryId);
  const tier = breakthroughFor(roll, efficiency);
  const gain = round2(tier.multiplier * amount);
  return {
    effect: {
      focus: "breakthrough",
      roll,
      efficiency,
      multiplier: tier.multiplier,
      decisionValueDelta: gain,
      standingDelta: tier.standing,
    },
    data: {
      decisionValue: { increment: gain },
      standing: { increment: tier.standing },
    },
    message: `Research broke through: ${formatSovereigns(gain)} of productive plant.`,
  };
}

/** What a due decision does to its company once applied. Null when the row can't be applied. */
async function settle(
  tx: Db,
  company: { hqCountryId: string | null },
  decision: CompanyDecision,
  nowMs: number
): Promise<Settlement | null> {
  const payload: Partial<DecisionPayload> = (decision.payload as DecisionPayload | null) ?? {};
  switch (decision.type) {
    case "EXPAND": {
      const amount = payload.amount ?? 0;
      return {
        effect: { fairValue: amount },
        data: { decisionValue: { increment: amount } },
        message: `The expansion added ${formatSovereigns(amount)} to its fair value.`,
      };
    }
    case "ENTER_SECTOR": {
      if (!payload.sectorKey || !payload.subIndustryKey) return null;
      return {
        effect: { sectorKey: payload.sectorKey, subIndustryKey: payload.subIndustryKey },
        data: { sectorKey: payload.sectorKey, subIndustryKey: payload.subIndustryKey },
        message: `It now operates in ${payload.sectorKey}.`,
      };
    }
    case "RND":
      return rndSettlement(tx, company, decision.id, payload);
    case "LOBBY": {
      if (!payload.target) return null;
      const until = nowMs + LOBBY_BUFF_DAYS * DAY_MS;
      return {
        effect: { buffType: payload.target, buffUntilIxTime: until },
        data: { lobbyBuffType: payload.target, lobbyBuffUntilIxTime: until },
        message: `Lobbying for ${payload.target} is in effect for ${LOBBY_BUFF_DAYS} days.`,
      };
    }
    case "PRICE": {
      if (!payload.strategy) return null;
      return {
        effect: { strategy: payload.strategy },
        data: { pricingStrategy: payload.strategy },
        message: `Pricing is now ${payload.strategy}.`,
      };
    }
    default:
      return null;
  }
}

async function applyDueDecision(
  tx: Db,
  decision: CompanyDecision,
  nowMs: number,
  notices: ExchangeNotice[]
): Promise<boolean> {
  if (decision.type === "ACQUIRE") {
    const { count } = await tx.companyDecision.updateMany({
      where: { id: decision.id, appliedIxTime: null },
      data: { appliedIxTime: nowMs },
    });
    if (count !== 1) return false;
    await resolveAcquireDecision(tx, decision, nowMs, notices);
    return true;
  }
  const company = await tx.company.findUnique({
    where: { id: decision.companyId },
    select: { id: true, name: true, founderId: true, status: true, hqCountryId: true },
  });
  if (company?.status === "DISTRESSED") return false;
  const { count } = await tx.companyDecision.updateMany({
    where: { id: decision.id, appliedIxTime: null },
    data: { appliedIxTime: nowMs },
  });
  if (count !== 1) return false;
  if (!company || company.status !== "ACTIVE") return true;
  const settled = await settle(tx, company, decision, nowMs);
  if (!settled) return true;
  await tx.companyDecision.update({
    where: { id: decision.id },
    data: { effect: settled.effect },
  });
  await tx.company.update({ where: { id: company.id }, data: settled.data });
  await refreshFairValue(tx, company.id);
  notices.push({
    userId: company.founderId,
    title: `${company.name}: decision applied`,
    message: settled.message,
    priority: "low",
  });
  return true;
}

/**
 * Apply every decision queued at least DECISION_DELAY_DAYS ago. Each is claimed with a
 * conditional update on `appliedIxTime IS NULL`, so a re-run applies nothing twice.
 */
export async function resolveDueDecisions(
  db: PrismaClient,
  nowMs: number = Date.now()
): Promise<number> {
  const cutoff = nowMs - DECISION_DELAY_DAYS * DAY_MS;
  const due = await db.companyDecision.findMany({
    where: { appliedIxTime: null, submittedIxTime: { lte: cutoff } },
    take: 500,
  });
  let applied = 0;
  for (const decision of due) {
    const notices: ExchangeNotice[] = [];
    const done = await db.$transaction((tx) => applyDueDecision(tx, decision, nowMs, notices));
    if (done) applied++;
    notifyExchange(notices);
  }
  return applied;
}

/** A company's decisions, newest first. */
export async function listDecisions(db: Db, companyId: string) {
  return db.companyDecision.findMany({
    where: { companyId },
    orderBy: { submittedIxTime: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      payload: true,
      effect: true,
      appliedIxTime: true,
      createdAt: true,
    },
  });
}
