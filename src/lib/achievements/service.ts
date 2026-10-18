/**
 * Achievement Auto-Unlock Service
 *
 * Centralized logic for evaluating and unlocking achievements. Achievements are keyed
 * by the user's Clerk id. Account-level achievements (see `scope.ts`) evaluate for any
 * user; country achievements evaluate against the user's active country when they have one.
 *
 * Evaluation runs:
 *   - on `/vault/achievements` visits (`achievements.syncMyCollectorAchievements`),
 *   - in the background, from `queueAchievementCheck()` calls at event sites and the
 *     event bus, drained by the worker below (`queue.ts`),
 *   - from the `achievements-evaluate` cron job for recently active users.
 */

import { type Country, type PrismaClient } from "@prisma/client";
import {
  getAchievementById,
  ruleToJson,
  type AccountAchievementData,
  type CountryDataForAchievements,
  type ExtendedAchievementData,
} from "./definitions";
import { METRIC_LOADERS, type MetricContext, type MetricScope } from "./metrics/registry";
import { achievementRequiresCountry } from "./scope";
import { completeAchievementCheck, dequeueAchievementCheck, queueAchievementCheck } from "./queue";
import { unlockAchievement } from "./unlock";
import { countRecruits } from "~/lib/realms/recruits";
import { eventBus } from "~/lib/event-bus";
import { ActivityHooks } from "~/lib/activity";
import { notificationHooks } from "~/lib/notifications/hooks";

/** Re-evaluation passes per check, so unlocks that raise `totalAchievements` can cascade. */
const MAX_EVALUATION_PASSES = 3;

type MetricValue = number | string | boolean;

/** A stored rule: `Achievement.conditionJson`, or a definition's `rule` through `ruleToJson`. */
interface RuleJson {
  metric: string;
  operator: string;
  value?: MetricValue;
}

/** A metric's current value: loader metrics first, then the data's fields, then the country's. */
function readMetric(
  metric: string,
  data: ExtendedAchievementData | AccountAchievementData
): MetricValue | undefined {
  // `gen-welcome`: the stored rule is { metric: "always_true", "==", true }
  if (metric === "always_true") return true;
  const fromMetrics = data.metrics?.[metric];
  if (fromMetrics !== undefined) return fromMetrics;
  if (metric in data) return Reflect.get(data, metric) as MetricValue | undefined;
  return data.country && metric in data.country
    ? (Reflect.get(data.country, metric) as MetricValue | undefined)
    : undefined;
}

function compareMetric(operator: string, current: MetricValue, target: MetricValue): boolean {
  switch (operator) {
    case "==":
    case "===":
      return current === target;
    case "!=":
    case "!==":
      return current !== target;
    case "contains":
      return (
        typeof current === "string" &&
        typeof target === "string" &&
        current.toLowerCase().includes(target.toLowerCase())
      );
  }
  if (typeof current !== "number" || typeof target !== "number") return false;
  switch (operator) {
    case ">=":
      return current >= target;
    case ">":
      return current > target;
    case "<=":
      return current <= target;
    case "<":
      return current < target;
    default:
      return false;
  }
}

/**
 * Run every loader of one scope once, in parallel, and merge their metrics. A failing loader
 * contributes nothing (its rules then read as unmet) instead of failing the evaluation.
 */
async function runMetricLoaders(
  scope: MetricScope,
  ctx: MetricContext
): Promise<Record<string, number>> {
  const loaders = METRIC_LOADERS.filter((loader) => loader.scope === scope);
  const results = await Promise.all(
    loaders.map((loader) =>
      loader.load(ctx).catch((error) => {
        console.error(`[Achievement Service] Metric loader ${loader.id} failed:`, error);
        return {} as Record<string, number>;
      })
    )
  );
  return Object.assign({}, ...results);
}

class AchievementService {
  private workerInterval: any = null;
  private workerBusy = false;

  constructor() {
    // Only subscribe and start background worker if we are on server-side
    if (typeof window === "undefined") {
      const events = [
        "country:updated",
        "military:updated",
        "diplomacy:updated",
        "thinkpages:updated",
        "user:login",
        "user:signup",
      ];

      for (const eventName of events) {
        eventBus.subscribe(eventName, (payload: any) => {
          if (payload && payload.userId) {
            queueAchievementCheck(payload.userId, payload.countryId ?? null);
          }
        });
      }

      this.startWorker();
    }
  }

  /**
   * Enqueue a user (and optionally a specific country) for background evaluation
   */
  enqueue(userId: string, countryId?: string | null) {
    queueAchievementCheck(userId, countryId);
  }

  private startWorker() {
    if (process.env.NODE_ENV === "test" || typeof process.env.JEST_WORKER_ID !== "undefined") {
      return;
    }
    this.workerInterval = setInterval(async () => {
      await this.processNextQueueItem();
    }, 1000);
    if (this.workerInterval?.unref) {
      this.workerInterval.unref();
    }
  }

  /** Drain one queued item; returns the keys it unlocked, or null when idle. */
  async processNextQueueItem(db?: PrismaClient): Promise<string[] | null> {
    if (this.workerBusy) return null;
    this.workerBusy = true;
    try {
      const item = await dequeueAchievementCheck();
      if (!item) return null;
      try {
        const client = db ?? (await import("~/server/db")).db;
        return await this.evaluateUser(item.userId, client, item.countryId);
      } catch (err) {
        console.error("[Achievement Service] Error in queue worker:", err);
        return [];
      } finally {
        completeAchievementCheck(item);
      }
    } finally {
      this.workerBusy = false;
    }
  }

  /**
   * Evaluate one user by internal or Clerk id: account-level achievements always, country
   * achievements against `countryId` or else the user's active country. Never throws.
   */
  async evaluateUser(
    userIdOrClerkId: string,
    db: PrismaClient,
    countryId?: string | null
  ): Promise<string[]> {
    try {
      const user = await db.user.findFirst({
        where: { OR: [{ id: userIdOrClerkId }, { clerkUserId: userIdOrClerkId }] },
        select: { clerkUserId: true, countryId: true },
      });
      if (!user?.clerkUserId) return [];
      return await this.checkAndUnlock(user.clerkUserId, countryId ?? user.countryId ?? null, db);
    } catch (error) {
      console.error(`[Achievement Service] evaluateUser failed for ${userIdOrClerkId}:`, error);
      return [];
    }
  }

  /**
   * Evaluate conditions using hybrid JSON rules engine + definitions fallback (the definition's
   * own rule, then its condition). Without country data, only account-level achievements can
   * pass. A retired (Legacy) definition never passes.
   */
  evaluateCondition(
    achievement: { key: string; triggerType?: string; conditionJson: string | null },
    data: ExtendedAchievementData | AccountAchievementData
  ): boolean {
    const definition = getAchievementById(achievement.key);
    if (definition?.retired) return false;
    if (!data.country && achievementRequiresCountry(achievement)) return false;

    if (achievement.conditionJson) {
      try {
        const rule: Partial<RuleJson> | null = JSON.parse(achievement.conditionJson);
        if (rule?.metric) return this.evaluateRule(rule as RuleJson, data);
      } catch (err) {
        console.error(
          `[Achievement Service] Failed to evaluate rules for ${achievement.key}:`,
          err
        );
      }
    }

    if (definition?.rule) return this.evaluateRule(ruleToJson(definition.rule), data);
    if (definition?.condition) {
      try {
        // Safe without a country: account-level conditions never read `data.country`
        return definition.condition(data as ExtendedAchievementData);
      } catch (err) {
        console.error(
          `[Achievement Service] Failed hardcoded condition check for ${achievement.key}:`,
          err
        );
      }
    }

    return false;
  }

  private evaluateRule(
    rule: RuleJson,
    data: ExtendedAchievementData | AccountAchievementData
  ): boolean {
    const current = readMetric(rule.metric, data);
    if (current === undefined || rule.value === undefined) return false;
    return compareMetric(rule.operator, current, rule.value);
  }

  /**
   * Check and auto-unlock achievements for a user (by Clerk id). Account-level
   * achievements always evaluate; country achievements evaluate only when `countryId`
   * names an existing country.
   */
  async checkAndUnlock(
    userId: string,
    countryId: string | null | undefined,
    db: PrismaClient
  ): Promise<string[]> {
    try {
      const country = countryId
        ? await db.country.findUnique({
            where: { id: countryId },
          })
        : null;

      if (countryId && !country) {
        console.warn(
          `[Achievement Service] Country ${countryId} not found; evaluating account-level only`
        );
      }

      const now = new Date();
      const { internalUserId, ...accountData } = await this.gatherAccountData(
        userId,
        country?.id ?? null,
        now,
        db
      );
      const countryData = country
        ? await this.gatherCountryData(country, db, {
            clerkUserId: userId,
            userId: internalUserId,
            now,
          })
        : null;
      const achievementData: ExtendedAchievementData | AccountAchievementData = countryData
        ? {
            ...accountData,
            ...countryData,
            metrics: { ...accountData.metrics, ...countryData.metrics },
          }
        : { ...accountData, countryClaimed: false };

      const alreadyUnlocked = new Set<string>(accountData.existingKeys);

      const activeAchievements = await db.achievement.findMany({
        where: { isActive: true },
      });

      let achievementsToCheck = activeAchievements.filter((a) => !alreadyUnlocked.has(a.key));

      const unlocked: string[] = [];
      const attempted = new Set<string>();
      // Repeat while unlocks raise `totalAchievements`, so meta achievements cascade
      for (let pass = 0; pass < MAX_EVALUATION_PASSES; pass++) {
        const unlockedBefore = unlocked.length;
        for (const achievement of achievementsToCheck) {
          if (this.evaluateCondition(achievement, achievementData)) {
            attempted.add(achievement.key);
            try {
              // Create the unlock record and pay out rewards; skip if a concurrent request already did
              if (!(await unlockAchievement(db, userId, achievement))) continue;
              unlocked.push(achievement.key);
              console.log(
                `[Achievement Service] Unlocked: ${achievement.title} for user ${userId}`
              );

              // Generate Activity Feed Entry
              const userRecord = await db.user.findUnique({
                where: { clerkUserId: userId },
                select: { countryId: true },
              });

              if (userRecord?.countryId) {
                await ActivityHooks.User.onAchievementUnlocked(
                  userId,
                  userRecord.countryId,
                  achievement.title,
                  achievement.description || `Unlocked ${achievement.rarity} achievement`,
                  achievement.key
                ).catch((err) => console.error("Failed to create achievement activity:", err));
              }

              // Notify user via notificationHooks / websocket
              try {
                await notificationHooks.onAchievementUnlock({
                  userId,
                  achievementId: achievement.key,
                  name: achievement.title,
                  description:
                    achievement.description ||
                    `You've unlocked a ${achievement.rarity} achievement!`,
                  category: achievement.category,
                  rarity: (achievement.rarity.toLowerCase() as any) || "common",
                });
              } catch (error) {
                console.error("[Achievements] Failed to send achievement notification:", error);
              }
            } catch (error) {
              console.error(`[Achievement Service] Failed to unlock ${achievement.key}:`, error);
            }
          }
        }
        const newlyUnlocked = unlocked.length - unlockedBefore;
        if (newlyUnlocked === 0) break;
        achievementData.totalAchievements =
          (achievementData.totalAchievements ?? 0) + newlyUnlocked;
        achievementData.existingKeys = [
          ...(achievementData.existingKeys ?? []),
          ...unlocked.slice(unlockedBefore),
        ];
        achievementsToCheck = achievementsToCheck.filter((a) => !attempted.has(a.key));
      }

      return unlocked;
    } catch (error) {
      console.error("[Achievement Service] Error in checkAndUnlock:", error);
      return [];
    }
  }

  /**
   * Metrics that follow the user (Clerk id), whether or not they have a country. Also returns the
   * internal `User.id` (null without a user row) for the country loaders.
   */
  private async gatherAccountData(
    userId: string,
    countryId: string | null,
    now: Date,
    db: PrismaClient
  ): Promise<AccountAchievementData & { existingKeys: string[]; internalUserId: string | null }> {
    const [thinkpageCount, trendingPostCount, existingAchievements, user] = await Promise.all([
      db.thinkpagesPost.count({ where: { account: { clerkUserId: userId } } }).catch(() => 0),
      db.thinkpagesPost
        .count({ where: { account: { clerkUserId: userId }, trending: true } })
        .catch(() => 0),
      db.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true },
      }),
      db.user.findUnique({
        where: { clerkUserId: userId },
        select: { id: true, createdAt: true },
      }),
    ]);

    const daysActive = user
      ? Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    let loreCardCount = 0;
    let retiredCardCount = 0;
    let distinctCountryIdCount = 0;
    let recruitedCount = 0;
    let metrics: Record<string, number> = {};

    if (user?.id) {
      const [loreCount, retiredCount, distinctCountries, recruited, loaded] = await Promise.all([
        db.cardOwnership
          .count({
            where: {
              ownerId: user.id,
              cards: { cardType: "LORE" },
            },
          })
          .catch(() => 0),
        db.cardOwnership
          .count({
            where: {
              ownerId: user.id,
              cards: { isRetired: true } as any,
            },
          })
          .catch(() => 0),
        db.cardOwnership
          .findMany({
            where: { ownerId: user.id },
            select: { cards: { select: { countryId: true } } },
          })
          .then((ownerships) => {
            const countryIds = new Set(ownerships.map((o) => o.cards?.countryId).filter(Boolean));
            return countryIds.size;
          })
          .catch(() => 0),
        countRecruits(db, user.id).catch(() => 0),
        runMetricLoaders("account", { db, clerkUserId: userId, userId: user.id, countryId, now }),
      ]);

      loreCardCount = loreCount;
      retiredCardCount = retiredCount;
      distinctCountryIdCount = distinctCountries;
      recruitedCount = recruited;
      metrics = loaded;
    }

    return {
      thinkpageCount,
      trendingPostCount,
      daysActive,
      totalAchievements: existingAchievements.length,
      loreCardCount,
      retiredCardCount,
      distinctCountryIdCount,
      recruitedCount,
      metrics,
      existingKeys: existingAchievements.map((a) => a.achievementId),
      internalUserId: user?.id ?? null,
    };
  }

  /** Metrics read from one country, plus the country-scope loaders' (skipped without a user row). */
  private async gatherCountryData(
    country: Country,
    db: PrismaClient,
    who: { clerkUserId: string; userId: string | null; now: Date }
  ): Promise<Partial<ExtendedAchievementData> & { country: CountryDataForAchievements }> {
    const countryId = country.id;
    const [
      embassyCount,
      militaryBranches,
      governmentComponentCount,
      followerCount,
      storyChainCount,
      metrics,
    ] = await Promise.all([
      db.embassy.count({
        where: {
          OR: [{ hostCountryId: countryId }, { guestCountryId: countryId }],
          status: "active",
        },
      }),
      db.militaryBranch.findMany({
        where: { countryId },
        select: { activeDuty: true, reserves: true },
      }),
      db.governmentComponent.count({
        where: { countryId },
      }),
      db.countryFollow.count({
        where: { followedCountryId: countryId },
      }),
      db.storyline
        .count({ where: { countryId, kind: "chain", status: "approved" } })
        .catch((error) => {
          console.warn(
            `[Achievements] story chain count for ${countryId} unavailable, using 0:`,
            error
          );
          return 0;
        }),
      who.userId
        ? runMetricLoaders("country", {
            db,
            clerkUserId: who.clerkUserId,
            userId: who.userId,
            countryId,
            now: who.now,
          })
        : Promise.resolve<Record<string, number>>({}),
    ]);

    const totalMilitaryPersonnel = militaryBranches.reduce(
      (sum, branch) => sum + branch.activeDuty + branch.reserves,
      0
    );

    return {
      metrics,
      country: {
        id: country.id,
        currentTotalGdp: country.currentTotalGdp,
        currentGdpPerCapita: country.currentGdpPerCapita,
        currentPopulation: country.currentPopulation,
        economicTier: country.economicTier,
        adjustedGdpGrowth: country.adjustedGdpGrowth,
        populationGrowthRate: country.populationGrowthRate,
        actualGdpGrowth: country.actualGdpGrowth,
        unemploymentRate: country.unemploymentRate,
        inflationRate: country.inflationRate,
        taxRevenueGDPPercent: country.taxRevenueGDPPercent,
        lifeExpectancy: country.lifeExpectancy,
        literacyRate: country.literacyRate,
        createdAt: country.createdAt ?? new Date(),
      },
      countryClaimed: true,
      embassyCount,
      militaryBranchCount: militaryBranches.length,
      totalMilitaryPersonnel,
      atomicComponentCount: governmentComponentCount,
      followerCount,
      storyChainCount,
    };
  }

  async checkAndUnlockCategory(
    userId: string,
    countryId: string,
    db: PrismaClient,
    _category: string
  ): Promise<string[]> {
    return this.checkAndUnlock(userId, countryId, db);
  }

  /**
   * Manually unlock a specific achievement (e.g. via admin or special event)
   */
  async unlockSpecific(userId: string, achievementId: string, db: PrismaClient): Promise<boolean> {
    try {
      const achievement = await db.achievement.findUnique({
        where: { key: achievementId },
      });

      if (!achievement) {
        console.error(`[Achievement Service] Master definition not found for ${achievementId}`);
        return false;
      }

      const existing = await db.userAchievement.findFirst({
        where: {
          userId,
          achievementId,
        },
      });

      if (existing) {
        return false;
      }

      return await unlockAchievement(db, userId, achievement);
    } catch (err) {
      console.error("[Achievement Service] Error in unlockSpecific:", err);
      return false;
    }
  }

  /**
   * Get user's achievement progress
   */
  async getProgress(userId: string, db: PrismaClient) {
    try {
      const unlocked = await db.userAchievement.findMany({
        where: { userId },
      });

      const totalPoints = unlocked.reduce((sum, u) => {
        const metadata = u.metadata ? JSON.parse(u.metadata) : {};
        return sum + (metadata.points || 10);
      }, 0);

      const byCategory = unlocked.reduce(
        (acc, achievement) => {
          acc[achievement.category] = (acc[achievement.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const byRarity = unlocked.reduce(
        (acc, achievement) => {
          acc[achievement.rarity] = (acc[achievement.rarity] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalUnlocked: unlocked.length,
        totalPoints,
        byCategory,
        byRarity,
        recentUnlocks: unlocked
          .sort((a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime())
          .slice(0, 5)
          .map((a) => ({
            id: a.achievementId,
            title: a.title,
            category: a.category,
            rarity: a.rarity,
            unlockedAt: a.unlockedAt.toISOString(),
          })),
      };
    } catch (error) {
      console.error("[Achievement Service] Error getting progress:", error);
      return {
        totalUnlocked: 0,
        totalPoints: 0,
        byCategory: {},
        byRarity: {},
        recentUnlocks: [],
      };
    }
  }
}

export const achievementService = new AchievementService();
