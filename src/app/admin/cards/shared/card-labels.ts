/** What the cards admin calls each rarity, type, review state and source, in sentence case. */
import { CARD_WIKI_SOURCES, cardSourceLabel, type CardWikiSource } from "~/lib/cards/card-sources";

export const RARITIES = ["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"] as const;
export type RarityValue = (typeof RARITIES)[number];
export const RARITY_LABELS: Record<RarityValue, string> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  ULTRA_RARE: "Ultra rare",
  EPIC: "Epic",
  LEGENDARY: "Legendary",
};

export const CARD_TYPES = ["LORE", "NATION", "NS", "SPECIAL", "TROPHY"] as const;
export type CardTypeValue = (typeof CARD_TYPES)[number];
export const CARD_TYPE_LABELS: Record<CardTypeValue, string> = {
  LORE: "Lore",
  NATION: "Nation",
  NS: "NationStates",
  SPECIAL: "Special",
  TROPHY: "Trophy",
};

export const REVIEW_STATE_LABELS = {
  PENDING: "Waiting for review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

export const SOURCE_OPTIONS: ReadonlyArray<readonly [CardWikiSource, string]> =
  CARD_WIKI_SOURCES.map((source) => [source, cardSourceLabel(source)] as const);

/** The label for a value, or the value itself for one this list does not know (own keys only). */
export function labelOf(labels: Readonly<Record<string, string>>, value: string): string {
  return Object.hasOwn(labels, value) ? (labels[value] ?? value) : value;
}
