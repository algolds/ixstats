/**
 * The bell notice a first reaction causes (spec section 2), sent after the reaction commits: the post's owner is told
 * "<reactor> reacted to your post in <thread title | the <realm> board>". The caller asks only for a newly created
 * reaction (a switch sends nothing), and a reactor who removes and re-adds the same reaction does not tell the owner
 * again: an earlier forum notice carrying the same `reactionKey` (`<post id>:<reactor id>`) ends it. The owner is the
 * post's real owner even for a persona post, and nothing in the notice names the persona. Nobody is told about their
 * own post, a hidden post or thread, an imported post or one without an author, a post they cannot read, or a reactor
 * they blocked. Never throws: a failure is logged and the reaction is untouched.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { boardExcerpt } from "~/lib/thinkpages-forum/board";
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { postSummary } from "~/lib/thinkpages-forum/post-summary";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";
import { FORUM_NOTICE_SOURCE, sendForumNotices } from "./forum-notices";
import { readableUsers, RECIPIENT_SELECT, type NoticePlace } from "./notice-recipients";
import { memberName, noticeFor } from "./notice-text";
import type { NoticeActor } from "./post-notify";
import { loadForumRealm } from "./realm-access";

export type ReactionNoticeDb = Pick<
  PrismaClient,
  | "forumPost"
  | "user"
  | "realm"
  | "realmOfficer"
  | "forumCategoryModerator"
  | "userConnection"
  | "notification"
>;

const POST_SELECT = {
  id: true,
  threadId: true,
  authorUserId: true,
  hidden: true,
  sourceRef: true,
  plainText: true,
  contentHtml: true,
  thread: {
    select: {
      title: true,
      authorUserId: true,
      hidden: true,
      category: {
        select: { id: true, key: true, style: true, scope: true, realmId: true, visibility: true },
      },
    },
  },
} as const satisfies Prisma.ForumPostSelect;

const DEDUPE_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Whether the owner already has a forum notice for this reactor and post, sent in the last 180 days. The key is built
 * from database ids only (post.id, actor.id), never from raw input, so the LIKE match cannot be steered by a caller.
 */
async function alreadyTold(
  db: ReactionNoticeDb,
  ownerClerkId: string,
  key: string
): Promise<boolean> {
  const earlier = await db.notification.findFirst({
    where: {
      userId: ownerClerkId,
      source: FORUM_NOTICE_SOURCE,
      metadata: { contains: `"reactionKey":"${key}"` },
      createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    },
    select: { id: true },
  });
  return earlier !== null;
}

async function notify(
  db: ReactionNoticeDb,
  actor: NoticeActor,
  input: { postId: string }
): Promise<void> {
  const post = await db.forumPost.findUnique({ where: { id: input.postId }, select: POST_SELECT });
  if (!post || post.hidden || post.thread.hidden) return;
  // Imported posts (an archive row, or no author) and the reactor's own posts tell nobody.
  if (post.sourceRef || !post.authorUserId || post.authorUserId === actor.id) return;
  const { category } = post.thread;
  const realm =
    category.scope === "realm" && category.realmId
      ? await loadForumRealm(db, { id: category.realmId })
      : null;
  if (category.scope === "realm" && !realm) return;
  const owner = await db.user.findFirst({
    where: { id: post.authorUserId, isActive: true },
    select: RECIPIENT_SELECT,
  });
  if (!owner) return;
  const place: NoticePlace = { thread: post.thread, category, realm };
  if ((await readableUsers(db, place, [owner])).length === 0) return;
  const blocking = await recipientsBlockingSender(db, actor.clerkUserId, [owner.clerkUserId]);
  if (blocking.length > 0) return;
  // Both ids come from the database rows (post.id, actor.id), never from raw input.
  const reactionKey = `${post.id}:${actor.id}`;
  if (await alreadyTold(db, owner.clerkUserId, reactionKey)) return;
  // The reactor is named by their own handle; the post's persona, if any, is never read.
  const notice = noticeFor(
    "reaction",
    {
      postId: post.id,
      threadId: post.threadId,
      threadTitle: post.thread.title,
      name: await memberName(db, actor.id, "Member"),
      excerpt: boardExcerpt(postSummary(post)),
      realmName: realm?.name ?? "realm",
      board: isBoardCategory(category),
      reactionKey,
    },
    owner.clerkUserId
  );
  await sendForumNotices([notice]);
}

export async function notifyReaction(
  db: ReactionNoticeDb,
  actor: NoticeActor,
  input: { postId: string }
): Promise<void> {
  try {
    await notify(db, actor, input);
  } catch (error) {
    console.error("[thinkpages-forum] Reaction notice failed:", error);
  }
}
