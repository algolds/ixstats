// src/lib/cards/face/artwork.ts
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";

/** Stand-in images older rows stored instead of "no art"; the face draws the realm crest for these. */
const PLACEHOLDER_ARTWORK: ReadonlySet<string> = new Set([
  CARD_ARTWORK_PLACEHOLDER,
  "/images/cards/lore-placeholder.svg",
  "/default-card-artwork.png",
]);

/** A card's artwork URL, or null when it has none. */
export function normalizeArtwork(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed || PLACEHOLDER_ARTWORK.has(trimmed)) return null;
  return trimmed;
}
