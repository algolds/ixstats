// src/lib/wiki-os/url-compat.ts
// URL compatibility layer for WikiOS <-> MediaWiki
// Handles conversion between /wiki/ (MediaWiki) and /wiki/ (WikiOS) URL schemes

import { withBasePath } from "~/lib/base-path";

/**
 * Convert a MediaWiki-style title to a WikiOS URL path.
 * e.g., "Burgundie" -> "/wiki/Burgundie"
 *       "Category:Countries" -> "/wiki/Category:Countries"
 */
export function titleToWikiOSPath(title: string): string {
  const slug = title.replace(/ /g, "_");
  return withBasePath(`/wiki/${encodeURIComponent(slug)}`);
}

/**
 * Convert a MediaWiki-style title to a WikiOS route string.
 * This is used for Next.js <Link> which auto-prepends the basePath.
 */
export function titleToWikiOSRoute(title: string): string {
  const slug = title.replace(/ /g, "_");
  return `/wiki/${encodeURIComponent(slug)}`;
}

/**
 * Transform wiki links in Parsoid HTML to include base path prefix.
 * This is applied to rendered HTML before displaying in WikiOS.
 */
export function transformWikiLinks(html: string): string {
  return html.replace(/href="\/wiki\/([^"]*?)"/g, (_match, path: string) => {
    const wikiosPath = withBasePath(`/wiki/${path}`);
    return `href="${wikiosPath}"`;
  });
}
