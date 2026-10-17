// src/lib/cards/face/labels.ts
/**
 * What player surfaces call each rarity, finish and type, in the schema's order. The orders come from the client-safe
 * enum mirrors in `~/lib/cards/enums`, so a new enum value lists here as soon as it is added there.
 */
import { CardFinish, CardRarity, CardType } from "~/lib/cards/enums";

/** Rarities from most common to rarest: the schema's enum order. */
export const RARITY_ORDER: readonly CardRarity[] = Object.values(CardRarity);

/** "Ultra Rare" is the NationStates tier name (spec §2.1); the cards admin keeps "Ultra rare". */
export const RARITY_LABEL: Readonly<Record<CardRarity, string>> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  ULTRA_RARE: "Ultra Rare",
  EPIC: "Epic",
  LEGENDARY: "Legendary",
};

export const FINISH_ORDER: readonly CardFinish[] = Object.values(CardFinish);

export const FINISH_LABEL: Readonly<Record<CardFinish, string>> = {
  STANDARD: "Standard",
  FOIL: "Foil",
  HOLO: "Holo",
  SERIALISED: "Serialised",
};

export const TYPE_ORDER: readonly CardType[] = Object.values(CardType);

export const TYPE_LABEL: Readonly<Record<CardType, string>> = {
  LORE: "Lore",
  NATION: "Nation",
  NS: "NationStates",
  SPECIAL: "Special",
  TROPHY: "Trophy",
};

/** 0 (Common) to 5 (Legendary). */
export function rarityRank(rarity: CardRarity): number {
  return RARITY_ORDER.indexOf(rarity);
}
