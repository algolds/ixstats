/**
 * sitemap-service.ts — the pages the sitemap lists: published main-namespace IxWiki pages that are
 * not redirects, in title order, with the time of their newest revision (`lastmod`).
 *
 * A redirect is told by its text, as `parseRedirect` and MediaWiki do (the page starts with
 * `#REDIRECT`), never by the `redirectTargetSlug` column, which any write that skips `saveArticle`
 * leaves stale.
 */

import { db } from "~/server/db";

/** The sitemap protocol's cap on URLs in one file. */
export const SITEMAP_PAGE_SIZE = 50_000;

export interface SitemapEntry {
  title: string;
  /** The newest revision's time; the article's last update when it has no revision rows. */
  lastModified: Date;
}

/**
 * How many pages the sitemap lists. The redirect test reads the first 64 characters of the text in
 * the database (`#REDIRECT` after optional whitespace): the rest of a page never crosses the wire.
 */
export async function countSitemapPages(): Promise<number> {
  const [row] = await db.$queryRaw<Array<{ total: bigint }>>`
    SELECT count(*) AS "total"
    FROM wiki_articles a
    WHERE a."source" = 'ixwiki' AND a."status" = 'PUBLISHED' AND a."namespace" = 0
      AND NOT (left(a."wikitext", 64) ~* '^\\s*#redirect')`;
  return Number(row?.total ?? 0);
}

/** Page number `page` (1-based) of the sitemap: `SITEMAP_PAGE_SIZE` entries, in title order. */
export async function listSitemapPage(page: number): Promise<SitemapEntry[]> {
  return db.$queryRaw<SitemapEntry[]>`
    SELECT a."title" AS "title",
           COALESCE(
             (SELECT max(r."createdAt") FROM wiki_revisions r WHERE r."articleId" = a."id"),
             a."updatedAt"
           ) AS "lastModified"
    FROM wiki_articles a
    WHERE a."source" = 'ixwiki' AND a."status" = 'PUBLISHED' AND a."namespace" = 0
      AND NOT (left(a."wikitext", 64) ~* '^\\s*#redirect')
    ORDER BY a."title" ASC
    LIMIT ${SITEMAP_PAGE_SIZE} OFFSET ${(page - 1) * SITEMAP_PAGE_SIZE}`;
}
