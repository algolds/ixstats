// src/lib/cards/face/types.ts
import type { CardFinish, CardRarity, CardType } from "@prisma/client";

export type { CardFinish, CardRarity, CardType };

/** S for grids and rows, M for strips and reveals, L for the sheet (the only size that shows level and serial). */
export type CardFaceSize = "S" | "M" | "L";

/** A card's home realm, as faces and filters show it. */
export interface CardRealmBadge {
  id: string;
  slug: string;
  name: string;
  /** The realm's emblem, or null (the face shows its initial; NationStates and IIWiki use their logos). */
  crestUrl: string | null;
  isSystem: boolean;
}

/** What one copy adds to its face: the finish sheen, and at size L the level and serial. */
export interface CardCopyFacts {
  ownershipId: string;
  finish: CardFinish;
  serialNumber: number;
  level: number;
}

/** The one card shape the UI renders. The server builds it with `toCardFace`, which applies the silhouette rule. */
export interface CardFaceData {
  cardId: string;
  title: string;
  rarity: CardRarity;
  cardType: CardType;
  realm: CardRealmBadge;
  /** Raw artwork URL (the face proxies it); null when the card has none or this viewer may not see it. */
  artwork: string | null;
  /** True when this viewer may not see the card's art: they hold no copy and nothing on screen reveals it. */
  silhouette: boolean;
  /** Collector number within the home realm; null until it is numbered. */
  number: number | null;
  /** NS season for NS cards, edition season for Nation cards; null for every other type. */
  season: number | null;
  isRetired: boolean;
  /** The copy this face stands for; null for a catalogue entry. */
  copy: CardCopyFacts | null;
}
