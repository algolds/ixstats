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

      // Aggregate at the DB layer instead of loading every autosave row and scanning
      // it 4+ times in JS. AUTOSAVE_ actions are a small set of distinct strings
      // (e.g. AUTOSAVE_IDENTITY_SAVED, AUTOSAVE_GOVERNMENT_FAILED), so grouping by
      // `action` returns only a handful of rows regardless of history size. (audit B2)
      const baseWhere = {
        target: countryId,
        action: { startsWith: "AUTOSAVE_" },
      };

      const [grouped, last] = await Promise.all([
        ctx.db.auditLog.groupBy({
          by: ["action"],
          where: baseWhere,
          _count: { _all: true },
        }),
        ctx.db.auditLog.findFirst({
          where: baseWhere,
          orderBy: { timestamp: "desc" },
          select: { timestamp: true },
        }),
      ]);

      let totalAutosaves = 0;
      let successCount = 0;
      let failureCount = 0;
      const sectionBreakdown = { identity: 0, government: 0, tax: 0, economy: 0 };

      for (const group of grouped) {
        const count = group._count._all;
        totalAutosaves += count;

        if (group.action.includes("_FAILED")) {
          failureCount += count;
        } else {
          successCount += count;
        }

        if (group.action.includes("IDENTITY")) sectionBreakdown.identity += count;
        else if (group.action.includes("GOVERNMENT")) sectionBreakdown.government += count;
        else if (group.action.includes("TAX")) sectionBreakdown.tax += count;
        else if (group.action.includes("ECONOMY")) sectionBreakdown.economy += count;
      }

      return {
        totalAutosaves,
        successCount,
        failureCount,
        lastAutosave: last?.timestamp ?? null,
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
      const timelineMap = new Map<string, Map<string, number>>();

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
      const timeline: Array<{ date: string; count: number; section: string }> = [];

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
