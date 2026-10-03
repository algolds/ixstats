import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { ECONOMY_INCLUDE, parseSectorBreakdown } from "./_shared";

const economicsConfigRouter = createTRPCRouter({
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
        include: ECONOMY_INCLUDE,
      });

      if (!country) {
        return null;
      }

      // Transform database data back to builder configuration format
      const sectorBreakdown = parseSectorBreakdown(
        country.economicProfile?.sectorBreakdown,
        "Economics Config"
      );

      const urban = country.urbanPopulationPercent || 50;

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
          urbanRuralSplit: { urban, rural: 100 - urban },
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
