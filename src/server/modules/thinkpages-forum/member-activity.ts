/**
 * A member's forum footprint for the passport (phase 4b, Q11), read from the native forum now that the XenForo API
 * is retired: post and thread counts by account, and old forum names kept on imported content. Both read only what
 * anyone may read (`publicThreadWhere`): staff-only categories, unpublished realms and hidden content never count
 * and never confirm a name.
 */
import type { PrismaClient } from "@prisma/client";
import { publicThreadWhere } from "./public-threads";

export type MemberActivityDb = Pick<PrismaClient, "forumPost" | "forumThread" | "realm">;

/** Content written as the member themself: persona posts are left out so a count never links the two. */
const OWN = { authorPersonaId: null } as const;

export async function forumActivityOf(
  db: MemberActivityDb,
  userId: string
): Promise<{ posts: number; threads: number }> {
  const visibleThread = await publicThreadWhere(db);
  const [posts, threads] = await Promise.all([
    db.forumPost.count({
      where: { authorUserId: userId, ...OWN, hidden: false, thread: visibleThread },
    }),
    db.forumThread.count({ where: { authorUserId: userId, ...OWN, ...visibleThread } }),
  ]);
  return { posts, threads };
}

/**
 * An old forum member by the name their imported posts carry (case-insensitive), as their XenForo id and name.
 * Only a visible post in a thread anyone may read confirms a name, so a staff-only archive or a draft realm never
 * reveals one.
 */
export async function importedAuthorByName(
  db: Pick<PrismaClient, "forumPost" | "realm">,
  name: string
): Promise<{ userId: number; username: string } | null> {
  const row = await db.forumPost.findFirst({
    where: {
      importedAuthorName: { equals: name, mode: "insensitive" },
      xenforoUserId: { not: null },
      hidden: false,
      thread: await publicThreadWhere(db),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { xenforoUserId: true, importedAuthorName: true },
  });
  return row?.xenforoUserId && row.importedAuthorName
    ? { userId: row.xenforoUserId, username: row.importedAuthorName }
    : null;
}
