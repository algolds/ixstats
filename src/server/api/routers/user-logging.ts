/**
 * User Logging and Analytics tRPC Router
 *
 * Provides endpoints for accessing user activity logs, analytics,
 * and behavior insights.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { UserLogger } from "~/lib/user-logger";
import { UserActivityAnalytics } from "~/lib/user-activity-analytics";
import { ErrorLogger } from "~/lib/error-logger";
import { TRPCError } from "@trpc/server";

export const userLoggingRouter = createTRPCRouter({
  /**
   * Get current user's activity summary
   */
  getMyActivitySummary: protectedProcedure
    .input(
      z.object({
        period: z.enum(["day", "week", "month", "quarter", "year"]).default("week"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not found",
          });
        }

        const summary = await UserActivityAnalytics.getUserActivityMetrics(
          ctx.user.id,
          input.period
        );

        return summary;
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          component: "UserLoggingRouter",
          action: "GET_MY_ACTIVITY_SUMMARY",
          userId: ctx.user?.id,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get activity summary",
        });
      }
    }),

  /**
   * Get current user's behavior pattern analysis
   */
  getMyBehaviorPattern: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found",
        });
      }

      const pattern = await UserActivityAnalytics.analyzeUserBehaviorPattern(ctx.user.id);

      return pattern;
    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: "UserLoggingRouter",
        action: "GET_MY_BEHAVIOR_PATTERN",
        userId: ctx.user?.id,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to analyze behavior pattern",
      });
    }
  }),

  /**
   * Get system-wide activity overview (admin only)
   */
  getSystemActivityOverview: adminProcedure
    .input(
      z.object({
        period: z.enum(["day", "week", "month"]).default("week"),
      })
    )
    .query(async ({ input }) => {
      try {
        const overview = await UserActivityAnalytics.getSystemActivityOverview(input.period);

        return overview;
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          component: "UserLoggingRouter",
          action: "GET_SYSTEM_ACTIVITY_OVERVIEW",
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get system activity overview",
        });
      }
    }),

  /**
   * Get specific user's activity metrics (admin only)
   */
  getUserActivityMetrics: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        period: z.enum(["day", "week", "month", "quarter", "year"]).default("week"),
      })
    )
    .query(async ({ input }) => {
      try {
        const metrics = await UserActivityAnalytics.getUserActivityMetrics(
          input.userId,
          input.period
        );

        return metrics;
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          component: "UserLoggingRouter",
          action: "GET_USER_ACTIVITY_METRICS",
          userId: input.userId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get user activity metrics",
        });
      }
    }),

  /**
   * Get specific user's behavior pattern (admin only)
   */
  getUserBehaviorPattern: adminProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const pattern = await UserActivityAnalytics.analyzeUserBehaviorPattern(input.userId);

        return pattern;
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          component: "UserLoggingRouter",
          action: "GET_USER_BEHAVIOR_PATTERN",
          userId: input.userId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to analyze user behavior pattern",
        });
      }
    }),

  /**
   * Get user activity logs (admin only)
   */
  getUserActivityLogs: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
        category: z.string().optional(),
        level: z.enum(["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          userId: input.userId,
          category: "USER_ACTION",
        };

        if (input.startDate || input.endDate) {
          where.timestamp = {};
          if (input.startDate) where.timestamp.gte = input.startDate;
          if (input.endDate) where.timestamp.lte = input.endDate;
        }

        if (input.category) {
          where.metadata = {
            contains: `"category":"${input.category}"`,
          };
        }

        if (input.level) {
          where.level = input.level;
        }

        const logs = await ctx.db.systemLog.findMany({
          where,
          orderBy: { timestamp: "desc" },
          take: input.limit,
          skip: input.offset,
        });

        const total = await ctx.db.systemLog.count({ where });

        return {
          logs,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          component: "UserLoggingRouter",
          action: "GET_USER_ACTIVITY_LOGS",
          userId: input.userId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get user activity logs",
        });
      }
    }),

  /**
   * Get user session information (admin only)
   */
  getUserSessions: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        activeOnly: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: { clerkUserId: true },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        const where: any = {
          clerkUserId: user.clerkUserId,
        };

        if (input.activeOnly) {
          where.isActive = true;
        }

        const sessions = await ctx.db.userSession.findMany({
          where,
          orderBy: { lastActivity: "desc" },
        });

        return sessions;
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          component: "UserLoggingRouter",
          action: "GET_USER_SESSIONS",
          userId: input.userId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get user sessions",
        });
      }
    }),

  /**
   * Clean up old user logs (admin only)
   */
  cleanupOldLogs: adminProcedure.mutation(async () => {
    try {
      await UserLogger.cleanupOldLogs();

      return {
        success: true,
        message: "Old user logs cleaned up successfully",
      };
    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: "UserLoggingRouter",
        action: "CLEANUP_OLD_LOGS",
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to cleanup old logs",
      });
    }
  }),

  /**
   * Export user activity data (admin only)
   */
  exportUserActivity: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        startDate: z.date(),
        endDate: z.date(),
        format: z.enum(["json", "csv"]).default("json"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const logs = await ctx.db.systemLog.findMany({
          where: {
            userId: input.userId,
            category: "USER_ACTION",
            timestamp: {
              gte: input.startDate,
              lte: input.endDate,
            },
          },
          orderBy: { timestamp: "asc" },
        });

        if (input.format === "csv") {
          // Convert to CSV format
          const csvHeaders = [
            "timestamp",
            "level",
            "category",
            "message",
            "action",
            "success",
            "duration",
            "ip",
            "userAgent",
          ];

          const csvRows = logs.map((log) => {
            const metadata = log.metadata ? JSON.parse(log.metadata) : {};
            return [
              log.timestamp.toISOString(),
              log.level,
              log.category,
              log.message,
              metadata.action || "",
              metadata.success || "",
              log.duration || "",
              log.ip || "",
              log.userAgent || "",
            ]
              .map((field) => `"${String(field).replace(/"/g, '""')}"`)
              .join(",");
          });

          const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");

          return {
            success: true,
            data: csvContent,
            format: "csv",
            filename: `user-activity-${input.userId}-${input.startDate.toISOString().split("T")[0]}-to-${input.endDate.toISOString().split("T")[0]}.csv`,
          };
        } else {
          // Return as JSON
          return {
            success: true,
            data: logs,
            format: "json",
            filename: `user-activity-${input.userId}-${input.startDate.toISOString().split("T")[0]}-to-${input.endDate.toISOString().split("T")[0]}.json`,
          };
        }
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          component: "UserLoggingRouter",
          action: "EXPORT_USER_ACTIVITY",
          userId: input.userId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export user activity data",
        });
      }
    }),

  /**
   * Get user activity statistics for dashboard
   */
  getActivityStats: protectedProcedure
    .input(
      z.object({
        period: z.enum(["day", "week", "month"]).default("week"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not found",
          });
        }

        const metrics = await UserActivityAnalytics.getUserActivityMetrics(
          ctx.user.id,
          input.period
        );

        // Return simplified stats for dashboard
        return {
          totalActions: metrics.totalActions,
          errorRate: metrics.errorRate,
          engagementScore: metrics.engagementScore,
          topActions: metrics.topActions.slice(0, 5),
          activityTrend: metrics.activityTrend,
          securityEvents: metrics.securityEvents,
        };
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          component: "UserLoggingRouter",
          action: "GET_ACTIVITY_STATS",
          userId: ctx.user?.id,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get activity statistics",
        });
      }
    }),
});
