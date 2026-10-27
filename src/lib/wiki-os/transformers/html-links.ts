// Link rewriting for article HTML (split out of html-transformer.ts): IxWiki links into the WikiOS reader (its
// files and the special pages WikiOS has included; Special:FilePath and the specials it lacks stay on IxWiki), red
// links into its editor, another wiki's links to that wiki's reader or site.
//
// An absolute (or protocol-relative) link to an article on a wiki WikiOS reads opens in the reader too
// (`readerLink`): editors link to sister pages with external links (`[https://iiwiki.com/wiki/X X]`) or the
// `iiwiki:`/`althistory:` interwiki prefixes (runbook 3e), and classic renders both as the same absolute URL. Only
// a plain article link moves (`absoluteReaderTarget`: no query but the title, outside `SITE_NAMESPACE`); any other
// absolute link is left as it is.

import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import {
  getWikiBaseUrl,
  mediaWikiOrigin,
  titleUrlPath,
  type WikiSource,
} from "~/lib/wiki-os/config";
import { absoluteReaderTarget, SITE_NAMESPACE } from "~/lib/wiki-os/wiki-link-target";
import { resolveWikiPath } from "~/lib/wiki-os/wiki-path";
import { forwardFinder } from "../wikitext/forward-finder";
import { isWordCode } from "../wikitext/line-patterns";
import { currentProfileLinks } from "../legacy-profile-links";

const WIKI_LINK_HREF_REGEX = /href="\/wiki\/([^"]*?)"/gu;
const INDEX_PHP_HREF_REGEX = /href="\/index\.php\?([^"]*)"/gu;
const INDEX_PHP_HREF_ONCE_REGEX = /href="\/index\.php\?([^"]*)"/u;
/** MediaWiki's tooltip of a red link: redundant, since the link is red and WikiOS opens the editor. */
const MISSING_PAGE_TITLE_REGEX = /\s+title="[^"]*\(page does not exist\)"/u;
const CLASS_NEW_REGEX = /class="new"/gu;
/** An anchor's double-quoted `href` (its value as written, entities and all), and its `rel`, `target` and `class`. */
const HREF_ATTR_REGEX = /\shref="([^"]*)"/u;
const REL_OR_TARGET_ATTR_REGEX = /\s(?:rel|target)="[^"]*"/gu;
const CLASS_ATTR_REGEX = /\sclass="([^"]*)"/u;
/** The classes classic gives an external or interwiki link: styling (an arrow icon, a number) a reader link has not. */
const EXTERNAL_LINK_CLASSES = new Set(["external", "text", "free", "extiw", "autonumber"]);
/** The character references MediaWiki writes in an attribute value, read in one pass (`&amp;quot;` is `&quot;`). */
const ATTR_REFERENCE_REGEX = /&(?:amp|quot|lt|gt|#0*39|#x0*27);/giu;
const ATTR_REFERENCES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
};

/** An attribute value as the browser reads it, for its `&amp;`, `&quot;`, `&lt;`, `&gt;` and `'` references. */
function decodeAttribute(value: string): string {
  return value.replace(ATTR_REFERENCE_REGEX, (ref) => ATTR_REFERENCES[ref.toLowerCase()] ?? "'");
}
const QUERY_TITLE_REGEX = /(?:^|&(?:amp;)?)title=([^&]*)/u;
const QUERY_UPLOAD_FILE_REGEX = /(?:^|&(?:amp;)?)wpDestFile=([^&]*)/u;
/** `Name?query#fragment` of a `/wiki/` link: the page name, then the wiki's own query (`?action=edit&redlink=1`), then the fragment. */
const WIKI_PATH_REGEX = /^([^?#]*)(?:\?([^#]*))?(#.*)?$/u;
/** A `/wiki/` link to a special page, in any case, its colon escaped or not. */
const SPECIAL_LINK_REGEX = /^special(?::|%3a)/iu;

/** Points an article's links at WikiOS: IxWiki's own pages, or another wiki's through `?source=`. */
export function transformLinks(html: string, basePath: string, wikiSource: WikiSource): string {
  return wikiSource === "ixwiki"
    ? transformIxWikiLinks(html, basePath)
    : transformSourceWikiLinks(html, basePath, wikiSource);
}

/**
 * `html` with each opening anchor tag (`<a`, then not a letter, digit or underscore, and up to the first `>`) replaced by
 * `change(tag)`: what `html.replace(/<a\b[^>]*>/gu, change)` does, with the first `>` after each opener found by one
 * memoized search (a page of `<a href="` that never close is one scan, not one per opener). A `<a` with no `>` after it
 * is no tag, and nor is any later one.
 */
function replaceAnchorTags(html: string, change: (tag: string) => string): string {
  const nextGreater = forwardFinder(html, ">");
  const pieces: string[] = [];
  let copied = 0;
  for (let at = html.indexOf("<a"); at !== -1;) {
    if (isWordCode(html.charCodeAt(at + 2))) {
      at = html.indexOf("<a", at + 2); // `<abbr`
      continue;
    }
    const end = nextGreater(at + 2);
    if (end === -1) break;
    pieces.push(html.slice(copied, at), change(html.slice(at, end + 1)));
    copied = end + 1;
    at = html.indexOf("<a", copied);
  }
  pieces.push(html.slice(copied));
  return pieces.join("");
}

/**
 * Whether the `/wiki/` link path `path` (`Special:Name/arg?query#fragment`, as it stands in the HTML) is a special page
 * WikiOS serves itself: one `resolveWikiPath`, the reader route's own resolver, knows. `Special:FilePath` is not: the
 * file's URL is IxWiki's, so the link goes there directly.
 */
function inAppSpecial(path: string): boolean {
  const [, name = "", query = ""] = WIKI_PATH_REGEX.exec(path) ?? [];
  const params = new URLSearchParams(query.replace(/&amp;/gu, "&"));
  const target = resolveWikiPath(name.split("/"), params);
  return (
    target.kind === "special" &&
    target.action.type !== "unknown" &&
    target.action.type !== "file-path"
  );
}

function transformIxWikiLinks(html: string, basePath: string): string {
  const origin = mediaWikiOrigin();

  // 1. Every /wiki/ link is read in WikiOS (with basePath), files too, except a special page WikiOS does not
  // serve, which would land on its 404: that one opens on IxWiki.
  let result = html.replace(WIKI_LINK_HREF_REGEX, (_match, path: string) =>
    SPECIAL_LINK_REGEX.test(path) && !inAppSpecial(path)
      ? `href="${origin}/wiki/${path}" rel="noreferrer"`
      : `href="${basePath}/wiki/${path}"`
  );

  // 2. A red link opens WikiOS's own editor, as a relative link: not MediaWiki's index.php (about 190 bytes
  // a link, and a trip to the classic wiki). Its tooltip repeats what the red already says.
  result = replaceAnchorTags(result, (tag) => redLinkToWikiOS(tag, basePath));

  // 3. Transform the other index.php links with noreferrer
  result = result.replace(
    INDEX_PHP_HREF_REGEX,
    (_match, query: string) => `href="${origin}/index.php?${query}" rel="noreferrer"`
  );

  // 4. Add wikios-redlink class to links with class="new"
  result = result.replace(CLASS_NEW_REGEX, 'class="new wikios-redlink"');

  // 5. An absolute link to an article on a wiki WikiOS reads opens in the reader
  result = replaceAnchorTags(result, (tag) => readerLink(tag, basePath));

  // 6. Old profile and passport links open the current pages
  return currentProfileLinks(result);
}

/**
 * The opening tag `tag` of an anchor whose `href` (its references decoded) is an absolute link to an article on a wiki
 * WikiOS reads (`absoluteReaderTarget`, outside `SITE_NAMESPACE`), pointed at the reader:
 * `<basePath>/wiki/<title>`, `?source=<wiki>` for a sister wiki, then the fragment. Its `rel` and `target` go, as do
 * the external-link classes (and a `class` left empty). Any other tag is as it was.
 */
function readerLink(tag: string, basePath: string): string {
  const href = HREF_ATTR_REGEX.exec(tag)?.[1];
  const target = href === undefined ? null : absoluteReaderTarget(decodeAttribute(href));
  if (!target || SITE_NAMESPACE.test(target.title)) return tag;
  const source = target.wiki === "ixwiki" ? "" : `?source=${target.wiki}`;
  // The URL parser percent-encodes `"`, `<` and `>` in the fragment, but not `&`, `'` or `$` (so the replacements
  // are functions, never patterns); the attribute is double-quoted, so `'` is safe as it is.
  const path = `${basePath}/wiki/${titleUrlPath(target.title)}${source}${target.fragment.replaceAll("&", "&amp;")}`;
  return tag
    .replace(HREF_ATTR_REGEX, () => ` href="${path}"`)
    .replace(REL_OR_TARGET_ATTR_REGEX, "")
    .replace(CLASS_ATTR_REGEX, (_match, value: string) => {
      const kept = value.split(" ").filter((name) => name && !EXTERNAL_LINK_CLASSES.has(name));
      return kept.length > 0 ? ` class="${kept.join(" ")}"` : "";
    });
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
    const [, name = "", , fragment = ""] = WIKI_PATH_REGEX.exec(path) ?? [];
    return SITE_NAMESPACE.test(name)
      ? `href="${origin}/wiki/${path}" rel="noreferrer"`
      : `href="${basePath}/wiki/${name}?source=${wikiSource}${fragment}"`;
  };
  const relative = html
    .replace(WIKI_LINK_HREF_REGEX, (_match, path: string) => href(path))
    .replace(INDEX_PHP_HREF_REGEX, (_match, query: string) => {
      const page = redLinkPage(query);
      return page ? href(page) : `href="${origin}/index.php?${query}" rel="noreferrer"`;
    });
  // Last, so a reader link it writes (`/wiki/X?source=althistory`) is not read again as this wiki's own.
  return replaceAnchorTags(relative, (tag) => readerLink(tag, basePath));
}
