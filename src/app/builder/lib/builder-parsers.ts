/**
 * Parser and normalization utilities for the Atomic Country Builder.
 */

/** Parse numeric values like "$1.2 trillion", "€45,000", "10 million", "1234567" */
export function parseWikiNumericValue(value: unknown): number | null {
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.match(/([\d,.]+)\s*(trillion|billion|million|thousand)?/i);
  if (!match) return null;
  let num = parseFloat(match[1]!.replace(/,/g, ""));
  if (isNaN(num)) return null;
  const mult = match[2]?.toLowerCase();
  if (mult === "trillion") num *= 1e12;
  else if (mult === "billion") num *= 1e9;
  else if (mult === "million") num *= 1e6;
  else if (mult === "thousand") num *= 1e3;
  return num > 0 ? num : null;
}

/** Normalize wiki government type to builder enum (Title Case, known types) */
export function normalizeGovernmentType(raw: string): string {
  const normalized = raw.trim();
  const knownTypes = [
    "Constitutional Monarchy",
    "Federal Republic",
    "Parliamentary Democracy",
    "Presidential Republic",
    "Federal Constitutional Republic",
    "Unitary State",
    "Federation",
    "Confederation",
    "Empire",
    "City-State",
  ];
  for (const known of knownTypes) {
    if (normalized.toLowerCase() === known.toLowerCase()) return known;
  }
  // Title-case fallback for unknown types
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase()) || "Other";
}
