import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { deriveBrokers } from "~/lib/statecraft-power-brokers";

export const electionsBrokersRouter = createTRPCRouter({
  getPowerBrokers: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Load active components
      const components = await ctx.db.governmentComponent.findMany({
        where: { countryId: input.countryId, isActive: true },
        select: { componentType: true },
      });

      // Load current budget allocations + department categories
      const allocations = await ctx.db.budgetAllocation.findMany({
        where: {
          governmentStructure: { countryId: input.countryId },
          budgetYear: new Date().getFullYear(),
        },
        include: {
          department: {
            select: { category: true },
          },
        },
      });

      // Calculate total allocation percentages by department category
      const spendByCategory: Record<string, number> = {};
      allocations.forEach((alloc) => {
        const cat = alloc.department.category;
        spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
      });

      const activeComponentTypes = components.map((c) => c.componentType);
      return deriveBrokers(activeComponentTypes, spendByCategory);
    }),
});
