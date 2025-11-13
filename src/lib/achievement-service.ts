/**
 * Achievement Auto-Unlock Service
 *
 * Provides centralized logic for checking and auto-unlocking achievements
 * when country data changes. Used by routers to automatically award achievements
 * when users meet the criteria.
 *
 * Usage:
 *   import { achievementService } from '~/lib/achievement-service';
 *   await achievementService.checkAndUnlock(userId, countryId, db);
 */

import { type PrismaClient } from "@prisma/client";
import {
  checkAchievements,
  getAchievementById,
  type ExtendedAchievementData,
} from "./achievement-definitions";
import { vaultService } from "./vault-service";
import { getCardRewardForAchievement, hasCardReward } from "./achievement-card-rewards";
import { awardAchievementCard } from "./card-service";

/**
 * Achievement Service
 * Handles auto-unlocking of achievements based on country data
 */
export class AchievementService {
  /**
   * Calculate IxCredits reward based on achievement rarity
   * @param rarity Achievement rarity tier
   * @returns IxCredits amount to award
   */
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
   * Check and auto-unlock achievements for a user/country
   * @param userId Clerk user ID
   * @param countryId Country ID
   * @param db Prisma database client
   * @returns Array of newly unlocked achievement IDs
   */
  async checkAndUnlock(userId: string, countryId: string, db: PrismaClient): Promise<string[]> {
    try {
      // Fetch country data
      const country = await db.country.findUnique({
        where: { id: countryId },
      });

      if (!country) {
        console.error(`[Achievement Service] Country ${countryId} not found`);
        return [];
      }

      // Fetch extended data (diplomatic, military, social counts)
      const [
        embassyCount,
        militaryBranchCount,
        governmentComponentCount,
        thinkpageCount,
        followerCount,
        existingAchievements,
        user,
      ] = await Promise.all([
        // Count embassies (both hosted and owned)
        db.embassy.count({
          where: {
            OR: [{ hostCountryId: countryId }, { guestCountryId: countryId }],
            status: "active",
          },
        }),

        // Count military branches
        db.militaryBranch.count({
          where: { countryId },
        }),

        // Count government components (atomic system)
        db.governmentComponent.count({
          where: { countryId },
        }),

        // Count ThinkPages by clerkUserId (via account relation)
        db.thinkpagesPost
          .count({
            where: {
              account: {
                clerkUserId: userId,
              },
            },
          })
          .catch(() => 0), // Gracefully handle if ThinkPages account doesn't exist

        // Count followers
        db.countryFollow.count({
          where: { followedCountryId: countryId },
        }),

        // Get already unlocked achievements
        db.userAchievement.findMany({
          where: { userId },
          select: { achievementId: true },
        }),

        // Get user for days active calculation
        db.user.findUnique({
          where: { clerkUserId: userId },
          select: { createdAt: true },
        }),
      ]);

      // Calculate additional metrics
      const daysActive = user
        ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const totalAchievements = existingAchievements.length;

      // Calculate military spending from branches (sum of all branch budgets)
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

      // Get diplomatic counts (simplified - these models may not exist yet)
      const treatyCount = 0; // TODO: Implement treaty counting when model is available
      const tradePartnerCount = 0; // TODO: Implement trade partnership counting
      const allianceCount = 0; // TODO: Implement alliance counting

      // Build extended achievement data
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
        trendingPostCount: 0, // TODO: Implement trending post detection
        daysActive,
        totalAchievements,
      };

      // Get already unlocked achievement IDs
      const alreadyUnlocked = new Set<string>(existingAchievements.map((a) => a.achievementId));

      // Check which achievements should be unlocked
      const toUnlock = checkAchievements(achievementData, alreadyUnlocked);

      // Unlock each achievement
      const unlocked: string[] = [];
      for (const achievementId of toUnlock) {
        const definition = getAchievementById(achievementId);
        if (!definition) {
          console.error(`[Achievement Service] Definition not found for ${achievementId}`);
          continue;
        }

        try {
          // Create UserAchievement record
          await db.userAchievement.create({
            data: {
              userId,
              achievementId: definition.id,
              title: definition.title,
              description: definition.description,
              category: definition.category,
              rarity: definition.rarity,
              iconUrl: definition.iconUrl,
              metadata: JSON.stringify({
                points: definition.points,
                unlockedAt: new Date().toISOString(),
              }),
            },
          });

          unlocked.push(achievementId);
          console.log(`[Achievement Service] Unlocked: ${definition.title} for user ${userId}`);

          // 💰 Award IxCredits for achievement unlock
          try {
            const creditReward = this.getCreditsForRarity(definition.rarity);
            const earnResult = await vaultService.earnCredits(
              userId,
              creditReward,
              "EARN_ACTIVE",
              "achievement_unlock",
              db,
              {
                achievementId: definition.id,
                achievementName: definition.title,
                achievementTier: definition.rarity,
                achievementCategory: definition.category,
              }
            );

            if (earnResult.success) {
              console.log(
                `[Achievement Service] Awarded ${creditReward} IxC for "${definition.title}" ` +
                `(${definition.rarity}) - New balance: ${earnResult.newBalance}`
              );
            } else {
              console.warn(
                `[Achievement Service] Failed to award IxCredits for "${definition.title}": ${earnResult.message}`
              );
            }
          } catch (creditError) {
            // Don't block achievement unlock if credits fail
            console.error(
              `[Achievement Service] Error awarding IxCredits for "${definition.title}":`,
              creditError
            );
          }

          // 🎴 Award commemorative card if achievement has card reward
          if (hasCardReward(achievementId)) {
            try {
              const cardId = getCardRewardForAchievement(achievementId);
              if (cardId) {
                await awardAchievementCard(
                  db,
                  userId,
                  cardId,
                  achievementId,
                  definition.title
                );
                console.log(
                  `[Achievement Service] Awarded commemorative card "${cardId}" for "${definition.title}"`
                );
              }
            } catch (cardError) {
              // Don't block achievement unlock if card award fails
              console.error(
                `[Achievement Service] Error awarding card for "${definition.title}":`,
                cardError
              );
            }
          }
        } catch (error) {
          // Silently handle duplicates (user may have unlocked via manual trigger)
          if (error instanceof Error && error.message.includes("Unique constraint")) {
            continue;
          }
          console.error(`[Achievement Service] Failed to unlock ${achievementId}:`, error);
        }
      }

      return unlocked;
    } catch (error) {
      console.error("[Achievement Service] Error in checkAndUnlock:", error);
      return [];
    }
  }

  /**
   * Check and unlock achievements for specific category
   * Useful for targeted checks after specific actions
   * @param userId Clerk user ID
   * @param countryId Country ID
   * @param db Prisma database client
   * @param category Specific category to check
   * @returns Array of newly unlocked achievement IDs
   */
  async checkAndUnlockCategory(
    userId: string,
    countryId: string,
    db: PrismaClient,
    category: "Economic" | "Military" | "Diplomatic" | "Government" | "Social" | "General"
  ): Promise<string[]> {
    // For now, just run full check
    // Could be optimized to only check specific category
    return this.checkAndUnlock(userId, countryId, db);
  }

  /**
   * Manually unlock a specific achievement
   * Useful for special events or admin actions
   * @param userId Clerk user ID
   * @param achievementId Achievement ID to unlock
   * @param db Prisma database client
   * @returns True if unlocked successfully
   */
  async unlockSpecific(userId: string, achievementId: string, db: PrismaClient): Promise<boolean> {
    try {
      const definition = getAchievementById(achievementId);
      if (!definition) {
        console.error(`[Achievement Service] Definition not found for ${achievementId}`);
        return false;
      }

      // Check if already unlocked
      const existing = await db.userAchievement.findFirst({
        where: {
          userId,
          achievementId,
        },
      });

      if (existing) {
        console.log(`[Achievement Service] Achievement ${achievementId} already unlocked`);
        return false;
      }

      // Create UserAchievement record
      await db.userAchievement.create({
        data: {
          userId,
          achievementId: definition.id,
          title: definition.title,
          description: definition.description,
          category: definition.category,
          rarity: definition.rarity,
          iconUrl: definition.iconUrl,
          metadata: JSON.stringify({
            points: definition.points,
            unlockedAt: new Date().toISOString(),
            manualUnlock: true,
          }),
        },
      });

      console.log(
        `[Achievement Service] Manually unlocked: ${definition.title} for user ${userId}`
      );

      // 💰 Award IxCredits for manual unlock
      try {
        const creditReward = this.getCreditsForRarity(definition.rarity);
        const earnResult = await vaultService.earnCredits(
          userId,
          creditReward,
          "EARN_ACTIVE",
          "achievement_unlock",
          db,
          {
            achievementId: definition.id,
            achievementName: definition.title,
            achievementTier: definition.rarity,
            achievementCategory: definition.category,
            manualUnlock: true,
          }
        );

        if (earnResult.success) {
          console.log(
            `[Achievement Service] Awarded ${creditReward} IxC for manual unlock of "${definition.title}" ` +
            `(${definition.rarity}) - New balance: ${earnResult.newBalance}`
          );
        } else {
          console.warn(
            `[Achievement Service] Failed to award IxCredits for manual unlock: ${earnResult.message}`
          );
        }
      } catch (creditError) {
        // Don't block achievement unlock if credits fail
        console.error(
          `[Achievement Service] Error awarding IxCredits for manual unlock:`,
          creditError
        );
      }

      // 🎴 Award commemorative card if achievement has card reward
      if (hasCardReward(achievementId)) {
        try {
          const cardId = getCardRewardForAchievement(achievementId);
          if (cardId) {
            await awardAchievementCard(
              db,
              userId,
              cardId,
              achievementId,
              definition.title
            );
            console.log(
              `[Achievement Service] Awarded commemorative card "${cardId}" for manual unlock of "${definition.title}"`
            );
          }
        } catch (cardError) {
          // Don't block achievement unlock if card award fails
          console.error(
            `[Achievement Service] Error awarding card for manual unlock:`,
            cardError
          );
        }
      }

      return true;
    } catch (error) {
      console.error(`[Achievement Service] Failed to manually unlock ${achievementId}:`, error);
      return false;
    }
  }

  /**
   * Get user's achievement progress
   * @param userId Clerk user ID
   * @param db Prisma database client
   * @returns Achievement progress statistics
   */
  async getProgress(userId: string, db: PrismaClient) {
    try {
      const unlocked = await db.userAchievement.findMany({
        where: { userId },
      });

      const totalPoints = unlocked.reduce((sum, achievement) => {
        const metadata = achievement.metadata ? JSON.parse(achievement.metadata) : {};
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

// Export singleton instance
export const achievementService = new AchievementService();
