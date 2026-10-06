/**
 * The MediaWiki side of the lore-card generator: the action API query helper and the page-history
 * author pickers (a sister wiki's pages; IxWiki's are read from Postgres, lore-card-ixwiki.ts), and the
 * per-category stat weights.
 */

import type { CardAuthorInfo } from "~/types/cards-display";
import type { WikiSource } from "~/lib/wiki-os/config";
import { getMediaWikiApiUrl, getWikiUserAgent } from "~/lib/wiki-os/config";
import type { MediaWikiPageItem } from "~/lib/wiki-os/types";
import { LoreCategory } from "./category-enums";
import { BOT_REGEX, cleanWikiUsername } from "./lore-card-author-info";

/**
 * Category-based stat weights for lore cards.
 * Each category emphasizes different stats based on thematic relevance.
 */
export const CATEGORY_STAT_WEIGHTS: Record<
  string,
  { economic: number; diplomatic: number; military: number; social: number }
> = {
  [LoreCategory.PEOPLE]: { economic: 0.15, diplomatic: 0.4, military: 0.15, social: 0.3 },
  [LoreCategory.GEOGRAPHY]: { economic: 0.4, diplomatic: 0.2, military: 0.15, social: 0.25 },
  [LoreCategory.MILITARY]: { economic: 0.1, diplomatic: 0.2, military: 0.55, social: 0.15 },
  [LoreCategory.DIPLOMACY]: { economic: 0.2, diplomatic: 0.5, military: 0.1, social: 0.2 },
  [LoreCategory.GOVERNMENT]: { economic: 0.25, diplomatic: 0.35, military: 0.15, social: 0.25 },
  [LoreCategory.ECONOMY]: { economic: 0.55, diplomatic: 0.2, military: 0.1, social: 0.15 },
  [LoreCategory.SCIENCE]: { economic: 0.35, diplomatic: 0.15, military: 0.2, social: 0.3 },
  [LoreCategory.RELIGION]: { economic: 0.1, diplomatic: 0.25, military: 0.15, social: 0.5 },
  [LoreCategory.CULTURE]: { economic: 0.15, diplomatic: 0.25, military: 0.1, social: 0.5 },
  [LoreCategory.HISTORY]: { economic: 0.25, diplomatic: 0.25, military: 0.25, social: 0.25 },
  [LoreCategory.NATION]: { economic: 0.3, diplomatic: 0.3, military: 0.2, social: 0.2 },
  [LoreCategory.SPECIAL]: { economic: 0.25, diplomatic: 0.25, military: 0.25, social: 0.25 },
  default: { economic: 0.25, diplomatic: 0.25, military: 0.25, social: 0.25 },
};

export type MwPage = MediaWikiPageItem & { original?: { source?: string } };
export type RevisionUser = { user: string; timestamp: string };

/** GET against the wiki's MediaWiki action API (`action=query`, JSON), optionally time-limited. */
export function mwQuery(wikiSource: WikiSource, params: Record<string, string>, timeoutMs?: number) {
  const url = new URL(getMediaWikiApiUrl(wikiSource));
  for (const [key, value] of Object.entries({ action: "query", format: "json", ...params })) {
    url.searchParams.set(key, value);
  }
  return fetch(url.toString(), {
    headers: { "User-Agent": getWikiUserAgent(wikiSource) },
    ...(timeoutMs && { signal: AbortSignal.timeout(timeoutMs) }),
  });
}

/** The first page of an `action=query` response's `pages` map. */
export const firstPage = <T = MwPage>(data: any): T | undefined =>
  Object.values(data.query?.pages ?? {})[0] as T | undefined;

/** The earliest non-bot editor of a revision list (flagging when a bot was skipped). */
export function pickCreator(revs: RevisionUser[]) {
  let isBotFiltered = false;
  for (const r of revs) {
    const user = cleanWikiUsername(r.user);
    if (!user) continue;
    if (!BOT_REGEX.test(user)) return { creator: user, createdAt: r.timestamp, isBotFiltered };
    isBotFiltered = true;
  }
  return { creator: "", createdAt: "", isBotFiltered };
}

/** Creator + top editor (the first non-bot contributor who is not the creator), as card author info. */
export function buildAuthorInfo(
  found: { creator: string; createdAt: string; isBotFiltered: boolean },
  contributors: Array<{ name: string }>
): CardAuthorInfo {
  let { creator } = found;
  let primaryContributor: string | null = null;
  for (const c of contributors) {
    const user = cleanWikiUsername(c.name);
    if (
      user &&
      (!creator || user.toLowerCase() !== creator.toLowerCase()) &&
      !BOT_REGEX.test(user)
    ) {
      primaryContributor = user;
      break;
    }
  }
  // No usable creator: the top contributor takes the credit
  if (!creator && primaryContributor) {
    creator = primaryContributor;
    primaryContributor = null;
  }
  creator ||= "Unknown";

  return {
    creator,
    createdAt: found.createdAt || undefined,
    primaryContributor,
    contributorCount: contributors.length,
    displayAuthor: primaryContributor
      ? `${creator} (Created) • ${primaryContributor} (Top Editor)`
      : creator,
    isBotFiltered: found.isBotFiltered,
  };
}
