/**
 * Pure normalization utilities for country names and flag URLs (Plan 164).
 */

/**
 * Normalizes a country name for cache lookup and comparison.
 * Trims whitespace, lowercases, and collapses multiple spaces into single spaces.
 */
export function normalizeCountryName(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Normalizes a flag URL, returning null if empty or invalid.
 */
export function normalizeFlagUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Derives common candidate MediaWiki file titles for a country name.
 * e.g. "United States" -> ["Flag_of_the_United_States.svg", "Flag_of_United_States.svg", "United_States_Flag.svg"]
 */
export function getFlagCandidateFileTitles(countryName: string): string[] {
  const clean = countryName.trim().replace(/\s+/g, "_");
  if (!clean) return [];

  const candidates: string[] = [
    `Flag_of_${clean}.svg`,
    `Flag_of_the_${clean}.svg`,
    `${clean}_flag.svg`,
    `Flag_${clean}.svg`,
    `Flag_of_${clean}.png`,
    `Flag_of_the_${clean}.png`,
  ];

  return candidates;
}
