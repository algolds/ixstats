/**
 * Log Retention and Archival System
 *
 * Manages log lifecycle:
 * - Archives old logs
 * - Deletes expired logs
 * - Enforces retention policies
 * - Generates log summaries
 */

import { db } from "~/server/db";
import { logger, LogLevel, LogCategory } from "./logger";

interface RetentionPolicy {
  logLevel: string;
  retentionDays: number;
  archiveAfterDays: number | null;
  deleteAfterDays: number;
  enabled: boolean;
}

// Default retention policies
const DEFAULT_POLICIES: RetentionPolicy[] = [
  {
    logLevel: "DEBUG",
    retentionDays: 7,
    archiveAfterDays: 3,
    deleteAfterDays: 7,
    enabled: true,
  },
  {
    logLevel: "INFO",
    retentionDays: 30,
    archiveAfterDays: 14,
    deleteAfterDays: 30,
    enabled: true,
  },
  {
    logLevel: "WARN",
    retentionDays: 90,
    archiveAfterDays: 30,
    deleteAfterDays: 90,
    enabled: true,
  },
  {
    logLevel: "ERROR",
    retentionDays: 365,
    archiveAfterDays: 90,
    deleteAfterDays: 365,
    enabled: true,
  },
  {
    logLevel: "CRITICAL",
    retentionDays: 730, // 2 years
    archiveAfterDays: 180,
    deleteAfterDays: 730,
    enabled: true,
  },
];

class LogRetentionManager {
  /**
   * Initialize retention policies
   */
  async initializePolicies(): Promise<void> {
    try {
      for (const policy of DEFAULT_POLICIES) {
        await db.logRetentionPolicy.upsert({
          where: { logLevel: policy.logLevel },
          update: {},
          create: policy,
        });
      }

      logger.info(LogCategory.SYSTEM, "Log retention policies initialized", {
        metadata: { policyCount: DEFAULT_POLICIES.length },
      });
    } catch (error) {
      logger.error(LogCategory.SYSTEM, "Failed to initialize log retention policies", {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : undefined,
      });
    }
  }

  /**
   * Get active retention policies
   */
  async getPolicies(): Promise<RetentionPolicy[]> {
    return await db.logRetentionPolicy.findMany({
      where: { enabled: true },
    });
  }

  /**
   * Clean up old logs based on retention policies
   */
  async cleanupLogs(): Promise<{
    archived: number;
    deleted: number;
    errors: number;
  }> {
    const startTime = Date.now();
    let archived = 0;
    let deleted = 0;
    let errors = 0;

    try {
      const policies = await this.getPolicies();

      for (const policy of policies) {
        try {
          // Delete logs older than retention period
          const deleteCutoff = new Date();
          deleteCutoff.setDate(deleteCutoff.getDate() - policy.deleteAfterDays);

          const deleteResult = await db.systemLog.deleteMany({
            where: {
              level: policy.logLevel,
              timestamp: {
                lt: deleteCutoff,
              },
            },
          });

          deleted += deleteResult.count;

          logger.debug(
            LogCategory.SYSTEM,
            `Deleted ${deleteResult.count} ${policy.logLevel} logs older than ${policy.deleteAfterDays} days`
          );
        } catch (error) {
          errors++;
          logger.error(LogCategory.SYSTEM, `Failed to clean up ${policy.logLevel} logs`, {
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                  }
                : undefined,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info(
        LogCategory.SYSTEM,
        `Log cleanup completed: ${deleted} deleted, ${archived} archived, ${errors} errors`,
        {
          duration,
          metadata: { archived, deleted, errors },
        }
      );

      return { archived, deleted, errors };
    } catch (error) {
      logger.error(LogCategory.SYSTEM, "Log cleanup failed", {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : undefined,
      });

      throw error;
    }
  }

  /**
   * Generate log summary for a time period
   */
  async generateSummary(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalLogs: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    topErrors: Array<{ message: string; count: number }>;
    topUsers: Array<{ userId: string; count: number }>;
    topCountries: Array<{ countryId: string; count: number }>;
  }> {
    try {
      const logs = await db.systemLog.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          level: true,
          category: true,
          errorMessage: true,
          userId: true,
          countryId: true,
        },
      });

      // Aggregate by level
      const byLevel: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const errorMessages: Record<string, number> = {};
      const userCounts: Record<string, number> = {};
      const countryCounts: Record<string, number> = {};

      for (const log of logs) {
        // By level
        byLevel[log.level] = (byLevel[log.level] || 0) + 1;

        // By category
        byCategory[log.category] = (byCategory[log.category] || 0) + 1;

        // Error messages
        if (log.errorMessage) {
          errorMessages[log.errorMessage] = (errorMessages[log.errorMessage] || 0) + 1;
        }

        // User counts
        if (log.userId) {
          userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
        }

        // Country counts
        if (log.countryId) {
          countryCounts[log.countryId] = (countryCounts[log.countryId] || 0) + 1;
        }
      }

      // Top errors
      const topErrors = Object.entries(errorMessages)
        .map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top users
      const topUsers = Object.entries(userCounts)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top countries
      const topCountries = Object.entries(countryCounts)
        .map(([countryId, count]) => ({ countryId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalLogs: logs.length,
        byLevel,
        byCategory,
        topErrors,
        topUsers,
        topCountries,
      };
    } catch (error) {
      logger.error(LogCategory.SYSTEM, "Failed to generate log summary", {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : undefined,
      });

      throw error;
    }
  }

  /**
   * Start automated cleanup schedule
   * Runs daily at 2 AM
   */
  startScheduledCleanup(): NodeJS.Timeout {
    const runCleanup = () => {
      this.cleanupLogs().catch((error) => {
        console.error("[Log Retention] Scheduled cleanup failed:", error);
      });
    };

    // Calculate time until next 2 AM
    const now = new Date();
    const next2AM = new Date();
    next2AM.setHours(2, 0, 0, 0);

    if (next2AM <= now) {
      next2AM.setDate(next2AM.getDate() + 1);
    }

    const timeUntil2AM = next2AM.getTime() - now.getTime();

    // Schedule first run
    setTimeout(() => {
      runCleanup();

      // Then run daily
      setInterval(runCleanup, 24 * 60 * 60 * 1000);
    }, timeUntil2AM);

    logger.info(
      LogCategory.SYSTEM,
      `Scheduled log cleanup will run daily at 2 AM (next run in ${Math.round(timeUntil2AM / 1000 / 60)} minutes)`
    );

    return setTimeout(() => {}, 0); // Return dummy timeout
  }
}

// Export singleton
export const logRetentionManager = new LogRetentionManager();
