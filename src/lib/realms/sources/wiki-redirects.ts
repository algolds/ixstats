/**
 * Where wiki links land: a source's link may name a redirect ("Salvia" -> "Sanctum Imperium Catholicum"), and only
 * the target can be one of the realm's indexed pages. Titles go 50 to a request (the API's limit).
 */
import { z } from "zod";
import { Cache } from "~/lib/cache";
import type { WikiQuery } from "~/lib/realms/lore-import";

const BATCH = 50;
const REDIRECT_CACHE_TTL_MS = 60 * 60 * 1000;
const redirectCache = new Cache<{ target: string | null }>({ defaultTtlMs: REDIRECT_CACHE_TTL_MS });

const Hop = z.object({ from: z.string(), to: z.string() });
const Answer = z.object({
  query: z
    .object({ normalized: z.array(Hop).optional(), redirects: z.array(Hop).optional() })
    .optional(),
});

/** Each title that redirects, mapped to the page it lands on (through normalization and redirect chains). */
export async function resolveWikiRedirects(
  query: WikiQuery,
  titles: readonly string[],
  cacheScope?: string
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = [...new Set(titles)];
  const uncached: string[] = [];
  for (const title of unique) {
    if (cacheScope) {
      const cached = redirectCache.get(`${cacheScope}:${title}`);
      if (cached) {
        if (cached.target) out[title] = cached.target;
        continue;
      }
    }
    uncached.push(title);
  }
  for (let i = 0; i < uncached.length; i += BATCH) {
    const batch = uncached.slice(i, i + BATCH);
    const answer = await query({ titles: batch.join("|"), redirects: "1" }, Answer);
    const hops = new Map<string, string>();
    for (const h of [...(answer.query?.normalized ?? []), ...(answer.query?.redirects ?? [])])
      hops.set(h.from, h.to);
    for (const title of batch) {
      let at = title;
      for (let n = 0; n < 5 && hops.has(at); n++) at = hops.get(at)!;
      const redirected =
        at !== title && answer.query?.redirects?.some((r) => r.to === at) ? at : null;
      if (redirected) out[title] = redirected;
      if (cacheScope) {
        redirectCache.set(`${cacheScope}:${title}`, { target: redirected }, REDIRECT_CACHE_TTL_MS);
      }
    }
  }
  return out;
}
