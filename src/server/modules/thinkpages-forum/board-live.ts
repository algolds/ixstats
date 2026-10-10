/**
 * Live delivery of a realm board (docs/superpowers/specs/2026-10-10-thinkpages-realm-board-design.md, section 2).
 * Every board write publishes what the room's readers need through the ThinkPages broadcaster: in-process, or over
 * Redis to `ixstats-ws`. A payload is the public shape of the message: viewer-independent (no `byViewer`, `canEdit`,
 * `hidden`) and persona-safe (no player id on a persona's message, none of the player's own flag, name or role). A
 * hidden message is never sent: hiding it is a removal. Moderator-only data is never broadcast; moderators refresh
 * their copy through the query. Publishing never fails the write that caused it.
 */
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import type {
  BoardLiveChange,
  BoardLiveEvent,
  BoardLiveMessage,
} from "~/lib/thinkpages-forum/board-live";
import type { BoardBroadcaster } from "~/server/thinkpages-broadcast-bridge";
import {
  BOARD_POST_SELECT,
  shapeBoardMessages,
  type BoardMessage,
  type BoardMessageDb,
} from "./board-messages";
import { loadForumRealm } from "./realm-access";

const PUBLISH_SELECT = {
  ...BOARD_POST_SELECT,
  threadId: true,
  thread: {
    select: {
      category: { select: { id: true, key: true, style: true, scope: true, realmId: true } },
    },
  },
} as const;

/**
 * A board message as the room receives it. Built from whatever shape the caller holds, so it drops what is
 * viewer-specific and what a persona must not reveal; a hidden message is a removal.
 */
export function boardMessagePayload(message: BoardMessage): BoardLiveChange {
  if (message.hidden) return { type: "removed", postId: message.id };
  const live: BoardLiveMessage = {
    id: message.id,
    authorUserId: message.authorPersonaId ? null : message.authorUserId,
    authorPersonaId: message.authorPersonaId,
    importedAuthorName: message.importedAuthorName,
    author: message.author,
    role: message.role,
    isVisitor: message.isVisitor,
    visitorRealm: message.visitorRealm,
    contentHtml: message.contentHtml,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    replyTo: message.replyTo,
    continued: message.continued,
  };
  return { type: "updated", message: live };
}

/** Never fails the write: a broadcaster or database that is down only costs the room its live update. */
function warnPublishFailed(error: Error): void {
  console.warn("[RealmBoardLive] publish failed:", error.message);
}

/** The post's board realm and its public change, read fresh as an anonymous reader would see it; null off a board. */
async function publicChangeOf(
  db: BoardMessageDb,
  postId: string
): Promise<{ realmId: string; change: BoardLiveChange } | null> {
  const row = await db.forumPost.findUnique({ where: { id: postId }, select: PUBLISH_SELECT });
  const category = row?.thread.category;
  if (!row || !category?.realmId || !isBoardCategory(category)) return null;
  if (row.hidden) return { realmId: category.realmId, change: { type: "removed", postId } };
  const realm = await loadForumRealm(db, { id: category.realmId });
  if (!realm) return null;
  const place = { realm, threadId: row.threadId, category, canModerate: false };
  const [message] = await shapeBoardMessages(db, null, place, [row]);
  return message ? { realmId: realm.id, change: boardMessagePayload(message) } : null;
}

/**
 * Publishes a stored board post to its realm's room: `message` for one just posted, `updated` for an edit, an unhide
 * or a continued-in-a-thread placeholder (a hidden post is then a removal). Does nothing for a post off a board.
 */
export async function publishBoardPost(
  db: BoardMessageDb,
  out: BoardBroadcaster,
  postId: string,
  kind: "message" | "updated"
): Promise<void> {
  try {
    const found = await publicChangeOf(db, postId);
    if (!found) return;
    const { realmId, change } = found;
    if (kind === "updated") {
      out.broadcastBoard({ type: "board:updated", realmId, change });
    } else if (change.type === "updated") {
      out.broadcastBoard({ type: "board:message", realmId, message: change.message });
    }
  } catch (error) {
    warnPublishFailed(error as Error);
  }
}

/**
 * A message moved into a thread: the room drops it and shows the placeholder that took its place. The realm is the
 * placeholder's, read from the stored board.
 */
export async function publishBoardContinued(
  db: BoardMessageDb,
  out: BoardBroadcaster,
  movedPostId: string,
  placeholderId: string
): Promise<void> {
  try {
    const found = await publicChangeOf(db, placeholderId);
    if (!found) return;
    publishBoardRemoval(out, found.realmId, movedPostId);
    out.broadcastBoard({ type: "board:updated", realmId: found.realmId, change: found.change });
  } catch (error) {
    warnPublishFailed(error as Error);
  }
}

function publish(out: BoardBroadcaster, event: BoardLiveEvent): void {
  try {
    out.broadcastBoard(event);
  } catch (error) {
    warnPublishFailed(error as Error);
  }
}

/** A message left the board (moved into a thread): its readers drop it. */
export function publishBoardRemoval(out: BoardBroadcaster, realmId: string, postId: string): void {
  publish(out, { type: "board:updated", realmId, change: { type: "removed", postId } });
}

/** The board's rules changed: composers update slow mode and visitor posting. */
export function publishBoardSettings(
  out: BoardBroadcaster,
  realmId: string,
  settings: { visitorsAllowed: boolean; slowModeSeconds: number }
): void {
  publish(out, { type: "board:settings", realmId, settings });
}
