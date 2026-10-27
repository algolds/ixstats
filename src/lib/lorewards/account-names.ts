import type { PrismaClient } from "@prisma/client";
import { importName } from "~/lib/wiki-os/services/import-label";

/**
 * The `wikios>` names of the labels the account's own ixwiki revisions carry (`authorId` = the account) that no other
 * account's revisions carry: a win under such a name can only be theirs. One query.
 */
export async function exclusiveWikiosNames(
  db: Pick<PrismaClient, "$queryRaw">,
  userId: string
): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ author: string }>>`
    SELECT r.author FROM wiki_revisions r
    WHERE r.source = 'ixwiki' AND r."authorId" = ${userId} AND r.author IS NOT NULL
    GROUP BY r.author
    HAVING NOT EXISTS (SELECT 1 FROM wiki_revisions o WHERE o.source = 'ixwiki' AND o.author = r.author
                       AND o."authorId" IS NOT NULL AND o."authorId" <> ${userId})`;
  return rows.map((row) => importName(row.author));
}
