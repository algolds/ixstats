/**
 * Which existing nation each source entry is. In order: a staff match (overrides), the stable key stored on the
 * country (Country.externalSourceKey), then the normalised name against the realm's countries (name and wiki
 * page title) and its roster pages (RealmPage kind "nation"), so a roster page and its map entry become one
 * nation. Exact names win; failing those, a name matches the same name with a trailing parenthetical qualifier
 * on one side only ("Nanto" = "Nanto (Eurth)", a wiki's disambiguation), never two different qualifiers
 * ("Congo (Brazzaville)" ≠ "Congo (Kinshasa)"). Anything that matches more than one candidate, or a candidate
 * another entry also matches, is reported as ambiguous instead of guessed.
 */
import type { NationOverride } from "./config";
import type { SourceNation } from "./adapters/types";

/** Case-, accent- and punctuation-blind form of a nation name, wiki title or key ("Kíziáuke" = "kiziauke"). */
export function normalizeNationName(name: string | null | undefined): string {
  if (!name) return "";
  let text = name;
  try {
    text = decodeURIComponent(text);
  } catch {
    // not URI-encoded
  }
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[_\-‐‑–—]+/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The normalised name without a trailing parenthetical qualifier ("Nanto (Eurth)" → "nanto"). */
export function baseNationName(name: string | null | undefined): string {
  return normalizeNationName(name?.replace(/\s*\([^()]*\)\s*$/, ""));
}

/** The forms a set of names goes by: exact (normalised) and qualifier-free. */
export interface NameKeys {
  exact: Set<string>;
  base: Set<string>;
}

export function nameKeys(names: ReadonlyArray<string | null | undefined>): NameKeys {
  return {
    exact: new Set(names.map(normalizeNationName).filter(Boolean)),
    base: new Set(names.map(baseNationName).filter(Boolean)),
  };
}

const exactNameHit = (keys: NameKeys, name: string | null | undefined) =>
  keys.exact.has(normalizeNationName(name));

/** The same name with a qualifier on one side only: "Nanto" against "Nanto (Eurth)", either way round. */
function qualifiedNameHit(keys: NameKeys, name: string | null | undefined): boolean {
  const exact = normalizeNationName(name);
  const base = baseNationName(name);
  return (exact !== "" && keys.base.has(exact)) || (base !== "" && keys.exact.has(base));
}

/** The candidates a name set matches: exact names first, else the one-sided qualifier matches. */
function tieredHits<T>(
  candidates: readonly T[],
  namesOfCandidate: (candidate: T) => ReadonlyArray<string | null>,
  keys: NameKeys
): T[] {
  const exact = candidates.filter((c) => namesOfCandidate(c).some((n) => exactNameHit(keys, n)));
  if (exact.length > 0) return exact;
  return candidates.filter((c) => namesOfCandidate(c).some((n) => qualifiedNameHit(keys, n)));
}

/** Whether a name is taken by any of a set of names, exactly or with a qualifier on one side only. */
export const nameTaken = (keys: NameKeys, name: string) =>
  exactNameHit(keys, name) || qualifiedNameHit(keys, name);

/** A word of one name that is the same word, or a longer spelling of it ("ymutz" ~ "ymutztlaclan"), in the other. */
function sameOrLonger(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

/**
 * Two different names that may be one nation spelled two ways: the same number of words, each the same or a
 * shortened form of the other's ("Ymutz Mizlan" ~ "Ymutztlaclan-Mizlanuzco"). Only ever a warning, never a match.
 */
export function nearNationName(a: string, b: string): boolean {
  const left = baseNationName(a).split(" ");
  const right = baseNationName(b).split(" ");
  if (left.join(" ") === right.join(" ") || left.length !== right.length) return false;
  return left.every((word, i) => sameOrLonger(word, right[i]!));
}

export interface MatchableCountry {
  id: string;
  name: string;
  wikiPageTitle: string | null;
  externalSourceKey: string | null;
}

export interface MatchablePage {
  title: string;
}

export interface MatchCandidate {
  countryId?: string;
  pageTitle?: string;
  name: string;
}

export type NationMatch =
  | { kind: "country"; countryId: string; via: "override" | "key" | "name" }
  | { kind: "page"; pageTitle: string }
  | { kind: "new" }
  | { kind: "excluded" }
  | { kind: "ambiguous"; reason: string; candidates: MatchCandidate[] };

/** The names a source entry may go by. */
const namesOf = (nation: SourceNation): NameKeys =>
  nameKeys([nation.key, nation.displayName, nation.wikiTitle]);

export function matchSourceNations(
  nations: readonly SourceNation[],
  countries: readonly MatchableCountry[],
  pages: readonly MatchablePage[],
  overrides: Readonly<Record<string, NationOverride>>
): Map<string, NationMatch> {
  const result = new Map<string, NationMatch>();
  const byId = new Map(countries.map((c) => [c.id, c]));
  const byKey = new Map(
    countries.filter((c) => c.externalSourceKey).map((c) => [c.externalSourceKey!, c])
  );
  const reserved = new Set<string>();
  const sourceKeys = new Set(nations.map((n) => n.key));

  // 1. Staff matches and stored keys come first and reserve their country.
  for (const nation of nations) {
    const override = overrides[nation.key];
    if (override?.exclude) {
      result.set(nation.key, { kind: "excluded" });
      continue;
    }
    if (override?.countryId) {
      const country = byId.get(override.countryId);
      if (!country || reserved.has(country.id)) {
        result.set(nation.key, {
          kind: "ambiguous",
          reason: country
            ? "Matched by hand to a country another entry already has"
            : "Matched by hand to a country that is not in this realm",
          candidates: [],
        });
        continue;
      }
      reserved.add(country.id);
      result.set(nation.key, { kind: "country", countryId: country.id, via: "override" });
      continue;
    }
    const keyed = byKey.get(nation.key);
    if (keyed && !reserved.has(keyed.id)) {
      reserved.add(keyed.id);
      result.set(nation.key, { kind: "country", countryId: keyed.id, via: "key" });
    }
  }

  // 2. Names: countries not bound to another source key, then roster pages no country has taken.
  // A country whose stored key the source no longer lists (a renamed entry) can be matched again by name.
  const free = countries.filter(
    (c) => !reserved.has(c.id) && (!c.externalSourceKey || !sourceKeys.has(c.externalSourceKey))
  );
  const takenNames = nameKeys(countries.flatMap((c) => [c.name, c.wikiPageTitle]));
  const freePages = pages.filter((p) => !nameTaken(takenNames, p.title));
  const countryClaims = new Map<string, string[]>();
  const pageClaims = new Map<string, string[]>();
  for (const nation of nations) {
    if (result.has(nation.key)) continue;
    const names = namesOf(nation);
    const countryHits = tieredHits(free, (c) => [c.name, c.wikiPageTitle], names);
    if (countryHits.length > 1) {
      result.set(nation.key, {
        kind: "ambiguous",
        reason: "Its name matches more than one nation of the realm",
        candidates: countryHits.map((c) => ({ countryId: c.id, name: c.name })),
      });
      continue;
    }
    if (countryHits.length === 1) {
      const id = countryHits[0]!.id;
      countryClaims.set(id, [...(countryClaims.get(id) ?? []), nation.key]);
      result.set(nation.key, { kind: "country", countryId: id, via: "name" });
      continue;
    }
    const pageHits = tieredHits(freePages, (p) => [p.title], names);
    if (pageHits.length > 1) {
      result.set(nation.key, {
        kind: "ambiguous",
        reason: "Its name matches more than one roster page",
        candidates: pageHits.map((p) => ({ pageTitle: p.title, name: p.title })),
      });
      continue;
    }
    if (pageHits.length === 1) {
      const title = pageHits[0]!.title;
      pageClaims.set(title, [...(pageClaims.get(title) ?? []), nation.key]);
      result.set(nation.key, { kind: "page", pageTitle: title });
      continue;
    }
    result.set(nation.key, { kind: "new" });
  }

  // 3. Two entries on one candidate: neither is guessed.
  const unshare = (claims: Map<string, string[]>, label: (target: string) => MatchCandidate) => {
    for (const [target, keys] of claims) {
      if (keys.length < 2) continue;
      for (const key of keys)
        result.set(key, {
          kind: "ambiguous",
          reason: `Another source entry (${keys.filter((k) => k !== key).join(", ")}) matches the same nation`,
          candidates: [label(target)],
        });
    }
  };
  unshare(countryClaims, (id) => ({ countryId: id, name: byId.get(id)?.name ?? id }));
  unshare(pageClaims, (title) => ({ pageTitle: title, name: title }));
  return result;
}

/** Roster pages that no source entry matched and no country has taken: the sync creates these from the wiki. */
export function rosterOnlyPages<P extends MatchablePage>(
  pages: readonly P[],
  countries: readonly MatchableCountry[],
  matches: ReadonlyMap<string, NationMatch>
): P[] {
  const taken = nameKeys(countries.flatMap((c) => [c.name, c.wikiPageTitle]));
  const matched = new Set(
    [...matches.values()].flatMap((m) =>
      m.kind === "page"
        ? [normalizeNationName(m.pageTitle)]
        : m.kind === "ambiguous"
          ? m.candidates.flatMap((c) => (c.pageTitle ? [normalizeNationName(c.pageTitle)] : []))
          : []
    )
  );
  return pages.filter((p) => {
    const name = normalizeNationName(p.title);
    return !nameTaken(taken, p.title) && !matched.has(name);
  });
}
