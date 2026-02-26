/**
 * Card Display Utilities
 * Helper functions for card display components
 * Phase 1: Card Display Components
 */

import { CardRarity } from "~/lib/card-enums";
import type { CardInstance, FormattedStats, RarityConfig, CardDisplaySize } from "~/types/cards-display";

/**
 * Rarity constants (matching database string values)
 */
export const CARD_RARITIES = {
  COMMON: "COMMON",
  UNCOMMON: "UNCOMMON",
  RARE: "RARE",
  ULTRA_RARE: "ULTRA_RARE",
  EPIC: "EPIC",
  LEGENDARY: "LEGENDARY",
} as const;

export type CardRarityType = typeof CARD_RARITIES[keyof typeof CARD_RARITIES];

/**
 * Rarity color mappings with Tailwind classes
 * Enhanced color hierarchy for instant visual identification
 */
const RARITY_COLORS: Record<string, RarityConfig> = {
  [CARD_RARITIES.COMMON]: {
    color: "text-slate-400",
    glowColor: "shadow-slate-500/40",
    glowIntensity: "shadow-sm",
    borderColor: "border-slate-500/20",
    label: "Common",
  },
  [CARD_RARITIES.UNCOMMON]: {
    color: "text-emerald-400",
    glowColor: "shadow-emerald-500/50",
    glowIntensity: "shadow-md",
    borderColor: "border-emerald-500/30",
    label: "Uncommon",
  },
  [CARD_RARITIES.RARE]: {
    color: "text-cyan-400",
    glowColor: "shadow-cyan-500/60",
    glowIntensity: "shadow-lg",
    borderColor: "border-cyan-500/40",
    label: "Rare",
  },
  [CARD_RARITIES.ULTRA_RARE]: {
    color: "text-violet-400",
    glowColor: "shadow-violet-500/70",
    glowIntensity: "shadow-xl",
    borderColor: "border-violet-500/50",
    label: "Ultra Rare",
  },
  [CARD_RARITIES.EPIC]: {
    color: "text-orange-400",
    glowColor: "shadow-orange-500/80",
    glowIntensity: "shadow-2xl",
    borderColor: "border-orange-500/60",
    label: "Epic",
  },
  [CARD_RARITIES.LEGENDARY]: {
    color: "text-yellow-300",
    glowColor: "shadow-yellow-400/90",
    glowIntensity: "shadow-2xl",
    borderColor: "border-yellow-400/70",
    label: "Legendary",
  },
};

/**
 * Get Tailwind color class for card rarity
 * @param rarity - Card rarity tier
 * @returns Tailwind color class string
 */
export function getRarityColor(rarity: string): string {
  return RARITY_COLORS[rarity]?.color ?? RARITY_COLORS[CARD_RARITIES.COMMON]!.color;
}

/**
 * Get glow intensity class for card rarity
 * Used for hover states and card borders
 * @param rarity - Card rarity tier
 * @returns Tailwind shadow class string
 */
export function getRarityGlow(rarity: string): string {
  const config = RARITY_COLORS[rarity] ?? RARITY_COLORS[CARD_RARITIES.COMMON]!;
  return `${config.glowIntensity} ${config.glowColor}`;
}

/**
 * Get full rarity configuration
 * @param rarity - Card rarity tier
 * @returns Complete rarity configuration object
 */
export function getRarityConfig(rarity: string): RarityConfig {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS[CARD_RARITIES.COMMON]!;
}

/**
 * Enhanced visual hierarchy configuration for rarity
 * Provides complete styling information including gradients, patterns, and visual markers
 * @param rarity - Card rarity tier
 * @returns Visual hierarchy configuration
 */
export function getRarityVisualHierarchy(rarity: string): {
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor?: string;
  borderGradient: string;
  glowAnimation: string;
  backgroundTexture: string;
  badgeStyle: string;
} {
  const configs: Record<string, {
    primaryColor: string;
    secondaryColor: string;
    tertiaryColor?: string;
    borderGradient: string;
    glowAnimation: string;
    backgroundTexture: string;
    badgeStyle: string;
  }> = {
    [CARD_RARITIES.COMMON]: {
      primaryColor: "#94a3b8", // slate-400
      secondaryColor: "#64748b", // slate-500
      borderGradient: "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 50%, #64748b 100%)",
      glowAnimation: "none",
      backgroundTexture: "none",
      badgeStyle: "bg-slate-500/20 border-slate-400/30",
    },
    [CARD_RARITIES.UNCOMMON]: {
      primaryColor: "#34d399", // emerald-400
      secondaryColor: "#10b981", // emerald-500
      borderGradient: "linear-gradient(135deg, #6ee7b7 0%, #34d399 50%, #10b981 100%)",
      glowAnimation: "pulse-subtle 3s ease-in-out infinite",
      backgroundTexture: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(16, 185, 129, 0.05) 10px, rgba(16, 185, 129, 0.05) 20px)",
      badgeStyle: "bg-emerald-500/30 border-emerald-400/50",
    },
    [CARD_RARITIES.RARE]: {
      primaryColor: "#22d3ee", // cyan-400
      secondaryColor: "#06b6d4", // cyan-500
      tertiaryColor: "#0891b2", // cyan-600
      borderGradient: "linear-gradient(135deg, #67e8f9 0%, #22d3ee 33%, #06b6d4 66%, #0891b2 100%)",
      glowAnimation: "pulse-medium 2.5s ease-in-out infinite",
      backgroundTexture: "radial-gradient(circle at 30% 30%, rgba(34, 211, 238, 0.1) 0%, transparent 50%)",
      badgeStyle: "bg-cyan-500/40 border-cyan-400/60",
    },
    [CARD_RARITIES.ULTRA_RARE]: {
      primaryColor: "#a78bfa", // violet-400
      secondaryColor: "#8b5cf6", // violet-500
      tertiaryColor: "#7c3aed", // violet-600
      borderGradient: "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 25%, #8b5cf6 50%, #7c3aed 75%, #6d28d9 100%)",
      glowAnimation: "pulse-intense 2s ease-in-out infinite",
      backgroundTexture: "conic-gradient(from 45deg at 50% 50%, rgba(167, 139, 250, 0.1), rgba(139, 92, 246, 0.15), rgba(124, 58, 237, 0.1), rgba(167, 139, 250, 0.1))",
      badgeStyle: "bg-violet-500/50 border-violet-400/70",
    },
    [CARD_RARITIES.EPIC]: {
      primaryColor: "#fb923c", // orange-400
      secondaryColor: "#f97316", // orange-500
      tertiaryColor: "#ef4444", // red-500
      borderGradient: "linear-gradient(135deg, #fdba74 0%, #fb923c 20%, #f97316 40%, #ea580c 60%, #ef4444 80%, #dc2626 100%)",
      glowAnimation: "pulse-epic 1.5s ease-in-out infinite",
      backgroundTexture: "radial-gradient(circle at 50% 50%, rgba(251, 146, 60, 0.15) 0%, rgba(239, 68, 68, 0.1) 50%, transparent 100%)",
      badgeStyle: "bg-gradient-to-r from-orange-500/60 to-red-500/60 border-orange-400/80",
    },
    [CARD_RARITIES.LEGENDARY]: {
      primaryColor: "#fcd34d", // yellow-300
      secondaryColor: "#f59e0b", // amber-500
      tertiaryColor: "#a855f7", // purple-500
      borderGradient: "linear-gradient(135deg, #fef3c7 0%, #fcd34d 15%, #fbbf24 30%, #f59e0b 45%, #f97316 60%, #ef4444 75%, #a855f7 90%, #fcd34d 100%)",
      glowAnimation: "pulse-legendary 1s ease-in-out infinite",
      backgroundTexture: "conic-gradient(from 0deg at 50% 50%, rgba(252, 211, 77, 0.2), rgba(245, 158, 11, 0.2), rgba(239, 68, 68, 0.2), rgba(168, 85, 247, 0.2), rgba(252, 211, 77, 0.2))",
      badgeStyle: "bg-gradient-to-r from-yellow-400/70 via-orange-400/70 to-purple-500/70 border-yellow-300/90",
    },
  };

  return configs[rarity] ?? configs[CARD_RARITIES.COMMON]!;
}

/**
 * Format card stats for display
 * Extracts and formats stats from card instance
 * @param card - Card instance with stats JSON
 * @returns Formatted stats object with labels and colors
 */
export function formatCardStats(card: CardInstance): FormattedStats {
  let stats = card.stats as Record<string, number> || {};

  // For old lore cards: stats were stored in metadata.stats, not the stats column
  if (Object.keys(stats).length === 0 && card.metadata) {
    const metaStats = (card.metadata as Record<string, unknown>)?.stats;
    if (metaStats && typeof metaStats === "object" && !Array.isArray(metaStats)) {
      stats = metaStats as Record<string, number>;
    }
  }

  // Handle legacy lore card stats format (historicalSignificance/culturalImpact/rarity/preserved)
  if (stats.historicalSignificance !== undefined && stats.economic === undefined) {
    return {
      economic: {
        value: Math.round(Math.min((stats.preserved ?? stats.rarity ?? 0) * 0.3, 100)),
        label: "Economic",
        color: "text-emerald-500",
      },
      diplomatic: {
        value: Math.round(Math.min((stats.culturalImpact ?? 0) * 0.5, 100)),
        label: "Diplomatic",
        color: "text-blue-500",
      },
      military: {
        value: Math.round(Math.min((stats.rarity ?? 0) * 0.2, 100)),
        label: "Military",
        color: "text-red-500",
      },
      social: {
        value: Math.round(Math.min((stats.historicalSignificance ?? 0) * 0.5, 100)),
        label: "Social",
        color: "text-purple-500",
      },
    };
  }

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
export function getOwnerCount(owners?: Array<{ userId: string; quantity: number; acquiredDate: Date; acquiredMethod: string }>): string {
  if (!owners || owners.length === 0) return "No owners";

  // Each CardOwnership record represents one unique card instance
  const uniqueOwners = owners.length;
  const totalCards = owners.reduce((sum, o) => sum + o.quantity, 0);

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
