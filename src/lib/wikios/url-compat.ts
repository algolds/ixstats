// src/lib/wikios/url-compat.ts
// URL compatibility layer for WikiOS <-> MediaWiki
// Handles conversion between /wiki/ (MediaWiki) and /w/ (WikiOS) URL schemes

import { withBasePath } from "~/lib/base-path";

/**
 * Convert a MediaWiki-style title to a WikiOS URL path.
 * e.g., "Burgundie" -> "/w/Burgundie"
 *       "Category:Countries" -> "/w/Category:Countries"
 */
export function titleToWikiOSPath(title: string): string {
  const slug = title.replace(/ /g, "_");
  return withBasePath(`/w/${encodeURIComponent(slug)}`);
}

/**
 * Convert a WikiOS URL path to a MediaWiki title.
 * e.g., "/w/Burgundie" -> "Burgundie"
 */
export function wikiOSPathToTitle(path: string): string {
  const slug = path.replace(/^\/w\//, "").replace(/^\/wiki\//, "");
  return decodeURIComponent(slug).replace(/_/g, " ");
}

/**
 * Convert a MediaWiki /wiki/ URL to a WikiOS /w/ URL.
 * Preserves query params and fragments.
 */
export function mediawikiUrlToWikiOS(url: string): string {
  return url.replace(/\/wiki\//, "/w/");
}

/**
 * Convert a WikiOS /w/ URL to a MediaWiki /wiki/ URL.
 */
export function wikiOSUrlToMediawiki(url: string): string {
  return url.replace(/\/w\//, "/wiki/");
}

/**
 * Transform wiki links in Parsoid HTML from /wiki/ to /w/ paths.
 * This is applied to rendered HTML before displaying in WikiOS.
 */
export function transformWikiLinks(html: string): string {
  // Transform href="/wiki/..." to href="/w/..."
  // Preserve external links and special URLs
  return html.replace(
    /href="\/wiki\/([^"]*?)"/g,
    (_match, path: string) => {
      const wikiosPath = withBasePath(`/w/${path}`);
      return `href="${wikiosPath}"`;
    }
  );
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
    "Talk", "User", "User_talk", "Project", "Project_talk",
    "File", "File_talk", "MediaWiki", "MediaWiki_talk",
    "Template", "Template_talk", "Help", "Help_talk",
    "Category", "Category_talk", "Special", "Module", "Module_talk",
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
