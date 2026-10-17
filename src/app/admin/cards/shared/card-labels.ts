/** What the cards admin calls each rarity, type, review state and source, in sentence case. */
import { CARD_WIKI_SOURCES, cardSourceLabel, type CardWikiSource } from "~/lib/cards/card-sources";
import { RARITY_LABEL } from "~/lib/cards/face/labels";
import type { CardRarity, CardType } from "~/lib/cards/face/types";

export {
  RARITY_ORDER as RARITIES,
  TYPE_ORDER as CARD_TYPES,
  TYPE_LABEL as CARD_TYPE_LABELS,
} from "~/lib/cards/face/labels";
export type RarityValue = CardRarity;
export type CardTypeValue = CardType;
/** The player labels, but the admin keeps sentence case: "Ultra rare" (Phase 3 ruling Q9). */
export const RARITY_LABELS: Readonly<Record<CardRarity, string>> = {
  ...RARITY_LABEL,
  ULTRA_RARE: "Ultra rare",
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
