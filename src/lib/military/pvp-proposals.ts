/**
 * PvP challenge lifecycle. A challenge (`MilitaryConflict`, type "pvp", status "proposed") waits on
 * the defender, who may accept or decline whatever their tier. It ends unanswered when the
 * challenger withdraws it or when it expires after PROPOSAL_TTL_DAYS real days (the same answer
 * window as diplomatic proposals). Ended challenges are stored as status "resolved" with
 * `winner` naming how they ended; expiry is applied lazily (mutations mark the rows, reads show
 * stale ones as expired).
 */
import { isProposalExpired, proposalExpiryCutoff } from "~/lib/diplomacy/proposal-lifecycle";

/** `winner` of a challenge that ended without a battle. */
export const PVP_UNFOUGHT = {
  declined: "declined",
  withdrawn: "withdrawn",
  expired: "expired",
} as const;

const UNFOUGHT = new Set<string>(Object.values(PVP_UNFOUGHT));

/** True for a resolved conflict that ended without a battle (declined, withdrawn, expired). */
export function isUnfoughtConflict(winner: string | null): boolean {
  return winner !== null && UNFOUGHT.has(winner);
}

/** A pending challenge past its answer window reads as expired. */
export function withPvPExpiry<T extends { status: string; winner: string | null; createdAt: Date }>(
  conflict: T
): T {
  if (conflict.status !== "proposed" || !isProposalExpired(conflict.createdAt)) return conflict;
  return { ...conflict, status: "resolved", winner: PVP_UNFOUGHT.expired };
}

/** Prisma filter for the stale pending challenges between two nations (either direction). */
export function stalePvPProposalsBetween(a: string, b: string, now: Date = new Date()) {
  return {
    status: "proposed",
    createdAt: { lt: proposalExpiryCutoff(now) },
    OR: [
      { initiatorId: a, defenderId: b },
      { initiatorId: b, defenderId: a },
    ],
  };
}

/** The data that marks a pending challenge expired. */
export const EXPIRED_PVP_DATA = { status: "resolved", winner: PVP_UNFOUGHT.expired } as const;
