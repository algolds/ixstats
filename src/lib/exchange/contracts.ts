/**
 * Exchange contracts (MVP: B2B). Spec: docs/specs/2026-10-06-exchange-economy-design.md §4.
 *
 *   OPEN ──award──▶ AWARDED ──complete──▶ COMPLETED
 *    │                 │ └──release (contractor)──▶ CANCELLED
 *    └─cancel─▶ CANCELLED   └──dispute (either)──▶ DISPUTED ──admin──▶ COMPLETED | CANCELLED
 *
 * The issuing company's capital funds `escrow` (= value) when the contract is created.
 * Awarding a bid keeps the bid amount in escrow and refunds the rest to the issuer;
 * completion pays escrow to the winner's capital; cancellation refunds it. Every
 * transition is a conditional update on the current status, so a double click, a retry or
 * two racing parties can move a contract only once, and escrow is paid out only once.
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { ExchangeError, isUniqueViolation } from "~/lib/vault/exchange-service";
import { refreshFairValue, requireOwnedCompany, type SectorKey } from "./companies";
import { assertExchangeOpen, type Db } from "./guards";

export const CONTRACT_STATUSES = ["OPEN", "AWARDED", "COMPLETED", "CANCELLED", "DISPUTED"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/** Spam guard: OPEN contracts one company may have at once. */
export const MAX_OPEN_CONTRACTS_PER_COMPANY = 10;
const DAY_MS = 86_400_000;

/** Which transitions each status allows. The functions below enforce the same table. */
export const CONTRACT_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  OPEN: ["AWARDED", "CANCELLED"],
  AWARDED: ["COMPLETED", "CANCELLED", "DISPUTED"],
  DISPUTED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: ContractStatus): boolean {
  return (CONTRACT_TRANSITIONS[from as ContractStatus] ?? []).includes(to);
}

/**
 * Move a contract from `from` to `to` only if it is still in `from`. Returns the contract
 * as it was before the move; throws CONFLICT when someone else moved it first.
 */
async function transition(
  tx: Db,
  contractId: string,
  from: ContractStatus,
  to: ContractStatus,
  data: Record<string, unknown> = {}
) {
  if (!canTransition(from, to)) {
    throw new ExchangeError("CONFLICT", `A contract can't go from ${from} to ${to}`);
  }
  const before = await tx.contract.findUnique({ where: { id: contractId } });
  if (!before) throw new ExchangeError("NOT_FOUND", "Contract not found");
  const { count } = await tx.contract.updateMany({
    where: { id: contractId, status: from },
    data: { status: to, ...data },
  });
  if (count !== 1) {
    throw new ExchangeError("CONFLICT", `This contract is no longer ${from.toLowerCase()}`);
  }
  return before;
}

/** Return escrow to the issuing company's capital. */
async function refundIssuer(tx: Db, issuerCompanyId: string | null, amount: number) {
  if (!issuerCompanyId || amount <= 0) return;
  await tx.company.update({
    where: { id: issuerCompanyId },
    data: { capital: { increment: amount } },
  });
  await refreshFairValue(tx, issuerCompanyId);
}

/** Pay escrow to the winning company and credit its record. */
async function payContractor(tx: Db, companyId: string, bidId: string | null, amount: number) {
  await tx.company.update({
    where: { id: companyId },
    data: {
      capital: { increment: amount },
      contractsWonValue: { increment: amount },
      standing: { increment: 1 },
    },
  });
  if (bidId) await tx.contractBid.update({ where: { id: bidId }, data: { standingDelta: 1 } });
  await refreshFairValue(tx, companyId);
}

async function penaliseContractor(tx: Db, companyId: string, bidId: string | null) {
  await tx.company.update({ where: { id: companyId }, data: { standing: { decrement: 1 } } });
  if (bidId) await tx.contractBid.update({ where: { id: bidId }, data: { standingDelta: -1 } });
  await refreshFairValue(tx, companyId);
}

/** The issuer may act only while they still found the issuing company. */
async function requireIssuer(tx: Db, contractId: string, userId: string) {
  const contract = await tx.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new ExchangeError("NOT_FOUND", "Contract not found");
  if (contract.issuerUserId !== userId || !contract.issuerCompanyId) {
    throw new ExchangeError("FORBIDDEN", "Only the issuing company can do that");
  }
  const company = await tx.company.findUnique({
    where: { id: contract.issuerCompanyId },
    select: { founderId: true },
  });
  if (company?.founderId !== userId) {
    throw new ExchangeError("FORBIDDEN", "Only the issuing company can do that");
  }
  return contract;
}

async function requireContractor(tx: Db, contractId: string, userId: string) {
  const contract = await tx.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new ExchangeError("NOT_FOUND", "Contract not found");
  if (!contract.winnerCompanyId) {
    throw new ExchangeError("CONFLICT", "This contract has not been awarded");
  }
  const company = await tx.company.findUnique({
    where: { id: contract.winnerCompanyId },
    select: { founderId: true },
  });
  if (company?.founderId !== userId) {
    throw new ExchangeError("FORBIDDEN", "Only the contractor can do that");
  }
  return contract;
}

export interface CreateContractInput {
  userId: string;
  issuerCompanyId: string;
  title: string;
  description?: string;
  sectorKey: SectorKey;
  value: number;
  /** Real days bids stay open (converted to IxTime for `endIxTime`). */
  biddingDays: number;
  requestId: string;
}

/** Post a contract and move its value from the issuer's capital into escrow. */
export async function createContract(db: PrismaClient, input: CreateContractInput) {
  if (!Number.isFinite(input.value) || input.value <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Value must be positive");
  }
  const key = `exchange:contract:${input.userId}:${input.requestId}`;
  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      const existing = await tx.contract.findUnique({ where: { idempotencyKey: key } });
      if (existing) return { contract: existing, alreadyApplied: true };

      await requireOwnedCompany(tx, input.issuerCompanyId, input.userId);
      const open = await tx.contract.count({
        where: { issuerCompanyId: input.issuerCompanyId, status: "OPEN" },
      });
      if (open >= MAX_OPEN_CONTRACTS_PER_COMPANY) {
        throw new ExchangeError(
          "LIMIT_REACHED",
          `A company can have up to ${MAX_OPEN_CONTRACTS_PER_COMPANY} open contracts`
        );
      }

      const { count } = await tx.company.updateMany({
        where: { id: input.issuerCompanyId, status: "ACTIVE", capital: { gte: input.value } },
        data: { capital: { decrement: input.value } },
      });
      if (count !== 1) {
        throw new ExchangeError(
          "INSUFFICIENT_SOVEREIGNS",
          "The company's capital doesn't cover the contract value; deposit more first"
        );
      }

      const now = IxTime.getCurrentIxTime();
      const contract = await tx.contract.create({
        data: {
          type: "B2B",
          title: input.title.trim(),
          description: input.description?.trim() || null,
          sectorKey: input.sectorKey,
          value: input.value,
          escrow: input.value,
          status: "OPEN",
          issuerCompanyId: input.issuerCompanyId,
          issuerUserId: input.userId,
          createdIxTime: now,
          endIxTime: now + input.biddingDays * DAY_MS * IxTime.getTimeMultiplier(),
          idempotencyKey: key,
        },
      });
      await refreshFairValue(tx, input.issuerCompanyId);
      return { contract, alreadyApplied: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const contract = await db.contract.findUnique({ where: { idempotencyKey: key } });
      if (contract) return { contract, alreadyApplied: true };
    }
    throw error;
  }
}

export interface PlaceBidInput {
  userId: string;
  contractId: string;
  companyId: string;
  /** What the bidder asks to be paid; at most the contract value. */
  amount: number;
}

/** Bid (or re-bid) on an OPEN contract with one of your companies. */
export async function placeBid(db: PrismaClient, input: PlaceBidInput) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await requireOwnedCompany(tx, input.companyId, input.userId);
    const contract = await tx.contract.findUnique({ where: { id: input.contractId } });
    if (!contract) throw new ExchangeError("NOT_FOUND", "Contract not found");
    if (contract.status !== "OPEN" || contract.endIxTime <= IxTime.getCurrentIxTime()) {
      throw new ExchangeError("CONFLICT", "Bidding on this contract has closed");
    }
    if (contract.issuerCompanyId === input.companyId || contract.issuerUserId === input.userId) {
      throw new ExchangeError("FORBIDDEN", "You can't bid on your own contract");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > contract.value) {
      throw new ExchangeError("INVALID_AMOUNT", "A bid must be positive and at most the value");
    }
    return tx.contractBid.upsert({
      where: { contractId_companyId: { contractId: contract.id, companyId: input.companyId } },
      update: { amount: input.amount },
      create: {
        contractId: contract.id,
        companyId: input.companyId,
        amount: input.amount,
        createdIxTime: IxTime.getCurrentIxTime(),
      },
    });
  });
}

/** Withdraw your bid while the contract is still OPEN. */
export async function withdrawBid(db: PrismaClient, input: { userId: string; bidId: string }) {
  return db.$transaction(async (tx) => {
    const bid = await tx.contractBid.findUnique({
      where: { id: input.bidId },
      include: { company: { select: { founderId: true } }, contract: { select: { status: true } } },
    });
    if (!bid) throw new ExchangeError("NOT_FOUND", "Bid not found");
    if (bid.company.founderId !== input.userId) {
      throw new ExchangeError("FORBIDDEN", "This is not your bid");
    }
    if (bid.contract.status !== "OPEN") {
      throw new ExchangeError("CONFLICT", "The contract has already been decided");
    }
    await tx.contractBid.deleteMany({ where: { id: bid.id, outcome: null } });
    return { withdrawn: true };
  });
}

/** Issuer picks a bid: escrow drops to the bid amount and the difference is refunded. */
export async function awardContract(
  db: PrismaClient,
  input: { userId: string; contractId: string; bidId: string }
) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await requireIssuer(tx, input.contractId, input.userId);
    const bid = await tx.contractBid.findUnique({
      where: { id: input.bidId },
      include: { company: { select: { status: true } } },
    });
    if (!bid || bid.contractId !== input.contractId) {
      throw new ExchangeError("NOT_FOUND", "Bid not found on this contract");
    }
    if (bid.company.status !== "ACTIVE") {
      throw new ExchangeError("CONFLICT", "That company is no longer active");
    }
    const before = await transition(tx, input.contractId, "OPEN", "AWARDED", {
      winnerCompanyId: bid.companyId,
      awardedBidId: bid.id,
      escrow: bid.amount,
    });
    await tx.contractBid.update({ where: { id: bid.id }, data: { outcome: "WON" } });
    await tx.contractBid.updateMany({
      where: { contractId: input.contractId, id: { not: bid.id } },
      data: { outcome: "LOST" },
    });
    await refundIssuer(tx, before.issuerCompanyId, before.escrow - bid.amount);
    return { awarded: true };
  });
}

/** Issuer confirms delivery: escrow is paid to the contractor's capital. */
export async function completeContract(
  db: PrismaClient,
  input: { userId: string; contractId: string }
) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await requireIssuer(tx, input.contractId, input.userId);
    const before = await transition(tx, input.contractId, "AWARDED", "COMPLETED", {
      escrow: 0,
      closedIxTime: IxTime.getCurrentIxTime(),
    });
    await payContractor(tx, before.winnerCompanyId!, before.awardedBidId, before.escrow);
    return { paid: before.escrow };
  });
}

/** Issuer withdraws an OPEN contract: escrow back to capital, every bid lost. */
export async function cancelContract(
  db: PrismaClient,
  input: { userId: string; contractId: string }
) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await requireIssuer(tx, input.contractId, input.userId);
    const before = await transition(tx, input.contractId, "OPEN", "CANCELLED", {
      escrow: 0,
      closedIxTime: IxTime.getCurrentIxTime(),
    });
    await tx.contractBid.updateMany({
      where: { contractId: input.contractId },
      data: { outcome: "LOST" },
    });
    await refundIssuer(tx, before.issuerCompanyId, before.escrow);
    return { refunded: before.escrow };
  });
}

/** Contractor walks away from an AWARDED contract: escrow refunded, standing −1. */
export async function releaseContract(
  db: PrismaClient,
  input: { userId: string; contractId: string }
) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await requireContractor(tx, input.contractId, input.userId);
    const before = await transition(tx, input.contractId, "AWARDED", "CANCELLED", {
      escrow: 0,
      closedIxTime: IxTime.getCurrentIxTime(),
    });
    await refundIssuer(tx, before.issuerCompanyId, before.escrow);
    await penaliseContractor(tx, before.winnerCompanyId!, before.awardedBidId);
    return { refunded: before.escrow };
  });
}

/** Either party freezes an AWARDED contract for an admin to decide. Escrow stays put. */
export async function disputeContract(
  db: PrismaClient,
  input: { userId: string; contractId: string; reason: string }
) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const contract = await tx.contract.findUnique({ where: { id: input.contractId } });
    if (!contract) throw new ExchangeError("NOT_FOUND", "Contract not found");
    const isIssuer = contract.issuerUserId === input.userId;
    if (!isIssuer) await requireContractor(tx, input.contractId, input.userId);
    await transition(tx, input.contractId, "AWARDED", "DISPUTED", {
      disputeReason: input.reason.trim(),
      disputedByUserId: input.userId,
    });
    return { disputed: true };
  });
}

export type DisputeOutcome = "PAY_CONTRACTOR" | "REFUND_ISSUER";

/**
 * Admin settles a DISPUTED contract: pay the contractor (standing +1) or refund the
 * issuer (contractor standing −1). Runs even while the Exchange is switched off.
 */
export async function resolveDispute(
  db: PrismaClient,
  input: { contractId: string; outcome: DisputeOutcome; note: string }
) {
  return db.$transaction(async (tx) => {
    const to: ContractStatus = input.outcome === "PAY_CONTRACTOR" ? "COMPLETED" : "CANCELLED";
    const before = await transition(tx, input.contractId, "DISPUTED", to, {
      escrow: 0,
      resolutionNote: input.note.trim(),
      closedIxTime: IxTime.getCurrentIxTime(),
    });
    if (input.outcome === "PAY_CONTRACTOR") {
      await payContractor(tx, before.winnerCompanyId!, before.awardedBidId, before.escrow);
    } else {
      await refundIssuer(tx, before.issuerCompanyId, before.escrow);
      await penaliseContractor(tx, before.winnerCompanyId!, before.awardedBidId);
    }
    return { status: to, amount: before.escrow, title: before.title };
  });
}
