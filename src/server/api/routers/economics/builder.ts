// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly
// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

const economicsBuilderRouter = createTRPCRouter({
  // ==================== ECONOMY BUILDER LIVE WIRING ====================
  // Real-time economy builder configuration management

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
          console.error("[Economics Builder] Failed to parse sectorBreakdown:", e);
        }
      }

      return {
        structure: {
          economicModel: "Mixed Economy",
          primarySectors: sectorBreakdown
            .filter((s: any) => s.category === "Primary")
            .map((s: any) => s.name),
          secondarySectors: sectorBreakdown
            .filter((s: any) => s.category === "Secondary")
            .map((s: any) => s.name),
          tertiarySectors: sectorBreakdown
            .filter((s: any) => s.category === "Tertiary")
            .map((s: any) => s.name),
          totalGDP,
          gdpCurrency: country.nationalIdentity?.currency || "USD",
          economicTier: country.economicTier || "Developing",
          growthStrategy: "Balanced",
        },
        sectors: sectorBreakdown.map((s: any) => ({
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
        })),
        laborMarket: {
          totalWorkforce: Math.round(
            (totalPopulation * (country.laborForceParticipationRate || 65)) / 100
          ),
          laborForceParticipationRate: country.laborForceParticipationRate || 65,
          employmentRate: 100 - (country.unemploymentRate || 5),
          unemploymentRate: country.unemploymentRate || 5,
          underemploymentRate: (country.unemploymentRate || 5) * 0.6,
          youthUnemploymentRate: country.laborMarket?.youthUnemploymentRate || 10,
          seniorEmploymentRate: 55,
          femaleParticipationRate: country.laborMarket?.femaleParticipationRate || 60,
          maleParticipationRate: (country.laborForceParticipationRate || 65) * 1.15,
          averageWorkweekHours: 38.5,
          minimumWageHourly: 12.5,
          livingWageHourly: 18.75,
          unionizationRate: 12.5,
          collectiveBargainingCoverage: 18.0,
          workplaceSafetyIndex: 72,
          laborRightsScore: 68,
        },
        demographics: {
          totalPopulation,
          populationGrowthRate: country.populationGrowthRate || 0,
          urbanRuralSplit: {
            urban: country.urbanPopulationPercent || 50,
            rural: 100 - (country.urbanPopulationPercent || 50),
          },
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
