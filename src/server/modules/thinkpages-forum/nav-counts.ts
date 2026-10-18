/**
 * What the sidebar counts for a signed-in member (spec section 3), in one poll: new messages on their realm's board
 * since they last read it (Your realm), clamped for the "99+" badge.
 */
import type { PrismaClient } from "@prisma/client";
import { capCount, seenSince, unreadFloor } from "~/lib/thinkpages-forum/unread";
import type { ForumViewer } from "./access";
import { boardThreadOf, PREVIEWED_BOARD_MESSAGES } from "./board-thread";
import { canSeeRealm, loadForumRealm, type RealmDb } from "./realm-access";
import { primaryRealmIdOf } from "./realm-reads";
import type { ReadsDb } from "./reads";
import type { UnreadDb } from "./unread";

export type NavCountsDb = ReadsDb &
  UnreadDb &
  RealmDb &
  Pick<PrismaClient, "country" | "forumPost">;

export interface NavCounts {
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
  return { realmBoardNew: capCount(await realmBoardNew(db, viewer, unreadFloor(new Date()))) };
}
