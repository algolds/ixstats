/**
 * Post ↔ action links. A post's links are re-synced on every save: links whose token survived keep their row
 * (and so their chain membership); removed tokens drop their row. Only the poster's own country's public
 * ActivityFeed entries are linkable: ownership at write time is the verification.
 */
import type { PrismaClient } from "@prisma/client";
import { MAX_ACTIONS_PER_POST, parseActionTokens, type PostSource } from "~/lib/action-links";
import { ActionLinkError } from "./errors";

export type LinksDb = Pick<PrismaClient, "activityFeed" | "postActionLink" | "$transaction">;

/**
 * The token parse, the per-post cap and the ownership check, with no writes, so a caller can refuse a post before
 * saving it. Returns the linked activity ids.
 */
export async function validatePostActionTokens(
  db: Pick<PrismaClient, "activityFeed">,
  input: { countryId: string | null; body: string }
): Promise<string[]> {
  const { countryId } = input;
  const ids = parseActionTokens(input.body);
  if (ids.length > MAX_ACTIONS_PER_POST) {
    throw new ActionLinkError(
      "BAD_REQUEST",
      `A post can link at most ${MAX_ACTIONS_PER_POST} actions`
    );
  }
  if (ids.length > 0 && !countryId) {
    throw new ActionLinkError("FORBIDDEN", "Only a nation's posts can link its actions");
  }
  if (ids.length > 0 && countryId) {
    const owned = await db.activityFeed.findMany({
      where: { id: { in: ids }, countryId, visibility: "public" },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new ActionLinkError(
        "BAD_REQUEST",
        "A linked action is not one of your nation's public actions"
      );
    }
  }
  return ids;
}

/**
 * Replaces the post's links with the tokens in its text and reports the activity ids whose link row this call
 * inserted. `createManyAndReturn` with `skipDuplicates` returns only the inserted rows, so two saves racing on one
 * post cannot both claim the same link as new (the forum's reward step pays on this set).
 */
export async function syncPostActionLinks(
  db: LinksDb,
  input: { postSource: PostSource; postRef: string; countryId: string | null; body: string }
): Promise<{ created: string[] }> {
  const { postSource, postRef, countryId: owner } = input;
  const ids = await validatePostActionTokens(db, input);
  return db.$transaction(async (tx) => {
    await tx.postActionLink.deleteMany({
      where: { postSource, postRef, activityId: { notIn: ids } },
    });
    if (ids.length === 0 || !owner) return { created: [] };
    const rows = await tx.postActionLink.createManyAndReturn({
      data: ids.map((activityId) => ({ postSource, postRef, activityId, countryId: owner })),
      skipDuplicates: true,
      select: { activityId: true },
    });
    return { created: rows.map((row) => row.activityId) };
  });
}

/** The posts that link an activity ("discussed in N posts"). */
export function linkedPosts(db: Pick<PrismaClient, "postActionLink">, activityId: string) {
  return db.postActionLink.findMany({
    where: { activityId },
    select: { postSource: true, postRef: true },
    orderBy: { createdAt: "asc" },
  });
}
