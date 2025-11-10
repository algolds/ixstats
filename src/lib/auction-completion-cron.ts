/**
 * Auction Completion Cron Job
 *
 * Processes expired auctions every minute
 * - Transfers cards to winners
 * - Finalizes IxCredits payments
 * - Refunds unsuccessful auctions
 * - Updates market values
 *
 * Usage:
 *   import { processExpiredAuctions } from '~/lib/auction-completion-cron';
 *   // Run via node-cron or similar scheduler
 *   cron.schedule('* * * * *', processExpiredAuctions);
 */

import { db } from "~/server/db";
import { auctionService } from "./auction-service";
import { IxTime } from "./ixtime";

/**
 * Process all expired auctions
 *
 * Finds auctions that have passed their end time and completes them
 * Runs as a cron job every minute
 */
export async function processExpiredAuctions() {
  const startTime = Date.now();
  console.log("[CRON] Checking for expired auctions at", new Date().toISOString());

  const now = IxTime.getCurrentIxTime();

  try {
    // Find all active auctions that have expired
    const expiredAuctions = await db.cardAuction.findMany({
      where: {
        status: "ACTIVE",
        endTime: { lt: new Date(now) },
      },
      select: {
        id: true,
        endTime: true,
        cardInstanceId: true,
        sellerId: true,
        currentBidderId: true,
      },
    });

    console.log(`[CRON] Found ${expiredAuctions.length} expired auctions to process`);

    if (expiredAuctions.length === 0) {
      console.log("[CRON] No expired auctions to process");
      return {
        success: true,
        processed: 0,
        failed: 0,
        duration: Date.now() - startTime,
      };
    }

    // Process each auction
    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ auctionId: string; error: string }> = [];

    for (const auction of expiredAuctions) {
      try {
        await auctionService.completeAuction(auction.id, db);
        successCount++;
        console.log(
          `[CRON] ✓ Completed auction ${auction.id} (card: ${auction.cardInstanceId}, winner: ${auction.currentBidderId ?? "none"})`
        );
      } catch (error) {
        failCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ auctionId: auction.id, error: errorMsg });
        console.error(`[CRON] ✗ Failed to complete auction ${auction.id}:`, errorMsg);
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[CRON] Auction completion finished: ${successCount} completed, ${failCount} failed (${duration}ms)`
    );

    if (errors.length > 0) {
      console.error("[CRON] Errors encountered:", errors);
    }

    return {
      success: failCount === 0,
      processed: successCount,
      failed: failCount,
      duration,
      errors,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[CRON] Fatal error processing expired auctions:", error);
    return {
      success: false,
      processed: 0,
      failed: 0,
      duration,
      errors: [{ auctionId: "GLOBAL", error: String(error) }],
    };
  }
}

/**
 * Get cron job status and statistics
 *
 * Returns information about recent auction completions
 */
export async function getAuctionCronStatus() {
  try {
    const now = IxTime.getCurrentIxTime();

    // Count active auctions
    const activeCount = await db.cardAuction.count({
      where: { status: "ACTIVE" },
    });

    // Count expired but not processed
    const expiredCount = await db.cardAuction.count({
      where: {
        status: "ACTIVE",
        endTime: { lt: new Date(now) },
      },
    });

    // Count completed in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCompletions = await db.cardAuction.count({
      where: {
        status: "COMPLETED",
        updatedAt: { gte: oneHourAgo },
      },
    });

    // Get next expiring auction
    const nextExpiring = await db.cardAuction.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { endTime: "asc" },
      select: {
        id: true,
        endTime: true,
        cardInstanceId: true,
        CardOwnership: {
          select: {
            cards: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

    return {
      active: activeCount,
      expired: expiredCount,
      recentCompletions,
      nextExpiring: nextExpiring
        ? {
            auctionId: nextExpiring.id,
            cardTitle: nextExpiring.CardOwnership?.cards?.title ?? "Unknown",
            endsAt: nextExpiring.endTime.toISOString(),
            timeRemaining: new Date(nextExpiring.endTime).getTime() - now,
          }
        : null,
    };
  } catch (error) {
    console.error("[CRON] Error getting status:", error);
    return {
      active: 0,
      expired: 0,
      recentCompletions: 0,
      nextExpiring: null,
      error: String(error),
    };
  }
}

/**
 * Manual trigger for testing
 *
 * Allows manual execution of auction completion process
 * Useful for testing and debugging
 */
export async function manualTriggerAuctionCompletion() {
  console.log("[MANUAL] Manually triggering auction completion");
  return await processExpiredAuctions();
}

/**
 * Cleanup old completed auctions (optional)
 *
 * Archives auctions completed more than 30 days ago
 * Run this less frequently (e.g., daily)
 */
export async function cleanupOldAuctions() {
  console.log("[CRON] Cleaning up old completed auctions");

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await db.cardAuction.updateMany({
      where: {
        status: { in: ["COMPLETED", "CANCELLED"] },
        updatedAt: { lt: thirtyDaysAgo },
      },
      data: {
        // Could add an 'archived' flag if needed
        // For now, just log the count
      },
    });

    console.log(`[CRON] Would archive ${result.count} old auctions (feature not implemented)`);

    return {
      success: true,
      count: result.count,
    };
  } catch (error) {
    console.error("[CRON] Error cleaning up old auctions:", error);
    return {
      success: false,
      count: 0,
      error: String(error),
    };
  }
}

/**
 * Example node-cron setup (for reference)
 *
 * Add to your server initialization file:
 *
 * ```typescript
 * import cron from 'node-cron';
 * import { processExpiredAuctions, cleanupOldAuctions } from '~/lib/auction-completion-cron';
 *
 * // Process expired auctions every minute
 * cron.schedule('* * * * *', async () => {
 *   await processExpiredAuctions();
 * });
 *
 * // Cleanup old auctions daily at 3 AM
 * cron.schedule('0 3 * * *', async () => {
 *   await cleanupOldAuctions();
 * });
 * ```
 */
