/**
 * Warnings and their points (phase 3, owner decisions): points expire after 90 days and count sitewide whoever gave
 * them (M4); enough active points bring an automatic site ban (mod-auto-bans.ts), and revoking a warning that still
 * counted shortens or lifts it (M3). Every step logs in the same transaction. Notifications are the router's, after
 * commit (Task 5). No archived-realm check (T0-6).
 */
import type { PrismaClient } from "@prisma/client";
import {
  activePoints,
  MODERATION_POLICY,
  warningExpiry,
} from "~/lib/thinkpages-forum/moderation-policy";
import { isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import { ForumError } from "./errors";
import { mootOpenAppeal } from "./mod-appeal-moot";
import { autoBanAfterRevoke, autoBanAfterWarning, type AutoBanChange } from "./mod-auto-bans";
import { logModAction, modNote, modReason, type ModLogDetail } from "./mod-log";
import {
  assertModeratesCategory,
  assertSanctionable,
  assertScope,
  canActInScope,
  canModerateCategory,
  lockMember,
  type ModScope,
} from "./mod-scope";

export type WarningsDb = Pick<
  PrismaClient,
  | "forumWarning"
  | "forumBan"
  | "forumAppeal"
  | "forumCategory"
  | "forumThread"
  | "forumPost"
  | "user"
  | "realm"
  | "realmOfficer"
  | "forumCategoryModerator"
  | "forumModLog"
  | "$transaction"
  | "$executeRaw"
>;
type WarningTx = Pick<
  WarningsDb,
  "forumWarning" | "forumBan" | "forumAppeal" | "forumModLog" | "$executeRaw"
>;

export interface WarningInput {
  userId: string;
  points: number;
  reason: string;
  target?: { type: "thread" | "post"; id: string } | null;
}

export interface WarningOutcome {
  warningId: string;
  activePoints: number;
  /** What the warning did to the member's automatic site ban, if anything. */
  autoBan: AutoBanChange | null;
}

type Issuer = NonNullable<ForumViewer>;
interface WarnedCategory {
  id: string;
  scope: string;
  realmId: string | null;
}

const SITE: ModScope = { kind: "site" };
const CATEGORY_SELECT = { id: true, scope: true, realmId: true } as const;

/** A warning's log scope: the category it was given in, or the site. */
export const warningScope = (categoryId: string | null): ModScope =>
  categoryId === null ? SITE : { kind: "category", categoryId };

/** The warned content's category and author (post → thread → category). */
async function targetPlace(
  db: Pick<WarningsDb, "forumThread" | "forumPost">,
  target: NonNullable<WarningInput["target"]>
): Promise<{ authorUserId: string; category: WarnedCategory }> {
  if (target.type === "post") {
    const post = await db.forumPost.findUnique({
      where: { id: target.id },
      select: { authorUserId: true, thread: { select: { category: { select: CATEGORY_SELECT } } } },
    });
    if (!post) throw new ForumError("NOT_FOUND", "Post not found.");
    return { authorUserId: post.authorUserId, category: post.thread.category };
  }
  const thread = await db.forumThread.findUnique({
    where: { id: target.id },
    select: { authorUserId: true, category: { select: CATEGORY_SELECT } },
  });
  if (!thread) throw new ForumError("NOT_FOUND", "Thread not found.");
  return thread;
}

/** Who may give this warning: a moderator of the content's category, or a site admin for a sitewide one. */
async function warningPlace(
  db: WarningsDb,
  actor: ForumViewer,
  input: WarningInput
): Promise<{ issuer: Issuer; category: WarnedCategory | null }> {
  if (!input.target) {
    assertScope(actor, SITE, null);
    return { issuer: actor, category: null };
  }
  const place = await targetPlace(db, input.target);
  assertModeratesCategory(actor, place.category);
  if (place.authorUserId !== input.userId) {
    throw new ForumError("BAD_REQUEST", "You can only warn the author of this content.");
  }
  return { issuer: actor, category: place.category };
}

/** M4: 1 to 5 points from site admins, 1 to 2 from realm and category moderators. */
function warningPoints(issuer: Issuer, points: number): number {
  const { siteAdmin, moderator } = MODERATION_POLICY.maxPointsPerWarning;
  const max = isSiteAdmin(issuer) ? siteAdmin : moderator;
  if (!Number.isInteger(points) || points < 1 || points > max) {
    throw new ForumError("BAD_REQUEST", `A warning carries 1 to ${max} points.`);
  }
  return points;
}

export async function activePointsOf(
  db: Pick<WarningsDb, "forumWarning">,
  userId: string,
  now: Date = new Date()
): Promise<number> {
  const rows = await db.forumWarning.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    select: { points: true, expiresAt: true, revokedAt: true },
  });
  return activePoints(rows, now);
}

async function recordWarning(
  tx: WarningTx,
  issuer: Issuer,
  warning: {
    userId: string;
    points: number;
    reason: string;
    categoryId: string | null;
    target?: WarningInput["target"];
  }
): Promise<WarningOutcome> {
  await lockMember(tx, warning.userId);
  // After the lock: a wait must not date the warning, or count points, from before it.
  const now = new Date();
  const target = { targetType: warning.target?.type ?? null, targetId: warning.target?.id ?? null };
  const row = await tx.forumWarning.create({
    data: {
      userId: warning.userId,
      issuedBy: issuer.id,
      reason: warning.reason,
      points: warning.points,
      ...target,
      categoryId: warning.categoryId,
      createdAt: now,
      expiresAt: warningExpiry(now),
    },
  });
  await logModAction(tx, {
    actorId: issuer.id,
    action: "warning.issue",
    targetType: "user",
    targetId: warning.userId,
    scope: warningScope(warning.categoryId),
    detail: { warningId: row.id, points: warning.points, reason: warning.reason, ...target },
  });
  const points = await activePointsOf(tx, warning.userId, now);
  return {
    warningId: row.id,
    activePoints: points,
    autoBan: await autoBanAfterWarning(tx, issuer, warning.userId, points, now, {
      trigger: "warning",
      warningId: row.id,
    }),
  };
}

export async function issueWarning(
  db: WarningsDb,
  actor: ForumViewer,
  input: WarningInput
): Promise<WarningOutcome> {
  const reason = modReason(input.reason);
  const { issuer, category } = await warningPlace(db, actor, input);
  const points = warningPoints(issuer, input.points);
  await assertSanctionable(db, input.userId, "warned", (target) =>
    category ? canModerateCategory(target, category) : canActInScope(target, SITE, null)
  );
  return db.$transaction((tx) =>
    recordWarning(tx, issuer, { ...input, reason, points, categoryId: category?.id ?? null })
  );
}

/** Refuses unless the actor moderates the warning's category (site admins for sitewide warnings). */
export async function assertWarningScope(
  db: Pick<WarningsDb, "forumCategory">,
  actor: ForumViewer,
  categoryId: string | null
): Promise<Issuer> {
  const category =
    categoryId === null
      ? null
      : await db.forumCategory.findUnique({ where: { id: categoryId }, select: CATEGORY_SELECT });
  if (category) assertModeratesCategory(actor, category);
  else assertScope(actor, SITE, null);
  return actor;
}

/**
 * reviewAppeal calls this with its own transaction client and the `now` it read under the member's lock; without
 * one, the clock is read once the lock is held. It includes M3's recompute (the automatic ban shortened or lifted),
 * only when the warning still counted at `now`: revoking an expired warning changes no active points, so it leaves
 * the ban alone. The warning must still be unrevoked once the member's lock is held (CONFLICT otherwise). An open
 * appeal on the warning is closed as moot in the same transaction.
 */
export async function revokeWarningTx(
  tx: WarningTx,
  actor: Issuer,
  warning: { id: string; userId: string; categoryId: string | null; expiresAt: Date },
  detail: ModLogDetail,
  lockedNow?: Date
): Promise<{ autoBan: AutoBanChange | null }> {
  await lockMember(tx, warning.userId);
  const now = lockedNow ?? new Date();
  const { count } = await tx.forumWarning.updateMany({
    where: { id: warning.id, revokedAt: null },
    data: { revokedAt: now, revokedBy: actor.id },
  });
  if (count === 0) throw new ForumError("CONFLICT", "This warning is already revoked.");
  const scope = warningScope(warning.categoryId);
  await logModAction(tx, {
    actorId: actor.id,
    action: "warning.revoke",
    targetType: "user",
    targetId: warning.userId,
    scope,
    detail: { ...detail, warningId: warning.id },
  });
  await mootOpenAppeal(
    tx,
    actor.id,
    { type: "warning", id: warning.id, scope, cause: "warning revoked" },
    now
  );
  if (warning.expiresAt.getTime() <= now.getTime()) return { autoBan: null };
  const points = await activePointsOf(tx, warning.userId, now);
  const autoBan = await autoBanAfterRevoke(tx, actor, warning.userId, points, now, {
    reason: "warning revoked",
    warningId: warning.id,
  });
  return { autoBan };
}

/** Returns the warned member, for the router's notice when their automatic ban changes. */
export async function revokeWarning(
  db: WarningsDb,
  actor: ForumViewer,
  input: { warningId: string; note?: string }
): Promise<{ userId: string; autoBan: AutoBanChange | null }> {
  const warning = await db.forumWarning.findUnique({
    where: { id: input.warningId },
    select: { id: true, userId: true, categoryId: true, expiresAt: true },
  });
  if (!warning) throw new ForumError("NOT_FOUND", "Warning not found.");
  const revoker = await assertWarningScope(db, actor, warning.categoryId);
  // The different-reviewer rule (M12) for revokes: a member promoted since cannot clear their own record.
  if (revoker.id === warning.userId) {
    throw new ForumError("FORBIDDEN", "You can't revoke your own warning.");
  }
  const note = modNote(input.note);
  const { autoBan } = await db.$transaction((tx) =>
    revokeWarningTx(tx, revoker, warning, { note })
  );
  return { userId: warning.userId, autoBan };
}
