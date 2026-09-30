/**
 * redirect.ts — MediaWiki's redirect rule for WikiOS wikitext.
 *
 * A page is a redirect only when its text, after leading whitespace, STARTS with `#REDIRECT`
 * followed by a link (`Title::newFromRedirect`). A `#REDIRECT` later in the text, or inside
 * `<nowiki>`, is ordinary content. The target is an ordinary page title, so it goes through
 * `canonicalizeTitle` like every other title entering storage or a lookup.
 */

import type { ArticleSlug } from "./domain-types";
import { canonicalizeTitle } from "./title";

export interface RedirectTarget {
  /** The canonical title of the page the redirect points to (no fragment). */
  title: string;
  /** `toArticleSlug(title)`. */
  slug: ArticleSlug;
  /** The section the redirect points to, or null. */
  fragment: string | null;
}

/** `#REDIRECT`, an optional ":", then the first `[[...]]`: group 1 is the link text. */
const REDIRECT_LINK = /^\s*#REDIRECT\s*:?\s*\[\[([^\]\n]*)\]\]/i;

/** The redirect target of `wikitext`, or null when the page is not a redirect or the target is invalid. */
export function parseRedirect(wikitext: string | null | undefined): RedirectTarget | null {
  const linkText = REDIRECT_LINK.exec(wikitext ?? "")?.[1];
  if (linkText === undefined) return null;

  const target = linkText.split("|", 1)[0]!.trim().replace(/^:/, "");
  const canon = canonicalizeTitle(target);
  return canon ? { title: canon.title, slug: canon.slug, fragment: canon.fragment } : null;
}
