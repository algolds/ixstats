import { z } from "zod";
import { publicProcedure } from "~/server/api/trpc";
import {
  calculateCountryDataWithAtomicEnhancement,
  getAtomicIntelligenceRecommendations,
} from "~/lib/atomic-economic-integration.server";
import { type CountryWithAtomicComponents } from "~/lib/atomic-economic-integration";
import { getAtomicEffectivenessService } from "~/services/AtomicEffectivenessService";
import { ComponentType } from "@prisma/client";

export const atomicProcedures = {
  // Get country with atomic enhancement
  getByNameWithAtomic: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = (await ctx.db.country.findUnique({
        where: { name: input.name },
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
        },
      })) as CountryWithAtomicComponents | null;

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

  // Get countries filtered by atomic components
  getByAtomicComponents: publicProcedure
    .input(
      z.object({
        componentTypes: z.array(z.nativeEnum(ComponentType)),
        requireAll: z.boolean().default(false), // true = AND, false = OR
      })
    )
    .query(async ({ ctx, input }) => {
      let countries;

      if (input.requireAll) {
        // For AND logic, we need to check that all components exist
        countries = await ctx.db.country.findMany({
          where: { isDemo: false },
          include: {
            governmentComponents: {
              where: { isActive: true },
            },
          },
        });

        // Filter for countries that have ALL required components
        countries = countries.filter((country) =>
          input.componentTypes.every((componentType) =>
            country.governmentComponents.some(
              (comp) => comp.componentType === componentType && comp.isActive
            )
          )
        );
      } else {
        // For OR logic, use Prisma's some query
        countries = await ctx.db.country.findMany({
          where: {
            isDemo: false,
            governmentComponents: {
              some: {
                componentType: { in: input.componentTypes },
                isActive: true,
              },
            },
          },
          include: {
            governmentComponents: {
              where: { isActive: true },
            },
          },
        });
      }

      return countries;
    }),

  // Get atomic effectiveness for a country
  getAtomicEffectiveness: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const atomicService = getAtomicEffectivenessService(ctx.db);
      return atomicService.getCountryEffectiveness(input.countryId);
    }),

  // Get atomic intelligence recommendations
  getAtomicIntelligenceRecommendations: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return getAtomicIntelligenceRecommendations(input.countryId);
    }),

  // Get component effectiveness breakdown
  getComponentEffectivenessBreakdown: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          governmentComponents: { where: { isActive: true } },
        },
      });

      if (!country) return null;

      const atomicService = getAtomicEffectivenessService(ctx.db);
      const componentTypes = country.governmentComponents.map((c) => c.componentType);
      const breakdown = atomicService.getComponentBreakdown(componentTypes);

      const synergies = atomicService.detectPotentialSynergies(componentTypes);
      const conflicts = atomicService.detectConflicts(componentTypes);

      return {
        components: breakdown,
        synergies,
        conflicts,
        totalComponents: componentTypes.length,
        synergyCount: synergies.length,
        conflictCount: conflicts.length,
      };
    }),
};
