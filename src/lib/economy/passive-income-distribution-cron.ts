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
 * Each payout is idempotent per user and UTC day (plan 328): re-running the job
 * on the same day, or the on-read catch-up paying the same day, credits nothing.
 *
 * Usage:
 *   import { distributePassiveIncome } from '~/lib/economy/passive-income-distribution-cron';
 *   await distributePassiveIncome(); // Run once per day
 */

import { db } from "~/server/db";
import { withJobLock } from "~/lib/system/job-lock";
import { vaultService } from "~/lib/vault/vault-service";
import { resolveDividendCountryId } from "~/lib/vault/dividend-nation";
import {
  PASSIVE_DIVIDEND_SOURCE,
  passiveIncomeKey,
  utcDayStart,
} from "~/lib/vault/vault-passive-income";

export interface PassiveIncomeSummary {
  success: boolean;
  processed: number;
  distributed: number;
  errors: number;
  alreadyPaid: number;
}

/**
 * Distribute passive income to all users with countries
 * Processes in batches to avoid memory issues
 */
export async function distributePassiveIncome(): Promise<PassiveIncomeSummary> {
  console.log("[Passive Income Cron] Starting daily distribution...");
  // Captured once so a run that crosses midnight keeps a single period key.
  const runDate = new Date();
  const periodDay = utcDayStart(runDate);
  const startTime = runDate.getTime();

  let processedCount = 0;
  let distributedAmount = 0;
  let errorCount = 0;
  let alreadyPaidCount = 0;

  try {
    // Users who own a nation, or act as one (legacy link / system-owner override)
    const usersWithCountries = await db.user.findMany({
      where: {
        OR: [{ countryId: { not: null } }, { ownedCountries: { some: {} } }],
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
        // One dividend per account, from its primary nation — never the active one, so switching to a
        // richer nation before the payout changes nothing (resolveDividendCountryId).
        const countryId = await resolveDividendCountryId(db, user);
        const country =
          countryId && countryId === user.countryId
            ? user.country
            : countryId
              ? await db.country.findUnique({ where: { id: countryId } })
              : null;
        if (!countryId || !country) {
          continue;
        }

        // Calculate passive income for this user's dividend nation
        const passiveIncome = await vaultService.calculatePassiveIncome(countryId, db);

        if (passiveIncome > 0) {
          // Award passive income (at most once per user per UTC day)
          const result = await vaultService.earnCreditsOnce(db, {
            userId: user.id,
            amount: passiveIncome,
            type: "EARN_PASSIVE",
            source: PASSIVE_DIVIDEND_SOURCE,
            metadata: {
              countryId,
              countryName: country.name,
              gdpPerCapita: country.currentGdpPerCapita,
              economicTier: country.economicTier,
              population: country.currentPopulation,
              growth: country.adjustedGdpGrowth,
            },
            idempotencyKey: passiveIncomeKey(user.id, periodDay),
          });

          if (result.alreadyApplied) {
            alreadyPaidCount++;
          } else if (result.success) {
            distributedAmount += passiveIncome;
            console.log(
              `[Passive Income Cron] ✓ Distributed ${passiveIncome.toFixed(2)} IxC to user ${user.clerkUserId} (${country.name})`
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
        console.error(`[Passive Income Cron] Error processing user ${user.id}:`, error);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    const summary: PassiveIncomeSummary = {
      success: true,
      processed: processedCount,
      distributed: Math.round(distributedAmount * 100) / 100,
      errors: errorCount,
      alreadyPaid: alreadyPaidCount,
    };

    console.log(
      `[Passive Income Cron] ✓ Distribution complete in ${duration}ms\n` +
        `  Processed: ${summary.processed} users\n` +
        `  Distributed: ${summary.distributed} IxC\n` +
        `  Already paid today: ${summary.alreadyPaid}\n` +
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
      alreadyPaid: alreadyPaidCount,
    };
  }
}

/**
 * Manually trigger passive income distribution (for testing)
 * Should only be called by admin endpoints.
 *
 * Runs under the same advisory lock as the scheduled job so a manual trigger
 * during the cron (or vice versa) skips instead of double-applying. The lock is
 * deliberately NOT inside distributePassiveIncome: the cron runner wraps that
 * itself, and nesting the same lock name would make every scheduled run skip.
 */
export async function manualDistribution(): Promise<PassiveIncomeSummary> {
  console.log("[Passive Income Cron] Manual distribution triggered");
  const outcome = await withJobLock(db, "passive-income", distributePassiveIncome, {
    timeoutMs: 30 * 60_000,
  });
  if (outcome.ran) return outcome.result;
  console.log("[Passive Income Cron] Skipped: distribution already running");
  return { success: false, processed: 0, distributed: 0, errors: 0, alreadyPaid: 0 };
}
