import { z } from "zod";
import { protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { getAtomicEffectivenessService } from "~/server/services/AtomicEffectivenessService";
import { invalidateCache } from "~/lib/cache";

export const managementAdminProcedures = {
  // SECURITY: Admin-only endpoint for triggering system-wide economic narratives
  triggerEconomicNarrative: adminProcedure.mutation(async ({ ctx }) => {
    console.log(`[AUDIT] Economic narrative triggered by admin userId=${ctx.auth?.userId}`);
    const { detectEconomicMilestoneAndTriggerNarrative } = await import("~/lib/activity");
    await detectEconomicMilestoneAndTriggerNarrative();
    return { success: true, message: "Economic narrative triggered" };
  }),

  // General update mutation for country fields (used by editor)

  // Toggle atomic government mode for a country
  toggleAtomicGovernment: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        useAtomic: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.country.update({
        where: { id: input.countryId },
        data: { usesAtomicGovernment: input.useAtomic },
      });

      // Invalidate cache for this country
      const atomicService = getAtomicEffectivenessService(ctx.db);
      atomicService.invalidateCache(input.countryId);

      await invalidateCache(["countries."]);

      return updated;
    }),

  // Recalculate atomic effectiveness
  recalculateAtomicEffectiveness: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const atomicService = getAtomicEffectivenessService(ctx.db);

      // Force recalculation by bypassing cache
      const effectiveness = await atomicService.calculateEffectiveness(input.countryId);

      return effectiveness;
    }),

  // Create a new country from builder

  // Storyteller effects endpoints
};
