import type React from "react";
import { Archery as Target, Crown as Gem, Flash as Zap, Hexagon } from "iconoir-react";
import type { BadgeVariant } from "~/components/ui/badge";
import {
  getTrophyTier,
  type AchievementItem,
  type GroupedAchievementItem,
  type TrophyTier,
} from "./constants";

/** Trophy tier chip: a Badge variant plus an icon (colour never carries meaning alone). */
export const ACHIEVEMENT_TIER_CONFIG: Record<
  TrophyTier,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: BadgeVariant;
  }
> = {
  platinum: { label: "Legendary", icon: Zap, badge: "warning" },
  gold: { label: "Epic", icon: Gem, badge: "secondary" },
  silver: { label: "Rare", icon: Hexagon, badge: "info" },
  bronze: { label: "Core", icon: Target, badge: "default" },
};

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;

export function toRomanNumeral(index: number): string {
  return ROMAN_NUMERALS[index] ?? String(index + 1);
}

/** Range label for multi-level achievement series (e.g. "Tier I–III"). */
export function formatSeriesTierRange(totalLevels: number): string {
  return `Tier I–${toRomanNumeral(Math.max(0, totalLevels - 1))}`;
}

/** The tier a rarity filter aims at: its first match when unlocked, else the series' current tier. */
export function rarityTierIndex(item: GroupedAchievementItem, selectedRarity: string): number {
  if (selectedRarity !== "all") {
    const matchIdx = item.levels.findIndex((l) => l.rarity === selectedRarity);
    if (matchIdx !== -1 && item.levels[matchIdx]?.isUnlocked) return matchIdx;
  }
  return item.currentTierIndex;
}

export function isSecretLockedLevel(level: AchievementItem): boolean {
  return (level.key.startsWith("vid-") || level.key.startsWith("meme-")) && !level.isUnlocked;
}

export function resolveAchievementCopy(
  level: AchievementItem,
  isSecret: boolean,
  isRevealed: boolean
): { title: string; description: string } {
  if (isSecret && !isRevealed) {
    return {
      title: "Hidden achievement",
      description: "Hidden achievement · Earn to reveal",
    };
  }
  return {
    title: level.title,
    description: level.description,
  };
}

export function formatShortUnlockDate(unlockedAt: string | null | undefined): string | null {
  if (!unlockedAt) return null;
  return new Date(unlockedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function resolveTierBadge(rarity: string) {
  return ACHIEVEMENT_TIER_CONFIG[getTrophyTier(rarity)];
}
