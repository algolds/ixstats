/**
 * The wikis a card can come from: IxWiki, every sister wiki WikiOS reads (wiki-hosts.ts), and Wikimedia Commons,
 * which has files and no articles. One list for every card schema, label and link, so a sister wiki added to
 * wiki-hosts.ts is a card source too. Client-safe.
 */
import { z } from "zod";
import { commonsFileName } from "~/lib/cards/art-licence";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { titleUrlPath, type WikiSource } from "~/lib/wiki-os/config";
import { SISTER_READER_IDS, SISTER_WIKI_HOSTS } from "~/lib/wiki-os/wiki-hosts";

/** A wiki whose articles become Lore cards: IxWiki and every sister reader wiki, which is what WikiOS reads. */
export type CardArticleSource = WikiSource;
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

export function parseCardWikiSource(value: string | null | undefined): CardWikiSource | null {
  return CARD_WIKI_SOURCES.find((source) => source === value) ?? null;
}

/** A stored article source; null for Commons or anything else (never a fallback to IxWiki). */
export function parseCardArticleSource(value: string | null | undefined): CardArticleSource | null {
  return CARD_ARTICLE_SOURCES.find((source) => source === value) ?? null;
}

export function cardSourceLabel(source: CardWikiSource): string {
  if (source === "ixwiki") return "IxWiki";
  if (source === "commons") return "Wikimedia Commons";
  return SISTER_WIKI_HOSTS[source].name;
}

/** A category's name without the namespace an admin may type ("Category: Elm" is "Elm"). */
export const categoryName = (category: string): string =>
  category.replace(/^\s*category\s*:\s*/i, "").trim();

/** What a source holds, in its noun: Commons holds files, the wikis pages. */
export const sourceNoun = (source: CardWikiSource, count: number): string =>
  `${source === "commons" ? "file" : "page"}${count === 1 ? "" : "s"}`;

/** A count of what a source holds ("1 file", "2,000 pages"). */
export const sourceCount = (source: CardWikiSource, count: number): string =>
  `${count.toLocaleString()} ${sourceNoun(source, count)}`;

/** MediaWiki's own namespaces, which every wiki has, and their talk pages: a title in one is not an article. */
const CORE_NAMESPACE =
  /^(?:media|special|talk|(?:user|project|file|image|mediawiki|template|help|category|module)(?: talk)?)\s*:/i;

/**
 * Whether a page title names an article (the main namespace). IxWiki's namespaces are all known; another wiki's are
 * read as MediaWiki's own (a wiki's project namespace is named after it, so it is not caught).
 */
export function isArticleTitle(source: CardArticleSource, title: string): boolean {
  if (source === "ixwiki") return canonicalizeTitle(title)?.namespaceId === 0;
  return !CORE_NAMESPACE.test(title);
}

/** A Commons page's own address, the attribution link its licences ask for (a file page has no WikiOS reader path). */
export function commonsPageUrl(title: string): string {
  return `${SISTER_WIKI_HOSTS.commons.origin}/wiki/${titleUrlPath(title)}`;
}

/**
 * A Commons card's file page. A legacy Commons card (the old flag importer stored no title) is found by the file its
 * metadata.descriptionUrl, else its art, names; null when neither names a Commons file.
 */
export function commonsCardPageUrl(card: {
  wikiArticleTitle: string | null;
  artwork?: string | null;
  descriptionUrl?: string | null;
}): string | null {
  if (card.wikiArticleTitle) return commonsPageUrl(card.wikiArticleTitle);
  const name = commonsFileName(card.descriptionUrl) ?? commonsFileName(card.artwork);
  return name ? commonsPageUrl(`File:${name}`) : null;
}

/** A file title's namespace as an admin may type it ("File:", "file :", "Image:"). */
const FILE_NAMESPACE = /^\s*(?:file|image)\s*:\s*/i;

/**
 * A page title as cards store it: the form of Phase 1's `canonicalArticleTitle` (the Lore natural key), or null when
 * MediaWiki would refuse the title (`canonicalArticleTitle` falls back to the raw title instead; the importer rejects).
 * Commons holds files only, so its titles always take the `File:` namespace, and the file name's first letter is
 * capitalised as Commons does (other wikis' namespaces are not parsed, so the name after them would stay as typed).
 */
export function canonicalCardTitle(source: CardWikiSource, raw: string): string | null {
  if (source !== "commons") return canonicalizeTitle(raw, { source })?.title ?? null;
  const name = canonicalizeTitle(raw.replace(FILE_NAMESPACE, ""), { source })?.title;
  return name ? `File:${name}` : null;
}
