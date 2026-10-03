/**
 * NS Sync Health Monitor
 *
 * Monitors NationStates card sync operations and tracks health metrics
 * across all region imports and NS operations.
 */

import { db } from "~/server/db";

interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  successRate: number;
  errorRate: number;
  avgCardsProcessed: number;
  lastSyncAt: Date | null;
}

interface SyncHealthStats {
  overall: SyncMetrics;
  bySeason: any[];
  recentErrors: Array<{
    type: string;
    error: string;
    timestamp: Date;
    cardsAffected: number;
  }>;
  alerts: string[];
}

export class SyncHealthMonitor {
  private static ERROR_RATE_THRESHOLD = 0.1; // 10%

  /**
   * Get comprehensive health statistics across all sync operations
   */
  static async getHealthStats(): Promise<SyncHealthStats> {
    try {
      // Get recent sync logs (last 100)
      const recentLogs = await db.syncLog.findMany({
        where: {
          syncType: { startsWith: "NS_" },
        },
        orderBy: { startedAt: "desc" },
        take: 100,
      });

      // Calculate overall metrics
      const totalSyncs = recentLogs.length;
      const successfulSyncs = recentLogs.filter((log) => log.status === "SUCCESS").length;
      const failedSyncs = recentLogs.filter((log) => log.status === "FAILED").length;
      const successRate = totalSyncs > 0 ? successfulSyncs / totalSyncs : 0;
      const errorRate = totalSyncs > 0 ? failedSyncs / totalSyncs : 0;

      const avgCardsProcessed =
        recentLogs.length > 0
          ? recentLogs.reduce((sum, log) => sum + (log.cardsProcessed ?? 0), 0) / recentLogs.length
          : 0;

      const lastSyncAt = recentLogs.length > 0 ? recentLogs[0]!.startedAt : null;

      // Get recent errors (last 50)
      const errorLogs = await db.syncLog.findMany({
        where: {
          syncType: { startsWith: "NS_" },
          status: "FAILED",
        },
        orderBy: { startedAt: "desc" },
        take: 50,
      });

      const recentErrors = errorLogs.map((log) => ({
        type: log.syncType.replace("NS_REGION_", "Region Fetch: ").replace(/_/g, " "),
        error: log.errorMessage ?? "Unknown error",
        timestamp: log.startedAt,
        cardsAffected: log.itemsFailed,
      }));

      // Generate alerts
      const alerts: string[] = [];

      if (errorRate > this.ERROR_RATE_THRESHOLD) {
        alerts.push(
          `⚠️ High error rate detected on recent region imports: ${(errorRate * 100).toFixed(1)}% (threshold: ${this.ERROR_RATE_THRESHOLD * 100}%)`
        );
      }

      return {
        overall: {
          totalSyncs,
          successfulSyncs,
          failedSyncs,
          successRate,
          errorRate,
          avgCardsProcessed,
          lastSyncAt,
        },
        bySeason: [],
        recentErrors,
        alerts,
      };
    } catch (error) {
      console.error("[NS Sync Monitor] Failed to get health stats:", error);
      throw error;
    }
  }
}
