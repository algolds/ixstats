/**
 * Matching a map's regions to a realm's nations by name, for the world editor's Auto-Match. Names are compared
 * after normalising case, accents, hyphens, underscores and punctuation, a leading "The", and state-form prefixes
 * ("Republic of", "Kingdom of"…), against each nation's name, wiki page title, source key and the roster's
 * nation page titles that name it. Close spellings are suggested with a lower confidence for review. Pure,
 * client-safe.
 */

/** State forms dropped from the front of a name ("Republic of Gallambria" → "gallambria"), longest first. */
const STATE_FORM_PREFIXES = [
  "united kingdom of",
  "federal republic of",
  "democratic republic of",
  "peoples republic of",
  "people s republic of",
  "islamic republic of",
  "socialist republic of",
  "united republic of",
  "grand duchy of",
  "holy empire of",
  "commonwealth of",
  "confederation of",
  "principality of",
  "federation of",
  "sultanate of",
  "republic of",
  "kingdom of",
  "empire of",
  "duchy of",
  "state of",
  "union of",
  "realm of",
];

/** Lower case, no accents, words separated by single spaces (hyphens, underscores and punctuation split words). */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");
}

/** The normalised name without a leading state form ("republic of", "kingdom of"…), and without "the". */
export function coreName(name: string): string {
  let core = normalizeName(name);
  for (const prefix of STATE_FORM_PREFIXES) {
    if (core.startsWith(`${prefix} `)) {
      core = core.slice(prefix.length + 1).replace(/^the /, "");
      break;
    }
  }
  return core;
}

/** Levenshtein edit distance. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** 1 for identical strings, 0 for nothing in common: one minus the edit distance over the longer length. */
export function nameSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

export interface MatchableRegion {
  featureId: string;
  displayName: string | null;
}

export interface MatchableNation {
  id: string;
  name: string;
  /** Other names the nation goes by: its wiki page title, source key, roster page titles. */
  aliases?: Array<string | null | undefined>;
}

export type MatchReason = "exact" | "normalized" | "state-form" | "similar";

export interface MatchSuggestion {
  featureId: string;
  featureName: string;
  countryId: string;
  countryName: string;
  /** 0 to 1: 1 for the same name, lower for looser matches. */
  confidence: number;
  reason: MatchReason;
  /** The nation name or alias the region matched. */
  matchedOn: string;
}

/** Confidence of each kind of match; a similar spelling scales its similarity into the band below these. */
const CONFIDENCE: Record<Exclude<MatchReason, "similar">, number> = {
  exact: 1,
  normalized: 0.95,
  "state-form": 0.85,
};
/** Similar spellings below this similarity are not suggested. */
export const MIN_SIMILARITY = 0.8;
/** Auto-Match links only matches at least this confident; the rest wait for review. */
export const AUTO_LINK_MIN_CONFIDENCE = 0.85;

/** "Gallambria_North" → "Gallambria North": a feature id read as a name. */
const featureIdName = (featureId: string) => featureId.replace(/_/g, " ");

function scoreName(
  region: string,
  candidate: string
): { confidence: number; reason: MatchReason } | null {
  if (!region || !candidate) return null;
  if (region === candidate) return { confidence: CONFIDENCE.exact, reason: "exact" };
  const [rn, cn] = [normalizeName(region), normalizeName(candidate)];
  if (rn && rn === cn) return { confidence: CONFIDENCE.normalized, reason: "normalized" };
  const [rc, cc] = [coreName(region), coreName(candidate)];
  if (rc && rc === cc) return { confidence: CONFIDENCE["state-form"], reason: "state-form" };
  const similarity = Math.max(nameSimilarity(rn, cn), nameSimilarity(rc, cc));
  if (similarity < MIN_SIMILARITY) return null;
  // Similar spellings stay below the state-form band, so they are reviewed, never linked on their own.
  return { confidence: Math.round(similarity * 0.8 * 100) / 100, reason: "similar" };
}

/**
 * The best nation for each region, if any is close enough, highest confidence first. Several regions may match
 * one nation (a nation drawn as several regions), so a match never removes the nation from the candidates.
 * Ties between two nations at the same confidence are dropped as ambiguous.
 */
export function suggestRegionMatches(
  regions: readonly MatchableRegion[],
  nations: readonly MatchableNation[]
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];
  for (const region of regions) {
    const regionNames = [region.displayName, featureIdName(region.featureId)].filter(
      (n): n is string => !!n?.trim()
    );
    let best: MatchSuggestion | null = null;
    let tied = false;
    for (const nation of nations) {
      const names = [nation.name, ...(nation.aliases ?? [])].filter(
        (n): n is string => !!n?.trim()
      );
      let nationBest: { confidence: number; reason: MatchReason; matchedOn: string } | null = null;
      for (const regionName of regionNames) {
        for (const name of names) {
          const score = scoreName(regionName, name);
          if (score && (!nationBest || score.confidence > nationBest.confidence)) {
            nationBest = { ...score, matchedOn: name };
          }
        }
      }
      if (!nationBest) continue;
      if (best && nationBest.confidence === best.confidence && best.countryId !== nation.id) {
        tied = true;
      } else if (!best || nationBest.confidence > best.confidence) {
        tied = false;
        best = {
          featureId: region.featureId,
          featureName: region.displayName ?? featureIdName(region.featureId),
          countryId: nation.id,
          countryName: nation.name,
          ...nationBest,
        };
      }
    }
    if (best && !tied) suggestions.push(best);
  }
  return suggestions.sort(
    (a, b) => b.confidence - a.confidence || a.featureName.localeCompare(b.featureName)
  );
}
