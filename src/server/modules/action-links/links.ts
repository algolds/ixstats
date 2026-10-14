/**
 * Post ↔ action links. A post's links are re-synced on every save: links whose token survived keep their row
 * (and so their chain membership); removed tokens drop their row. Only the poster's own country's public
 * ActivityFeed entries are linkable: ownership at write time is the verification.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  MAX_ACTIONS_PER_POST,
  NON_ACTION_EVENT_TYPES,
  NON_ACTION_TITLES,
  RECENT_ACTIONS,
  SEARCH_ACTIONS,
  parseActionTokens,
  type PostSource,
} from "~/lib/action-links";
import { ActionLinkError } from "./errors";

export type LinksDb = Pick<PrismaClient, "activityFeed" | "postActionLink" | "$transaction">;

/**
 * The token parse, the per-post cap and the ownership check, with no writes, so a caller can refuse a post before
 * saving it. Returns every linked activity id. `keep` lists the ids the post already carried (an edit): they count toward the
 * cap but are not checked again, since an action withdrawn or a nation switched since posting must not block a typo fix.
 */
export async function validatePostActionTokens(
  db: Pick<PrismaClient, "activityFeed">,
  input: { countryId: string | null; body: string; keep?: readonly string[] }
): Promise<string[]> {
  const { countryId } = input;
  const ids = parseActionTokens(input.body);
  const fresh = ids.filter((id) => !input.keep?.includes(id));
  if (ids.length > MAX_ACTIONS_PER_POST) {
    throw new ActionLinkError(
      "BAD_REQUEST",
      `A post can link at most ${MAX_ACTIONS_PER_POST} actions`
    );
  }
  if (fresh.length > 0 && !countryId) {
    throw new ActionLinkError("FORBIDDEN", "Only a nation's posts can link its actions");
  }
  if (fresh.length > 0 && countryId) {
    const owned = await db.activityFeed.findMany({
      where: { id: { in: fresh }, countryId, visibility: "public" },
      select: { id: true },
    });
    if (owned.length !== fresh.length) {
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
 * post cannot both claim the same link as new.
 */
export async function syncPostActionLinks(
  db: LinksDb,
  input: {
    postSource: PostSource;
    postRef: string;
    countryId: string | null;
    body: string;
    keep?: readonly string[];
  }
): Promise<{ created: string[] }> {
  const { postSource, postRef, countryId: owner, keep } = input;
  const ids = await validatePostActionTokens(db, input);
  const fresh = ids.filter((id) => !keep?.includes(id));
  return db.$transaction(async (tx) => {
    await tx.postActionLink.deleteMany({
      where: { postSource, postRef, activityId: { notIn: ids } },
    });
    if (fresh.length === 0 || !owner) return { created: [] };
    const rows = await tx.postActionLink.createManyAndReturn({
      data: fresh.map((activityId) => ({ postSource, postRef, activityId, countryId: owner })),
      skipDuplicates: true,
      select: { activityId: true },
    });
    return { created: rows.map((row) => row.activityId) };
  });
}

/**
 * The nation's public rows that count as actions a player took: not the generators' fixed-title rows and not the
 * denylisted event types. The reward transaction applies it too (without a search), so a denylisted row never pays. The
 * event-type clauses keep rows with no metadata (a bare NOT would drop them: NULL is neither true nor false), and the
 * title clause is on a column that is never null, so a player with hundreds of Onoma rows still sees their real actions.
 */
export function pickableActivityWhere(
  countryId: string,
  search?: string
): Prisma.ActivityFeedWhereInput {
  return {
    countryId,
    visibility: "public",
    title: {
      notIn: [...NON_ACTION_TITLES],
      ...(search ? { contains: search, mode: "insensitive" as const } : {}),
    },
    AND: NON_ACTION_EVENT_TYPES.map((eventType) => ({
      OR: [{ metadata: null }, { NOT: { metadata: { contains: `"eventType":"${eventType}"` } } }],
    })),
  };
}

/** The newest pickable rows: the last 10 with no search, up to 30 matches for one. */
export function pickableActivities(
  db: Pick<PrismaClient, "activityFeed">,
  countryId: string,
  search?: string
) {
  return db.activityFeed.findMany({
    where: pickableActivityWhere(countryId, search),
    orderBy: { createdAt: "desc" },
    take: search ? SEARCH_ACTIONS : RECENT_ACTIONS,
    select: { id: true, title: true, type: true, createdAt: true },
  });
}
