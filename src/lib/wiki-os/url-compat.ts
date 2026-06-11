// src/lib/wiki-os/url-compat.ts
// URL compatibility layer for WikiOS <-> MediaWiki
// Handles conversion between /wiki/ (MediaWiki) and /wiki/ (WikiOS) URL schemes

import { withBasePath } from "~/lib/base-path";
import { safeDecodeURI } from "~/lib/wiki-os/safe-decode";

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
 * Convert a WikiOS URL path to a MediaWiki title.
 * e.g., "/wiki/Burgundie" -> "Burgundie"
 */
export function wikiOSPathToTitle(path: string): string {
  const slug = path.replace(/^\/wiki\//, "");
  return safeDecodeURI(slug).replace(/_/g, " ");
}

/**
 * Convert a MediaWiki /wiki/ URL to a WikiOS /wiki/ URL (noop now).
 */
export function mediawikiUrlToWikiOS(url: string): string {
  return url;
}

/**
 * Convert a WikiOS /wiki/ URL to a MediaWiki /wiki/ URL (noop now).
 */
export function wikiOSUrlToMediawiki(url: string): string {
  return url;
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

/**
 * Extract the namespace and title from a full title string.
 * e.g., "Talk:Burgundie" -> { namespace: "Talk", title: "Burgundie" }
 *       "Burgundie" -> { namespace: "", title: "Burgundie" }
 */
export function parseTitle(fullTitle: string): { namespace: string; title: string } {
  const colonIndex = fullTitle.indexOf(":");
  if (colonIndex === -1) {
    return { namespace: "", title: fullTitle };
  }

  const potentialNamespace = fullTitle.slice(0, colonIndex);
  const knownNamespaces = [
    "Talk",
    "User",
    "User_talk",
    "Project",
    "Project_talk",
    "File",
    "File_talk",
    "MediaWiki",
    "MediaWiki_talk",
    "Template",
    "Template_talk",
    "Help",
    "Help_talk",
    "Category",
    "Category_talk",
    "Special",
    "Module",
    "Module_talk",
  ];

  if (knownNamespaces.includes(potentialNamespace)) {
    return {
      namespace: potentialNamespace,
      title: fullTitle.slice(colonIndex + 1),
    };
  }

  return { namespace: "", title: fullTitle };
}

/**
 * Build a full MediaWiki API URL for a given title.
 */
export function mediawikiApiUrl(title: string, params: Record<string, string> = {}): string {
  const base = process.env.WIKIOS_MEDIAWIKI_API ?? "http://localhost/api.php";
  const searchParams = new URLSearchParams({
    format: "json",
    formatversion: "2",
    ...params,
  });
  return `${base}?${searchParams.toString()}`;
}
