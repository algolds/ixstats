// src/lib/wiki-os/image-url.ts
// Canonical Client-safe Wiki and Wikimedia Commons image URL resolution utilities.

import { withBasePath } from "~/lib/base-path";
import { DEFAULT_MEDIAWIKI_URL, type WikiSource } from "../config";

export type ExtendedWikiSource = WikiSource | "commons";

/**
 * Checks if a filename or image path corresponds to a maintenance/WIP template,
 * notice badge, icon, or system utility asset that should NOT be used as a lead article image.
 */
export function isNoticeOrUtilityIcon(filenameOrPath: string | null | undefined): boolean {
  if (!filenameOrPath || typeof filenameOrPath !== "string") return true;

  const clean = filenameOrPath
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^(?:File|Image|file|image):/i, "")
    .replace(/^.*?\/([^/?#]+)(?:[?#].*)?$/, "$1")
    .replace(/^(\d+px-)/i, "")
    .toLowerCase()
    .trim();

  const blockedTerms = [
    "ambox",
    "red_piston",
    "piston",
    "underconstruction",
    "under_construction",
    "under-construction",
    "construction",
    "road_works",
    "roadworks",
    "road-works",
    "work_in_progress",
    "wip",
    "stub",
    "cleanup",
    "padlock",
    "lock-",
    "edit-",
    "magnify-clip",
    "nuvola",
    "gnome",
    "crystal_clear",
    "crystal_",
    "commons-logo",
    "wikimedia",
    "wikipedia",
    "disambig",
    "question_book",
    "wiki_letter",
    "symbol_",
    "information_icon",
    "info_icon",
    "info-icon",
    "flag_of_none",
    "no_flag",
    "traffic_cone",
    "barrier",
    "caution",
    "maintenance",
    "inuse",
    "in_use",
    "in-use",
    "spanner",
    "wrench",
    "shovel",
    "worker",
    "merge",
    "split",
    "dialog-",
    "system-",
    "emblem-",
    "p_vip",
    "portal-",
    "star_icon",
    "green_check",
    "cross_icon",
    "trash",
    "delete",
    "clock_",
    "arrow",
    "external-link",
  ];

  for (const term of blockedTerms) {
    if (clean.startsWith(term) || clean.includes(`_${term}`) || clean.includes(`-${term}`) || clean === `${term}.svg` || clean === `${term}.png`) {
      return true;
    }
  }

  // Generic 12-24px icon names
  if (/(?:^|[_\-.])(icon|button|bullet|spacer|blank|pixel|trans|transparent)(?:[_\-.]|$)/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Get file/image URL for an IxWiki file via Special:FilePath (ensures on-the-fly thumb generation).
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
 * Normalizes any raw image URL from MediaWiki HTML or SQL to ensure it loads reliably on all clients.
 */
export function normalizeWikiImageUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  let url = rawUrl.trim();
  if (!url) return null;

  // Protocol-relative URL
  if (url.startsWith("//")) {
    url = "https:" + url;
  }

  // Handle Wikimedia Commons proxying
  if (isWikimediaCommonsUrl(url)) {
    return getCommonsProxyUrl(url);
  }

  // Proxy ixwiki images to avoid direct hotlinking/CORS failures
  if (url.startsWith("https://ixwiki.com/") || url.startsWith("http://ixwiki.com/")) {
    const subpath = url.replace(/^https?:\/\/ixwiki\.com\//i, "");
    return withBasePath(`/api/mediawiki/ixwiki/${subpath}`);
  }

  // Relative path on IxWiki
  if (url.startsWith("/")) {
    if (url.startsWith("/api/mediawiki/")) {
      return url;
    }
    const cleanPath = url.replace(/^\/+/, "");
    return withBasePath(`/api/mediawiki/ixwiki/${cleanPath}`);
  }

  return url;
}

/**
 * Extracts the genuine lead image URL from MediaWiki / Parsoid article HTML.
 * Strictly ignores maintenance notices, WIP badges, template icons, and grabs
 * images from the Infobox first, then the first real content thumbnail/figure.
 */
export function extractLeadImageFromHtml(html: string | null | undefined): string | null {
  if (!html || typeof html !== "string") return null;

  // 1. Strip out all known maintenance / notice / ambox blocks
  let cleanHtml = html
    .replace(/<table[^>]*class=["'][^"']*\b(?:ambox|tmbox|ombox|cmbox|fmbox|metadata|hatnote|dablink|stub|maint|wip)\b[^"']*["'][\s\S]*?<\/table>/gi, "")
    .replace(/<div[^>]*class=["'][^"']*\b(?:ambox|metadata|hatnote|dablink|stub|wip|notice)\b[^"']*["'][\s\S]*?<\/div>/gi, "")
    .replace(/<aside[^>]*class=["'][^"']*\b(?:notice|ambox)\b[^"']*["'][\s\S]*?<\/aside>/gi, "");

  // 2. First priority: Infobox image (<table class="infobox">, <aside class="portable-infobox">, .infobox-image)
  const infoboxMatch = cleanHtml.match(/<(?:table|aside)[^>]*class=["'][^"']*\b(?:infobox|portable-infobox)\b[^"']*["'][\s\S]*?<\/(?:table|aside)>/i);
  if (infoboxMatch) {
    const infoboxHtml = infoboxMatch[0];
    const infoboxImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = infoboxImgRegex.exec(infoboxHtml)) !== null) {
      const fullTag = imgMatch[0] || "";
      const src = imgMatch[1] || "";
      if (src && !isNoticeOrUtilityIcon(src)) {
        if (!/\b(?:width|height)=["'](?:1[0-9]|2[0-4]|[1-9])["']/i.test(fullTag)) {
          const normalized = normalizeWikiImageUrl(src);
          if (normalized) return normalized;
        }
      }
    }
  }

  // 3. Second priority: Figure or Thumbimage (<figure>, <div class="thumb">, <img class="thumbimage">)
  const figureRegex = /<(?:figure|div)[^>]*class=["'][^"']*\b(?:thumb|mw-halign|mw-default-size|thumbinner)\b[^"']*["'][\s\S]*?<\/(?:figure|div)>/gi;
  let figMatch: RegExpExecArray | null;
  while ((figMatch = figureRegex.exec(cleanHtml)) !== null) {
    const figHtml = figMatch[0];
    const figImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = figImgRegex.exec(figHtml)) !== null) {
      const fullTag = imgMatch[0] || "";
      const src = imgMatch[1] || "";
      if (src && !isNoticeOrUtilityIcon(src)) {
        if (!/\b(?:width|height)=["'](?:1[0-9]|2[0-4]|[1-9])["']/i.test(fullTag)) {
          const normalized = normalizeWikiImageUrl(src);
          if (normalized) return normalized;
        }
      }
    }
  }

  // 4. Third priority: Scan all remaining <img> tags in document order
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(cleanHtml)) !== null) {
    const fullTag = match[0] || "";
    const rawSrc = match[1] || "";
    if (!rawSrc) continue;

    if (isNoticeOrUtilityIcon(rawSrc)) continue;

    if (!/\b(?:width|height)=["'](?:1[0-9]|2[0-4]|[1-9])["']/i.test(fullTag)) {
      const normalized = normalizeWikiImageUrl(rawSrc);
      if (normalized) return normalized;
    }
  }

  return null;
}

/**
 * Extracts the genuine lead image from raw wikitext (checking infobox parameters first,
 * skipping notice templates, and grabbing the first body [[File:...]]).
 */
export function extractLeadImageFromWikitext(wikitext: string | null | undefined): string | null {
  if (!wikitext || typeof wikitext !== "string") return null;

  // 1. Check all standard Infobox fields (Priority 1)
  const infoboxFieldMatch = wikitext.match(
    /\|\s*(?:image|logo|company_logo|flag|image_flag|coat_of_arms|image_coat|seal|image_seal|map|image_map|photo|image_photo|portrait|image_portrait|album_cover|cover|poster|emblem|badge|insignia|picture|header_image|leader_image|flag_image|symbol)\s*=\s*([^|\n}]+)/i
  );
  if (infoboxFieldMatch && infoboxFieldMatch[1]) {
    const rawFile = infoboxFieldMatch[1]
      .replace(/\[\[(?:File|Image):/gi, "")
      .replace(/\]\]/g, "")
      .split(/[|\]}\n]/)[0]!
      .replace(/^(?:File|Image|file|image):/i, "")
      .trim();

    if (rawFile && !isNoticeOrUtilityIcon(rawFile)) {
      return getImageUrl(rawFile);
    }
  }

  // 2. Strip top-level notice / maintenance templates
  const cleanWikitext = wikitext.replace(
    /^\{\{(?:Underconstruction|under_construction|WIP|work_in_progress|Stub|Cleanup|Ambox|Notice|Disambig|About|Short description)\b[\s\S]*?\}\}/gim,
    ""
  );

  // 3. Match first content [[File:...]] or [[Image:...]]
  const fileRegex = /\[\[(?:File|Image):([^|\]\n]+)[^\]]*\]\]/gi;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(cleanWikitext)) !== null) {
    const rawFile = match[1]?.trim();
    if (rawFile && !isNoticeOrUtilityIcon(rawFile)) {
      return getImageUrl(rawFile);
    }
  }

  return null;
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
    return normalizeWikiImageUrl(cleanName) ?? cleanName;
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
