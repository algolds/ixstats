"use client";

/**
 * useWikiSectionMap — Auto-matches wiki sections to MyCountry tab contexts.
 *
 * Given a country name and a context (e.g., "economy", "defense"), returns
 * the wiki sections that match that context's keywords.
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";

/** Keywords that map each context to relevant wiki section titles */
const SECTION_CONTEXT_MAP: Record<string, string[]> = {
  economy: [
    "economy",
    "trade",
    "industry",
    "agriculture",
    "energy",
    "currency",
    "finance",
    "banking",
    "commerce",
    "mining",
    "manufacturing",
  ],
  labor: ["labor", "labour", "employment", "workforce", "education", "unions", "wages", "work"],
  government: [
    "government",
    "politics",
    "executive",
    "legislature",
    "judicial",
    "constitution",
    "law",
    "administration",
    "civil service",
  ],
  demographics: [
    "demograph",
    "population",
    "ethnic",
    "language",
    "religion",
    "society",
    "health",
    "cities",
    "urban",
    "rural",
    "culture",
    "cuisine",
    "music",
    "art",
    "sport",
  ],
  executive: ["history", "government", "economy", "policy", "modern", "contemporary"],
  diplomacy: ["foreign", "relations", "diplomacy", "treaty", "alliance", "international"],
  defense: [
    "military",
    "army",
    "navy",
    "air force",
    "defense",
    "defence",
    "armed",
    "war",
    "security",
  ],
  politics: [
    "government",
    "politics",
    "constitution",
    "election",
    "party",
    "legislature",
    "parliament",
  ],
  intelligence: ["security", "intelligence", "law enforcement", "police", "espionage"],
};

export interface WikiSectionItem {
  title: string;
  key: string;
}

export function useWikiSectionMap(countryName: string | undefined, context: string) {
  const { data: wikiSections, isLoading } = api.countries.getWikiSections.useQuery(
    { countryName: countryName ?? "" },
    { staleTime: 60 * 60_000, enabled: !!countryName }
  );

  const { sections, wikiUrl } = useMemo(() => {
    const keywords = SECTION_CONTEXT_MAP[context] ?? [];
    if (!wikiSections || keywords.length === 0) {
      return { sections: [] as WikiSectionItem[], wikiUrl: "" };
    }

    const filtered = (
      wikiSections as Array<{ level: number; line?: string; title?: string; anchor?: string }>
    )
      .filter((s) => s.level === 2)
      .filter((s) => {
        const title = (s.line || s.title || "").toLowerCase();
        return keywords.some((kw) => title.includes(kw));
      })
      .map((s, i) => ({
        title: s.line || s.title || "",
        key: `${i}-${s.anchor || s.line || i}`,
      }));

    const url = `/w/${encodeURIComponent((countryName ?? "").replace(/ /g, "_"))}`;

    return { sections: filtered, wikiUrl: url };
  }, [wikiSections, context, countryName]);

  return {
    sections,
    isLoading,
    wikiUrl,
    sectionCount: sections.length,
  };
}

/** Get the keywords for a given context */
export function getContextKeywords(context: string): string[] {
  return SECTION_CONTEXT_MAP[context] ?? [];
}
