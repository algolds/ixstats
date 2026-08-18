// src/lib/wiki-os/parsoid-client.ts
// Parsoid REST API client for fetching rendered HTML from MediaWiki
// Uses localhost loopback for minimal latency (~10ms network + rendering time)

import { Cache } from "~/lib/cache";
import { safeDecodeURI } from "~/lib/wiki-os/safe-decode";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsoidArticle {
  /** Rendered HTML from Parsoid (or MediaWiki parse API fallback) */
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

// ---------------------------------------------------------------------------
// Cache (in-memory LRU, same pattern as wiki-bridge.ts)
// ---------------------------------------------------------------------------

const parsoidCache = new Cache<ParsoidArticle>({
  defaultTtlMs: 30 * 60 * 1000, // 30 minutes
  maxSize: 200,
});

function getCached(key: string): ParsoidArticle | null {
  return parsoidCache.get(key) ?? null;
}

function setCache(key: string, data: ParsoidArticle) {
  parsoidCache.set(key, data);
}

export function invalidateCache(title: string) {
  parsoidCache.delete(title);
}

// ---------------------------------------------------------------------------
// Parsoid REST API
// ---------------------------------------------------------------------------

// Use HTTPS domain for server-side calls (nginx routes to PHP-FPM)
const PARSOID_BASE = process.env.WIKIOS_PARSOID_URL ?? "https://ixwiki.com/rest.php/v1";
const MEDIAWIKI_API = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";

/**
 * Fetch rendered HTML for a wiki article.
 * Prefers Action API parse (~400ms) over Parsoid REST (~1.5s) for speed.
 * Parsoid is used for HTML->wikitext roundtrip in the editor pipeline.
 */
export async function getArticleHtml(title: string): Promise<ParsoidArticle> {
  const cached = getCached(title);
  if (cached) return cached;

  // Action API parse is faster (~400ms vs ~1.5s for Parsoid)
  // and handles all extensions including those Parsoid doesn't support
  return getArticleHtmlViaActionApi(title);
}

/**
 * Fetch rendered HTML via Parsoid REST API.
 * Used when we need Parsoid-specific HTML (e.g., for editor roundtrip with data-mw attributes).
 */
export async function getArticleHtmlViaParsoid(title: string): Promise<ParsoidArticle> {
  const cached = getCached(`parsoid:${title}`);
  if (cached) return cached;

  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));

  const response = await fetch(`${PARSOID_BASE}/page/${encodedTitle}/html`, {
    headers: {
      Accept: 'text/html; charset=utf-8; profile="https://www.mediawiki.org/wiki/Specs/HTML/2.8.0"',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Parsoid returned ${response.status} for "${title}"`);
  }

  const html = await response.text();
  const article = await buildParsoidArticle(title, html);
  setCache(`parsoid:${title}`, article);
  return article;
}

/**
 * Fallback: use MediaWiki api.php?action=parse for rendering.
 * Slower (~500ms) but handles all extensions including those Parsoid doesn't support.
 */
async function getArticleHtmlViaActionApi(title: string): Promise<ParsoidArticle> {
  const encodedTitle = encodeURIComponent(title);
  const url = `${MEDIAWIKI_API}?action=parse&page=${encodedTitle}&prop=text|categories|revid&formatversion=2&format=json`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`MediaWiki API returned ${response.status} for "${title}"`);
  }

  const data = (await response.json()) as {
    parse?: {
      title: string;
      text: string;
      categories?: Array<{ category: string; hidden?: boolean }>;
      revid?: number;
    };
    error?: { code: string; info: string };
  };

  if (data.error) {
    throw new Error(`MediaWiki API error: ${data.error.info}`);
  }

  if (!data.parse) {
    throw new Error(`No parse result for "${title}"`);
  }

  const categories = (data.parse.categories ?? [])
    .filter((c) => !c.hidden)
    .map((c) => c.category.replace(/_/g, " "));

  const article: ParsoidArticle = {
    html: data.parse.text,
    title: data.parse.title,
    categories,
    lastModified: null,
    isRedirect: false,
    redirectTarget: null,
  };

  setCache(title, article);
  return article;
}

/**
 * Build a ParsoidArticle from raw Parsoid HTML.
 * Extracts categories and redirect info from the HTML and wiki-bridge.
 */
async function buildParsoidArticle(title: string, html: string): Promise<ParsoidArticle> {
  // Extract categories from Parsoid HTML (they appear as <link rel="mw:PageProp/Category">)
  const categoryRegex = /rel="mw:PageProp\/Category"[^>]*href="[^"]*\/Category:([^"]+)"/g;
  const categories: string[] = [];
  let match;
  while ((match = categoryRegex.exec(html)) !== null) {
    categories.push(safeDecodeURI(match[1]!.replace(/_/g, " ")));
  }

  // Check for redirects
  const isRedirect = html.includes('rel="mw:PageProp/redirect"');
  let redirectTarget: string | null = null;
  if (isRedirect) {
    const redirectMatch = html.match(/href="[^"]*\/wiki\/([^"]+)"/);
    if (redirectMatch) {
      redirectTarget = safeDecodeURI(redirectMatch[1]!.replace(/_/g, " "));
    }
  }

  return {
    html,
    title,
    categories,
    lastModified: null,
    isRedirect,
    redirectTarget,
  };
}

/**
 * Convert HTML back to wikitext via Parsoid REST API.
 * Used in the save pipeline: PlateJS -> HTML -> wikitext.
 */
export async function htmlToWikitext(html: string, title: string): Promise<ParsoidTransformResult> {
  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));
  const response = await fetch(`${PARSOID_BASE}/transform/html/to/wikitext/${encodedTitle}`, {
    method: "POST",
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: html,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Parsoid transform failed: ${response.status}`);
  }

  const wikitext = await response.text();
  return { wikitext };
}

/**
 * Convert wikitext to HTML via Parsoid REST API.
 * Used for preview rendering during editing.
 */
export async function wikitextToHtml(wikitext: string, title: string): Promise<string> {
  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));
  const response = await fetch(`${PARSOID_BASE}/transform/wikitext/to/html/${encodedTitle}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wikitext }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Parsoid wikitext->HTML transform failed: ${response.status}`);
  }

  return response.text();
}
