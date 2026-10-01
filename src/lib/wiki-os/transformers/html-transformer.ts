// src/lib/wiki-os/html-transformer.ts
// Transforms MediaWiki Action API HTML into WikiOS-ready content.
// Extracts infobox, TOC, and transforms links for /wiki/ routing.

import { withBasePath } from "~/lib/base-path";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { mapSrcsetUrls } from "~/lib/wiki-os/transformers/srcset";
import {
  getWikiBaseUrl,
  mediaWikiHostPattern,
  mediaWikiOrigin,
  type WikiSource,
} from "~/lib/wiki-os/config";
import { skipBlanks } from "../wikitext/blank";
import { forwardFinder, forwardSearch } from "../wikitext/forward-finder";
import { stripHtmlTags } from "./clean-markup-passes";
import {
  TAG_BODY,
  blocks,
  hasClass,
  lastAttribute,
  openingTags,
  removeBlocks,
  scanHtml,
  type BlockSpec,
  type HtmlScan,
  type Tag,
} from "./html-scan";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransformedArticle {
  /** Main article body HTML (infobox and notices removed) */
  contentHtml: string;
  /** Extracted infobox HTML (null if no infobox) */
  infoboxHtml: string | null;
  /** Extracted page-top notice banners (ambox, hatnotes, etc.) */
  noticesHtml: string | null;
  /** Table of contents entries extracted from headings */
  toc: TocEntry[];
  /** Image URLs found in the article */
  images: string[];
}

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

// ---------------------------------------------------------------------------
// Pre-compiled Regular Expressions (Module-Scoped for Performance)
// ---------------------------------------------------------------------------

const OUTER_WRAPPER_REGEX =
  /^<div[^>]*class="[^"]*mw-parser-output[^"]*"[^>]*>([\s\S]*)<\/div>\s*$/u;

/** The page-top notices: a table of class `ambox`, a div of `hatnote` or `dablink`, a div of a message-box class. */
const AMBOX_NOTICE: BlockSpec = {
  names: ["table"],
  closers: ["</table>"],
  opens: (scan, tag) => hasClass(scan, tag, '"', /ambox/),
};
const HATNOTE_NOTICE: BlockSpec = {
  names: ["div"],
  closers: ["</div>"],
  opens: (scan, tag) => hasClass(scan, tag, '"', /hatnote|dablink/),
};
const MESSAGE_NOTICE: BlockSpec = {
  names: ["div"],
  closers: ["</div>"],
  opens: (scan, tag) => hasClass(scan, tag, '"', /messagebox|notice|banner-notice|mw-message-box/),
};

/** ponytail: MAX_NOTICES, 25: the most banners a page's top is read for; a page has a handful, and each one read is cut out of the page by a search of it. */
const MAX_NOTICES = 25;

const EDIT_SECTION: BlockSpec = {
  names: ["span"],
  closers: ["</span>"],
  opens: (scan, tag) => hasClass(scan, tag, '"', /^mw-editsection/),
};

/** MediaWiki's own table of contents: a div with `id="toc"`. */
const BUILTIN_TOC: BlockSpec = {
  names: ["div"],
  closers: ["</div>"],
  opens: (scan, tag) => scan.lower.slice(tag.start, tag.end).includes('id="toc"'),
};

/** A `<style data-mw-deduplicate>`. */
const DEDUPLICATED_STYLE: BlockSpec = {
  names: ["style"],
  closers: ["</style>"],
  opens: (scan, tag) => scan.lower.slice(tag.start, tag.end).includes("data-mw-deduplicate"),
};

const WIKI_LINK_HREF_REGEX = /href="\/wiki\/([^"]*?)"/gu;
const INDEX_PHP_HREF_REGEX = /href="\/index\.php\?([^"]*)"/gu;
const INDEX_PHP_HREF_ONCE_REGEX = /href="\/index\.php\?([^"]*)"/u;
const ANCHOR_TAG_REGEX = /<a\b[^>]*>/gu;
/** MediaWiki's tooltip of a red link: redundant, since the link is red and WikiOS opens the editor. */
const MISSING_PAGE_TITLE_REGEX = /\s+title="[^"]*\(page does not exist\)"/u;
const CLASS_NEW_REGEX = /class="new"/gu;
/** Namespaces WikiOS does not read as articles of another wiki: they open on that wiki's own site. */
const SITE_NAMESPACE_REGEX =
  /^(?:File|Image|Media|Special|User|Category|Template|Module|Help|MediaWiki|Talk|[A-Za-z]+_talk)(?::|%3A)/iu;
const QUERY_TITLE_REGEX = /(?:^|&(?:amp;)?)title=([^&]*)/u;
const QUERY_UPLOAD_FILE_REGEX = /(?:^|&(?:amp;)?)wpDestFile=([^&]*)/u;
/** `Name?query#fragment` of a `/wiki/` link: the page name, then the wiki's own query (`?action=edit&redlink=1`), then the fragment. */
const WIKI_PATH_REGEX = /^([^?#]*)(?:\?[^#]*)?(#.*)?$/u;

/** A tag whose width or height is 1-24px is an icon (a notice's, a link marker's), never the lead image. */
const TINY_IMG_REGEX = /\b(?:width|height)=["'](?:1[0-9]|2[0-4]|[1-9])["']/iu;

const STYLE_EDIT_SECTION_REGEX = /class="mw-editsection"/gu;
/** The wiki's host (or its `www.` alias) as a regular-expression source: built from the configuration. */
const MEDIAWIKI_HOST = mediaWikiHostPattern();
/** `src="` and the start of an address of the wiki's own images or of Wikimedia Commons: the part `extractImageUrls` looks for. */
const COMMON_IMAGE_SOURCE = new RegExp(
  `src="https?:\\/\\/(?:${MEDIAWIKI_HOST}\\/images|upload\\.wikimedia\\.org\\/wikipedia\\/commons)`,
  "y"
);
/** An `http:` or protocol-relative spelling of the wiki's own host, which becomes its configured origin. */
const LEGACY_ORIGIN_SOURCE = `(?:http:)?\\/\\/${MEDIAWIKI_HOST}\\/`;
const LEGACY_SRC_ORIGIN_REGEX = new RegExp(`src="${LEGACY_ORIGIN_SOURCE}`, "gu");
const LEGACY_ORIGIN_START_REGEX = new RegExp(`^${LEGACY_ORIGIN_SOURCE}`, "u");
const SISTER_FILE_URL_REGEX = /^https?:\/\/(?:www\.)?iiwiki\.com\/images\//u;

// ---------------------------------------------------------------------------
// Main transformer
// ---------------------------------------------------------------------------

/**
 * Transform raw MediaWiki parse HTML into WikiOS-ready content.
 * Extracts infobox, builds TOC from headings, transforms links.
 */
export function transformArticleHtml(
  html: string,
  basePath: string,
  wikiSource: "ixwiki" | "iiwiki" | "althistory" = "ixwiki"
): TransformedArticle {
  let processed = html;

  // 1. Strip the outer mw-parser-output wrapper if present
  processed = stripOuterWrapper(processed);

  // 2. Extract page-top notices (ambox, hatnotes) — must come before infobox
  const { noticesHtml, remainingHtml: afterNotices } = extractNotices(processed);
  processed = afterNotices;

  // 3. Extract infobox
  const { infoboxHtml, remainingHtml } = extractInfobox(processed);
  processed = remainingHtml;

  // 4. Extract TOC from headings
  const toc = extractTocFromHeadings(processed);

  // 5. Remove MediaWiki's built-in TOC block if present
  processed = removeBuiltInToc(processed);

  // 6. Transform wiki links from /wiki/ to /wiki/ (another wiki's links stay with that wiki)
  processed = transformLinks(processed, basePath, wikiSource);

  // 7. Transform image URLs to be absolute. The page's first picture is likely its LCP image: the
  // infobox's when there is one, else the body's first. It loads eagerly; every other one lazily.
  processed = transformImages(processed, wikiSource, { eagerFirst: infoboxHtml === null });

  // 8. Add section edit links styling class
  processed = styleEditSectionLinks(processed);

  // 9. Extract image URLs
  const images = extractImageUrls(processed);

  return {
    contentHtml: processed,
    infoboxHtml: infoboxHtml
      ? transformLinks(
          transformImages(infoboxHtml, wikiSource, { eagerFirst: true }),
          basePath,
          wikiSource
        )
      : null,
    noticesHtml: noticesHtml
      ? transformLinks(transformImages(noticesHtml, wikiSource), basePath, wikiSource)
      : null,
    toc,
    images,
  };
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function stripOuterWrapper(html: string): string {
  const match = html.match(OUTER_WRAPPER_REGEX);
  return match ? match[1]! : html;
}

/**
 * Where the page's first infobox, `mw-heading` or h2-h6 starts (what
 * `html.search(/<(?:table[^>]*class="[^"]*infobox|div[^>]*class="mw-heading|h[2-6][\s>])/i)` finds), or -1.
 */
function contentStart(scan: HtmlScan): number {
  const { lower, nextGreater } = scan;
  for (let at = lower.indexOf("<"); at !== -1; at = lower.indexOf("<", at + 1)) {
    if (/^h[2-6][\s>]/.test(lower.slice(at + 1, at + 4))) return at;
    const isTable = lower.startsWith("table", at + 1);
    if (!isTable && !lower.startsWith("div", at + 1)) continue;
    const close = nextGreater(at + 1);
    const tag = lower.slice(at, close === -1 || close - at > TAG_BODY ? at + TAG_BODY : close + 1);
    const value = isTable ? /class="[^"]*infobox/ : /class="mw-heading/;
    if (value.test(tag)) return at;
  }
  return -1;
}

/**
 * Extract page-top notice banners (ambox, hatnotes, maintenance templates).
 * These appear before the infobox/content and should render above everything.
 */
function extractNotices(html: string): { noticesHtml: string | null; remainingHtml: string } {
  const notices: string[] = [];

  // Find the first heading or infobox — notices only appear before those
  const start = contentStart(scanHtml(html));
  const searchArea = start > 0 ? html.slice(0, start) : html.slice(0, 3000);

  const scan = scanHtml(searchArea);
  for (const spec of [AMBOX_NOTICE, HATNOTE_NOTICE, MESSAGE_NOTICE]) {
    for (const [from, to] of blocks(scan, spec)) {
      if (notices.length < MAX_NOTICES) notices.push(searchArea.slice(from, to));
    }
  }

  if (notices.length === 0) {
    return { noticesHtml: null, remainingHtml: html };
  }

  let remaining = html;
  for (const notice of notices) {
    remaining = remaining.replace(notice, "");
  }

  return {
    noticesHtml: notices.join("\n"),
    remainingHtml: remaining,
  };
}

/** The first tag of `name` whose class (in double quotes) holds `word`, or null. */
function firstClassedTag(scan: HtmlScan, name: string, word: RegExp): Tag | null {
  for (const tag of openingTags(scan, [name])) {
    if (hasClass(scan, tag, '"', word)) return tag;
  }
  return null;
}

function extractInfobox(html: string): { infoboxHtml: string | null; remainingHtml: string } {
  const scan = scanHtml(html);
  const infobox = firstClassedTag(scan, "table", /infobox/);
  if (!infobox) {
    const portable = firstClassedTag(scan, "aside", /portable-infobox/);
    if (!portable) {
      return { infoboxHtml: null, remainingHtml: html };
    }
    return extractBalancedTag(html, portable.start, "aside");
  }
  return extractBalancedTag(html, infobox.start, "table");
}

/**
 * Extract a balanced HTML tag starting at a given position.
 * Handles nested tags of the same type.
 */
function extractBalancedTag(
  html: string,
  startPos: number,
  tagName: string
): { infoboxHtml: string | null; remainingHtml: string } {
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  // Where the next opener and closer are, looked for once (a search from every tag would be quadratic).
  const findOpen = forwardFinder(html, openTag);
  const findClose = forwardFinder(html, closeTag);
  let depth = 0;
  let pos = startPos;

  while (pos < html.length) {
    const nextOpen = findOpen(pos + (depth === 0 ? 0 : 1));
    const nextClose = findClose(pos);

    if (nextClose === -1) break; // malformed HTML

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openTag.length;
    } else {
      if (depth <= 1) {
        const endPos = nextClose + closeTag.length;
        const extracted = html.slice(startPos, endPos);
        const remaining = html.slice(0, startPos) + html.slice(endPos);
        return { infoboxHtml: extracted, remainingHtml: remaining };
      }
      depth--;
      pos = nextClose + closeTag.length;
    }
  }

  // Fallback: couldn't balance, return without extraction
  return { infoboxHtml: null, remainingHtml: html };
}

/** A heading found in the page: its level, its id and the HTML between its tags. */
interface FoundHeading {
  level: number;
  id: string;
  html: string;
  /** Just past the heading's closing tag (and its wrapper's). */
  end: number;
}

/**
 * The `<h2>`-`<h6>` headings that have an `id`, in order, each with its first closing `</h2>`-`</h6>` after it
 * (what `/<h([2-6])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h[2-6]>/gi` finds). With `wrapper`, the heading must be
 * the first thing in a `<div class="mw-heading…">` and its closing tag the first that only blanks and `</div>`
 * follow (`/<div[^>]*class="mw-heading[^"]*"[^>]*>\s*<h(…)…<\/h[2-6]>\s*<\/div>/gi`).
 */
function* headingsOf(scan: HtmlScan, wrapper: boolean): Generator<FoundHeading> {
  const { html, lower } = scan;
  const nextHeadingClose = forwardFinder(lower, /<\/h[2-6]>/g);
  const nextWrappedClose = forwardSearch((from) => {
    for (let at = nextHeadingClose(from); at !== -1; at = nextHeadingClose(at + 1)) {
      if (lower.startsWith("</div>", skipBlanks(lower, at + 5))) return at;
    }
    return -1;
  });
  let reached = 0;
  for (const outer of openingTags(scan, wrapper ? ["div"] : ["h2", "h3", "h4", "h5", "h6"])) {
    if (outer.start < reached) continue;
    let heading = outer;
    if (wrapper) {
      if (!hasClass(scan, outer, '"', /^mw-heading/)) continue;
      const inner = skipBlanks(lower, outer.end);
      const close = scan.nextGreater(inner + 1);
      if (
        !/^<h[2-6]/.test(lower.slice(inner, inner + 3)) ||
        close === -1 ||
        close + 1 - inner > TAG_BODY
      )
        continue;
      heading = { start: inner, end: close + 1 };
    }
    const id = lastAttribute(scan, heading, "id");
    if (id === null) continue;
    const close = wrapper ? nextWrappedClose(heading.end) : nextHeadingClose(heading.end);
    if (close === -1) return;
    reached = wrapper ? skipBlanks(lower, close + 5) + "</div>".length : close + 5;
    yield {
      level: Number(lower.charAt(heading.start + 2)),
      id,
      html: html.slice(heading.end, close),
      end: reached,
    };
  }
}

/** The text of a heading's HTML: no `[edit]` link, no tags, trimmed. */
const headingText = (html: string): string =>
  stripHtmlTags(removeBlocks(html, EDIT_SECTION)).trim();

function extractTocFromHeadings(html: string): TocEntry[] {
  const toc: TocEntry[] = [];
  const scan = scanHtml(html);

  for (const heading of headingsOf(scan, true)) {
    // Strip HTML tags and [edit] links from heading text
    const text = headingText(heading.html);
    if (text) {
      toc.push({ id: heading.id, text, level: heading.level });
    }
  }

  // Fallback: try plain <h2 id="..."> without mw-heading wrapper
  if (toc.length === 0) {
    for (const heading of headingsOf(scan, false)) {
      const text = headingText(heading.html);
      if (text) {
        toc.push({ id: heading.id, text, level: heading.level });
      }
    }
  }

  return toc;
}

function removeBuiltInToc(html: string): string {
  const scan = scanHtml(html);
  const pieces: string[] = [];
  let copied = 0;
  for (const [start, end] of blocks(scan, BUILTIN_TOC)) {
    // The block's closing `</div>`, the blanks after it and, when one follows them, one more `</div>`.
    const blanks = skipBlanks(html, end);
    pieces.push(html.slice(copied, start));
    copied = scan.lower.startsWith("</div>", blanks) ? blanks + "</div>".length : blanks;
  }
  pieces.push(html.slice(copied));
  return pieces.join("");
}

function transformLinks(html: string, basePath: string, wikiSource: WikiSource): string {
  return wikiSource === "ixwiki"
    ? transformIxWikiLinks(html, basePath)
    : transformSourceWikiLinks(html, basePath, wikiSource);
}

function transformIxWikiLinks(html: string, basePath: string): string {
  const origin = mediaWikiOrigin();

  // 1. Transform /wiki/Title links to /wiki/Title (with basePath)
  let result = html.replace(WIKI_LINK_HREF_REGEX, (_match, path: string) => {
    if (
      path.startsWith("Special:") ||
      path.startsWith("Special%3A") ||
      path.startsWith("File:") ||
      path.startsWith("File%3A")
    ) {
      return `href="${origin}/wiki/${path}" rel="noreferrer"`;
    }
    return `href="${basePath}/wiki/${path}"`;
  });

  // 2. A red link opens WikiOS's own editor, as a relative link: not MediaWiki's index.php (about 190 bytes
  // a link, and a trip to the classic wiki). Its tooltip repeats what the red already says.
  result = result.replace(ANCHOR_TAG_REGEX, (tag) => redLinkToWikiOS(tag, basePath));

  // 3. Transform the other index.php links with noreferrer
  result = result.replace(
    INDEX_PHP_HREF_REGEX,
    (_match, query: string) => `href="${origin}/index.php?${query}" rel="noreferrer"`
  );

  // 4. Add wikios-redlink class to links with class="new"
  result = result.replace(CLASS_NEW_REGEX, 'class="new wikios-redlink"');

  return result;
}

/**
 * The opening tag `tag` of an anchor, with a red link (`/index.php?title=X&action=edit&redlink=1`) pointed at
 * WikiOS's editor for X (`<basePath>/wiki/<X's URL path>?action=edit&redlink=1`) and MediaWiki's "X (page
 * does not exist)" tooltip dropped. Any other tag, and a red link whose title WikiOS cannot read, is as it was.
 */
function redLinkToWikiOS(tag: string, basePath: string): string {
  const query = INDEX_PHP_HREF_ONCE_REGEX.exec(tag)?.[1];
  if (query === undefined) return tag;
  const params = new URLSearchParams(query.replace(/&amp;/gu, "&"));
  const title = params.get("title");
  const canon =
    params.get("action") === "edit" && params.get("redlink") === "1" && title
      ? canonicalizeTitle(title)
      : null;
  if (!canon) return tag;
  return tag
    .replace(/href="[^"]*"/u, `href="${basePath}/wiki/${canon.urlPath}?action=edit&amp;redlink=1"`)
    .replace(MISSING_PAGE_TITLE_REGEX, "");
}

/** The page a red link points at: its title, or the missing file of an upload link. */
function redLinkPage(query: string): string | undefined {
  const file = QUERY_UPLOAD_FILE_REGEX.exec(query)?.[1];
  return file ? `File:${file}` : QUERY_TITLE_REGEX.exec(query)?.[1];
}

/**
 * Another wiki's page is parsed by that wiki itself, so its links are its own (plan 415): an article stays in
 * the WikiOS reader for that wiki (`?source=`, before any #fragment, whatever query the wiki put on the
 * link); files, special, user and similar pages open on that wiki; a red link is a page missing there, so it
 * keeps its red styling and leads to the reader for that wiki, which says so, not to a create form.
 */
function transformSourceWikiLinks(html: string, basePath: string, wikiSource: WikiSource): string {
  const origin = getWikiBaseUrl(wikiSource).replace(/\/+$/u, "");
  const href = (path: string) => {
    const [, name = "", fragment = ""] = WIKI_PATH_REGEX.exec(path) ?? [];
    return SITE_NAMESPACE_REGEX.test(name)
      ? `href="${origin}/wiki/${path}" rel="noreferrer"`
      : `href="${basePath}/wiki/${name}?source=${wikiSource}${fragment}"`;
  };
  return html
    .replace(WIKI_LINK_HREF_REGEX, (_match, path: string) => href(path))
    .replace(INDEX_PHP_HREF_REGEX, (_match, query: string) => {
      const page = redLinkPage(query);
      return page ? href(page) : `href="${origin}/index.php?${query}" rel="noreferrer"`;
    });
}

/**
 * One `srcset` candidate URL of an IxWiki page, absolute like its `src` (`transformImages`): a root-relative
 * `/images/`, `/thumb/` or `/data/` path gets the origin, an `http:` or protocol-relative spelling of the
 * wiki's own host becomes the origin, and anything else (a URL that is already absolute, another host's) is
 * left exactly as it is: it is never prefixed a second time.
 */
function absoluteIxWikiSrcsetUrl(url: string, origin: string): string {
  if (LEGACY_ORIGIN_START_REGEX.test(url)) return url.replace(LEGACY_ORIGIN_START_REGEX, `${origin}/`);
  if (url.startsWith("/images/") || url.startsWith("/data/")) return `${origin}${url}`;
  if (url.startsWith("/thumb/")) return `${origin}/images${url}`;
  return url;
}

/** One `srcset` candidate URL of another wiki's page: its files go through that wiki's media proxy; the rest is untouched. */
function proxiedSourceSrcsetUrl(url: string, proxyBase: string): string {
  if (SISTER_FILE_URL_REGEX.test(url)) return url.replace(SISTER_FILE_URL_REGEX, `${proxyBase}/images/`);
  if (url.startsWith("/images/") || url.startsWith("/data/")) return `${proxyBase}${url}`;
  if (url.startsWith("/thumb/")) return `${proxyBase}/images${url}`;
  return url;
}

/**
 * `html` with `attribute` (`loading="lazy"`: what `render` makes of the tag's text) put in each `<img` whose tag does
 * not have one already (what `/<img(?![^>]*loading=)/g` found): the tag ends at the first `>` and holds the
 * attribute when `loading=` comes before it. Each is looked for once, however many `<img` come before it.
 */
function addImageAttribute(html: string, name: string, render: (tag: string) => string): string {
  const nextGreater = forwardFinder(html, ">");
  const nextAttribute = forwardFinder(html, name);
  const pieces: string[] = [];
  let copied = 0;
  for (let at = html.indexOf("<img"); at !== -1; at = html.indexOf("<img", at + 4)) {
    const end = nextGreater(at + 4);
    const attribute = nextAttribute(at + 4);
    if (attribute !== -1 && (end === -1 || attribute < end)) continue;
    // (a tag with no `>` after it is no text at all, as `slice(at, indexOf(">", at) + 1)` gave)
    const tag = end === -1 ? "" : html.slice(at, Math.min(end + 1, at + TAG_BODY));
    pieces.push(html.slice(copied, at), `<img ${render(tag)}`);
    copied = at + 4;
  }
  pieces.push(html.slice(copied));
  return pieces.join("");
}

export function transformImages(
  html: string,
  wikiSource: "ixwiki" | "iiwiki" | "althistory" = "ixwiki",
  { eagerFirst = false }: { eagerFirst?: boolean } = {}
): string {
  let origin = mediaWikiOrigin();
  let proxyBase = withBasePath("/api/mediawiki/ixwiki");

  if (wikiSource === "iiwiki") {
    origin = "https://iiwiki.com";
    proxyBase = withBasePath("/api/mediawiki/iiwiki");
  } else if (wikiSource === "althistory") {
    origin = "https://althistory.fandom.com";
    proxyBase = withBasePath("/api/mediawiki/althistory");
  }

  let result = html;

  if (wikiSource === "ixwiki") {
    result = result
      .replace(LEGACY_SRC_ORIGIN_REGEX, `src="${origin}/`)
      .replace(/src="\/images\//gu, `src="${origin}/images/`)
      .replace(/src="\/thumb\//gu, `src="${origin}/images/thumb/`)
      .replace(/src="\/data\//gu, `src="${origin}/data/`)
      .replace(/src="\/load\.php/gu, `src="${origin}/load.php`)
      .replace(
        /srcset="([^"]*)"/gu,
        (_match, srcset: string) =>
          `srcset="${mapSrcsetUrls(srcset, (url) => absoluteIxWikiSrcsetUrl(url, origin))}"`
      );
  } else {
    // For iiwiki and althistory, map relative /images/ to proxy
    result = result
      .replace(/src="\/images\//gu, `src="${proxyBase}/images/`)
      .replace(/src="\/thumb\//gu, `src="${proxyBase}/images/thumb/`)
      .replace(/src="\/data\//gu, `src="${proxyBase}/data/`)
      .replace(/src="\/load\.php/gu, `src="${origin}/load.php`)
      .replace(/src="https?:\/\/(?:www\.)?iiwiki\.com\/images\//gu, `src="${proxyBase}/images/`)
      .replace(
        /src="https?:\/\/(?:www\.)?iiwiki\.com\/wiki\/Special:FilePath\//gu,
        `src="${proxyBase}/wiki/Special:FilePath/`
      )
      .replace(
        /src="https?:\/\/(?:www\.)?althistory\.fandom\.com\/wiki\/Special:FilePath\//gu,
        `src="${proxyBase}/wiki/Special:FilePath/`
      )
      .replace(
        /srcset="([^"]*)"/gu,
        (_match, srcset: string) =>
          `srcset="${mapSrcsetUrls(srcset, (url) => proxiedSourceSrcsetUrl(url, proxyBase))}"`
      );
  }

  // 2. Transform url() references in inline CSS
  if (wikiSource === "ixwiki") {
    result = result.replace(
      /url\(["']?(\/(?:images|data|load\.php)[^"')\s]*)["']?\)/gu,
      (_match, path: string) => `url("${origin}${path}")`
    );
  } else {
    result = result
      .replace(
        /url\(["']?(\/(?:images|data|load\.php)[^"')\s]*)["']?\)/gu,
        (_match, path: string) => `url("${proxyBase}${path}")`
      )
      .replace(
        /url\(["']?https?:\/\/(?:www\.)?iiwiki\.com(\/(?:images|data)[^"')\s]*)["']?\)/gu,
        (_match, path: string) => `url("${proxyBase}${path}")`
      );
  }

  // 3. Transform href for stylesheets (/load.php)
  result = result.replace(/href="\/load\.php/gu, `href="${origin}/load.php`);

  // 4. Add lazy loading (the first real picture of `html` loads eagerly when asked), async decoding,
  // and no-referrer
  let eagerLeft = eagerFirst;
  result = addImageAttribute(result, "loading=", (tag) => {
    if (eagerLeft && !TINY_IMG_REGEX.test(tag)) {
      eagerLeft = false;
      return 'loading="eager"';
    }
    return 'loading="lazy"';
  });
  result = addImageAttribute(result, "decoding=", () => 'decoding="async"');
  result = addImageAttribute(result, "referrerpolicy=", () => 'referrerpolicy="no-referrer"');

  return result;
}

/**
 * Append an "Edit" link to every h2/h3 heading under `root` that has none yet, opening the source
 * editor at that section (`/wiki/{slug}?action=edit&section={heading text}`). `slug` must already be
 * URI-encoded. It works on the DOM, in place: the reader's article is a live tree React rendered
 * from the server's HTML, and the links are added to it, never by writing the whole article HTML
 * again (and the HTML is sanitized already: string surgery on it is not safe, a heading whose
 * attribute holds `</h2>` would have the link written into that attribute).
 */
export function appendSectionEditLinks(root: Element | DocumentFragment, slug: string): void {
  const document = root.ownerDocument;
  if (!document) return;

  for (const heading of Array.from(root.querySelectorAll("h2, h3"))) {
    const text = (heading.textContent ?? "").trim();
    if (!text || heading.querySelector(".wikios-section-edit-link")) continue;

    const link = document.createElement("a");
    link.className = "wikios-section-edit-link";
    link.setAttribute(
      "href",
      withBasePath(`/wiki/${slug}?action=edit&section=${encodeURIComponent(text)}`)
    );
    link.setAttribute("aria-label", `Edit section: ${text}`);
    link.textContent = "Edit";
    heading.append(link);
  }
}

/** Takes the links `appendSectionEditLinks` added back out of the live tree (the viewer can no longer edit). */
export function removeSectionEditLinks(root: Element | DocumentFragment): void {
  for (const link of Array.from(root.querySelectorAll(".wikios-section-edit-link"))) link.remove();
}

function styleEditSectionLinks(html: string): string {
  return html.replace(STYLE_EDIT_SECTION_REGEX, 'class="mw-editsection wikios-edit-section"');
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  const nextGreater = forwardFinder(html, ">");
  let from = 0;
  for (let at = html.indexOf("<img"); at !== -1; at = html.indexOf("<img", from)) {
    from = at + 4;
    const end = nextGreater(from);
    if (end === -1) break; // no `>` after this one is a tag's end either
    if (end - at > TAG_BODY) continue;
    // The last `src="` of the tag that starts a common address (the expression reads greedily).
    for (
      let src = html.lastIndexOf('src="', end);
      src >= from;
      src = html.lastIndexOf('src="', src - 1)
    ) {
      COMMON_IMAGE_SOURCE.lastIndex = src;
      const prefix = COMMON_IMAGE_SOURCE.exec(html)?.[0];
      if (!prefix) continue;
      const close = html.indexOf('"', src + prefix.length);
      if (close > src + prefix.length) {
        urls.push(html.slice(src + 5, close));
        from = close + 1;
        break;
      }
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Utility: clean wikitext-generated HTML for display
// ---------------------------------------------------------------------------

/**
 * Strip MediaWiki skin-specific CSS while keeping page template styles.
 */
export function stripConflictingStyles(html: string): string {
  const scan = scanHtml(html);
  const pieces: string[] = [];
  let copied = 0;
  for (const [start, end] of blocks(scan, DEDUPLICATED_STYLE)) {
    const content = html.slice(scan.nextGreater(start + 1) + 1, end - "</style>".length);
    const isSkinSpecific =
      content.includes(".skin-citizen") ||
      content.includes(".skin-vector") ||
      content.includes("skin-theme-clientpref") ||
      content.includes(".mw-page-title") ||
      content.includes(".mw-body-content parsoid-body");

    const hasTemplateStyles =
      content.includes(".home-grid") ||
      content.includes(".home-card") ||
      content.includes("#featured_article") ||
      content.includes(".home-header") ||
      content.includes(".home-link") ||
      content.includes(".infobox") ||
      content.includes(".template-");

    if (isSkinSpecific && !hasTemplateStyles) {
      pieces.push(html.slice(copied, start));
      copied = end;
    }
  }
  pieces.push(html.slice(copied));
  return pieces.join("");
}
