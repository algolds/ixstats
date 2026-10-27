/**
 * Where wiki links land: a source's link may name a redirect ("Salvia" -> "Sanctum Imperium Catholicum"), and only
 * the target can be one of the realm's indexed pages. Titles go 50 to a request (the API's limit).
 */
import { z } from "zod";
import type { WikiQuery } from "~/lib/realms/lore-import";

const BATCH = 50;

const Hop = z.object({ from: z.string(), to: z.string() });
const Answer = z.object({
  query: z
    .object({ normalized: z.array(Hop).optional(), redirects: z.array(Hop).optional() })
    .optional(),
});

/** Each title that redirects, mapped to the page it lands on (through normalization and redirect chains). */
export async function resolveWikiRedirects(
  query: WikiQuery,
  titles: readonly string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = [...new Set(titles)];
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const answer = await query({ titles: batch.join("|"), redirects: "1" }, Answer);
    const hops = new Map<string, string>();
    for (const h of [...(answer.query?.normalized ?? []), ...(answer.query?.redirects ?? [])])
      hops.set(h.from, h.to);
    for (const title of batch) {
      let at = title;
      for (let n = 0; n < 5 && hops.has(at); n++) at = hops.get(at)!;
      if (at !== title && answer.query?.redirects?.some((r) => r.to === at)) out[title] = at;
    }
  }
  return out;
}
