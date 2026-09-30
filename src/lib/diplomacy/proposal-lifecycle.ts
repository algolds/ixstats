/**
 * Lifecycle rules for player-to-player diplomatic proposals that wait on consent:
 * cooperative foreign-policy proposals (ForeignPolicyAction, status "proposed") and
 * alliance invites (AllianceMember, status "invited").
 *
 * A pending proposal ends in one of: accepted ("active"), "declined", "withdrawn" (by the
 * proposer) or "expired" (no answer within PROPOSAL_TTL_DAYS real days). Expiry is enforced
 * lazily — lists hide stale rows, responses reject them — and the rows are marked "expired"
 * whenever they are touched, plus by the diplomatic-drift cron sweep.
 */

/** Real (not IxTime) days a pending proposal or invite stays answerable. */
export const PROPOSAL_TTL_DAYS = 14;
export const PROPOSAL_TTL_MS = PROPOSAL_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Foreign-policy actions that need the target's consent before they take effect. */
export const COOPERATIVE_FP_TYPES = ["free_trade", "military_alliance"] as const;

export const PROPOSAL_STATUS = {
  pending: "proposed",
  accepted: "active",
  declined: "declined",
  withdrawn: "withdrawn",
  expired: "expired",
} as const;

export const INVITE_STATUS = {
  pending: "invited",
  accepted: "active",
  declined: "declined",
  withdrawn: "withdrawn",
  expired: "expired",
} as const;

/** Rows issued before this instant have expired. */
export function proposalExpiryCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - PROPOSAL_TTL_MS);
}

export function proposalExpiresAt(issuedAt: Date): Date {
  return new Date(new Date(issuedAt).getTime() + PROPOSAL_TTL_MS);
}

export function isProposalExpired(issuedAt: Date, now: Date = new Date()): boolean {
  return proposalExpiresAt(issuedAt).getTime() <= now.getTime();
}

/** When an alliance invite was issued: `invitedAt`, or `updatedAt` on rows that predate it. */
export function inviteIssuedAt(invite: { invitedAt?: Date | null; updatedAt: Date }): Date {
  return invite.invitedAt ?? invite.updatedAt;
}

/** Prisma filter for alliance invites issued before `cutoff` (legacy rows fall back to updatedAt). */
export function staleInviteWhere(cutoff: Date) {
  return {
    OR: [{ invitedAt: { lt: cutoff } }, { invitedAt: null, updatedAt: { lt: cutoff } }],
  };
}

interface ExpiryDb {
  foreignPolicyAction: { updateMany: (args: any) => Promise<{ count: number }> };
  allianceMember: { updateMany: (args: any) => Promise<{ count: number }> };
}

export interface ProposalExpiryResult {
  proposalsExpired: number;
  invitesExpired: number;
}

/**
 * Mark stale pending proposals and invites as "expired". With `countryId`, only rows where
 * that country is the proposer or the target are touched (the lazy, per-request path);
 * without it, every stale row is swept (the cron path).
 */
export async function expireStaleDiplomaticProposals(
  db: ExpiryDb,
  opts: { countryId?: string; now?: Date } = {}
): Promise<ProposalExpiryResult> {
  const cutoff = proposalExpiryCutoff(opts.now);
  const { countryId } = opts;

  const proposals = await db.foreignPolicyAction.updateMany({
    where: {
      status: PROPOSAL_STATUS.pending,
      createdAt: { lt: cutoff },
      ...(countryId ? { OR: [{ initiatorId: countryId }, { targetId: countryId }] } : {}),
    },
    data: { status: PROPOSAL_STATUS.expired },
  });

  const invites = await db.allianceMember.updateMany({
    where: {
      status: INVITE_STATUS.pending,
      isActive: false,
      AND: [
        staleInviteWhere(cutoff),
        ...(countryId ? [{ OR: [{ countryId }, { invitedByCountryId: countryId }] }] : []),
      ],
    },
    data: { status: INVITE_STATUS.expired },
  });

  return { proposalsExpired: proposals.count, invitesExpired: invites.count };
}
