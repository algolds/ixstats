/**
 * Which nation of the realm an imported region is: names from a colour key, an SVG title or id, or a GeoJSON
 * property, checked against the realm's nations (its countries and its roster pages). An exact match (case-,
 * accent- and punctuation-blind) is taken; anything else gets ranked suggestions for the admin, never a guess.
 * Pure, client-safe.
 */
import { normalizeNationName } from "~/lib/realms/sources/matching";

export interface NationCandidate {
  name: string;
  /** The realm's country of that name, when one exists (a roster page alone has none). */
  countryId?: string;
}

export interface NationSuggestion {
  name: string;
  score: number;
}

function bigrams(text: string): Map<string, number> {
  const grams = new Map<string, number>();
  const padded = ` ${text} `;
  for (let i = 0; i < padded.length - 1; i++) {
    const gram = padded.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

/** Sørensen–Dice similarity of two normalised names (0 to 1), with a bonus when one contains the other. */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeNationName(a);
  const y = normalizeNationName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const gx = bigrams(x);
  const gy = bigrams(y);
  let overlap = 0;
  for (const [gram, count] of gx) overlap += Math.min(count, gy.get(gram) ?? 0);
  const total = [...gx.values(), ...gy.values()].reduce((s, n) => s + n, 0);
  const dice = total ? (2 * overlap) / total : 0;
  const contains = x.includes(y) || y.includes(x) ? 0.15 : 0;
  return Math.min(0.99, dice + contains);
}

/** The best few nations for `value`, most similar first (only those at or above `minScore`). */
export function suggestNations(
  value: string,
  candidates: readonly NationCandidate[],
  limit = 3,
  minScore = 0.45
): NationSuggestion[] {
  return candidates
    .map((c) => ({ name: c.name, score: nameSimilarity(value, c.name) }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type NationNameCheck =
  | { status: "matched"; name: string; countryId?: string }
  | { status: "new"; suggestions: NationSuggestion[] }
  | { status: "empty" };

/**
 * Check one assigned name against the realm: "matched" when its normalised form is exactly one candidate's
 * (the candidate's spelling is returned), else "new" with suggestions (an unknown name is allowed: the region is
 * imported under it and a nation claimed later by that name takes it).
 */
export function checkNationName(
  value: string | null | undefined,
  candidates: readonly NationCandidate[]
): NationNameCheck {
  const key = normalizeNationName(value);
  if (!key) return { status: "empty" };
  const exact = candidates.filter((c) => normalizeNationName(c.name) === key);
  const withCountry = exact.find((c) => c.countryId) ?? exact[0];
  if (withCountry) return { status: "matched", name: withCountry.name, countryId: withCountry.countryId };
  return { status: "new", suggestions: suggestNations(value!, candidates) };
}

/** Auto-match each source name to a nation by exact normalised name; unmatched names map to null. */
export function autoMatchNations(
  values: readonly string[],
  candidates: readonly NationCandidate[]
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const value of values) {
    const check = checkNationName(value, candidates);
    out[value] = check.status === "matched" ? check.name : null;
  }
  return out;
}
