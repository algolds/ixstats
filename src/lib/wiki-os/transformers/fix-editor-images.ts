// src/lib/wiki-os/fix-editor-images.ts
// Transforms relative image URLs in Parsoid HTML to absolute URLs for the
// contentEditable visual editor. Without this, images appear blank because
// relative paths like /images/... resolve against localhost:3000, not ixwiki.com.

import { getWikiBaseUrl, type WikiSource } from "~/lib/wiki-os/config";

// Pre-compiled regular expressions (module-scoped for maximum throughput)
const SRC_IMAGES_REGEX = /src="\/images\//gu;
const SRC_DATA_REGEX = /src="\/data\//gu;
const SRC_LOAD_REGEX = /src="\/load\.php/gu;
const SRC_FILEPATH_REGEX = /src="\/wiki\/Special:FilePath\//gu;
const SRCSET_REGEX = /srcset="([^"]*)"/gu;
const CSS_URL_REGEX = /url\(["']?(\/(?:images|data|load\.php)[^"')\s]*)["']?\)/gu;
const HREF_LOAD_REGEX = /href="\/load\.php/gu;
const IMG_REFERRER_REGEX = /<img(?![^>]*referrerpolicy=)/gu;

/**
 * Rewrite relative image/asset URLs in editor HTML to absolute MediaWiki URLs.
 * Preserves all data-mw and Parsoid metadata attributes.
 */
export function fixEditorImageUrls(html: string, source: WikiSource = "ixwiki"): string {
  if (!html) return "";

  // Fast-path bailout: if no relative MediaWiki asset patterns exist, return unmodified
  if (
    !html.includes("/images/") &&
    !html.includes("/data/") &&
    !html.includes("/load.php") &&
    !html.includes("Special:FilePath") &&
    !html.includes("<img")
  ) {
    return html;
  }

  const origin = getWikiBaseUrl(source);
  let result = html;

  // 1. src attributes — images, thumbnails, data files
  result = result
    .replace(SRC_IMAGES_REGEX, `src="${origin}/images/`)
    .replace(SRC_DATA_REGEX, `src="${origin}/data/`)
    .replace(SRC_LOAD_REGEX, `src="${origin}/load.php`)
    .replace(SRC_FILEPATH_REGEX, `src="${origin}/wiki/Special:FilePath/`);

  // 2. srcset attributes (responsive images)
  result = result.replace(SRCSET_REGEX, (_match, srcset: string) => {
    const transformed = srcset
      .replace(/\/images\//g, `${origin}/images/`)
      .replace(/\/data\//g, `${origin}/data/`);
    return `srcset="${transformed}"`;
  });

  // 3. url() references in inline CSS (background-image, etc.)
  result = result.replace(CSS_URL_REGEX, (_match, path: string) => `url("${origin}${path}")`);

  // 4. href for stylesheets (/load.php)
  result = result.replace(HREF_LOAD_REGEX, `href="${origin}/load.php`);

  // 5. Add referrerpolicy="no-referrer" to prevent Cloudflare hotlink blocking
  result = result.replace(IMG_REFERRER_REGEX, '<img referrerpolicy="no-referrer"');

  return result;
}
