/**
 * sitemap-service.ts — the pages the sitemap lists: published main-namespace IxWiki pages that are
 * not redirects, in title order, with the time of their newest revision (`lastmod`).
 */

import { db } from "~/server/db";

/** The sitemap protocol's cap on URLs in one file. */
export const SITEMAP_PAGE_SIZE = 50_000;

export interface SitemapEntry {
  title: string;
  /** The newest revision's time; the article's last update when it has no revision rows. */
  lastModified: Date;
}

interface SitemapRow {
  title: string;
  lastModified: Date;
}

const WHERE = {
  source: "ixwiki",
  status: "PUBLISHED",
  namespace: 0,
  redirectTargetSlug: null,
} as const;

/** How many pages the sitemap lists. */
export function countSitemapPages(): Promise<number> {
  return db.wikiArticle.count({ where: WHERE });
}

/** Page number `page` (1-based) of the sitemap: `SITEMAP_PAGE_SIZE` entries, in title order. */
export async function listSitemapPage(page: number): Promise<SitemapEntry[]> {
  const rows = await db.$queryRaw<SitemapRow[]>`
    SELECT a."title" AS "title",
           COALESCE(
             (SELECT max(r."createdAt") FROM wiki_revisions r WHERE r."articleId" = a."id"),
             a."updatedAt"
           ) AS "lastModified"
    FROM wiki_articles a
    WHERE a."source" = 'ixwiki' AND a."status" = 'PUBLISHED' AND a."namespace" = 0
      AND a."redirectTargetSlug" IS NULL
    ORDER BY a."title" ASC
    LIMIT ${SITEMAP_PAGE_SIZE} OFFSET ${(page - 1) * SITEMAP_PAGE_SIZE}`;
  return rows;
}
