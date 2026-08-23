// src/lib/wiki-os/bridge/dispatchers.ts
// Public dispatchers routing requests across MySQL (IxWiki) and HTTP (IIWiki/AltHistory).

import { parseInfobox, parseCoordTemplate } from "~/lib/wiki-os/transformers/infobox-parser";
import {
  type WikiSource,
  type WikiSearchResult,
  type WikiArticle,
  type WikiIntro,
  type WikiSection,
  type WikiRecentChange,
  cacheGet,
  cacheSet,
} from "./types";
import {
  ixwikiGetWikitext,
  ixwikiSearch,
  ixwikiRecentChanges,
  ixwikiGetHistory,
  ixwikiGetUserContribs,
  ixwikiGetUserInfo,
  ixwikiGetBacklinks,
  ixwikiGetCategoryMembers,
  ixwikiGetSiteStats,
  ixwikiGetRandomPage,
  ixwikiResolveRedirect,
  ixwikiGetRevisionWikitext,
  ixwikiGetCurrentRevMeta,
  ixwikiGetNamespacedWikitext,
  ixwikiSearchTemplates,
  ixwikiFullTextSearch,
  ixwikiGetParentCategories,
  ixwikiGetCategoryInfo,
  ixwikiGetPageProps,
  ixwikiGetPageProtection,
  ixwikiGetImageMeta,
  ixwikiGetPageLog,
} from "./mysql-reader";
import {
  iiwikiGetWikitext,
  iiwikiSearch,
  althistoryGetWikitext,
  althistorySearch,
  fetchPageImagesHttp as httpGetPageImages,
} from "./http-reader";

// Re-exported from image-url (shared with client-safe code)
export { getImageUrl } from "~/lib/wiki-os/transformers/image-url";

const wikitextPromises = new Map<string, Promise<WikiArticle | null>>();

/**
 * Get raw article wikitext. Uses MySQL for ixwiki, HTTP for iiwiki/althistory.
 */
export async function getArticleWikitext(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<WikiArticle | null> {
  const key = `${wiki}:${title}`;
  let promise = wikitextPromises.get(key);
  if (!promise) {
    promise = (async () => {
      try {
        if (wiki === "ixwiki") return await ixwikiGetWikitext(title);
        if (wiki === "althistory") return await althistoryGetWikitext(title);
        return await iiwikiGetWikitext(title);
      } finally {
        wikitextPromises.delete(key);
      }
    })();
    wikitextPromises.set(key, promise);
  }
  return promise;
}

/**
 * Get article intro (first paragraph, stripped of markup).
 * Parses wikitext directly — no PHP processing needed.
 */
export async function getArticleIntro(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<WikiIntro | null> {
  const cacheKey = `intro:${wiki}:${title}`;
  const cached = cacheGet<WikiIntro>(cacheKey);
  if (cached) return cached;

  const article = await getArticleWikitext(title, wiki);
  if (!article) return null;

  const intro = extractIntroFromWikitext(article.wikitext);
  const result: WikiIntro = { title: article.title, text: intro };
  cacheSet(cacheKey, result);
  return result;
}

/**
 * Search wiki pages by title prefix.
 */
export async function searchPages(
  query: string,
  limit: number = 10,
  wiki: WikiSource = "ixwiki"
): Promise<WikiSearchResult[]> {
  if (wiki === "ixwiki") return ixwikiSearch(query, limit);
  if (wiki === "althistory") return althistorySearch(query, limit);
  return iiwikiSearch(query, limit);
}

/**
 * Parse infobox from article wikitext.
 */
export async function getInfobox(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<ReturnType<typeof parseInfobox> | null> {
  const article = await getArticleWikitext(title, wiki);
  if (!article) return null;
  return parseInfobox(article.wikitext);
}

/**
 * Get article sections/TOC by parsing wikitext headings.
 */
export async function getPageSections(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<WikiSection[]> {
  const article = await getArticleWikitext(title, wiki);
  if (!article) return [];

  const sections: WikiSection[] = [];
  const headingRegex = /^(={2,6})\s*(.+?)\s*\1$/gm;
  let match;
  let index = 0;

  while ((match = headingRegex.exec(article.wikitext)) !== null) {
    sections.push({
      level: match[1]!.length,
      title: match[2]!.trim(),
      index: index++,
    });
  }

  return sections;
}

/**
 * Get recent changes from IxWiki.
 */
export async function getRecentChanges(limit: number = 20): Promise<WikiRecentChange[]> {
  return ixwikiRecentChanges(limit);
}

/**
 * Get page revision history via direct MySQL.
 */
export async function getPageHistory(title: string, limit?: number, offset?: number) {
  return ixwikiGetHistory(title, limit, offset);
}

/**
 * Get user contributions via direct MySQL.
 */
export async function getUserContribs(username: string, limit?: number, offset?: number) {
  return ixwikiGetUserContribs(username, limit, offset);
}

/**
 * Get user info via direct MySQL.
 */
export async function getUserInfo(username: string) {
  return ixwikiGetUserInfo(username);
}

/**
 * Get backlinks (pages linking to a page) via direct MySQL.
 */
export async function getBacklinks(title: string, limit?: number, offset?: number) {
  return ixwikiGetBacklinks(title, limit, offset);
}

/**
 * Get category members via direct MySQL.
 */
export async function getCategoryMembers(
  category: string,
  limit?: number,
  type?: "page" | "subcat" | "file"
) {
  return ixwikiGetCategoryMembers(category, limit, type);
}

/**
 * Get site statistics via direct MySQL.
 */
export async function getSiteStats() {
  return ixwikiGetSiteStats();
}

/**
 * Get a random article title via direct MySQL.
 */
export async function getRandomPage() {
  return ixwikiGetRandomPage();
}

/**
 * Resolve redirects via direct MySQL (up to 5 hops).
 */
export async function resolveRedirect(title: string) {
  return ixwikiResolveRedirect(title);
}

/**
 * Get wikitext of a specific revision by ID via direct MySQL.
 */
export async function getRevisionWikitext(revid: number) {
  return ixwikiGetRevisionWikitext(revid);
}

/**
 * Get current revision metadata (revid + timestamp) via direct MySQL.
 */
export async function getCurrentRevMeta(title: string) {
  return ixwikiGetCurrentRevMeta(title);
}

/**
 * Get wikitext from any namespace via direct MySQL.
 */
export async function getNamespacedWikitext(title: string, namespace: number) {
  return ixwikiGetNamespacedWikitext(title, namespace);
}

/**
 * Search templates by prefix via direct MySQL.
 */
export async function searchTemplates(query: string, limit?: number) {
  return ixwikiSearchTemplates(query, limit);
}

/**
 * Full-text search via MySQL searchindex table.
 */
export async function fullTextSearch(
  query: string,
  limit?: number,
  offset?: number,
  namespace?: number
) {
  return ixwikiFullTextSearch(query, limit, offset, namespace);
}

/**
 * Get parent categories via direct MySQL.
 */
export async function getParentCategories(title: string) {
  return ixwikiGetParentCategories(title);
}

/**
 * Get category info with subcategories via direct MySQL.
 */
export async function getCategoryInfo(category: string) {
  return ixwikiGetCategoryInfo(category);
}

/**
 * Get page properties via direct MySQL.
 */
export async function getPageProps(pageId: number) {
  return ixwikiGetPageProps(pageId);
}

/**
 * Get page protection status via direct MySQL.
 */
export async function getPageProtection(title: string) {
  return ixwikiGetPageProtection(title);
}

/**
 * Get image metadata via direct MySQL.
 */
export async function getImageMeta(filename: string) {
  return ixwikiGetImageMeta(filename);
}

/**
 * Get page action log via direct MySQL.
 */
export async function getPageLog(title: string, limit?: number) {
  return ixwikiGetPageLog(title, limit);
}

/**
 * Extract coordinates from article wikitext.
 */
export async function getCoordinates(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<[number, number] | null> {
  const article = await getArticleWikitext(title, wiki);
  if (!article) return null;
  return parseCoordTemplate(article.wikitext);
}

/**
 * Get images referenced on a wiki page with thumbnail URLs.
 */
export async function getPageImages(
  title: string,
  opts?: {
    excludePatterns?: RegExp[];
    thumbWidth?: number;
    limit?: number;
  }
) {
  return httpGetPageImages(title, opts);
}

/**
 * Search with fallback: try ixwiki first, then iiwiki.
 */
export async function searchWithFallback(
  query: string,
  limit: number = 10
): Promise<WikiSearchResult[]> {
  const results = await searchPages(query, limit, "ixwiki");
  if (results.length > 0) return results;
  return searchPages(query, limit, "iiwiki");
}

// ──────────────────────────────────────────────
// Wikitext Processing Helpers
// ──────────────────────────────────────────────

import { cleanWikiMarkup } from "~/lib/wiki-os/transformers/wikitext-parser";
export { cleanWikiMarkup };

/**
 * Extract the intro paragraph from raw wikitext.
 * Takes text before the first == heading, strips templates/markup.
 */
export function extractIntroFromWikitext(wikitext: string): string {
  const headingIndex = wikitext.search(/^==[^=]/m);
  const intro =
    headingIndex > 0 ? wikitext.substring(0, headingIndex) : wikitext.substring(0, 2000);

  return cleanWikiMarkup(intro);
}
