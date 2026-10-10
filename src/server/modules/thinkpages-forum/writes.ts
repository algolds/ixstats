/**
 * Forum writes: start a thread, reply, edit. Bodies are sanitized HTML plus their plain text (ruling P3), from the
 * light editor or rendered from Canvas wikitext (writes-body.ts; the render runs after every access check). Action
 * tokens are validated before anything is written, so a refused link never leaves a post behind; the links are
 * synced once the post exists. A persona post needs an in-character category and the actor's own active persona
 * (P9), and a post inside a submitted or approved story chain can no longer change (P6). In a realm section,
 * starting, replying and editing all take realm posting access (D5, D13). A forum ban (site, realm or category)
 * refuses every write in its scope, sitewide edits included (T0-17). Writes follow the read rules: a hidden thread or
 * post, and another member's Reports thread (M8), read as not found.
 */
import type { PrismaClient } from "@prisma/client";
import {
  ActionLinkError,
  syncPostActionLinks,
  validatePostActionTokens,
} from "~/server/modules/action-links";
import type { RealmActor } from "~/server/modules/realms";
import { canSeeThread } from "./access";
import { ForumError } from "./errors";
import { assertNotBanned } from "./mod-bans";
import { loadCategory, visibleRealmOf } from "./reads";
import { postingAccessFor, type ForumRealm, type PostableCategory } from "./realm-access";
import {
  bodyFromInput,
  formattingOf,
  MAX_POST_HTML,
  postColumns,
  prepareBody,
  writeTemplates,
  type Formatting,
  type PostInput,
  type PreparedBody,
} from "./writes-body";

export { MAX_POST_HTML, prepareBody, type PostInput, type PreparedBody };
export const TITLE_MIN = 3;
export const TITLE_MAX = 200;

export type ForumActor = RealmActor & { countryId: string | null };
export type WritesDb = Pick<
  PrismaClient,
  | "forumCategory"
  | "forumThread"
  | "forumPost"
  | "forumPostTemplate"
  | "thinkpagesAccount"
  | "activityFeed"
  | "postActionLink"
  | "realm"
  | "country"
  | "realmOfficer"
  | "forumBan"
  | "$transaction"
>;

const LOCKED_CHAIN_STATUSES = ["submitted", "approved"];
const TEAM_ONLY = "Only the team can post in this category.";

function prepareTitle(raw: string): string {
  const title = raw.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    throw new ForumError("BAD_REQUEST", `A title is ${TITLE_MIN} to ${TITLE_MAX} characters.`);
  }
  return title;
}

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
): Promise<string[]> {
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

/** Refuses unless the actor may post in `category`, with the realm's notice when it has one, else `refusal`. */
async function assertCanPost(
  db: WritesDb,
  actor: ForumActor,
  category: PostableCategory,
  realm: ForumRealm | null,
  refusal: string
): Promise<void> {
  const access = await postingAccessFor(db, actor, category, realm);
  if (!access.canPost) throw new ForumError("FORBIDDEN", access.notice ?? refusal);
}

/** The realm of a thread's category (null sitewide); NOT_FOUND when that realm is hidden from the actor or gone. */
async function realmOfThread(
  db: WritesDb,
  actor: ForumActor,
  category: { scope: string; realmId: string | null },
  what: "Thread" | "Post"
): Promise<ForumRealm | null> {
  const realm = await visibleRealmOf(db, actor, category);
  if (realm === undefined) throw new ForumError("NOT_FOUND", `${what} not found.`);
  return realm;
}

async function resolvePersona(
  db: WritesDb,
  actor: ForumActor,
  category: { icAllowed: boolean },
  personaId: string | null | undefined
): Promise<string | null> {
  if (!personaId) return null;
  if (!category.icAllowed)
    throw new ForumError("FORBIDDEN", "This category does not allow in-character posts.");
  const persona = await db.thinkpagesAccount.findFirst({
    where: { id: personaId, clerkUserId: actor.clerkUserId, isActive: true },
    select: { id: true },
  });
  if (!persona)
    throw new ForumError("FORBIDDEN", "You can only post as one of your own active personas.");
  return persona.id;
}

export async function createThread(
  db: WritesDb,
  actor: ForumActor,
  input: PostInput & { categoryKey: string; realm?: string | null; title: string }
): Promise<{ threadId: string; postId: string; formatting: Formatting }> {
  const title = prepareTitle(input.title);
  const { category, realm } = await loadCategory(db, actor, {
    key: input.categoryKey,
    realm: input.realm,
  });
  await assertCanPost(db, actor, category, realm, "You cannot start threads here.");
  const author = {
    authorUserId: actor.id,
    authorPersonaId: await resolvePersona(db, actor, category, input.personaId),
  };
  // After every access check: a render spends the shared MediaWiki engine (P-1).
  const body = await bodyFromInput(input, "new", actor.id);
  await validateLinks(db, actor, body.plainText);
  const now = new Date();
  const { threadId, postId } = await db.$transaction(async (tx) => {
    const thread = await tx.forumThread.create({
      data: { categoryId: category.id, title, ...author, postCount: 1, lastPostAt: now },
    });
    const post = await tx.forumPost.create({
      data: { threadId: thread.id, ...author, ...postColumns(body), createdAt: now },
    });
    await writeTemplates(tx, post.id, body.templates, false);
    return { threadId: thread.id, postId: post.id };
  });
  await syncLinks(db, actor, postId, body.plainText);
  return { threadId, postId, formatting: formattingOf(body) };
}

export async function replyToThread(
  db: WritesDb,
  actor: ForumActor,
  input: PostInput & { threadId: string }
): Promise<{ postId: string; formatting: Formatting }> {
  const thread = await db.forumThread.findUnique({
    where: { id: input.threadId },
    include: { category: true },
  });
  if (!thread || thread.hidden || !canSeeThread(actor, thread, thread.category)) {
    throw new ForumError("NOT_FOUND", "Thread not found.");
  }
  const realm = await realmOfThread(db, actor, thread.category, "Thread");
  await assertCanPost(db, actor, thread.category, realm, TEAM_ONLY);
  if (thread.locked || thread.archived)
    throw new ForumError("CONFLICT", "This thread is closed to replies.");
  const author = {
    authorUserId: actor.id,
    authorPersonaId: await resolvePersona(db, actor, thread.category, input.personaId),
  };
  const body = await bodyFromInput(input, thread.id, actor.id);
  await validateLinks(db, actor, body.plainText);
  const now = new Date();
  const postId = await db.$transaction(async (tx) => {
    const post = await tx.forumPost.create({
      data: { threadId: thread.id, ...author, ...postColumns(body), createdAt: now },
    });
    await writeTemplates(tx, post.id, body.templates, false);
    await tx.forumThread.update({
      where: { id: thread.id },
      data: { postCount: { increment: 1 }, lastPostAt: now },
    });
    return post.id;
  });
  await syncLinks(db, actor, postId, body.plainText);
  return { postId, formatting: formattingOf(body) };
}

/** A Canvas post keeps its wikitext as the source and an HTML post its HTML: an edit cannot switch editors. */
function assertEditor(isWikitextPost: boolean, sendsWikitext: boolean): void {
  if (isWikitextPost && !sendsWikitext)
    throw new ForumError("BAD_REQUEST", "Edit this post in the wiki editor.");
  if (!isWikitextPost && sendsWikitext)
    throw new ForumError("BAD_REQUEST", "This post is edited with the standard editor.");
}

/** M1: the author's edit lost the race with a moderator's (or their own other tab's) edit. */
const EDITED_MEANWHILE =
  "This post changed since you opened it (a moderator's edit or another tab). Reload to see the latest version.";

/**
 * The author edits (moderator edits are `modEditPost`). In a realm section the author must still be able to post
 * there (D13); sitewide only a ban stops them (T0-17), not the category's posting role. `editedAt` is the post's
 * value when the author loaded it: the write is conditional on it (as `modEditPost`'s is), so an author edit never
 * overwrites a moderator's edit made in between (M1).
 */
export async function editPost(
  db: WritesDb,
  actor: ForumActor,
  input: { postId: string; html?: string; wikitext?: string; editedAt: Date | null }
): Promise<{ formatting: Formatting }> {
  const post = await db.forumPost.findUnique({
    where: { id: input.postId },
    select: {
      id: true,
      threadId: true,
      authorUserId: true,
      hidden: true,
      contentWikitext: true,
      thread: {
        select: {
          authorUserId: true,
          hidden: true,
          locked: true,
          archived: true,
          category: {
            select: { id: true, visibility: true, postRole: true, scope: true, realmId: true },
          },
        },
      },
    },
  });
  if (
    !post ||
    post.hidden ||
    post.thread.hidden ||
    !canSeeThread(actor, post.thread, post.thread.category)
  ) {
    throw new ForumError("NOT_FOUND", "Post not found.");
  }
  const { category } = post.thread;
  const realm = await realmOfThread(db, actor, category, "Post");
  if (post.authorUserId !== actor.id)
    throw new ForumError("FORBIDDEN", "Only the author can edit this post.");
  if (post.thread.locked || post.thread.archived)
    throw new ForumError("CONFLICT", "This thread is closed to edits.");
  if (realm) await assertCanPost(db, actor, category, realm, TEAM_ONLY);
  else await assertNotBanned(db, actor, category);
  assertEditor(post.contentWikitext !== null, input.wikitext !== undefined);
  if (await inLockedChain(db, post.id))
    throw new ForumError("CONFLICT", "This post is part of a submitted story chain");
  const body = await bodyFromInput(input, post.threadId, actor.id);
  await validateLinks(db, actor, body.plainText);
  const written = await db.$transaction(async (tx) => {
    const { count } = await tx.forumPost.updateMany({
      where: { id: post.id, editedAt: input.editedAt },
      data: { ...postColumns(body), editedAt: new Date() },
    });
    if (count === 0) return false;
    await writeTemplates(tx, post.id, body.templates, true);
    return true;
  });
  if (!written) throw new ForumError("CONFLICT", EDITED_MEANWHILE);
  await syncLinks(db, actor, post.id, body.plainText);
  return { formatting: formattingOf(body) };
}
