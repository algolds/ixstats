/**
 * Who a lore card credits: the page's creator and its top other contributor, bots left out.
 * Shared by every source of card data (IxWiki's revision ledger, a sister wiki's page history).
 */

import type { CardAuthorInfo } from "~/types/cards-display";

export const BOT_REGEX =
  /^(.*bot|mediawiki default|maintenance script|adminimport|importbot|uploadwizard|system|anonymous)$/i;

/**
 * Clean a wiki username by stripping import prefixes, namespaces, and brackets
 */
export function cleanWikiUsername(username: string | null | undefined): string {
  if (!username) return "";
  let clean = String(username).trim();
  // Strip MediaWiki XML import dump prefixes: "imported>", "Imported>", "import>", "Import>"
  clean = clean.replace(/^(?:imported|import)\s*>\s*/i, "").trim();
  // Strip "User:" or "user:" namespace prefix
  clean = clean.replace(/^user:\s*/i, "").trim();
  // Strip wiki links [[User:Foo|Foo]] or [[Foo]]
  clean = clean.replace(/^\[\[(?:[^|\]]*\|)?([^\]]+)\]\]$/g, "$1").trim();
  // Strip enclosing quotes
  clean = clean.replace(/^["']|["']$/g, "").trim();
  return clean;
}

export interface EarlyRevision {
  author: string | null;
  createdAt: Date;
}

export interface NamedContributor {
  name: string;
  edits: number;
}

interface Creator {
  name: string;
  createdAt: string;
  isBotFiltered: boolean;
}

/**
 * The creator among a page's earliest revisions (oldest first): the first author who is not a bot,
 * else the very first author (a page only bots ever touched is still credited to someone).
 */
function pickCreator(earliest: readonly EarlyRevision[]): Creator | null {
  let isBotFiltered = false;
  for (const revision of earliest) {
    const name = cleanWikiUsername(revision.author);
    if (!name) continue;
    if (BOT_REGEX.test(name)) {
      isBotFiltered = true;
    } else {
      return { name, createdAt: revision.createdAt.toISOString(), isBotFiltered };
    }
  }
  const first = earliest[0];
  const name = cleanWikiUsername(first?.author);
  return first && name
    ? { name, createdAt: first.createdAt.toISOString(), isBotFiltered }
    : null;
}

/** The first contributor (most edits first) who is neither a bot nor `creator`. */
function pickPrimaryContributor(
  contributors: readonly NamedContributor[],
  creator: string
): string | null {
  for (const contributor of contributors) {
    const name = cleanWikiUsername(contributor.name);
    if (name && name.toLowerCase() !== creator.toLowerCase() && !BOT_REGEX.test(name)) return name;
  }
  return null;
}

/**
 * The credit of a card: the creator is the first non-bot author of the page's earliest revisions, the
 * primary contributor the most active other non-bot author. A page whose creator is unknown credits the
 * primary contributor as its creator, and "Unknown" when there is neither.
 */
export function buildCardAuthorInfo(
  earliest: readonly EarlyRevision[],
  contributors: readonly NamedContributor[]
): CardAuthorInfo {
  const found = pickCreator(earliest);
  let creator = found?.name ?? "";
  let primaryContributor = pickPrimaryContributor(contributors, creator);

  // A creator that could not be told is replaced by the top contributor.
  if (!creator && primaryContributor) {
    creator = primaryContributor;
    primaryContributor = null;
  }
  creator ||= "Unknown";

  return {
    creator,
    createdAt: found?.createdAt,
    primaryContributor,
    contributorCount: contributors.length,
    displayAuthor: primaryContributor
      ? `${creator} (Created) • ${primaryContributor} (Top Editor)`
      : creator,
    isBotFiltered: found?.isBotFiltered ?? false,
  };
}
