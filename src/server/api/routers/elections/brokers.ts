import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";
import { loadEffectiveBudget } from "~/lib/government/budget-allocations";

export const electionsBrokersRouter = createTRPCRouter({
  getPowerBrokers: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Load active components
      const components = await ctx.db.governmentComponent.findMany({
        where: { countryId: input.countryId, isActive: true },
        select: { componentType: true },
      });

      // The budget in effect (latest year at or before the current IxTime year) + categories
      const { allocations } = await loadEffectiveBudget(ctx.db, input.countryId);

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
