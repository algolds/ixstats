// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

type SectorRow = Record<string, any>;

function parseSectorBreakdown(json: string | null | undefined): SectorRow[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is SectorRow => x !== null && typeof x === "object")
      : [];
  } catch (e) {
    console.error("[Economics Builder] Failed to parse sectorBreakdown:", e);
    return [];
  }
}

const sectorView = (s: SectorRow) => ({
  id: s.name.toLowerCase().replace(/\s+/g, "_"),
  name: s.name,
  category: s.category || "Tertiary",
  gdpContribution: s.gdp || 0,
  employmentShare: s.employment || 0,
  productivity: s.productivity || 75,
  growthRate: s.growthRate || 2.0,
  exports: 15,
  imports: 18,
  technologyLevel: "Modern" as const,
  automation: 20,
  regulation: "Moderate" as const,
  subsidy: 5,
  innovation: 50,
  sustainability: 70,
  competitiveness: 60,
});

/** Labour-market figures with the builder's defaults for anything not recorded yet. */
function laborMarketView(
  country: {
    laborForceParticipationRate: number | null;
    unemploymentRate: number | null;
    laborMarket: {
      youthUnemploymentRate: number | null;
      femaleParticipationRate: number | null;
    } | null;
  },
  totalPopulation: number
) {
  const participation = country.laborForceParticipationRate || 65;
  const unemployment = country.unemploymentRate || 5;
  return {
    totalWorkforce: Math.round((totalPopulation * participation) / 100),
    laborForceParticipationRate: participation,
    employmentRate: 100 - unemployment,
    unemploymentRate: unemployment,
    underemploymentRate: unemployment * 0.6,
    youthUnemploymentRate: country.laborMarket?.youthUnemploymentRate || 10,
    seniorEmploymentRate: 55,
    femaleParticipationRate: country.laborMarket?.femaleParticipationRate || 60,
    maleParticipationRate: participation * 1.15,
    averageWorkweekHours: 38.5,
    minimumWageHourly: 12.5,
    livingWageHourly: 18.75,
    unionizationRate: 12.5,
    collectiveBargainingCoverage: 18.0,
    workplaceSafetyIndex: 72,
    laborRightsScore: 68,
  };
}

const economicsBuilderRouter = createTRPCRouter({
  // Get economy builder state with all related data
  getEconomyBuilderState: publicProcedure
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
          demographics: true,
          economicModel: true,
          nationalIdentity: true,
          economicComponents: true,
        },
      });

      if (!country) {
        return null;
      }

      // Fallback values if current stats are empty/0
      const totalPopulation = country.currentPopulation || country.baselinePopulation || 10000000;
      const totalGDP =
        country.currentTotalGdp ||
        country.baselinePopulation * country.baselineGdpPerCapita ||
        250000000000;

      // Transform database data back to economy builder format
      const sectorBreakdown = parseSectorBreakdown(country.economicProfile?.sectorBreakdown);
      const sectorNames = (category: string) =>
        sectorBreakdown.filter((s) => s.category === category).map((s) => s.name);
      const urban = country.urbanPopulationPercent || 50;

      return {
        structure: {
          economicModel: "Mixed Economy",
          primarySectors: sectorNames("Primary"),
          secondarySectors: sectorNames("Secondary"),
          tertiarySectors: sectorNames("Tertiary"),
          totalGDP,
          gdpCurrency: country.nationalIdentity?.currency || "USD",
          economicTier: country.economicTier || "Developing",
          growthStrategy: "Balanced",
        },
        sectors: sectorBreakdown.map(sectorView),
        laborMarket: laborMarketView(country, totalPopulation),
        demographics: {
          totalPopulation,
          populationGrowthRate: country.populationGrowthRate || 0,
          urbanRuralSplit: { urban, rural: 100 - urban },
          lifeExpectancy: country.lifeExpectancy || 75,
          literacyRate: country.literacyRate || 90,
          netMigrationRate: 2.5,
          infantMortalityRate: 5,
          healthExpenditureGDP: 8.5,
        },
        selectedAtomicComponents: country.economicComponents
          ? country.economicComponents.map((c) => c.componentType as any)
          : [],
        lastUpdated: country.updatedAt,
        version: "1.0.0",
      };
    }),

  // Auto-save economy builder changes
  autoSaveEconomyBuilder: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        changes: z.record(
          z.string(),
          z.union([z.string(), z.number(), z.boolean(), z.null(), z.date()])
        ), // Economic field changes
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, changes } = input;

      await assertCountryWriteAccess(ctx, countryId);

      try {
        // Update country with changes
        const _updated = await ctx.db.country.update({
          where: { id: countryId },
          data: {
            ...changes,
            updatedAt: new Date(),
          },
        });

        // Log autosave to audit trail
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
            action: "autosave:economy",
            target: countryId,
            details: JSON.stringify({
              fields: Object.keys(changes),
              timestamp: new Date().toISOString(),
            }),
            success: true,
          },
        });

        return {
          success: true,
          countryId,
          message: "Auto-save completed",
          timestamp: new Date(),
        };
      } catch (error) {
        // Log autosave failure to audit trail
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
            action: "autosave:economy",
            target: countryId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });

        throw error;
      }
    }),
});

export { economicsBuilderRouter };
