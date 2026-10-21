import { copyIdsOf } from "~/lib/cards/hub/art-visibility";
import { unlockCardsTx } from "~/lib/vault/trade-settlement";
import { db } from "~/server/db";

/**
 * Process all expired pending trades every 5 minutes
 * - Marks a trade EXPIRED iff it is still pending and expired (an accept, a cancel or a counter-offer that got there
 *   first leaves it alone; a counter restarts the clock)
 * - Only then unlocks the proposer's locked cards, those still theirs: a card the trade no longer holds keeps any
 *   lock it has since taken (a listing, another trade)
 */
export async function processExpiredTrades() {
  const startTime = Date.now();
  console.log("[CRON] Checking for expired trades at", new Date().toISOString());

  // Trades are created and checked against real time (the trade service), not IxTime.
  const now = Date.now();

  try {
    const expiredTrades = await db.tradeOffer.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date(now) },
      },
      select: {
        id: true,
        proposerId: true,
        initiatorId: true,
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
          const expired = await tx.tradeOffer.updateMany({
            where: { id: trade.id, status: "PENDING", expiresAt: { lt: new Date(now) } },
            data: { status: "EXPIRED" },
          });
          if (expired.count !== 1) return;
          const locked = copyIdsOf(
            trade.proposerId === trade.initiatorId ? trade.initiatorCardIds : trade.recipientCardIds
          );
          await unlockCardsTx(tx, locked, trade.proposerId);
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
