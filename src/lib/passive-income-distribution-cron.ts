/**
 * Passive Income Distribution Cron Job
 *
 * Runs daily at midnight UTC to distribute IxCredits passive income to all users
 * based on their nation's economic performance (GDP, population, growth).
 *
 * Formula: (GDP Per Capita / 10000) * Economic Tier Multiplier + Population Bonus + Growth Bonus
 * - Economic Tier multipliers: Tier 1 (3x), Tier 2 (2x), Tier 3 (1.5x), Tier 4 (1x)
 * - Population bonus: +0.01 IxCredits per 1M citizens
 * - Growth bonus: +10% dividend if GDP growth > 3% this quarter
 *
 * Example: Nation with $45K GDP/capita, Tier 2, 25M pop, 4% growth
 * - Daily dividend: (45000/10000) * 2 = 9 IxCredits
 * - Population bonus: 25 * 0.01 = 0.25 IxCredits
 * - Growth bonus: 9 * 1.1 = 9.9 IxCredits
 * - Total: ~10 IxCredits/day passive
 *
 * Usage:
 *   import { distributePassiveIncome } from '~/lib/passive-income-distribution-cron';
 *   await distributePassiveIncome(); // Run once per day
 */

import { db } from "~/server/db";
import { vaultService } from "~/lib/vault-service";

/**
 * Distribute passive income to all users with countries
 * Processes in batches to avoid memory issues
 */
export async function distributePassiveIncome(): Promise<{
  success: boolean;
  processed: number;
  distributed: number;
  errors: number;
}> {
  console.log("[Passive Income Cron] Starting daily distribution...");
  const startTime = Date.now();

  let processedCount = 0;
  let distributedAmount = 0;
  let errorCount = 0;

  try {
    // Get all users with countries
    const usersWithCountries = await db.user.findMany({
      where: {
        countryId: { not: null },
      },
      include: {
        country: true,
        vault: true,
      },
    });

    console.log(`[Passive Income Cron] Found ${usersWithCountries.length} users with countries`);

    // Process each user
    for (const user of usersWithCountries) {
      try {
        if (!user.countryId || !user.country) {
          continue;
        }

        // Calculate passive income for this user's nation
        const passiveIncome = await vaultService.calculatePassiveIncome(user.countryId, db);

        if (passiveIncome > 0) {
          // Award passive income
          const result = await vaultService.earnCredits(
            user.clerkUserId,
            passiveIncome,
            "EARN_PASSIVE",
            "DAILY_NATION_DIVIDEND",
            db,
            {
              countryId: user.countryId,
              countryName: user.country.name,
              gdpPerCapita: user.country.currentGdpPerCapita,
              economicTier: user.country.economicTier,
              population: user.country.currentPopulation,
              growth: user.country.adjustedGdpGrowth,
            }
          );

          if (result.success) {
            distributedAmount += passiveIncome;
            console.log(
              `[Passive Income Cron] ✓ Distributed ${passiveIncome.toFixed(2)} IxC to user ${user.clerkUserId} (${user.country.name})`
            );
          } else {
            console.error(
              `[Passive Income Cron] ✗ Failed to distribute to user ${user.clerkUserId}: ${result.message}`
            );
            errorCount++;
          }
        }

        processedCount++;
      } catch (error) {
        console.error(
          `[Passive Income Cron] Error processing user ${user.id}:`,
          error
        );
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    const summary = {
      success: true,
      processed: processedCount,
      distributed: Math.round(distributedAmount * 100) / 100,
      errors: errorCount,
    };

    console.log(
      `[Passive Income Cron] ✓ Distribution complete in ${duration}ms\n` +
        `  Processed: ${summary.processed} users\n` +
        `  Distributed: ${summary.distributed} IxC\n` +
        `  Errors: ${summary.errors}`
    );

    return summary;
  } catch (error) {
    console.error("[Passive Income Cron] ✗ Critical error during distribution:", error);
    return {
      success: false,
      processed: processedCount,
      distributed: distributedAmount,
      errors: errorCount + 1,
    };
  }
}

/**
 * Manually trigger passive income distribution (for testing)
 * Should only be called by admin endpoints
 */
export async function manualDistribution() {
  console.log("[Passive Income Cron] Manual distribution triggered");
  return await distributePassiveIncome();
}
