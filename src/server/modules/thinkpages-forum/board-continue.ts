/**
 * Continue a board message in a thread: a message too long or too good for the board becomes the first post of a new
 * thread in the realm (the Hub unless the author picks another category), and the board keeps a short placeholder
 * message in its place, linked to the thread. The author does it, or a moderator of the realm (logged in the moderation
 * log, in the same transaction). The very post moves, so its id, its reports and its permalink follow it; replies to
 * it now answer the placeholder; the author needs to be able to start a thread there, so a visitor cannot.
 */
import { REALM_HUB_KEY, isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { canModerateCategory, scopeOfCategory } from "./mod-scope";
import type { BoardMessage } from "./board-messages";
import { storedBoardMessage, type BoardWritesDb } from "./board-writes";
import { loadBoard } from "./board";
import { ForumError } from "./errors";
import { contentModerator, type ContentDb } from "./mod-content-target";
import { logModAction } from "./mod-log";
import { loadCategory, visibleRealmOf } from "./reads";
import { postingAccessFor } from "./realm-access";
import { inLockedChain, prepareTitle, type ForumActor } from "./writes";

export type BoardContinueDb = BoardWritesDb & ContentDb;

const PLACEHOLDER_TEXT = "Continued in a thread";

async function loadMessage(db: BoardContinueDb, postId: string) {
  const post = await db.forumPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      threadId: true,
      authorUserId: true,
      authorPersonaId: true,
      importedAuthorName: true,
      hidden: true,
      createdAt: true,
      continuedThreadId: true,
      thread: {
        select: {
          category: {
            select: {
              id: true,
              key: true,
              style: true,
              scope: true,
              realmId: true,
              visibility: true,
              icAllowed: true,
            },
          },
        },
      },
    },
  });
  const category = post?.thread.category;
  if (!post || !category || !isBoardCategory(category)) {
    throw new ForumError("NOT_FOUND", "Message not found.");
  }
  return { post, category };
}

export async function continueInThread(
  db: BoardContinueDb,
  actor: ForumActor,
  input: { postId: string; title: string; categoryKey?: string }
): Promise<{ threadId: string; postId: string; placeholder: BoardMessage }> {
  const title = prepareTitle(input.title);
  const { post, category } = await loadMessage(db, input.postId);
  const realm = await visibleRealmOf(db, actor, category);
  if (!realm) throw new ForumError("NOT_FOUND", "Message not found.");
  const isAuthor = post.authorUserId === actor.id;
  // A hidden message reads as gone to anyone who does not moderate the board.
  if (post.hidden && !canModerateCategory(actor, category)) {
    throw new ForumError("NOT_FOUND", "Message not found.");
  }
  if (!isAuthor) await contentModerator(db, actor, category, post.authorUserId);
  if (post.hidden)
    throw new ForumError("CONFLICT", "Unhide this message before continuing it in a thread.");
  if (post.continuedThreadId !== null) {
    throw new ForumError("CONFLICT", "This message was already continued in a thread.");
  }
  const destination = await loadCategory(db, actor, {
    key: input.categoryKey ?? REALM_HUB_KEY,
    realm: realm.slug,
  });
  if (isAuthor) {
    const access = await postingAccessFor(db, actor, destination.category, destination.realm);
    if (!access.canPost)
      throw new ForumError("FORBIDDEN", access.notice ?? "You cannot start threads here.");
  }
  if (post.authorPersonaId !== null && !destination.category.icAllowed) {
    throw new ForumError(
      "CONFLICT",
      "In-character messages can only be continued in an in-character category."
    );
  }
  if (await inLockedChain(db, post.id)) {
    throw new ForumError("CONFLICT", "This message is part of a submitted story chain");
  }
  const author = {
    authorUserId: post.authorUserId,
    authorPersonaId: post.authorPersonaId,
    importedAuthorName: post.importedAuthorName,
  };
  const now = new Date();
  const moved = await db.$transaction(async (tx) => {
    const thread = await tx.forumThread.create({
      data: {
        categoryId: destination.category.id,
        title,
        ...author,
        postCount: 1,
        lastPostAt: now,
      },
    });
    const { count } = await tx.forumPost.updateMany({
      where: { id: post.id, threadId: post.threadId, continuedThreadId: null, hidden: false },
      data: { threadId: thread.id, replyToPostId: null },
    });
    if (count === 0)
      throw new ForumError("CONFLICT", "This message changed since you opened it. Reload it.");
    const placeholder = await tx.forumPost.create({
      data: {
        threadId: post.threadId,
        ...author,
        contentHtml: `<p>${PLACEHOLDER_TEXT}</p>`,
        plainText: PLACEHOLDER_TEXT,
        createdAt: post.createdAt,
        continuedThreadId: thread.id,
      },
    });
    await tx.forumPost.updateMany({
      where: { replyToPostId: post.id, threadId: post.threadId },
      data: { replyToPostId: placeholder.id },
    });
    // M11: open reports follow the message so the destination's moderators see them.
    await tx.forumReport.updateMany({
      where: { status: "open", targetType: "post", targetId: post.id },
      data: { categoryId: destination.category.id },
    });
    if (!isAuthor) {
      await logModAction(tx, {
        actorId: actor.id,
        action: "post.continue",
        targetType: "post",
        targetId: post.id,
        scope: scopeOfCategory(category),
        detail: { threadId: thread.id, title },
      });
    }
    return { threadId: thread.id, placeholderId: placeholder.id };
  });
  const place = await loadBoard(db, actor, { id: realm.id });
  return {
    threadId: moved.threadId,
    postId: post.id,
    placeholder: await storedBoardMessage(db, actor, place, moved.placeholderId),
  };
}
