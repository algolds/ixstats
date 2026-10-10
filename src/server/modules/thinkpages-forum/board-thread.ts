import type { PrismaClient } from "@prisma/client";
import { REALM_BOARD_KEY } from "~/lib/thinkpages-forum/categories";

export type BoardThreadDb = Pick<PrismaClient, "forumThread">;

/** `sourceRef` of a realm's board thread: the unique key that keeps seeding and the backfill to one per realm. */
export const boardThreadSourceRef = (realmId: string): string => `realm_board_thread:${realmId}`;

/**
 * A realm's board: its board category and the one thread whose posts are the live message board. Creates nothing
 * (seeding does, `seedRealmCategories`); null when the realm has no board yet.
 */
export async function boardThreadOf(
  db: BoardThreadDb,
  realmId: string
): Promise<{ categoryId: string; threadId: string } | null> {
  const thread = await db.forumThread.findFirst({
    where: { category: { scope: "realm", realmId, key: REALM_BOARD_KEY } },
    orderBy: { createdAt: "asc" },
    select: { id: true, categoryId: true },
  });
  return thread ? { categoryId: thread.categoryId, threadId: thread.id } : null;
}
