/**
 * redirect.ts — MediaWiki's redirect rule for WikiOS wikitext.
 *
 * A page is a redirect only when its text, after leading whitespace, STARTS with `#REDIRECT`
 * followed by a link (`WikitextContentHandler::getRedirectTargetAndText`). A `#REDIRECT` later in
 * the text, or inside `<nowiki>`, is ordinary content. The target is an ordinary page title, so it
 * goes through `canonicalizeTitle` like every other title entering storage or a lookup.
 *
 * Every step is linear in the text length: the head is an anchored regex with no nested
 * quantifiers, and the link is scanned by hand. Page text is user-controlled and up to 2 MB.
 */

import type { ArticleSlug } from "./domain-types";
import { canonicalizeTitle, decodeTitleParam } from "./title";

export interface RedirectTarget {
  /** The canonical title of the page the redirect points to (no fragment). */
  title: string;
  /** `toArticleSlug(title)`. */
  slug: ArticleSlug;
  /** The section the redirect points to, or null. */
  fragment: string | null;
}

/**
 * `#REDIRECT`, an optional ":", then the opening `[[`. Whitespace is ASCII only: MediaWiki's
 * `ltrim` does not strip a no-break space or a BOM, so text starting with one is not a redirect.
 */
const REDIRECT_HEAD = /^[ \t\r\n]*#REDIRECT[ \t\r\n]*(?::[ \t\r\n]*)?\[\[/i;

/**
 * The link target that starts at `from` (just after `[[`): it ends at the first "|" or "]]", and
 * the link must close with "]]" on the same line (`[[Foo|la]bel]]` is Foo). Null when it never
 * closes or a newline comes first.
 */
function readLinkTarget(text: string, from: number): string | null {
  let targetEnd = -1;
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    if (char === "\n") return null;
    if (char === "|" && targetEnd === -1) targetEnd = i;
    if (char === "]" && text[i + 1] === "]") {
      return text.slice(from, targetEnd === -1 ? i : targetEnd);
    }
  }
  return null;
}

/** The redirect target of `wikitext`, or null when the page is not a redirect or the target is invalid. */
export function parseRedirect(wikitext: string | null | undefined): RedirectTarget | null {
  const text = wikitext ?? "";
  const head = REDIRECT_HEAD.exec(text);
  if (!head) return null;

  const linkText = readLinkTarget(text, head[0].length);
  if (linkText === null) return null;

  // MediaWiki rawurldecodes a target that has a "%" (fragment included); a bad escape stays raw,
  // which canonicalizeTitle then refuses.
  const target = decodeTitleParam(linkText.trim()).trim().replace(/^:/, "");
  const canon = canonicalizeTitle(target);
  return canon ? { title: canon.title, slug: canon.slug, fragment: canon.fragment } : null;
}
