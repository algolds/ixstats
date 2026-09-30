// src/lib/wiki-os/fix-editor-images.ts
// Transforms relative image URLs in Parsoid HTML to absolute URLs for the
// contentEditable visual editor. Without this, images appear blank because
// relative paths like /images/... resolve against localhost:3000, not ixwiki.com.

import { getWikiBaseUrl, type WikiSource } from "~/lib/wiki-os/config";
import { parseInert } from "./inert-dom";

/** The attribute values that are relative MediaWiki asset paths and need an origin. */
const RELATIVE_SRC = /^\/(?:images\/|data\/|load\.php|wiki\/Special:FilePath\/)/u;
const RELATIVE_SRCSET_URL = /^\/(?:images|data)\//u;
const CSS_URL_REGEX = /url\(["']?(\/(?:images|data|load\.php)[^"')\s]*)["']?\)/gu;
const HREF_LOAD_REGEX = /^\/load\.php/u;

function absoluteSrcset(srcset: string, origin: string): string {
  return srcset
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      return RELATIVE_SRCSET_URL.test(trimmed) ? `${origin}${trimmed}` : trimmed;
    })
    .join(", ");
}

function absoluteCss(css: string, origin: string): string {
  return css.replace(CSS_URL_REGEX, (_match, path: string) => `url("${origin}${path}")`);
}

/**
 * Rewrite relative image/asset URLs in editor HTML to absolute MediaWiki URLs, on the DOM (string
 * surgery on HTML can be made to end inside an attribute value and publish the rest of it as live
 * markup). Preserves all data-mw and Parsoid metadata attributes. Outside a browser the HTML comes
 * back unchanged.
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

  const parsed = parseInert(html);
  if (!parsed) return html;
  const { template, content } = parsed;
  const origin = getWikiBaseUrl(source);

  // 1. src attributes — images, thumbnails, data files
  for (const el of Array.from(content.querySelectorAll("[src]"))) {
    const src = el.getAttribute("src") ?? "";
    if (RELATIVE_SRC.test(src)) el.setAttribute("src", `${origin}${src}`);
  }

  // 2. srcset attributes (responsive images)
  for (const el of Array.from(content.querySelectorAll("[srcset]"))) {
    el.setAttribute("srcset", absoluteSrcset(el.getAttribute("srcset") ?? "", origin));
  }

  // 3. url() references in inline CSS (background-image, etc.)
  for (const el of Array.from(content.querySelectorAll("[style]"))) {
    el.setAttribute("style", absoluteCss(el.getAttribute("style") ?? "", origin));
  }
  for (const style of Array.from(content.querySelectorAll("style"))) {
    style.textContent = absoluteCss(style.textContent ?? "", origin);
  }

  // 4. href for stylesheets (/load.php)
  for (const el of Array.from(content.querySelectorAll("[href]"))) {
    const href = el.getAttribute("href") ?? "";
    if (HREF_LOAD_REGEX.test(href)) el.setAttribute("href", `${origin}${href}`);
  }

  // 5. Add referrerpolicy="no-referrer" to prevent Cloudflare hotlink blocking
  for (const img of Array.from(content.querySelectorAll("img:not([referrerpolicy])"))) {
    img.setAttribute("referrerpolicy", "no-referrer");
  }

  return template.innerHTML;
}
