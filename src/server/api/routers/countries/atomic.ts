import { z } from "zod";
import { publicProcedure } from "~/server/api/trpc";
import { calculateCountryDataWithAtomicEnhancement } from "~/lib/economy/atomic-integration.server";
import { type CountryWithAtomicComponents } from "~/lib/economy/atomic-integration";

export const atomicProcedures = {
  // Get country with atomic enhancement
  getByNameWithAtomic: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = (await ctx.db.country.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" as const } },
        include: {
          governmentComponents: {
            where: { isActive: true },
          },
          componentSynergies: {
            include: {
              primaryComponent: true,
              secondaryComponent: true,
            },
          },
          atomicEffectiveness: true,
          nationalIdentity: true,
        },
      })) as (CountryWithAtomicComponents & { nationalIdentity: any }) | null;

      if (!country) return null;

      // Calculate with atomic enhancements
      const enhancedData = await calculateCountryDataWithAtomicEnhancement(country);

      return {
        ...country,
        atomicEnhancements: enhancedData.economicImpactFromAtomic,
        enhancedGdpGrowth: enhancedData.enhancedGdpGrowth,
        enhancedTaxRevenue: enhancedData.enhancedTaxRevenue,
        stabilityIndex: enhancedData.stabilityIndex,
        governmentCapacityIndex: enhancedData.governmentCapacityIndex,
        atomicModifiers: enhancedData.atomicModifiers,
      };
    }),
};
