/**
 * pg-reader.ts — PostgreSQL Native & Live HTTP Bridge Reader
 *
 * All reads route through native PostgreSQL Prisma repositories (<1.5ms)
 * and the live MediaWiki Action API over HTTP (for real-time upstream sync).
 * Article/wikitext reads live here; the other concerns are re-exported from
 * pg-search, pg-activity, pg-taxonomy and pg-site.
 */

import { db } from "~/server/db";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { toArticleSlug, parseRevisionRef } from "~/lib/wiki-os/core/domain-types";
import type { WikiArticle } from "./types";

export * from "./pg-search";
export * from "./pg-activity";
export * from "./pg-taxonomy";
export * from "./pg-site";

// ---------------------------------------------------------------------------
// Article & Wikitext
// ---------------------------------------------------------------------------

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

  // Live HTTP Fallback
  try {
    const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
    const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: title,
      format: "json",
    });

    const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const pages = data?.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      if (pageId && pageId !== "-1") {
        const p = pages[pageId];
        const rev = p?.revisions?.[0];
        const wikitext = rev?.slots?.main?.["*"] ?? rev?.["*"] ?? "";
        return {
          title: p.title || title,
          wikitext,
          pageId: Number(pageId),
          length: wikitext.length,
        };
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  return null;
}

export interface RevisionContent {
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
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }
  return null;
}

export async function ixwikiGetCurrentRevMeta(
  title: string
): Promise<{ revid: number; timestamp: string } | null> {
  try {
    const art: any = await (db as any).wikiArticle.findFirst({
      where: { source: "ixwiki", title },
      select: { mwLatestRevId: true, syncedAt: true, updatedAt: true },
    });
    if (art) {
      return {
        revid: Number(art.mwLatestRevId || 0),
        timestamp: (art.syncedAt || art.updatedAt || new Date()).toISOString(),
      };
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
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
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  // Live HTTP Fallback
  try {
    const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
    const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
    const fullTitle =
      namespace === 3 ? `User talk:${title}` : namespace === 2 ? `User:${title}` : title;
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: fullTitle,
      format: "json",
    });

    const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const pages = data?.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      if (pageId && pageId !== "-1") {
        const p = pages[pageId];
        const rev = p?.revisions?.[0];
        const wikitext = rev?.slots?.main?.["*"] ?? rev?.["*"] ?? "";
        return {
          title: p.title || fullTitle,
          wikitext,
          pageId: Number(pageId),
          namespace,
        };
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  return null;
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
