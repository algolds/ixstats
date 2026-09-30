// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly
// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const economicsConfigRouter = createTRPCRouter({
  // ==================== ECONOMY BUILDER CONFIGURATION ====================
  // Comprehensive save endpoint for the entire economy builder state

  // Get complete economy configuration
  getEconomyConfiguration: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          economicProfile: true,
          laborMarket: true,
          fiscalSystem: true,
          incomeDistribution: true,
          economicModel: true,
          nationalIdentity: true,
        },
      });

      if (!country) {
        return null;
      }

      // Transform database data back to builder configuration format
      let sectorBreakdown: any[] = [];
      if (country.economicProfile?.sectorBreakdown) {
        try {
          const parsed = JSON.parse(country.economicProfile.sectorBreakdown);
          if (Array.isArray(parsed)) {
            sectorBreakdown = parsed.filter(
              (x): x is Record<string, any> => x !== null && typeof x === "object"
            );
          }
        } catch (e) {
          console.error("[Economics Config] Failed to parse sectorBreakdown:", e);
        }
      }

      return {
        structure: {
          economicModel: "Mixed Economy",
          primarySectors: [],
          secondarySectors: [],
          tertiarySectors: [],
          totalGDP: country.currentTotalGdp || 0,
          gdpCurrency: country.nationalIdentity?.currency || "USD",
          economicTier: country.economicTier || "Developing",
          growthStrategy: "Balanced",
        },
        sectors: sectorBreakdown,
        laborMarket: {
          totalWorkforce: Math.round(
            ((country.currentPopulation || 0) * (country.laborForceParticipationRate || 65)) / 100
          ),
          laborForceParticipationRate: country.laborForceParticipationRate || 65,
          unemploymentRate: country.unemploymentRate || 5,
          youthUnemploymentRate: country.laborMarket?.youthUnemploymentRate || 10,
          femaleParticipationRate: country.laborMarket?.femaleParticipationRate || 60,
        },
        demographics: {
          totalPopulation: country.currentPopulation || 0,
          populationGrowthRate: country.populationGrowthRate || 0,
          urbanRuralSplit: {
            urban: country.urbanPopulationPercent || 50,
            rural: 100 - (country.urbanPopulationPercent || 50),
          },
          lifeExpectancy: country.lifeExpectancy || 75,
          literacyRate: country.literacyRate || 90,
        },
        selectedAtomicComponents: [], // Will be populated from government components
        lastUpdated: country.updatedAt,
        version: "1.0.0",
      };
    }),
});

export { economicsConfigRouter };
