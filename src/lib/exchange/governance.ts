/**
 * Shareholder governance: the proposals a company's owners vote on, and the acquisition offers that
 * become them. Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 *
 * A vote weighs a holder's shares plus their open listed shares. Each holder has one ballot, which they
 * can change while the proposal is OPEN. A proposal PASSES as soon as FOR votes are more than half the
 * company's outstanding shares, and it executes in that same transaction. It is REJECTED once AGAINST
 * votes reach half, and EXPIRES when its window closes. A proposer who already holds more than half
 * passes their own proposal at once. Each step is a conditional update, so a proposal runs at most once.
 * If the action fails, the whole step rolls back and the proposal stays OPEN.
 */

import type { CompanyDecision, CompanyProposal, Prisma, PrismaClient } from "@prisma/client";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { dissolveCompanyTx, requireOwnedCompany } from "./companies";
import { DAY_MS } from "./contracts";
import { assertExchangeOpen, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { holdersOf, lockCompany } from "./ownership";
import { issueSharesTx } from "./shares";
import {
  acquirePayloadOf,
  acquisitionBlocker,
  executeAcquisition,
  returnOfferTx,
} from "./acquisition";
import { publishNewsTx } from "./news";

export const PROPOSAL_TYPES = ["DISSOLVE", "ISSUE_SHARES", "ACQUIRE_OFFER"] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];
/** The proposals a founder opens directly. An acquisition offer comes from an ACQUIRE decision. */
export type OwnerProposalType = "DISSOLVE" | "ISSUE_SHARES";
/** Real days a proposal stays open to votes. */
export const PROPOSAL_DAYS = 3;

export interface OpenProposalInput {
  userId: string;
  companyId: string;
  type: OwnerProposalType;
  /** ISSUE_SHARES: the new shares to issue. */
  shares?: number;
  requestId: string;
}

export interface CastVoteInput {
  userId: string;
  proposalId: string;
  support: boolean;
}

interface Tally {
  sharesFor: number;
  sharesAgainst: number;
}

interface AcquireDecisionPayload {
  targetCompanyId?: string;
  offerAmount?: number;
}

interface NewProposal {
  companyId: string;
  type: ProposalType;
  payload: Prisma.InputJsonObject;
  proposerUserId: string;
  idempotencyKey: string;
}

const PROPOSAL_LABELS: Record<string, string> = {
  DISSOLVE: "dissolution",
  ISSUE_SHARES: "share issue",
  ACQUIRE_OFFER: "acquisition offer",
};

function payloadFor(input: OpenProposalInput): Prisma.InputJsonObject {
  if (input.type === "DISSOLVE") return {};
  const shares = input.shares ?? 0;
  if (!Number.isInteger(shares) || shares <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Shares must be a whole number above zero");
  }
  return { shares };
}

/**
 * PASSED once FOR votes are more than half the outstanding shares, REJECTED once AGAINST votes are
 * half or more, and null while the vote is still open.
 */
export function outcomeOf(tally: Tally, sharesOutstanding: number): "PASSED" | "REJECTED" | null {
  if (tally.sharesFor * 2 > sharesOutstanding) return "PASSED";
  if (tally.sharesAgainst > 0 && tally.sharesAgainst * 2 >= sharesOutstanding) return "REJECTED";
  return null;
}

async function tallyOf(tx: Db, proposalId: string, companyId: string): Promise<Tally> {
  const [ballots, holders] = await Promise.all([
    tx.companyVote.findMany({
      where: { proposalId },
      select: { id: true, voterUserId: true, support: true, shares: true },
    }),
    holdersOf(tx, companyId),
  ]);
  const currentShares = new Map(holders.map((h) => [h.userId, h.shares]));
  const tally: Tally = { sharesFor: 0, sharesAgainst: 0 };
  for (const ballot of ballots) {
    const liveWeight = currentShares.get(ballot.voterUserId) ?? 0;
    if (liveWeight !== ballot.shares) {
      await tx.companyVote.update({ where: { id: ballot.id }, data: { shares: liveWeight } });
    }
    if (ballot.support) tally.sharesFor += liveWeight;
    else tally.sharesAgainst += liveWeight;
  }
  return tally;
}

/** A holder's voting weight: their shares plus what they have listed for sale. Zero for a non-holder. */
async function weightOf(tx: Db, companyId: string, userId: string): Promise<number> {
  const holder = (await holdersOf(tx, companyId)).find((h) => h.userId === userId);
  return holder?.shares ?? 0;
}

async function recordBallotTx(
  tx: Db,
  proposalId: string,
  voterUserId: string,
  support: boolean,
  shares: number
): Promise<void> {
  const existing = await tx.companyVote.findFirst({
    where: { proposalId, voterUserId },
    select: { id: true },
  });
  if (existing) {
    await tx.companyVote.update({ where: { id: existing.id }, data: { support, shares } });
    return;
  }
  await tx.companyVote.create({ data: { proposalId, voterUserId, support, shares } });
}

/** Create an OPEN proposal, with the proposer's own FOR ballot when they hold any shares. */
async function openRecordTx(tx: Db, input: NewProposal, now: number): Promise<CompanyProposal> {
  const company = await tx.company.findUniqueOrThrow({
    where: { id: input.companyId },
    select: { sharesOutstanding: true },
  });
  const proposal = await tx.companyProposal.create({
    data: {
      companyId: input.companyId,
      proposerUserId: input.proposerUserId,
      type: input.type,
      payload: input.payload,
      status: "OPEN",
      sharesFor: 0,
      sharesAgainst: 0,
      totalEligibleShares: company.sharesOutstanding,
      expiresIxTime: now + PROPOSAL_DAYS * DAY_MS,
      idempotencyKey: input.idempotencyKey,
    },
  });
  const weight = await weightOf(tx, input.companyId, input.proposerUserId);
  if (weight > 0) await recordBallotTx(tx, proposal.id, input.proposerUserId, true, weight);
  return proposal;
}

/** Recount the ballots and settle the proposal if they decide it. Returns the notices to send. */
async function settleTx(tx: Db, proposal: CompanyProposal, now: number): Promise<ExchangeNotice[]> {
  const company = await tx.company.findUniqueOrThrow({
    where: { id: proposal.companyId },
    select: { sharesOutstanding: true },
  });
  const tally = await tallyOf(tx, proposal.id, proposal.companyId);
  const outcome = outcomeOf(tally, company.sharesOutstanding);
  if (outcome === null) {
    await tx.companyProposal.update({ where: { id: proposal.id }, data: tally });
    return [];
  }
  const { count } = await tx.companyProposal.updateMany({
    where: { id: proposal.id, status: "OPEN" },
    data: { ...tally, status: outcome, resolvedIxTime: now },
  });
  if (count !== 1) return [];
  if (outcome === "REJECTED") return closeTx(tx, proposal, "REJECTED");
  return executeTx(tx, proposal, now);
}

const PASSED_HEADLINES: Record<string, string> = {
  DISSOLVE: "shareholders vote to dissolve",
  ISSUE_SHARES: "shareholders approve a new share issue",
};

/** A passed vote on the feed (an acquisition publishes its own headline). Dissolving is a headline. */
async function publishPassedVoteTx(tx: Db, proposal: CompanyProposal): Promise<void> {
  const what = PASSED_HEADLINES[proposal.type];
  if (!what) return;
  const company = await tx.company.findUnique({
    where: { id: proposal.companyId },
    select: { name: true, realmId: true },
  });
  if (!company) return;
  await publishNewsTx(tx, {
    realmId: company.realmId,
    kind: "vote_passed",
    prominence: proposal.type === "DISSOLVE" ? "HEADLINE" : "ACTIVITY",
    sourceKind: "COMPANY",
    sourceId: proposal.companyId,
    headline: `${company.name}: ${what}`,
    companyId: proposal.companyId,
    key: `news:vote_passed:${proposal.id}`,
  });
}

async function executeTx(
  tx: Db,
  proposal: CompanyProposal,
  now: number
): Promise<ExchangeNotice[]> {
  await publishPassedVoteTx(tx, proposal);
  switch (proposal.type) {
    case "DISSOLVE": {
      const { notices } = await dissolveCompanyTx(tx, {
        userId: proposal.proposerUserId,
        companyId: proposal.companyId,
      });
      return notices;
    }
    case "ISSUE_SHARES": {
      const { shares } = proposal.payload as { shares: number };
      const issued = await issueSharesTx(tx, {
        userId: proposal.proposerUserId,
        companyId: proposal.companyId,
        shares,
        requestId: `proposal:${proposal.id}`,
      });
      return issued.notices;
    }
    case "ACQUIRE_OFFER":
      return executeAcquisition(tx, proposal, now);
    default:
      throw new ExchangeError("CONFLICT", "This proposal can't be carried out");
  }
}

/**
 * Close a proposal that was refused or ran out of time: an acquisition offer goes back to the buyer,
 * and the proposer is told.
 */
async function closeTx(
  tx: Db,
  proposal: CompanyProposal,
  outcome: "REJECTED" | "EXPIRED"
): Promise<ExchangeNotice[]> {
  if (proposal.type === "ACQUIRE_OFFER") {
    const { buyerCompanyId, offerAmount } = acquirePayloadOf(proposal.payload);
    await returnOfferTx(tx, {
      companyId: buyerCompanyId,
      founderId: proposal.proposerUserId,
      amount: offerAmount,
      key: `exchange:acquire-return:${proposal.id}`,
    });
  }
  const label = PROPOSAL_LABELS[proposal.type] ?? "proposal";
  const reason = outcome === "EXPIRED" ? "ran out of time" : "was voted down";
  return [
    {
      userId: proposal.proposerUserId,
      title: `Your ${label} ${reason}`,
      message: "The company was left as it was.",
    },
  ];
}

/** Open a proposal a founder asked for. It executes at once when the founder holds more than half. */
export async function openProposal(db: PrismaClient, input: OpenProposalInput) {
  const key = `exchange:proposal:${input.userId}:${input.requestId}`;
  const { proposal, notices, alreadyApplied } = await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await lockCompany(tx, input.companyId);
    const applied = await tx.companyProposal.findUnique({ where: { idempotencyKey: key } });
    if (applied) return { proposal: applied, notices: [], alreadyApplied: true };

    await requireOwnedCompany(tx, input.companyId, input.userId);
    const payload = payloadFor(input);
    await assertNoOpenProposal(tx, input.companyId, input.type);
    const now = Date.now();
    const created = await openRecordTx(
      tx,
      {
        companyId: input.companyId,
        type: input.type,
        payload,
        proposerUserId: input.userId,
        idempotencyKey: key,
      },
      now
    );
    const settled = await settleTx(tx, created, now);
    const current = await tx.companyProposal.findUniqueOrThrow({ where: { id: created.id } });
    return { proposal: current, notices: settled, alreadyApplied: false };
  });
  notifyExchange(notices);
  return { proposal, alreadyApplied };
}

async function assertNoOpenProposal(tx: Db, companyId: string, type: OwnerProposalType) {
  const open = await tx.companyProposal.count({ where: { companyId, type, status: "OPEN" } });
  if (open > 0) {
    throw new ExchangeError("CONFLICT", "A proposal of this kind is already open for this company");
  }
}

/**
 * Cast or change a shareholder's ballot on an OPEN proposal. The vote may settle the proposal, which then
 * executes in the same transaction. If the action fails, the vote is rolled back with it.
 */
export async function castVote(db: PrismaClient, input: CastVoteInput) {
  const found = await db.companyProposal.findUnique({
    where: { id: input.proposalId },
    select: { companyId: true },
  });
  if (!found) throw new ExchangeError("NOT_FOUND", "Proposal not found");
  const { proposal, notices } = await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await lockCompany(tx, found.companyId);
    const current = await tx.companyProposal.findUnique({ where: { id: input.proposalId } });
    if (!current || current.status !== "OPEN") {
      throw new ExchangeError("CONFLICT", "This proposal is closed");
    }
    const now = Date.now();
    if (current.expiresIxTime <= now) {
      throw new ExchangeError("CONFLICT", "This proposal has run out of time");
    }
    const weight = await weightOf(tx, current.companyId, input.userId);
    if (weight <= 0) {
      throw new ExchangeError("FORBIDDEN", "Only shareholders can vote on this proposal");
    }
    await recordBallotTx(tx, current.id, input.userId, input.support, weight);
    const settled = await settleTx(tx, current, now);
    const updated = await tx.companyProposal.findUniqueOrThrow({ where: { id: current.id } });
    return { proposal: updated, notices: settled };
  });
  notifyExchange(notices);
  return { proposal };
}

/**
 * Settle a company's OPEN proposals whose window has closed: each is EXPIRED once, and an expired
 * acquisition offer goes back to the buyer. Runs from the market tick, one company at a time.
 */
export async function finalizeProposalsTx(
  tx: Db,
  companyId: string,
  now: number
): Promise<{ expired: number; notices: ExchangeNotice[] }> {
  await lockCompany(tx, companyId);
  const due = await tx.companyProposal.findMany({
    where: { companyId, status: "OPEN", expiresIxTime: { lte: now } },
  });
  const notices: ExchangeNotice[] = [];
  let expired = 0;
  for (const proposal of due) {
    const { count } = await tx.companyProposal.updateMany({
      where: { id: proposal.id, status: "OPEN" },
      data: { status: "EXPIRED", resolvedIxTime: now },
    });
    if (count !== 1) continue;
    expired++;
    notices.push(...(await closeTx(tx, proposal, "EXPIRED")));
  }
  return { expired, notices };
}

/**
 * Settle an ACQUIRE decision once its day has passed. A valid offer opens an acquisition proposal on the
 * target and passes at once if the buyer's founder already holds more than half of it. An offer the
 * target can't take is handed back to the buyer. Runs inside the decision's transaction.
 */
export async function resolveAcquireDecision(
  tx: Db,
  decision: CompanyDecision,
  now: number,
  notices: ExchangeNotice[]
): Promise<void> {
  const payload = (decision.payload ?? {}) as AcquireDecisionPayload;
  const buyer = await tx.company.findUniqueOrThrow({ where: { id: decision.companyId } });
  const offerAmount = payload.offerAmount ?? 0;
  const targetId = payload.targetCompanyId ?? "";
  if (targetId) await lockCompany(tx, targetId);

  const blocked = await acquisitionBlocker(tx, buyer, targetId, offerAmount);
  if (blocked) {
    await returnOfferTx(tx, {
      companyId: buyer.id,
      founderId: buyer.founderId,
      amount: offerAmount,
      key: `exchange:acquire-return:decision:${decision.id}`,
    });
    await tx.companyDecision.update({
      where: { id: decision.id },
      data: { effect: { rejected: blocked, refunded: offerAmount } },
    });
    notices.push({
      userId: buyer.founderId,
      title: `${buyer.name}: offer not made`,
      message: blocked,
    });
    return;
  }

  const proposal = await openRecordTx(
    tx,
    {
      companyId: targetId,
      type: "ACQUIRE_OFFER",
      payload: { buyerCompanyId: buyer.id, offerAmount },
      proposerUserId: buyer.founderId,
      idempotencyKey: `exchange:acquire-proposal:${decision.id}`,
    },
    now
  );
  await tx.companyDecision.update({
    where: { id: decision.id },
    data: { effect: { proposalId: proposal.id, offerAmount } },
  });
  notices.push(...(await settleTx(tx, proposal, now)));
}

/** A company's proposals, newest first. */
export async function listProposals(db: Db, companyId: string) {
  return db.companyProposal.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      payload: true,
      status: true,
      proposerUserId: true,
      sharesFor: true,
      sharesAgainst: true,
      totalEligibleShares: true,
      expiresIxTime: true,
      resolvedIxTime: true,
      createdAt: true,
    },
  });
}
