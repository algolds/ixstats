// src/lib/cards/enums.ts
/**
 * Card System Enums
 *
 * Client-safe runtime constants that mirror the Prisma enums (prisma/schema/enums.prisma). The `satisfies`
 * clauses fail the typecheck as soon as the two drift apart.
 */
import type {
  CardFinish as PrismaCardFinish,
  CardRarity as PrismaCardRarity,
  CardType as PrismaCardType,
  PackType as PrismaPackType,
} from "@prisma/client";

/** Card rarities, lowest first (cards refresh §2.1). */
export const CardRarity = {
  COMMON: "COMMON",
  UNCOMMON: "UNCOMMON",
  RARE: "RARE",
  ULTRA_RARE: "ULTRA_RARE",
  EPIC: "EPIC",
  LEGENDARY: "LEGENDARY",
} as const satisfies { [K in PrismaCardRarity]: K };

export type CardRarity = (typeof CardRarity)[keyof typeof CardRarity];

const RARITY_VALUES: readonly string[] = Object.values(CardRarity);

/** A rarity string as the enum: any casing, hyphens and spaces as underscores; null for anything else. */
export function parseCardRarity(value: string | null | undefined): CardRarity | null {
  const key = (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return RARITY_VALUES.includes(key) ? (key as CardRarity) : null;
}

/** Card pack types (Prisma `PackType`). */
export const PackType = {
  BASIC: "BASIC",
  PREMIUM: "PREMIUM",
  ELITE: "ELITE",
  THEMED: "THEMED",
  SEASONAL: "SEASONAL",
  EVENT: "EVENT",
} as const satisfies { [K in PrismaPackType]: K };

export type PackType = (typeof PackType)[keyof typeof PackType];

/** Card types (§2.1): Lore, Nation, NationStates, Special (achievement and event cards), Trophy. */
export const CardType = {
  LORE: "LORE",
  NATION: "NATION",
  NS: "NS",
  SPECIAL: "SPECIAL",
  TROPHY: "TROPHY",
} as const satisfies { [K in PrismaCardType]: K };

export type CardType = (typeof CardType)[keyof typeof CardType];

const TYPE_VALUES: readonly string[] = Object.values(CardType);

/** A card type string as the enum (exact match); null for anything else, the legacy strings included. */
export function parseCardType(value: string | null | undefined): CardType | null {
  return value && TYPE_VALUES.includes(value) ? (value as CardType) : null;
}

/** The finish of one copy (§2.1). Rolled at mint from Phase 4; Phase 1 mints Standard and Serialised only. */
export const CardFinish = {
  STANDARD: "STANDARD",
  FOIL: "FOIL",
  HOLO: "HOLO",
  SERIALISED: "SERIALISED",
} as const satisfies { [K in PrismaCardFinish]: K };

export type CardFinish = (typeof CardFinish)[keyof typeof CardFinish];
