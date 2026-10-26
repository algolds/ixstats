// src/lib/wiki-os/wiki-outage.ts
// A wiki read that failed because the wiki could not answer, as the client sees it. Pure and client-safe: it reads a
// tRPC error's code and imports only `config.ts`'s wiki names.

import { WIKI_SOURCES, type WikiSource } from "./config";

/**
 * Whether a failed wiki read was an outage, not an answer: the wiki could not be reached (SERVICE_UNAVAILABLE) or
 * it, or our limiter, said busy (TOO_MANY_REQUESTS). An outage says nothing about whether a page exists.
 */
export function isWikiOutage(
  error: { data?: { code?: string } | null } | null | undefined
): boolean {
  const code = error?.data?.code;
  return code === "SERVICE_UNAVAILABLE" || code === "TOO_MANY_REQUESTS";
}

/** "<Wiki> could not be reached just now." */
export function unreachableText(source: WikiSource): string {
  return `${WIKI_SOURCES[source].name} could not be reached just now.`;
}
