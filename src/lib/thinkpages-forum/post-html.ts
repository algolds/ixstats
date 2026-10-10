/**
 * Reading a stored forum post's HTML (pure, no DOM): the attribute values a post can carry are untrusted. The server
 * sanitizes a post when it is written, but any member can write `class="forum-wiki-embed"` with `data-*` values of
 * their choosing in a native post, so every value that drives a lookup or a link is checked again before use.
 */
import { wikiTitleFromArticleUrl } from "~/lib/wiki-os/config";
import { postHref } from "./links";

/** A post id as stored: letters, digits, `_` and `-` (cuids, and the importer's `cnative<n>` ids). */
const POST_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TITLE_MAX = 255;
export const EMBED_WIDTH_MAX = 1200;

export function isPostId(value: string | null | undefined): value is string {
  return typeof value === "string" && POST_ID.test(value);
}

/**
 * A file title from an attribute (`File:Name.ext`): an `embedTitle` that also has no `/`, `\`, `..`, `?`, `#` or `%`,
 * so it can only name a file by its name and never walk a path or add a query when it becomes an image address.
 */
export function embedFileTitle(value: string | null | undefined): string | null {
  const title = embedTitle(value);
  if (title === null || !/^(?:File|Image):\S/i.test(title)) return null;
  return /[/\\?#%]|\.\./.test(title) ? null : title;
}

/** A wiki page or file title from an attribute: no `<`, `>`, `"`, `|`, control characters or line breaks, at most 255. */
export function embedTitle(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim();
  if (title.length === 0 || title.length > TITLE_MAX) return null;
  // oxlint-disable-next-line no-control-regex
  return /[<>"|\u0000-\u001f\u007f]/.test(title) ? null : title;
}

/** An embed's `data-width`: a whole number clamped to 1..1200, `{ width: null }` when absent, null when not a number. */
export function embedWidth(value: string | null | undefined): { width: number | null } | null {
  if (value === null || value === undefined) return { width: null };
  if (!/^\d{1,6}$/.test(value)) return null;
  return { width: Math.min(Math.max(parseInt(value, 10), 1), EMBED_WIDTH_MAX) };
}

// A quote's opening tag, then (after any whitespace) the importer's author line: plain text, since the importer escapes it.
const QUOTE_WITH_AUTHOR =
  /(<blockquote\b[^>]*>)(\s*)<div\b([^>]*\bclass="[^"]*\bforum-quote-author\b[^"]*"[^>]*)>([^<]*)<\/div>/gi;
const DATA_POST = /\sdata-post="([^"]*)"/i;

/**
 * Makes a quote's author line a link to the quoted post when the quote's `data-post` is a valid post id; a quote
 * without one (or with a forged value) stays as written. The link text is the line's own escaped text.
 */
export function linkQuoteSources(html: string): string {
  return html.replace(
    QUOTE_WITH_AUTHOR,
    (match, open: string, space: string, attrs: string, text: string) => {
      const id = DATA_POST.exec(open)?.[1];
      if (!isPostId(id)) return match;
      return `${open}${space}<div${attrs}><a class="forum-quote-source" href="${postHref(id)}">${text}</a></div>`;
    }
  );
}

const ANCHOR_TAG = /<a\b[^>]*>/gi;
const HREF = /\shref="([^"]*)"/i;
const RELATIVE_WIKI = /^\/wiki\/([^#?]+)/;

/** The title a `/wiki/Title` path names, decoded; null for a malformed escape. */
function relativeWikiTitle(path: string): string | null {
  try {
    return decodeURIComponent(path).replace(/_/g, " ");
  } catch {
    return null;
  }
}

function titleOfHref(rawHref: string): string | null {
  const href = rawHref.replace(/&amp;/g, "&");
  const relative = RELATIVE_WIKI.exec(href)?.[1];
  const title = relative ? relativeWikiTitle(relative) : wikiTitleFromArticleUrl(href);
  // Files, categories and other namespaces are not articles.
  return title && !title.includes(":") ? embedTitle(title) : null;
}

/** The article titles the HTML links to on the wiki, first mention first, without repeats. */
export function relatedWikiTitles(html: string, max = 3): string[] {
  const titles: string[] = [];
  for (const tag of html.match(ANCHOR_TAG) ?? []) {
    const href = HREF.exec(tag)?.[1];
    const title = href ? titleOfHref(href) : null;
    if (title && !titles.includes(title)) titles.push(title);
    if (titles.length === max) break;
  }
  return titles;
}
