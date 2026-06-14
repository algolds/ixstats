/**
 * Achievement Auto-Unlock Service
 *
 * Provides centralized logic for checking and auto-unlocking achievements
 * when country data changes. Now processes unlocks asynchronously via a queue
 * backed by Redis (with local fallback).
 *
 * Usage:
 *   import { achievementService } from '~/lib/achievement-service';
 *   // Now triggered via events or checkAndUnlock directly
 */

import { type PrismaClient } from "@prisma/client";
import { getAchievementById, type ExtendedAchievementData } from "./achievement-definitions";
import { vaultService } from "./vault-service";
// eslint-disable-next-line unused-imports/no-unused-imports
import { getCardRewardForAchievement, hasCardReward } from "./achievement-card-rewards";
import { awardAchievementCard } from "./card-service";
import { eventBus } from "./event-bus";
import { Redis } from "ioredis";
import { ActivityHooks } from "~/lib/activity-hooks";
import { notificationHooks } from "~/lib/notification-hooks";

// Redis client (lazy initialized)
let redisClient: Redis | null = null;
function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL;
  const redisEnabled = process.env.REDIS_ENABLED === "true";
  if (redisUrl && redisEnabled) {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
      });
      redisClient.on("error", (err) => {
        console.warn("[Achievement Service] Redis connection error:", err.message);
      });
      return redisClient;
    } catch (err) {
      console.warn("[Achievement Service] Failed to initialize Redis client:", err);
    }
  }
  return null;
}

export class AchievementService {
  private inMemoryQueue: Array<{ userId: string; countryId: string }> = [];
  private processingSet = new Set<string>();
  private workerInterval: any = null;

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
          if (payload && payload.userId && payload.countryId) {
            this.enqueue(payload.userId, payload.countryId);
          }
        });
      }

      this.startWorker();
    }
  }

  /**
   * Enqueue user country for achievement evaluation
   */
  enqueue(userId: string, countryId: string) {
    const key = `${userId}:${countryId}`;
    if (this.processingSet.has(key)) {
      return;
    }

    this.processingSet.add(key);

    const redis = getRedisClient();
    if (redis && redis.status === "ready") {
      redis.rpush("achievements:queue", JSON.stringify({ userId, countryId })).catch((err) => {
        console.warn("[Achievement Service] Redis enqueue failed, falling back to memory:", err);
        this.inMemoryQueue.push({ userId, countryId });
      });
    } else {
      this.inMemoryQueue.push({ userId, countryId });
    }
  }

  private startWorker() {
    this.workerInterval = setInterval(async () => {
      await this.processNextQueueItem();
    }, 1000);
  }

  private async processNextQueueItem() {
    let item: { userId: string; countryId: string } | null = null;
    const redis = getRedisClient();

    if (redis && redis.status === "ready") {
      try {
        const data = await redis.lpop("achievements:queue");
        if (data) {
          item = JSON.parse(data);
        }
      } catch (err) {
        console.warn("[Achievement Service] Redis lpop failed, fallback to memory:", err);
      }
    }

    if (!item && this.inMemoryQueue.length > 0) {
      item = this.inMemoryQueue.shift() || null;
    }

    if (!item) return;

    const key = `${item.userId}:${item.countryId}`;
    try {
      const { db } = await import("~/server/db");
      await this.checkAndUnlock(item.userId, item.countryId, db);
    } catch (err) {
      console.error("[Achievement Service] Error in queue worker:", err);
    } finally {
      this.processingSet.delete(key);
    }
  }

  private getCreditsForRarity(rarity: string): number {
    const rarityRewards: Record<string, number> = {
      Common: 5,
      Uncommon: 10,
      Rare: 25,
      Epic: 50,
      Legendary: 100,
    };
    return rarityRewards[rarity] || 5;
  }

  /**
   * Evaluate conditions using hybrid JSON rules engine + hardcoded definitions fallback
   */
  private evaluateCondition(
    achievement: { key: string; triggerType: string; conditionJson: string | null },
    data: ExtendedAchievementData
  ): boolean {
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
        return hardcoded.condition(data);
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
    rule: { metric: string; operator: string; value: any },
    data: ExtendedAchievementData
  ): boolean {
    const { metric, operator, value } = rule;
    let currentValue: any = undefined;

    if (metric in data) {
      currentValue = (data as any)[metric];
    } else if (data.country && metric in data.country) {
      currentValue = (data.country as any)[metric];
    }

    if (currentValue === undefined) {
      return false;
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
   * Check and auto-unlock achievements for a user/country
   */
  async checkAndUnlock(userId: string, countryId: string, db: PrismaClient): Promise<string[]> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
      });

      if (!country) {
        console.error(`[Achievement Service] Country ${countryId} not found`);
        return [];
      }

      // Relational counts fetching
      const [
        embassyCount,
        militaryBranchCount,
        governmentComponentCount,
        thinkpageCount,
        followerCount,
        existingAchievements,
        user,
      ] = await Promise.all([
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
        db.thinkpagesPost
          .count({
            where: {
              account: {
                clerkUserId: userId,
              },
            },
          })
          .catch(() => 0),
        db.countryFollow.count({
          where: { followedCountryId: countryId },
        }),
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

      const totalAchievements = existingAchievements.length;

      let loreCardCount = 0;
      let retiredCardCount = 0;
      let distinctCountryIdCount = 0;

      if (user?.id) {
        const [loreCount, retiredCount, distinctCountries] = await Promise.all([
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
        ]);

        loreCardCount = loreCount;
        retiredCardCount = retiredCount;
        distinctCountryIdCount = distinctCountries;
      }

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

      const achievementData: ExtendedAchievementData = {
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
        embassyCount,
        treatyCount,
        tradePartnerCount,
        allianceCount,
        militaryBranchCount,
        militarySpendingPercent,
        totalMilitaryPersonnel,
        atomicComponentCount: governmentComponentCount,
        governmentType: country.governmentType ?? undefined,
        thinkpageCount,
        followerCount,
        trendingPostCount: await db.thinkpagesPost
          .count({
            where: {
              account: { clerkUserId: userId },
              trending: true,
            },
          })
          .catch(() => 0),
        daysActive,
        totalAchievements,
        loreCardCount,
        retiredCardCount,
        distinctCountryIdCount,
      };

      const alreadyUnlocked = new Set<string>(existingAchievements.map((a) => a.achievementId));

      const activeAchievements = await db.achievement.findMany({
        where: { isActive: true },
      });

      const achievementsToCheck = activeAchievements.filter((a) => !alreadyUnlocked.has(a.key));

      const unlocked: string[] = [];
      for (const achievement of achievementsToCheck) {
        if (this.evaluateCondition(achievement, achievementData)) {
          try {
            // Parse rewards JSON
            let creditReward = this.getCreditsForRarity(achievement.rarity);
            let cardIds: string[] = [];
            let packIds: string[] = [];
            let titles: string[] = [];

            if (achievement.rewardsJson) {
              try {
                const rewards = JSON.parse(achievement.rewardsJson);
                if (rewards) {
                  if (typeof rewards.credits === "number") creditReward = rewards.credits;
                  if (Array.isArray(rewards.cardIds)) cardIds = rewards.cardIds;
                  if (Array.isArray(rewards.cardPacks)) packIds = rewards.cardPacks;
                  if (Array.isArray(rewards.titles)) titles = rewards.titles;
                }
              } catch (err) {
                console.error(
                  `[Achievement Service] Failed to parse rewards for ${achievement.key}:`,
                  err
                );
              }
            }

            // Create UserAchievement record (references Achievement.key)
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
                  rewards: {
                    credits: creditReward,
                    cardIds,
                    packIds,
                    titles,
                  },
                }),
              },
            });

            unlocked.push(achievement.key);
            console.log(`[Achievement Service] Unlocked: ${achievement.title} for user ${userId}`);

            // Award IxCredits
            if (creditReward > 0) {
              try {
                await vaultService.earnCredits(
                  userId,
                  creditReward,
                  "EARN_ACTIVE",
                  "achievement_unlock",
                  db,
                  {
                    achievementId: achievement.key,
                    achievementName: achievement.title,
                    achievementTier: achievement.rarity,
                    achievementCategory: achievement.category,
                  }
                );
              } catch (creditError) {
                console.error(
                  `[Achievement Service] Error awarding credits for "${achievement.title}":`,
                  creditError
                );
              }
            }

            // Award Commemorative Cards
            for (const cardId of cardIds) {
              try {
                await awardAchievementCard(db, userId, cardId, achievement.key, achievement.title);
              } catch (cardError) {
                console.error(`[Achievement Service] Error awarding card ${cardId}:`, cardError);
              }
            }

            // Award Card Packs
            for (const packId of packIds) {
              try {
                await db.userPack.create({
                  data: {
                    userId,
                    packId,
                    isOpened: false,
                    acquiredMethod: "ACHIEVEMENT",
                  },
                });
              } catch (packError) {
                console.error(`[Achievement Service] Error awarding pack ${packId}:`, packError);
              }
            }

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
                  achievement.description || `You've unlocked a ${achievement.rarity} achievement!`,
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

      return unlocked;
    } catch (error) {
      console.error("[Achievement Service] Error in checkAndUnlock:", error);
      return [];
    }
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

      let creditReward = this.getCreditsForRarity(achievement.rarity);
      let cardIds: string[] = [];
      let packIds: string[] = [];
      let titles: string[] = [];

      if (achievement.rewardsJson) {
        try {
          const rewards = JSON.parse(achievement.rewardsJson);
          if (rewards) {
            if (typeof rewards.credits === "number") creditReward = rewards.credits;
            if (Array.isArray(rewards.cardIds)) cardIds = rewards.cardIds;
            if (Array.isArray(rewards.cardPacks)) packIds = rewards.cardPacks;
            if (Array.isArray(rewards.titles)) titles = rewards.titles;
          }
        } catch (err) {
          console.error(
            `[Achievement Service] Failed to parse rewards for ${achievement.key}:`,
            err
          );
        }
      }

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
            rewards: {
              credits: creditReward,
              cardIds,
              packIds,
              titles,
            },
          }),
        },
      });

      // Award credits
      if (creditReward > 0) {
        try {
          await vaultService.earnCredits(
            userId,
            creditReward,
            "EARN_ACTIVE",
            "achievement_unlock",
            db,
            {
              achievementId,
              achievementName: achievement.title,
              achievementTier: achievement.rarity,
            }
          );
        } catch (creditError) {
          console.error(`[Achievement Service] Error awarding credits:`, creditError);
        }
      }

      // Award cards
      for (const cardId of cardIds) {
        try {
          await awardAchievementCard(db, userId, cardId, achievementId, achievement.title);
        } catch (cardError) {
          console.error(`[Achievement Service] Error awarding card ${cardId}:`, cardError);
        }
      }

      // Award packs
      for (const packId of packIds) {
        try {
          await db.userPack.create({
            data: {
              userId,
              packId,
              isOpened: false,
              acquiredMethod: "ACHIEVEMENT",
            },
          });
        } catch (packError) {
          console.error(`[Achievement Service] Error awarding pack ${packId}:`, packError);
        }
      }

      return true;
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
