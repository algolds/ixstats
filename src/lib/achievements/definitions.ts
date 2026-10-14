/**
 * Achievement definitions: the types, and lookups over the registered sets (./sets).
 *
 * Each achievement includes:
 * - Unique ID and metadata (title, description, icon key)
 * - Category and rarity classification
 * - Point value for leaderboard scoring
 * - A `rule` (single-metric trigger synced to the database) and/or a `condition` function
 * - `retired` for Legacy achievements, which never evaluate
 */

import type { IconKey } from "./icons";
import { ALL_DEFINITIONS } from "./sets";

export type AchievementCategory =
  | "Executive"
  | "Politics"
  | "Diplomacy"
  | "Defense"
  | "Nation"
  | "Social"
  | "Wiki"
  | "Cards"
  | "Lorewards"
  | "General";

export type AchievementRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

/**
 * Country data interface for achievement conditions
 * Subset of full Country model with fields used for achievement checking
 */
export interface CountryDataForAchievements {
  // Core economic metrics
  currentTotalGdp: number;
  currentGdpPerCapita: number;
  currentPopulation: number;
  economicTier: string;

  // Growth metrics
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  actualGdpGrowth: number;

  // Economic indicators
  unemploymentRate?: number | null;
  inflationRate?: number | null;
  taxRevenueGDPPercent?: number | null;

  // Social metrics
  lifeExpectancy?: number | null;
  literacyRate?: number | null;

  // Metadata
  createdAt: Date;
  id: string;
}

/**
 * Extended data for complex achievement conditions
 * Includes relational counts and external data
 */
export interface ExtendedAchievementData {
  country: CountryDataForAchievements;

  // Diplomatic counts
  embassyCount?: number;

  // Military data
  militaryBranchCount?: number;
  totalMilitaryPersonnel?: number;

  // Government data
  atomicComponentCount?: number;

  // Social platform metrics
  thinkpageCount?: number;
  followerCount?: number;
  /** Approved story chains of the country (src/server/modules/action-links). */
  storyChainCount?: number;
  trendingPostCount?: number;

  // Activity metrics
  daysActive?: number;
  totalAchievements?: number;
  /** Keys of every achievement the user holds, Legacy included (the `vid-end-of-days` condition). */
  existingKeys?: readonly string[];
  /** Whether the user has a country (the `gen-first-country` rule). */
  countryClaimed?: boolean;

  // Card metrics
  loreCardCount?: number;
  retiredCardCount?: number;
  distinctCountryIdCount?: number;

  /** Approved realm claims naming the user as inviter (`RealmClaim.invitedByUserId`). */
  recruitedCount?: number;

  /** What the registered metric loaders returned (`metrics/registry.ts`); rules read it before the fields above. */
  metrics?: Readonly<Record<string, number>>;
}

/**
 * Evaluation data for a user with no country: only account-level achievements
 * (see `scope.ts`) are evaluated against it.
 */
export type AccountAchievementData = Omit<ExtendedAchievementData, "country"> & {
  country?: undefined;
};

/**
 * Baseline trigger synced to the database: [trigger type, metric, operator, threshold].
 * `["EXECUTIVE", "steadyHandWeeks", ">=", 1]` unlocks when `data.metrics.steadyHandWeeks >= 1`.
 */
export type FixedCondition = [
  triggerType: string,
  metric: string,
  operator: string,
  value: number | string | boolean,
];

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  points: number;
  /** One of `ACHIEVEMENT_ICON_KEYS`; stored in `Achievement.iconUrl`. */
  icon: IconKey;

  /** Single-metric trigger. The metric's source (a loader or a field of the data) decides whether it needs a country. */
  rule?: FixedCondition;
  /**
   * Condition function for what one rule cannot express (synced as CUSTOM). Evaluated only when
   * no rule applies.
   */
  condition?: (data: ExtendedAchievementData) => boolean;
  /** A `condition` that reads no country data, so it evaluates for users without a country. */
  accountLevel?: true;
  /** Legacy: never evaluates; the sync marks it inactive and existing unlocks stay. */
  retired?: true;
}

/** The `{ metric, operator, value }` object stored in `Achievement.conditionJson`. */
export function ruleToJson([, metric, operator, value]: FixedCondition) {
  return { metric, operator, value };
}

/**
 * Get achievement definition by ID
 */
export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ALL_DEFINITIONS.find((achievement) => achievement.id === id);
}

/**
 * Get achievement statistics
 */
export function getAchievementStats() {
  const stats = {
    total: ALL_DEFINITIONS.length,
    byCategory: {} as Record<AchievementCategory, number>,
    byRarity: {} as Record<AchievementRarity, number>,
    totalPoints: 0,
  };

  for (const achievement of ALL_DEFINITIONS) {
    // Count by category
    stats.byCategory[achievement.category] = (stats.byCategory[achievement.category] ?? 0) + 1;

    // Count by rarity
    stats.byRarity[achievement.rarity] = (stats.byRarity[achievement.rarity] ?? 0) + 1;

    // Sum total points
    stats.totalPoints += achievement.points;
  }

  return stats;
}
