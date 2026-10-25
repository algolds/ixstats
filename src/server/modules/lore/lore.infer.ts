/**
 * A native lore piece's type, read from its wikitext (docs/superpowers/specs/2026-10-24-native-lore-design.md).
 * The type groups pieces on the Lore tab: the owner's curation names it, or it is read from the page's first infobox.
 * Pure: no database, no wiki reads. The types and the category are in ~/lib/lore (client-safe).
 */

import type { LoreType } from "~/lib/lore/lore-types";

/** Each ixwiki infobox a lore piece is written with (lower case, spaced), and the type it gives. */
const INFOBOX_TYPES: ReadonlyMap<string, LoreType> = new Map([
  ["person", "person"],
  ["officeholder", "person"],
  ["settlement", "place"],
  ["event", "event"],
  ["military conflict", "event"],
  ["organization", "organisation"],
  ["company", "organisation"],
  ["political party", "organisation"],
]);

/** The name after "Infobox" in the first `{{Infobox …` template. */
const FIRST_INFOBOX = /\{\{\s*infobox[\s_]+([^|}\n]+)/i;

export function inferLoreType(wikitext: string): LoreType {
  const name = FIRST_INFOBOX.exec(wikitext)?.[1];
  if (!name) return "other";
  const key = name.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return INFOBOX_TYPES.get(key) ?? "other";
}
