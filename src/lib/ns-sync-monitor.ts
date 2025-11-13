/**
 * NS Sync Health Monitor
 *
 * Monitors NationStates card sync operations and tracks health metrics
 * across multiple seasons. Provides alerting when error rates exceed
 * acceptable thresholds.
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

interface SeasonHealth {
  season: number;
  status: string;
  cardsProcessed: number;
  totalCards: number;
  errorCount: number;
  progress: number;
  lastCheckpoint: Date;
  isHealthy: boolean;
}

interface SyncHealthStats {
  overall: SyncMetrics;
  bySeason: SeasonHealth[];
  recentErrors: Array<{
    season: number;
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
   * Track a sync operation (success or failure)
   */
  static async trackSync(params: {
    season: number;
    status: "SUCCESS" | "FAILED" | "IN_PROGRESS";
    cardsProcessed?: number;
    cardsCreated?: number;
    cardsUpdated?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const { season, status, cardsProcessed, cardsCreated, cardsUpdated, errorMessage, metadata } = params;

    try {
      // Create sync log entry
      const syncLog = await db.syncLog.create({
        data: {
          syncType: `NS_SEASON_${season}`,
          status,
          itemsProcessed: cardsProcessed ?? 0,
          itemsFailed: status === "FAILED" ? 1 : 0,
          errorMessage,
          season,
          cardsProcessed,
          cardsCreated,
          cardsUpdated,
          errors: errorMessage,
          metadata: metadata ? JSON.stringify(metadata) : null,
          startedAt: new Date(),
          completedAt: status !== "IN_PROGRESS" ? new Date() : null,
        },
      });

      console.log(`[NS Sync Monitor] Tracked sync for season ${season}: ${status}`);

      // Check health and send alerts if needed
      if (status === "FAILED") {
        await this.checkHealthAndAlert(season);
      }

      return;
    } catch (error) {
      console.error("[NS Sync Monitor] Failed to track sync:", error);
      // Don't throw - monitoring should not break the sync process
    }
  }

  /**
   * Get comprehensive health statistics across all seasons
   */
  static async getHealthStats(): Promise<SyncHealthStats> {
    try {
      // Get recent sync logs (last 100)
      const recentLogs = await db.syncLog.findMany({
        where: {
          syncType: { startsWith: "NS_SEASON_" },
        },
        orderBy: { startedAt: "desc" },
        take: 100,
      });

      // Calculate overall metrics
      const totalSyncs = recentLogs.length;
      const successfulSyncs = recentLogs.filter(log => log.status === "SUCCESS").length;
      const failedSyncs = recentLogs.filter(log => log.status === "FAILED").length;
      const successRate = totalSyncs > 0 ? successfulSyncs / totalSyncs : 0;
      const errorRate = totalSyncs > 0 ? failedSyncs / totalSyncs : 0;

      const avgCardsProcessed = recentLogs.length > 0
        ? recentLogs.reduce((sum, log) => sum + (log.cardsProcessed ?? 0), 0) / recentLogs.length
        : 0;

      const lastSyncAt = recentLogs.length > 0 ? recentLogs[0]!.startedAt : null;

      // Get checkpoint status for each season
      const checkpoints = await db.syncCheckpoint.findMany({
        orderBy: { season: "desc" },
      });

      const bySeason: SeasonHealth[] = checkpoints.map(checkpoint => {
        const progress = checkpoint.totalCards > 0
          ? (checkpoint.cardsProcessed / checkpoint.totalCards) * 100
          : 0;

        const isHealthy = checkpoint.status === "COMPLETED" ||
          (checkpoint.status === "IN_PROGRESS" && checkpoint.errorCount < 10);

        return {
          season: checkpoint.season,
          status: checkpoint.status,
          cardsProcessed: checkpoint.cardsProcessed,
          totalCards: checkpoint.totalCards,
          errorCount: checkpoint.errorCount,
          progress,
          lastCheckpoint: checkpoint.lastCheckpointAt,
          isHealthy,
        };
      });

      // Get recent errors (last 50)
      const errorLogs = await db.syncLog.findMany({
        where: {
          syncType: { startsWith: "NS_SEASON_" },
          status: "FAILED",
        },
        orderBy: { startedAt: "desc" },
        take: 50,
      });

      const recentErrors = errorLogs.map(log => ({
        season: log.season ?? 0,
        error: log.errorMessage ?? "Unknown error",
        timestamp: log.startedAt,
        cardsAffected: log.itemsFailed,
      }));

      // Generate alerts
      const alerts: string[] = [];

      if (errorRate > this.ERROR_RATE_THRESHOLD) {
        alerts.push(`⚠️ High error rate detected: ${(errorRate * 100).toFixed(1)}% (threshold: ${this.ERROR_RATE_THRESHOLD * 100}%)`);
      }

      for (const seasonHealth of bySeason) {
        if (!seasonHealth.isHealthy && seasonHealth.status !== "COMPLETED") {
          alerts.push(`⚠️ Season ${seasonHealth.season} sync unhealthy: ${seasonHealth.errorCount} errors, ${seasonHealth.progress.toFixed(1)}% complete`);
        }
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
        bySeason,
        recentErrors,
        alerts,
      };
    } catch (error) {
      console.error("[NS Sync Monitor] Failed to get health stats:", error);
      throw error;
    }
  }

  /**
   * Check sync health and send Discord alert if error rate exceeds threshold
   */
  private static async checkHealthAndAlert(season: number): Promise<void> {
    try {
      const stats = await this.getHealthStats();

      // Check if error rate exceeds threshold
      if (stats.overall.errorRate > this.ERROR_RATE_THRESHOLD) {
        await this.sendAlert({
          title: "🚨 NS Sync Health Alert",
          message: `Season ${season} sync has high error rate: ${(stats.overall.errorRate * 100).toFixed(1)}%`,
          stats,
          severity: "high",
        });
      }
    } catch (error) {
      console.error("[NS Sync Monitor] Failed to check health and alert:", error);
      // Don't throw - alerting failures should not break the sync
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
            `Season: ${recentError.season}`,
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

  /**
   * Log detailed error with full context
   */
  static async logError(params: {
    season: number;
    cardId: string;
    error: string;
    context?: Record<string, any>;
  }): Promise<void> {
    const { season, cardId, error, context } = params;

    try {
      await db.syncLog.create({
        data: {
          syncType: `NS_SEASON_${season}_CARD_ERROR`,
          status: "FAILED",
          itemsProcessed: 0,
          itemsFailed: 1,
          errorMessage: `Card ${cardId}: ${error}`,
          season,
          metadata: context ? JSON.stringify(context) : null,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      console.error(`[NS Sync Monitor] Error logged for season ${season}, card ${cardId}:`, error);
    } catch (dbError) {
      console.error("[NS Sync Monitor] Failed to log error to database:", dbError);
    }
  }
}
