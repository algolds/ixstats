import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

/**
 * AutosaveMonitoring Router
 *
 * Admin-only endpoints for monitoring autosave system health and performance.
 * All autosave data is stored in the AuditLog table with action patterns like:
 * 'autosave:identity', 'autosave:government', 'autosave:tax', 'autosave:economy'
 */

/**
 * Convert time range enum to Date object
 */
function getTimeRangeDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

/**
 * Get granularity interval in milliseconds
 */
function getGranularityInterval(granularity: string): number {
  switch (granularity) {
    case 'minute':
      return 60 * 1000;
    case 'hour':
      return 60 * 60 * 1000;
    case 'day':
      return 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000; // Default to hour
  }
}

/**
 * Group timestamp by granularity
 */
function groupByGranularity(timestamp: Date, granularity: string): string {
  const date = new Date(timestamp);

  switch (granularity) {
    case 'minute':
      date.setSeconds(0, 0);
      return date.toISOString();
    case 'hour':
      date.setMinutes(0, 0, 0);
      return date.toISOString();
    case 'day':
      date.setHours(0, 0, 0, 0);
      return date.toISOString();
    default:
      date.setMinutes(0, 0, 0);
      return date.toISOString();
  }
}

export const autosaveMonitoringRouter = createTRPCRouter({
  /**
   * Get aggregate autosave statistics
   *
   * Provides high-level metrics including total autosaves, success rate,
   * most active users, and breakdown by section.
   */
  getAutosaveStats: adminProcedure
    .input(
      z.object({
        timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = getTimeRangeDate(input.timeRange);

      // Get all autosave records within time range
      const autosaves = await ctx.db.auditLog.findMany({
        where: {
          action: {
            startsWith: "autosave:",
          },
          timestamp: {
            gte: startDate,
          },
        },
        select: {
          id: true,
          userId: true,
          action: true,
          success: true,
          timestamp: true,
          details: true,
        },
      });

      // Calculate statistics
      const totalAutosaves = autosaves.length;
      const successCount = autosaves.filter((a) => a.success).length;
      const successRate = totalAutosaves > 0 ? (successCount / totalAutosaves) * 100 : 0;

      // Calculate average duration if tracked in details
      let averageDuration = 0;
      let durationCount = 0;
      autosaves.forEach((autosave) => {
        if (autosave.details) {
          try {
            const details = JSON.parse(autosave.details);
            if (details.duration && typeof details.duration === 'number') {
              averageDuration += details.duration;
              durationCount++;
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      });
      if (durationCount > 0) {
        averageDuration = averageDuration / durationCount;
      }

      // Most active users
      const userCountMap = new Map<string, number>();
      autosaves.forEach((autosave) => {
        if (autosave.userId) {
          userCountMap.set(autosave.userId, (userCountMap.get(autosave.userId) || 0) + 1);
        }
      });
      const mostActiveUsers = Array.from(userCountMap.entries())
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Section breakdown
      const sectionCounts = {
        identity: 0,
        government: 0,
        tax: 0,
        economy: 0,
      };
      autosaves.forEach((autosave) => {
        const section = autosave.action.split(':')[1] as keyof typeof sectionCounts;
        if (section && section in sectionCounts) {
          sectionCounts[section]++;
        }
      });

      return {
        totalAutosaves,
        successRate,
        averageDuration,
        mostActiveUsers,
        sectionBreakdown: sectionCounts,
      };
    }),

  /**
   * Get time-series data for autosaves
   *
   * Returns autosave counts grouped by time interval (minute/hour/day)
   * for charting and trend analysis.
   */
  getAutosaveTimeSeries: adminProcedure
    .input(
      z.object({
        timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
        granularity: z.enum(['minute', 'hour', 'day']).default('hour'),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = getTimeRangeDate(input.timeRange);

      // Get autosave records within time range
      const autosaves = await ctx.db.auditLog.findMany({
        where: {
          action: {
            startsWith: "autosave:",
          },
          timestamp: {
            gte: startDate,
          },
        },
        select: {
          timestamp: true,
          success: true,
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      // Group by granularity
      const timeSeriesMap = new Map<string, { timestamp: string; count: number; successCount: number; failureCount: number }>();

      autosaves.forEach((autosave) => {
        const timeKey = groupByGranularity(autosave.timestamp, input.granularity);

        if (!timeSeriesMap.has(timeKey)) {
          timeSeriesMap.set(timeKey, {
            timestamp: timeKey,
            count: 0,
            successCount: 0,
            failureCount: 0,
          });
        }

        const bucket = timeSeriesMap.get(timeKey)!;
        bucket.count++;
        if (autosave.success) {
          bucket.successCount++;
        } else {
          bucket.failureCount++;
        }
      });

      // Convert to array and sort by timestamp
      const series = Array.from(timeSeriesMap.values()).sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp)
      );

      return { series };
    }),

  /**
   * Get failure analysis
   *
   * Provides breakdown of autosave failures by error type and section,
   * useful for identifying systemic issues.
   */
  getFailureAnalysis: adminProcedure
    .input(
      z.object({
        timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = getTimeRangeDate(input.timeRange);

      // Get failed autosave records
      const failures = await ctx.db.auditLog.findMany({
        where: {
          action: {
            startsWith: "autosave:",
          },
          success: false,
          timestamp: {
            gte: startDate,
          },
        },
        select: {
          action: true,
          error: true,
        },
      });

      const totalFailures = failures.length;

      // Group by error type
      const errorCountMap = new Map<string, number>();
      failures.forEach((failure) => {
        const errorMsg = failure.error || 'Unknown error';
        errorCountMap.set(errorMsg, (errorCountMap.get(errorMsg) || 0) + 1);
      });
      const errorTypes = Array.from(errorCountMap.entries())
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count);

      // Group by section
      const sectionCountMap = new Map<string, number>();
      failures.forEach((failure) => {
        const section = failure.action.split(':')[1] || 'unknown';
        sectionCountMap.set(section, (sectionCountMap.get(section) || 0) + 1);
      });
      const failedSections = Array.from(sectionCountMap.entries())
        .map(([section, count]) => ({ section, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalFailures,
        errorTypes,
        failedSections,
      };
    }),

  /**
   * Get active users with autosave activity
   *
   * Returns list of users who have performed autosaves within the time range,
   * including their autosave count and failure statistics.
   */
  getActiveUsers: adminProcedure
    .input(
      z.object({
        timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = getTimeRangeDate(input.timeRange);

      // Get autosave records within time range
      const autosaves = await ctx.db.auditLog.findMany({
        where: {
          action: {
            startsWith: "autosave:",
          },
          timestamp: {
            gte: startDate,
          },
          userId: {
            not: null,
          },
        },
        select: {
          userId: true,
          success: true,
          timestamp: true,
        },
      });

      // Group by user
      const userStatsMap = new Map<string, {
        userId: string;
        autosaveCount: number;
        lastAutosave: Date;
        failureCount: number;
      }>();

      autosaves.forEach((autosave) => {
        if (!autosave.userId) return;

        if (!userStatsMap.has(autosave.userId)) {
          userStatsMap.set(autosave.userId, {
            userId: autosave.userId,
            autosaveCount: 0,
            lastAutosave: autosave.timestamp,
            failureCount: 0,
          });
        }

        const userStats = userStatsMap.get(autosave.userId)!;
        userStats.autosaveCount++;
        if (!autosave.success) {
          userStats.failureCount++;
        }
        if (autosave.timestamp > userStats.lastAutosave) {
          userStats.lastAutosave = autosave.timestamp;
        }
      });

      // Convert to array and sort by autosave count
      const users = Array.from(userStatsMap.values()).sort((a, b) =>
        b.autosaveCount - a.autosaveCount
      );

      return { users };
    }),

  /**
   * Get system health metrics
   *
   * Provides real-time health status based on recent autosave activity,
   * failure rates, and response times.
   */
  getSystemHealth: adminProcedure.query(async ({ ctx }) => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Get autosaves from last 5 minutes
    const recentAutosaves = await ctx.db.auditLog.findMany({
      where: {
        action: {
          startsWith: "autosave:",
        },
        timestamp: {
          gte: fiveMinutesAgo,
        },
      },
      select: {
        success: true,
        details: true,
      },
    });

    const autosavesLast5Min = recentAutosaves.length;
    const failuresLast5Min = recentAutosaves.filter((a) => !a.success).length;

    // Calculate average response time if tracked
    let avgResponseTime: number | null = null;
    let durationSum = 0;
    let durationCount = 0;

    recentAutosaves.forEach((autosave) => {
      if (autosave.details) {
        try {
          const details = JSON.parse(autosave.details);
          if (details.duration && typeof details.duration === 'number') {
            durationSum += details.duration;
            durationCount++;
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    });

    if (durationCount > 0) {
      avgResponseTime = durationSum / durationCount;
    }

    // Determine health status
    let status: 'healthy' | 'degraded' | 'critical';
    const failureRate = autosavesLast5Min > 0 ? (failuresLast5Min / autosavesLast5Min) * 100 : 0;

    if (failureRate >= 50) {
      status = 'critical';
    } else if (failureRate >= 20 || (avgResponseTime && avgResponseTime > 5000)) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      autosavesLast5Min,
      failuresLast5Min,
      avgResponseTime,
      status,
    };
  }),
});
