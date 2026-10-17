/**
 * The wikis a card can come from: IxWiki, every sister wiki WikiOS reads (wiki-hosts.ts), and Wikimedia Commons,
 * which has files and no articles. One list for every card schema, label and link, so a sister wiki added to
 * wiki-hosts.ts is a card source too. Client-safe.
 */
import { z } from "zod";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import {
  SISTER_READER_IDS,
  SISTER_WIKI_HOSTS,
  type SisterReaderId,
} from "~/lib/wiki-os/wiki-hosts";

/** A wiki whose articles become Lore cards. */
export type CardArticleSource = "ixwiki" | SisterReaderId;
/** Any card source wiki: the article wikis and Commons. */
export type CardWikiSource = CardArticleSource | "commons";

export const CARD_ARTICLE_SOURCES: readonly [CardArticleSource, ...CardArticleSource[]] = [
  "ixwiki",
  ...SISTER_READER_IDS,
];
export const CARD_WIKI_SOURCES: readonly [CardWikiSource, ...CardWikiSource[]] = [
  ...CARD_ARTICLE_SOURCES,
  "commons",
];

export const cardArticleSourceSchema = z.enum(CARD_ARTICLE_SOURCES);
export const cardWikiSourceSchema = z.enum(CARD_WIKI_SOURCES);

export function parseCardArticleSource(value: string | null | undefined): CardArticleSource | null {
  return CARD_ARTICLE_SOURCES.find((source) => source === value) ?? null;
}

export function parseCardWikiSource(value: string | null | undefined): CardWikiSource | null {
  return CARD_WIKI_SOURCES.find((source) => source === value) ?? null;
}

export function cardSourceLabel(source: CardWikiSource): string {
  if (source === "ixwiki") return "IxWiki";
  if (source === "commons") return "Wikimedia Commons";
  return SISTER_WIKI_HOSTS[source].name;
}

/**
 * A page title as cards store it: the form of Phase 1's `canonicalArticleTitle` (the Lore natural key), or null when
 * MediaWiki would refuse the title (`canonicalArticleTitle` falls back to the raw title instead; the importer rejects).
 */
export function canonicalCardTitle(source: CardWikiSource, raw: string): string | null {
  return canonicalizeTitle(raw, { source })?.title ?? null;
}
