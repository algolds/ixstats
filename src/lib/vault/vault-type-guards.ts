/**
 * Vault & Card System Type Guards & Type Utilities
 *
 * Provides type predicates, branded type assertions, and guard functions
 * to guarantee strict type safety across Vault, Cards, Auctions, Store, and Trading.
 */

import type { CardRarity, CardType, TradeStatus, AuctionStatus } from "@prisma/client";
import type { CardInstance, AuctionListing, Bid, MarketFilters } from "~/types/marketplace";

/**
 * Nominal / Branded Types for Domain Identifiers
 */
export type Brand<K, T extends string> = K & { readonly __brand: T };

export type UserId = Brand<string, "UserId">;
export type CardId = Brand<string, "CardId">;
export type AuctionId = Brand<string, "AuctionId">;
export type TradeId = Brand<string, "TradeId">;
export type OwnershipId = Brand<string, "OwnershipId">;
export type VaultId = Brand<string, "VaultId">;
export type PackId = Brand<string, "PackId">;

/**
 * Brand converter helper functions
 */
export const toUserId = (id: string): UserId => id as UserId;
export const toCardId = (id: string): CardId => id as CardId;
export const toAuctionId = (id: string): AuctionId => id as AuctionId;
export const toTradeId = (id: string): TradeId => id as TradeId;
export const toOwnershipId = (id: string): OwnershipId => id as OwnershipId;
export const toVaultId = (id: string): VaultId => id as VaultId;
export const toPackId = (id: string): PackId => id as PackId;

/**
 * Store Item Categorized Types
 */
export type StoreItemCategory = "cosmetics" | "upgrades" | "packs";

export interface BaseStoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: "credits" | "tokens";
  category: StoreItemCategory;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface CosmeticStoreItem extends BaseStoreItem {
  category: "cosmetics";
  cosmeticType?: "border" | "particle" | "frame";
  previewUrl?: string;
}

export interface UpgradeStoreItem extends BaseStoreItem {
  category: "upgrades";
  upgradeKey: string;
  currentTier?: number;
  maxTier?: number;
}

export interface PackStoreItem extends BaseStoreItem {
  category: "packs";
  packType: string;
  cardCount?: number;
  guaranteedRarity?: CardRarity;
}

export type StoreItem = CosmeticStoreItem | UpgradeStoreItem | PackStoreItem;

/**
 * User Pack Ownership Interface
 */
export interface UserPackOwnership {
  id: string;
  userId: string;
  packId: string;
  acquiredAt: Date;
  isOpened: boolean;
  openedAt?: Date | null;
  pack?: {
    id: string;
    name: string;
    description: string;
    packType: string;
    cardCount: number;
    price: number;
  };
}

/**
 * Trade Offer Interface
 */
export interface TradeParticipant {
  id: string;
  clerkUserId: string;
  country?: {
    name: string;
    flag: string | null;
  } | null;
}

export interface TradeOfferItem {
  id: string;
  tradeId: string;
  cardInstanceId: string;
  offeredById: string;
  cardInstance?: CardInstance;
}

export interface TradeOffer {
  id: string;
  initiatorId: string;
  recipientId: string;
  initiatorCredits: number;
  recipientCredits: number;
  status: TradeStatus;
  message?: string | null;
  createdAt: Date;
  expiresAt: Date;
  initiator?: TradeParticipant;
  recipient?: TradeParticipant;
  items?: TradeOfferItem[];
}

/**
 * Type Predicates / Type Guards
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCardInstance(value: unknown): value is CardInstance {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.cardType === "string" &&
    typeof value.rarity === "string"
  );
}

export function isAuctionListing(value: unknown): value is AuctionListing {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.cardInstanceId === "string" &&
    typeof value.startingPrice === "number" &&
    isCardInstance(value.cardInstance)
  );
}

export function isBid(value: unknown): value is Bid {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.auctionId === "string" &&
    typeof value.bidderId === "string" &&
    typeof value.amount === "number"
  );
}

export function isTradeOffer(value: unknown): value is TradeOffer {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.initiatorId === "string" &&
    typeof value.recipientId === "string" &&
    typeof value.status === "string"
  );
}

export function isUserPackOwnership(value: unknown): value is UserPackOwnership {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.userId === "string" &&
    typeof value.packId === "string"
  );
}

export function isStoreItem(value: unknown): value is StoreItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.price === "number" &&
    (value.category === "cosmetics" || value.category === "upgrades" || value.category === "packs")
  );
}

export function safeParseMetadata<T = Record<string, unknown>>(
  raw: unknown,
  fallback: T = {} as T
): T {
  if (!raw) return fallback;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return isRecord(parsed) ? (parsed as T) : fallback;
    } catch {
      return fallback;
    }
  }
  return isRecord(raw) ? (raw as T) : fallback;
}
