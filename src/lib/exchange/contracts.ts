/**
 * Exchange contracts: B2B (a company issues) and B2G (a nation's owner issues a government
 * tender). Spec: docs/specs/2026-10-06-exchange-economy-design.md §4 and §8.
 *
 *   OPEN ──award──▶ AWARDED ──complete──▶ COMPLETED
 *    │                 │ └──release (contractor)──▶ CANCELLED
 *    ├─cancel─▶ CANCELLED └──dispute (either)──▶ DISPUTED ──admin──▶ COMPLETED | CANCELLED
 *    └─expire (job, expiry.ts)─▶ CANCELLED
 *
 * Escrow (= value) is funded when the contract is posted: from the issuing company's capital
 * (B2B, `fundedBy` COMPANY) or from the nation owner's ₷ wallet (B2G, `fundedBy` WALLET).
 * Awarding a bid keeps the bid amount in escrow and refunds the rest to the funder;
 * completion pays escrow to the winner's capital; cancellation refunds it. Every
 * transition is a conditional update on the current status, so a double click, a retry or
 * two racing parties can move a contract only once, and escrow is paid out only once.
 * Parties are notified after the transaction commits (notify.ts).
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import {
  ExchangeError,
  earnSovereignsTx,
  isUniqueViolation,
  spendSovereignsTx,
} from "~/lib/vault/exchange-service";
import { refreshFairValue, requireOwnedCompany, type SectorKey } from "./companies";
import { assertExchangeOpen, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { formatSovereigns } from "./quote";

export const CONTRACT_STATUSES = ["OPEN", "AWARDED", "COMPLETED", "CANCELLED", "DISPUTED"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/** Spam guard: OPEN contracts one company (or one nation, for tenders) may have at once. */
export const MAX_OPEN_CONTRACTS_PER_COMPANY = 10;
export const DAY_MS = 86_400_000;

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
export async function transition(
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

interface Funded {
  id: string;
  issuerCompanyId: string | null;
  issuerUserId: string | null;
  fundedBy: string | null;
}

/**
 * Return escrow to whoever funded it: the issuing company's capital, or the issuer's wallet
 * for a wallet-funded tender (keyed per contract and step, so it is credited once).
 */
export async function refundIssuer(tx: Db, contract: Funded, amount: number, step: string) {
  if (amount <= 0) return;
  if (contract.fundedBy === "WALLET") {
    if (!contract.issuerUserId) return;
    await earnSovereignsTx(tx, {
      userId: contract.issuerUserId,
      amount,
      type: "CONTRACT_REFUND",
      source: `CONTRACT:${contract.id}`,
      metadata: { contractId: contract.id, step },
      idempotencyKey: `exchange:contract-refund:${contract.id}:${step}`,
    });
    return;
  }
  if (!contract.issuerCompanyId) return;
  await tx.company.update({
    where: { id: contract.issuerCompanyId },
    data: { capital: { increment: amount } },
  });
  await refreshFairValue(tx, contract.issuerCompanyId);
}

/**
 * Pay escrow to the winning company and credit its record: standing +1, and +1 more for a
 * government tender in the company's own sector (the sector-matched bonus).
 */
async function payContractor(
  tx: Db,
  contract: {
    winnerCompanyId: string | null;
    awardedBidId: string | null;
    type: string;
    sectorKey: string;
  },
  amount: number
) {
  const companyId = contract.winnerCompanyId!;
  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: { sectorKey: true },
  });
  const delta = contract.type === "B2G" && company?.sectorKey === contract.sectorKey ? 2 : 1;
  await tx.company.update({
    where: { id: companyId },
    data: {
      capital: { increment: amount },
      contractsWonValue: { increment: amount },
      standing: { increment: delta },
    },
  });
  if (contract.awardedBidId) {
    await tx.contractBid.update({
      where: { id: contract.awardedBidId },
      data: { standingDelta: delta },
    });
  }
  await refreshFairValue(tx, companyId);
}

async function penaliseContractor(tx: Db, companyId: string, bidId: string | null) {
  await tx.company.update({ where: { id: companyId }, data: { standing: { decrement: 1 } } });
  if (bidId) await tx.contractBid.update({ where: { id: bidId }, data: { standingDelta: -1 } });
  await refreshFairValue(tx, companyId);
}

async function founderOf(tx: Db, companyId: string | null): Promise<string | null> {
  if (!companyId) return null;
  const c = await tx.company.findUnique({ where: { id: companyId }, select: { founderId: true } });
  return c?.founderId ?? null;
}

/**
 * The issuer may act only while they still found the issuing company (B2B), or as the
 * player who posted and funded the tender (B2G).
 */
async function requireIssuer(tx: Db, contractId: string, userId: string) {
  const contract = await tx.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new ExchangeError("NOT_FOUND", "Contract not found");
  if (contract.issuerUserId !== userId) {
    throw new ExchangeError("FORBIDDEN", "Only the issuer can do that");
  }
  if (contract.fundedBy === "WALLET") return contract;
  if (!contract.issuerCompanyId || (await founderOf(tx, contract.issuerCompanyId)) !== userId) {
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
  if ((await founderOf(tx, contract.winnerCompanyId)) !== userId) {
    throw new ExchangeError("FORBIDDEN", "Only the contractor can do that");
  }
  return contract;
}

interface ContractTerms {
  userId: string;
  title: string;
  description?: string;
  sectorKey: SectorKey;
  value: number;
  /** Real days bids stay open (converted to IxTime for `endIxTime`). */
  biddingDays: number;
  requestId: string;
}

export interface CreateContractInput extends ContractTerms {
  issuerCompanyId: string;
}

export interface CreateTenderInput extends ContractTerms {
  /** The nation issuing the tender; the caller must own it (or act as it). */
  countryId: string;
}

function assertValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Value must be positive");
  }
}

function contractData(input: ContractTerms, key: string) {
  const now = IxTime.getCurrentIxTime();
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    sectorKey: input.sectorKey,
    value: input.value,
    escrow: input.value,
    status: "OPEN",
    issuerUserId: input.userId,
    createdIxTime: now,
    endIxTime: now + input.biddingDays * DAY_MS * IxTime.getTimeMultiplier(),
    idempotencyKey: key,
  };
}

/** Run a keyed post; a racing duplicate that lost on the unique key gets the winner's contract. */
async function keyedPost<T extends { contract: unknown }>(
  db: PrismaClient,
  key: string,
  run: () => Promise<T>
) {
  try {
    return await run();
  } catch (error) {
    if (isUniqueViolation(error)) {
      const contract = await db.contract.findUnique({ where: { idempotencyKey: key } });
      if (contract) return { contract, alreadyApplied: true };
    }
    throw error;
  }
}

/** Post a B2B contract and move its value from the issuer's capital into escrow. */
export async function createContract(db: PrismaClient, input: CreateContractInput) {
  assertValue(input.value);
  const key = `exchange:contract:${input.userId}:${input.requestId}`;
  return keyedPost(db, key, () =>
    db.$transaction(async (tx) => {
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

      const contract = await tx.contract.create({
        data: {
          ...contractData(input, key),
          type: "B2B",
          fundedBy: "COMPANY",
          issuerCompanyId: input.issuerCompanyId,
        },
      });
      await refreshFairValue(tx, input.issuerCompanyId);
      return { contract, alreadyApplied: false };
    })
  );
}

/** The nation must be the caller's: they own it or play as it. */
async function requireCountryOwner(tx: Db, countryId: string, userId: string) {
  const country = await tx.country.findUnique({
    where: { id: countryId },
    select: { id: true, name: true, ownerUserId: true },
  });
  if (!country) throw new ExchangeError("NOT_FOUND", "Nation not found");
  if (country.ownerUserId === userId) return country;
  const user = await tx.user.findUnique({ where: { id: userId }, select: { countryId: true } });
  if (user?.countryId === countryId) return country;
  throw new ExchangeError("FORBIDDEN", "Only the nation's owner can issue its tenders");
}

/**
 * Post a government tender (B2G) for a nation the caller owns. Escrow comes from the
 * owner's ₷ wallet (nations hold no ₷ treasury); refunds go back there. Companies bid as on
 * B2B contracts; a winner in the tender's sector earns an extra point of standing.
 */
export async function createGovernmentContract(db: PrismaClient, input: CreateTenderInput) {
  assertValue(input.value);
  const key = `exchange:tender:${input.userId}:${input.requestId}`;
  return keyedPost(db, key, () =>
    db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      const existing = await tx.contract.findUnique({ where: { idempotencyKey: key } });
      if (existing) return { contract: existing, alreadyApplied: true };

      await requireCountryOwner(tx, input.countryId, input.userId);
      const open = await tx.contract.count({
        where: { issuerCountryId: input.countryId, status: "OPEN" },
      });
      if (open >= MAX_OPEN_CONTRACTS_PER_COMPANY) {
        throw new ExchangeError(
          "LIMIT_REACHED",
          `A nation can have up to ${MAX_OPEN_CONTRACTS_PER_COMPANY} open tenders`
        );
      }
      await spendSovereignsTx(tx, {
        userId: input.userId,
        amount: input.value,
        type: "CONTRACT_ESCROW",
        source: `TENDER:${input.countryId}`,
        metadata: { countryId: input.countryId, title: input.title.trim() },
        idempotencyKey: `${key}:escrow`,
      });
      const contract = await tx.contract.create({
        data: {
          ...contractData(input, key),
          type: "B2G",
          fundedBy: "WALLET",
          issuerCountryId: input.countryId,
        },
      });
      return { contract, alreadyApplied: false };
    })
  );
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
  const notices: ExchangeNotice[] = [];
  const bid = await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const company = await requireOwnedCompany(tx, input.companyId, input.userId);
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
    const where = { contractId_companyId: { contractId: contract.id, companyId: input.companyId } };
    const before = await tx.contractBid.findUnique({ where });
    if (!before && contract.issuerUserId) {
      notices.push({
        userId: contract.issuerUserId,
        title: `New bid on ${contract.title}`,
        message: `${company.name} bid ${formatSovereigns(input.amount)}.`,
        priority: "low",
      });
    }
    return tx.contractBid.upsert({
      where,
      update: { amount: input.amount },
      create: {
        contractId: contract.id,
        companyId: input.companyId,
        amount: input.amount,
        createdIxTime: IxTime.getCurrentIxTime(),
      },
    });
  });
  notifyExchange(notices);
  return bid;
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

/** Founders of the companies that bid on a contract, except `exceptCompanyId`. */
async function bidderFounders(tx: Db, contractId: string, exceptCompanyId?: string | null) {
  const bids = await tx.contractBid.findMany({
    where: { contractId },
    include: { company: { select: { founderId: true } } },
  });
  const ids = bids
    .filter((b) => b.companyId !== exceptCompanyId)
    .map((b) => b.company?.founderId)
    .filter((id): id is string => !!id);
  return [...new Set(ids)];
}

/** Issuer picks a bid: escrow drops to the bid amount and the difference is refunded. */
export async function awardContract(
  db: PrismaClient,
  input: { userId: string; contractId: string; bidId: string }
) {
  const notices: ExchangeNotice[] = [];
  const result = await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await requireIssuer(tx, input.contractId, input.userId);
    const bid = await tx.contractBid.findUnique({
      where: { id: input.bidId },
      include: { company: { select: { status: true, founderId: true } } },
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
    await refundIssuer(tx, before, before.escrow - bid.amount, "award");
    notices.push({
      userId: bid.company.founderId,
      title: `You won ${before.title}`,
      message: `Awarded at ${formatSovereigns(bid.amount)}, held in escrow until the issuer confirms delivery.`,
    });
    for (const userId of await bidderFounders(tx, input.contractId, bid.companyId)) {
      notices.push({
        userId,
        title: `${before.title} went to another bidder`,
        message: "Your bid was not chosen.",
        priority: "low",
      });
    }
    return { awarded: true };
  });
  notifyExchange(notices);
  return result;
}

/** Issuer confirms delivery: escrow is paid to the contractor's capital. */
export async function completeContract(
  db: PrismaClient,
  input: { userId: string; contractId: string }
) {
  const notices: ExchangeNotice[] = [];
  const result = await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await requireIssuer(tx, input.contractId, input.userId);
    const before = await transition(tx, input.contractId, "AWARDED", "COMPLETED", {
      escrow: 0,
      closedIxTime: IxTime.getCurrentIxTime(),
    });
    await payContractor(tx, before, before.escrow);
    const founder = await founderOf(tx, before.winnerCompanyId);
    if (founder) {
      notices.push({
        userId: founder,
        title: `${before.title} completed`,
        message: `${formatSovereigns(before.escrow)} was paid into your company's capital.`,
      });
    }
    return { paid: before.escrow };
  });
  notifyExchange(notices);
  return result;
}

/** Issuer withdraws an OPEN contract: escrow back to the funder, every bid lost. */
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
    await refundIssuer(tx, before, before.escrow, "close");
    return { refunded: before.escrow };
  });
}

/** Contractor walks away from an AWARDED contract: escrow refunded, standing −1. */
export async function releaseContract(
  db: PrismaClient,
  input: { userId: string; contractId: string }
) {
  const notices: ExchangeNotice[] = [];
  const result = await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await requireContractor(tx, input.contractId, input.userId);
    const before = await transition(tx, input.contractId, "AWARDED", "CANCELLED", {
      escrow: 0,
      closedIxTime: IxTime.getCurrentIxTime(),
    });
    await refundIssuer(tx, before, before.escrow, "close");
    await penaliseContractor(tx, before.winnerCompanyId!, before.awardedBidId);
    if (before.issuerUserId) {
      notices.push({
        userId: before.issuerUserId,
        title: `${before.title} was released`,
        message: `The contractor walked away; ${formatSovereigns(before.escrow)} came back to you.`,
      });
    }
    return { refunded: before.escrow };
  });
  notifyExchange(notices);
  return result;
}

/** Either party freezes an AWARDED contract for an admin to decide. Escrow stays put. */
export async function disputeContract(
  db: PrismaClient,
  input: { userId: string; contractId: string; reason: string }
) {
  const notices: ExchangeNotice[] = [];
  const result = await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const contract = await tx.contract.findUnique({ where: { id: input.contractId } });
    if (!contract) throw new ExchangeError("NOT_FOUND", "Contract not found");
    const isIssuer = contract.issuerUserId === input.userId;
    if (!isIssuer) await requireContractor(tx, input.contractId, input.userId);
    await transition(tx, input.contractId, "AWARDED", "DISPUTED", {
      disputeReason: input.reason.trim(),
      disputedByUserId: input.userId,
    });
    const other = isIssuer ? await founderOf(tx, contract.winnerCompanyId) : contract.issuerUserId;
    if (other) {
      notices.push({
        userId: other,
        title: `${contract.title} is disputed`,
        message: "Escrow is frozen until an admin decides. You'll be told the outcome.",
        priority: "high",
      });
    }
    return { disputed: true };
  });
  notifyExchange(notices);
  return result;
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
  const notices: ExchangeNotice[] = [];
  const result = await db.$transaction(async (tx) => {
    const to: ContractStatus = input.outcome === "PAY_CONTRACTOR" ? "COMPLETED" : "CANCELLED";
    const before = await transition(tx, input.contractId, "DISPUTED", to, {
      escrow: 0,
      resolutionNote: input.note.trim(),
      closedIxTime: IxTime.getCurrentIxTime(),
    });
    if (input.outcome === "PAY_CONTRACTOR") {
      await payContractor(tx, before, before.escrow);
    } else {
      await refundIssuer(tx, before, before.escrow, "close");
      await penaliseContractor(tx, before.winnerCompanyId!, before.awardedBidId);
    }
    const decision =
      input.outcome === "PAY_CONTRACTOR" ? "the contractor was paid" : "the issuer was refunded";
    const parties = [before.issuerUserId, await founderOf(tx, before.winnerCompanyId)];
    for (const userId of new Set(parties.filter((u): u is string => !!u))) {
      notices.push({
        userId,
        title: `Dispute decided: ${before.title}`,
        message: `${decision[0]!.toUpperCase()}${decision.slice(1)}. ${input.note.trim()}`,
        priority: "high",
      });
    }
    return { status: to, amount: before.escrow, title: before.title };
  });
  notifyExchange(notices);
  return result;
}
