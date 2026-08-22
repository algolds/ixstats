/**
 * parsoid.ts — MediaWiki Parsoid & Action API HTML Converter Adapter
 *
 * Provides bidirectional HTML <-> wikitext transformation for editor workflows
 * and headless rendering fallback.
 */

import { Cache } from "~/lib/cache";
import { safeDecodeURI } from "~/lib/wiki-os/transformers/safe-decode";
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";

export interface ParsoidArticle {
  /** Rendered HTML from Parsoid or MediaWiki parse API fallback */
  html: string;
  /** Article title as stored in MediaWiki */
  title: string;
  /** Categories extracted from the page */
  categories: string[];
  /** Last modification timestamp */
  lastModified: string | null;
  /** Whether this is a redirect */
  isRedirect: boolean;
  /** Redirect target if applicable */
  redirectTarget: string | null;
}

export interface ParsoidTransformResult {
  wikitext: string;
}

const parsoidCache = new Cache<ParsoidArticle>({
  defaultTtlMs: 30 * 60 * 1000, // 30 minutes
  maxSize: 200,
});

export function invalidateCache(title: string) {
  parsoidCache.delete(title);
  parsoidCache.delete(`parsoid:${title}`);
}

const PARSOID_BASE = process.env.WIKIOS_PARSOID_URL ?? "https://ixwiki.com/rest.php/v1";
const MEDIAWIKI_API = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";

/**
 * Fetch rendered HTML via Action API parse (~400ms).
 */
export async function getArticleHtmlViaActionApi(title: string): Promise<ParsoidArticle> {
  const normalizedTitle = title.replace(/_/g, " ");

  const response = await fetch(MEDIAWIKI_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": DEFAULT_USER_AGENT,
    },
    body: new URLSearchParams({
      action: "parse",
      page: normalizedTitle,
      prop: "text|categories|sections|revid|displaytitle",
      disablelimitreport: "1",
      disableeditsection: "1",
      wrapoutputclass: "",
      formatversion: "2",
      format: "json",
      redirects: "1",
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`MediaWiki parse returned ${response.status} for "${title}"`);
  }

  const data = (await response.json()) as {
    parse?: {
      title: string;
      pageid: number;
      revid: number;
      text: string;
      categories: Array<{ category: string; hidden?: boolean }>;
      redirects?: Array<{ from: string; to: string }>;
    };
    error?: { code: string; info: string };
  };

  if (data.error || !data.parse) {
    throw new Error(data.error?.info ?? `Article "${title}" not found`);
  }

  const parse = data.parse;
  const categories = (parse.categories ?? []).map((c) => c.category);
  const isRedirect = (parse.redirects?.length ?? 0) > 0;
  const redirectTarget = isRedirect ? (parse.redirects?.[0]?.to ?? null) : null;

  return {
    html: parse.text ?? "",
    title: parse.title ?? title,
    categories,
    lastModified: null,
    isRedirect,
    redirectTarget,
  };
}

/**
 * Fetch rendered HTML for an article.
 */
export async function getArticleHtml(title: string): Promise<ParsoidArticle> {
  const cached = parsoidCache.get(title);
  if (cached) return cached;

  try {
    const article = await getArticleHtmlViaActionApi(title);
    parsoidCache.set(title, article);
    return article;
  } catch (parseError) {
    console.warn(
      `[Parsoid] Action API parse failed for "${title}", falling back to native wikitext parser:`,
      parseError instanceof Error ? parseError.message : parseError
    );

    // Fallback: Fetch wikitext and convert natively
    try {
      const { getArticleWikitext } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");
      const wikiArticle = await getArticleWikitext(title, "ixwiki");
      if (wikiArticle?.wikitext) {
        const { parseWikitextToHtml } = await import("~/lib/wiki-os/transformers/wikitext-parser");
        const html = parseWikitextToHtml(wikiArticle.wikitext, "ixwiki");
        const fallbackArticle: ParsoidArticle = {
          html,
          title: wikiArticle.title || title,
          categories: [],
          lastModified: null,
          isRedirect: false,
          redirectTarget: null,
        };
        parsoidCache.set(title, fallbackArticle);
        return fallbackArticle;
      }
    } catch (fallbackErr) {
      console.error("[Parsoid] Native wikitext fallback error:", fallbackErr);
    }

    throw parseError;
  }
}

/**
 * Fetch rendered HTML via Parsoid REST API.
 */
export async function getArticleHtmlViaParsoid(title: string): Promise<ParsoidArticle> {
  const cached = parsoidCache.get(`parsoid:${title}`);
  if (cached) return cached;

  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));

  const response = await fetch(`${PARSOID_BASE}/page/${encodedTitle}/html`, {
    headers: {
      Accept: 'text/html; charset=utf-8; profile="https://www.mediawiki.org/wiki/Specs/HTML/2.8.0"',
      "User-Agent": DEFAULT_USER_AGENT,
      "Api-User-Agent": DEFAULT_USER_AGENT,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Parsoid returned ${response.status} for "${title}"`);
  }

  const html = await response.text();
  const article: ParsoidArticle = {
    html,
    title,
    categories: [],
    lastModified: null,
    isRedirect: false,
    redirectTarget: null,
  };

  parsoidCache.set(`parsoid:${title}`, article);
  return article;
}

/**
 * Convert HTML back to wikitext via Parsoid REST API with local fallback.
 */
export async function htmlToWikitext(html: string, title: string): Promise<ParsoidTransformResult> {
  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));

  try {
    const response = await fetch(`${PARSOID_BASE}/transform/html/to/wikitext/${encodedTitle}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
      },
      body: JSON.stringify({ html }),
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const wikitext = await response.text();
      return { wikitext };
    }
  } catch (err) {
    console.warn(`[Parsoid] Remote htmlToWikitext transform failed, falling back:`, err);
  }

  // Resilient fallback for offline/unreachable Parsoid:
  const fallbackWikitext = html
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "= $1 =\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "== $1 ==\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "=== $1 ===\n")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "'''$1'''")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "'''$1'''")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "''$1''")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "''$1''")
    .replace(/<a[^>]*href=["'][^"']*\/wiki\/([^"']+)["'][^>]*>(.*?)<\/a>/gi, "[[$1|$2]]")
    .replace(/<[^>]+>/g, "")
    .trim();

  return { wikitext: fallbackWikitext || html };
}

/**
 * Convert wikitext to HTML via Parsoid REST API.
 */
export async function wikitextToHtml(wikitext: string, title: string): Promise<string> {
  const response = await fetch(`${PARSOID_BASE}/transform/wikitext/to/html`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": DEFAULT_USER_AGENT,
    },
    body: JSON.stringify({ wikitext, title }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Parsoid wikitext->html failed (${response.status})`);
  }

  return response.text();
}
