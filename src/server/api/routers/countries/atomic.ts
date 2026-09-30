import { z } from "zod";
import { publicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { calculateCountryDataWithAtomicEnhancement } from "~/lib/economy/atomic-integration.server";
import { type CountryWithAtomicComponents } from "~/lib/economy/atomic-integration";

export const atomicProcedures = {
  // Get country with atomic enhancement
  getByNameWithAtomic: publicProcedure
    .input(z.object({ name: z.string(), ...realmScopeInput.shape }))
    .query(async ({ ctx, input }) => {
      // Names repeat across realms (ruling E-p): /maps?name= resolves in the viewer's realm.
      const country = (await ctx.db.country.findFirst({
        where: {
          realmId: await viewerRealmId(ctx, input.realm),
          name: { equals: input.name, mode: "insensitive" as const },
        },
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
