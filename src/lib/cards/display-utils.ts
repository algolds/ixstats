/**
 * Card Display Utilities
 * Helper functions for card display components
 * Phase 1: Card Display Components
 */

import { CardRarity } from "./enums";
import type {
  CardInstance,
  FormattedStats,
  FormattedStatEntry,
  FormattedSpecialStatEntry,
  RarityConfig,
  CardDisplaySize,
} from "~/types/cards-display";
import {
  getBaseStatDefs,
  getSpecialStatsForType,
  STAT_PROGRESSION,
  LEGACY_KEY_MAP,
  normalizeSpecialStat,
  formatCompactValue,
} from "./stat-config";
import { computeSpecialStats, type SpecialStats } from "~/lib/country-geo";
import { rgbToHex } from "~/lib/color";

/** Artwork shown when a card has none (a tracked asset in public/). */
export const CARD_ARTWORK_PLACEHOLDER = "/images/placeholder-flag.svg";

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
  MYTHIC: "MYTHIC",
  DIVINE: "DIVINE",
} as const;

type CardRarityType = (typeof CARD_RARITIES)[keyof typeof CARD_RARITIES];

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
    rgb: "148,163,184",
    badgeStyle: "border-slate-500/20 text-slate-400 bg-slate-500/5",
  },
  [CARD_RARITIES.UNCOMMON]: {
    color: "text-emerald-400",
    glowColor: "shadow-emerald-500/50",
    glowIntensity: "shadow-md",
    borderColor: "border-emerald-500/30",
    label: "Uncommon",
    rgb: "16,185,129",
    badgeStyle: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  [CARD_RARITIES.RARE]: {
    color: "text-blue-400",
    glowColor: "shadow-blue-500/60",
    glowIntensity: "shadow-lg",
    borderColor: "border-blue-500/40",
    label: "Rare",
    rgb: "59,130,246",
    badgeStyle: "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  [CARD_RARITIES.ULTRA_RARE]: {
    color: "text-cyan-400",
    glowColor: "shadow-cyan-500/70",
    glowIntensity: "shadow-xl",
    borderColor: "border-cyan-500/50",
    label: "Ultra Rare",
    rgb: "6,182,212",
    badgeStyle: "border-cyan-500/30 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10",
  },
  [CARD_RARITIES.EPIC]: {
    color: "text-purple-400",
    glowColor: "shadow-purple-500/80",
    glowIntensity: "shadow-2xl",
    borderColor: "border-purple-500/60",
    label: "Epic",
    rgb: "168,85,247",
    badgeStyle: "border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10",
  },
  [CARD_RARITIES.LEGENDARY]: {
    color: "text-amber-400",
    glowColor: "shadow-amber-400/90",
    glowIntensity: "shadow-2xl",
    borderColor: "border-amber-400/70",
    label: "Legendary",
    rgb: "234,179,8",
    badgeStyle: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
  [CARD_RARITIES.MYTHIC]: {
    color: "text-rose-400",
    glowColor: "shadow-rose-500/90",
    glowIntensity: "shadow-2xl",
    borderColor: "border-rose-500/80",
    label: "Mythic",
    rgb: "244,63,94",
    badgeStyle: "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10",
  },
  [CARD_RARITIES.DIVINE]: {
    color: "text-yellow-200",
    glowColor: "shadow-yellow-200/100",
    glowIntensity: "shadow-2xl",
    borderColor: "border-yellow-200/90",
    label: "Divine",
    rgb: "254,240,138",
    badgeStyle: "border-yellow-200/40 text-yellow-700 dark:text-yellow-200 bg-yellow-200/10",
  },
};

/** Canonical rarity key from any casing; unknown values fall back to COMMON. */
export function normalizeRarity(rarity?: string | null): CardRarityType {
  const upper = rarity?.toUpperCase();
  return upper && upper in RARITY_COLORS ? (upper as CardRarityType) : CARD_RARITIES.COMMON;
}

/** `rgba()` glow colour for inline styles (IxVault cards, auction rows). */
function getRarityGlowRgba(rarity?: string | null): string {
  return `rgba(${RARITY_COLORS[normalizeRarity(rarity)]!.rgb},0.25)`;
}

/** `rgba()` border colour for inline styles. */
function getRarityBorderRgba(rarity?: string | null): string {
  return `rgba(${RARITY_COLORS[normalizeRarity(rarity)]!.rgb},0.35)`;
}

/**
 * Inline-style theme for a rarity (glow/border rgba strings plus text and badge classes).
 * Replaces the second palette that lived in `components/vault/vault-theme.ts`.
 */
export function getRarityTheme(rarity?: string | null): {
  glow: string;
  border: string;
  text: string;
  badgeStyle: string;
} {
  const config = RARITY_COLORS[normalizeRarity(rarity)]!;
  return {
    glow: getRarityGlowRgba(rarity),
    border: getRarityBorderRgba(rarity),
    text: config.color,
    badgeStyle: config.badgeStyle,
  };
}

/** `#rrggbb` rarity colour for effects that append a hex alpha (pack-opening glows, particles). */
export function getRarityHex(rarity?: string | null): string {
  const [r = 0, g = 0, b = 0] = RARITY_COLORS[normalizeRarity(rarity)]!.rgb.split(",").map(Number);
  return rgbToHex(r, g, b);
}

/** Rank in schema order: 1 (COMMON) … 6 (LEGENDARY); 0 for anything else. */
export function getRarityTier(rarity?: string | null): number {
  return (Object.values(CardRarity) as string[]).indexOf(rarity ?? "") + 1;
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
 * Resolve raw stat values from a card instance, translating legacy keys
 */
function resolveCardStats(card: CardInstance): Record<string, number> {
  let stats = card.stats ?? {};

  if (Object.keys(stats).length === 0 && card.metadata) {
    const metaStats = (card.metadata as Record<string, unknown>)?.stats;
    if (metaStats && typeof metaStats === "object" && !Array.isArray(metaStats)) {
      stats = metaStats as Record<string, number>;
    }
  }

  const baseStats = card.baseStats ?? stats;

  if (Object.keys(baseStats).length === 0 && stats.historicalSignificance !== undefined) {
    return {
      force: Math.round(Math.min((stats.preserved ?? stats.rarity ?? 0) * 0.3, 100)),
      wealth: Math.round(Math.min((stats.culturalImpact ?? 0) * 0.5, 100)),
      influence: Math.round(Math.min((stats.rarity ?? 0) * 0.2, 100)),
      legacy: Math.round(Math.min((stats.historicalSignificance ?? 0) * 0.5, 100)),
    };
  }

  const resolved: Record<string, number> = {};
  const source = Object.keys(baseStats).length > 0 ? baseStats : stats;

  for (const [oldKey, val] of Object.entries(source)) {
    const newKey = LEGACY_KEY_MAP[oldKey] ?? oldKey;
    resolved[newKey] = val as number;
  }

  return resolved;
}

/**
 * Format special stats for a card instance
 */
function formatSpecialStats(card: CardInstance): FormattedSpecialStatEntry[] {
  const specialDefs = getSpecialStatsForType(
    card.cardType as unknown as import("./enums").CardType
  );
  if (specialDefs.length === 0) return [];

  const rawSpecials: Record<string, number> =
    (card.attributes?.specials as Record<string, number>) ?? {};

  const hasSpecials = Object.keys(rawSpecials).length > 0;

  if (!hasSpecials) {
    const computed = computeSpecialStats({
      cardType: card.cardType,
      attributes: card.attributes,
      nsData: card.nsData,
      country: card.country,
    });
    const computedEntries: FormattedSpecialStatEntry[] = [];
    for (const def of specialDefs) {
      const label = computed[def.key as keyof SpecialStats];
      if (label) {
        computedEntries.push({
          normalizedValue: label,
          rawValue: 0,
          formattedRaw: label,
          def,
        });
      }
    }
    return computedEntries;
  }

  return specialDefs
    .map((def) => {
      const rawValue = rawSpecials[def.key] ?? 0;
      const normalizedValue = normalizeSpecialStat(def.key, rawValue);
      return {
        normalizedValue,
        rawValue,
        formattedRaw: formatCompactValue(rawValue),
        def,
      };
    })
    .filter((s) => s.rawValue > 0);
}

/**
 * Format card stats for display
 * Extracts and formats stats from card instance
 * @param card - Card instance with stats JSON
 * @returns Formatted stats object with labels and colors
 */
export function formatCardStats(card: CardInstance): FormattedStats {
  const rawStats = resolveCardStats(card);
  const level = card.level ?? 1;
  const boost = (level - 1) * STAT_PROGRESSION.boostPerLevel;
  const baseStatDefs = getBaseStatDefs();

  const base: Record<string, FormattedStatEntry> = {};
  let hasAnyBase = false;

  for (const def of baseStatDefs) {
    const rawVal = rawStats[def.key] ?? 0;
    const baseVal = rawStats[`base_${def.key}`] ?? rawVal;
    const capped = Math.min(baseVal + boost, STAT_PROGRESSION.cap);
    base[def.key] = {
      value: capped,
      baseValue: baseVal,
      bonus: boost,
      def,
    };
    if (capped > 0) hasAnyBase = true;
  }

  const specials = formatSpecialStats(card);

  if (!hasAnyBase) {
    return {
      base: {},
      specials,
      level,
      totalBoost: boost,
    };
  }

  return { base, specials, level, totalBoost: boost };
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
 * Get shimmer animation for rare+ cards
 * Returns CSS animation classes for rarity effects
 * @param rarity - Card rarity tier
 * @param animated - Whether to enable animation (default: true)
 * @returns Tailwind animation class or empty string
 */
export function getShimmerEffect(rarity: CardRarity, animated: boolean = true): string {
  if (!animated) return "";

  // Only shimmer for rare+ cards
  const shouldShimmer = (
    [
      "RARE" as CardRarity,
      "ULTRA_RARE" as CardRarity,
      "EPIC" as CardRarity,
      "LEGENDARY" as CardRarity,
    ] as CardRarity[]
  ).includes(rarity);

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
 * Get owner count display string
 * @param owners - Array of card ownerships
 * @returns Formatted owner count
 */
export function getOwnerCount(
  owners?: Array<{ userId: string; quantity: number; acquiredDate: Date; acquiredMethod: string }>
): string {
  if (!owners || owners.length === 0) return "No owners";

  // Each CardOwnership record represents one unique card instance
  const uniqueOwners = owners.length;
  const totalCards = owners.reduce((sum, o) => sum + o.quantity, 0);

  if (uniqueOwners === 1) return "1 owner";
  return `${uniqueOwners} owners (${totalCards} total)`;
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

/**
 * Format an 8-digit serial number for a card instance
 */
export function getCardSerialNumber(card?: CardInstance | null): string {
  if (!card) return "00049281";
  const rawCard = card as unknown as Record<string, unknown>;
  if (rawCard.mintNumber) {
    return String(rawCard.mintNumber).padStart(8, "0");
  }
  if (card.nsCardId) {
    return String(card.nsCardId).padStart(8, "0");
  }
  if (card.id) {
    let hash = 0;
    for (let i = 0; i < card.id.length; i++) {
      hash = (hash << 5) - hash + card.id.charCodeAt(i);
      hash |= 0;
    }
    const num = Math.abs(hash % 90000000) + 10000000;
    return String(num);
  }
  return "00049281";
}

/**
 * Format edition label for a card instance
 */
export function getCardEditionLabel(card?: CardInstance | null): string {
  if (!card) return "1ST EDITION";
  if (card.season) {
    return `SEASON ${card.season}`;
  }
  return "1ST EDITION";
}
