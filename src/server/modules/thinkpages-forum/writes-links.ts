/**
 * The action-link steps of a forum write (writes.ts re-exports them, so call sites do not change): validating the tokens
 * before anything is written, syncing the links once the post exists, and the story-chain lock.
 */
import type { PrismaClient } from "@prisma/client";
import {
  ActionLinkError,
  syncPostActionLinks,
  validatePostActionTokens,
} from "~/server/modules/action-links";
import { ForumError } from "./errors";
import type { ForumActor, WritesDb } from "./writes";

const LOCKED_CHAIN_STATUSES = ["submitted", "approved"];

/** Runs an action-links call, turning its refusals into the forum's own. */
async function asForumRefusal<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ActionLinkError) throw new ForumError(error.code, error.message);
    throw error;
  }
}

export function validateLinks(
  db: WritesDb,
  actor: ForumActor,
  plainText: string
): Promise<string[]> {
  return asForumRefusal(() =>
    validatePostActionTokens(db, { countryId: actor.countryId, body: plainText })
  );
}

export function syncLinks(
  db: WritesDb,
  actor: ForumActor,
  postId: string,
  plainText: string
): Promise<{ created: string[] }> {
  return asForumRefusal(() =>
    syncPostActionLinks(db, {
      postSource: "native",
      postRef: postId,
      countryId: actor.countryId,
      body: plainText,
    })
  );
}

/** P6 (M17): a post linked into a submitted or approved story chain no longer changes, by its author or a moderator. */
export async function inLockedChain(
  db: Pick<PrismaClient, "postActionLink">,
  postId: string
): Promise<boolean> {
  const chained = await db.postActionLink.count({
    where: {
      postSource: "native",
      postRef: postId,
      storyline: { status: { in: LOCKED_CHAIN_STATUSES } },
    },
  });
  return chained > 0;
}
