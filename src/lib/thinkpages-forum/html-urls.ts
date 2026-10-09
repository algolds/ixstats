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
const IMAGE_WITH_SRC =
  /<img\b(?:"[^"]*"|'[^']*'|[^>"'])*?\ssrc="\s*(?!(?:data|javascript|vbscript):)[^"\s]/i;

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

/** Whether the HTML holds an `<img>` with a non-empty `src` that is not a `data:`, `javascript:` or `vbscript:` URL (the sanitizer blanks those; an image counts as post content). */
export const hasImageSrc = (html: string) => IMAGE_WITH_SRC.test(html);
