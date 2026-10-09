/**
 * Warnings and their points (phase 3, owner decisions): points expire after 90 days and count sitewide whoever gave
 * them (M4); enough active points bring an automatic site ban (mod-auto-bans.ts), and revoking a warning re-tiers
 * or lifts it (M3). Every step logs in the same transaction. Notifications are the router's, after
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
import { autoBanAfterRevoke, autoBanAfterWarning, type AutoBanChange } from "./mod-auto-bans";
import { logModAction, modNote, modReason, type ModLogDetail } from "./mod-log";
import {
  assertModeratesCategory,
  assertSanctionable,
  assertScope,
  canActInScope,
  canModerateCategory,
  listingScope,
  lockMember,
  pageWindow,
  type ModScope,
} from "./mod-scope";

export type WarningsDb = Pick<
  PrismaClient,
  | "forumWarning"
  | "forumBan"
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
type WarningTx = Pick<WarningsDb, "forumWarning" | "forumBan" | "forumModLog" | "$executeRaw">;

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

export const WARNINGS_PER_PAGE = 25;
const SITE: ModScope = { kind: "site" };
const CATEGORY_SELECT = { id: true, scope: true, realmId: true } as const;

/** A warning's log scope: the category it was given in, or the site. */
const warningScope = (categoryId: string | null): ModScope =>
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
  },
  now: Date
): Promise<WarningOutcome> {
  await lockMember(tx, warning.userId);
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
  const now = new Date();
  return db.$transaction((tx) =>
    recordWarning(tx, issuer, { ...input, reason, points, categoryId: category?.id ?? null }, now)
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
 * Task 5's reviewAppeal calls this with its own transaction client; it includes M3's recompute (the automatic ban
 * re-tiered or lifted). The warning must still be unrevoked once the member's lock is held (CONFLICT otherwise).
 */
export async function revokeWarningTx(
  tx: WarningTx,
  actor: Issuer,
  warning: { id: string; userId: string; categoryId: string | null },
  detail: ModLogDetail
): Promise<{ autoBan: AutoBanChange | null }> {
  const now = new Date();
  await lockMember(tx, warning.userId);
  const { count } = await tx.forumWarning.updateMany({
    where: { id: warning.id, revokedAt: null },
    data: { revokedAt: now, revokedBy: actor.id },
  });
  if (count === 0) throw new ForumError("CONFLICT", "This warning is already revoked.");
  await logModAction(tx, {
    actorId: actor.id,
    action: "warning.revoke",
    targetType: "user",
    targetId: warning.userId,
    scope: warningScope(warning.categoryId),
    detail: { ...detail, warningId: warning.id },
  });
  const points = await activePointsOf(tx, warning.userId, now);
  const autoBan = await autoBanAfterRevoke(tx, actor, warning.userId, points, now, {
    reason: "warning revoked",
    warningId: warning.id,
  });
  return { autoBan };
}

export async function revokeWarning(
  db: WarningsDb,
  actor: ForumViewer,
  input: { warningId: string; note?: string }
): Promise<{ autoBan: AutoBanChange | null }> {
  const warning = await db.forumWarning.findUnique({
    where: { id: input.warningId },
    select: { id: true, userId: true, categoryId: true },
  });
  if (!warning) throw new ForumError("NOT_FOUND", "Warning not found.");
  const revoker = await assertWarningScope(db, actor, warning.categoryId);
  const note = modNote(input.note);
  return db.$transaction((tx) => revokeWarningTx(tx, revoker, warning, { note }));
}

/** Warnings in the viewer's scope (their categories; site admins everything), newest first. */
export async function listWarnings(
  db: Pick<WarningsDb, "forumWarning" | "forumCategory">,
  viewer: ForumViewer,
  filter: { userId?: string; realmId?: string | null; activeOnly?: boolean },
  page: number
) {
  const listing = await listingScope(db, viewer, filter.realmId);
  const where = {
    AND: [
      filter.activeOnly ? { revokedAt: null, expiresAt: { gt: new Date() } } : {},
      listing === null ? {} : { categoryId: { in: listing.categoryIds } },
      filter.userId ? { userId: filter.userId } : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.forumWarning.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageWindow(page, WARNINGS_PER_PAGE),
      select: {
        id: true,
        userId: true,
        issuedBy: true,
        reason: true,
        points: true,
        targetType: true,
        targetId: true,
        categoryId: true,
        expiresAt: true,
        revokedAt: true,
        revokedBy: true,
        createdAt: true,
      },
    }),
    db.forumWarning.count({ where }),
  ]);
  return { rows, total };
}
