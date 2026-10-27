/**
 * revision-parents.ts — `WikiRevision.parentRevisionId`: the live revision a revision was made on top of.
 *
 * A native save sets it from the head it read under the article's lock (`ArticleRepository.saveArticle`). The writes
 * that insert revisions in bulk or out of order (the XML importer, the inbound sync's imports and echoes) call
 * `fillRevisionParents` after their inserts: every live revision of the page whose parent is not set gets the live
 * revision before it, in the order readers use for a page's history (timestamp, then id). A parked revision (a
 * MediaWiki edit that never went live) is never a parent and is never given one by this; it records the head it
 * conflicted with when the inbound sync parks it. The first live revision of a page has no parent, and a parent that
 * is set is never changed, so running this again changes nothing.
 *
 * The one-time catch-up for rows written before this existed is
 * prisma/manual-migrations/2026-10-01-wikios-revision-parents.sql, which does the same for every page.
 */

import type { Prisma } from "@prisma/client";

/** Anything that can run a raw statement: the client, or a transaction. */
type RawClient = Pick<Prisma.TransactionClient, "$executeRaw">;

/** Set the missing `parentRevisionId` of the live revisions of `articleId`; resolves to the number of rows set. */
export function fillRevisionParents(client: RawClient, articleId: string): Promise<number> {
  return client.$executeRaw`
    UPDATE wiki_revisions AS r
    SET "parentRevisionId" = chain."previousId"
    FROM (
      SELECT "id", lag("id") OVER (ORDER BY "createdAt", "id") AS "previousId"
      FROM wiki_revisions
      WHERE "articleId" = ${articleId} AND "parked" = false
    ) AS chain
    WHERE r."id" = chain."id"
      AND r."parentRevisionId" IS NULL
      AND chain."previousId" IS NOT NULL`;
}
