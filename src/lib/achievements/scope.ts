/**
 * Which achievements belong to the account (IxnayID) and which need a country.
 *
 * Account-level achievements read only data that follows the person — tenure, other
 * unlocks, their own ThinkPages posts and their card collection — so they evaluate and
 * unlock for a user with no country. Everything else (GDP, population, military,
 * embassies, government, followers of a country) keeps needing one.
 */
import { getAchievementById } from "./definitions";

/** Metrics computed from the user, never from a country. */
export const ACCOUNT_LEVEL_METRICS: ReadonlySet<string> = new Set([
  "always_true",
  "daysActive",
  "totalAchievements",
  "thinkpageCount",
  "trendingPostCount",
  "loreCardCount",
  "retiredCardCount",
  "distinctCountryIdCount",
  "recruitedCount",
]);

/** Recruiter achievements (approved invited claims): achievements only, no IxCredits or cards (owner ruling). */
export const RECRUITER_ACHIEVEMENT_IDS: ReadonlySet<string> = new Set([
  "social-recruiter",
  "social-envoy",
  "social-founders-hand",
]);

/** Built-in definitions whose condition reads only account-level metrics. */
export const ACCOUNT_LEVEL_ACHIEVEMENT_IDS: ReadonlySet<string> = new Set([
  // General: sign-up, tenure, achievement count
  "gen-welcome",
  "gen-one-week",
  "gen-one-month",
  "gen-three-months",
  "gen-one-year",
  "gen-achievement-hunter",
  "gen-achievement-master",
  "gen-achievement-legend",
  "vid-end-of-days",
  "vid-annual",
  "meme-ns-ref",
  // Social: the user's own ThinkPages posts
  "social-first-thinkpage",
  "social-thinkpage-author",
  "social-prolific-author",
  "social-trending",
  "lore-scholar",
  // Vault collection
  "collect-lore-keeper",
  "collect-archaeologist",
  "collect-diplomat",
  // Recruiting: approved claims filed through the user's invite links
  ...RECRUITER_ACHIEVEMENT_IDS,
]);

/**
 * True when the achievement needs country data to evaluate. Built-in definitions use the
 * id list above; an admin-authored row without a built-in definition is account-level
 * when its `conditionJson` rule reads an account-level metric.
 */
export function achievementRequiresCountry(achievement: {
  key: string;
  conditionJson?: string | null;
}): boolean {
  if (ACCOUNT_LEVEL_ACHIEVEMENT_IDS.has(achievement.key)) return false;
  if (getAchievementById(achievement.key)) return true;
  if (achievement.conditionJson) {
    try {
      const rule = JSON.parse(achievement.conditionJson);
      if (rule && typeof rule.metric === "string") return !ACCOUNT_LEVEL_METRICS.has(rule.metric);
    } catch {
      // unparseable rule: treat as country-bound
    }
  }
  return true;
}
