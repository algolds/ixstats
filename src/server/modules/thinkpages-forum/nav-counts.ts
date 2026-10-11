/**
 * What the sidebar counts for a signed-in member (spec section 3), in one poll: unread watched threads (Watched) and
 * new messages on their realm's board since they last read it (Your realm). Each is clamped for the "99+" badge. The
 * realm board's own read mark is the only place its read-state is used.
 */
import type { PrismaClient } from "@prisma/client";
import { capCount, seenSince } from "~/lib/thinkpages-forum/unread";
import type { ForumViewer } from "./access";
import { boardThreadOf, PREVIEWED_BOARD_MESSAGES } from "./board-thread";
import { canSeeRealm, loadForumRealm, type RealmDb } from "./realm-access";
import { primaryRealmIdOf } from "./realm-reads";
import { unreadWatchedCount, type ListingDb } from "./thread-listing";
import { readerFloor } from "./unread";

export type NavCountsDb = ListingDb & RealmDb & Pick<PrismaClient, "country" | "forumPost">;

export interface NavCounts {
  watchedUnread: number;
  realmBoardNew: number;
}

/**
 * Messages on the viewer's realm board newer than their read mark (or the floor), not their own. Hidden messages and
 * continued placeholders are not counted: the Home panel's list skips them too.
 */
async function realmBoardNew(
  db: NavCountsDb,
  viewer: NonNullable<ForumViewer>,
  floor: Date
): Promise<number> {
  const realmId = await primaryRealmIdOf(db, viewer);
  const realm = realmId ? await loadForumRealm(db, { id: realmId }) : null;
  if (!realm || !canSeeRealm(viewer, realm)) return 0;
  const board = await boardThreadOf(db, realm.id);
  if (!board) return 0;
  const read = await db.forumThreadRead.findUnique({
    where: { userId_threadId: { userId: viewer.id, threadId: board.threadId } },
    select: { readAt: true },
  });
  const since = seenSince(read?.readAt, floor);
  return db.forumPost.count({
    where: {
      threadId: board.threadId,
      ...PREVIEWED_BOARD_MESSAGES,
      createdAt: { gt: since },
      // An imported message has no author; `not` alone would drop the null rows.
      OR: [{ authorUserId: null }, { authorUserId: { not: viewer.id } }],
    },
  });
}

export async function forumNavCounts(
  db: NavCountsDb,
  viewer: NonNullable<ForumViewer>
): Promise<NavCounts> {
  const floor = await readerFloor(db, viewer.id);
  const [watched, board] = await Promise.all([
    unreadWatchedCount(db, viewer, floor),
    realmBoardNew(db, viewer, floor),
  ]);
  return { watchedUnread: capCount(watched), realmBoardNew: capCount(board) };
}
