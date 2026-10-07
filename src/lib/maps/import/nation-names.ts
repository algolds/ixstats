/**
 * Which nation of the realm an imported region is: names from a colour key, an SVG title or id, or a GeoJSON
 * property, checked against the realm's nations (its countries and its roster pages) with the world editor's
 * name matcher (src/lib/maps/nation-name-matching.ts: case, accents, punctuation, "The" and state forms such as
 * "Republic of"). A confident match is taken; anything else gets ranked suggestions for the admin, never a guess.
 * Pure, client-safe.
 */
import {
  AUTO_LINK_MIN_CONFIDENCE,
  coreName,
  nameSimilarity,
  normalizeName,
  suggestRegionMatches,
} from "~/lib/maps/nation-name-matching";

export interface NationCandidate {
  name: string;
  /** The realm's country of that name, when one exists (a roster page alone has none). */
  countryId?: string;
}

export interface NationSuggestion {
  name: string;
  score: number;
}

/** Suggestions below this spelling similarity are not offered. */
const MIN_SUGGESTION = 0.6;

const similarity = (a: string, b: string) =>
  Math.max(nameSimilarity(normalizeName(a), normalizeName(b)), nameSimilarity(coreName(a), coreName(b)));

/** The best few nations for `value`, most similar first. */
export function suggestNations(
  value: string,
  candidates: readonly NationCandidate[],
  limit = 3
): NationSuggestion[] {
  return candidates
    .map((c) => ({ name: c.name, score: Math.round(similarity(value, c.name) * 100) / 100 }))
    .filter((s) => s.score >= MIN_SUGGESTION)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type NationNameCheck =
  | { status: "matched"; name: string; countryId?: string }
  | { status: "new"; suggestions: NationSuggestion[] }
  | { status: "empty" };

/**
 * Check one assigned name against the realm: "matched" when the matcher is confident (the same name once
 * normalised, or once a state form is dropped), with the nation's own spelling; otherwise "new" with suggestions
 * (an unknown name is allowed: the region is imported under it and a nation claimed later by that name takes it).
 */
export function checkNationName(
  value: string | null | undefined,
  candidates: readonly NationCandidate[]
): NationNameCheck {
  const name = value?.trim();
  if (!name || !normalizeName(name)) return { status: "empty" };
  // A country wins over a roster page of the same name.
  const nations = [...candidates]
    .sort((a, b) => Number(!!b.countryId) - Number(!!a.countryId))
    .filter((c, i, all) => all.findIndex((o) => normalizeName(o.name) === normalizeName(c.name)) === i)
    .map((c) => ({ id: c.countryId ?? `page:${c.name}`, name: c.name }));
  const [best] = suggestRegionMatches([{ featureId: name, displayName: name }], nations);
  if (best && best.confidence >= AUTO_LINK_MIN_CONFIDENCE) {
    return {
      status: "matched",
      name: best.countryName,
      ...(best.countryId.startsWith("page:") ? {} : { countryId: best.countryId }),
    };
  }
  return { status: "new", suggestions: suggestNations(name, candidates) };
}

/** Auto-match each source name to a nation; names the matcher is not confident about map to null. */
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
