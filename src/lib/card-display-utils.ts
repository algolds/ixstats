/**
 * Card Display Utilities
 * Helper functions for card display components
 * Phase 1: Card Display Components
 */

import { CardRarity } from "@prisma/client";
import type { CardInstance, FormattedStats, RarityConfig, CardDisplaySize } from "~/types/cards-display";

/**
 * Rarity color mappings with Tailwind classes
 */
const RARITY_COLORS: Record<CardRarity, RarityConfig> = {
  [CardRarity.COMMON]: {
    color: "text-gray-400",
    glowColor: "shadow-gray-500/50",
    glowIntensity: "shadow-md",
    borderColor: "border-gray-500/20",
    label: "Common",
  },
  [CardRarity.UNCOMMON]: {
    color: "text-green-400",
    glowColor: "shadow-green-500/50",
    glowIntensity: "shadow-lg",
    borderColor: "border-green-500/20",
    label: "Uncommon",
  },
  [CardRarity.RARE]: {
    color: "text-blue-400",
    glowColor: "shadow-blue-500/50",
    glowIntensity: "shadow-lg",
    borderColor: "border-blue-500/20",
    label: "Rare",
  },
  [CardRarity.ULTRA_RARE]: {
    color: "text-purple-400",
    glowColor: "shadow-purple-500/50",
    glowIntensity: "shadow-xl",
    borderColor: "border-purple-500/20",
    label: "Ultra Rare",
  },
  [CardRarity.EPIC]: {
    color: "text-violet-400",
    glowColor: "shadow-violet-500/50",
    glowIntensity: "shadow-xl",
    borderColor: "border-violet-500/20",
    label: "Epic",
  },
  [CardRarity.LEGENDARY]: {
    color: "text-amber-400",
    glowColor: "shadow-amber-500/50",
    glowIntensity: "shadow-2xl",
    borderColor: "border-amber-500/20",
    label: "Legendary",
  },
};

/**
 * Get Tailwind color class for card rarity
 * @param rarity - Card rarity tier
 * @returns Tailwind color class string
 */
export function getRarityColor(rarity: CardRarity): string {
  return RARITY_COLORS[rarity]?.color ?? RARITY_COLORS[CardRarity.COMMON].color;
}

/**
 * Get glow intensity class for card rarity
 * Used for hover states and card borders
 * @param rarity - Card rarity tier
 * @returns Tailwind shadow class string
 */
export function getRarityGlow(rarity: CardRarity): string {
  const config = RARITY_COLORS[rarity] ?? RARITY_COLORS[CardRarity.COMMON];
  return `${config.glowIntensity} ${config.glowColor}`;
}

/**
 * Get full rarity configuration
 * @param rarity - Card rarity tier
 * @returns Complete rarity configuration object
 */
export function getRarityConfig(rarity: CardRarity): RarityConfig {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS[CardRarity.COMMON];
}

/**
 * Format card stats for display
 * Extracts and formats stats from card instance
 * @param card - Card instance with stats JSON
 * @returns Formatted stats object with labels and colors
 */
export function formatCardStats(card: CardInstance): FormattedStats {
  const stats = card.stats as Record<string, number> || {};

  return {
    economic: {
      value: stats.economic ?? 0,
      label: "Economic",
      color: "text-emerald-500",
    },
    diplomatic: {
      value: stats.diplomatic ?? 0,
      label: "Diplomatic",
      color: "text-blue-500",
    },
    military: {
      value: stats.military ?? 0,
      label: "Military",
      color: "text-red-500",
    },
    social: {
      value: stats.social ?? 0,
      label: "Social",
      color: "text-purple-500",
    },
  };
}

/**
 * Get card aspect ratio class based on size
 * Trading cards maintain a standard aspect ratio of 2.5:3.5 (63:88)
 * @param size - Card display size
 * @returns Tailwind aspect ratio class
 */
export function getCardAspectRatio(size: CardDisplaySize): string {
  // All sizes maintain the standard trading card aspect ratio
  return "aspect-[2.5/3.5]";
}

/**
 * Get card width class based on size
 * @param size - Card display size
 * @returns Tailwind width class
 */
export function getCardWidth(size: CardDisplaySize): string {
  const widthMap: Record<CardDisplaySize, string> = {
    small: "w-32",
    sm: "w-32",
    medium: "w-48",
    md: "w-48",
    large: "w-64",
  };
  return widthMap[size];
}

/**
 * Format market value for display
 * @param value - Market value in IX Points
 * @returns Formatted value string
 */
export function formatMarketValue(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K IX`;
  }
  return `${value.toFixed(0)} IX`;
}

/**
 * Format card supply count
 * @param supply - Total supply count
 * @returns Formatted supply string
 */
export function formatSupply(supply: number): string {
  if (supply >= 1000000) {
    return `${(supply / 1000000).toFixed(1)}M`;
  }
  if (supply >= 1000) {
    return `${(supply / 1000).toFixed(1)}K`;
  }
  return supply.toString();
}

/**
 * Get shimmer animation for rare+ cards
 * Returns CSS animation classes for rarity effects
 * @param rarity - Card rarity tier
 * @param animated - Whether to enable animation (default: true)
 * @returns Tailwind animation class or empty string
 */
export function getShimmerEffect(rarity: CardRarity, animated: boolean = true): string {
  if (!animated) return "";

  // Only shimmer for rare+ cards
  const shouldShimmer = ([
    "RARE" as CardRarity,
    "ULTRA_RARE" as CardRarity,
    "EPIC" as CardRarity,
    "LEGENDARY" as CardRarity,
  ] as CardRarity[]).includes(rarity);

  if (!shouldShimmer) return "";

  // Legendary gets rainbow shimmer
  if (rarity === ("LEGENDARY" as CardRarity)) {
    return "animate-shimmer-rainbow";
  }

  // Epic+ gets standard shimmer
  if ((["EPIC" as CardRarity, "ULTRA_RARE" as CardRarity] as CardRarity[]).includes(rarity)) {
    return "animate-shimmer";
  }

  return "";
}

/**
 * Calculate card rarity percentage (for progress bars)
 * @param rarity - Card rarity tier
 * @returns Percentage value (0-100)
 */
export function getRarityPercentage(rarity: CardRarity): number {
  const percentages: Record<CardRarity, number> = {
    [CardRarity.COMMON]: 16.67,
    [CardRarity.UNCOMMON]: 33.33,
    [CardRarity.RARE]: 50,
    [CardRarity.ULTRA_RARE]: 66.67,
    [CardRarity.EPIC]: 83.33,
    [CardRarity.LEGENDARY]: 100,
  };
  return percentages[rarity] ?? 0;
}

/**
 * Get owner count display string
 * @param owners - Array of card ownerships
 * @returns Formatted owner count
 */
export function getOwnerCount(owners?: Array<{ userId: string; ownerId: string }>): string {
  if (!owners || owners.length === 0) return "No owners";

  // Each CardOwnership record represents one unique card instance
  const uniqueOwners = new Set(owners.map((o) => o.ownerId)).size;
  const totalCards = owners.length;

  if (uniqueOwners === 1) return "1 owner";
  return `${uniqueOwners} owners (${totalCards} total)`;
}

/**
 * Check if card is newly acquired (within last 7 days)
 * @param acquiredDate - Date card was acquired
 * @returns Boolean indicating if card is new
 */
export function isNewCard(acquiredDate?: Date): boolean {
  if (!acquiredDate) return false;

  const daysSinceAcquired = Math.floor(
    (Date.now() - new Date(acquiredDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceAcquired <= 7;
}

/**
 * Get card type label for display
 * @param type - Card type enum value
 * @returns Human-readable label
 */
export function getCardTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    NATION: "Nation",
    LORE: "Lore",
    NS_IMPORT: "NS Import",
    SPECIAL: "Special",
    COMMUNITY: "Community",
  };
  return labels[type] ?? type;
}
