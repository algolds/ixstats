/**
 * Which wiki articles may picture each Factbook block (owner rulings, 2026-11-09). Only the
 * country's own domain articles count, matched by exact title, then the pages they name with
 * {{Main}}; Economy also takes the capital and the largest city. No title-keyword guessing: that
 * is what once put a football league on Foreign affairs. Military pages never qualify.
 */

export type CoverBlock = "economy" | "state" | "foreign";

export interface CoverTopics {
  capital?: string | null;
  largestCity?: string | null;
  legislature?: string | null;
}

/** Military pages are excluded everywhere (ruling: no military under Foreign affairs). */
const MILITARY = /\b(armed forces|military|army|navy|air force|marines?)\b/i;

/** Each block's own domain articles, in priority order. */
export function coverDomainTitles(
  name: string,
  legislature?: string | null
): Record<CoverBlock, string[]> {
  const leg = legislature?.trim();
  return {
    economy: [`Economy of ${name}`],
    state: [`Government of ${name}`, ...(leg ? [leg] : []), `Politics of ${name}`],
    foreign: [`Foreign relations of ${name}`],
  };
}

/**
 * The full qualifying title list per block: the domain articles, then the {{Main}} pages each of
 * them names (in that order), then for Economy the capital and the largest city. `mains` is keyed
 * by lowercase domain title. Duplicates (case-insensitive) and military pages are dropped.
 */
export function coverTitleOrder(
  name: string,
  topics: CoverTopics,
  mains: ReadonlyMap<string, readonly string[]>
): Record<CoverBlock, string[]> {
  const domain = coverDomainTitles(name, topics.legislature);
  const expand = (titles: string[], extras: (string | null | undefined)[] = []) => {
    const seen = new Set<string>();
    const all = [...titles, ...titles.flatMap((t) => mains.get(t.toLowerCase()) ?? []), ...extras];
    return all.flatMap((raw) => {
      const title = raw?.trim();
      const key = title?.toLowerCase();
      if (!title || !key || seen.has(key) || MILITARY.test(title)) return [];
      seen.add(key);
      return [title];
    });
  };
  return {
    economy: expand(domain.economy, [topics.capital, topics.largestCity]),
    state: expand(domain.state),
    foreign: expand(domain.foreign),
  };
}

const MAIN_TEMPLATE_RE = /\{\{\s*(?:main|see also|further|details|main article)\s*\|([^{}]+)\}\}/gi;

/** Titles named by `{{main|…}}`, `{{see also|…}}` and similar hatnotes, without anchors. */
export function extractMainTitles(wikitext: string | null | undefined): string[] {
  if (!wikitext) return [];
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const match of wikitext.matchAll(MAIN_TEMPLATE_RE)) {
    for (const arg of match[1]?.split("|") ?? []) {
      if (arg.includes("=")) continue;
      const title = arg.split("#")[0]?.replace(/_/g, " ").trim();
      if (title && !seen.has(title.toLowerCase())) {
        seen.add(title.toLowerCase());
        titles.push(title);
      }
    }
  }
  return titles;
}

/** A lead image URL, or null when it is empty or an unexpanded template. */
export function cleanLeadImage(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed || trimmed.includes("{{") || trimmed.toLowerCase().includes("%7b%7b")) return null;
  return trimmed;
}
