/**
 * Card Display Types
 * Type definitions for IxCards display components
 * Phase 1: Card Display Components
 */

import type { CardRarity, CardType } from "@prisma/client";

/**
 * Card display size options
 */
export type CardDisplaySize = "small" | "medium" | "large";

/**
 * Card instance interface (matches Prisma Card model)
 */
export interface CardInstance {
  id: string;
  title: string;
  description: string | null;
  artwork: string;
  artworkVariants: any;
  cardType: CardType;
  rarity: CardRarity;
  season: number;
  nsCardId: number | null;
  nsSeason: number | null;
  nsData: any;
  wikiSource: string | null;
  wikiArticleTitle: string | null;
  wikiUrl: string | null;
  countryId: string | null;
  stats: any;
  marketValue: number;
  totalSupply: number;
  level: number;
  evolutionStage: number;
  enhancements: any;
  createdAt: Date;
  updatedAt: Date;
  lastTrade: Date | null;
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
export interface FormattedStats {
  economic: {
    value: number;
    label: string;
    color: string;
  };
  diplomatic: {
    value: number;
    label: string;
    color: string;
  };
  military: {
    value: number;
    label: string;
    color: string;
  };
  social: {
    value: number;
    label: string;
    color: string;
  };
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
