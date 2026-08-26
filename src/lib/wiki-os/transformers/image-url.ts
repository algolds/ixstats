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
 * Fast zero-dependency synchronous MD5 implementation for standard MediaWiki shard computation.
 */
function md5(input: string): string {
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }
  function bitRotateLeft(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  const utf8: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code < 0x80) {
      utf8.push(code);
    } else if (code < 0x800) {
      utf8.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      utf8.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (input.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  const n = utf8.length;
  const blocks: number[] = [];
  for (let i = 0; i < n; i++) {
    blocks[i >> 2] = (blocks[i >> 2] || 0) | (utf8[i]! << ((i % 4) * 8));
  }
  blocks[n >> 2] = (blocks[n >> 2] || 0) | (0x80 << ((n % 4) * 8));
  blocks[(((n + 8) >> 6) << 4) + 14] = n * 8;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < blocks.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;

    a = md5ff(a, b, c, d, blocks[i] || 0, 7, -680876936);
    d = md5ff(d, a, b, c, blocks[i + 1] || 0, 12, -389564586);
    c = md5ff(c, d, a, b, blocks[i + 2] || 0, 17, 606105819);
    b = md5ff(b, c, d, a, blocks[i + 3] || 0, 22, -1044525330);
    a = md5ff(a, b, c, d, blocks[i + 4] || 0, 7, -176418897);
    d = md5ff(d, a, b, c, blocks[i + 5] || 0, 12, 1200080426);
    c = md5ff(c, d, a, b, blocks[i + 6] || 0, 17, -1473231341);
    b = md5ff(b, c, d, a, blocks[i + 7] || 0, 22, -45705983);
    a = md5ff(a, b, c, d, blocks[i + 8] || 0, 7, 1770035416);
    d = md5ff(d, a, b, c, blocks[i + 9] || 0, 12, -1958414417);
    c = md5ff(c, d, a, b, blocks[i + 10] || 0, 17, -42063);
    b = md5ff(b, c, d, a, blocks[i + 11] || 0, 22, -1990404162);
    a = md5ff(a, b, c, d, blocks[i + 12] || 0, 7, 1804603682);
    d = md5ff(d, a, b, c, blocks[i + 13] || 0, 12, -40341101);
    c = md5ff(c, d, a, b, blocks[i + 14] || 0, 17, -1502002290);
    b = md5ff(b, c, d, a, blocks[i + 15] || 0, 22, 1236535329);

    a = md5gg(a, b, c, d, blocks[i + 1] || 0, 5, -165796510);
    d = md5gg(d, a, b, c, blocks[i + 6] || 0, 9, -1069501632);
    c = md5gg(c, d, a, b, blocks[i + 11] || 0, 14, 643717713);
    b = md5gg(b, c, d, a, blocks[i] || 0, 20, -373897302);
    a = md5gg(a, b, c, d, blocks[i + 5] || 0, 5, -701558691);
    d = md5gg(d, a, b, c, blocks[i + 10] || 0, 9, 38016083);
    c = md5gg(c, d, a, b, blocks[i + 15] || 0, 14, -660478335);
    b = md5gg(b, c, d, a, blocks[i + 4] || 0, 20, -405537848);
    a = md5gg(a, b, c, d, blocks[i + 9] || 0, 5, 568446438);
    d = md5gg(d, a, b, c, blocks[i + 14] || 0, 9, -1019803690);
    c = md5gg(c, d, a, b, blocks[i + 3] || 0, 14, -187363961);
    b = md5gg(b, c, d, a, blocks[i + 8] || 0, 20, 1163531501);
    a = md5gg(a, b, c, d, blocks[i + 13] || 0, 5, -1444681467);
    d = md5gg(d, a, b, c, blocks[i + 2] || 0, 9, -51403784);
    c = md5gg(c, d, a, b, blocks[i + 7] || 0, 14, 1735328473);
    b = md5gg(b, c, d, a, blocks[i + 12] || 0, 20, -1926607734);

    a = md5hh(a, b, c, d, blocks[i + 5] || 0, 4, -378558);
    d = md5hh(d, a, b, c, blocks[i + 8] || 0, 11, -2022574463);
    c = md5hh(c, d, a, b, blocks[i + 11] || 0, 16, 1839030562);
    b = md5hh(b, c, d, a, blocks[i + 14] || 0, 23, -35309556);
    a = md5hh(a, b, c, d, blocks[i + 1] || 0, 4, -1530992060);
    d = md5hh(d, a, b, c, blocks[i + 4] || 0, 11, 1272893353);
    c = md5hh(c, d, a, b, blocks[i + 7] || 0, 16, -155497632);
    b = md5hh(b, c, d, a, blocks[i + 10] || 0, 23, -1094730640);
    a = md5hh(a, b, c, d, blocks[i + 13] || 0, 4, 681279174);
    d = md5hh(d, a, b, c, blocks[i] || 0, 11, -358537222);
    c = md5hh(c, d, a, b, blocks[i + 3] || 0, 16, -722521979);
    b = md5hh(b, c, d, a, blocks[i + 6] || 0, 23, 76029189);
    a = md5hh(a, b, c, d, blocks[i + 9] || 0, 4, -640364487);
    d = md5hh(d, a, b, c, blocks[i + 12] || 0, 11, -421815835);
    c = md5hh(c, d, a, b, blocks[i + 15] || 0, 16, 530742520);
    b = md5hh(b, c, d, a, blocks[i + 2] || 0, 23, -995338651);

    a = md5ii(a, b, c, d, blocks[i] || 0, 6, -198630844);
    d = md5ii(d, a, b, c, blocks[i + 7] || 0, 10, 1126891415);
    c = md5ii(c, d, a, b, blocks[i + 14] || 0, 15, -1416354905);
    b = md5ii(b, c, d, a, blocks[i + 5] || 0, 21, -57434055);
    a = md5ii(a, b, c, d, blocks[i + 12] || 0, 6, 1700485571);
    d = md5ii(d, a, b, c, blocks[i + 3] || 0, 10, -1894986606);
    c = md5ii(c, d, a, b, blocks[i + 10] || 0, 15, -1051523);
    b = md5ii(b, c, d, a, blocks[i + 1] || 0, 21, -2054922799);
    a = md5ii(a, b, c, d, blocks[i + 8] || 0, 6, 1873313359);
    d = md5ii(d, a, b, c, blocks[i + 15] || 0, 10, -30611744);
    c = md5ii(c, d, a, b, blocks[i + 6] || 0, 15, -1560198380);
    b = md5ii(b, c, d, a, blocks[i + 13] || 0, 21, 1309151649);
    a = md5ii(a, b, c, d, blocks[i + 4] || 0, 6, -145523070);
    d = md5ii(d, a, b, c, blocks[i + 11] || 0, 10, -1120210379);
    c = md5ii(c, d, a, b, blocks[i + 2] || 0, 15, 718787259);
    b = md5ii(b, c, d, a, blocks[i + 9] || 0, 21, -343485551);

    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  const hexChars = "0123456789abcdef";
  let hex = "";
  const values = [a, b, c, d];
  for (let i = 0; i < 4; i++) {
    const val = values[i]!;
    for (let j = 0; j < 4; j++) {
      const byte = (val >> (j * 8)) & 0xff;
      hex += hexChars.charAt((byte >> 4) & 0x0f) + hexChars.charAt(byte & 0x0f);
    }
  }
  return hex;
}

/**
 * Calculate standard MediaWiki MD5 shard path
 * e.g. "Caphiria_flag.svg" -> shard "8/8c", path "8/8c/Caphiria_flag.svg"
 */
export function getMd5ShardPath(filename: string): { shard: string; fullPath: string; cleanName: string } {
  let decoded = filename;
  try {
    decoded = decodeURIComponent(filename);
  } catch {}

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
