// src/lib/wiki-os/html-transformer.ts
// Transforms MediaWiki Action API HTML into WikiOS-ready content.
// Extracts infobox, TOC, and transforms links for /wiki/ routing.

import { withBasePath } from "~/lib/base-path";

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

const CONTENT_START_REGEX =
  /<(?:table[^>]*class="[^"]*infobox|div[^>]*class="mw-heading|h[2-6][\s>])/iu;

const AMBOX_PATTERN = /<table[^>]*class="[^"]*ambox[^"]*"[\s\S]*?<\/table>/giu;
const HATNOTE_PATTERN = /<div[^>]*class="[^"]*(?:hatnote|dablink)[^"]*"[^>]*>[\s\S]*?<\/div>/giu;
const NOTICE_PATTERN =
  /<div[^>]*class="[^"]*(?:messagebox|notice|banner-notice|mw-message-box)[^"]*"[^>]*>[\s\S]*?<\/div>/giu;

const INFOBOX_TABLE_START_REGEX = /<table[^>]*class="[^"]*infobox[^"]*"/iu;
const INFOBOX_ASIDE_START_REGEX = /<aside[^>]*class="[^"]*portable-infobox[^"]*"/iu;

const HEADING_DIV_REGEX =
  /<div[^>]*class="mw-heading[^"]*"[^>]*>\s*<h([2-6])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h[2-6]>\s*<\/div>/giu;

const HEADING_PLAIN_REGEX = /<h([2-6])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h[2-6]>/giu;
const EDIT_SECTION_REGEX = /<span[^>]*class="mw-editsection[^"]*"[^>]*>[\s\S]*?<\/span>/giu;
const TAG_STRIP_REGEX = /<[^>]+>/gu;

const BUILTIN_TOC_REGEX = /<div[^>]*id="toc"[^>]*>[\s\S]*?<\/div>\s*(?:<\/div>)?/giu;
const WIKI_LINK_HREF_REGEX = /href="\/wiki\/([^"]*?)"/gu;
const INDEX_PHP_HREF_REGEX = /href="\/index\.php\?([^"]*)"/gu;
const CLASS_NEW_REGEX = /class="new"/gu;

const IMG_LAZY_REGEX = /<img(?![^>]*loading=)/gu;
const IMG_ASYNC_REGEX = /<img(?![^>]*decoding=)/gu;
const IMG_REFERRER_REGEX = /<img(?![^>]*referrerpolicy=)/gu;

const STYLE_EDIT_SECTION_REGEX = /class="mw-editsection"/gu;
const IMG_SRC_COMMON_REGEX =
  /<img[^>]*src="(https:\/\/(?:ixwiki\.com\/images|upload\.wikimedia\.org\/wikipedia\/commons)[^"]+)"/gu;

const STYLE_DEDUPLICATE_REGEX = /<style[^>]*data-mw-deduplicate[^>]*>([\s\S]*?)<\/style>/giu;

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

  // 6. Transform wiki links from /wiki/ to /wiki/
  processed = transformLinks(processed, basePath);

  // 7. Transform image URLs to be absolute
  processed = transformImages(processed, wikiSource);

  // 8. Add section edit links styling class & performance optimization
  processed = styleEditSectionLinks(processed);
  processed = applySectionOptimization(processed);

  // 9. Extract image URLs
  const images = extractImageUrls(processed);

  return {
    contentHtml: processed,
    infoboxHtml: infoboxHtml
      ? transformLinks(transformImages(infoboxHtml, wikiSource), basePath)
      : null,
    noticesHtml: noticesHtml
      ? transformLinks(transformImages(noticesHtml, wikiSource), basePath)
      : null,
    toc,
    images,
  };
}

function applySectionOptimization(html: string): string {
  return html.replace(
    /class="mw-heading mw-heading2"/gu,
    'class="mw-heading mw-heading2 wikios-article-section"'
  );
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function stripOuterWrapper(html: string): string {
  const match = html.match(OUTER_WRAPPER_REGEX);
  return match ? match[1]! : html;
}

/**
 * Extract page-top notice banners (ambox, hatnotes, maintenance templates).
 * These appear before the infobox/content and should render above everything.
 */
function extractNotices(html: string): { noticesHtml: string | null; remainingHtml: string } {
  const notices: string[] = [];

  // Find the first heading or infobox — notices only appear before those
  const contentStart = html.search(CONTENT_START_REGEX);
  const searchArea = contentStart > 0 ? html.slice(0, contentStart) : html.slice(0, 3000);

  // Reset regex state
  AMBOX_PATTERN.lastIndex = 0;
  HATNOTE_PATTERN.lastIndex = 0;
  NOTICE_PATTERN.lastIndex = 0;

  let match;
  while ((match = AMBOX_PATTERN.exec(searchArea)) !== null) {
    notices.push(match[0]);
  }
  while ((match = HATNOTE_PATTERN.exec(searchArea)) !== null) {
    notices.push(match[0]);
  }
  while ((match = NOTICE_PATTERN.exec(searchArea)) !== null) {
    notices.push(match[0]);
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

function extractInfobox(html: string): { infoboxHtml: string | null; remainingHtml: string } {
  const infoboxStart = html.search(INFOBOX_TABLE_START_REGEX);
  if (infoboxStart === -1) {
    const portableStart = html.search(INFOBOX_ASIDE_START_REGEX);
    if (portableStart === -1) {
      return { infoboxHtml: null, remainingHtml: html };
    }
    return extractBalancedTag(html, portableStart, "aside");
  }
  return extractBalancedTag(html, infoboxStart, "table");
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
  let depth = 0;
  let pos = startPos;

  while (pos < html.length) {
    const nextOpen = html.indexOf(openTag, pos + (depth === 0 ? 0 : 1));
    const nextClose = html.indexOf(closeTag, pos);

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

function extractTocFromHeadings(html: string): TocEntry[] {
  const toc: TocEntry[] = [];
  HEADING_DIV_REGEX.lastIndex = 0;

  let match;
  while ((match = HEADING_DIV_REGEX.exec(html)) !== null) {
    const level = parseInt(match[1]!, 10);
    const id = match[2]!;
    // Strip HTML tags and [edit] links from heading text
    const text = match[3]!
      .replace(EDIT_SECTION_REGEX, "")
      .replace(TAG_STRIP_REGEX, "")
      .trim();
    if (text) {
      toc.push({ id, text, level });
    }
  }

  // Fallback: try plain <h2 id="..."> without mw-heading wrapper
  if (toc.length === 0) {
    HEADING_PLAIN_REGEX.lastIndex = 0;
    while ((match = HEADING_PLAIN_REGEX.exec(html)) !== null) {
      const level = parseInt(match[1]!, 10);
      const id = match[2]!;
      const text = match[3]!
        .replace(EDIT_SECTION_REGEX, "")
        .replace(TAG_STRIP_REGEX, "")
        .trim();
      if (text) {
        toc.push({ id, text, level });
      }
    }
  }

  return toc;
}

function removeBuiltInToc(html: string): string {
  return html.replace(BUILTIN_TOC_REGEX, "");
}

function transformLinks(html: string, basePath: string): string {
  const origin = "https://ixwiki.com";

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

  // 2. Transform red links with noreferrer
  result = result.replace(
    INDEX_PHP_HREF_REGEX,
    (_match, query: string) => `href="${origin}/index.php?${query}" rel="noreferrer"`
  );

  // 3. Add wikios-redlink class to links with class="new"
  result = result.replace(CLASS_NEW_REGEX, 'class="new wikios-redlink"');

  return result;
}

function transformImages(
  html: string,
  wikiSource: "ixwiki" | "iiwiki" | "althistory" = "ixwiki"
): string {
  let origin = "https://ixwiki.com";
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
      .replace(/src="\/images\//gu, `src="${origin}/images/`)
      .replace(/src="\/data\//gu, `src="${origin}/data/`)
      .replace(/src="\/load\.php/gu, `src="${origin}/load.php`)
      .replace(/srcset="([^"]*)"/gu, (_match, srcset: string) => {
        const transformed = srcset
          .replace(/\/images\//gu, `${origin}/images/`)
          .replace(/\/data\//gu, `${origin}/data/`);
        return `srcset="${transformed}"`;
      });
  } else {
    // For iiwiki and althistory, map relative /images/ to proxy
    result = result
      .replace(/src="\/images\//gu, `src="${proxyBase}/images/`)
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
      .replace(/srcset="([^"]*)"/gu, (_match, srcset: string) => {
        const transformed = srcset
          .replace(/\/images\//gu, `${proxyBase}/images/`)
          .replace(/\/data\//gu, `${proxyBase}/data/`)
          .replace(/https?:\/\/(?:www\.)?iiwiki\.com\/images\//gu, `${proxyBase}/images/`);
        return `srcset="${transformed}"`;
      });
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

  // 4. Add lazy loading, async decoding, and no-referrer
  result = result.replace(IMG_LAZY_REGEX, '<img loading="lazy"');
  result = result.replace(IMG_ASYNC_REGEX, '<img decoding="async"');
  result = result.replace(IMG_REFERRER_REGEX, '<img referrerpolicy="no-referrer"');

  return result;
}

function styleEditSectionLinks(html: string): string {
  return html.replace(STYLE_EDIT_SECTION_REGEX, 'class="mw-editsection wikios-edit-section"');
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  IMG_SRC_COMMON_REGEX.lastIndex = 0;
  let match;
  while ((match = IMG_SRC_COMMON_REGEX.exec(html)) !== null) {
    urls.push(match[1]!);
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
  return html.replace(
    STYLE_DEDUPLICATE_REGEX,
    (fullMatch, content: string) => {
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

      if (hasTemplateStyles) return fullMatch;
      if (isSkinSpecific) return "";
      return fullMatch;
    }
  );
}
