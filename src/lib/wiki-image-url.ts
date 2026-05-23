/**
 * wiki-image-url.ts — Wiki image URL resolution utilities.
 *
 * Extracted from wiki-bridge.ts to avoid pulling mysql2 into client bundles.
 */

import { withBasePath } from "./base-path";
import type { WikiSource } from "./mediawiki-config";

/**
 * Get file/image URL for an IxWiki file.
 */
export function getImageUrl(filename: string): string {
  const clean = filename.replace(/^File:/, "").replace(/ /g, "_");
  return `https://ixwiki.com/wiki/Special:FilePath/${encodeURIComponent(clean)}`;
}

export function resolveImageUrl(
  filename: string | undefined,
  wikiSource: WikiSource = "ixwiki"
): string | undefined {
  if (!filename) return undefined;

  let cleanName = filename.split("|")[0]!.replace(/^(File|Image|file|image):/i, "").trim();
  if (!cleanName) return undefined;

  if (/^https?:\/\//i.test(cleanName) || cleanName.startsWith("//")) {
    return cleanName;
  }

  if (wikiSource === "ixwiki") {
    return withBasePath(`/api/ixwiki-proxy/wiki/Special:FilePath/${encodeURIComponent(cleanName.replace(/ /g, "_"))}`);
  }
  if (wikiSource === "iiwiki") {
    return withBasePath(`/api/iiwiki-proxy/wiki/Special:FilePath/${encodeURIComponent(cleanName.replace(/ /g, "_"))}`);
  }
  if (wikiSource === "althistory") {
    return withBasePath(`/api/althistory-wiki-proxy/wiki/Special:FilePath/${encodeURIComponent(cleanName.replace(/ /g, "_"))}`);
  }
  return getImageUrl(cleanName);
}
