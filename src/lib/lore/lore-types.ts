/**
 * Native lore's piece types and a country's lore category (docs/superpowers/specs/2026-10-24-native-lore-design.md).
 * Client-safe: the lore writer and the Lore tab use these, and so does the server's lore module.
 */

export const LORE_TYPES = ["person", "place", "event", "organisation", "other"] as const;
export type LoreType = (typeof LORE_TYPES)[number];

/** Whether a stored curation type is one of the lore types (anything else reads as "other"). */
export function isLoreType(value: string): value is LoreType {
  return (LORE_TYPES as readonly string[]).includes(value);
}

/** The category every lore piece of a country carries (without the `Category:` prefix). */
export function loreCategory(countryName: string): string {
  return `${countryName.replace(/_/g, " ")} lore`;
}
