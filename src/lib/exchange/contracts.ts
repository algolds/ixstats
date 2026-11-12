/**
 * Exchange contracts: B2B (a company issues) and B2G (a nation's owner issues a government
 * tender). Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 *
 *   OPEN ──award──▶ AWARDED ──complete──▶ COMPLETED
 *    │                 │ └──release (contractor)──▶ CANCELLED
 *    ├─cancel─▶ CANCELLED └──dispute (either)──▶ DISPUTED ──admin──▶ COMPLETED | CANCELLED
 *    └─expire (job, expiry.ts)─▶ CANCELLED
 *
 * Escrow (= value) is funded when the contract is posted: from the issuing company's capital
 * (B2B), from the issuing nation's treasury or the owner's ₷ wallet (B2G, `fundedBy`), or
 * minted by a realm faucet (`FAUCET`, capped per realm per week). Awarding a bid keeps the bid
 * amount in escrow and returns the rest to the funder; completion pays escrow to the winner's
 * capital, less any cross-border tariff; cancellation returns it. Faucet escrow is burned on
 * return, because it was never taken from anyone. Every transition is a conditional update on
 * the current status, so a double click, a retry or two racing parties can move a contract
 * only once, and escrow is paid out only once. Parties are notified after the transaction
 * commits (notify.ts).
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { ExchangeError, isUniqueViolation, spendSovereignsTx } from "~/lib/vault/exchange-service";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import { refreshFairValue, requireOwnedCompany, type SectorKey } from "./companies";
import { assertExchangeOpen, requireCountryOwner, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { alertWatchers, publishContractNewsTx, type PublishedHeadline } from "./news";
import { assertNotOwnersCompany } from "./lending";
import { centsOf, dbCents, formatSovereigns, fromCents, toCents } from "./amounts";
import { contractView, payContractor, refundIssuer } from "./contract-settlement";
import { debitTreasuryTx } from "./treasury";

export { contractView, refundIssuer } from "./contract-settlement";

export const CONTRACT_STATUSES = ["OPEN", "AWARDED", "COMPLETED", "CANCELLED", "DISPUTED"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/** Spam guard: OPEN contracts one company (or one nation, for tenders) may have at once. */
export const MAX_OPEN_CONTRACTS_PER_COMPANY = 10;
export const DAY_MS = 86_400_000;
/** The rolling window a realm's faucet cap is measured over, in real days. */
export const FAUCET_WINDOW_DAYS = 7;

/** Where a tender's escrow comes from: the owner's ₷ wallet, or the nation's treasury. */
export const TENDER_FUNDINGS = ["WALLET", "TREASURY"] as const;
export type TenderFunding = (typeof TENDER_FUNDINGS)[number];

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
  data: Prisma.ContractUncheckedUpdateManyInput = {}
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
 * player who posted and funded the tender (B2G, and the faucet's tenders).
 */
async function requireIssuer(tx: Db, contractId: string, userId: string) {
  const contract = await tx.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new ExchangeError("NOT_FOUND", "Contract not found");
  if (contract.issuerUserId !== userId) {
    throw new ExchangeError("FORBIDDEN", "Only the issuer can do that");
  }
  if (contract.type === "B2G") return contract;
  const issuer = contract.issuerCompanyId
    ? await tx.company.findUnique({
        where: { id: contract.issuerCompanyId },
        select: { founderId: true, status: true },
      })
    : null;
  if (!issuer || issuer.founderId !== userId) {
    throw new ExchangeError("FORBIDDEN", "Only the issuing company can do that");
  }
  if (issuer.status !== "ACTIVE" && issuer.status !== "DISTRESSED") {
    throw new ExchangeError("CONFLICT", "This company is closed");
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
  /** Real days bids stay open. */
  biddingDays: number;
  requestId: string;
}

export interface CreateContractInput extends ContractTerms {
  issuerCompanyId: string;
}

export interface CreateTenderInput extends ContractTerms {
  /** The nation issuing the tender; the caller must own it (or act as it). */
  countryId: string;
  /** Where escrow comes from. Defaults to the nation's treasury. */
  fundedBy?: TenderFunding;
  /** The national Directive this tender was issued from, when there is one. */
  linkedDirectiveId?: string | null;
  /** The national Issue this tender was issued from, when there is one. */
  linkedIssueId?: string | null;
}

export interface CreateFaucetTenderInput extends ContractTerms {
  /** The realm whose weekly faucet pays for the tender. */
  realmId: string;
  /** Whether the caller may draw on the faucet. The caller decides; this module only reads it. */
  permitted: boolean;
}

function assertValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Value must be positive");
  }
}

function contractData(input: ContractTerms, key: string, realmId: string) {
  const now = Date.now();
  const valueCents = dbCents(toCents(input.value));
  return {
    realmId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    sectorKey: input.sectorKey,
    value: valueCents,
    escrow: valueCents,
    status: "OPEN",
    issuerUserId: input.userId,
    createdIxTime: now,
    endIxTime: now + input.biddingDays * DAY_MS,
    idempotencyKey: key,
  };
}

/** Run a keyed post; a racing duplicate that lost on the unique key gets the winner's contract. */
async function keyedPost<T extends { contract: object }>(
  db: PrismaClient,
  key: string,
  run: () => Promise<T>
) {
  try {
    return await run();
  } catch (error) {
    if (isUniqueViolation(error)) {
      const contract = await db.contract.findUnique({ where: { idempotencyKey: key } });
      if (contract) return { contract: contractView(contract), alreadyApplied: true };
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
      if (existing) return { contract: contractView(existing), alreadyApplied: true };

      const company = await requireOwnedCompany(tx, input.issuerCompanyId, input.userId);
      const open = await tx.contract.count({
        where: { issuerCompanyId: input.issuerCompanyId, status: "OPEN" },
      });
      if (open >= MAX_OPEN_CONTRACTS_PER_COMPANY) {
        throw new ExchangeError(
          "LIMIT_REACHED",
          `A company can have up to ${MAX_OPEN_CONTRACTS_PER_COMPANY} open contracts`
        );
      }

      const valueCents = dbCents(toCents(input.value));
      const { count } = await tx.company.updateMany({
        where: { id: input.issuerCompanyId, status: "ACTIVE", capital: { gte: valueCents } },
        data: { capital: { decrement: valueCents } },
      });
      if (count !== 1) {
        throw new ExchangeError(
          "INSUFFICIENT_SOVEREIGNS",
          "The company's capital doesn't cover the contract value; deposit more first"
        );
      }

      const contract = await tx.contract.create({
        data: {
          ...contractData(input, key, company.realmId),
          type: "B2B",
          fundedBy: "COMPANY",
          issuerCompanyId: input.issuerCompanyId,
        },
      });
      await refreshFairValue(tx, input.issuerCompanyId);
      return { contract: contractView(contract), alreadyApplied: false };
    })
  );
}

/** Take a tender's escrow from the owner's wallet or from the nation's treasury. */
async function fundTender(
  tx: Db,
  input: { countryId: string; userId: string; value: number; title: string; key: string },
  fundedBy: TenderFunding
) {
  if (fundedBy === "WALLET") {
    await spendSovereignsTx(tx, {
      userId: input.userId,
      amount: input.value,
      type: "CONTRACT_ESCROW",
      source: `TENDER:${input.countryId}`,
      metadata: { countryId: input.countryId, title: input.title.trim() },
      idempotencyKey: `${input.key}:escrow`,
    });
    return;
  }
  await debitTreasuryTx(tx, {
    countryId: input.countryId,
    amount: input.value,
    type: "B2G_ESCROW",
    source: `TENDER:${input.countryId}`,
    key: `${input.key}:escrow`,
  });
}

/**
 * Post a government tender (B2G) for a nation the caller owns. Escrow comes from the nation's
 * treasury by default, or from the owner's ₷ wallet; refunds go back to the same place.
 * Companies bid as on B2B contracts; a winner in the tender's sector earns an extra point of
 * standing.
 */
export async function createGovernmentContract(db: PrismaClient, input: CreateTenderInput) {
  assertValue(input.value);
  const fundedBy: TenderFunding = input.fundedBy ?? "TREASURY";
  const key = `exchange:tender:${input.userId}:${input.requestId}`;
  return keyedPost(db, key, () =>
    db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      const existing = await tx.contract.findUnique({ where: { idempotencyKey: key } });
      if (existing) return { contract: contractView(existing), alreadyApplied: true };

      const country = await requireCountryOwner(tx, input.countryId, input.userId);
      const open = await tx.contract.count({
        where: { issuerCountryId: input.countryId, status: "OPEN" },
      });
      if (open >= MAX_OPEN_CONTRACTS_PER_COMPANY) {
        throw new ExchangeError(
          "LIMIT_REACHED",
          `A nation can have up to ${MAX_OPEN_CONTRACTS_PER_COMPANY} open tenders`
        );
      }
      await fundTender(tx, { ...input, key }, fundedBy);
      const contract = await tx.contract.create({
        data: {
          ...contractData(input, key, country.realmId),
          type: "B2G",
          fundedBy,
          issuerCountryId: input.countryId,
          linkedDirectiveId: input.linkedDirectiveId ?? null,
          linkedIssueId: input.linkedIssueId ?? null,
        },
      });
      return { contract: contractView(contract), alreadyApplied: false };
    })
  );
}

/** A realm's faucet is one lock: two tenders can't both pass the cap check at once. */
async function lockRealm(tx: Db, realmId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "realms" WHERE id = ${realmId} FOR UPDATE`;
}

async function faucetMintedCentsSince(tx: Db, realmId: string, sinceMs: number): Promise<number> {
  const totals = await tx.contract.aggregate({
    where: { realmId, fundedBy: "FAUCET", createdIxTime: { gte: sinceMs } },
    _sum: { value: true },
  });
  return centsOf(totals._sum.value ?? 0n);
}

/**
 * Post a tender whose escrow the realm's faucet mints. Only what the realm minted over the
 * last FAUCET_WINDOW_DAYS counts against its weekly cap, whatever became of those tenders,
 * since returned faucet escrow is burned and can't be minted again.
 */
export async function createFaucetTender(db: PrismaClient, input: CreateFaucetTenderInput) {
  assertValue(input.value);
  if (!input.permitted) {
    throw new ExchangeError("FORBIDDEN", "Only a realm's administrators can open its faucet");
  }
  const key = `exchange:faucet:${input.userId}:${input.requestId}`;
  return keyedPost(db, key, () =>
    db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      const existing = await tx.contract.findUnique({ where: { idempotencyKey: key } });
      if (existing) return { contract: contractView(existing), alreadyApplied: true };

      await lockRealm(tx, input.realmId);
      const capCents = toCents((await getExchangeConfig(tx)).realmWeeklyFaucetCap);
      const since = Date.now() - FAUCET_WINDOW_DAYS * DAY_MS;
      const mintedCents = await faucetMintedCentsSince(tx, input.realmId, since);
      if (mintedCents + toCents(input.value) > capCents) {
        const left = Math.max(0, fromCents(capCents - mintedCents));
        throw new ExchangeError(
          "LIMIT_REACHED",
          `This realm's faucet has ${formatSovereigns(left)} left this week`
        );
      }
      const contract = await tx.contract.create({
        data: {
          ...contractData(input, key, input.realmId),
          type: "B2G",
          fundedBy: "FAUCET",
        },
      });
      return { contract: contractView(contract), alreadyApplied: false };
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

/** Bid (or re-bid) on an OPEN contract with one of your companies, in the contract's realm. */
export async function placeBid(db: PrismaClient, input: PlaceBidInput) {
  const notices: ExchangeNotice[] = [];
  const bid = await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const company = await requireOwnedCompany(tx, input.companyId, input.userId);
    const contract = await tx.contract.findUnique({ where: { id: input.contractId } });
    if (!contract) throw new ExchangeError("NOT_FOUND", "Contract not found");
    if (contract.realmId !== company.realmId) {
      throw new ExchangeError("FORBIDDEN", "A company can only bid on contracts in its own realm");
    }
    if (contract.status !== "OPEN" || contract.endIxTime <= Date.now()) {
      throw new ExchangeError("CONFLICT", "Bidding on this contract has closed");
    }
    if (contract.issuerCompanyId === input.companyId || contract.issuerUserId === input.userId) {
      throw new ExchangeError("FORBIDDEN", "You can't bid on your own contract");
    }
    const amountCents = toCents(input.amount);
    if (!Number.isFinite(input.amount) || amountCents <= 0 || amountCents > centsOf(contract.value)) {
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
    const row = await tx.contractBid.upsert({
      where,
      update: { amount: dbCents(amountCents) },
      create: {
        contractId: contract.id,
        companyId: input.companyId,
        amount: dbCents(amountCents),
        createdIxTime: Date.now(),
      },
    });
    return { ...row, amount: fromCents(centsOf(row.amount)) };
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
  let headline: PublishedHeadline | null = null;
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
    const tender = await tx.contract.findUnique({
      where: { id: input.contractId },
      select: { type: true, issuerCountryId: true },
    });
    if (tender?.type === "B2G" && tender.issuerCountryId) {
      await assertNotOwnersCompany(tx, tender.issuerCountryId, bid.companyId);
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
    const bidSovereigns = fromCents(centsOf(bid.amount));
    await refundIssuer(tx, before, fromCents(centsOf(before.escrow) - centsOf(bid.amount)), "award");
    headline = await publishContractNewsTx(tx, before, bid.companyId, "tender_awarded");
    notices.push({
      userId: bid.company.founderId,
      title: `You won ${before.title}`,
      message: `Awarded at ${formatSovereigns(bidSovereigns)}, held in escrow until the issuer confirms delivery.`,
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
  if (headline) await alertWatchers(db, [headline]);
  return result;
}

/** Issuer confirms delivery: escrow is paid to the contractor's capital, less any tariff. */
export async function completeContract(
  db: PrismaClient,
  input: { userId: string; contractId: string }
) {
  const notices: ExchangeNotice[] = [];
  let headline: PublishedHeadline | null = null;
  const result = await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await requireIssuer(tx, input.contractId, input.userId);
    const before = await transition(tx, input.contractId, "AWARDED", "COMPLETED", {
      escrow: 0n,
      closedIxTime: Date.now(),
    });
    const { net, tariffPaid } = await payContractor(tx, before, fromCents(centsOf(before.escrow)));
    if (before.winnerCompanyId) {
      headline = await publishContractNewsTx(
        tx,
        before,
        before.winnerCompanyId,
        "tender_completed"
      );
    }
    const founder = await founderOf(tx, before.winnerCompanyId);
    if (founder) {
      notices.push({
        userId: founder,
        title: `${before.title} completed`,
        message: `${formatSovereigns(net)} was paid into your company's capital.`,
      });
    }
    if (before.issuerUserId) {
      const tariffNote =
        tariffPaid > 0 ? ` ${formatSovereigns(tariffPaid)} of tariff went to your treasury.` : "";
      notices.push({
        userId: before.issuerUserId,
        title: `${before.title} completed`,
        message: `Delivery is confirmed and the contractor has been paid.${tariffNote}`,
        priority: "low",
      });
    }
    return { paid: net, tariffPaid };
  });
  notifyExchange(notices);
  if (headline) await alertWatchers(db, [headline]);
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
      escrow: 0n,
      closedIxTime: Date.now(),
    });
    await tx.contractBid.updateMany({
      where: { contractId: input.contractId },
      data: { outcome: "LOST" },
    });
    const refunded = fromCents(centsOf(before.escrow));
    await refundIssuer(tx, before, refunded, "close");
    return { refunded };
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
      escrow: 0n,
      closedIxTime: Date.now(),
    });
    const refunded = fromCents(centsOf(before.escrow));
    await refundIssuer(tx, before, refunded, "close");
    await penaliseContractor(tx, before.winnerCompanyId!, before.awardedBidId);
    if (before.issuerUserId) {
      notices.push({
        userId: before.issuerUserId,
        title: `${before.title} was released`,
        message: `The contractor walked away; ${formatSovereigns(refunded)} came back to you.`,
      });
    }
    return { refunded };
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
      escrow: 0n,
      resolutionNote: input.note.trim(),
      closedIxTime: Date.now(),
    });
    const escrowSovereigns = fromCents(centsOf(before.escrow));
    if (input.outcome === "PAY_CONTRACTOR") {
      await payContractor(tx, before, escrowSovereigns);
    } else {
      await refundIssuer(tx, before, escrowSovereigns, "close");
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
    return { status: to, amount: escrowSovereigns, title: before.title };
  });
  notifyExchange(notices);
  return result;
}
