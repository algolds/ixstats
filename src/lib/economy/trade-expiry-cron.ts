import { db } from "~/server/db";
import { IxTime } from "~/lib/ixtime";

/**
 * Process all expired pending trades every 5 minutes
 * - Unlocks initiator's locked cards
 * - Marks trade as EXPIRED
 */
export async function processExpiredTrades() {
  const startTime = Date.now();
  console.log("[CRON] Checking for expired trades at", new Date().toISOString());

  const now = IxTime.getCurrentIxTime();

  try {
    const expiredTrades = await db.tradeOffer.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date(now) },
      },
      select: {
        id: true,
        initiatorCardIds: true,
        recipientCardIds: true,
      },
    });

    console.log(`[CRON] Found ${expiredTrades.length} expired trades to process`);

    if (expiredTrades.length === 0) {
      console.log("[CRON] No expired trades to process");
      return {
        success: true,
        processed: 0,
        failed: 0,
        duration: Date.now() - startTime,
      };
    }

    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ tradeId: string; error: string }> = [];

    for (const trade of expiredTrades) {
      try {
        await db.$transaction(async (tx) => {
          const initiatorCardIds = trade.initiatorCardIds as string[];

          await tx.cardOwnership.updateMany({
            where: { id: { in: initiatorCardIds } },
            data: { isLocked: false },
          });

          await tx.tradeOffer.update({
            where: { id: trade.id },
            data: { status: "EXPIRED" },
          });
        });

        successCount++;
        console.log(`[CRON] ✓ Expired trade ${trade.id}`);
      } catch (error) {
        failCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ tradeId: trade.id, error: errorMsg });
        console.error(`[CRON] ✗ Failed to expire trade ${trade.id}:`, errorMsg);
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[CRON] Trade expiry finished: ${successCount} expired, ${failCount} failed (${duration}ms)`
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
    console.error("[CRON] Fatal error processing expired trades:", error);
    return {
      success: false,
      processed: 0,
      failed: 0,
      duration,
      errors: [{ tradeId: "GLOBAL", error: String(error) }],
    };
  }
}

export async function manualTriggerTradeExpiry() {
  console.log("[MANUAL] Manually triggering trade expiry");
  return await processExpiredTrades();
}
