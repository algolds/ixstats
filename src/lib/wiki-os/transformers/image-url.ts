// src/lib/wiki-os/image-url.ts
// Canonical Client-safe Wiki and Wikimedia Commons image URL resolution utilities.

import { withBasePath } from "~/lib/base-path";
import { DEFAULT_MEDIAWIKI_URL, type WikiSource } from "../config";

export type ExtendedWikiSource = WikiSource | "commons";

/**
 * Get file/image URL for an IxWiki file.
 */
export function getImageUrl(filename: string): string {
  const clean = filename.replace(/^File:/, "").replace(/ /g, "_");
  const base = DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "");
  return `${base}/wiki/Special:FilePath/${encodeURIComponent(clean)}`;
}

/**
 * Detects if a URL is a Wikimedia Commons or Wikipedia image URL.
 */
export function isWikimediaCommonsUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes("wikimedia.org") ||
    url.includes("wikipedia.org") ||
    url.includes("/wikipedia/commons/") ||
    url.includes("/api/mediawiki/commons/")
  );
}

/**
 * Converts any Wikimedia Commons / Wikipedia URL to our cached local proxy URL.
 */
export function getCommonsProxyUrl(url: string): string {
  if (!url) return url;

  if (url.includes("/api/mediawiki/commons/")) {
    return url;
  }

  try {
    const decodedUrl = decodeURIComponent(url);

    // Match /wikipedia/commons/... or /wikipedia/en/... and extract filename
    const commonsMatch = decodedUrl.match(
      /\/wikipedia\/(?:commons|en)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/i
    );
    if (commonsMatch && commonsMatch[1]) {
      const filename = commonsMatch[1].replace(/\.svg\.png$/i, ".svg");
      return withBasePath(
        `/api/mediawiki/commons/Special:Filepath/${encodeURIComponent(filename.replace(/ /g, "_"))}`
      );
    }

    // Fallback: extract last segment if valid image extension
    const urlObj = new URL(url.startsWith("//") ? `https:${url}` : url);
    const lastSegment = urlObj.pathname.split("/").pop();
    if (lastSegment && /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(lastSegment)) {
      const cleanSeg = lastSegment.replace(/\.svg\.png$/i, ".svg");
      return withBasePath(
        `/api/mediawiki/commons/Special:Filepath/${encodeURIComponent(cleanSeg.replace(/ /g, "_"))}`
      );
    }
  } catch (e) {
    console.error("[Image URL] Error parsing Wikimedia URL:", e);
  }

  return url;
}

/**
 * Resolve an image filename to its canonical proxied or direct URL based on wiki source.
 */
export function resolveImageUrl(
  filename: string | undefined,
  wikiSource: ExtendedWikiSource = "ixwiki"
): string | undefined {
  if (!filename) return undefined;

  const cleanName = filename
    .split("|")[0]!
    .replace(/^(File|Image|file|image):/i, "")
    .trim();
  if (!cleanName) return undefined;

  if (/^https?:\/\//i.test(cleanName) || cleanName.startsWith("//")) {
    if (isWikimediaCommonsUrl(cleanName)) {
      return getCommonsProxyUrl(cleanName);
    }
    return cleanName;
  }

  const normalized = cleanName.replace(/ /g, "_");

  if (wikiSource === "commons") {
    return withBasePath(
      `/api/mediawiki/commons/Special:Filepath/${encodeURIComponent(normalized)}`
    );
  }
  if (wikiSource === "ixwiki") {
    return withBasePath(
      `/api/mediawiki/ixwiki/wiki/Special:FilePath/${encodeURIComponent(normalized)}`
    );
  }
  if (wikiSource === "iiwiki") {
    return withBasePath(
      `/api/mediawiki/iiwiki/wiki/Special:FilePath/${encodeURIComponent(normalized)}`
    );
  }
  if (wikiSource === "althistory") {
    return withBasePath(
      `/api/mediawiki/althistory/wiki/Special:FilePath/${encodeURIComponent(normalized)}`
    );
  }

  return getImageUrl(cleanName);
}
