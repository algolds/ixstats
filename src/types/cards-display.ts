/**
 * Card Display Types
 * Type definitions for IxCards display components
 * Phase 1: Card Display Components
 */

import type { CardRarity, CardType } from "@prisma/client";
import type { CardStatDef } from "~/lib/card-stat-config";

export type Brand<K, T extends string> = K & { readonly __brand: T };
export type UserId = Brand<string, "UserId">;
export type CardId = Brand<string, "CardId">;
export type AuctionId = Brand<string, "AuctionId">;
export type OwnershipId = Brand<string, "OwnershipId">;

export interface ArtworkVariants {
  holographicUrl?: string;
  foilUrl?: string;
  altArtUrl?: string;
  [key: string]: unknown;
}

export interface CardStatsData {
  economic?: number;
  diplomatic?: number;
  military?: number;
  social?: number;
  [statKey: string]: number | undefined;
}

export interface CardEnhancementsData {
  level?: number;
  statBoosts?: Record<string, number>;
  customBorder?: string;
  [key: string]: unknown;
}

/**
 * Card display size options
 */
export type CardDisplaySize = "small" | "sm" | "medium" | "md" | "large";

/**
 * Card instance interface (matches Prisma Card model)
 */
export interface CardInstance {
  id: string;
  title: string;
  description: string | null;
  artwork: string;
  artworkVariants: ArtworkVariants | null;
  cardType: CardType;
  rarity: CardRarity;
  season: number;
  nsCardId: number | null;
  nsSeason: number | null;
  nsData: Record<string, unknown> | null;
  wikiSource: string | null;
  wikiArticleTitle: string | null;
  wikiUrl: string | null;
  countryId: string | null;
  stats: CardStatsData | Record<string, number>;
  metadata?: Record<string, unknown> | null;
  attributes?: Record<string, unknown>;
  ownershipId?: string;
  isLocked?: boolean;
  marketValue: number;
  totalSupply: number;
  level: number;
  evolutionStage: number;
  enhancements: CardEnhancementsData | null;
  createdAt: Date;
  updatedAt: Date;
  lastTrade: Date | null;
  isRetired?: boolean;
  retiredAt?: Date | null;
  /** Ownership-specific fields */
  serialNumber?: number;
  experience?: number;
  lastSalePrice?: number | null;
  lastSaleDate?: Date | null;
  acquiredAt?: Date;
  inscription?: string | null;
  inscribedById?: string | null;
  inscribedAt?: Date | null;
  /** Base card stats (before level bonuses) */
  baseStats?: Record<string, number>;
  country?: {
    id: string;
    name: string;
    continent: string | null;
    region: string | null;
    flag: string | null;
  } | null;
  owners?: Array<{
    userId: string;
    quantity: number;
    acquiredDate: Date;
    acquiredMethod: string;
  }>;
}

/**
 * Formatted card stats for display
 */
export interface FormattedStatEntry {
  value: number;
  baseValue: number;
  bonus: number;
  def: CardStatDef;
}

export interface FormattedSpecialStatEntry {
  normalizedValue: number | string;
  rawValue: number;
  formattedRaw: string;
  def: CardStatDef;
}

export interface FormattedStats {
  base: Record<string, FormattedStatEntry>;
  specials: FormattedSpecialStatEntry[];
  level: number;
  totalBoost: number;
}

/**
 * Card market history data point
 */
export interface MarketHistoryPoint {
  date: Date;
  value: number;
  volume: number;
}

/**
 * Card filter options
 */
export interface CardFilters {
  season?: number;
  rarity?: CardRarity;
  type?: CardType;
  search?: string;
}

/**
 * Card sort options
 */
export type CardSort = "rarity" | "value" | "acquired" | "name" | "season";

/**
 * Rarity configuration for display
 */
export interface RarityConfig {
  color: string;
  glowColor: string;
  glowIntensity: string;
  borderColor: string;
  label: string;
}
