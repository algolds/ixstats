/**
 * Acquisitions: an ACQUIRE offer that the target's shareholders approve buys the company out.
 * Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 *
 * The offer was taken from the buyer's capital when the decision was submitted, and it waits in the
 * proposal until a vote settles it. On approval it becomes the target's proceeds. The target's credit
 * line is repaid first. Whatever capital remains is paid out pro rata to the holders, or absorbed by the
 * buyer when the buyer is the only holder. The buyer takes part of the target's productive plant,
 * standing and contract record, and the target is DELISTED. A refused or expired offer goes back to the
 * buyer, so no ₷ is created or lost.
 */

import type { Company, CompanyProposal, Prisma } from "@prisma/client";
import { earnSovereignsTx, ExchangeError } from "~/lib/vault/exchange-service";
import { LIVE_CONTRACT_STATUSES, refreshFairValue, returnListedShares } from "./companies";
import { formatSovereigns, round2 } from "./amounts";
import type { Db } from "./guards";
import type { ExchangeNotice } from "./notify";
import { fromCents, holdersOf, lockCompany, splitProRata, toCents, type Holder } from "./ownership";
import { returnBuyOrders } from "./shares";
import { transferToTreasuryTx } from "./treasury";
import { publishNewsTx } from "./news";

/** Share of the target's productive plant (decisionValue) the buyer takes over. */
export const ACQUIRED_PLANT_SHARE = 0.8;
/** Share of the target's positive standing and contract record the buyer takes over. */
export const ACQUIRED_STANDING_SHARE = 0.5;

export interface AcquirePayload {
  buyerCompanyId: string;
  offerAmount: number;
}

export type AcquisitionBuyer = Pick<Company, "id" | "name" | "realmId" | "founderId" | "status">;

/** Reads the offer a proposal carries. The JSON column is untyped, so each field is coerced here. */
export function acquirePayloadOf(payload: Prisma.JsonValue): AcquirePayload {
  const record = (payload ?? {}) as Prisma.JsonObject;
  return {
    buyerCompanyId: String(record.buyerCompanyId ?? ""),
    offerAmount: Number(record.offerAmount ?? 0),
  };
}

/**
 * Why the buyer can't offer `offerAmount` for the target right now, or null when it can. Reads only, so
 * the caller decides whether a refusal throws (at submission) or hands the offer back (at resolution).
 */
export async function acquisitionBlocker(
  tx: Db,
  buyer: AcquisitionBuyer,
  targetId: string,
  offerAmount: number
): Promise<string | null> {
  if (buyer.status !== "ACTIVE" && buyer.status !== "DISTRESSED") {
    return "Only a trading company can make an offer";
  }
  const target = await tx.company.findUnique({ where: { id: targetId } });
  if (!target) return "That company doesn't exist";
  const problem = targetProblem(target, buyer, offerAmount);
  if (problem) return problem;
  if (await hasLiveContracts(tx, target.id)) return "That company has live contracts";
  const pending = await tx.companyDecision.count({
    where: { companyId: target.id, appliedIxTime: null },
  });
  return pending > 0 ? "That company has a decision pending" : null;
}

function targetProblem(
  target: Company,
  buyer: AcquisitionBuyer,
  offerAmount: number
): string | null {
  if (target.realmId !== buyer.realmId) return "That company is in another realm";
  if (target.status !== "ACTIVE" && target.status !== "DISTRESSED") {
    return "That company can't be bought";
  }
  if (target.founderId === buyer.founderId) return "You already run that company";
  if (target.creditDrawn > target.capital + offerAmount) {
    return "The offer doesn't cover that company's credit line";
  }
  return null;
}

async function hasLiveContracts(tx: Db, companyId: string): Promise<boolean> {
  const live = await tx.contract.count({
    where: {
      OR: [
        { issuerCompanyId: companyId, status: { in: LIVE_CONTRACT_STATUSES } },
        { winnerCompanyId: companyId, status: { in: ["AWARDED", "DISPUTED"] } },
      ],
    },
  });
  return live > 0;
}

/**
 * Hand an offer back to the buyer's capital. If the buyer has already stopped trading, warn and
 * credit capital anyway so the money stays on the company record rather than leaking to the founder.
 */
export async function returnOfferTx(
  tx: Db,
  input: { companyId: string; founderId: string; amount: number; key: string }
): Promise<void> {
  const buyer = await tx.company.findUniqueOrThrow({
    where: { id: input.companyId },
    select: { status: true },
  });
  if (buyer.status !== "ACTIVE" && buyer.status !== "DISTRESSED") {
    console.warn(
      `[exchange] returnOfferTx credited non-trading buyer ${input.companyId} (${buyer.status}) for offer ${input.key}`
    );
  }
  await tx.company.update({
    where: { id: input.companyId },
    data: { capital: { increment: input.amount } },
  });
  await refreshFairValue(tx, input.companyId);
}

/**
 * Close any remaining OPEN proposals on a company that is ceasing operations (dissolved, acquired, or
 * liquidated), returning any escrowed acquisition offers to their buyers.
 */
export async function closeCompanyProposalsTx(
  tx: Db,
  companyId: string,
  now: number
): Promise<void> {
  const open = await tx.companyProposal.findMany({
    where: { companyId, status: "OPEN" },
  });
  for (const proposal of open) {
    const { count } = await tx.companyProposal.updateMany({
      where: { id: proposal.id, status: "OPEN" },
      data: { status: "EXPIRED", resolvedIxTime: now },
    });
    if (count !== 1) continue;
    if (proposal.type === "ACQUIRE_OFFER") {
      const { buyerCompanyId, offerAmount } = acquirePayloadOf(proposal.payload);
      await returnOfferTx(tx, {
        companyId: buyerCompanyId,
        founderId: proposal.proposerUserId,
        amount: offerAmount,
        key: `exchange:acquire-return:${proposal.id}`,
      });
    }
  }
}

/**
 * Carry out an approved offer inside the vote's transaction. The target is locked before the buyer,
 * the order every company-pair move uses. A failed check throws, which rolls the vote back and leaves
 * the proposal OPEN.
 */
export async function executeAcquisition(
  tx: Db,
  proposal: CompanyProposal,
  now: number
): Promise<ExchangeNotice[]> {
  const { buyerCompanyId, offerAmount } = acquirePayloadOf(proposal.payload);
  await lockCompany(tx, proposal.companyId);
  await lockCompany(tx, buyerCompanyId);
  const buyer = await tx.company.findUniqueOrThrow({ where: { id: buyerCompanyId } });
  const blocked = await acquisitionBlocker(tx, buyer, proposal.companyId, offerAmount);
  if (blocked) throw new ExchangeError("CONFLICT", blocked);

  const target = await tx.company.findUniqueOrThrow({ where: { id: proposal.companyId } });
  await tx.company.update({
    where: { id: target.id },
    data: { capital: { increment: offerAmount } },
  });
  await repayCreditTx(tx, target, proposal.id);
  await returnListedShares(tx, target.id);
  await returnBuyOrders(tx, target.id);
  await closeCompanyProposalsTx(tx, target.id, now);
  const notices = await distributeTx(tx, {
    proposal,
    target,
    buyerCompanyId: buyer.id,
    holders: await holdersOf(tx, target.id),
  });

  const { count } = await tx.company.updateMany({
    where: { id: target.id, status: { in: ["ACTIVE", "DISTRESSED"] } },
    data: {
      status: "DELISTED",
      tradingOpen: false,
      decisionValue: 0,
      standing: 0,
      contractsWonValue: 0,
      creditDrawn: 0,
      distressedSinceIxTime: null,
    },
  });
  if (count !== 1) throw new ExchangeError("CONFLICT", "That company can't be bought");

  await tx.company.update({
    where: { id: buyer.id },
    data: {
      decisionValue: { increment: round2(ACQUIRED_PLANT_SHARE * target.decisionValue) },
      standing: { increment: round2(ACQUIRED_STANDING_SHARE * Math.max(0, target.standing)) },
      contractsWonValue: { increment: round2(ACQUIRED_STANDING_SHARE * target.contractsWonValue) },
    },
  });
  await refreshFairValue(tx, target.id);
  await refreshFairValue(tx, buyer.id);
  await publishNewsTx(tx, {
    realmId: target.realmId,
    kind: "acquisition",
    prominence: "HEADLINE",
    sourceKind: "COMPANY",
    sourceId: buyer.id,
    headline: `${buyer.name} acquires ${target.name} for ${formatSovereigns(offerAmount)}`,
    companyId: target.id,
    key: `news:acquisition:${proposal.id}`,
  });
  notices.push({
    userId: proposal.proposerUserId,
    title: `${target.name} is now part of ${buyer.name}`,
    message: `Shareholders accepted your offer of ${formatSovereigns(offerAmount)}.`,
    priority: "high",
  });
  return notices;
}

/**
 * Repay the target's credit line to its HQ nation. The repayment is a tax-type transfer because the
 * ledger has no debt type. A company with no HQ burns it, as it burns interest.
 */
async function repayCreditTx(tx: Db, target: Company, proposalId: string): Promise<void> {
  if (target.creditDrawn <= 0) return;
  if (target.hqCountryId) {
    await transferToTreasuryTx(tx, {
      from: { kind: "COMPANY", companyId: target.id },
      countryId: target.hqCountryId,
      realmId: target.realmId,
      amount: target.creditDrawn,
      type: "TAX",
      source: `CREDIT_REPAYMENT:${target.id}`,
      key: `exchange:acquire-debt:${proposalId}`,
    });
  } else {
    const { count } = await tx.company.updateMany({
      where: { id: target.id, capital: { gte: target.creditDrawn } },
      data: { capital: { decrement: target.creditDrawn } },
    });
    if (count !== 1) throw new ExchangeError("CONFLICT", "The company can't repay its credit line");
  }
  await tx.company.update({ where: { id: target.id }, data: { creditDrawn: 0 } });
}

/**
 * Hand the target's remaining capital to its owners: pro rata to the holders, or into the buyer's
 * capital when the buyer is the only holder. The payouts sum to the amount debited, cent for cent.
 */
async function distributeTx(
  tx: Db,
  input: { proposal: CompanyProposal; target: Company; buyerCompanyId: string; holders: Holder[] }
): Promise<ExchangeNotice[]> {
  const { target, proposal, buyerCompanyId, holders } = input;
  const { capital } = await tx.company.findUniqueOrThrow({
    where: { id: target.id },
    select: { capital: true },
  });
  const cents = toCents(capital);
  if (cents > 0) {
    const amount = fromCents(cents);
    const { count } = await tx.company.updateMany({
      where: { id: target.id, capital: { gte: amount } },
      data: { capital: { decrement: amount } },
    });
    if (count !== 1) throw new ExchangeError("CONFLICT", "The company changed; try again");
  }
  if (holders.every((h) => h.userId === proposal.proposerUserId)) {
    if (cents > 0) {
      await tx.company.update({
        where: { id: buyerCompanyId },
        data: { capital: { increment: fromCents(cents) } },
      });
    }
    return [];
  }
  return payOutTx(tx, { proposal, target, cents, holders });
}

async function payOutTx(
  tx: Db,
  input: { proposal: CompanyProposal; target: Company; cents: number; holders: Holder[] }
): Promise<ExchangeNotice[]> {
  const { proposal, target, cents, holders } = input;
  const split = splitProRata(cents, holders);
  const centsOf = new Map(split.payouts.map((p) => [p.userId, p.cents]));
  const [largest] = holders;
  if (largest)
    centsOf.set(largest.userId, (centsOf.get(largest.userId) ?? 0) + split.remainderCents);

  const notices: ExchangeNotice[] = [];
  for (const holder of holders) {
    const holderCents = centsOf.get(holder.userId) ?? 0;
    if (holderCents <= 0) continue;
    const amount = fromCents(holderCents);
    await earnSovereignsTx(tx, {
      userId: holder.userId,
      amount,
      type: "DIVIDEND",
      source: `ACQUISITION:${target.id}`,
      metadata: { companyId: target.id, proposalId: proposal.id, acquisition: true },
      idempotencyKey: `exchange:acquire-payout:${proposal.id}:${holder.userId}`,
    });
    if (holder.userId !== proposal.proposerUserId) {
      notices.push({
        userId: holder.userId,
        title: `${target.name} was acquired`,
        message: `Your ${holder.shares} shares were bought out for ${formatSovereigns(amount)}, now in your wallet.`,
      });
    }
  }
  return notices;
}
