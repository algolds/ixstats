/**
 * Which post a reaction concerns and whether the viewer may read it or react to it (spec section 2). One resolver
 * serves a thread post and a realm board message. Reading follows the thread rules (a post, thread or realm the viewer
 * cannot see is not found; hidden content stays readable to the category's moderators). Reacting adds: an archived
 * realm refuses first, for everyone; then not a hidden post or thread, not a message that continued in a thread, not
 * your own post (a persona post is its player's), and then the place's own rule: a thread must be open and the viewer
 * not banned in its scope; the board takes whoever may post there (`boardAccessFor`). Nothing here is the client's say:
 * every write asks again.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { banNotice } from "~/lib/thinkpages-forum/moderation-policy";
import { canSeeThread, type ForumViewer } from "./access";
import { advertHiddenFrom } from "./advert-access";
import { boardAccessFor, type BoardAccessDb } from "./board-access";
import { ForumError } from "./errors";
import { postingBan } from "./mod-bans";
import { canModerateCategory } from "./mod-scope";
import { isArchived, type ForumRealm } from "./realm-access";
import { visibleRealmOf } from "./reads";

export type ReactionTargetDb = BoardAccessDb & Pick<PrismaClient, "forumPost">;

const TARGET_SELECT = {
  id: true,
  threadId: true,
  authorUserId: true,
  authorPersonaId: true,
  hidden: true,
  continuedThreadId: true,
  reactionCounts: true,
  thread: {
    select: {
      title: true,
      authorUserId: true,
      hidden: true,
      locked: true,
      archived: true,
      advertRealmId: true,
      category: {
        select: { id: true, key: true, style: true, scope: true, realmId: true, visibility: true },
      },
    },
  },
} as const satisfies Prisma.ForumPostSelect;

export type ReactionTargetPost = Prisma.ForumPostGetPayload<{ select: typeof TARGET_SELECT }>;

export interface ReactionTarget {
  post: ReactionTargetPost;
  category: ReactionTargetPost["thread"]["category"];
  /** The category's realm; null in the sitewide section. */
  realm: ForumRealm | null;
  /** A message on a realm's live board, not a thread post. */
  board: boolean;
}

const notFound = (): ForumError => new ForumError("NOT_FOUND", "Post not found.");

/**
 * The post the viewer may read (signed out included), else NOT_FOUND.
 *
 * It mirrors two existing rules, so a reaction can never reach a post the forum would not show:
 * - `resolvePostLocation` (post-location.ts), the post permalink: the thread passes `canSeeThread`, a hidden post
 *   needs a moderator of its category, and the category's realm must be visible to the viewer.
 * - `loadVisibleThread` (reads.ts), the thread page: the same `canSeeThread` and realm checks on the thread itself.
 * Both also treat the advert of a realm the viewer cannot see as not found (`advertHiddenFrom`, advert-access.ts).
 * One difference is deliberate: both of those refuse a realm board's thread, while a board message is a post that takes
 * reactions, so it is read here under the same rules and flagged `board`.
 */
export async function loadReadablePost(
  db: ReactionTargetDb,
  viewer: ForumViewer,
  postId: string
): Promise<ReactionTarget> {
  const post = await db.forumPost.findUnique({ where: { id: postId }, select: TARGET_SELECT });
  if (!post) throw notFound();
  const { category } = post.thread;
  if (!canSeeThread(viewer, post.thread, category)) throw notFound();
  if (post.hidden && !canModerateCategory(viewer, category)) throw notFound();
  const realm = await visibleRealmOf(db, viewer, category);
  if (realm === undefined || (await advertHiddenFrom(db, viewer, post.thread))) throw notFound();
  return { post, category, realm, board: isBoardCategory(category) };
}

async function assertCanReactInThread(
  db: ReactionTargetDb,
  viewer: NonNullable<ForumViewer>,
  target: ReactionTarget
): Promise<void> {
  const { post, category } = target;
  if (post.thread.locked || post.thread.archived) {
    throw new ForumError("CONFLICT", "This thread is closed to reactions.");
  }
  const ban = await postingBan(db, viewer, {
    id: category.id,
    scope: category.scope,
    realmId: category.realmId,
  });
  if (ban) throw new ForumError("FORBIDDEN", banNotice(ban));
}

async function assertCanReactOnBoard(
  db: ReactionTargetDb,
  viewer: NonNullable<ForumViewer>,
  target: ReactionTarget
): Promise<void> {
  if (!target.realm) throw notFound();
  const access = await boardAccessFor(db, viewer, target.realm, undefined, target.category);
  if (!access.canPost) {
    throw new ForumError("FORBIDDEN", access.notice ?? "You cannot react on this board.");
  }
}

/** The post the viewer may react to, else NOT_FOUND (unreadable), CONFLICT (nothing to react to) or FORBIDDEN. */
export async function loadReactablePost(
  db: ReactionTargetDb,
  viewer: NonNullable<ForumViewer>,
  postId: string
): Promise<ReactionTarget> {
  const target = await loadReadablePost(db, viewer, postId);
  const { post, realm } = target;
  // First, and for site admins too (who pass `boardAccessFor` in an archived realm): an archived realm no longer changes.
  if (realm && isArchived(realm)) {
    throw new ForumError(
      "CONFLICT",
      "This realm is archived: its forum can be read but no longer changes."
    );
  }
  if (post.hidden || post.thread.hidden) {
    throw new ForumError("CONFLICT", "Hidden posts cannot be reacted to.");
  }
  if (post.continuedThreadId !== null) {
    throw new ForumError("CONFLICT", "This message continued in a thread. React there.");
  }
  if (post.authorUserId === viewer.id) {
    throw new ForumError("FORBIDDEN", "You cannot react to your own post.");
  }
  if (target.board) await assertCanReactOnBoard(db, viewer, target);
  else await assertCanReactInThread(db, viewer, target);
  return target;
}

/**
 * Whether a viewer may react to posts of this thread at all (the thread read's `canReact`; the client narrows it per
 * post). `banned` is the viewer's posting ban in the thread's scope.
 */
export function threadReactable(
  viewer: ForumViewer,
  thread: { locked: boolean; archived: boolean; hidden: boolean },
  banned: boolean,
  realm: ForumRealm | null
): boolean {
  if (viewer === null || banned || thread.locked || thread.archived || thread.hidden) return false;
  return realm === null || !isArchived(realm);
}
