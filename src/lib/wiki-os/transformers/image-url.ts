// Client-safe wiki and Wikimedia Commons image URL resolution utilities.

import { createHash } from "crypto";
import { withBasePath } from "~/lib/base-path";
import { isMediaWikiUrl, mediaWikiImageUrl, type WikiSource } from "../config";
import { forwardFinder } from "../wikitext/forward-finder";
import {
  blocks,
  hasClass,
  imageTags,
  removeBlocks,
  scanHtml,
  type BlockSpec,
  type HtmlScan,
} from "./html-scan";

export type ExtendedWikiSource = WikiSource | "commons";

/** Name fragments of icons, notice badges and system assets that are never article images. */
const BLOCKED_ICON_TERMS = `
  ambox red_piston piston underconstruction under_construction under-construction
  construction road_works roadworks road-works work_in_progress wip stub cleanup
  padlock lock- edit- magnify-clip nuvola gnome crystal_clear crystal_ commons-logo
  wikimedia wikipedia disambig question_book wiki_letter symbol_ information_icon
  info_icon info-icon flag_of_none no_flag traffic_cone barrier caution maintenance
  inuse in_use in-use spanner wrench shovel worker merge split dialog- system- emblem-
  p_vip portal- star_icon green_check cross_icon trash delete clock_ arrow
  external-link
`
  .trim()
  .split(/\s+/);

/** A blocked term at the start of the name or after `_` / `-`. */
const BLOCKED_ICON_PATTERN = new RegExp(`(?:^|[_-])(?:${BLOCKED_ICON_TERMS.join("|")})`);

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

  if (BLOCKED_ICON_PATTERN.test(clean)) return true;

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
  const directUrl = mediaWikiImageUrl(`/images/${fullPath}`);
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

const commonsFileUrl = (filename: string): string =>
  withBasePath(
    `/api/mediawiki/commons/Special:Filepath/${encodeURIComponent(filename.replace(/ /g, "_"))}`
  );

const restoreSvg = (filename: string): string => filename.replace(/\.svg\.png$/i, ".svg");

/**
 * Converts any Wikimedia Commons / Wikipedia URL to our cached local proxy URL.
 */
export function getCommonsProxyUrl(url: string): string {
  if (!url) return url;

  if (url.includes("/api/mediawiki/commons/")) {
    return url;
  }

  try {
    // A file is named by its path. The query (MediaWiki's imageinfo links end in `?utm_source=...`)
    // and the fragment are not part of the name, and the proxy asks imageinfo for the name only:
    // left in, they were encoded into the file name and the proxy answered 404.
    const pathEnd = url.search(/[?#]/);
    const decodedUrl = decodeURIComponent(pathEnd === -1 ? url : url.slice(0, pathEnd));

    // Match /wikipedia/commons/... or /wikipedia/en/... and extract filename
    const commonsMatch = decodedUrl.match(
      /\/wikipedia\/(?:commons|en)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/i
    );
    if (commonsMatch && commonsMatch[1]) {
      return commonsFileUrl(restoreSvg(commonsMatch[1]));
    }

    // Fallback: extract last segment if valid image extension
    const urlObj = new URL(url.startsWith("//") ? `https:${url}` : url);
    // (`pathname` is percent-encoded: decode the name once, `encodeURIComponent` encodes it again)
    const lastSegment = decodeURIComponent(urlObj.pathname.split("/").pop() ?? "");
    if (lastSegment && /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(lastSegment)) {
      return commonsFileUrl(restoreSvg(lastSegment));
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
  if (/^https?:\/\//i.test(url) && isMediaWikiUrl(url)) {
    const subpath = url.replace(/^https?:\/\/[^/]+\/?/i, "");
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

const noticeBlock = (
  names: readonly string[],
  closers: readonly string[],
  words: RegExp
): BlockSpec => ({
  names,
  closers,
  opens: (scan, tag) => hasClass(scan, tag, `"'`, words),
});

/** The maintenance, notice and ambox blocks a lead image is never in. */
const NOTICE_TABLE = noticeBlock(
  ["table"],
  ["</table>"],
  /\b(?:ambox|tmbox|ombox|cmbox|fmbox|metadata|hatnote|dablink|stub|maint|wip)\b/
);
const NOTICE_DIV = noticeBlock(
  ["div"],
  ["</div>"],
  /\b(?:ambox|metadata|hatnote|dablink|stub|wip|notice)\b/
);
const NOTICE_ASIDE = noticeBlock(["aside"], ["</aside>"], /\b(?:notice|ambox)\b/);

/** The infobox: a table or aside of class `infobox` or `portable-infobox`. */
const INFOBOX = noticeBlock(
  ["table", "aside"],
  ["</table>", "</aside>"],
  /\b(?:infobox|portable-infobox)\b/
);

/** A figure or thumb: a `<figure>` or `<div>` of a class a picture sits in. */
const FIGURE = noticeBlock(
  ["figure", "div"],
  ["</figure>", "</div>"],
  /\b(?:thumb|mw-halign|mw-default-size|thumbinner)\b/
);

/** The first picture of `scan`'s page between `from` and `to` that is a real one: its tag and normalized URL. */
function firstRealImage(
  scan: HtmlScan,
  from = 0,
  to = scan.html.length
): { tag: string; url: string } | null {
  for (const image of imageTags(scan, from, to)) {
    if (!image.src || /\b(?:width|height)=["'](?:1[0-9]|2[0-4]|[1-9])["']/i.test(image.tag))
      continue;
    if (isNoticeOrUtilityIcon(image.src)) continue;
    const normalized = normalizeWikiImageUrl(image.src);
    if (normalized) return { tag: image.tag, url: normalized };
  }
  return null;
}

/**
 * The genuine lead image of MediaWiki / Parsoid article HTML: its `<img>` tag and normalized URL.
 * Strictly ignores maintenance notices, WIP badges, template icons, and grabs
 * images from the Infobox first, then the first real content thumbnail/figure.
 */
function findLeadImage(html: string | null | undefined): { tag: string; url: string } | null {
  if (!html || typeof html !== "string") return null;

  // 1. Strip out all known maintenance / notice / ambox blocks
  const cleanHtml = removeBlocks(
    removeBlocks(removeBlocks(html, NOTICE_TABLE), NOTICE_DIV),
    NOTICE_ASIDE
  );
  const scan = scanHtml(cleanHtml);

  // 2. First priority: Infobox image (<table class="infobox">, <aside class="portable-infobox">, .infobox-image)
  const [infobox] = blocks(scan, INFOBOX);
  if (infobox) {
    const found = firstRealImage(scan, infobox[0], infobox[1]);
    if (found) return found;
  }

  // 3. Second priority: Figure or Thumbimage (<figure>, <div class="thumb">, <img class="thumbimage">)
  for (const [start, end] of blocks(scan, FIGURE)) {
    const found = firstRealImage(scan, start, end);
    if (found) return found;
  }

  // 4. Third priority: Scan all remaining <img> tags in document order
  return firstRealImage(scan);
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

/** Proxy route serving `Special:FilePath` for each wiki; ixwiki uses MD5-sharded static storage instead. */
const FILEPATH_ROUTES: Partial<Record<ExtendedWikiSource, string>> = {
  commons: "commons/Special:Filepath",
  iiwiki: "iiwiki/wiki/Special:FilePath",
  althistory: "althistory/wiki/Special:FilePath",
};

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

  const route = FILEPATH_ROUTES[wikiSource];
  if (!route) return getImageUrl(cleanName);
  return withBasePath(
    `/api/mediawiki/${route}/${encodeURIComponent(cleanName.replace(/ /g, "_"))}`
  );
}
