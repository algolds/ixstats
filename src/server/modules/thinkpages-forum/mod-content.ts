/**
 * Moderator content actions (phase 3): lock, pin, hide or archive a thread, move it, hide a post (editing a post is
 * mod-edit.ts). Each loads its target with its category and author, needs a moderator of that category (and a site
 * admin for a site admin's content, `contentModerator`), and writes the change and its ForumModLog row in one
 * transaction. Changes are conditional updates, so a repeated action is a CONFLICT that logs nothing. No
 * archived-realm check (T0-6); nothing here deletes a thread or post (T0-7). A thread's `postCount` and `lastPostAt`
 * count its visible posts only, as members see them; moderators see hidden posts badged but not counted.
 */
import type { PrismaClient } from "@prisma/client";
import type { ForumViewer } from "./access";
import { ForumError } from "./errors";
import { logModAction, modNote } from "./mod-log";
import { assertModeratesCategory, canModerateCategory, scopeOfCategory } from "./mod-scope";
import {
  contentModerator,
  loadPost,
  loadThread,
  type ContentCategory,
  type ContentDb,
} from "./mod-content-target";
import { loadCategory, type CategoryLocator } from "./reads";

export type ThreadFlag = "locked" | "pinned" | "hidden" | "archived";

const FLAG_VERBS: Record<ThreadFlag, string> = {
  locked: "lock",
  pinned: "pin",
  hidden: "hide",
  archived: "archive",
};

/** `{ [flag]: value }`, typed for the thread's where and data. */
function flagged(flag: ThreadFlag, value: boolean): Partial<Record<ThreadFlag, boolean>> {
  const fields: Partial<Record<ThreadFlag, boolean>> = {};
  fields[flag] = value;
  return fields;
}

export async function setThreadFlag(
  db: ContentDb,
  actor: ForumViewer,
  input: { threadId: string; flag: ThreadFlag; value: boolean; note?: string }
): Promise<void> {
  const note = modNote(input.note);
  const thread = await loadThread(db, input.threadId);
  const moderator = await contentModerator(db, actor, thread.category, thread.authorUserId);
  const verb = FLAG_VERBS[input.flag];
  await db.$transaction(async (tx) => {
    const { count } = await tx.forumThread.updateMany({
      where: { id: thread.id, ...flagged(input.flag, !input.value) },
      data: flagged(input.flag, input.value),
    });
    if (count === 0) {
      const state = input.value ? input.flag : `un${input.flag}`;
      throw new ForumError("CONFLICT", `This thread is already ${state}.`);
    }
    await logModAction(tx, {
      actorId: moderator.id,
      action: `thread.${input.value ? "" : "un"}${verb}`,
      targetType: "thread",
      targetId: thread.id,
      scope: scopeOfCategory(thread.category),
      detail: { note, from: !input.value, to: input.value },
    });
  });
}

/**
 * A move stays in its section (sitewide, or one realm) and keeps its audience (same visibility), so a Reports
 * thread never becomes public and a realm's thread never leaves its realm; categories themselves never change.
 */
function assertSameAudience(from: ContentCategory, to: ContentCategory): void {
  if (from.id === to.id)
    throw new ForumError("CONFLICT", "This thread is already in that category.");
  if (from.scope !== to.scope || from.realmId !== to.realmId) {
    throw new ForumError("BAD_REQUEST", "A thread can only move within its own forum section.");
  }
  if (from.visibility !== to.visibility) {
    throw new ForumError(
      "BAD_REQUEST",
      "A thread can only move to a category with the same audience."
    );
  }
}

/**
 * Where the viewer may move a thread out of `from` under `assertSameAudience`: the section's other categories with
 * the same visibility that they moderate, in order. Empty for anyone who moderates none of them.
 */
export async function moveDestinations(
  db: Pick<ContentDb, "forumCategory">,
  viewer: ForumViewer,
  from: { id: string; scope: string; realmId: string | null; visibility: string }
): Promise<Array<{ key: string; name: string }>> {
  const rows = await db.forumCategory.findMany({
    where: {
      scope: from.scope,
      realmId: from.realmId,
      visibility: from.visibility,
      id: { not: from.id },
    },
    orderBy: { order: "asc" },
    select: { id: true, key: true, name: true, scope: true, realmId: true },
  });
  return rows.filter((c) => canModerateCategory(viewer, c)).map(({ key, name }) => ({ key, name }));
}

export async function moveThread(
  db: ContentDb,
  actor: ForumViewer,
  input: { threadId: string; to: CategoryLocator; note?: string }
): Promise<void> {
  const note = modNote(input.note);
  const thread = await loadThread(db, input.threadId);
  const moderator = await contentModerator(db, actor, thread.category, thread.authorUserId);
  const { category: to } = await loadCategory(db, moderator, input.to);
  assertModeratesCategory(moderator, to);
  const from = thread.category;
  assertSameAudience(from, to);
  const inCharacter = to.icAllowed
    ? 0
    : await db.forumPost.count({ where: { threadId: thread.id, authorPersonaId: { not: null } } });
  if (inCharacter > 0) {
    throw new ForumError(
      "CONFLICT",
      "In-character posts can only move to an in-character category."
    );
  }
  await db.$transaction(async (tx) => {
    const { count } = await tx.forumThread.updateMany({
      where: { id: thread.id, categoryId: from.id },
      data: { categoryId: to.id },
    });
    if (count === 0) throw new ForumError("CONFLICT", "This thread has moved since you opened it.");
    const posts = await tx.forumPost.findMany({
      where: { threadId: thread.id },
      select: { id: true },
    });
    // M11: open reports follow their thread so the destination's moderators see them.
    await tx.forumReport.updateMany({
      where: {
        status: "open",
        OR: [
          { targetType: "thread", targetId: thread.id },
          { targetType: "post", targetId: { in: posts.map((p) => p.id) } },
        ],
      },
      data: { categoryId: to.id },
    });
    await logModAction(tx, {
      actorId: moderator.id,
      action: "thread.move",
      targetType: "thread",
      targetId: thread.id,
      scope: scopeOfCategory(from),
      detail: { note, from: from.id, to: to.id },
    });
  });
}

type ThreadTx = Pick<PrismaClient, "forumThread" | "forumPost" | "$executeRaw">;

/**
 * Locks the thread row for the rest of the transaction. A reply updates the same row, so a recount made under the
 * lock sees every committed reply, and a reply still in flight increments the recounted value after it.
 */
async function lockThread(tx: ThreadTx, threadId: string): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM "forum_threads" WHERE "id" = ${threadId} FOR NO KEY UPDATE`;
}

/** postCount and lastPostAt from the thread's visible posts (what members see). */
async function recountThread(tx: ThreadTx, threadId: string): Promise<void> {
  const visible = { threadId, hidden: false };
  const postCount = await tx.forumPost.count({ where: visible });
  const latest = await tx.forumPost.aggregate({ where: visible, _max: { createdAt: true } });
  const lastPostAt = latest._max.createdAt;
  await tx.forumThread.update({
    where: { id: threadId },
    data: { postCount, ...(lastPostAt && { lastPostAt }) },
  });
}

async function isFirstPost(
  db: ContentDb,
  post: { id: string; threadId: string }
): Promise<boolean> {
  const first = await db.forumPost.findFirst({
    where: { threadId: post.threadId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return first?.id === post.id;
}

export async function setPostHidden(
  db: ContentDb,
  actor: ForumViewer,
  input: { postId: string; hidden: boolean; note?: string }
): Promise<void> {
  const note = modNote(input.note);
  const post = await loadPost(db, input.postId);
  const { category } = post.thread;
  const moderator = await contentModerator(db, actor, category, post.authorUserId);
  if (input.hidden && (await isFirstPost(db, post))) {
    throw new ForumError("CONFLICT", "Hide the thread instead.");
  }
  await db.$transaction(async (tx) => {
    await lockThread(tx, post.threadId);
    const { count } = await tx.forumPost.updateMany({
      where: { id: post.id, hidden: !input.hidden },
      data: { hidden: input.hidden },
    });
    if (count === 0) {
      throw new ForumError(
        "CONFLICT",
        `This post is already ${input.hidden ? "hidden" : "visible"}.`
      );
    }
    await recountThread(tx, post.threadId);
    await logModAction(tx, {
      actorId: moderator.id,
      action: input.hidden ? "post.hide" : "post.unhide",
      targetType: "post",
      targetId: post.id,
      scope: scopeOfCategory(category),
      detail: { note, threadId: post.threadId },
    });
  });
}
