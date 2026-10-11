/**
 * Reactions (spec sections 2 and 3): set or clear a member's one reaction to a post, and list who reacted. A
 * reaction is the player's own and an out-of-character act. The row change and the post's `reactionCounts` are one
 * transaction under a per-post advisory lock: the counts are recounted from the rows (a `Json` column cannot be
 * incremented), so reactors of one post serialize and a drifted count heals on the next reaction. The unique
 * (post, member) row is the second line of defence: a duplicate it still catches is a CONFLICT, never a 500.
 */
import type { PrismaClient } from "@prisma/client";
import {
  countsFromGroups,
  isReactionType,
  readReactionCounts,
  REACTOR_TYPES_MAX,
  REACTORS_PER_TYPE,
  sortedReactionTypes,
  type ReactionCounts,
} from "~/lib/thinkpages-forum/reactions";
import type { ForumViewer } from "./access";
import { ForumError, isUniqueViolation } from "./errors";
import { loadReactablePost, loadReadablePost, type ReactionTargetDb } from "./reaction-target";
import { authorsOf, type AuthorsDb, type ForumUserAuthor } from "./reads";

export type ReactionsDb = ReactionTargetDb &
  AuthorsDb &
  Pick<PrismaClient, "forumPostReaction" | "forumPost" | "$transaction">;

export interface ReactionChange {
  counts: ReactionCounts;
  mine: string | null;
  /** The member had no reaction on this post before: the one that notifies its owner. */
  created: boolean;
  /** The post is a realm board message: its room gets the new counts. */
  board: boolean;
}

const NOT_A_REACTION = "That reaction is not available.";

async function lockPost(tx: Pick<PrismaClient, "$executeRaw">, postId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`forum-reaction:${postId}`}))`;
}

/** Changes the member's row for `postId` to `type` (null clears it) and recounts the post. `type` is already valid. */
async function writeReaction(
  db: ReactionsDb,
  userId: string,
  postId: string,
  type: string | null,
  board: boolean
): Promise<ReactionChange> {
  try {
    return await db.$transaction(async (tx) => {
      await lockPost(tx, postId);
      const existing = await tx.forumPostReaction.findUnique({
        where: { postId_userId: { postId, userId } },
        select: { id: true, type: true },
      });
      let created = false;
      if (type === null) {
        if (existing) await tx.forumPostReaction.delete({ where: { id: existing.id } });
      } else if (!existing) {
        await tx.forumPostReaction.create({ data: { postId, userId, type } });
        created = true;
      } else if (existing.type !== type) {
        await tx.forumPostReaction.update({ where: { id: existing.id }, data: { type } });
      }
      const groups = await tx.forumPostReaction.groupBy({
        by: ["type"],
        where: { postId },
        _count: { _all: true },
      });
      const counts = countsFromGroups(
        groups.map((group) => ({ type: group.type, count: group._count._all }))
      );
      await tx.forumPost.update({ where: { id: postId }, data: { reactionCounts: counts } });
      return { counts, mine: type, created, board };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ForumError("CONFLICT", "Your reaction changed at the same moment. Try again.");
    }
    throw error;
  }
}

/** Sets the member's reaction to `type`: adds it, or switches their earlier one. The same type again changes nothing. */
export async function reactToPost(
  db: ReactionsDb,
  actor: NonNullable<ForumViewer>,
  input: { postId: string; type: string }
): Promise<ReactionChange> {
  if (!isReactionType(input.type)) throw new ForumError("BAD_REQUEST", NOT_A_REACTION);
  const { board } = await loadReactablePost(db, actor, input.postId);
  return writeReaction(db, actor.id, input.postId, input.type, board);
}

/** Takes the member's reaction back. Needs only that they can read the post, so a closed thread cannot trap it. */
export async function unreactToPost(
  db: ReactionsDb,
  actor: NonNullable<ForumViewer>,
  input: { postId: string }
): Promise<ReactionChange> {
  const { board } = await loadReadablePost(db, actor, input.postId);
  return writeReaction(db, actor.id, input.postId, null, board);
}

/** A reactor as the dialog shows them: the player's own handle, flag and avatar. No user id. */
export interface Reactor {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  flagUrl: string | null;
}

export interface ReactorGroup {
  type: string;
  count: number;
  reactors: Reactor[];
}

function reactorOf(row: { id: string }, author: ForumUserAuthor | undefined): Reactor {
  return {
    id: row.id,
    name: author?.name ?? "Member",
    handle: author?.handle ?? null,
    avatarUrl: author?.avatarUrl ?? null,
    flagUrl: author?.flagUrl ?? null,
  };
}

/**
 * Who reacted, for whoever can read the post: up to 50 reactors per type, newest first, for the most reacted types
 * (at most 12), or for the one `type` asked for.
 */
export async function listReactors(
  db: ReactionsDb,
  viewer: ForumViewer,
  input: { postId: string; type?: string }
): Promise<{ groups: ReactorGroup[] }> {
  if (input.type !== undefined && !isReactionType(input.type)) {
    throw new ForumError("BAD_REQUEST", NOT_A_REACTION);
  }
  const { post } = await loadReadablePost(db, viewer, input.postId);
  const counts = readReactionCounts(post.reactionCounts);
  const types =
    input.type !== undefined
      ? [input.type]
      : sortedReactionTypes(counts).slice(0, REACTOR_TYPES_MAX);
  const lists = await Promise.all(
    types.map((type) =>
      db.forumPostReaction.findMany({
        where: { postId: post.id, type },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: REACTORS_PER_TYPE,
        select: { id: true, userId: true },
      })
    )
  );
  const authors = await authorsOf(
    db,
    lists.flat().map((row) => row.userId),
    []
  );
  return {
    groups: types.map((type, at) => ({
      type,
      count: counts[type] ?? 0,
      reactors: (lists[at] ?? []).map((row) => reactorOf(row, authors.users.get(row.userId))),
    })),
  };
}
