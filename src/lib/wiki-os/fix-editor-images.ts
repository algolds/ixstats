// src/lib/wiki-os/fix-editor-images.ts
// Transforms relative image URLs in Parsoid HTML to absolute URLs for the
// contentEditable visual editor. Without this, images appear blank because
// relative paths like /images/... resolve against localhost:3000, not ixwiki.com.

const IXWIKI_ORIGIN = "https://ixwiki.com";

/**
 * Rewrite relative image/asset URLs in editor HTML to absolute ixwiki.com URLs.
 * Preserves all data-mw and Parsoid metadata attributes.
 */
export function fixEditorImageUrls(html: string): string {
  let result = html;

  // 1. src attributes — images, thumbnails, data files
  result = result
    .replace(/src="\/images\//g, `src="${IXWIKI_ORIGIN}/images/`)
    .replace(/src="\/data\//g, `src="${IXWIKI_ORIGIN}/data/`)
    .replace(/src="\/load\.php/g, `src="${IXWIKI_ORIGIN}/load.php`)
    .replace(/src="\/wiki\/Special:FilePath\//g, `src="${IXWIKI_ORIGIN}/wiki/Special:FilePath/`);

  // 2. srcset attributes (responsive images)
  result = result.replace(/srcset="([^"]*)"/g, (_match, srcset: string) => {
    const transformed = srcset
      .replace(/\/images\//g, `${IXWIKI_ORIGIN}/images/`)
      .replace(/\/data\//g, `${IXWIKI_ORIGIN}/data/`);
    return `srcset="${transformed}"`;
  });

  // 3. url() references in inline CSS (background-image, etc.)
  result = result.replace(
    /url\(["']?(\/(?:images|data|load\.php)[^"')\s]*)["']?\)/g,
    (_match, path: string) => `url("${IXWIKI_ORIGIN}${path}")`
  );

  // 4. href for stylesheets (/load.php)
  result = result.replace(/href="\/load\.php/g, `href="${IXWIKI_ORIGIN}/load.php`);

  // 5. Add referrerpolicy="no-referrer" to prevent Cloudflare hotlink blocking
  //    Without this, browsers send Referer: http://localhost:3000 triggering 403
  result = result.replace(/<img(?![^>]*referrerpolicy=)/g, '<img referrerpolicy="no-referrer"');

  return result;
}
