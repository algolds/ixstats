/**
 * Card Display Types
 * The card shape the display components take: a card's fields, plus an owned copy's when there is one. Cards have no
 * stats (cards refresh §2.1); NS facts live in `metadata.nsData` (src/lib/cards/ns-facts.ts).
 */

import type { CardRarity, CardType } from "@prisma/client";

export interface CardAuthorInfo {
  creator: string;
  createdAt?: string;
  primaryContributor?: string | null;
  contributorCount?: number;
  displayAuthor: string;
  isBotFiltered?: boolean;
  [key: string]: unknown;
}

interface LoreCardMetadata {
  category?: string;
  subcategory?: string;
  source?: string;
  wikiSource?: "ixwiki" | "iiwiki";
  articleTitle?: string;
  authorInfo?: CardAuthorInfo;
  author?: string;
  creator?: string;
  wikiAuthor?: string;
  fullExcerpt?: string;
  qualityScore?: number;
  isCTE?: boolean;
  [key: string]: unknown;
}

/**
 * Card display size options
 */
export type CardDisplaySize = "small" | "sm" | "medium" | "md" | "large";

/**
 * A card as the display components take it: a Prisma `Card`'s fields, plus an owned copy's when there is one.
 */
export interface CardInstance {
  id: string;
  title: string;
  description: string | null;
  artwork: string;
  cardType: CardType | string;
  category?: string | null;
  subcategory?: string | null;
  artworkSource?: string | null;
  artworkCredit?: string | null;
  slug?: string | null;
  rarity: CardRarity;
  season: number;
  nsCardId: number | null;
  nsSeason: number | null;
  wikiSource: string | null;
  wikiArticleTitle: string | null;
  wikiExcerpt?: string | null;
  wikiUrl: string | null;
  countryId: string | null;
  metadata?: LoreCardMetadata | Record<string, unknown> | null;
  ownershipId?: string;
  isLocked?: boolean;
  marketValue: number;
  totalSupply: number;
  level: number;
  createdAt: Date;
  updatedAt: Date;
  lastTrade: Date | null;
  isRetired?: boolean;
  retiredAt?: Date | null;
  /** Ownership-specific fields */
  serialNumber?: number;
  experience?: number;
  acquiredAt?: Date;
  inscription?: string | null;
  inscribedById?: string | null;
  inscribedAt?: Date | null;
  country?: {
    id: string;
    name: string;
    continent: string | null;
    region: string | null;
    flag: string | null;
  } | null;
}

/**
 * Rarity configuration for display
 */
export interface RarityConfig {
  color: string;
  glowColor: string;
  glowIntensity: string;
  borderColor: string;
  label: string;
  /** "r,g,b" of the rarity hue, for inline rgba() glows and borders. */
  rgb: string;
  /** Outline badge classes (border + text + tint). */
  badgeStyle: string;
}
