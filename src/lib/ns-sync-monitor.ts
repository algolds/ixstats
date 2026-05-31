/**
 * NS Sync Health Monitor
 *
 * Monitors NationStates card sync operations and tracks health metrics
 * across all region imports and NS operations.
 */

import { db } from "~/server/db";
import { env } from "~/env";

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
  private static WEBHOOK_ENABLED = env.DISCORD_WEBHOOK_ENABLED === "true";
  private static WEBHOOK_URL = env.DISCORD_WEBHOOK_URL;

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

  /**
   * Send alert to Discord webhook with detailed context
   */
  static async sendAlert(params: {
    title: string;
    message: string;
    stats?: SyncHealthStats;
    severity: "low" | "medium" | "high";
  }): Promise<void> {
    if (!this.WEBHOOK_ENABLED || !this.WEBHOOK_URL) {
      console.warn("[NS Sync Monitor] Discord webhook not configured, skipping alert");
      return;
    }

    const { title, message, stats, severity } = params;

    const color = severity === "high" ? 0xff0000 : severity === "medium" ? 0xffa500 : 0xffff00;

    const embed = {
      title,
      description: message,
      color,
      timestamp: new Date().toISOString(),
      fields: [] as Array<{ name: string; value: string; inline?: boolean }>,
    };

    if (stats) {
      embed.fields.push({
        name: "Overall Metrics",
        value: [
          `Total Syncs: ${stats.overall.totalSyncs}`,
          `Success Rate: ${(stats.overall.successRate * 100).toFixed(1)}%`,
          `Error Rate: ${(stats.overall.errorRate * 100).toFixed(1)}%`,
          `Avg Cards/Sync: ${stats.overall.avgCardsProcessed.toFixed(0)}`,
        ].join("\n"),
        inline: false,
      });

      if (stats.recentErrors.length > 0) {
        const recentError = stats.recentErrors[0]!;
        embed.fields.push({
          name: "Latest Error",
          value: [
            `Type: ${recentError.type}`,
            `Error: ${recentError.error.substring(0, 200)}`,
            `Time: ${recentError.timestamp.toISOString()}`,
          ].join("\n"),
          inline: false,
        });
      }

      if (stats.alerts.length > 0) {
        embed.fields.push({
          name: "Active Alerts",
          value: stats.alerts.slice(0, 5).join("\n"),
          inline: false,
        });
      }
    }

    try {
      const response = await fetch(this.WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "IxStats NS Sync Monitor",
          embeds: [embed],
        }),
      });

      if (!response.ok) {
        console.error("[NS Sync Monitor] Discord webhook failed:", await response.text());
      } else {
        console.log("[NS Sync Monitor] Alert sent to Discord successfully");
      }
    } catch (error) {
      console.error("[NS Sync Monitor] Failed to send Discord alert:", error);
    }
  }
}
