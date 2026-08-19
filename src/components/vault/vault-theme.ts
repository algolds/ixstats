/**
 * Centralized, strongly-typed theme tokens & helpers for the IxVault system.
 */

export type CardRarity = "LEGENDARY" | "EPIC" | "ULTRA_RARE" | "RARE" | "UNCOMMON" | "COMMON";

export interface RarityThemeConfig {
  glow: string;
  border: string;
  text: string;
  badgeStyle: string;
}

export const RARITY_THEME_MAP: Record<CardRarity, RarityThemeConfig> = {
  LEGENDARY: {
    glow: "rgba(234,179,8,0.25)",
    border: "rgba(234,179,8,0.35)",
    text: "text-amber-600 dark:text-amber-400",
    badgeStyle: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
  EPIC: {
    glow: "rgba(168,85,247,0.25)",
    border: "rgba(168,85,247,0.35)",
    text: "text-purple-600 dark:text-purple-400",
    badgeStyle: "border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10",
  },
  ULTRA_RARE: {
    glow: "rgba(239,68,68,0.25)",
    border: "rgba(239,68,68,0.35)",
    text: "text-red-600 dark:text-red-400",
    badgeStyle: "border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10",
  },
  RARE: {
    glow: "rgba(59,130,246,0.25)",
    border: "rgba(59,130,246,0.35)",
    text: "text-blue-600 dark:text-blue-400",
    badgeStyle: "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  UNCOMMON: {
    glow: "rgba(34,197,94,0.25)",
    border: "rgba(34,197,94,0.35)",
    text: "text-green-600 dark:text-green-400",
    badgeStyle: "border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10",
  },
  COMMON: {
    glow: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.1)",
    text: "text-slate-400",
    badgeStyle: "border-slate-500/20 text-slate-400 bg-slate-500/5",
  },
};

/**
 * Normalizes rarity string to canonical CardRarity enum key.
 */
export function normalizeRarity(rarity?: string | null): CardRarity {
  if (!rarity) return "COMMON";
  const upper = rarity.toUpperCase();
  if (upper in RARITY_THEME_MAP) {
    return upper as CardRarity;
  }
  return "COMMON";
}

/**
 * Returns RGBA glow string for card rarity.
 */
export function getRarityGlow(rarity?: string | null): string {
  return RARITY_THEME_MAP[normalizeRarity(rarity)].glow;
}

/**
 * Returns RGBA border color string for card rarity.
 */
export function getRarityBorder(rarity?: string | null): string {
  return RARITY_THEME_MAP[normalizeRarity(rarity)].border;
}

/**
 * Returns full theme configuration object for card rarity.
 */
export function getRarityTheme(rarity?: string | null): RarityThemeConfig {
  return RARITY_THEME_MAP[normalizeRarity(rarity)];
}
