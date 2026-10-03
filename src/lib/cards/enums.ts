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
const PackType = {
  BASIC: "BASIC",
  PREMIUM: "PREMIUM",
  ELITE: "ELITE",
  THEMED: "THEMED",
  SEASONAL: "SEASONAL",
  EVENT: "EVENT",
} as const;

type PackType = (typeof PackType)[keyof typeof PackType];

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
const AuctionStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

type AuctionStatus = (typeof AuctionStatus)[keyof typeof AuctionStatus];

/**
 * Trade status
 */
const TradeStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

type TradeStatus = (typeof TradeStatus)[keyof typeof TradeStatus];
