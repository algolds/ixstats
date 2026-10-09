/**
 * A member's forum footprint for the passport (phase 4b, Q11), read from the native forum now that the XenForo API
 * is retired: post and thread counts by account, and old forum names kept on imported content.
 */
import type { PrismaClient } from "@prisma/client";

export type MemberActivityDb = Pick<PrismaClient, "forumPost" | "forumThread">;

/** Visible content written as the member themself: persona posts are left out so a count never links the two. */
const OWN_VISIBLE = { authorPersonaId: null, hidden: false } as const;

export async function forumActivityOf(
  db: MemberActivityDb,
  userId: string
): Promise<{ posts: number; threads: number }> {
  const [posts, threads] = await Promise.all([
    db.forumPost.count({ where: { authorUserId: userId, ...OWN_VISIBLE, thread: { hidden: false } } }),
    db.forumThread.count({ where: { authorUserId: userId, ...OWN_VISIBLE } }),
  ]);
  return { posts, threads };
}

/**
 * An old forum member by the name their imported posts carry (case-insensitive), as their XenForo id and name.
 * Only visible content counts, so a hidden post never confirms a name.
 */
export async function importedAuthorByName(
  db: Pick<PrismaClient, "forumPost">,
  name: string
): Promise<{ userId: number; username: string } | null> {
  const row = await db.forumPost.findFirst({
    where: {
      importedAuthorName: { equals: name, mode: "insensitive" },
      xenforoUserId: { not: null },
      hidden: false,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { xenforoUserId: true, importedAuthorName: true },
  });
  return row?.xenforoUserId && row.importedAuthorName
    ? { userId: row.xenforoUserId, username: row.importedAuthorName }
    : null;
}
