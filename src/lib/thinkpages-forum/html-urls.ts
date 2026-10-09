/**
 * URLs inside stored post HTML (phase 4). Stored HTML is environment-free: uploads and imported attachments are
 * root-relative (`/images/uploads/…`), so the renderer puts the app's own paths under the deployment's base path.
 * Pure; the caller passes `withBasePath`. A path that already carries the base path matches no app prefix (and
 * withBasePath refuses a double prefix anyway), so rebasing is idempotent.
 */
import { mapHtmlRuns } from "~/lib/action-links";

// One attribute of a tag, its quoted value consumed whole so a match never starts inside another value.
const ATTRIBUTE = /(\s+)([^\s"'>/=]+)(?:(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
const URL_ATTRIBUTES = new Set(["src", "href"]);
/**
 * Root-relative paths the app itself serves under its base path: uploaded and downloaded images, forum and
 * ThinkPages pages (mention links included), API routes, member profiles (`/@handle`) and realms (`/r/…`). Anything
 * else stays as written: notably `/wiki/…`, which opens MediaWiki at the site root.
 */
export const APP_PATH_PREFIXES = [
  "/images/",
  "/forum/",
  "/thinkpages/",
  "/api/",
  "/@",
  "/r/",
] as const;
// An `<img>` tag's double-quoted `src` (the sanitizer and the editor both write double quotes).
const IMAGE_SRC = /<img\b(?:"[^"]*"|'[^']*'|[^>"'])*?\ssrc="([^"]*)"/gi;
const HTTP_URL = /^https?:\/\/[^\s/]/i;
/** Where the app's own images live: uploads, downloaded external images and the MediaWiki media proxy. */
const IMAGE_PATH_PREFIXES = ["/images/uploads/", "/images/downloaded/", "/api/mediawiki/"] as const;

function rebaseAttribute(
  match: string,
  space: string,
  name: string,
  equals: string | undefined,
  value: string | undefined,
  base: (path: string) => string
): string {
  const url = value?.startsWith('"') ? value.slice(1, -1) : null;
  if (url === null || !URL_ATTRIBUTES.has(name.toLowerCase())) return match;
  if (!APP_PATH_PREFIXES.some((prefix) => url.startsWith(prefix))) return match;
  return `${space}${name}${equals}"${base(url)}"`;
}

/** `src` and `href` values under an app prefix, in tags (never in text), rewritten through `base`; others left alone. */
export function rebaseRootRelativeUrls(html: string, base: (path: string) => string): string {
  return mapHtmlRuns(html, {
    markup: (tag) =>
      tag.replace(
        ATTRIBUTE,
        (match, space: string, name: string, equals?: string, value?: string) =>
          rebaseAttribute(match, space, name, equals, value, base)
      ),
  });
}

function isAppImagePath(src: string, basePath: string): boolean {
  const path = basePath && src.startsWith(`${basePath}/`) ? src.slice(basePath.length) : src;
  return IMAGE_PATH_PREFIXES.some(
    (prefix) => path.startsWith(prefix) && path.length > prefix.length
  );
}

/** Whether a `src` shows a real image: an http(s) URL, or an app image path with or without `basePath`. */
function isContentImageSrc(src: string, basePath: string): boolean {
  const url = src.trim();
  return HTTP_URL.test(url) || isAppImagePath(url, basePath);
}

/**
 * Whether the HTML holds an `<img>` that counts as post content: its `src` is an http(s) URL or one of the app's own
 * image paths (`/images/uploads/`, `/images/downloaded/`, `/api/mediawiki/`), bare or under `basePath`. A bare word,
 * a fragment, `data:`, `javascript:` or a protocol-relative URL is not content.
 */
export function hasImageSrc(html: string, basePath: string): boolean {
  for (const match of html.matchAll(IMAGE_SRC)) {
    if (isContentImageSrc(match[1] ?? "", basePath)) return true;
  }
  return false;
}
