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
import { parseRedirect } from "~/lib/wiki-os/core/redirect";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
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
  /**
   * The revision's text; null when it is unknown: an imported history row holds "" as a
   * placeholder, which a synced MediaWiki revision (it has an `mwRevId`) or a non-zero `byteSize`
   * gives away. Never treat null as an empty page.
   */
  wikitext: string | null;
  /** Title of the article the revision belongs to. */
  title: string;
  /** The wiki the revision belongs to (always "ixwiki" here). */
  source: string;
  timestamp: string;
}

/** Look up a revision by the reference history entries carry (see `toRevisionRef`). */
export async function ixwikiGetRevisionWikitext(ref: string): Promise<RevisionContent | null> {
  const key = parseRevisionRef(ref);
  try {
    const rev = await db.wikiRevision.findFirst({
      where: {
        source: "ixwiki",
        ...("mwRevId" in key ? { mwRevId: key.mwRevId } : { id: key.id }),
      },
      select: {
        wikitext: true,
        byteSize: true,
        textDeleted: true,
        mwRevId: true,
        source: true,
        createdAt: true,
        article: { select: { title: true } },
      },
    });
    if (rev) {
      // Deleted text (MediaWiki revision deletion) is hidden, not an empty page: unknown too.
      const isPlaceholder =
        rev.textDeleted || (rev.wikitext === "" && (rev.mwRevId !== null || rev.byteSize > 0));
      return {
        wikitext: isPlaceholder ? null : rev.wikitext,
        title: rev.article.title,
        source: rev.source,
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

export interface ResolvedRedirect {
  /** The page to show: the input itself when it is not a redirect, else the redirect's target. */
  title: string;
  /** The section the redirect points to; null when there is none or nothing was followed. */
  fragment: string | null;
}

/** MediaWiki follows one redirect; IxWiki has some double redirects, so two hops are safe. */
const MAX_REDIRECT_HOPS = 2;

const REDIRECT_SELECT = { wikitext: true } as const;

/** The IxWiki row for a canonical title: the exact title, else the one row whose slug matches. */
async function findRedirectRow(title: string) {
  const exact = await db.wikiArticle.findUnique({
    where: { source_title: { source: "ixwiki", title } },
    select: REDIRECT_SELECT,
  });
  if (exact) return exact;

  const variants = await db.wikiArticle.findMany({
    where: { source: "ixwiki", slug: toArticleSlug(title) },
    take: 2,
    select: REDIRECT_SELECT,
  });
  return variants.length === 1 ? (variants[0] ?? null) : null;
}

/**
 * Where the page `title` (canonical) redirects to. The wikitext decides: the `redirectTargetSlug`
 * columns are a cache that any write path that skips `saveArticle` leaves stale, so a column that
 * disagrees with the text (or that names a target for a page that is no longer a redirect) must
 * never be followed. Null when the page is missing or its text is not a redirect.
 */
async function redirectTargetOf(title: string): Promise<ResolvedRedirect | null> {
  const row = await findRedirectRow(title);
  const parsed = row ? parseRedirect(row.wikitext) : null;
  return parsed ? { title: parsed.title, fragment: parsed.fragment } : null;
}

/**
 * Follow IxWiki redirects from Postgres alone (at most two hops). A title that is not a redirect,
 * has no row, or cannot be a title is returned as given, and a database error ends the walk where
 * it is (the reader then serves whatever page it reached). On a loop (A to B to A) the walk stops
 * before revisiting a page, so it ends on B when started at A. The fragment is the most recent one
 * any followed hop carried: a last hop without a section keeps the section of an earlier hop.
 */
export async function ixwikiResolveRedirect(title: string): Promise<ResolvedRedirect> {
  const start = canonicalizeTitle(title);
  if (!start) return { title, fragment: null };

  const visited = new Set([start.title]);
  let current = start.title;
  let resolved: ResolvedRedirect = { title, fragment: null };
  try {
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
      const target = await redirectTargetOf(current);
      if (!target || visited.has(target.title)) break;

      visited.add(target.title);
      resolved = { title: target.title, fragment: target.fragment ?? resolved.fragment };
      current = target.title;
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }
  return resolved;
}
