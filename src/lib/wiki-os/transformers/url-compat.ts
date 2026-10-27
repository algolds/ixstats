// src/lib/wiki-os/transformers/url-compat.ts
// URL compatibility layer for WikiOS <-> MediaWiki. Rendered HTML's links get the base path at display, from
// `withAppHrefs` (`~/lib/wiki-os/reader-hrefs`).

/**
 * Convert a MediaWiki-style title to a WikiOS route string.
 * This is used for Next.js <Link> which auto-prepends the basePath.
 */
export function titleToWikiOSRoute(title: string): string {
  const slug = title.replace(/ /g, "_");
  return `/wiki/${encodeURIComponent(slug)}`;
}
