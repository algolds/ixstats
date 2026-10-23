/**
 * Wiki name claims (IxnayID design decisions 3, 5, 6 and 7): a player asks for an old IxWiki name, an administrator
 * approves, rejects or later revokes it, or links a name to an account directly. One account holds a name at a time.
 * Every write runs in one transaction under the name's lock (41103, taken alone) and leaves an audit row. An approval
 * tags the name's unauthored revisions for the account in that transaction; the claim-approval hooks run only after it
 * commits, outside every lock, and a failing hook never undoes the approval.
 *
 * A name never approves for one account while another account's passport handle spells it (MediaWiki-normalised);
 * `setUserHandle` checks the other way round under the same lock.
 *
 * Plan 409's rule: imported MediaWiki groups pass with a name only when a system owner approved or linked it
 * (`rightsPass`), and an administrator who is not a system owner cannot approve or link a name for their own account.
 */
import type {
  Prisma,
  PrismaClient,
  WikiNameClaim,
  WikiNameClaimOrigin,
  WikiNameClaimStatus,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  runClaimApprovedHooks,
  type ClaimApprovedEvent,
  type ClaimApprovedHook,
} from "~/lib/identity/claim-hooks";
import {
  lockWikiNameTx,
  tagClaimRevisionsTx,
  TAG_TX_OPTIONS,
  untagClaimRevisionsTx,
} from "~/lib/identity/claim-tags";
import { checkClaimName, claimName, handleOfWikiName, IXWIKI } from "~/lib/identity/wiki-names";

export type NameClaimErrorCode =
  | "INVALID_NAME"
  | "TAKEN"
  | "ALREADY_REQUESTED"
  | "TOO_MANY_PENDING"
  | "NOT_FOUND"
  | "NOT_PENDING"
  | "NOT_APPROVED"
  | "NOT_ALLOWED"
  | "HANDLE_TAKEN";

export class NameClaimError extends Error {
  constructor(
    readonly code: NameClaimErrorCode,
    message: string
  ) {
    super(message);
    this.name = "NameClaimError";
  }
}

/** The tRPC code each refusal maps to. */
const NAME_CLAIM_HTTP: Readonly<
  Record<NameClaimErrorCode, "BAD_REQUEST" | "CONFLICT" | "FORBIDDEN" | "NOT_FOUND">
> = {
  INVALID_NAME: "BAD_REQUEST",
  TAKEN: "CONFLICT",
  ALREADY_REQUESTED: "BAD_REQUEST",
  TOO_MANY_PENDING: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  NOT_PENDING: "BAD_REQUEST",
  NOT_APPROVED: "BAD_REQUEST",
  NOT_ALLOWED: "FORBIDDEN",
  HANDLE_TAKEN: "CONFLICT",
};

/** For a router's `.catch`: a refusal as a tRPC error, its message kept; any other error passes through. */
export function toNameClaimTrpcError(error: Error): never {
  if (error instanceof NameClaimError) {
    throw new TRPCError({ code: NAME_CLAIM_HTTP[error.code], message: error.message });
  }
  throw error;
}

export const MAX_PENDING_CLAIMS = 10;

/** INVALID_NAME carries `checkClaimName`'s own message. */
const MESSAGES: Readonly<Record<Exclude<NameClaimErrorCode, "INVALID_NAME">, string>> = {
  TAKEN: "That name already belongs to another account.",
  ALREADY_REQUESTED: "You already hold or asked for this name.",
  TOO_MANY_PENDING: `You have ${MAX_PENDING_CLAIMS} names waiting for review. Wait for a decision first.`,
  NOT_FOUND: "No such name claim.",
  NOT_PENDING: "This claim was already decided.",
  NOT_APPROVED: "Only an approved name can be removed.",
  NOT_ALLOWED: "You cannot approve a name for your own account: ask another administrator.",
  HANDLE_TAKEN: "That name is another player's passport handle.",
};

export interface ClaimActor {
  userId: string;
  clerkUserId: string;
  isSystemOwner: boolean;
}

export interface NameClaimView {
  id: string;
  userId: string;
  name: string;
  status: WikiNameClaimStatus;
  visible: boolean;
  rightsPass: boolean;
  origin: WikiNameClaimOrigin;
  evidence: string | null;
  decisionNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

type ClaimsDb = Pick<
  PrismaClient,
  | "wikiNameClaim"
  | "wikiRevision"
  | "wikiRevisionClaimTag"
  | "adminAuditLog"
  | "user"
  | "$transaction"
>;
type Tx = Prisma.TransactionClient;

type AuditAction =
  | "WIKI_NAME_CLAIM_REQUESTED"
  | "WIKI_NAME_CLAIM_VISIBILITY"
  | "WIKI_NAME_CLAIM_APPROVED"
  | "WIKI_NAME_CLAIM_REJECTED"
  | "WIKI_NAME_CLAIM_REVOKED"
  | "WIKI_NAME_LINKED";

type AuditChanges = Record<string, string | number | boolean | null>;

interface Approval {
  view: NameClaimView;
  /** null: nothing was approved (an admin link of a name the account already holds). */
  event: ClaimApprovedEvent | null;
}

const refuse = (code: Exclude<NameClaimErrorCode, "INVALID_NAME">) =>
  new NameClaimError(code, MESSAGES[code]);

/** Trimmed, or null when blank. */
const clean = (text: string | null): string | null => text?.trim() || null;

function validName(raw: string): string {
  const check = checkClaimName(raw);
  if (!check.ok) throw new NameClaimError("INVALID_NAME", check.message);
  return check.name;
}

const toView = (claim: WikiNameClaim): NameClaimView => ({
  id: claim.id,
  userId: claim.userId,
  name: claim.name,
  status: claim.status,
  visible: claim.visible,
  rightsPass: claim.rightsPass,
  origin: claim.origin,
  evidence: claim.evidence,
  decisionNote: claim.decisionNote,
  createdAt: claim.createdAt,
  decidedAt: claim.decidedAt,
});

/** A non-owner administrator never decides a name for their own account. */
const isOwnAccount = (actor: ClaimActor, userId: string) =>
  userId === actor.userId && !actor.isSystemOwner;

async function audit(
  tx: Tx,
  actor: ClaimActor,
  action: AuditAction,
  claim: Pick<WikiNameClaim, "id" | "name">,
  changes: AuditChanges
): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      action,
      targetType: "wiki_name_claim",
      targetId: claim.id,
      targetName: claim.name,
      changes: JSON.stringify(changes),
      adminId: actor.userId,
      adminName: actor.clerkUserId,
    },
  });
}

/** The claim, read again once its name's lock is held (the first read only finds the name to lock). */
async function lockClaimTx(tx: Tx, claimId: string): Promise<WikiNameClaim> {
  const found = await tx.wikiNameClaim.findUnique({
    where: { id: claimId },
    select: { name: true },
  });
  if (!found) throw refuse("NOT_FOUND");
  await lockWikiNameTx(tx, IXWIKI, found.name);
  const claim = await tx.wikiNameClaim.findUnique({ where: { id: claimId } });
  if (!claim) throw refuse("NOT_FOUND");
  return claim;
}

/**
 * Whether an account other than `userId` has a passport handle that MediaWiki normalises to `name`; the caller holds
 * the name's lock. Every such handle holds each word of the name, so those narrow the read.
 */
async function handleSpellsNameTx(tx: Tx, name: string, userId: string): Promise<boolean> {
  const words = handleOfWikiName(name).split("_");
  const users = await tx.user.findMany({
    where: { NOT: { id: userId }, AND: words.map((word) => ({ handle: { contains: word } })) },
    select: { handle: true },
  });
  return users.some((user) => user.handle !== null && claimName(user.handle) === name);
}

/** The PENDING and APPROVED claims on a name; the caller holds its lock. */
const liveClaimsTx = (tx: Tx, name: string) =>
  tx.wikiNameClaim.findMany({
    where: { source: IXWIKI, name, status: { in: ["PENDING", "APPROVED"] } },
  });

export function createNameClaimService(
  db: ClaimsDb,
  deps: { hooks?: readonly ClaimApprovedHook[]; now?: () => Date } = {}
) {
  const now = deps.now ?? (() => new Date());
  const inTx = <T>(work: (tx: Tx) => Promise<T>) => db.$transaction(work, TAG_TX_OPTIONS);

  /** Under the name's lock: the TAKEN and HANDLE_TAKEN checks, the approval, the revision tags and the audit row. */
  async function approveTx(
    tx: Tx,
    actor: ClaimActor,
    claim: WikiNameClaim,
    opts: {
      note: string | null;
      mwUserId: number | null;
      action: AuditAction;
      origin: ClaimApprovedEvent["origin"];
    }
  ): Promise<Approval> {
    const holder = await tx.wikiNameClaim.findFirst({
      // the claim itself is never APPROVED here: approve and adminLink only pass a PENDING one
      where: { source: IXWIKI, name: claim.name, status: "APPROVED" },
      select: { id: true },
    });
    if (holder) throw refuse("TAKEN");
    if (await handleSpellsNameTx(tx, claim.name, claim.userId)) throw refuse("HANDLE_TAKEN");
    const decidedAt = now();
    const note = clean(opts.note);
    const saved = await tx.wikiNameClaim.update({
      where: { id: claim.id },
      data: {
        status: "APPROVED",
        decidedById: actor.userId,
        decidedAt,
        decisionNote: note,
        rightsPass: actor.isSystemOwner,
        ...(opts.mwUserId === null ? {} : { mwUserId: opts.mwUserId }),
      },
    });
    const tagged = await tagClaimRevisionsTx(tx, {
      id: saved.id,
      userId: saved.userId,
      source: IXWIKI,
      name: saved.name,
    });
    await audit(tx, actor, opts.action, saved, {
      userId: saved.userId,
      rightsPass: saved.rightsPass,
      tagged,
      mwUserId: saved.mwUserId,
      note,
    });
    return {
      view: toView(saved),
      event: {
        claimId: saved.id,
        userId: saved.userId,
        source: IXWIKI,
        name: saved.name,
        approvedAt: decidedAt,
        origin: opts.origin,
      },
    };
  }

  /** After the commit, outside every lock: a failing hook is logged and the approval stands. */
  async function afterCommit({ view, event }: Approval): Promise<NameClaimView> {
    if (event) await runClaimApprovedHooks(event, deps.hooks);
    return view;
  }

  return {
    async request(actor: ClaimActor, input: { name: string; evidence: string | null }) {
      const name = validName(input.name);
      return inTx(async (tx) => {
        await lockWikiNameTx(tx, IXWIKI, name);
        const live = await liveClaimsTx(tx, name);
        if (live.some((c) => c.userId === actor.userId)) throw refuse("ALREADY_REQUESTED");
        if (live.some((c) => c.status === "APPROVED")) throw refuse("TAKEN");
        const pending = await tx.wikiNameClaim.count({
          where: { userId: actor.userId, status: "PENDING" },
        });
        if (pending >= MAX_PENDING_CLAIMS) throw refuse("TOO_MANY_PENDING");
        const evidence = clean(input.evidence);
        const claim = await tx.wikiNameClaim.create({
          data: {
            userId: actor.userId,
            source: IXWIKI,
            name,
            status: "PENDING",
            visible: true,
            origin: "PLAYER",
            evidence,
            requestedById: actor.userId,
          },
        });
        await audit(tx, actor, "WIKI_NAME_CLAIM_REQUESTED", claim, { name, evidence });
        return toView(claim);
      });
    },

    async setVisibility(actor: ClaimActor, input: { claimId: string; visible: boolean }) {
      return inTx(async (tx) => {
        const claim = await lockClaimTx(tx, input.claimId);
        if (claim.userId !== actor.userId) throw refuse("NOT_FOUND");
        if (claim.status !== "PENDING" && claim.status !== "APPROVED") throw refuse("NOT_PENDING");
        const saved = await tx.wikiNameClaim.update({
          where: { id: claim.id },
          data: { visible: input.visible },
        });
        await audit(tx, actor, "WIKI_NAME_CLAIM_VISIBILITY", saved, { visible: input.visible });
        return toView(saved);
      });
    },

    /** Every claim of the account, every status, newest first. */
    async listMine(userId: string): Promise<NameClaimView[]> {
      const claims = await db.wikiNameClaim.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return claims.map(toView);
    },

    async approve(actor: ClaimActor, input: { claimId: string; note: string | null }) {
      const approval = await inTx(async (tx) => {
        const claim = await lockClaimTx(tx, input.claimId);
        if (claim.status !== "PENDING") throw refuse("NOT_PENDING");
        if (isOwnAccount(actor, claim.userId)) throw refuse("NOT_ALLOWED");
        return approveTx(tx, actor, claim, {
          note: input.note,
          mwUserId: null,
          action: "WIKI_NAME_CLAIM_APPROVED",
          origin: "PLAYER",
        });
      });
      return afterCommit(approval);
    },

    async reject(actor: ClaimActor, input: { claimId: string; note: string | null }) {
      return inTx(async (tx) => {
        const claim = await lockClaimTx(tx, input.claimId);
        if (claim.status !== "PENDING") throw refuse("NOT_PENDING");
        const note = clean(input.note);
        const saved = await tx.wikiNameClaim.update({
          where: { id: claim.id },
          data: {
            status: "REJECTED",
            decidedById: actor.userId,
            decidedAt: now(),
            decisionNote: note,
          },
        });
        await audit(tx, actor, "WIKI_NAME_CLAIM_REJECTED", saved, { userId: saved.userId, note });
        return toView(saved);
      });
    },

    /** Takes the name back and undoes its revision tags; payouts already made stand (design decision 7). No hook. */
    async revoke(actor: ClaimActor, input: { claimId: string; note: string | null }) {
      return inTx(async (tx) => {
        const claim = await lockClaimTx(tx, input.claimId);
        if (claim.status !== "APPROVED") throw refuse("NOT_APPROVED");
        const decidedAt = now();
        const untagged = await untagClaimRevisionsTx(tx, claim, decidedAt);
        const note = clean(input.note);
        const saved = await tx.wikiNameClaim.update({
          where: { id: claim.id },
          data: { status: "REVOKED", decidedById: actor.userId, decidedAt, decisionNote: note },
        });
        await audit(tx, actor, "WIKI_NAME_CLAIM_REVOKED", saved, {
          userId: saved.userId,
          untagged,
          note,
        });
        return toView(saved);
      });
    },

    /**
     * Gives an account a name directly: its own pending claim on the name is approved, a name it already holds comes back
     * unchanged (nothing written), otherwise a new ADMIN_LINK claim is approved.
     */
    async adminLink(
      actor: ClaimActor,
      input: { userId: string; name: string; note: string | null; mwUserId: number | null }
    ) {
      const name = validName(input.name);
      if (isOwnAccount(actor, input.userId)) throw refuse("NOT_ALLOWED");
      const approval = await inTx(async (tx): Promise<Approval> => {
        await lockWikiNameTx(tx, IXWIKI, name);
        const live = await liveClaimsTx(tx, name);
        const held = live.find((c) => c.status === "APPROVED");
        if (held && held.userId !== input.userId) throw refuse("TAKEN");
        if (held) return { view: toView(held), event: null };
        const claim =
          live.find((c) => c.userId === input.userId) ??
          (await tx.wikiNameClaim.create({
            data: {
              userId: input.userId,
              source: IXWIKI,
              name,
              status: "PENDING",
              origin: "ADMIN_LINK",
              requestedById: actor.userId,
            },
          }));
        return approveTx(tx, actor, claim, {
          note: input.note,
          mwUserId: input.mwUserId,
          action: "WIKI_NAME_LINKED",
          origin: "ADMIN_LINK",
        });
      });
      return afterCommit(approval);
    },
  };
}
