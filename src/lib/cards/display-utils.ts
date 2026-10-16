/**
 * Card display helpers: rarity palette, sizes, labels, serial and edition.
 */

import { CardRarity, type CardType } from "./enums";
import type { CardInstance, RarityConfig, CardDisplaySize } from "~/types/cards-display";
import { rgbToHex } from "~/lib/color";

/** Artwork shown when a card has none (a tracked asset in public/). */
export const CARD_ARTWORK_PLACEHOLDER = "/images/placeholder-flag.svg";

/**
 * Rarity color mappings with Tailwind classes
 * Enhanced color hierarchy for instant visual identification
 */
const RARITY_COLORS: Record<string, RarityConfig> = {
  [CardRarity.COMMON]: {
    color: "text-slate-400",
    glowColor: "shadow-slate-500/40",
    glowIntensity: "shadow-sm",
    borderColor: "border-slate-500/20",
    label: "Common",
    rgb: "148,163,184",
    badgeStyle: "border-slate-500/20 text-slate-400 bg-slate-500/5",
  },
  [CardRarity.UNCOMMON]: {
    color: "text-emerald-400",
    glowColor: "shadow-emerald-500/50",
    glowIntensity: "shadow-md",
    borderColor: "border-emerald-500/30",
    label: "Uncommon",
    rgb: "16,185,129",
    badgeStyle: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  [CardRarity.RARE]: {
    color: "text-blue-400",
    glowColor: "shadow-blue-500/60",
    glowIntensity: "shadow-lg",
    borderColor: "border-blue-500/40",
    label: "Rare",
    rgb: "59,130,246",
    badgeStyle: "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  [CardRarity.ULTRA_RARE]: {
    color: "text-cyan-400",
    glowColor: "shadow-cyan-500/70",
    glowIntensity: "shadow-xl",
    borderColor: "border-cyan-500/50",
    label: "Ultra Rare",
    rgb: "6,182,212",
    badgeStyle: "border-cyan-500/30 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10",
  },
  [CardRarity.EPIC]: {
    color: "text-purple-400",
    glowColor: "shadow-purple-500/80",
    glowIntensity: "shadow-2xl",
    borderColor: "border-purple-500/60",
    label: "Epic",
    rgb: "168,85,247",
    badgeStyle: "border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10",
  },
  [CardRarity.LEGENDARY]: {
    color: "text-amber-400",
    glowColor: "shadow-amber-400/90",
    glowIntensity: "shadow-2xl",
    borderColor: "border-amber-400/70",
    label: "Legendary",
    rgb: "234,179,8",
    badgeStyle: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
};

/** Canonical rarity key from any casing; unknown values (and the retired MYTHIC and DIVINE) fall back to COMMON. */
export function normalizeRarity(rarity?: string | null): CardRarity {
  const upper = rarity?.toUpperCase();
  return upper && upper in RARITY_COLORS ? (upper as CardRarity) : CardRarity.COMMON;
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
  const config = RARITY_COLORS[rarity] ?? RARITY_COLORS[CardRarity.COMMON]!;
  return `${config.glowIntensity} ${config.glowColor}`;
}

/**
 * Get full rarity configuration
 * @param rarity - Card rarity tier
 * @returns Complete rarity configuration object
 */
export function getRarityConfig(rarity: string): RarityConfig {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS[CardRarity.COMMON]!;
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

const CARD_TYPE_LABELS: Record<CardType, string> = {
  LORE: "Lore",
  NATION: "Nation",
  NS: "NationStates",
  SPECIAL: "Special",
  TROPHY: "Trophy",
};

/** The display label of a card type (cards refresh §2.1); an unknown value shows as it is. */
export function getCardTypeLabel(type: string): string {
  return CARD_TYPE_LABELS[type as CardType] ?? type;
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
