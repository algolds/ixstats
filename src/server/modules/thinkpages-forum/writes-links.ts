/**
 * The action-link steps of a forum write (writes.ts re-exports them, so call sites do not change): validating the tokens
 * before anything is written, syncing the links once the post exists, and the story-chain lock.
 */
import type { PrismaClient } from "@prisma/client";
import { parseActionTokens } from "~/lib/action-links";
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
  plainText: string,
  keep?: readonly string[]
): Promise<string[]> {
  return asForumRefusal(() =>
    validatePostActionTokens(db, { countryId: actor.countryId, body: plainText, keep })
  );
}

export function syncLinks(
  db: WritesDb,
  actor: ForumActor,
  postId: string,
  plainText: string,
  keep?: readonly string[]
): Promise<void> {
  return asForumRefusal(() =>
    syncPostActionLinks(db, {
      postSource: "native",
      postRef: postId,
      countryId: actor.countryId,
      body: plainText,
      keep,
    })
  );
}

/**
 * The link check of an edit. The author's NEW tokens must be their own nation's public actions (`validateLinks`); tokens
 * the post already carried are not checked again (the action may have been withdrawn since). A manager editing
 * another member's advert post (R14, as `modEditPost`) may keep or remove tokens but never add one, since links belong
 * to the author's nation.
 */
export async function validateEditLinks(
  db: WritesDb,
  actor: ForumActor,
  post: { authorUserId: string | null; plainText: string },
  plainText: string
): Promise<void> {
  if (post.authorUserId === actor.id) {
    await validateLinks(db, actor, plainText, parseActionTokens(post.plainText));
    return;
  }
  const before = new Set(parseActionTokens(post.plainText));
  if (parseActionTokens(plainText).some((id) => !before.has(id)))
    throw new ForumError("BAD_REQUEST", "A manager edit can't add action links.");
}

/** Syncs the author's links after an edit; a manager's edit only drops the links whose token it removed. */
export async function syncEditLinks(
  db: WritesDb,
  actor: ForumActor,
  post: { id: string; authorUserId: string | null; plainText: string },
  plainText: string
): Promise<void> {
  if (post.authorUserId === actor.id) {
    await syncLinks(db, actor, post.id, plainText, parseActionTokens(post.plainText));
    return;
  }
  await db.postActionLink.deleteMany({
    where: {
      postSource: "native",
      postRef: post.id,
      activityId: { notIn: parseActionTokens(plainText) },
    },
  });
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
