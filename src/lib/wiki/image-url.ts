/**
 * wiki-image-url.ts — Wiki image URL resolution utilities.
 *
 * Extracted from wiki-bridge.ts to avoid pulling mysql2 into client bundles.
 */

import { withBasePath } from "~/lib/base-path";
import type { WikiSource } from "./config";

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

  // eslint-disable-next-line prefer-const
  let cleanName = filename
    .split("|")[0]!
    .replace(/^(File|Image|file|image):/i, "")
    .trim();
  if (!cleanName) return undefined;

  if (/^https?:\/\//i.test(cleanName) || cleanName.startsWith("//")) {
    return cleanName;
  }

  if (wikiSource === "ixwiki") {
    return withBasePath(
      `/api/mediawiki/ixwiki/wiki/Special:FilePath/${encodeURIComponent(cleanName.replace(/ /g, "_"))}`
    );
  }
  if (wikiSource === "iiwiki") {
    return withBasePath(
      `/api/mediawiki/iiwiki/wiki/Special:FilePath/${encodeURIComponent(cleanName.replace(/ /g, "_"))}`
    );
  }
  if (wikiSource === "althistory") {
    return withBasePath(
      `/api/mediawiki/althistory/wiki/Special:FilePath/${encodeURIComponent(cleanName.replace(/ /g, "_"))}`
    );
  }
  return getImageUrl(cleanName);
}
