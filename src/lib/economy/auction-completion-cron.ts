/**
 * Auction Completion Cron Job
 *
 * Processes expired auctions every minute
 * - Transfers cards to winners
 * - Finalizes IxCredits payments
 * - Refunds unsuccessful auctions
 * - Updates market values
 *
 * Scheduled by the cron registry (`src/server/cron/jobs.ts`).
 */

import { db } from "~/server/db";
// auctionService is imported lazily inside processExpiredAuctions: a static top-level
// import binds it before auction-service.ts finishes evaluating in the cron's module
// graph (circular import), leaving the binding permanently in TDZ for this process.

/**
 * Process all expired auctions
 *
 * Finds auctions that have passed their end time and completes them
 * Runs as a cron job every minute
 */
export async function processExpiredAuctions() {
  const startTime = Date.now();
  console.log("[CRON] Checking for expired auctions at", new Date().toISOString());

  const now = Date.now();

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
    const { auctionService } = await import("./auction-service");
    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ auctionId: string; error: string }> = [];

    for (const auction of expiredAuctions) {
      try {
        await auctionService.completeAuction(auction.id, db as any);
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
