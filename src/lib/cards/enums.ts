/**
 * Card System Enums
 *
 * Runtime constants that match Prisma schema enums.
 * These can be safely used in both client and server components.
 *
 * IMPORTANT: These values MUST match the Prisma schema exactly.
 * If you modify prisma/schema.prisma enums, update these accordingly.
 */

/**
 * Card rarity levels
 */
export const CardRarity = {
  COMMON: "COMMON",
  UNCOMMON: "UNCOMMON",
  RARE: "RARE",
  ULTRA_RARE: "ULTRA_RARE",
  EPIC: "EPIC",
  LEGENDARY: "LEGENDARY",
} as const;

export type CardRarity = (typeof CardRarity)[keyof typeof CardRarity];

/**
 * Card types/categories
 */
export const CardType = {
  NATION: "NATION",
  LORE: "LORE",
  NS_IMPORT: "NS_IMPORT",
  SPECIAL: "SPECIAL",
  COMMUNITY: "COMMUNITY",
} as const;

export type CardType = (typeof CardType)[keyof typeof CardType];

/**
 * Pack types
 */
export const PackType = {
  BASIC: "BASIC",
  PREMIUM: "PREMIUM",
  ELITE: "ELITE",
  THEMED: "THEMED",
  SEASONAL: "SEASONAL",
  EVENT: "EVENT",
} as const;

export type PackType = (typeof PackType)[keyof typeof PackType];

/**
 * How a card was acquired
 */
export const AcquireMethod = {
  PACK: "PACK",
  TRADE: "TRADE",
  AUCTION: "AUCTION",
  CRAFT: "CRAFT",
  GIFT: "GIFT",
  NS_IMPORT: "NS_IMPORT",
  ACHIEVEMENT: "ACHIEVEMENT",
  EVENT: "EVENT",
} as const;

export type AcquireMethod = (typeof AcquireMethod)[keyof typeof AcquireMethod];

/**
 * Auction status
 */
export const AuctionStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type AuctionStatus = (typeof AuctionStatus)[keyof typeof AuctionStatus];

/**
 * Trade status
 */
export const TradeStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

export type TradeStatus = (typeof TradeStatus)[keyof typeof TradeStatus];

/**
 * Helper function to get all rarity values as an array
 */
export function getAllRarities(): CardRarity[] {
  return Object.values(CardRarity);
}

/**
 * Helper function to get all card type values as an array
 */
export function getAllCardTypes(): CardType[] {
  return Object.values(CardType);
}

/**
 * Helper function to check if a value is a valid CardRarity
 */
export function isValidCardRarity(value: string): value is CardRarity {
  return Object.values(CardRarity).includes(value as CardRarity);
}

/**
 * Helper function to check if a value is a valid CardType
 */
export function isValidCardType(value: string): value is CardType {
  return Object.values(CardType).includes(value as CardType);
}
