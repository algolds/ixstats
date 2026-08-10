import { type PrismaClient } from "@prisma/client";
import { budgetVaultCalculator } from "~/lib/budget-vault-calculator";
import { getOrCreateVault, earnCredits } from "~/lib/vault/vault-ledger";
import { getYieldBoostMultiplier } from "~/lib/vault/vault-perks";

const activeCatchUps = new Set<string>();

/**
 * Calculate passive income based on nation performance
 */
export async function calculatePassiveIncome(countryId: string, db: PrismaClient): Promise<number> {
  try {
    const country = await db.country.findUnique({
      where: { id: countryId },
    });

    if (!country) {
      console.error(`[Vault Service] Country ${countryId} not found`);
      return 0;
    }

    const tierMultipliers: Record<string, number> = {
      Extravagant: 3.5,
      "Very Strong": 3.0,
      Strong: 2.5,
      Developed: 2.0,
      Healthy: 1.5,
      Developing: 1.0,
      Impoverished: 0.5,
    };

    const tierMultiplier = tierMultipliers[country.economicTier] ?? 1.0;

    const baseRate = (country.currentGdpPerCapita / 10000) * tierMultiplier;

    const populationBonus = (country.currentPopulation / 1000000) * 0.01;

    const growthBonus = (country.adjustedGdpGrowth || 0) > 0.03 ? baseRate * 0.1 : 0;

    const baseIncome = baseRate + populationBonus + growthBonus;

    const budgetMultiplier = await budgetVaultCalculator.calculateBudgetMultiplier(countryId, db);

    let totalDividend = baseIncome * budgetMultiplier;

    let yieldBoost = 0;
    const user = await db.user.findFirst({
      where: { countryId },
      select: { id: true },
    });
    if (user) {
      yieldBoost = await getYieldBoostMultiplier(user.id, db);
    }
    if (yieldBoost > 0) {
      totalDividend = totalDividend * (1 + yieldBoost);
    }

    console.log(
      `[Vault Service] Calculated passive income for ${countryId}: ${totalDividend.toFixed(2)} IxC ` +
        `(base: ${baseRate.toFixed(2)}, pop: ${populationBonus.toFixed(2)}, growth: ${growthBonus.toFixed(2)}, ` +
        `budget: ${budgetMultiplier.toFixed(3)}x, yieldBoost: ${yieldBoost.toFixed(2)}x)`
    );

    return Math.round(totalDividend * 100) / 100;
  } catch (error) {
    console.error(`[Vault Service] Failed to calculate passive income for ${countryId}:`, error);
    return 0;
  }
}

/**
 * Catch up passive income for a user's country if they missed days.
 */
export async function catchUpPassiveIncome(
  userId: string,
  db: PrismaClient
): Promise<{ success: boolean; count: number; totalCreditsAwarded: number; error?: string }> {
  try {
    const user = await db.user.findFirst({
      where: {
        OR: [{ id: userId }, { clerkUserId: userId }],
      },
      select: {
        id: true,
        countryId: true,
        createdAt: true,
      },
    });

    if (!user || !user.countryId) {
      return { success: true, count: 0, totalCreditsAwarded: 0 };
    }

    if (activeCatchUps.has(user.id)) {
      console.log(
        `[Vault Service] Passive income catchup already in progress for user ${user.id}`
      );
      return { success: true, count: 0, totalCreditsAwarded: 0 };
    }

    activeCatchUps.add(user.id);

    try {
      const vault = await getOrCreateVault(user.id, db);

      const lastTx = await db.vaultTransaction.findFirst({
        where: {
          vaultId: vault.id,
          type: "EARN_PASSIVE",
          source: "DAILY_DIVIDEND",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
        },
      });

      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      let startDate: Date;
      if (lastTx) {
        startDate = new Date(lastTx.createdAt);
      } else {
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const vaultCreated = new Date(vault.createdAt);
        startDate = vaultCreated > yesterday ? vaultCreated : yesterday;
      }

      const lastRunDay = new Date(
        Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
      );

      const daysToAward: Date[] = [];
      let currentDay = new Date(lastRunDay.getTime() + 24 * 60 * 60 * 1000);

      while (currentDay <= today) {
        daysToAward.push(new Date(currentDay));
        currentDay = new Date(currentDay.getTime() + 24 * 60 * 60 * 1000);
      }

      if (daysToAward.length === 0) {
        return { success: true, count: 0, totalCreditsAwarded: 0 };
      }

      console.log(
        `[Vault Service] Catching up ${daysToAward.length} days of passive income for user ${user.id} / country ${user.countryId}`
      );

      let awardedCount = 0;
      let totalCreditsAwarded = 0;

      for (const day of daysToAward) {
        const dailyIncome = await calculatePassiveIncome(user.countryId, db);
        if (dailyIncome > 0) {
          const earnResult = await earnCredits(
            user.id,
            dailyIncome,
            "EARN_PASSIVE",
            "DAILY_DIVIDEND",
            db,
            {
              countryId: user.countryId,
              isCatchUp: true,
              targetDate: day.toISOString(),
            },
            day
          );
          if (earnResult.success) {
            awardedCount++;
            totalCreditsAwarded += dailyIncome;
          }
        }
      }

      return { success: true, count: awardedCount, totalCreditsAwarded };
    } finally {
      activeCatchUps.delete(user.id);
    }
  } catch (error) {
    console.error(`[Vault Service] Failed to catch up passive income for ${userId}:`, error);
    return {
      success: false,
      count: 0,
      totalCreditsAwarded: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
