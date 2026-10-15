import { SISTER_WIKI_HOSTS } from "~/lib/wiki-os/wiki-hosts";
import { wikiReaderPath, wikiTitleFromArticleUrl } from "~/lib/wiki-os/config";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { articleHref } from "~/lib/wiki-os/wiki-path";
import type { CardInstance } from "~/types/cards-display";

type CardWikiSource = "ixwiki" | "iiwiki";

/** The in-app WikiOS article path for a page title; the plain reader path when it is not a canonical title. */
function wikiOsHref(title: string, source: CardWikiSource): string {
  if (source === "iiwiki") return wikiReaderPath(title, "iiwiki");
  const canon = canonicalizeTitle(title.replace(/_/g, " "));
  return canon ? articleHref(canon) : wikiReaderPath(title);
}

/** The title in an `https://iiwiki.com/wiki/<Title>` link, or null for any other URL. */
function iiwikiTitleFromUrl(url: string): string | null {
  try {
    const { origin, pathname } = new URL(url);
    const host = SISTER_WIKI_HOSTS.iiwiki.origin;
    if (origin !== host && origin !== host.replace("://", "://www.")) return null;
    const segment = /^\/wiki\/(.+)$/.exec(pathname)?.[1];
    return segment ? decodeURIComponent(segment).replace(/_/g, " ") : null;
  } catch {
    return null;
  }
}

/**
 * Where a card's wiki article lives: always an in-app WikiOS path, for IxWiki and IIWiki alike (an IIWiki article
 * opens in WikiOS's reader with `?source=iiwiki`). The title wins over a stored URL, which older lore cards got wrong
 * (`/w/<title>`); a stored URL is only read when the card has no title, and kept as it is when it names no article.
 */
export function cardWikiHref(card: CardInstance | null): string | null {
  if (!card) return null;
  const source: CardWikiSource = card.wikiSource === "iiwiki" ? "iiwiki" : "ixwiki";
  const url = card.wikiUrl;
  if (url?.startsWith("/wiki/")) return url;
  if (card.wikiArticleTitle) return wikiOsHref(card.wikiArticleTitle, source);
  if (!url) return null;
  const title = source === "iiwiki" ? iiwikiTitleFromUrl(url) : wikiTitleFromArticleUrl(url);
  return title ? wikiOsHref(title, source) : url;
}
