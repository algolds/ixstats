import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

/**
 * AutosaveHistory Router
 *
 * Provides endpoints to query autosave history from the AuditLog table.
 * Autosave actions are stored with action patterns like 'autosave:nationalIdentity', 'autosave:government', etc.
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

      // Verify user owns the country (any nation they own, not only the active one)
      await assertCountryWriteAccess(ctx, input.countryId);

      // Get total count for pagination
      const total = await ctx.db.auditLog.count({
        where: {
          target: countryId,
          action: {
            startsWith: "autosave:",
          },
        },
      });

      // Query autosave records for this country
      const autosaves = await ctx.db.auditLog.findMany({
        where: {
          target: countryId,
          action: {
            startsWith: "autosave:",
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

      // Verify user owns the country (any nation they own, not only the active one)
      await assertCountryWriteAccess(ctx, input.countryId);

      // Aggregate at the DB layer instead of loading every autosave row and scanning
      // it 4+ times in JS. autosave: actions are a small set of distinct strings
      // (e.g. autosave:nationalIdentity, autosave:government), so grouping by
      // `action` returns only a handful of rows regardless of history size. (audit B2)
      const baseWhere = {
        target: countryId,
        action: { startsWith: "autosave:" },
      };

      const [grouped, last] = await Promise.all([
        ctx.db.auditLog.groupBy({
          by: ["action", "success"],
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

        if (group.success) {
          successCount += count;
        } else {
          failureCount += count;
        }

        const actionLower = group.action.toLowerCase();
        if (actionLower.includes("identity")) sectionBreakdown.identity += count;
        else if (actionLower.includes("government")) sectionBreakdown.government += count;
        else if (actionLower.includes("tax")) sectionBreakdown.tax += count;
        else if (actionLower.includes("economy")) sectionBreakdown.economy += count;
      }

      return {
        totalAutosaves,
        successCount,
        failureCount,
        lastAutosave: last?.timestamp ?? null,
        sectionBreakdown,
      };
    }),
});
