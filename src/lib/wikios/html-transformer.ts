// src/lib/wikios/html-transformer.ts
// Transforms MediaWiki Action API HTML into WikiOS-ready content.
// Extracts infobox, TOC, and transforms links for /w/ routing.

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

  // 3. Extract TOC from headings
  const toc = extractTocFromHeadings(processed);

  // 4. Remove MediaWiki's built-in TOC block if present
  processed = removeBuiltInToc(processed);

  // 5. Transform wiki links from /wiki/ to /w/
  processed = transformLinks(processed, basePath);

  // 6. Transform image URLs to be absolute
  processed = transformImages(processed, wikiSource);

  // 7. Add section edit links styling class
  processed = styleEditSectionLinks(processed);

  // 8. Extract image URLs
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

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function stripOuterWrapper(html: string): string {
  // Remove <div class="mw-content-ltr mw-parser-output" ...>...</div>
  const match = html.match(
    /^<div[^>]*class="[^"]*mw-parser-output[^"]*"[^>]*>([\s\S]*)<\/div>\s*$/
  );
  return match ? match[1]! : html;
}

/**
 * Extract page-top notice banners (ambox, hatnotes, maintenance templates).
 * These appear before the infobox/content and should render above everything.
 * Matches: <table class="...ambox...">, <div class="...hatnote...">,
 *          <div class="...dablink...">, <div class="...notice...">
 */
function extractNotices(html: string): { noticesHtml: string | null; remainingHtml: string } {
  const notices: string[] = [];
  let remaining = html;

  // Find the first heading or infobox — notices only appear before those
  const contentStart = remaining.search(
    /<(?:table[^>]*class="[^"]*infobox|div[^>]*class="mw-heading|h[2-6][\s>])/i
  );
  // Only search the top portion of the HTML for notices
  const searchArea = contentStart > 0 ? remaining.slice(0, contentStart) : remaining.slice(0, 3000);

  // Extract ambox tables (WIP, stub, cleanup, etc.)
  const amboxPattern = /<table[^>]*class="[^"]*ambox[^"]*"[\s\S]*?<\/table>/gi;
  let match;
  while ((match = amboxPattern.exec(searchArea)) !== null) {
    notices.push(match[0]);
  }

  // Extract hatnote divs ("For other uses, see...")
  const hatnotePattern = /<div[^>]*class="[^"]*(?:hatnote|dablink)[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
  while ((match = hatnotePattern.exec(searchArea)) !== null) {
    notices.push(match[0]);
  }

  // Extract message boxes / notice divs
  const noticePattern =
    /<div[^>]*class="[^"]*(?:messagebox|notice|banner-notice|mw-message-box)[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
  while ((match = noticePattern.exec(searchArea)) !== null) {
    notices.push(match[0]);
  }

  if (notices.length === 0) {
    return { noticesHtml: null, remainingHtml: html };
  }

  // Remove extracted notices from the HTML
  for (const notice of notices) {
    remaining = remaining.replace(notice, "");
  }

  return {
    noticesHtml: notices.join("\n"),
    remainingHtml: remaining,
  };
}

function extractInfobox(html: string): { infoboxHtml: string | null; remainingHtml: string } {
  // Match the infobox table — uses a balanced tag approach for nested tables
  // MediaWiki infoboxes are <table class="infobox ...">
  const infoboxStart = html.search(/<table[^>]*class="[^"]*infobox[^"]*"/i);
  if (infoboxStart === -1) {
    // Also check for portable infobox (<aside>)
    const portableStart = html.search(/<aside[^>]*class="[^"]*portable-infobox[^"]*"/i);
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
): { infoboxHtml: string; remainingHtml: string } {
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

  // MediaWiki 1.45 uses <div class="mw-heading mw-heading2"><h2 id="...">...</h2></div>
  const headingRegex =
    /<div[^>]*class="mw-heading[^"]*"[^>]*>\s*<h([2-6])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h[2-6]>\s*<\/div>/gi;
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]!, 10);
    const id = match[2]!;
    // Strip HTML tags and [edit] links from heading text
    const text = match[3]!
      .replace(/<span[^>]*class="mw-editsection[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) {
      toc.push({ id, text, level });
    }
  }

  // Fallback: try plain <h2 id="..."> without mw-heading wrapper
  if (toc.length === 0) {
    const plainRegex = /<h([2-6])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h[2-6]>/gi;
    while ((match = plainRegex.exec(html)) !== null) {
      const level = parseInt(match[1]!, 10);
      const id = match[2]!;
      const text = match[3]!
        .replace(/<span[^>]*class="mw-editsection[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (text) {
        toc.push({ id, text, level });
      }
    }
  }

  return toc;
}

function removeBuiltInToc(html: string): string {
  // Remove MediaWiki's <div id="toc" ...>...</div>
  return html.replace(/<div[^>]*id="toc"[^>]*>[\s\S]*?<\/div>\s*(?:<\/div>)?/gi, "");
}

function transformLinks(html: string, basePath: string): string {
  const origin = "https://ixwiki.com";

  // 1. Transform /wiki/Title links to /w/Title (with basePath)
  //    Special: and File: links stay pointing to MediaWiki with noreferrer
  //    to avoid Cloudflare hotlink blocking
  let result = html.replace(/href="\/wiki\/([^"]*?)"/g, (_match, path: string) => {
    if (
      path.startsWith("Special:") ||
      path.startsWith("Special%3A") ||
      path.startsWith("File:") ||
      path.startsWith("File%3A")
    ) {
      return `href="${origin}/wiki/${path}" rel="noreferrer"`;
    }
    return `href="${basePath}/w/${path}"`;
  });

  // 2. Transform red links with noreferrer
  result = result.replace(
    /href="\/index\.php\?([^"]*)"/g,
    (_match, query: string) => `href="${origin}/index.php?${query}" rel="noreferrer"`
  );

  // 3. Add wikios-redlink class to links with class="new" (MediaWiki red links)
  result = result.replace(/class="new"/g, 'class="new wikios-redlink"');

  return result;
}

function transformImages(
  html: string,
  wikiSource: "ixwiki" | "iiwiki" | "althistory" = "ixwiki"
): string {
  let origin = "https://ixwiki.com";
  let proxyBase = "/api/ixwiki-proxy";

  if (wikiSource === "iiwiki") {
    origin = "https://iiwiki.com";
    proxyBase = "/api/iiwiki-proxy";
  } else if (wikiSource === "althistory") {
    origin = "https://althistory.fandom.com";
    proxyBase = "/api/althistory-wiki-proxy";
  }

  // 1. Make relative image/asset URLs absolute or proxied
  // Handles /images/, /data/, and other MediaWiki-served paths
  let result = html;

  if (wikiSource === "ixwiki") {
    result = result
      .replace(/src="\/images\//g, `src="${origin}/images/`)
      .replace(/src="\/data\//g, `src="${origin}/data/`)
      .replace(/src="\/load\.php/g, `src="${origin}/load.php`)
      .replace(/srcset="([^"]*)"/g, (_match, srcset: string) => {
        const transformed = srcset
          .replace(/\/images\//g, `${origin}/images/`)
          .replace(/\/data\//g, `${origin}/data/`);
        return `srcset="${transformed}"`;
      });
  } else {
    // For iiwiki and althistory, map relative /images/ to proxy
    result = result
      .replace(/src="\/images\//g, `src="${proxyBase}/images/`)
      .replace(/src="\/data\//g, `src="${proxyBase}/data/`)
      .replace(/src="\/load\.php/g, `src="${origin}/load.php`) // load.php remains original
      // Also map full URL paths if they are in the HTML
      .replace(/src="https?:\/\/(?:www\.)?iiwiki\.com\/images\//g, `src="${proxyBase}/images/`)
      .replace(
        /src="https?:\/\/(?:www\.)?iiwiki\.com\/wiki\/Special:FilePath\//g,
        `src="${proxyBase}/wiki/Special:FilePath/`
      )
      .replace(
        /src="https?:\/\/(?:www\.)?althistory\.fandom\.com\/wiki\/Special:FilePath\//g,
        `src="${proxyBase}/wiki/Special:FilePath/`
      )
      .replace(/srcset="([^"]*)"/g, (_match, srcset: string) => {
        const transformed = srcset
          .replace(/\/images\//g, `${proxyBase}/images/`)
          .replace(/\/data\//g, `${proxyBase}/data/`)
          .replace(/https?:\/\/(?:www\.)?iiwiki\.com\/images\//g, `${proxyBase}/images/`);
        return `srcset="${transformed}"`;
      });
  }

  // 2. Transform url() references in inline CSS (background-image, etc.)
  if (wikiSource === "ixwiki") {
    result = result.replace(
      /url\(["']?(\/(?:images|data|load\.php)[^"')\s]*)["']?\)/g,
      (_match, path: string) => `url("${origin}${path}")`
    );
  } else {
    result = result
      .replace(
        /url\(["']?(\/(?:images|data|load\.php)[^"')\s]*)["']?\)/g,
        (_match, path: string) => `url("${proxyBase}${path}")`
      )
      .replace(
        /url\(["']?https?:\/\/(?:www\.)?iiwiki\.com(\/(?:images|data)[^"')\s]*)["']?\)/g,
        (_match, path: string) => `url("${proxyBase}${path}")`
      );
  }

  // 3. Transform href for stylesheets (/load.php)
  result = result.replace(/href="\/load\.php/g, `href="${origin}/load.php`);

  // 4. Add lazy loading to all images
  result = result.replace(/<img(?![^>]*loading=)/g, '<img loading="lazy"');

  // 5. Add decoding="async" for better rendering performance
  result = result.replace(/<img(?![^>]*decoding=)/g, '<img decoding="async"');

  // 6. Add referrerpolicy="no-referrer" to prevent Cloudflare hotlink blocking
  // Without this, browsers send Referer: http://localhost:3000 which triggers 403
  result = result.replace(/<img(?![^>]*referrerpolicy=)/g, '<img referrerpolicy="no-referrer"');

  return result;
}

function styleEditSectionLinks(html: string): string {
  // Add WikiOS class to edit section links for styling control
  return html.replace(/class="mw-editsection"/g, 'class="mw-editsection wikios-edit-section"');
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  // Match images from ixwiki.com/images/ AND upload.wikimedia.org (Commons)
  const imgRegex =
    /<img[^>]*src="(https:\/\/(?:ixwiki\.com\/images|upload\.wikimedia\.org\/wikipedia\/commons)[^"]+)"/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    urls.push(match[1]!);
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Utility: clean wikitext-generated HTML for display
// ---------------------------------------------------------------------------

/**
 * Strip MediaWiki skin-specific CSS while keeping page template styles.
 * Removes skin overrides (Citizen, Vector, theme-clientpref) but preserves
 * layout styles used by templates (home-grid, home-card, featured_article, etc.).
 */
export function stripConflictingStyles(html: string): string {
  return html.replace(
    /<style[^>]*data-mw-deduplicate[^>]*>([\s\S]*?)<\/style>/gi,
    (fullMatch, content: string) => {
      // Only strip blocks that contain skin-specific selectors
      const isSkinSpecific =
        content.includes(".skin-citizen") ||
        content.includes(".skin-vector") ||
        content.includes("skin-theme-clientpref") ||
        content.includes(".mw-page-title") ||
        content.includes(".mw-body-content parsoid-body");

      // Keep blocks with page-specific template styles
      const hasTemplateStyles =
        content.includes(".home-grid") ||
        content.includes(".home-card") ||
        content.includes("#featured_article") ||
        content.includes(".home-header") ||
        content.includes(".home-link") ||
        content.includes(".infobox") ||
        content.includes(".template-");

      if (hasTemplateStyles) return fullMatch; // preserve
      if (isSkinSpecific) return ""; // remove
      return fullMatch; // keep by default
    }
  );
}
