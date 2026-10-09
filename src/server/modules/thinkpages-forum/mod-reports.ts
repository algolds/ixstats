/**
 * Reports (phase 3, M11). A signed-in member reports a thread or post they can see and did not write; a site ban
 * stops them, a realm or category ban does not. One open report per reporter per target, serialized per reporter
 * so a double submit cannot file twice. A report carries its target's category (re-pointed when the thread moves,
 * `moveThread`), which scopes the moderators' queue (mod-report-queue.ts) and who may resolve or dismiss it;
 * resolving writes its ForumModLog row in the same transaction.
 */
import type { PrismaClient } from "@prisma/client";
import { canSeeCategory, canSeeThread, type ForumViewer } from "./access";
import { ForumError } from "./errors";
import { assertNotBanned } from "./mod-bans";
import { logModAction, modNote } from "./mod-log";
import {
  assertCanModerateAuthor,
  assertModeratesCategory,
  assertScope,
  canModerateCategory,
  scopeOfCategory,
  type ModScope,
} from "./mod-scope";
import { visibleRealmOf } from "./reads";
import type { ForumActor } from "./writes";

export type ReportsDb = Pick<
  PrismaClient,
  | "forumReport"
  | "forumThread"
  | "forumPost"
  | "forumCategory"
  | "forumBan"
  | "forumModLog"
  | "realm"
  | "user"
  | "$transaction"
  | "$executeRaw"
>;
export type ReportTargetType = "thread" | "post";

const REASON_MIN = 3;
const REASON_MAX = 1000;

const SITE_PLACE = { id: null, scope: "site", realmId: null } as const;
const TARGET_CATEGORY = {
  select: { id: true, scope: true, realmId: true, visibility: true },
} as const;

function reportReason(raw: string): string {
  const reason = raw.trim();
  if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
    throw new ForumError("BAD_REQUEST", `A reason is ${REASON_MIN} to ${REASON_MAX} characters.`);
  }
  return reason;
}

interface SeenTarget {
  authorUserId: string;
  postHidden: boolean;
  thread: {
    authorUserId: string;
    hidden: boolean;
    category: { id: string; scope: string; realmId: string | null; visibility: string };
  };
}

async function findTarget(
  db: Pick<ReportsDb, "forumThread" | "forumPost">,
  input: { targetType: ReportTargetType; targetId: string }
): Promise<SeenTarget | null> {
  const threadSelect = { authorUserId: true, hidden: true, category: TARGET_CATEGORY } as const;
  if (input.targetType === "thread") {
    const thread = await db.forumThread.findUnique({
      where: { id: input.targetId },
      select: threadSelect,
    });
    return thread && { authorUserId: thread.authorUserId, postHidden: false, thread };
  }
  const post = await db.forumPost.findUnique({
    where: { id: input.targetId },
    select: { authorUserId: true, hidden: true, thread: { select: threadSelect } },
  });
  return post && { authorUserId: post.authorUserId, postHidden: post.hidden, thread: post.thread };
}

/** The read rules: the thread, a hidden post (moderators only), and the realm (drafts hidden). */
async function canSeeTarget(
  db: ReportsDb,
  actor: ForumActor,
  target: SeenTarget
): Promise<boolean> {
  const { category } = target.thread;
  if (!canSeeThread(actor, target.thread, category)) return false;
  if (target.postHidden && !canModerateCategory(actor, category)) return false;
  return (await visibleRealmOf(db, actor, category)) !== undefined;
}

const targetNotFound = (type: ReportTargetType) =>
  new ForumError("NOT_FOUND", `${type === "post" ? "Post" : "Thread"} not found.`);

/** The target as the reporter sees it; NOT_FOUND otherwise. */
async function seenTarget(
  db: ReportsDb,
  actor: ForumActor,
  input: { targetType: ReportTargetType; targetId: string }
): Promise<SeenTarget> {
  const target = await findTarget(db, input);
  if (target && (await canSeeTarget(db, actor, target))) return target;
  throw targetNotFound(input.targetType);
}

export async function fileReport(
  db: ReportsDb,
  actor: ForumActor,
  input: { targetType: ReportTargetType; targetId: string; reason: string }
): Promise<{ reportId: string }> {
  const reason = reportReason(input.reason);
  const target = await seenTarget(db, actor, input);
  if (target.authorUserId === actor.id) {
    throw new ForumError("BAD_REQUEST", `You can't report your own ${input.targetType}.`);
  }
  await assertNotBanned(db, actor, SITE_PLACE);
  const key = { reporterId: actor.id, targetType: input.targetType, targetId: input.targetId };
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`forum-report:${actor.id}`}))`;
    const open = await tx.forumReport.findFirst({
      where: { ...key, status: "open" },
      select: { id: true },
    });
    if (open) throw new ForumError("CONFLICT", "You've already reported this.");
    // Re-read under the lock: a move since the check above must not pin the report to the old category. A move
    // keeps the section and the audience (moveThread), so what the reporter may see is unchanged.
    const placed = await findTarget(tx, input);
    if (!placed) throw targetNotFound(input.targetType);
    const report = await tx.forumReport.create({
      data: { ...key, categoryId: placed.thread.category.id, reason },
    });
    return { reportId: report.id };
  });
}

/** Who may handle a report: moderators of its category; one whose category is gone is left to site admins. */
function handlingScope(
  actor: ForumViewer,
  category: { id: string; scope: string; realmId: string | null } | null
): { handler: NonNullable<ForumViewer>; scope: ModScope } {
  if (!category) {
    assertScope(actor, { kind: "site" }, null);
    return { handler: actor, scope: { kind: "site" } };
  }
  assertModeratesCategory(actor, category);
  return { handler: actor, scope: scopeOfCategory(category) };
}

/** The author of a report's target; null when it is gone, which never blocks handling. */
async function targetAuthorOf(
  db: ReportsDb,
  report: { targetType: string; targetId: string }
): Promise<string | null> {
  const args = { where: { id: report.targetId }, select: { authorUserId: true } } as const;
  const target =
    report.targetType === "thread"
      ? await db.forumThread.findUnique(args)
      : await db.forumPost.findUnique(args);
  return target?.authorUserId ?? null;
}

/**
 * A moderator in the report's scope who can read the category resolves or dismisses it, never one whose own content
 * it is (site admins included: another admin handles it), and only a site admin when a site admin wrote it (M-3).
 * The conditional update also pins the category the scope was checked against, so a report re-pointed by a move
 * meanwhile is a CONFLICT.
 */
export async function resolveReport(
  db: ReportsDb,
  actor: ForumViewer,
  input: { reportId: string; outcome: "resolved" | "dismissed"; note?: string }
): Promise<void> {
  const note = modNote(input.note);
  const report = await db.forumReport.findUnique({
    where: { id: input.reportId },
    select: { id: true, status: true, categoryId: true, targetType: true, targetId: true },
  });
  if (!report) throw new ForumError("NOT_FOUND", "Report not found.");
  const category = await db.forumCategory.findUnique({
    where: { id: report.categoryId },
    select: { id: true, scope: true, realmId: true, visibility: true },
  });
  const { handler, scope } = handlingScope(actor, category);
  // M8: a moderator of the category reads its threads (canSeeThread) only when they can see the category itself; a
  // non-admin appointed on a staff category can't, so its reports are not theirs to handle (nor in their queue).
  if (category && !canSeeCategory(handler, category)) {
    throw new ForumError("NOT_FOUND", "Report not found.");
  }
  const author = await targetAuthorOf(db, report);
  if (author === handler.id) {
    throw new ForumError("FORBIDDEN", "Another moderator handles reports about your own posts.");
  }
  if (author !== null) await assertCanModerateAuthor(db, handler, author);
  const handled = new ForumError("CONFLICT", "This report has already been handled.");
  if (report.status !== "open") throw handled;
  await db.$transaction(async (tx) => {
    const { count } = await tx.forumReport.updateMany({
      where: { id: report.id, status: "open", categoryId: report.categoryId },
      data: { status: input.outcome, handledBy: handler.id, handledAt: new Date(), note },
    });
    if (count === 0) throw handled;
    await logModAction(tx, {
      actorId: handler.id,
      action: input.outcome === "resolved" ? "report.resolve" : "report.dismiss",
      targetType: "report",
      targetId: report.id,
      scope,
      detail: { note, targetType: report.targetType, targetId: report.targetId },
    });
  });
}
