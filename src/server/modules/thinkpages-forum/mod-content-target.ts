/**
 * The targets of moderator content actions (mod-content.ts, mod-edit.ts): a thread or post loaded with its category
 * and author, and the one gate every action passes: a moderator of the category (site admins; the realm's founder
 * and officers with `board`; the category's moderators) and, for content a site admin wrote, a site admin.
 */
import type { PrismaClient } from "@prisma/client";
import { canSeeCategory, type ForumViewer } from "./access";
import { ForumError } from "./errors";
import { assertCanModerateAuthor, assertModeratesCategory } from "./mod-scope";

export type ContentDb = Pick<
  PrismaClient,
  | "forumThread"
  | "forumPost"
  | "forumCategory"
  | "forumReport"
  | "postActionLink"
  | "forumModLog"
  | "realm"
  | "user"
  | "$transaction"
  | "$executeRaw"
>;

export type Moderator = NonNullable<ForumViewer>;

const CATEGORY_SELECT = {
  id: true,
  scope: true,
  realmId: true,
  visibility: true,
  icAllowed: true,
} as const;

export interface ContentCategory {
  id: string;
  scope: string;
  realmId: string | null;
  visibility: string;
  icAllowed: boolean;
}

/**
 * The actor, once it moderates `category` and may act on `authorUserId`'s content (FORBIDDEN otherwise). M8: a
 * moderator reads the category's threads (canSeeThread) only when they can see the category; content a moderator
 * can't read (a non-admin appointed on a staff category) is NOT_FOUND to them, as it is in reads and the report queue.
 */
export async function contentModerator(
  db: Pick<ContentDb, "user">,
  actor: ForumViewer,
  category: ContentCategory,
  authorUserId: string
): Promise<Moderator> {
  assertModeratesCategory(actor, category);
  if (!canSeeCategory(actor, category)) throw new ForumError("NOT_FOUND", "Content not found.");
  await assertCanModerateAuthor(db, actor, authorUserId);
  return actor;
}

export async function loadThread(db: Pick<ContentDb, "forumThread">, threadId: string) {
  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
    select: { id: true, authorUserId: true, category: { select: CATEGORY_SELECT } },
  });
  if (!thread) throw new ForumError("NOT_FOUND", "Thread not found.");
  return thread;
}

export async function loadPost(db: Pick<ContentDb, "forumPost">, postId: string) {
  const post = await db.forumPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      threadId: true,
      authorUserId: true,
      plainText: true,
      editedAt: true,
      thread: { select: { category: { select: CATEGORY_SELECT } } },
    },
  });
  if (!post) throw new ForumError("NOT_FOUND", "Post not found.");
  return post;
}
