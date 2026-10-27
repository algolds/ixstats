/**
 * Reactions on the reads (spec section 3): each post carries its clean `reactions` counts, and a signed-in viewer
 * their own `myReaction`, from one batched query per page. Signed-out viewers and empty pages cost no query.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { readReactionCounts, type ReactionCounts } from "~/lib/thinkpages-forum/reactions";
import type { ForumViewer } from "./access";

export type ReactionReadDb = Pick<PrismaClient, "forumPostReaction">;

export interface ReactionFields {
  reactions: ReactionCounts;
  myReaction: string | null;
}

/** The viewer's reaction type on each of `postIds` that has one. */
export async function myReactionsOf(
  db: ReactionReadDb,
  viewer: ForumViewer,
  postIds: readonly string[]
): Promise<Map<string, string>> {
  if (viewer === null || postIds.length === 0) return new Map();
  const rows = await db.forumPostReaction.findMany({
    where: { userId: viewer.id, postId: { in: [...postIds] } },
    select: { postId: true, type: true },
  });
  return new Map(rows.map((row) => [row.postId, row.type]));
}

/** The rows with the raw counts column replaced by `reactions` and `myReaction`. */
export async function withReactions<T extends { id: string; reactionCounts: Prisma.JsonValue }>(
  db: ReactionReadDb,
  viewer: ForumViewer,
  rows: readonly T[]
): Promise<Array<Omit<T, "reactionCounts"> & ReactionFields>> {
  const mine = await myReactionsOf(
    db,
    viewer,
    rows.map((row) => row.id)
  );
  return rows.map((row) => {
    const { reactionCounts, ...rest } = row;
    return {
      ...rest,
      reactions: readReactionCounts(reactionCounts),
      myReaction: mine.get(row.id) ?? null,
    };
  });
}
