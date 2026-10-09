/**
 * Forum writes: start a thread, reply, edit. Bodies are sanitized HTML plus their plain text (ruling P3). Action
 * tokens are validated before anything is written, so a refused link never leaves a post behind; the links are
 * synced once the post exists. A persona post needs an in-character category and the actor's own active persona
 * (P9), and a post inside a submitted or approved story chain can no longer change (P6). In a realm section,
 * starting, replying and editing all take realm posting access (D5, D13): a muted or banned player cannot change it.
 */
import type { PrismaClient } from "@prisma/client";
import { countActionTokens, countTextActionTokens } from "~/lib/action-links";
import { sanitizeUserContent, stripHtml } from "~/lib/utils/sanitize-html";
import {
  ActionLinkError,
  syncPostActionLinks,
  validatePostActionTokens,
} from "~/server/modules/action-links";
import type { RealmActor } from "~/server/modules/realms";
import { canSeeCategory, canStartThread } from "./access";
import { ForumError } from "./errors";
import { loadCategory, visibleRealmOf } from "./reads";
import { postingAccessFor, type ForumRealm, type PostableCategory } from "./realm-access";

export const MAX_POST_HTML = 50_000;
export const TITLE_MIN = 3;
export const TITLE_MAX = 200;

export type ForumActor = RealmActor & { countryId: string | null };
export type WritesDb = Pick<
  PrismaClient,
  | "forumCategory"
  | "forumThread"
  | "forumPost"
  | "thinkpagesAccount"
  | "activityFeed"
  | "postActionLink"
  | "realm"
  | "country"
  | "realmOfficer"
  | "realmBoardBan"
  | "realmClaim"
  | "$transaction"
>;

export interface PostInput {
  html: string;
  personaId?: string | null;
}

interface PreparedBody {
  contentHtml: string;
  plainText: string;
}

const LOCKED_CHAIN_STATUSES = ["submitted", "approved"];
const TEAM_ONLY = "Only the team can post in this category.";

function prepareBody(html: string): PreparedBody {
  if (html.length > MAX_POST_HTML) {
    throw new ForumError("BAD_REQUEST", `A post can be at most ${MAX_POST_HTML} characters.`);
  }
  const contentHtml = sanitizeUserContent(html);
  const plainText = stripHtml(contentHtml);
  if (!plainText) throw new ForumError("BAD_REQUEST", "A post needs some text.");
  // A token inside a tag or attribute would never render as a card and must never be cut by the renderer.
  const rendered = countTextActionTokens(contentHtml);
  if (rendered !== countActionTokens(contentHtml) || rendered !== countActionTokens(plainText)) {
    throw new ForumError("BAD_REQUEST", "Action links must be plain text in the post body");
  }
  return { contentHtml, plainText };
}

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

function validateLinks(db: WritesDb, actor: ForumActor, plainText: string): Promise<string[]> {
  return asForumRefusal(() =>
    validatePostActionTokens(db, { countryId: actor.countryId, body: plainText })
  );
}

function syncLinks(
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
): Promise<{ threadId: string; postId: string }> {
  const title = prepareTitle(input.title);
  const body = prepareBody(input.html);
  const { category, realm } = await loadCategory(db, actor, {
    key: input.categoryKey,
    realm: input.realm,
  });
  const cannotStart = "You cannot start threads here.";
  await assertCanPost(db, actor, category, realm, cannotStart);
  if (!canStartThread(actor, category)) throw new ForumError("FORBIDDEN", cannotStart);
  const author = {
    authorUserId: actor.id,
    authorPersonaId: await resolvePersona(db, actor, category, input.personaId),
  };
  await validateLinks(db, actor, body.plainText);
  const now = new Date();
  const { threadId, postId } = await db.$transaction(async (tx) => {
    const thread = await tx.forumThread.create({
      data: { categoryId: category.id, title, ...author, postCount: 1, lastPostAt: now },
    });
    const post = await tx.forumPost.create({
      data: { threadId: thread.id, ...author, ...body, createdAt: now },
    });
    return { threadId: thread.id, postId: post.id };
  });
  await syncLinks(db, actor, postId, body.plainText);
  return { threadId, postId };
}

export async function replyToThread(
  db: WritesDb,
  actor: ForumActor,
  input: PostInput & { threadId: string }
): Promise<{ postId: string }> {
  const body = prepareBody(input.html);
  const thread = await db.forumThread.findUnique({
    where: { id: input.threadId },
    include: { category: true },
  });
  if (!thread || thread.hidden || !canSeeCategory(actor, thread.category)) {
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
  await validateLinks(db, actor, body.plainText);
  const now = new Date();
  const postId = await db.$transaction(async (tx) => {
    const post = await tx.forumPost.create({
      data: { threadId: thread.id, ...author, ...body, createdAt: now },
    });
    await tx.forumThread.update({
      where: { id: thread.id },
      data: { postCount: { increment: 1 }, lastPostAt: now },
    });
    return post.id;
  });
  await syncLinks(db, actor, postId, body.plainText);
  return { postId };
}

/**
 * Only the author edits in phase 1 (site admins gain it with moderation in phase 3). In a realm section the author
 * must still be able to post there (D13).
 */
export async function editPost(
  db: WritesDb,
  actor: ForumActor,
  input: { postId: string; html: string }
): Promise<void> {
  const post = await db.forumPost.findUnique({
    where: { id: input.postId },
    select: {
      id: true,
      authorUserId: true,
      hidden: true,
      thread: {
        select: {
          hidden: true,
          locked: true,
          archived: true,
          category: { select: { visibility: true, postRole: true, scope: true, realmId: true } },
        },
      },
    },
  });
  if (!post || post.hidden || post.thread.hidden || !canSeeCategory(actor, post.thread.category)) {
    throw new ForumError("NOT_FOUND", "Post not found.");
  }
  const { category } = post.thread;
  const realm = await realmOfThread(db, actor, category, "Post");
  if (post.authorUserId !== actor.id)
    throw new ForumError("FORBIDDEN", "Only the author can edit this post.");
  if (post.thread.locked || post.thread.archived)
    throw new ForumError("CONFLICT", "This thread is closed to edits.");
  if (realm) await assertCanPost(db, actor, category, realm, TEAM_ONLY);
  const body = prepareBody(input.html);
  const chained = await db.postActionLink.count({
    where: {
      postSource: "native",
      postRef: post.id,
      storyline: { status: { in: LOCKED_CHAIN_STATUSES } },
    },
  });
  if (chained > 0) throw new ForumError("CONFLICT", "This post is part of a submitted story chain");
  await validateLinks(db, actor, body.plainText);
  await db.forumPost.update({ where: { id: post.id }, data: { ...body, editedAt: new Date() } });
  await syncLinks(db, actor, post.id, body.plainText);
}
