/**
 * Achievement Auto-Unlock Service
 *
 * Centralized logic for evaluating and unlocking achievements. Achievements are keyed
 * by the user's Clerk id. Account-level achievements (see `scope.ts`) evaluate for any
 * user; country achievements evaluate against the user's active country when they have one.
 *
 * Evaluation runs:
 *   - on `/achievements` visits (`achievements.syncMyCollectorAchievements`),
 *   - in the background, from `queueAchievementCheck()` calls at event sites and the
 *     event bus, drained by the worker below (`queue.ts`),
 *   - from the `achievements-evaluate` cron job for recently active users.
 */

import { type Achievement, type Country, type PrismaClient } from "@prisma/client";
import {
  getAchievementById,
  type AccountAchievementData,
  type CountryDataForAchievements,
  type ExtendedAchievementData,
} from "./definitions";
import { getScaleThresholds } from "./scaling";
import { achievementRequiresCountry, RECRUITER_ACHIEVEMENT_IDS } from "./scope";
import { completeAchievementCheck, dequeueAchievementCheck, queueAchievementCheck } from "./queue";
import { achievementBonus, getBonusConfig, grantBonus } from "~/lib/vault/vault-bonus";
import { awardAchievementCard } from "~/lib/cards/card-service";
import { eventBus } from "~/lib/event-bus";
import { ActivityHooks } from "~/lib/activity";
import { notificationHooks } from "~/lib/notifications/hooks";

/** Re-evaluation passes per check, so unlocks that raise `totalAchievements` can cascade. */
const MAX_EVALUATION_PASSES = 3;

/**
 * Records an unlock for the user and pays out its credits, commemorative cards and packs.
 * Returns false when the user already holds the achievement (a concurrent unlock won the race).
 */
async function unlockAchievement(
  db: PrismaClient,
  userId: string,
  achievement: Achievement
): Promise<boolean> {
  // Credit reward scales by rarity (consistent curve, admin-tunable in vault-bonus); recruiting pays nothing
  const creditReward = RECRUITER_ACHIEVEMENT_IDS.has(achievement.key)
    ? 0
    : achievementBonus(await getBonusConfig(db), achievement.rarity);
  let cardIds: string[] = [];
  let packIds: string[] = [];
  let titles: string[] = [];

  if (achievement.rewardsJson) {
    try {
      const rewards = JSON.parse(achievement.rewardsJson);
      if (rewards) {
        if (Array.isArray(rewards.cardIds)) cardIds = rewards.cardIds;
        if (Array.isArray(rewards.cardPacks)) packIds = rewards.cardPacks;
        if (Array.isArray(rewards.titles)) titles = rewards.titles;
      }
    } catch (err) {
      console.error(`[Achievement Service] Failed to parse rewards for ${achievement.key}:`, err);
    }
  }

  // Create UserAchievement record (references Achievement.key)
  try {
    await db.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.key,
        title: achievement.title,
        description: achievement.description,
        category: achievement.category,
        rarity: achievement.rarity,
        iconUrl: achievement.iconUrl,
        metadata: JSON.stringify({
          points: achievement.points,
          unlockedAt: new Date().toISOString(),
          titles,
          rewards: { credits: creditReward, cardIds, packIds, titles },
        }),
      },
    });
  } catch (createErr: any) {
    if (
      createErr?.code === "P2002" ||
      createErr?.message?.includes("Unique constraint") ||
      createErr?.statusCode === 409
    ) {
      return false;
    }
    throw createErr;
  }

  // Award IxCredits (EARN_BONUS — uncapped; one-time per achievement)
  if (creditReward > 0) {
    try {
      await grantBonus(db, userId, `bonus:achievement:${achievement.key}`, creditReward, {
        oneTime: true,
        metadata: {
          achievementId: achievement.key,
          achievementName: achievement.title,
          achievementTier: achievement.rarity,
          achievementCategory: achievement.category,
        },
      });
    } catch (creditError) {
      console.error(
        `[Achievement Service] Error awarding credits for "${achievement.title}":`,
        creditError
      );
    }
  }

  for (const cardId of cardIds) {
    try {
      await awardAchievementCard(db, userId, cardId, achievement.key, achievement.title);
    } catch (cardError) {
      console.error(`[Achievement Service] Error awarding card ${cardId}:`, cardError);
    }
  }

  for (const packId of packIds) {
    try {
      await db.userPack.create({
        data: { userId, packId, isOpened: false, acquiredMethod: "ACHIEVEMENT" },
      });
    } catch (packError) {
      console.error(`[Achievement Service] Error awarding pack ${packId}:`, packError);
    }
  }

  return true;
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
   * Evaluate conditions using hybrid JSON rules engine + hardcoded definitions fallback.
   * Without country data, only account-level achievements can pass.
   */
  evaluateCondition(
    achievement: { key: string; triggerType?: string; conditionJson: string | null },
    data: ExtendedAchievementData | AccountAchievementData
  ): boolean {
    if (!data.country && achievementRequiresCountry(achievement)) return false;

    if (achievement.conditionJson) {
      try {
        const rule = JSON.parse(achievement.conditionJson);
        if (rule && rule.metric) {
          return this.evaluateRule(rule, data);
        }
      } catch (err) {
        console.error(
          `[Achievement Service] Failed to evaluate rules for ${achievement.key}:`,
          err
        );
      }
    }

    const hardcoded = getAchievementById(achievement.key);
    if (hardcoded && hardcoded.condition) {
      try {
        // Safe without a country: account-level conditions never read `data.country`
        return hardcoded.condition(data as ExtendedAchievementData);
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
    rule: { metric: string; operator: string; value?: any; percentile?: number },
    data: ExtendedAchievementData | AccountAchievementData
  ): boolean {
    const { metric, operator } = rule;
    let currentValue: any = undefined;

    if (metric === "always_true") {
      // `gen-welcome`: the stored rule is { metric: "always_true", "==", true }
      currentValue = true;
    } else if (metric in data) {
      currentValue = (data as any)[metric];
    } else if (data.country && metric in data.country) {
      currentValue = (data.country as any)[metric];
    }

    if (currentValue === undefined) {
      return false;
    }

    // Dynamic, distribution-relative threshold (see achievement-scaling.ts).
    // Resolved from the live percentile snapshot attached to the data.
    let value = rule.value;
    if (rule.percentile != null) {
      value =
        data.scaleThresholds?.[metric as keyof typeof data.scaleThresholds]?.[rule.percentile];
      if (value == null) return false; // snapshot unavailable → don't unlock
    }

    switch (operator) {
      case ">=":
        return currentValue >= value;
      case ">":
        return currentValue > value;
      case "<=":
        return currentValue <= value;
      case "<":
        return currentValue < value;
      case "==":
      case "===":
        return currentValue === value;
      case "!=":
      case "!==":
        return currentValue !== value;
      case "contains":
        if (typeof currentValue === "string" && typeof value === "string") {
          return currentValue.toLowerCase().includes(value.toLowerCase());
        }
        return false;
      default:
        return false;
    }
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

      const accountData = await this.gatherAccountData(userId, db);
      const achievementData: ExtendedAchievementData | AccountAchievementData = country
        ? { ...accountData, ...(await this.gatherCountryData(country, db)) }
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
                  achievement.description || `Unlocked ${achievement.rarity} achievement`
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
        achievementsToCheck = achievementsToCheck.filter((a) => !attempted.has(a.key));
      }

      return unlocked;
    } catch (error) {
      console.error("[Achievement Service] Error in checkAndUnlock:", error);
      return [];
    }
  }

  /** Metrics that follow the user (Clerk id), whether or not they have a country. */
  private async gatherAccountData(
    userId: string,
    db: PrismaClient
  ): Promise<AccountAchievementData & { existingKeys: string[] }> {
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
      ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    let loreCardCount = 0;
    let retiredCardCount = 0;
    let distinctCountryIdCount = 0;
    let recruitedCount = 0;

    if (user?.id) {
      const [loreCount, retiredCount, distinctCountries, recruited] = await Promise.all([
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
        db.realmClaim
          .count({ where: { invitedByUserId: user.id, status: "approved" } })
          .catch(() => 0),
      ]);

      loreCardCount = loreCount;
      retiredCardCount = retiredCount;
      distinctCountryIdCount = distinctCountries;
      recruitedCount = recruited;
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
      existingKeys: existingAchievements.map((a) => a.achievementId),
    };
  }

  /** Metrics read from one country. */
  private async gatherCountryData(
    country: Country,
    db: PrismaClient
  ): Promise<Partial<ExtendedAchievementData> & { country: CountryDataForAchievements }> {
    const countryId = country.id;
    const [embassyCount, militaryBranchCount, governmentComponentCount, followerCount] =
      await Promise.all([
        db.embassy.count({
          where: {
            OR: [{ hostCountryId: countryId }, { guestCountryId: countryId }],
            status: "active",
          },
        }),
        db.militaryBranch.count({
          where: { countryId },
        }),
        db.governmentComponent.count({
          where: { countryId },
        }),
        db.countryFollow.count({
          where: { followedCountryId: countryId },
        }),
      ]);

    const militaryBranches = await db.militaryBranch.findMany({
      where: { countryId },
      select: {
        activeDuty: true,
        reserves: true,
        civilianStaff: true,
        annualBudget: true,
      },
    });

    const totalMilitaryPersonnel = militaryBranches.reduce(
      (sum, branch) => sum + branch.activeDuty + branch.reserves,
      0
    );

    const totalMilitaryBudget = militaryBranches.reduce(
      (sum, branch) => sum + (branch.annualBudget ?? 0),
      0
    );

    const militarySpendingPercent =
      country.currentTotalGdp > 0 ? (totalMilitaryBudget / country.currentTotalGdp) * 100 : 0;

    const [treatyCount, tradePartnerCount, allianceCount] = await Promise.all([
      db.treaty
        .count({
          where: {
            parties: { contains: countryId },
            status: "active",
          },
        })
        .catch(() => 0),
      db.diplomaticRelation
        .count({
          where: {
            OR: [{ country1: countryId }, { country2: countryId }],
            tradeVolume: { gt: 0 },
            status: "active",
          },
        })
        .catch(() => 0),
      db.allianceMember
        .count({
          where: {
            countryId,
            isActive: true,
          },
        })
        .catch(() => 0),
    ]);

    // Live percentile thresholds for scale achievements (cached, see scaling module)
    const scaleThresholds = await getScaleThresholds(db).catch(() => ({}));

    return {
      scaleThresholds,
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
      treatyCount,
      tradePartnerCount,
      allianceCount,
      militaryBranchCount,
      militarySpendingPercent,
      totalMilitaryPersonnel,
      atomicComponentCount: governmentComponentCount,
      governmentType: country.governmentType ?? undefined,
      followerCount,
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
