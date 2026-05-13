import { z } from "zod";
import { publicProcedure, rateLimitedPublicProcedure, cachedStaticProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import { IxStatsCalculator } from "~/lib/calculations";
import { getEconomicTierFromGdpPerCapita } from "~/types/ixstats";
import { 
  safelyIncludeRelations, 
  prepareBaseCountryData, 
  getGrowthRates,
  stddev
} from "./utils";

export const economyProcedures = {
  getByIdWithEconomicData: rateLimitedPublicProcedure
    .input(
      z.object({
        id: z.string(),
        timestamp: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;
      const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

      const availableRelations = await safelyIncludeRelations(ctx.db);

      const includeObject: any = {
        storytellerEffects: {
          where: { isActive: true },
          orderBy: { ixTimeTimestamp: "desc" },
        },
        users: {
          select: {
            clerkUserId: true,
          },
          take: 1,
        },
      };

      if (availableRelations.economicProfile) includeObject.economicProfile = true;
      if (availableRelations.laborMarket) includeObject.laborMarket = true;
      if (availableRelations.fiscalSystem) includeObject.fiscalSystem = true;
      if (availableRelations.incomeDistribution) includeObject.incomeDistribution = true;
      if (availableRelations.governmentBudget) includeObject.governmentBudget = true;
      if (availableRelations.demographics) includeObject.demographics = true;
      if (availableRelations.nationalIdentity) includeObject.nationalIdentity = true;

      let country;
      try {
        const slugLower = input.id.toLowerCase();
        country = await ctx.db.country.findFirst({
          where: {
            OR: [{ id: input.id }, { slug: slugLower }, { name: input.id }],
          },
          include: includeObject,
        });
      } catch (dbError) {
        const slugLower = input.id.toLowerCase();
        country = await ctx.db.country.findFirst({
          where: {
            OR: [{ id: input.id }, { slug: slugLower }, { name: input.id }],
          },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });
      }

      if (!country) {
        throw new Error(`Country with identifier ${input.id} not found`);
      }

      const econCfg = await getEconomicConfigFromDB(ctx.db);
      const baselineDate = country.baselineDate ? country.baselineDate.getTime() : Date.now();

      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);

      const baselineStats = calc.initializeCountryStats(base);

      const effects = (country.storytellerEffects as any[]).map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const result = calc.calculateTimeProgression(baselineStats, targetTime, effects);
      const projections = [];
      for (let i = 1; i <= 5; i++) {
        const futureTime = targetTime + i * ONE_YEAR_MS;
        const proj = calc.calculateTimeProgression(baselineStats, futureTime, effects);
        projections.push({
          yearOffset: i,
          ixTime: futureTime,
          stats: proj.newStats,
        });
      }
      
      let historical = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: country.id,
          ixTimeTimestamp: {
            gte: new Date(targetTime - FIVE_YEARS_MS),
            lte: new Date(targetTime),
          },
        },
        orderBy: { ixTimeTimestamp: "asc" },
        take: 1000,
      });

      if (!historical || historical.length < 5) {
        historical = [];
        for (let i = 5; i >= 1; i--) {
          const pastTime = targetTime - i * ONE_YEAR_MS;
          const hist = calc.calculateTimeProgression(baselineStats, pastTime, effects);
          historical.push({
            id: "",
            createdAt: new Date(pastTime),
            countryId: country.id,
            ixTimeTimestamp: new Date(pastTime),
            population: hist.newStats.currentPopulation,
            gdpPerCapita: hist.newStats.currentGdpPerCapita,
            totalGdp: hist.newStats.currentTotalGdp,
            populationGrowthRate: hist.newStats.populationGrowthRate,
            gdpGrowthRate: hist.newStats.adjustedGdpGrowth,
            landArea: typeof hist.newStats.landArea === "number" ? hist.newStats.landArea : null,
            populationDensity: typeof hist.newStats.populationDensity === "number" ? hist.newStats.populationDensity : null,
            gdpDensity: typeof hist.newStats.gdpDensity === "number" ? hist.newStats.gdpDensity : null,
          } as any);
        }
      }

      const popGrowthRates = getGrowthRates(historical, "population");
      const gdpGrowthRates = getGrowthRates(historical, "gdpPerCapita");
      const avgPopGrowth = popGrowthRates.length
        ? popGrowthRates.reduce((a: number, b: number) => a + b, 0) / popGrowthRates.length
        : 0;
      const avgGdpGrowth = gdpGrowthRates.length
        ? gdpGrowthRates.reduce((a: number, b: number) => a + b, 0) / gdpGrowthRates.length
        : 0;
      const popVolatility = stddev(popGrowthRates);
      const gdpVolatility = stddev(gdpGrowthRates);
      const riskFlags = [];
      if (avgPopGrowth < 0) riskFlags.push("negative_population_growth");
      if (avgGdpGrowth < 0) riskFlags.push("negative_gdp_per_capita_growth");
      if (popVolatility > 0.05) riskFlags.push("high_population_volatility");
      if (gdpVolatility > 0.05) riskFlags.push("high_gdp_per_capita_volatility");
      
      let tierChangeProjection = null;
      const currentGDPPC = result.newStats.currentGdpPerCapita;
      const projectionsGDPPC = projections.map((p) => p.stats.currentGdpPerCapita);
      const tierThresholds = Object.values(econCfg.economicTierThresholds)
        .filter((v): v is number => typeof v === "number")
        .sort((a, b) => a - b);
      let nextTier = null;
      for (let i = 0; i < tierThresholds.length; i++) {
        if (tierThresholds[i]! > currentGDPPC) {
          nextTier = tierThresholds[i]!;
          break;
        }
      }
      if (nextTier) {
        for (let i = 0; i < projectionsGDPPC.length; i++) {
          if (projectionsGDPPC[i]! >= nextTier) {
            tierChangeProjection = {
              year: new Date().getFullYear() + i + 1,
              newTier: getEconomicTierFromGdpPerCapita(projectionsGDPPC[i]!),
            };
            break;
          }
        }
      }
      const vulnerabilities = [];
      if (avgPopGrowth < 0.002) vulnerabilities.push("low_population_growth");
      if (avgGdpGrowth < 0.01) vulnerabilities.push("low_gdp_per_capita_growth");

      const response = {
        ...country,
        unemploymentRate: country.unemploymentRate ?? undefined,
        totalWorkforce: country.totalWorkforce ?? undefined,
        averageWorkweekHours: country.averageWorkweekHours ?? undefined,
        minimumWage: country.minimumWage ?? undefined,
        averageAnnualIncome: country.averageAnnualIncome ?? undefined,
        taxRevenueGDPPercent: country.taxRevenueGDPPercent ?? undefined,
        taxRevenuePerCapita: country.taxRevenuePerCapita ?? undefined,
        governmentRevenueTotal: country.governmentRevenueTotal ?? undefined,
        governmentBudgetGDPPercent: country.governmentBudgetGDPPercent ?? undefined,
        budgetDeficitSurplus: country.budgetDeficitSurplus ?? undefined,
        internalDebtGDPPercent: country.internalDebtGDPPercent ?? undefined,
        externalDebtGDPPercent: country.externalDebtGDPPercent ?? undefined,
        totalDebtGDPRatio: country.totalDebtGDPRatio ?? undefined,
        debtPerCapita: country.debtPerCapita ?? undefined,
        interestRates: country.interestRates ?? undefined,
        debtServiceCosts: country.debtServiceCosts ?? undefined,
        povertyRate: country.povertyRate ?? undefined,
        incomeInequalityGini: country.incomeInequalityGini ?? undefined,
        socialMobilityIndex: country.socialMobilityIndex ?? undefined,
        totalGovernmentSpending: country.totalGovernmentSpending ?? undefined,
        spendingGDPPercent: country.spendingGDPPercent ?? undefined,
        spendingPerCapita: country.spendingPerCapita ?? undefined,
        lifeExpectancy: country.lifeExpectancy ?? undefined,
        literacyRate: country.literacyRate ?? undefined,
        urbanPopulationPercent: country.urbanPopulationPercent ?? undefined,
        ruralPopulationPercent: country.ruralPopulationPercent ?? undefined,
        calculatedStats: {
          gdpGrowth: result.newStats.adjustedGdpGrowth || 0,
          populationGrowth: result.newStats.populationGrowthRate || 0,
          inflation: 0.02,
        },
        projections: projections.map((p) => ({
          year: new Date(p.ixTime).getFullYear(),
          gdp: p.stats.currentTotalGdp,
          population: p.stats.currentPopulation,
        })),
        historical: historical.map((h: any) => ({
          year: new Date(h.ixTimeTimestamp).getFullYear(),
          gdp: h.totalGdp,
          population: h.population,
        })),
        storytellerEffects: (country.storytellerEffects as any[]).map((dm: any) => ({
          ...dm,
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime(),
        })),
        analytics: {
          growthTrends: {
            avgPopGrowth,
            avgGdpGrowth,
          },
          volatility: {
            popVolatility,
            gdpVolatility,
          },
          riskFlags,
          tierChangeProjection: tierChangeProjection || {
            year: new Date().getFullYear(),
            newTier: country.economicTier,
          },
          vulnerabilities,
        },
        lastCalculated:
          country.lastCalculated instanceof Date
            ? country.lastCalculated.getTime()
            : Date.now(),
      };

      const ownerClerkUserId = (country as any).users?.[0]?.clerkUserId ?? null;

      return {
        ...response,
        ownerClerkUserId,
      } as any;
    }),

  getByIdAtTime: publicProcedure
    .input(z.object({ id: z.string(), timestamp: z.number() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: { storytellerEffects: { where: { isActive: true } } },
      });

      if (!country) throw new Error("Country not found");

      const econCfg = await getEconomicConfigFromDB(ctx.db);
      const baselineDate = country.baselineDate ? country.baselineDate.getTime() : Date.now();
      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);
      const baselineStats = calc.initializeCountryStats(base);

      const effects = (country.storytellerEffects as any[]).map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      return calc.calculateTimeProgression(baselineStats, input.timestamp, effects);
    }),

  getGlobalStats: cachedStaticProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany({
      where: { isDemo: false },
      select: {
        currentPopulation: true,
        currentTotalGdp: true,
        landArea: true,
      },
    });

    const totalPop = countries.reduce((acc, c) => acc + (c.currentPopulation || 0), 0);
    const totalGdp = countries.reduce((acc, c) => acc + (c.currentTotalGdp || 0), 0);
    const totalArea = countries.reduce((acc, c) => acc + (c.landArea || 0), 0);

    return {
      totalPopulation: totalPop,
      totalGdp: totalGdp,
      totalLandArea: totalArea,
      avgGdpPerCapita: totalPop > 0 ? totalGdp / totalPop : 0,
      count: countries.length,
    };
  }),

  // Get trade data for a country
  getTradeData: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
      });

      if (!country) {
        throw new Error("Country not found");
      }

      // Calculate trade data based on country economic indicators
      const gdpBase = country.currentTotalGdp || 1000000000;
      const tradeIntensity = ((country as any).tradeRelationshipStrength || 25) / 100;

      const totalVolume = gdpBase * 0.6 * tradeIntensity; // Trade typically 60% of GDP * relationship strength
      const exports = totalVolume * 0.52; // Slightly export-oriented
      const imports = totalVolume * 0.48;
      const tradeBalance = exports - imports;

      return {
        totalVolume,
        exports,
        imports,
        tradeBalance,
        topPartners: [
          { country: "Major Trade Partner", volume: totalVolume * 0.25 },
          { country: "Regional Partner", volume: totalVolume * 0.18 },
          { country: "Economic Ally", volume: totalVolume * 0.12 },
        ],
      };
    }),
};

