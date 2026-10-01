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
 * The canonical path of an IxWiki file under the wiki's host: `/images/<shard>/<File>`. It carries no host,
 * no proxy and no deployment base path, so it is what a lead image is stored as (`WikiArticle.leadImageUrl`):
 * `resolveStoredImageUrl` turns it into the URL a page loads it from, under whatever base path is serving.
 */
export function getImagePath(filename: string): string {
  return `/images/${getMd5ShardPath(filename).fullPath}`;
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
 * Extracts the genuine lead image URL from MediaWiki / Parsoid article HTML.
 * Strictly ignores maintenance notices, WIP badges, template icons, and grabs
 * images from the Infobox first, then the first real content thumbnail/figure.
 */
export function extractLeadImageFromHtml(html: string | null | undefined): string | null {
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
          if (normalized) return normalized;
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

// ---------------------------------------------------------------------------
// The lead image of raw wikitext
//
// This runs on MediaWiki text in the inbound sync, so every pass below is linear: a scan with
// `indexOf`, never a lazy or nested quantifier that could be made to rescan the rest of the text from
// each of 100,000 unclosed `[[File:` openers.
// ---------------------------------------------------------------------------

/** The infobox parameters that name the page's picture. */
const INFOBOX_IMAGE_PARAMS: ReadonlySet<string> = new Set([
  "image",
  "logo",
  "company_logo",
  "flag",
  "image_flag",
  "coat_of_arms",
  "image_coat",
  "seal",
  "image_seal",
  "map",
  "image_map",
  "photo",
  "image_photo",
  "portrait",
  "image_portrait",
  "album_cover",
  "cover",
  "poster",
  "emblem",
  "badge",
  "insignia",
  "picture",
  "header_image",
  "leader_image",
  "flag_image",
  "symbol",
]);

/** The longest parameter name in INFOBOX_IMAGE_PARAMS, plus one: a longer run of letters is no parameter. */
const MAX_PARAM_NAME_LENGTH = 16;
/** MediaWiki's file names are at most 255 bytes: a longer "file name" is text that is not one. */
const MAX_FILE_NAME_LENGTH = 300;
/** Notice templates that sit at the top of a page and carry icons, not the page's picture. */
const NOTICE_TEMPLATES = [
  "underconstruction",
  "under_construction",
  "wip",
  "work_in_progress",
  "stub",
  "cleanup",
  "ambox",
  "notice",
  "disambig",
  "about",
  "short description",
];

const WHITESPACE = /\s/;
const WORD_CHAR = /\w/;

/** `text` lower-cased in ASCII only: the case-insensitivity of a regular expression without the `u` flag. */
function asciiLower(text: string): string {
  return text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function skipWhitespace(text: string, from: number): number {
  let i = from;
  while (i < text.length && WHITESPACE.test(text.charAt(i))) i++;
  return i;
}

/** The index of the first of `stops` at or after `from`, or the end of the text. */
function runEnd(text: string, from: number, stops: string): number {
  let i = from;
  while (i < text.length && !stops.includes(text.charAt(i))) i++;
  return i;
}

/**
 * The first index at or after `from` where `needle` occurs, for calls whose `from` only grows. A search
 * that found `at` also answers every later `from` up to `at`, and one that found nothing answers all of
 * them: scanning for the same closing bracket from each of many openers costs one scan, not one each.
 */
export function forwardFinder(text: string, needle: string): (from: number) => number {
  let searchedFrom = -1;
  let foundAt = -2;
  return (from) => {
    if (foundAt === -1 && from >= searchedFrom) return -1;
    if (from >= searchedFrom && from <= foundAt) return foundAt;
    searchedFrom = from;
    foundAt = text.indexOf(needle, from);
    return foundAt;
  };
}

/**
 * What the parameter introduced by the `|` at `bar` says, when it is one of INFOBOX_IMAGE_PARAMS
 * (`| image = Flag.svg`): null when it is not one, "" when it is one with a blank value.
 */
function infoboxImageValue(text: string, bar: number): string | null {
  const nameStart = skipWhitespace(text, bar + 1);
  let nameEnd = nameStart;
  while (
    nameEnd < text.length &&
    nameEnd - nameStart < MAX_PARAM_NAME_LENGTH &&
    /[A-Za-z_]/.test(text.charAt(nameEnd))
  ) {
    nameEnd++;
  }
  if (!INFOBOX_IMAGE_PARAMS.has(asciiLower(text.slice(nameStart, nameEnd)))) return null;

  const equals = skipWhitespace(text, nameEnd);
  if (text.charAt(equals) !== "=") return null;
  const afterEquals = equals + 1;
  const valueStart = skipWhitespace(text, afterEquals);
  const first = text.charAt(valueStart);
  if (first !== "" && first !== "|" && first !== "}") {
    return text.slice(valueStart, runEnd(text, valueStart, "|\n}"));
  }
  // Nothing but blanks up to a `|`, a `}` or the end: a value is the last blank that is not a line break.
  for (let blank = valueStart - 1; blank >= afterEquals; blank--) {
    if (text.charAt(blank) !== "\n") return "";
  }
  return null;
}

/** The first image parameter's value (blank or not), or null when the text has none. */
function firstInfoboxImageValue(text: string): string | null {
  for (let bar = text.indexOf("|"); bar !== -1; bar = text.indexOf("|", bar + 1)) {
    const value = infoboxImageValue(text, bar);
    if (value !== null) return value;
  }
  return null;
}

/** `value` of an infobox image parameter as a bare file name: no `[[File:`, no `]]`, nothing after a delimiter. */
function bareFileName(value: string): string {
  return value
    .replace(/\[\[(?:File|Image):/gi, "")
    .replace(/\]\]/g, "")
    .split(/[|\]}\n]/)[0]!
    .replace(/^(?:File|Image|file|image):/i, "")
    .trim();
}

function isLineStart(text: string, at: number): boolean {
  return at === 0 || "\n\r\u2028\u2029".includes(text.charAt(at - 1));
}

/** The index just past the name of the notice template (NOTICE_TEMPLATES, as a whole word) that starts at `at`, or -1. */
function noticeTemplateEnd(text: string, at: number): number {
  const window = asciiLower(text.slice(at + 2, at + 2 + 24));
  for (const name of NOTICE_TEMPLATES) {
    if (window.startsWith(name) && !WORD_CHAR.test(window.charAt(name.length))) {
      return at + 2 + name.length;
    }
  }
  return -1;
}

/** The text without its notice templates: one that starts a line and runs to the first `}}` after its name. */
function withoutNoticeTemplates(text: string): string {
  const pieces: string[] = [];
  let copied = 0;
  for (let open = text.indexOf("{{"); open !== -1; open = text.indexOf("{{", open + 1)) {
    const nameEnd = isLineStart(text, open) ? noticeTemplateEnd(text, open) : -1;
    if (nameEnd === -1) continue;
    const close = text.indexOf("}}", nameEnd);
    if (close === -1) break; // no template can close after this one either
    pieces.push(text.slice(copied, open));
    copied = close + 2;
    open = close + 1; // the next search starts after the removed template
  }
  pieces.push(text.slice(copied));
  return pieces.join("");
}

/** The length of the "File:" or "Image:" prefix at `at` (any case), or 0. */
function filePrefixLength(text: string, at: number): number {
  const window = asciiLower(text.slice(at, at + 6));
  if (window.startsWith("file:")) return 5;
  return window.startsWith("image:") ? 6 : 0;
}

/**
 * The first `[[File:name|...]]` or `[[Image:name|...]]` of the text whose name is a real file (not a
 * notice icon): a link is closed by the first `]` after its name, which must be followed by another.
 */
function firstContentFileName(text: string): string | null {
  const nextClose = forwardFinder(text, "]");
  let from = 0;
  for (;;) {
    const open = text.indexOf("[[", from);
    if (open === -1) return null;
    const prefix = filePrefixLength(text, open + 2);
    if (prefix === 0) {
      from = open + 1;
      continue;
    }

    const nameStart = open + 2 + prefix;
    const close = nextClose(nameStart);
    if (close === -1) return null; // nothing closes any later link either
    const first = text.charAt(nameStart);
    if (nameStart === close || first === "|" || first === "\n") {
      from = open + 1; // no name
      continue;
    }
    if (text.charAt(close + 1) !== "]") {
      from = close; // every opener before this `]` is closed by the same one
      continue;
    }

    const name = text.slice(nameStart, runEnd(text, nameStart, "|\n]")).trim();
    if (name && name.length <= MAX_FILE_NAME_LENGTH && !isNoticeOrUtilityIcon(name)) return name;
    from = close + 2;
  }
}

/**
 * The file name of the genuine lead image of raw wikitext (checking infobox parameters first,
 * skipping notice templates, and grabbing the first body [[File:...]]); null when it has none.
 * Linear in the text.
 */
export function extractLeadImageFileName(wikitext: string | null | undefined): string | null {
  if (!wikitext || typeof wikitext !== "string") return null;

  // 1. The first infobox parameter that names a picture (Priority 1). A blank or unusable value
  // is an answer too: the search goes on to the page body, not to the next parameter.
  const value = firstInfoboxImageValue(wikitext);
  if (value !== null) {
    const rawFile = bareFileName(value);
    if (rawFile && rawFile.length <= MAX_FILE_NAME_LENGTH && !isNoticeOrUtilityIcon(rawFile)) {
      return rawFile;
    }
  }

  // 2. Strip top-level notice / maintenance templates, then 3. take the first content [[File:...]].
  return firstContentFileName(withoutNoticeTemplates(wikitext));
}

/** The URL of the lead image of raw wikitext (see `extractLeadImageFileName`); null when it has none. */
export function extractLeadImageFromWikitext(wikitext: string | null | undefined): string | null {
  const name = extractLeadImageFileName(wikitext);
  return name ? getImageUrl(name) : null;
}

/**
 * The canonical path (`getImagePath`) of the lead image of raw wikitext; null when it has none. This is the
 * form a lead image is stored in (`WikiArticle.leadImageUrl`): `resolveStoredImageUrl` loads it.
 */
export function extractLeadImagePath(wikitext: string | null | undefined): string | null {
  const name = extractLeadImageFileName(wikitext);
  return name ? getImagePath(name) : null;
}

/**
 * The URL a page loads a stored lead image from. A canonical path (`/images/...`) goes through the wiki
 * image proxy under the base path this deployment is served at; a row written before lead images were
 * stored canonically holds a URL that already loads (a proxied path, which keeps the base path it was
 * written under, or an absolute URL, which is proxied as before) and is passed through. Null for no image.
 */
export function resolveStoredImageUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith("/images/")) return normalizeWikiImageUrl(stored);
  if (stored.startsWith("/")) return stored;
  return normalizeWikiImageUrl(stored) ?? stored;
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
