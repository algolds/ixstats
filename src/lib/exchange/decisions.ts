/**
 * Company decisions (modest version). Spec: docs/specs/2026-10-06-exchange-economy-design.md §8.
 *
 * A founder queues one strategic decision at a time; its cost leaves the company's capital
 * at once (burned: a ₷ sink) and the `exchange-market` job applies it once a real day has
 * passed. Effects are fixed, never random:
 *   EXPAND (cost: the amount chosen, 100 to 1,000,000 ₷): fair value rises by that amount
 *     (`Company.decisionValue`, weighted by `valuationDecisionWeight`). Capital becomes
 *     plant: it no longer counts as cash, can't be withdrawn or paid out, but keeps its worth
 *     in the valuation.
 *   ENTER_SECTOR (cost: 500 ₷): the company moves to another sector, which changes the index
 *     its fair value follows and where its activity counts.
 * The schema's other types (RND, ACQUIRE, LOBBY, PRICE) are not built: each needs a
 * mechanic the Exchange doesn't have yet (research trees, mergers, policy hooks, pricing).
 * A queued decision can't be withdrawn.
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { SECTOR_KEYS, refreshFairValue, requireOwnedCompany, type SectorKey } from "./companies";
import { DAY_MS } from "./contracts";
import { assertExchangeOpen, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { lockCompany } from "./ownership";
import { formatSovereigns } from "./quote";

export const DECISION_TYPES = ["EXPAND", "ENTER_SECTOR"] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const ENTER_SECTOR_COST = 500;
export const EXPAND_MIN = 100;
export const EXPAND_MAX = 1_000_000;
/** Real days between queuing a decision and the job applying it. */
export const DECISION_DELAY_DAYS = 1;

interface DecisionPayload {
  requestId: string;
  cost: number;
  amount?: number;
  sectorKey?: SectorKey;
}

export interface SubmitDecisionInput {
  userId: string;
  companyId: string;
  type: DecisionType;
  /** EXPAND: ₷ to invest. */
  amount?: number;
  /** ENTER_SECTOR: the new sector. */
  sectorKey?: SectorKey;
  requestId: string;
}

function costOf(input: SubmitDecisionInput, currentSector: string): DecisionPayload {
  if (input.type === "EXPAND") {
    const amount = input.amount ?? 0;
    if (!Number.isInteger(amount) || amount < EXPAND_MIN || amount > EXPAND_MAX) {
      throw new ExchangeError(
        "INVALID_AMOUNT",
        `Invest a whole ${formatSovereigns(EXPAND_MIN)} to ${formatSovereigns(EXPAND_MAX)}`
      );
    }
    return { requestId: input.requestId, cost: amount, amount };
  }
  const sectorKey = input.sectorKey;
  if (!sectorKey || !SECTOR_KEYS.includes(sectorKey)) {
    throw new ExchangeError("INVALID_AMOUNT", "Choose a sector to enter");
  }
  if (sectorKey === currentSector) {
    throw new ExchangeError("CONFLICT", "The company is already in that sector");
  }
  return { requestId: input.requestId, cost: ENTER_SECTOR_COST, sectorKey };
}

/** Queue a decision and pay its cost from capital. One pending decision per company. */
export async function submitDecision(db: PrismaClient, input: SubmitDecisionInput) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await lockCompany(tx, input.companyId);
    const company = await requireOwnedCompany(tx, input.companyId, input.userId);
    const pending = await tx.companyDecision.findFirst({
      where: { companyId: company.id, appliedIxTime: null },
    });
    if (pending) {
      if ((pending.payload as DecisionPayload | null)?.requestId === input.requestId) {
        return { decision: pending, alreadyApplied: true };
      }
      throw new ExchangeError("CONFLICT", "This company already has a decision pending");
    }
    const payload = costOf(input, company.sectorKey);
    const { count } = await tx.company.updateMany({
      where: { id: company.id, status: "ACTIVE", capital: { gte: payload.cost } },
      data: { capital: { decrement: payload.cost } },
    });
    if (count !== 1) {
      throw new ExchangeError("INSUFFICIENT_SOVEREIGNS", "The company's capital doesn't cover it");
    }
    const decision = await tx.companyDecision.create({
      data: {
        companyId: company.id,
        type: input.type,
        payload: { ...payload },
        submittedIxTime: IxTime.getCurrentIxTime(),
      },
    });
    await refreshFairValue(tx, company.id);
    return { decision, alreadyApplied: false };
  });
}

/**
 * Apply every decision queued at least DECISION_DELAY_DAYS ago. Each is claimed with a
 * conditional update on `appliedIxTime IS NULL`, so a re-run applies nothing twice.
 */
export async function resolveDueDecisions(
  db: PrismaClient,
  nowIx: number = IxTime.getCurrentIxTime()
): Promise<number> {
  const cutoff = nowIx - DECISION_DELAY_DAYS * DAY_MS * IxTime.getTimeMultiplier();
  const due = await db.companyDecision.findMany({
    where: { appliedIxTime: null, submittedIxTime: { lte: cutoff } },
    take: 500,
  });
  let applied = 0;
  for (const d of due) {
    const notices: ExchangeNotice[] = [];
    const done = await db.$transaction(async (tx) => {
      const payload = (d.payload ?? {}) as unknown as DecisionPayload;
      const effect =
        d.type === "EXPAND"
          ? { fairValue: payload.amount ?? 0 }
          : { sectorKey: payload.sectorKey ?? null };
      const { count } = await tx.companyDecision.updateMany({
        where: { id: d.id, appliedIxTime: null },
        data: { appliedIxTime: nowIx, effect },
      });
      if (count !== 1) return false;
      const company = await tx.company.findUnique({
        where: { id: d.companyId },
        select: { id: true, name: true, founderId: true, status: true },
      });
      if (!company || company.status !== "ACTIVE") return true;
      if (d.type === "EXPAND" && payload.amount) {
        await tx.company.update({
          where: { id: company.id },
          data: { decisionValue: { increment: payload.amount } },
        });
      } else if (d.type === "ENTER_SECTOR" && payload.sectorKey) {
        await tx.company.update({
          where: { id: company.id },
          data: { sectorKey: payload.sectorKey },
        });
      }
      await refreshFairValue(tx, company.id);
      notices.push({
        userId: company.founderId,
        title: `${company.name}: decision applied`,
        message:
          d.type === "EXPAND"
            ? `The expansion added ${formatSovereigns(payload.amount ?? 0)} to its fair value.`
            : `It now operates in ${payload.sectorKey ?? "a new sector"}.`,
        priority: "low",
      });
      return true;
    });
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
