// Link rewriting for article HTML (split out of html-transformer.ts): IxWiki links into the WikiOS reader, red
// links into its editor, another wiki's links to that wiki's reader or site.

import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { getWikiBaseUrl, mediaWikiOrigin, type WikiSource } from "~/lib/wiki-os/config";
import { forwardFinder } from "../wikitext/forward-finder";
import { isWordCode } from "../wikitext/line-patterns";

const WIKI_LINK_HREF_REGEX = /href="\/wiki\/([^"]*?)"/gu;
const INDEX_PHP_HREF_REGEX = /href="\/index\.php\?([^"]*)"/gu;
const INDEX_PHP_HREF_ONCE_REGEX = /href="\/index\.php\?([^"]*)"/u;
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
  result = replaceAnchorTags(result, (tag) => redLinkToWikiOS(tag, basePath));

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
