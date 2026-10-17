/**
 * The MediaWiki side of the lore-card generator: the action API query helper and the page-history
 * author pickers (a sister wiki's pages; IxWiki's are read from Postgres, lore-card-ixwiki.ts).
 */

import type { CardAuthorInfo } from "~/types/cards-display";
import type { WikiSource } from "~/lib/wiki-os/config";
import { getMediaWikiApiUrl, getWikiUserAgent } from "~/lib/wiki-os/config";
import type { MediaWikiPageItem } from "~/lib/wiki-os/types";
import {
  DiscoveryStopped,
  type DiscoveryStop,
  type DiscoveryStopKind,
} from "~/lib/realms/sources/wiki-discovery-client";
import { cardSourceLabel, type CardWikiSource } from "~/lib/cards/card-sources";
import { BOT_REGEX, cleanWikiUsername } from "./lore-card-author-info";

export type MwPage = MediaWikiPageItem & { original?: { source?: string }; pageimage?: string };
export type RevisionUser = { user: string; timestamp: string };

/** GET against the wiki's MediaWiki action API (`action=query`, JSON), optionally time-limited. */
export function mwQuery(
  wikiSource: WikiSource,
  params: Record<string, string>,
  timeoutMs?: number
) {
  const url = new URL(getMediaWikiApiUrl(wikiSource));
  for (const [key, value] of Object.entries({ action: "query", format: "json", ...params })) {
    url.searchParams.set(key, value);
  }
  return fetch(url.toString(), {
    headers: { "User-Agent": getWikiUserAgent(wikiSource) },
    ...(timeoutMs && { signal: AbortSignal.timeout(timeoutMs) }),
  });
}

/** An API error, as any action answers it. */
export interface MwError {
  error?: { code?: string; info?: string };
}

/** An `action=query` answer: its pages, its backlinks, or the API's error. */
export interface MwQueryResponse extends MwError {
  query?: { pages?: Record<string, MwPage>; backlinks?: Array<{ title: string }> };
}

/** The HTTP answers that mean the wiki will not serve this run: a refusal, and a rate limit. */
const STOPPING_STATUSES = new Map<number, DiscoveryStopKind>([
  [403, "blocked"],
  [429, "rate-limited"],
]);

/** What a wiki that stopped answering did, for people: the wiki's label once, in sentence case. */
export function stoppedWikiMessage(
  source: CardWikiSource,
  stop: Pick<DiscoveryStop, "kind" | "status">
): string {
  const label = cardSourceLabel(source);
  if (stop.status !== null && stop.status >= 400) {
    return `${label} stopped answering (HTTP ${stop.status}).`;
  }
  if (stop.kind !== "blocked") return `${label} stopped answering.`;
  // A refusal with no HTTP error is the API's `readapidenied`; one with an OK status is a challenge page.
  return stop.status === null
    ? `${label} does not allow reading its pages.`
    : `${label} answered with a web page instead of data.`;
}

function stopped(source: WikiSource, kind: DiscoveryStopKind, status: number | null): never {
  throw new DiscoveryStopped({
    kind,
    status,
    message: stoppedWikiMessage(source, { kind, status }),
  });
}

/**
 * The JSON of a wiki's answer, as `T` (an `action=query` answer unless the caller names its own shape). A refusal
 * (HTTP 403, or the API's `readapidenied`), a rate limit (HTTP 429), or an answer that is not data (a Cloudflare
 * challenge page) means the wiki will not serve this run: DiscoveryStopped. Any other HTTP error, or another API
 * error, throws. An error answer's body is let go unread.
 */
export async function mwJson<T extends MwError = MwQueryResponse>(
  response: Response,
  wikiSource: WikiSource
): Promise<T> {
  const label = cardSourceLabel(wikiSource);
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    const kind = STOPPING_STATUSES.get(response.status);
    if (kind) stopped(wikiSource, kind, response.status);
    throw new Error(`${label} answered HTTP ${response.status}.`);
  }
  const body = await response.text();
  let data: T;
  try {
    data = JSON.parse(body) as T;
  } catch {
    return stopped(wikiSource, "blocked", response.status);
  }
  if (data.error?.code === "readapidenied") stopped(wikiSource, "blocked", null);
  if (data.error) {
    throw new Error(`${label} answered with an error: ${data.error.info ?? data.error.code}`);
  }
  return data;
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
