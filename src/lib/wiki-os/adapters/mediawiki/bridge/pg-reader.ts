/**
 * pg-reader.ts — PostgreSQL Native & Live HTTP Bridge Reader
 *
 * All reads route through native PostgreSQL Prisma repositories (<1.5ms)
 * and the live MediaWiki Action API over HTTP (for real-time upstream sync).
 * Article/wikitext reads live here; the other concerns are re-exported from
 * pg-search, pg-activity, pg-taxonomy and pg-site.
 */

import { db } from "~/server/db";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { toArticleSlug, parseRevisionRef } from "~/lib/wiki-os/core/domain-types";
import { fetchIxwikiLive } from "./http-reader";
import { warnDev, type WikiArticle } from "./types";

export * from "./pg-search";
export * from "./pg-activity";
export * from "./pg-taxonomy";
export * from "./pg-site";

/** Wikitext of one page from the live MediaWiki API; null when it is missing or the call failed. */
async function fetchLiveWikitext(
  title: string
): Promise<{ title: string; wikitext: string; pageId: number } | null> {
  try {
    const data = await fetchIxwikiLive<{
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            revisions?: Array<{ slots?: { main?: { "*"?: string } }; "*"?: string }>;
          }
        >;
      };
    }>(
      {
        action: "query",
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        titles: title,
      },
      6000
    );
    const pages = data?.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    if (!pageId || pageId === "-1") return null;

    const page = pages[pageId];
    const rev = page?.revisions?.[0];
    return {
      title: page?.title || title,
      wikitext: rev?.slots?.main?.["*"] ?? rev?.["*"] ?? "",
      pageId: Number(pageId),
    };
  } catch (err) {
    warnDev(err);
    return null;
  }
}

export async function ixwikiGetWikitext(title: string): Promise<WikiArticle | null> {
  const native = await ArticleRepository.getArticleBySlug(title, "ixwiki");
  if (native && native.wikitext) {
    return {
      title: native.title,
      wikitext: native.wikitext,
      pageId: 0,
      length: native.wikitext.length,
    };
  }

  const live = await fetchLiveWikitext(title);
  return live && { ...live, length: live.wikitext.length };
}

interface RevisionContent {
  wikitext: string;
  /** Title of the article the revision belongs to. */
  title: string;
  timestamp: string;
}

/** Look up a revision by the reference history entries carry (see `toRevisionRef`). */
export async function ixwikiGetRevisionWikitext(ref: string): Promise<RevisionContent | null> {
  const key = parseRevisionRef(ref);
  try {
    const rev = await db.wikiRevision.findFirst({
      where: "mwRevId" in key ? { source: "ixwiki", mwRevId: key.mwRevId } : { id: key.id },
      select: { wikitext: true, createdAt: true, article: { select: { title: true } } },
    });
    if (rev) {
      return {
        wikitext: rev.wikitext,
        title: rev.article.title,
        timestamp: rev.createdAt.toISOString(),
      };
    }
  } catch (err) {
    warnDev(err);
  }
  return null;
}

export async function ixwikiGetNamespacedWikitext(
  title: string,
  namespace: number
): Promise<{ title: string; wikitext: string; pageId: number; namespace: number } | null> {
  try {
    const art: any = await (db as any).wikiArticle.findFirst({
      where: {
        source: "ixwiki",
        namespace,
        OR: [
          { title },
          { title: { contains: title, mode: "insensitive" } },
          { slug: toArticleSlug(title) },
        ],
      },
      select: { id: true, title: true, wikitext: true, namespace: true },
    });
    if (art && art.wikitext) {
      return {
        title: art.title,
        wikitext: art.wikitext,
        pageId: 0,
        namespace: art.namespace,
      };
    }
  } catch (err) {
    warnDev(err);
  }

  const fullTitle =
    namespace === 3 ? `User talk:${title}` : namespace === 2 ? `User:${title}` : title;
  const live = await fetchLiveWikitext(fullTitle);
  return live && { title: live.title, wikitext: live.wikitext, pageId: live.pageId, namespace };
}

export async function ixwikiResolveRedirect(title: string): Promise<string> {
  const art = await ixwikiGetWikitext(title);
  if (!art?.wikitext) return title;
  const match = art.wikitext.match(/#REDIRECT\s*\[\[([^\]]+)\]\]/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return title;
}
