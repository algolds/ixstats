/**
 * The distress and bankruptcy lifecycle of an Exchange company whose charges go unpaid, and the
 * liquidation that ends it. Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 *
 * Company status moves only along these transitions:
 *
 * | From       | To         | When                                                                   |
 * | ---------- | ---------- | ---------------------------------------------------------------------- |
 * | ACTIVE     | DISTRESSED | a tick leaves a charge unpaid, or the credit line is over its limit    |
 * | DISTRESSED | ACTIVE     | a tick or a repayment finds nothing unpaid and the debt within limit   |
 * | DISTRESSED | BANKRUPT   | still distressed 72 real hours after it began, on a tick: liquidated   |
 *
 * DELISTED comes from dissolution and M&A, which live in companies.ts and acquisition.ts.
 *
 * Liquidation sells the plant to the HQ treasury for what the treasury holds, up to its recovery
 * value, so a short treasury recovers less rather than failing the tick. The lender is paid from
 * what is left, and the holders split the rest in whole cents.
 */

import type { Company, Prisma } from "@prisma/client";
import { ExchangeError, earnSovereignsTx } from "~/lib/vault/exchange-service";
import { formatSovereigns } from "./amounts";
import { refreshFairValue, returnListedShares } from "./companies";
import type { Db } from "./guards";
import type { ExchangeNotice } from "./notify";
import { fromCents, holdersOf, splitProRata, type Holder } from "./ownership";
import { returnBuyOrders } from "./shares";
import { debitTreasuryTx, transferToTreasuryTx } from "./treasury";

const HOUR_MS = 60 * 60 * 1000;
export const DISTRESS_GRACE_MS = 72 * HOUR_MS;
const PLANT_RECOVERY_RATE = 0.4;
const EPS = 1e-9;

export type DistressAction = "NONE" | "DISTRESS" | "CURE" | "BANKRUPT";

export interface DistressState {
  status: string;
  distressedSinceIxTime: number | null;
  /** A charge (upkeep, interest or tax) could not be paid in full this tick. */
  unpaid: boolean;
  capital: number;
  creditDrawn: number;
  creditLimit: number;
  nowMs: number;
}

export interface LifecycleInput {
  company: Company;
  hq: string | null;
  /** The company's capital after this tick's charges, in whole cents. */
  cashCents: number;
  creditDrawn: number;
  tickKey: string;
  nowMs: number;
}

/**
 * What a company's status does on this tick. A company that was healthy stays so, one that was
 * not becomes DISTRESSED, and a DISTRESSED company is cured once nothing is unpaid, or taken into
 * liquidation once its grace has run out while still unsound.
 */
export function distressDecision(s: DistressState): DistressAction {
  const unsound = s.unpaid || s.capital < 0 || s.creditDrawn > s.creditLimit + EPS;
  if (s.status === "ACTIVE") return unsound ? "DISTRESS" : "NONE";
  if (s.status !== "DISTRESSED") return "NONE";
  if (!unsound) return "CURE";
  const overdue =
    s.distressedSinceIxTime !== null && s.nowMs - s.distressedSinceIxTime >= DISTRESS_GRACE_MS;
  return overdue ? "BANKRUPT" : "NONE";
}

/** Write a company's capital as a whole-cent value, conditional on the value just read. */
export async function setCapitalTx(tx: Db, companyId: string, cents: number): Promise<void> {
  const current = await tx.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { capital: true },
  });
  const { count } = await tx.company.updateMany({
    where: { id: companyId, capital: current.capital },
    data: { capital: fromCents(cents) },
  });
  if (count !== 1) throw new ExchangeError("CONFLICT", "The company changed; try again");
}

/** Move a company's status from `from` to a new status, failing if it is no longer `from`. */
async function setStatusTx(
  tx: Db,
  companyId: string,
  from: string,
  data: Prisma.CompanyUpdateManyMutationInput
): Promise<void> {
  const { count } = await tx.company.updateMany({ where: { id: companyId, status: from }, data });
  if (count !== 1) throw new ExchangeError("CONFLICT", "The company changed; try again");
}

/** Apply a tick's distress decision inside the realm transaction. NONE changes nothing. */
export async function applyDistressTx(
  tx: Db,
  action: DistressAction,
  input: LifecycleInput,
  notices: ExchangeNotice[]
): Promise<void> {
  if (action === "DISTRESS") await enterDistressTx(tx, input, notices);
  else if (action === "CURE") await cureTx(tx, input.company, notices);
  else if (action === "BANKRUPT") await liquidateTx(tx, input, notices);
}

function distressNotices(c: Company, holders: readonly Holder[]): ExchangeNotice[] {
  const title = `${c.name} is in distress`;
  const message =
    "A charge went unpaid or the credit line is over its limit. Repay the credit line or deposit capital within 72 hours, or the company goes into liquidation.";
  const notices: ExchangeNotice[] = [{ userId: c.founderId, title, message, priority: "high" }];
  for (const h of holders) {
    if (h.userId !== c.founderId)
      notices.push({ userId: h.userId, title, message, priority: "high" });
  }
  return notices;
}

async function enterDistressTx(tx: Db, input: LifecycleInput, notices: ExchangeNotice[]) {
  const c = input.company;
  await setStatusTx(tx, c.id, "ACTIVE", {
    status: "DISTRESSED",
    distressedSinceIxTime: input.nowMs,
  });
  notices.push(...distressNotices(c, await holdersOf(tx, c.id)));
}

async function cureTx(tx: Db, c: Company, notices: ExchangeNotice[]) {
  await setStatusTx(tx, c.id, "DISTRESSED", { status: "ACTIVE", distressedSinceIxTime: null });
  notices.push({
    userId: c.founderId,
    title: `${c.name} is back in good standing`,
    message: "Its capital covers its charges again.",
    priority: "low",
  });
}

async function plantRecoveryCents(
  tx: Db,
  hq: string | null,
  decisionValue: number
): Promise<number> {
  if (!hq || decisionValue <= 0) return 0;
  const treasury = await tx.nationTreasury.findUnique({
    where: { countryId: hq },
    select: { balance: true },
  });
  const available = Math.max(0, Math.floor((treasury?.balance ?? 0) * 100));
  return Math.min(Math.round(decisionValue * PLANT_RECOVERY_RATE * 100), available);
}

/** The HQ treasury buys the plant. Returns the cents paid to the company. */
async function recoverPlantTx(tx: Db, input: LifecycleInput, key: string): Promise<number> {
  const c = input.company;
  const cents = await plantRecoveryCents(tx, input.hq, c.decisionValue);
  if (!input.hq || cents <= 0) return 0;
  await debitTreasuryTx(tx, {
    countryId: input.hq,
    amount: fromCents(cents),
    type: "SPEND",
    source: `PLANT_RECOVERY:${c.id}`,
    key: `${key}:plant`,
  });
  return cents;
}

/** Pay the lender from the company's cash, up to what it owes. Returns the cents paid. */
async function repayLenderTx(tx: Db, input: LifecycleInput, cashCents: number, key: string) {
  const c = input.company;
  const cents = Math.min(Math.round(input.creditDrawn * 100), cashCents);
  if (cents <= 0) return 0;
  if (input.hq) {
    await transferToTreasuryTx(tx, {
      from: { kind: "COMPANY", companyId: c.id },
      countryId: input.hq,
      realmId: c.realmId,
      amount: fromCents(cents),
      type: "INTEREST",
      source: `LIQUIDATION:${c.id}`,
      key: `${key}:lender`,
    });
  }
  return cents;
}

/** Split the cash among the holders, the founder taking the rounding remainder. */
async function payOutHoldersTx(
  tx: Db,
  c: Company,
  cashCents: number,
  notices: ExchangeNotice[]
): Promise<Map<string, number>> {
  const split = splitProRata(cashCents, await holdersOf(tx, c.id));
  const payouts = new Map(split.payouts.map((p) => [p.userId, p.cents]));
  payouts.set(c.founderId, (payouts.get(c.founderId) ?? 0) + split.remainderCents);
  for (const [userId, cents] of [...payouts].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (cents <= 0) continue;
    const founder = userId === c.founderId;
    await earnSovereignsTx(tx, {
      userId,
      amount: fromCents(cents),
      type: founder ? "COMPANY_WITHDRAW" : "DIVIDEND",
      source: `COMPANY_LIQUIDATION:${c.id}`,
      metadata: { companyId: c.id, bankruptcy: true },
      idempotencyKey: founder
        ? `exchange:bankruptcy:${c.id}`
        : `exchange:bankruptcy:${c.id}:${userId}`,
    });
    if (!founder) {
      notices.push({
        userId,
        title: `${c.name} went bankrupt`,
        message: `Your share of its liquidation, ${formatSovereigns(fromCents(cents))}, is in your wallet.`,
      });
    }
  }
  return payouts;
}

/**
 * Liquidate a company inside the realm transaction: return its listings and bids, sell its plant
 * to the HQ treasury, pay its debt to that treasury, then pay what is left to its holders.
 */
async function liquidateTx(tx: Db, input: LifecycleInput, notices: ExchangeNotice[]) {
  const c = input.company;
  const key = `op:${c.realmId}:${input.tickKey}:${c.id}:liquidation`;
  await returnListedShares(tx, c.id);
  await returnBuyOrders(tx, c.id);

  const recovered = await recoverPlantTx(tx, input, key);
  let cash = input.cashCents + recovered;
  if (recovered > 0) await setCapitalTx(tx, c.id, cash);

  const repaid = await repayLenderTx(tx, input, cash, key);
  cash -= repaid;
  if (repaid > 0) await setCapitalTx(tx, c.id, cash);

  const payouts = await payOutHoldersTx(tx, c, cash, notices);
  await setCapitalTx(tx, c.id, 0);
  await setStatusTx(tx, c.id, "DISTRESSED", {
    status: "BANKRUPT",
    creditDrawn: 0,
    decisionValue: 0,
    distressedSinceIxTime: null,
    tradingOpen: false,
  });
  await refreshFairValue(tx, c.id);
  notices.push({
    userId: c.founderId,
    title: `${c.name} went bankrupt`,
    message: `Liquidation paid ${formatSovereigns(fromCents(payouts.get(c.founderId) ?? 0))} to you.`,
    priority: "high",
  });
}
