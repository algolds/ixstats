import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

/**
 * AutosaveHistory Router
 *
 * Provides endpoints to query autosave history from the AuditLog table.
 * Autosave actions are stored with action patterns like 'AUTOSAVE_IDENTITY_SAVED', 'AUTOSAVE_GOVERNMENT_FAILED', etc.
 */
export const autosaveHistoryRouter = createTRPCRouter({
  /**
   * Get paginated autosave history for a specific country
   *
   * @param countryId - The country ID to get autosaves for
   * @param limit - Number of records to return (default: 20)
   * @param offset - Number of records to skip (default: 0)
   * @returns Paginated list of autosave records with total count and hasMore indicator
   */
  getAutosaveHistory: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { countryId, limit, offset } = input;

      // Verify user owns the country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this country's autosave history",
        });
      }

      // Get total count for pagination
      const total = await ctx.db.auditLog.count({
        where: {
          target: countryId,
          action: {
            startsWith: "AUTOSAVE_",
          },
        },
      });

      // Query autosave records for this country
      const autosaves = await ctx.db.auditLog.findMany({
        where: {
          target: countryId,
          action: {
            startsWith: "AUTOSAVE_",
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
        skip: offset,
      });

      return {
        autosaves,
        total,
        hasMore: offset + limit < total,
      };
    }),

  /**
   * Get summary statistics for autosaves of a specific country
   *
   * @param countryId - The country ID to get stats for
   * @returns Aggregated autosave statistics with section breakdown
   */
  getAutosaveStats: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { countryId } = input;

      // Verify user owns the country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this country's autosave statistics",
        });
      }

      // Get all autosave records for this country
      const allAutosaves = await ctx.db.auditLog.findMany({
        where: {
          target: countryId,
          action: {
            startsWith: "AUTOSAVE_",
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      // Calculate statistics
      const totalAutosaves = allAutosaves.length;
      const successCount = allAutosaves.filter(
        (log) => !log.action.includes("_FAILED")
      ).length;
      const failureCount = allAutosaves.filter((log) =>
        log.action.includes("_FAILED")
      ).length;
      const lastAutosave =
        allAutosaves.length > 0 ? allAutosaves[0]!.timestamp : null;

      // Section breakdown (count by section type)
      const sectionBreakdown = {
        identity: allAutosaves.filter((log) =>
          log.action.includes("IDENTITY")
        ).length,
        government: allAutosaves.filter((log) =>
          log.action.includes("GOVERNMENT")
        ).length,
        tax: allAutosaves.filter((log) => log.action.includes("TAX")).length,
        economy: allAutosaves.filter((log) => log.action.includes("ECONOMY"))
          .length,
      };

      return {
        totalAutosaves,
        successCount,
        failureCount,
        lastAutosave,
        sectionBreakdown,
      };
    }),

  /**
   * Get recent autosaves across all countries for the current user
   *
   * @param limit - Number of records to return (default: 10)
   * @returns List of recent autosave records across all user's countries
   */
  getRecentAutosaves: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit } = input;

      // Get autosaves for this user
      const autosaves = await ctx.db.auditLog.findMany({
        where: {
          userId: ctx.auth.userId,
          action: {
            startsWith: "AUTOSAVE_",
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
      });

      return {
        autosaves,
      };
    }),

  /**
   * Get failed autosaves for a specific country (for debugging)
   *
   * @param countryId - The country ID to get failed autosaves for
   * @param limit - Number of records to return (default: 10)
   * @returns List of failed autosave records
   */
  getFailedAutosaves: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { countryId, limit } = input;

      // Verify user owns the country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this country's failed autosaves",
        });
      }

      const failures = await ctx.db.auditLog.findMany({
        where: {
          target: countryId,
          action: {
            contains: "_FAILED",
            startsWith: "AUTOSAVE_",
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
      });

      return {
        failures,
      };
    }),

  /**
   * Get time-series autosave data for a specific country within a date range
   *
   * @param countryId - The country ID to get timeline for
   * @param startDate - Optional start of the date range
   * @param endDate - Optional end of the date range
   * @returns Time-series autosave data grouped by date and section
   */
  getAutosaveTimeline: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { countryId, startDate, endDate } = input;

      // Verify user owns the country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this country's autosave timeline",
        });
      }

      // Build where clause with optional date filtering
      const whereClause: {
        target: string;
        action: { startsWith: string };
        timestamp?: { gte?: Date; lte?: Date };
      } = {
        target: countryId,
        action: {
          startsWith: "AUTOSAVE_",
        },
      };

      if (startDate || endDate) {
        whereClause.timestamp = {};
        if (startDate) {
          whereClause.timestamp.gte = startDate;
        }
        if (endDate) {
          whereClause.timestamp.lte = endDate;
        }
      }

      const autosaves = await ctx.db.auditLog.findMany({
        where: whereClause,
        orderBy: {
          timestamp: "asc",
        },
      });

      // Group by date and section
      const timelineMap = new Map<
        string,
        Map<string, number>
      >();

      autosaves.forEach((log) => {
        const dateKey = log.timestamp.toISOString().split("T")[0]!;

        // Extract section from action (e.g., "AUTOSAVE_IDENTITY_SAVED" -> "identity")
        let section = "unknown";
        if (log.action.includes("IDENTITY")) section = "identity";
        else if (log.action.includes("GOVERNMENT")) section = "government";
        else if (log.action.includes("TAX")) section = "tax";
        else if (log.action.includes("ECONOMY")) section = "economy";

        if (!timelineMap.has(dateKey)) {
          timelineMap.set(dateKey, new Map());
        }

        const dateMap = timelineMap.get(dateKey)!;
        dateMap.set(section, (dateMap.get(section) || 0) + 1);
      });

      // Convert to array format
      const timeline: Array<{ date: string; count: number; section: string }> =
        [];

      timelineMap.forEach((sectionMap, date) => {
        sectionMap.forEach((count, section) => {
          timeline.push({ date, count, section });
        });
      });

      return {
        timeline,
      };
    }),
});
