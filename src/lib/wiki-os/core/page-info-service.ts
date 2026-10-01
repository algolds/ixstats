/**
 * page-info-service.ts — the facts `?action=info` shows about a page: its id, size, creation,
 * last edit, how many pages redirect to it, its protection and its categories.
 */

import { db } from "~/server/db";
import { canonicalizeTitle } from "./title";

export interface PageInfo {
  title: string;
  namespace: number;
  /** MediaWiki's page id, when the page came from MediaWiki. */
  pageId: number | null;
  /** Size of the newest revision, in bytes. */
  length: number;
  wordCount: number;
  created: { at: Date; by: string | null } | null;
  lastEdited: { at: Date; by: string | null } | null;
  revisionCount: number;
  /** Pages whose text redirects here. */
  redirectCount: number;
  categoryCount: number;
  /** "ALL" when anyone may edit it. */
  protectionLevel: string;
  protectionExpiry: Date | null;
  /** The page this page redirects to, or null when it is not a redirect. */
  redirectsTo: string | null;
}

/** The facts about `rawTitle` (an IxWiki page), or null when it has no row or is not a title. */
export async function getPageInfo(rawTitle: string): Promise<PageInfo | null> {
  const canon = canonicalizeTitle(rawTitle);
  if (!canon) return null;

  const article = await db.wikiArticle.findUnique({
    where: { source_title: { source: "ixwiki", title: canon.title } },
    select: {
      id: true,
      title: true,
      namespace: true,
      mwPageId: true,
      wordCount: true,
      protectionLevel: true,
      protectionExpiry: true,
      redirectTargetSlug: true,
    },
  });
  if (!article) return null;

  const redirectTarget = article.redirectTargetSlug
    ? db.wikiArticle.findFirst({
        where: { source: "ixwiki", slug: article.redirectTargetSlug },
        select: { title: true },
      })
    : Promise.resolve(null);
  const revision = { select: { byteSize: true, createdAt: true, author: true } } as const;
  const [target, newest, oldest, revisionCount, redirectCount, categoryCount] = await Promise.all([
    redirectTarget,
    db.wikiRevision.findFirst({
      where: { articleId: article.id },
      orderBy: { createdAt: "desc" },
      ...revision,
    }),
    db.wikiRevision.findFirst({
      where: { articleId: article.id },
      orderBy: { createdAt: "asc" },
      ...revision,
    }),
    db.wikiRevision.count({ where: { articleId: article.id } }),
    db.wikiArticle.count({ where: { source: "ixwiki", redirectTargetSlug: canon.slug } }),
    db.wikiCategoryMember.count({ where: { articleId: article.id } }),
  ]);

  return {
    title: article.title,
    namespace: article.namespace,
    pageId: article.mwPageId,
    length: newest?.byteSize ?? 0,
    wordCount: article.wordCount,
    created: oldest && { at: oldest.createdAt, by: oldest.author },
    lastEdited: newest && { at: newest.createdAt, by: newest.author },
    revisionCount,
    redirectCount,
    categoryCount,
    protectionLevel: article.protectionLevel,
    protectionExpiry: article.protectionExpiry,
    redirectsTo: article.redirectTargetSlug
      ? (target?.title ?? article.redirectTargetSlug.replace(/_/g, " "))
      : null,
  };
}
