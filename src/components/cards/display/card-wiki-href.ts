import { SISTER_WIKI_HOSTS } from "~/lib/wiki-os/wiki-hosts";
import { wikiReaderPath, wikiTitleFromArticleUrl } from "~/lib/wiki-os/config";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { articleHref } from "~/lib/wiki-os/wiki-path";
import {
  commonsPageUrl,
  parseCardWikiSource,
  type CardArticleSource,
} from "~/lib/cards/card-sources";
import type { CardInstance } from "~/types/cards-display";

/** The in-app WikiOS article path for a page title; the plain reader path when it is not a canonical title. */
function wikiOsHref(title: string, source: CardArticleSource): string {
  if (source !== "ixwiki") return wikiReaderPath(title, source);
  const canon = canonicalizeTitle(title.replace(/_/g, " "));
  return canon ? articleHref(canon) : wikiReaderPath(title);
}

/** The title in a sister wiki's `<origin>/wiki/<Title>` link (with or without `www.`), or null for any other URL. */
function sisterTitleFromUrl(
  url: string,
  source: Exclude<CardArticleSource, "ixwiki">
): string | null {
  try {
    const { origin, pathname } = new URL(url);
    const host = SISTER_WIKI_HOSTS[source].origin;
    if (origin !== host && origin !== host.replace("://", "://www.")) return null;
    const segment = /^\/wiki\/(.+)$/.exec(pathname)?.[1];
    return segment ? decodeURIComponent(segment).replace(/_/g, " ") : null;
  } catch {
    return null;
  }
}

/**
 * Where a card's wiki article lives: always an in-app WikiOS path, for every source wiki (a sister wiki's article
 * opens in WikiOS's reader with `?source=`), except a Commons file, which has no reader page and links to Commons. The title wins over a stored URL, which older lore cards got wrong
 * (`/w/<title>`); a stored URL is only read when the card has no title, and kept as it is when it names no article.
 */
export function cardWikiHref(card: CardInstance | null): string | null {
  if (!card) return null;
  const source = parseCardWikiSource(card.wikiSource) ?? "ixwiki";
  const url = card.wikiUrl;
  if (source === "commons")
    return card.wikiArticleTitle ? commonsPageUrl(card.wikiArticleTitle) : (url ?? null);
  if (url?.startsWith("/wiki/")) return url;
  if (card.wikiArticleTitle) return wikiOsHref(card.wikiArticleTitle, source);
  if (!url) return null;
  const title =
    source === "ixwiki" ? wikiTitleFromArticleUrl(url) : sisterTitleFromUrl(url, source);
  return title ? wikiOsHref(title, source) : url;
}
