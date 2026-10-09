/**
 * Appeals (M12, owner decision): a member appeals each of their active warnings and bans once. Another moderator with
 * scope over the subject reviews it: never the appellant and never an issuer (for an automatic ban, M2, whoever's
 * warning issued it or raised it a tier). An overturn revokes the warning (with M3's re-tier) or lifts the ban inside
 * the review's transaction, under the member's lock, with every log row. Notices are the router's, after commit (M13).
 * No archived-realm check (T0-6).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ForumViewer } from "./access";
import { ForumError, isUniqueViolation } from "./errors";
import {
  appealSubjectTypeOf,
  isSubjectActive,
  loadSubject,
  subjectIssuers,
  subjectScope,
  type AppealDecision,
  type AppealOutcome,
  type AppealSubject,
  type AppealSubjectType,
} from "./mod-appeal-subjects";
import type { AutoBanChange } from "./mod-auto-bans";
import { assertBanScope, liftBanTx } from "./mod-bans";
import { logModAction } from "./mod-log";
import { lockMember } from "./mod-scope";
import { assertWarningScope, revokeWarningTx } from "./mod-warnings";
import type { ForumActor } from "./writes";

export type AppealsDb = Pick<
  PrismaClient,
  | "forumAppeal"
  | "forumWarning"
  | "forumBan"
  | "forumCategory"
  | "forumModLog"
  | "$transaction"
  | "$executeRaw"
>;
/** What a review did, for the router's notices after commit. */
export interface AppealReview {
  userId: string;
  subjectType: AppealSubjectType;
  /** The reviewer's outcome, or `moot` when the subject had already ended. */
  outcome: AppealDecision;
  /** An overturned warning's effect on the member's automatic ban (M3). */
  autoBan: AutoBanChange | null;
}

const BODY_MIN = 10;
const BODY_MAX = 4000;
const RESPONSE_MAX = 2000;

function appealBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length < BODY_MIN || trimmed.length > BODY_MAX) {
    throw new ForumError("BAD_REQUEST", `An appeal is ${BODY_MIN} to ${BODY_MAX} characters.`);
  }
  return trimmed;
}

function appealResponse(response: string): string {
  const trimmed = response.trim();
  if (trimmed.length < 1 || trimmed.length > RESPONSE_MAX) {
    throw new ForumError("BAD_REQUEST", `A response is 1 to ${RESPONSE_MAX} characters.`);
  }
  return trimmed;
}

const alreadyAppealed = (type: AppealSubjectType) =>
  new ForumError("CONFLICT", `You have already appealed this ${type}.`);

/**
 * The member appeals their own active warning or ban (M12), once (CONFLICT after that, whatever the first one's
 * outcome). Checked under the member's lock, so a lift or revoke in flight is seen. Filing is not a moderator action
 * and writes no log row.
 */
export async function fileAppeal(
  db: AppealsDb,
  actor: ForumActor,
  input: { subjectType: AppealSubjectType; subjectId: string; body: string }
): Promise<{ appealId: string }> {
  const body = appealBody(input.body);
  const { subjectType, subjectId } = input;
  try {
    return await db.$transaction(async (tx) => {
      await lockMember(tx, actor.id);
      const now = new Date();
      const subject = await loadSubject(tx, subjectType, subjectId);
      if (!subject || subject.userId !== actor.id) {
        throw new ForumError("BAD_REQUEST", "You can only appeal your own warnings and bans.");
      }
      if (!isSubjectActive(subject, now)) {
        throw new ForumError("BAD_REQUEST", `This ${subjectType} is no longer active.`);
      }
      const existing = await tx.forumAppeal.findFirst({
        where: { subjectType, subjectId },
        select: { id: true },
      });
      if (existing) throw alreadyAppealed(subjectType);
      const appeal = await tx.forumAppeal.create({
        data: { subjectType, subjectId, userId: actor.id, body },
      });
      return { appealId: appeal.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw alreadyAppealed(subjectType);
    throw error;
  }
}

/** Scope over the subject: the ban's scope, or the warning's category (site admins for site ones). */
function assertSubjectScope(
  db: Pick<AppealsDb, "forumCategory">,
  actor: ForumViewer,
  subject: AppealSubject
): Promise<NonNullable<ForumViewer>> {
  return subject.kind === "ban"
    ? assertBanScope(db, actor, subject)
    : assertWarningScope(db, actor, subject.categoryId);
}

/** The owner's rule: someone other than the issuer reviews; and nobody reviews their own appeal. */
async function assertOtherReviewer(
  db: Pick<AppealsDb, "forumModLog">,
  reviewer: NonNullable<ForumViewer>,
  appellantId: string,
  subject: AppealSubject
): Promise<void> {
  if (reviewer.id === appellantId) {
    throw new ForumError("FORBIDDEN", "You can't review your own appeal.");
  }
  const issuers = await subjectIssuers(db, [subject]);
  if (issuers.get(`${subject.kind}:${subject.id}`)?.has(reviewer.id)) {
    throw new ForumError("FORBIDDEN", "Another moderator must review this appeal.");
  }
}

/** Lifts the ban, or revokes the warning with M3's re-tier, through the review's transaction and clock. */
async function overturn(
  tx: Prisma.TransactionClient,
  reviewer: NonNullable<ForumViewer>,
  subject: AppealSubject,
  appealId: string,
  now: Date
): Promise<AutoBanChange | null> {
  const detail = { reason: "appeal overturned", appealId };
  if (subject.kind === "ban") {
    await liftBanTx(tx, reviewer, subject, detail, now);
    return null;
  }
  return (await revokeWarningTx(tx, reviewer, subject, detail, now)).autoBan;
}

/**
 * A moderator with scope over the subject decides an open appeal. Scope is checked first (an out-of-scope moderator
 * learns nothing about its status, only that it exists), then the status, then, under the member's lock, the
 * different-reviewer rule. A subject that already ended (lifted, revoked or expired, bans and warnings alike) closes
 * the appeal as `moot` (`appeal.moot`) whatever the outcome asked. Otherwise the decision, its `appeal.review` row and
 * an overturn's lift or revoke (with their own rows) commit together; a lost race rolls all of it back (CONFLICT).
 */
export async function reviewAppeal(
  db: AppealsDb,
  actor: ForumViewer,
  input: { appealId: string; outcome: AppealOutcome; response: string }
): Promise<AppealReview> {
  const response = appealResponse(input.response);
  const appeal = await db.forumAppeal.findUnique({
    where: { id: input.appealId },
    select: { id: true, subjectType: true, subjectId: true, userId: true, status: true },
  });
  const type = appeal && appealSubjectTypeOf(appeal.subjectType);
  const subject = appeal && type ? await loadSubject(db, type, appeal.subjectId) : null;
  if (!appeal || !subject) throw new ForumError("NOT_FOUND", "Appeal not found.");
  const reviewer = await assertSubjectScope(db, actor, subject);
  const reviewed = new ForumError("CONFLICT", "This appeal is already closed.");
  if (appeal.status !== "open") throw reviewed;
  const now = new Date();
  return db.$transaction(async (tx) => {
    await lockMember(tx, appeal.userId);
    await assertOtherReviewer(tx, reviewer, appeal.userId, subject);
    const current = await loadSubject(tx, subject.kind, subject.id);
    const outcome: AppealDecision =
      current && isSubjectActive(current, now) ? input.outcome : "moot";
    const { count } = await tx.forumAppeal.updateMany({
      where: { id: appeal.id, status: "open" },
      data: { status: outcome, reviewedBy: reviewer.id, reviewedAt: now, response },
    });
    if (count === 0) throw reviewed;
    await logModAction(tx, {
      actorId: reviewer.id,
      action: outcome === "moot" ? "appeal.moot" : "appeal.review",
      targetType: "appeal",
      targetId: appeal.id,
      scope: subjectScope(subject),
      detail: { outcome, subjectType: subject.kind, subjectId: subject.id },
    });
    const autoBan =
      outcome === "overturned" ? await overturn(tx, reviewer, subject, appeal.id, now) : null;
    return { userId: appeal.userId, subjectType: subject.kind, outcome, autoBan };
  });
}
