/**
 * Which achievements belong to the account (IxnayID) and which need a country.
 *
 * Account-level achievements read only data that follows the person: tenure, other unlocks, their
 * own ThinkPages posts, their card collection, and the metrics of every account-scope loader
 * (`metrics/registry.ts`). They evaluate and unlock for a user with no country. A definition is
 * account-level when its rule reads such a metric, or when it says `accountLevel`; everything else
 * (GDP, military, embassies, government, followers of a country, country-scope loaders) needs one.
 */
import { getAchievementById } from "./definitions";
import { METRIC_LOADERS } from "./metrics/registry";

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

/** True when the metric follows the user rather than a country. */
function isAccountMetric(metric: string): boolean {
  return (
    ACCOUNT_LEVEL_METRICS.has(metric) ||
    METRIC_LOADERS.some((loader) => loader.scope === "account" && loader.keys.includes(metric))
  );
}

/**
 * True when the achievement needs country data to evaluate. Built-in definitions decide by their
 * rule's metric (or `accountLevel`); an admin-authored row without a built-in definition is
 * account-level when its `conditionJson` rule reads an account-level metric.
 */
export function achievementRequiresCountry(achievement: {
  key: string;
  conditionJson?: string | null;
}): boolean {
  const definition = getAchievementById(achievement.key);
  if (definition)
    return definition.rule ? !isAccountMetric(definition.rule[1]) : !definition.accountLevel;
  if (achievement.conditionJson) {
    try {
      const rule = JSON.parse(achievement.conditionJson);
      if (rule && typeof rule.metric === "string") return !isAccountMetric(rule.metric);
    } catch {
      // unparseable rule: treat as country-bound
    }
  }
  return true;
}
