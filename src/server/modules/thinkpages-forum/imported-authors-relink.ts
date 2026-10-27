/**
 * Imported XenForo threads and posts with no author take the IxStats user now linked to their XenForo user, and so do
 * the reports on them (M8). Kept from the retired XenForo importer for the staff old-forum link (phase 4b,
 * old-forum-accounts.ts), which has already made that user the only holder of the XenForo id. Only rows carrying the
 * XenForo user id are touched, so guests and native content never match.
 */
import type { Prisma } from "@prisma/client";

type RelinkDb = Pick<Prisma.TransactionClient, "forumThread" | "forumPost" | "$executeRaw">;

/**
 * M8: reports filed on rows that had no author take the author those rows have now, so a moderator's queue keeps
 * leaving out reports about their own content. Only reports still unattributed are touched.
 */
async function attributeReports(db: Pick<RelinkDb, "$executeRaw">): Promise<void> {
  await db.$executeRaw`UPDATE "forum_reports" AS r SET "targetAuthorId" = t."authorUserId" FROM "forum_threads" AS t WHERE r."targetType" = 'thread' AND r."targetId" = t."id" AND r."targetAuthorId" IS NULL AND t."authorUserId" IS NOT NULL`;
  await db.$executeRaw`UPDATE "forum_reports" AS r SET "targetAuthorId" = t."authorUserId" FROM "forum_posts" AS t WHERE r."targetType" = 'post' AND r."targetId" = t."id" AND r."targetAuthorId" IS NULL AND t."authorUserId" IS NOT NULL`;
}

/** Attributes the authorless imported threads and posts of `xenforoUserId` to `authorUserId`. */
export async function relinkImportedAuthors(
  db: RelinkDb,
  xenforoUserId: number,
  authorUserId: string
): Promise<{ threads: number; posts: number }> {
  const where = { authorUserId: null, xenforoUserId };
  const data = { authorUserId };
  const relinked = {
    threads: (await db.forumThread.updateMany({ where, data })).count,
    posts: (await db.forumPost.updateMany({ where, data })).count,
  };
  if (relinked.threads + relinked.posts > 0) await attributeReports(db);
  return relinked;
}
