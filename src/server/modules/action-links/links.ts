/**
 * Post ↔ action links. A post's links are re-synced on every save: links whose token survived keep their row
 * (and so their chain membership); removed tokens drop their row. Only the poster's own country's public
 * ActivityFeed entries are linkable: ownership at write time is the verification.
 */
import type { PrismaClient } from "@prisma/client";
import { MAX_ACTIONS_PER_POST, parseActionTokens, type PostSource } from "~/lib/action-links";
import { ActionLinkError } from "./errors";

export type LinksDb = Pick<PrismaClient, "activityFeed" | "postActionLink" | "$transaction">;

export async function syncPostActionLinks(
  db: LinksDb,
  input: { postSource: PostSource; postRef: string; countryId: string | null; body: string }
): Promise<string[]> {
  const { postSource, postRef, countryId } = input;
  const ids = parseActionTokens(input.body);
  if (ids.length > MAX_ACTIONS_PER_POST) {
    throw new ActionLinkError("BAD_REQUEST", `A post can link at most ${MAX_ACTIONS_PER_POST} actions`);
  }
  if (ids.length > 0 && !countryId) {
    throw new ActionLinkError("FORBIDDEN", "Only a nation's posts can link its actions");
  }
  const owner = countryId;
  if (ids.length > 0 && owner) {
    const owned = await db.activityFeed.findMany({
      where: { id: { in: ids }, countryId: owner, visibility: "public" },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new ActionLinkError("BAD_REQUEST", "A linked action is not one of your nation's public actions");
    }
  }
  await db.$transaction(async (tx) => {
    await tx.postActionLink.deleteMany({ where: { postSource, postRef, activityId: { notIn: ids } } });
    if (ids.length > 0 && owner) {
      await tx.postActionLink.createMany({
        data: ids.map((activityId) => ({ postSource, postRef, activityId, countryId: owner })),
        skipDuplicates: true,
      });
    }
  });
  return ids;
}

/** The posts that link an activity ("discussed in N posts"). */
export function linkedPosts(db: Pick<PrismaClient, "postActionLink">, activityId: string) {
  return db.postActionLink.findMany({
    where: { activityId },
    select: { postSource: true, postRef: true },
    orderBy: { createdAt: "asc" },
  });
}
