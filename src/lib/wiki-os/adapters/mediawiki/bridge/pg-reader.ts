/**
 * pg-reader.ts — PostgreSQL reader for IxWiki
 *
 * Every read routes through native PostgreSQL Prisma repositories (<1.5ms); MediaWiki is never asked
 * (it is a private render engine, plan 418). Article/wikitext reads live here; the other concerns are
 * re-exported from pg-search, pg-activity, pg-taxonomy and pg-site.
 */

import { db } from "~/server/db";
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
  const native = await ArticleRepository.getArticleBySlug(title, "ixwiki", {
    includeArchived: true,
  });
  // A deleted page is gone, and so is a stub row with no text: MediaWiki's copy is not a substitute.
  if (!native || native.status === "ARCHIVED" || !native.wikitext) return null;
  return {
    title: native.title,
    wikitext: native.wikitext,
    pageId: 0,
    length: native.wikitext.length,
  };
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
  /** A MediaWiki edit that did not go live (conflict): it can be viewed, but never restored. */
  parked: boolean;
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
        parked: true,
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
        parked: rev.parked,
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
      select: { id: true, title: true, wikitext: true, namespace: true, status: true },
    });
    // A deleted page is gone: MediaWiki's copy of it is not a substitute.
    if (art?.status === "ARCHIVED") return null;
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

interface WikitextHead {
  head: string;
}

/**
 * The start of the wikitext of the published IxWiki row for a canonical title (the exact title, else
 * the one row whose slug matches), or null when there is no such row (a deleted page redirects nowhere). A redirect must start the page, so
 * only its first 1024 characters are read, in the database: the rest of a page (up to 2 MB) never
 * crosses the wire on a view. (A redirect that begins after ~700 characters of leading whitespace
 * is not followed; MediaWiki would follow it, no real page has that.)
 */
async function findRedirectHead(title: string): Promise<string | null> {
  const [exact] = await db.$queryRaw<WikitextHead[]>`
    SELECT left("wikitext", 1024) AS head
    FROM wiki_articles
    WHERE "source" = 'ixwiki' AND "status" = 'PUBLISHED' AND "title" = ${title}
    LIMIT 1`;
  if (exact) return exact.head;

  const variants = await db.$queryRaw<WikitextHead[]>`
    SELECT left("wikitext", 1024) AS head
    FROM wiki_articles
    WHERE "source" = 'ixwiki' AND "status" = 'PUBLISHED' AND "slug" = ${toArticleSlug(title)}
    LIMIT 2`;
  return variants.length === 1 ? (variants[0]?.head ?? null) : null;
}

/**
 * Where the page `title` (canonical) redirects to. The wikitext decides: the `redirectTargetSlug`
 * columns are a cache that any write path that skips `saveArticle` leaves stale, so a column that
 * disagrees with the text (or that names a target for a page that is no longer a redirect) must
 * never be followed. Null when the page is missing or its text is not a redirect.
 */
async function redirectTargetOf(title: string): Promise<ResolvedRedirect | null> {
  const parsed = parseRedirect(await findRedirectHead(title));
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
