// src/server/api/routers/government.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { detectGovernmentConflicts } from "~/server/services/builderIntegrationService";
import { GovernmentBuilderStateSchema } from "~/types/government";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { rollBudgetForward } from "~/lib/government/budget-allocations";

export const governmentCrudRouter = createTRPCRouter({
  // Get government structure by country ID with configurable includes
  // Phase 1 optimization: Added limits to prevent unbounded data fetching
  getByCountryId: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        // Pagination options for nested data (defaults are optimized for typical use)
        budgetYearsLimit: z.number().min(1).max(10).default(3),
        includeSubDepartments: z.boolean().default(false),
        includeSubBudgets: z.boolean().default(false),
        revenueSourcesLimit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const {
        countryId,
        budgetYearsLimit,
        includeSubDepartments,
        includeSubBudgets,
        revenueSourcesLimit,
      } = input;

      const governmentStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId },
        include: {
          departments: {
            include: {
              // Conditionally include sub-departments to reduce payload
              ...(includeSubDepartments && { subDepartments: true }),
              budgetAllocations: {
                orderBy: { budgetYear: "desc" },
                take: budgetYearsLimit, // Limit budget history per department
              },
              ...(includeSubBudgets && { subBudgets: true }),
            },
            orderBy: { priority: "desc" },
          },
          budgetAllocations: {
            include: { department: true },
            orderBy: { budgetYear: "desc" },
            take: budgetYearsLimit * 20, // Limit total allocations (years * estimated departments)
          },
          revenueSources: {
            where: { isActive: true },
            orderBy: { revenueAmount: "desc" },
            take: revenueSourcesLimit,
          },
          branches: { orderBy: { order: "asc" } },
        },
      });

      if (!governmentStructure) {
        return null;
      }

      return governmentStructure;
    }),

  // Get full government structure without limits (admin/export use cases)
  getFullByCountryId: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const governmentStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        include: {
          departments: {
            include: {
              subDepartments: true,
              budgetAllocations: {
                orderBy: { budgetYear: "desc" },
              },
              subBudgets: true,
            },
            orderBy: { priority: "desc" },
          },
          budgetAllocations: {
            include: { department: true },
            orderBy: { budgetYear: "desc" },
          },
          revenueSources: {
            where: { isActive: true },
            orderBy: { revenueAmount: "desc" },
          },
          branches: { orderBy: { order: "asc" } },
        },
      });

      return governmentStructure;
    }),

  // Check for conflicts before creating/updating
  checkConflicts: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: GovernmentBuilderStateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const warnings = await detectGovernmentConflicts(ctx.db as any, input.countryId, input.data);
      return { warnings };
    }),

  /**
   * Start the current IxTime year's budget by copying the budget in effect (MC-1). Departments
   * that already have an allocation for the year keep it.
   */
  startBudgetYear: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return rollBudgetForward(ctx.db, input.countryId);
    }),
});
