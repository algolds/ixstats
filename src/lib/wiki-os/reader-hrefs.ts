// src/lib/wiki-os/reader-hrefs.ts
// The base path on article HTML's app links, at display time. Client-safe; pure apart from reading the base path.

import { getBasePath } from "~/lib/base-path";

/**
 * The rest of a tag after its `<`, quoted values skipped whole, up to and including its `>`. The serializer leaves `<`
 * and `>` raw inside an attribute value, so a scan that stopped at the first `>`, or started at any `<a`, would stop
 * inside a value or start in one. Sticky: it is only ever tried at one tag's `<`.
 */
const TAG_REST = /(?:[^>"]|"[^"]*")*>/y;
/** A link: `<a` and its attributes. `<abbr>`, `<area>` and an `<a>` with no attributes are not. */
const ANCHOR = /^<a\s/i;
/** A root-relative `href`. A double-quoted value cannot hold a literal `"`, so this is always the attribute itself. */
const HREF = /(\shref=")(\/[^"]*)"/i;

/**
 * The app's own routes in article links: what `transformLinks` and `currentProfileLinks` emit. Every other root path
 * (`/index.php`, `/api.php`, `/images/`, `/api/`) is MediaWiki's or a file's, and `//host` or `/\host` never match.
 */
const APP_PATH = /^\/(?:wiki\/|dashboard\/|@)/;

/** Whether `path` already carries the base path: the base path itself, or it followed by `/`, `?` or `#`. */
function underBasePath(path: string, basePath: string): boolean {
  return path === basePath || ["/", "?", "#"].some((next) => path.startsWith(basePath + next));
}

/** `tag` with its `href` under the base path when it is a link to one of the app's own routes, else `tag`. */
function rebaseLink(tag: string, basePath: string): string {
  if (!ANCHOR.test(tag)) return tag;
  return tag.replace(HREF, (match, head: string, path: string) =>
    APP_PATH.test(path) && !underBasePath(path, basePath) ? `${head}${basePath}${path}"` : match
  );
}

/**
 * Article HTML with each root-relative app link (`/wiki/…`, `/dashboard/…`, `/@…`) under the deployment's base path,
 * as a Next `<Link>` would give it. WikiOS stores these links without the base path (stored bundles are shared
 * across environments, and dev has none), and on IxStates's deployment (`/projects/ixstates`) a bare `/wiki/Title`
 * would leave the app for the classic wiki at the site's root. Idempotent: a link already under the base path is
 * left alone. With no base path the HTML is unchanged.
 *
 * The HTML is WikiOS's already-sanitized output, and only an `<a>` tag's `href` value changes, by a fixed rule, so
 * nothing can be let in. Text cannot hold a literal `<` (it is serialized as `&lt;`), so each `<` opens a tag; each
 * tag is read once, from its own `<` to its `>`, and never looked inside again, so the walk is linear. Text that
 * reads `href="/wiki/A"` (a literal `"` is allowed in text) and other elements' attributes are never touched. A tag
 * that never closes (not something the sanitizer writes) ends the walk: the rest is left as it is.
 */
export function withAppHrefs(html: string): string {
  const basePath = getBasePath();
  const parts: string[] = [];
  let copied = 0;
  let open = html.indexOf("<");
  while (open >= 0) {
    TAG_REST.lastIndex = open + 1;
    if (!TAG_REST.test(html)) break;
    const end = TAG_REST.lastIndex;
    const tag = html.slice(open, end);
    const rebased = rebaseLink(tag, basePath);
    if (rebased !== tag) {
      parts.push(html.slice(copied, open), rebased);
      copied = end;
    }
    open = html.indexOf("<", end);
  }
  parts.push(html.slice(copied));
  return parts.join("");
}
