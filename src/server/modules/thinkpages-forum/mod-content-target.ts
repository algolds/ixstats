/**
 * The targets of moderator content actions (mod-content.ts, mod-edit.ts): a thread or post loaded with its category
 * and author, and the one gate every action passes: a moderator of the category (site admins; the realm's founder
 * and officers with `board`; the category's moderators) and, for content a site admin wrote, a site admin.
 */
import type { PrismaClient } from "@prisma/client";
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { canSeeCategory, type ForumViewer } from "./access";
import { advertHiddenFrom } from "./advert-access";
import { ForumError } from "./errors";
import { assertCanModerateAuthor, assertModeratesCategory } from "./mod-scope";

export type ContentDb = Pick<
  PrismaClient,
  | "forumThread"
  | "forumPost"
  | "forumPostTemplate"
  | "forumCategory"
  | "forumReport"
  | "postActionLink"
  | "forumModLog"
  | "realm"
  | "user"
  | "thinkpagesAccount"
  | "forumPostMention"
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
  key: true,
  style: true,
} as const;

export interface ContentCategory {
  id: string;
  scope: string;
  realmId: string | null;
  visibility: string;
  icAllowed: boolean;
  key: string;
  style?: string | null;
}

/** The realm board's one thread stays where it is and stays open: moving, hiding, archiving or locking it would disable the board. */
export function assertNotBoardThread(category: ContentCategory): void {
  if (isBoardCategory(category)) {
    throw new ForumError("CONFLICT", "The realm board can't be moved, hidden, archived or locked.");
  }
}

/**
 * The actor, once it moderates `category` and may act on `authorUserId`'s content (FORBIDDEN otherwise; null is
 * imported content without an IxStats author, which any moderator of the category may act on). M8: a
 * moderator reads the category's threads (canSeeThread) only when they can see the category; content a moderator
 * can't read (a non-admin appointed on a staff category) is NOT_FOUND to them, as it is in reads and the report queue;
 * so is the advert of a realm they can't see (`advertRealmId`, set on an advert thread and its posts).
 */
export async function contentModerator(
  db: Pick<ContentDb, "user" | "realm">,
  actor: ForumViewer,
  category: ContentCategory,
  authorUserId: string | null,
  advertRealmId?: string | null
): Promise<Moderator> {
  assertModeratesCategory(actor, category);
  if (!canSeeCategory(actor, category) || (await advertHiddenFrom(db, actor, { advertRealmId }))) {
    throw new ForumError("NOT_FOUND", "Content not found.");
  }
  await assertCanModerateAuthor(db, actor, authorUserId);
  return actor;
}

export async function loadThread(db: Pick<ContentDb, "forumThread">, threadId: string) {
  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      authorUserId: true,
      advertRealmId: true,
      category: { select: CATEGORY_SELECT },
    },
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
      contentHtml: true,
      editedAt: true,
      thread: { select: { advertRealmId: true, category: { select: CATEGORY_SELECT } } },
    },
  });
  if (!post) throw new ForumError("NOT_FOUND", "Post not found.");
  return post;
}
