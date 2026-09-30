import { type PrismaClient } from "@prisma/client";
import { budgetVaultCalculator } from "~/lib/economy/budget-vault-calculator";
import { getOrCreateVault } from "~/lib/vault/vault-ledger";
import { getYieldBoostMultiplier } from "~/lib/vault/vault-perks";
import { earnCreditsOnce } from "~/lib/vault/vault-service";

export const PASSIVE_DIVIDEND_SOURCE = "DAILY_DIVIDEND";
/** Source written by the pre-328 daily cron; the catch-up lookback still honours it. */
const LEGACY_PASSIVE_DIVIDEND_SOURCE = "DAILY_NATION_DIVIDEND";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Idempotency key for one user's dividend on one UTC calendar day. */
export function passiveIncomeKey(userId: string, day: Date): string {
  return `passive:${userId}:${day.toISOString().slice(0, 10)}`;
}

export function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

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
      where: { ownedCountries: { some: { id: countryId } } },
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
 *
 * Runs on almost every vault read (getBalance). Each day is paid through
 * earnCreditsOnce with the per-UTC-day key, so a concurrent catch-up, or the
 * daily cron paying the same day, cannot double-credit.
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

    const vault = await getOrCreateVault(user.id, db);

    const lastTx = await db.vaultTransaction.findFirst({
      where: {
        vaultId: vault.id,
        type: "EARN_PASSIVE",
        source: { in: [PASSIVE_DIVIDEND_SOURCE, LEGACY_PASSIVE_DIVIDEND_SOURCE] },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });

    const today = utcDayStart(new Date());

    let startDate: Date;
    if (lastTx) {
      startDate = new Date(lastTx.createdAt);
    } else {
      const yesterday = new Date(today.getTime() - DAY_MS);
      const vaultCreated = new Date(vault.createdAt);
      startDate = vaultCreated > yesterday ? vaultCreated : yesterday;
    }

    const lastRunDay = utcDayStart(startDate);

    const daysToAward: Date[] = [];
    let currentDay = new Date(lastRunDay.getTime() + DAY_MS);

    while (currentDay <= today) {
      daysToAward.push(new Date(currentDay));
      currentDay = new Date(currentDay.getTime() + DAY_MS);
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
        const earnResult = await earnCreditsOnce(db, {
          userId: user.id,
          amount: dailyIncome,
          type: "EARN_PASSIVE",
          source: PASSIVE_DIVIDEND_SOURCE,
          metadata: {
            countryId: user.countryId,
            isCatchUp: true,
            targetDate: day.toISOString(),
          },
          createdAt: day,
          idempotencyKey: passiveIncomeKey(user.id, day),
        });
        if (earnResult.success && !earnResult.alreadyApplied) {
          awardedCount++;
          totalCreditsAwarded += dailyIncome;
        }
      }
    }

    return { success: true, count: awardedCount, totalCreditsAwarded };
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
