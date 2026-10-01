// src/lib/wiki-os/image-url.ts
// Canonical Client-safe Wiki and Wikimedia Commons image URL resolution utilities.

import { createHash } from "crypto";
import { withBasePath } from "~/lib/base-path";
import { DEFAULT_MEDIAWIKI_URL, type WikiSource } from "../config";

export type ExtendedWikiSource = WikiSource | "commons";

/**
 * Checks if a filename or image path corresponds to a maintenance/WIP template,
 * notice badge, icon, or system utility asset that should NOT be used as a lead article image.
 */
export function isNoticeOrUtilityIcon(filenameOrPath: string | null | undefined): boolean {
  if (!filenameOrPath || typeof filenameOrPath !== "string") return true;

  if (
    filenameOrPath.includes("<!--") ||
    filenameOrPath.includes("-->") ||
    filenameOrPath.startsWith("<") ||
    filenameOrPath.includes("[[")
  ) {
    return true;
  }

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
    if (
      clean.startsWith(term) ||
      clean.includes(`_${term}`) ||
      clean.includes(`-${term}`) ||
      clean === `${term}.svg` ||
      clean === `${term}.png`
    ) {
      return true;
    }
  }

  // Generic 12-24px icon names
  if (
    /(?:^|[_\-.])(icon|button|bullet|spacer|blank|pixel|trans|transparent)(?:[_\-.]|$)/i.test(clean)
  ) {
    return true;
  }

  return false;
}

/**
 * Fast synchronous MD5 implementation for standard MediaWiki shard computation.
 */
function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

/**
 * Calculate standard MediaWiki MD5 shard path
 * e.g. "Caphiria_flag.svg" -> shard "8/8c", path "8/8c/Caphiria_flag.svg"
 */
export function getMd5ShardPath(filename: string): {
  shard: string;
  fullPath: string;
  cleanName: string;
} {
  let decoded = filename;
  try {
    decoded = decodeURIComponent(filename);
  } catch {
    // malformed percent-encoding — use the raw filename
  }

  let cleanName = decoded
    .replace(/^(?:File|Image):/i, "")
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .trim();

  // MediaWiki canonicalization: first letter is uppercase
  if (cleanName.length > 0) {
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  }

  const hash = md5(cleanName);
  const shard = `${hash[0]}/${hash.slice(0, 2)}`;
  return {
    shard,
    fullPath: `${shard}/${encodeURI(cleanName)}`,
    cleanName,
  };
}

/**
 * Get direct file/image URL for an IxWiki file via MD5 shard static storage with proxy fallback.
 */
export function getImageUrl(filename: string): string {
  const { fullPath } = getMd5ShardPath(filename);
  const base = DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "");
  const directUrl = `${base}/images/${fullPath}`;
  return normalizeWikiImageUrl(directUrl) || directUrl;
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
 * The genuine lead image of MediaWiki / Parsoid article HTML: its `<img>` tag and normalized URL.
 * Strictly ignores maintenance notices, WIP badges, template icons, and grabs
 * images from the Infobox first, then the first real content thumbnail/figure.
 */
function findLeadImage(html: string | null | undefined): { tag: string; url: string } | null {
  if (!html || typeof html !== "string") return null;

  // 1. Strip out all known maintenance / notice / ambox blocks
  const cleanHtml = html
    .replace(
      /<table[^>]*class=["'][^"']*\b(?:ambox|tmbox|ombox|cmbox|fmbox|metadata|hatnote|dablink|stub|maint|wip)\b[^"']*["'][\s\S]*?<\/table>/gi,
      ""
    )
    .replace(
      /<div[^>]*class=["'][^"']*\b(?:ambox|metadata|hatnote|dablink|stub|wip|notice)\b[^"']*["'][\s\S]*?<\/div>/gi,
      ""
    )
    .replace(/<aside[^>]*class=["'][^"']*\b(?:notice|ambox)\b[^"']*["'][\s\S]*?<\/aside>/gi, "");

  // 2. First priority: Infobox image (<table class="infobox">, <aside class="portable-infobox">, .infobox-image)
  const infoboxMatch = cleanHtml.match(
    /<(?:table|aside)[^>]*class=["'][^"']*\b(?:infobox|portable-infobox)\b[^"']*["'][\s\S]*?<\/(?:table|aside)>/i
  );
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
          if (normalized) return { tag: fullTag, url: normalized };
        }
      }
    }
  }

  // 3. Second priority: Figure or Thumbimage (<figure>, <div class="thumb">, <img class="thumbimage">)
  const figureRegex =
    /<(?:figure|div)[^>]*class=["'][^"']*\b(?:thumb|mw-halign|mw-default-size|thumbinner)\b[^"']*["'][\s\S]*?<\/(?:figure|div)>/gi;
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
          if (normalized) return { tag: fullTag, url: normalized };
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
      if (normalized) return { tag: fullTag, url: normalized };
    }
  }

  return null;
}

/** The URL of the genuine lead image of article HTML (see `findLeadImage`), or null. */
export function extractLeadImageFromHtml(html: string | null | undefined): string | null {
  return findLeadImage(html)?.url ?? null;
}

/** A lead image with the size of the file it shows (MediaWiki's `data-file-width`/`-height`), when the HTML says. */
export interface LeadImage {
  url: string;
  fileWidth: number | null;
  fileHeight: number | null;
}

const numberAttribute = (tag: string, name: string): number | null => {
  const value = Number(new RegExp(`\\b${name}=["'](\\d+)["']`, "i").exec(tag)?.[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/** The lead image of article HTML with its file's dimensions: what the page reserves its hero box from. */
export function extractLeadImage(html: string | null | undefined): LeadImage | null {
  const found = findLeadImage(html);
  if (!found) return null;
  return {
    url: found.url,
    fileWidth: numberAttribute(found.tag, "data-file-width"),
    fileHeight: numberAttribute(found.tag, "data-file-height"),
  };
}

/** The widest picture the article's hero shows; a larger file is served as a thumbnail this wide. */
export const HERO_IMAGE_WIDTH = 1280;

export interface HeroImage {
  /** What the hero loads: a `HERO_IMAGE_WIDTH` thumbnail of a larger photo, else the file itself. */
  src: string;
  /** The file itself: where the hero falls back when the thumbnail cannot be had. */
  original: string;
  /** The picture's size as `src` serves it (null when the file's size is not known). */
  width: number | null;
  height: number | null;
}

const RASTER_FILE = /\.(?:png|jpe?g|gif|webp)(?:$|\?)/i;
const THUMB_PATH = /\/thumb(\/[^/]+\/[^/]+\/[^/]+)\/[^/]+$/;
const ORIGINAL_PATH = /\/images(\/[^/]+\/[^/]+)\/([^/?]+)$/;

/**
 * The hero's picture for a lead image URL. A photo wider than the hero can show is requested as a
 * thumbnail of `HERO_IMAGE_WIDTH` (MediaWiki's /images/thumb/ scheme), not as the full file; a
 * smaller one, a vector (MediaWiki would rasterize its thumbnail) and a file of unknown size are
 * served as the file itself, as the hero always did.
 */
export function heroImage(
  url: string,
  fileWidth: number | null,
  fileHeight: number | null
): HeroImage {
  const original = url.replace(THUMB_PATH, "$1");
  if (
    fileWidth === null ||
    fileHeight === null ||
    fileWidth <= HERO_IMAGE_WIDTH ||
    !RASTER_FILE.test(original) ||
    !ORIGINAL_PATH.test(original)
  ) {
    return { src: original, original, width: fileWidth, height: fileHeight };
  }

  return {
    src: original.replace(ORIGINAL_PATH, `/images/thumb$1/$2/${HERO_IMAGE_WIDTH}px-$2`),
    original,
    width: HERO_IMAGE_WIDTH,
    height: Math.round((HERO_IMAGE_WIDTH * fileHeight) / fileWidth),
  };
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
    return getImageUrl(cleanName);
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
