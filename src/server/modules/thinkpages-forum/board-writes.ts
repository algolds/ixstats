/**
 * Realm board writes: post a message, edit your own within 15 minutes, change the board's settings. Board messages
 * are forum posts in the realm's one board thread, written here and nowhere else (the generic reply and edit refuse
 * the board). They go through the forum's own checks: realm posting access (bans, archived realms, a nation here)
 * or visitor access (`boardAccessFor`), `prepareBody` (sanitized as the last transform), action-token validation, a
 * persona only of the actor's own. The 1,000 character cap and slow mode are enforced here, not by the composer.
 * Every write returns the stored message shaped as `getBoard` returns it, for the live publish.
 */
import type { PrismaClient } from "@prisma/client";
import {
  BOARD_EDIT_WINDOW_MS,
  BOARD_TOO_LONG,
  isSlowModeSeconds,
  isWithinBoardCap,
  slowModeNotice,
} from "~/lib/thinkpages-forum/board";
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { hasRealmPower, isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import {
  boardAccessFor,
  boardSettingsOf,
  type BoardAccess,
  type BoardSettings,
} from "./board-access";
import { BOARD_POST_SELECT, shapeBoardMessages, type BoardMessage } from "./board-messages";
import { loadBoard, type BoardReadsDb } from "./board";
import { ForumError } from "./errors";
import { visibleRealmOf } from "./reads";
import { canSeeRealm, loadForumRealm } from "./realm-access";
import {
  inLockedChain,
  MAX_POST_HTML,
  prepareBody,
  resolvePersona,
  syncLinks,
  validateLinks,
  type ForumActor,
  type WritesDb,
} from "./writes";

export type BoardWritesDb = BoardReadsDb & WritesDb;

/** The sanitized body of a board message, within the cap. */
function boardBody(html: string) {
  // A paste over the post limit is also "too long for the board", with the same way out.
  if (html.length > MAX_POST_HTML) throw new ForumError("BAD_REQUEST", BOARD_TOO_LONG);
  const body = prepareBody(html);
  if (!isWithinBoardCap(body.plainText)) throw new ForumError("BAD_REQUEST", BOARD_TOO_LONG);
  return body;
}

function assertCanPostOnBoard(access: BoardAccess): void {
  if (!access.canPost) {
    throw new ForumError("FORBIDDEN", access.notice ?? "You cannot post on this board.");
  }
}

/** The message a reply answers: a visible message of this board that is not a continued-in-a-thread placeholder. */
async function assertReplyTarget(
  db: Pick<PrismaClient, "forumPost">,
  threadId: string,
  postId: string
): Promise<void> {
  const target = await db.forumPost.findUnique({
    where: { id: postId },
    select: { threadId: true, hidden: true, continuedThreadId: true },
  });
  if (
    !target ||
    target.threadId !== threadId ||
    target.hidden ||
    target.continuedThreadId !== null
  ) {
    throw new ForumError("BAD_REQUEST", "You can only reply to a visible message on this board.");
  }
}

/**
 * Slow mode (spec section 2): members post at most once per `slowModeSeconds` on a realm's board; moderators are
 * exempt. The wait comes from the actor's latest message in the board thread (a persona's counts, and so does the placeholder
 * a continued message leaves behind, which keeps the message's author and time), so it is exact, refused attempts never extend it, and it holds without the rate limiter.
 */
async function enforceSlowMode(
  db: Pick<PrismaClient, "forumPost">,
  actor: ForumActor,
  threadId: string,
  settings: BoardSettings,
  access: BoardAccess
): Promise<void> {
  if (access.isModerator || settings.slowModeSeconds <= 0) return;
  const [latest] = await db.forumPost.findMany({
    where: { threadId, authorUserId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { createdAt: true },
  });
  if (!latest) return;
  const remainingMs = settings.slowModeSeconds * 1000 - (Date.now() - latest.createdAt.getTime());
  if (remainingMs <= 0) return;
  const wait = Math.ceil(remainingMs / 1000);
  throw new ForumError("TOO_MANY_REQUESTS", slowModeNotice(wait), wait);
}

/** The stored post as the viewer's board message. */
export async function storedBoardMessage(
  db: BoardWritesDb,
  viewer: ForumViewer,
  place: Awaited<ReturnType<typeof loadBoard>>,
  postId: string
): Promise<BoardMessage> {
  const row = await db.forumPost.findUnique({ where: { id: postId }, select: BOARD_POST_SELECT });
  if (!row) throw new ForumError("NOT_FOUND", "Message not found.");
  const [message] = await shapeBoardMessages(db, viewer, place, [row]);
  return message!;
}

export async function postBoardMessage(
  db: BoardWritesDb,
  actor: ForumActor,
  input: { realm: string; html: string; personaId?: string | null; replyToPostId?: string | null }
): Promise<BoardMessage> {
  const place = await loadBoard(db, actor, { slug: input.realm });
  const settings = await boardSettingsOf(db, place.realm.id);
  const access = await boardAccessFor(db, actor, place.realm, settings, place.category);
  assertCanPostOnBoard(access);
  const authorPersonaId = await resolvePersona(db, actor, place.category, input.personaId);
  const body = boardBody(input.html);
  if (input.replyToPostId) await assertReplyTarget(db, place.threadId, input.replyToPostId);
  await validateLinks(db, actor, body.plainText);
  await enforceSlowMode(db, actor, place.threadId, settings, access);
  const now = new Date();
  const postId = await db.$transaction(async (tx) => {
    const post = await tx.forumPost.create({
      data: {
        threadId: place.threadId,
        authorUserId: actor.id,
        authorPersonaId,
        contentHtml: body.contentHtml,
        plainText: body.plainText,
        replyToPostId: input.replyToPostId ?? null,
        createdAt: now,
      },
    });
    await tx.forumThread.update({
      where: { id: place.threadId },
      data: { postCount: { increment: 1 }, lastPostAt: now },
    });
    return post.id;
  });
  await syncLinks(db, actor, postId, body.plainText);
  return storedBoardMessage(db, actor, place, postId);
}

/**
 * The author edits a board message for 15 minutes after posting. Moderators edit through the moderator edit. The
 * write is conditional on the message being unchanged since it was read, so a moderator's edit made in between is a
 * CONFLICT, never overwritten.
 */
export async function editBoardMessage(
  db: BoardWritesDb,
  actor: ForumActor,
  input: { postId: string; html: string }
): Promise<BoardMessage> {
  const post = await db.forumPost.findUnique({
    where: { id: input.postId },
    select: {
      id: true,
      authorUserId: true,
      hidden: true,
      editedAt: true,
      createdAt: true,
      continuedThreadId: true,
      thread: {
        select: {
          category: { select: { id: true, key: true, style: true, scope: true, realmId: true } },
        },
      },
    },
  });
  const category = post?.thread.category;
  if (!post || !category || post.hidden || !isBoardCategory(category)) {
    throw new ForumError("NOT_FOUND", "Message not found.");
  }
  const realm = await visibleRealmOf(db, actor, category);
  if (!realm) throw new ForumError("NOT_FOUND", "Message not found.");
  if (post.authorUserId !== actor.id) {
    throw new ForumError("FORBIDDEN", "Only the author can edit this message.");
  }
  if (post.continuedThreadId !== null) {
    throw new ForumError("CONFLICT", "This message was continued in a thread.");
  }
  if (Date.now() - post.createdAt.getTime() > BOARD_EDIT_WINDOW_MS) {
    throw new ForumError("FORBIDDEN", "Board messages can be edited for 15 minutes after posting.");
  }
  const place = await loadBoard(db, actor, { id: realm.id });
  assertCanPostOnBoard(await boardAccessFor(db, actor, realm, undefined, place.category));
  if (await inLockedChain(db, post.id)) {
    throw new ForumError("CONFLICT", "This message is part of a submitted story chain");
  }
  const body = boardBody(input.html);
  await validateLinks(db, actor, body.plainText);
  const { count } = await db.forumPost.updateMany({
    where: { id: post.id, editedAt: post.editedAt },
    data: { contentHtml: body.contentHtml, plainText: body.plainText, editedAt: new Date() },
  });
  if (count === 0) {
    throw new ForumError(
      "CONFLICT",
      "This message changed since you opened it. Reload to see the latest version."
    );
  }
  await syncLinks(db, actor, post.id, body.plainText);
  return storedBoardMessage(db, actor, place, post.id);
}

/**
 * Founders, site admins and officers with the `board` power set the board's rules: whether visitors may post, and the
 * slow-mode interval. Only what is sent changes; returns the settings as stored.
 */
export async function updateBoardSettings(
  db: Pick<PrismaClient, "realm" | "realmOfficer">,
  actor: ForumActor,
  realmId: string,
  input: { visitorsAllowed?: boolean; slowModeSeconds?: number }
): Promise<Pick<BoardSettings, "visitorsAllowed" | "slowModeSeconds">> {
  const realm = await loadForumRealm(db, { id: realmId });
  if (!realm || !canSeeRealm(actor, realm)) throw new ForumError("NOT_FOUND", "Realm not found.");
  const officers = isSiteAdmin(actor)
    ? []
    : await db.realmOfficer.findMany({
        where: { realmId: realm.id, userId: actor.clerkUserId },
        select: { userId: true, powers: true },
      });
  if (!hasRealmPower(actor, realm, officers, "board")) {
    throw new ForumError(
      "FORBIDDEN",
      "Only the realm's founder and board officers can change the board's settings."
    );
  }
  const { visitorsAllowed, slowModeSeconds } = input;
  if (slowModeSeconds !== undefined && !isSlowModeSeconds(slowModeSeconds)) {
    throw new ForumError(
      "BAD_REQUEST",
      "Slow mode is off, 10 seconds, 30 seconds, 1 minute or 5 minutes."
    );
  }
  const { count } = await db.realm.updateMany({
    where: { id: realm.id },
    data: {
      ...(visitorsAllowed === undefined ? {} : { boardVisitorsAllowed: visitorsAllowed }),
      ...(slowModeSeconds === undefined ? {} : { boardSlowModeSeconds: slowModeSeconds }),
    },
  });
  if (count === 0) throw new ForumError("NOT_FOUND", "Realm not found.");
  const { visitorsAllowed: allowed, slowModeSeconds: seconds } = await boardSettingsOf(
    db,
    realm.id
  );
  return { visitorsAllowed: allowed, slowModeSeconds: seconds };
}
