/**
 * Passive Income Cron Job
 *
 * Distributes daily passive income (dividends) to all country leaders based on GDP
 * Formula: (GDP Per Capita / 10000) * Economic Tier Multiplier + Population Bonus + Growth Bonus
 *
 * Usage:
 * - Schedule to run once daily at midnight UTC
 * - Can be integrated with node-cron or other job scheduler
 * - Processes countries in batches of 100 for performance
 */

import { vaultService } from "./vault-service";
import { db } from "~/server/db";

/**
 * Calculate and distribute passive income to all countries
 * This should be called once per day (e.g., at midnight UTC)
 */
export async function distributePassiveIncome() {
  const startTime = Date.now();
  console.log("[CRON] Starting passive income distribution");

  try {
    // Fetch all countries with active users
    const countries = await db.country.findMany({
      select: {
        id: true,
        name: true,
        currentGdpPerCapita: true,
        currentPopulation: true,
        economicTier: true,
        adjustedGdpGrowth: true,
        users: {
          select: {
            clerkUserId: true,
          },
          where: {
            clerkUserId: {
              not: null,
            },
          },
          take: 1, // Only need first user (country leader)
        },
      },
      where: {
        users: {
          some: {
            clerkUserId: {
              not: null,
            },
          },
        },
      },
    });

    console.log(`[CRON] Found ${countries.length} countries with active users`);

    let successCount = 0;
    let errorCount = 0;
    let totalCreditsDistributed = 0;

    // Process in batches of 100 to avoid overwhelming the database
    const BATCH_SIZE = 100;
    for (let i = 0; i < countries.length; i += BATCH_SIZE) {
      const batch = countries.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (country) => {
          try {
            // Skip if no user found
            if (!country.users || country.users.length === 0) {
              return;
            }

            const userId = country.users[0]!.clerkUserId;
            if (!userId) {
              return;
            }

            // Calculate daily dividend using the vault service
            const dailyIncome = await vaultService.calculatePassiveIncome(country.id, db);

            if (dailyIncome > 0) {
              // Award passive income
              const result = await vaultService.earnCredits(
                userId,
                dailyIncome,
                "EARN_PASSIVE",
                "DAILY_DIVIDEND",
                db,
                {
                  countryId: country.id,
                  countryName: country.name,
                  gdpPerCapita: country.currentGdpPerCapita,
                  population: country.currentPopulation,
                  economicTier: country.economicTier,
                  gdpGrowth: country.adjustedGdpGrowth,
                }
              );

              if (result.success) {
                successCount++;
                totalCreditsDistributed += dailyIncome;
              } else {
                console.error(
                  `[CRON] Failed to award passive income to ${country.name}: ${result.message}`
                );
                errorCount++;
              }
            }
          } catch (error) {
            console.error(`[CRON] Error processing country ${country.name}:`, error);
            errorCount++;
          }
        })
      );

      // Log progress every batch
      console.log(`[CRON] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(countries.length / BATCH_SIZE)}`);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[CRON] Passive income distribution complete:`,
      `\n  - Duration: ${duration}ms`,
      `\n  - Countries processed: ${countries.length}`,
      `\n  - Successful: ${successCount}`,
      `\n  - Errors: ${errorCount}`,
      `\n  - Total credits distributed: ${totalCreditsDistributed.toFixed(2)} IxC`
    );

    return {
      success: true,
      duration,
      totalCountries: countries.length,
      successCount,
      errorCount,
      totalCreditsDistributed,
    };
  } catch (error) {
    console.error("[CRON] Fatal error during passive income distribution:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test function for passive income distribution
 * Calculates but doesn't actually award credits
 */
export async function testPassiveIncomeDistribution() {
  console.log("[TEST] Testing passive income distribution (dry run)");

  try {
    const countries = await db.country.findMany({
      select: {
        id: true,
        name: true,
        currentGdpPerCapita: true,
        currentPopulation: true,
        economicTier: true,
        adjustedGdpGrowth: true,
      },
      take: 10, // Only test first 10 countries
    });

    console.log(`[TEST] Testing with ${countries.length} sample countries\n`);

    for (const country of countries) {
      const dailyIncome = await vaultService.calculatePassiveIncome(country.id, db);

      console.log(
        `[TEST] ${country.name}:`,
        `\n  - GDP Per Capita: $${country.currentGdpPerCapita.toLocaleString()}`,
        `\n  - Population: ${country.currentPopulation.toLocaleString()}`,
        `\n  - Economic Tier: ${country.economicTier}`,
        `\n  - GDP Growth: ${country.adjustedGdpGrowth?.toFixed(2)}%`,
        `\n  - Daily Passive Income: ${dailyIncome.toFixed(2)} IxC\n`
      );
    }

    return { success: true };
  } catch (error) {
    console.error("[TEST] Error during test:", error);
    return { success: false, error };
  }
}
