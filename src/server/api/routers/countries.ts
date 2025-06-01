// src/server/api/routers/countries.ts
// FIXED: Graceful handling of missing relations and proper error handling

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { IxStatsCalculator } from "~/lib/calculations";
import type { EconomicConfig, BaseCountryData, CountryStats } from "~/types/ixstats";

// Economic configuration
const getEconomicConfig = (): EconomicConfig => ({
  globalGrowthFactor: 1.0321,
  baseInflationRate: 0.02,
  economicTierThresholds: {
    impoverished: 0,
    developing: 10000,
    developed: 25000,
    healthy: 35000,
    strong: 45000,
    veryStrong: 55000,
    extravagant: 65000,
  },
  populationTierThresholds: {
    tier1: 0,
    tier2: 10_000_000,
    tier3: 30_000_000,
    tier4: 50_000_000,
    tier5: 80_000_000,
    tier6: 120_000_000,
    tier7: 350_000_000,
    tierX: 500_000_000,
  },
  tierGrowthModifiers: {
    "Impoverished": 1.0,
    "Developing": 1.0,
    "Developed": 1.0,
    "Healthy": 1.0,
    "Strong": 1.0,
    "Very Strong": 1.0,
    "Extravagant": 1.0,
  },
  calculationIntervalMs: 60_000,
  ixTimeUpdateFrequency: 30_000,
});

// Validation functions
const validateGrowthRate = (value: number | null | undefined): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return 0;
  return Math.min(Math.max(numValue, -0.5), 0.5);
};

const validateNumber = (value: number | null | undefined, max: number = 1e18, min: number = 0): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return min > 0 ? min : 0;
  return Math.min(Math.max(numValue, min), max);
};

const prepareBaseCountryData = (country: any): BaseCountryData => ({
  country: country.name,
  continent: country.continent,
  region: country.region,
  governmentType: country.governmentType,
  religion: country.religion,
  leader: country.leader,
  population: country.baselinePopulation,
  gdpPerCapita: country.baselineGdpPerCapita,
  landArea: country.landArea,
  areaSqMi: country.areaSqMi,
  maxGdpGrowthRate: validateGrowthRate(country.maxGdpGrowthRate),
  adjustedGdpGrowth: validateGrowthRate(country.adjustedGdpGrowth),
  populationGrowthRate: validateGrowthRate(country.populationGrowthRate),
  projected2040Population: country.projected2040Population || 0,
  projected2040Gdp: country.projected2040Gdp || 0,
  projected2040GdpPerCapita: country.projected2040GdpPerCapita || 0,
  actualGdpGrowth: validateGrowthRate(country.actualGdpGrowth),
  localGrowthFactor: country.localGrowthFactor || 1.0,
});

// FIXED: Helper function to safely include relations that may not exist
const safelyIncludeRelations = async (db: any) => {
  const availableRelations: any = {};
  
  try {
    // Test if each relation exists in the database
    const testQueries = [
      { name: 'economicProfile', test: () => db.economicProfile.findFirst() },
      { name: 'laborMarket', test: () => db.laborMarket.findFirst() },
      { name: 'fiscalSystem', test: () => db.fiscalSystem.findFirst() },
      { name: 'incomeDistribution', test: () => db.incomeDistribution.findFirst() },
      { name: 'governmentBudget', test: () => db.governmentBudget.findFirst() },
      { name: 'demographics', test: () => db.demographics.findFirst() },
    ];

    for (const { name, test } of testQueries) {
      try {
        await test();
        availableRelations[name] = true;
      } catch (error) {
        console.warn(`[Countries API] Relation '${name}' not available in database, skipping`);
        availableRelations[name] = false;
      }
    }
  } catch (error) {
    console.warn('[Countries API] Could not test relations, proceeding without optional relations');
  }

  return availableRelations;
};

// FIXED: Economic data schema with all optional fields
const economicDataSchema = z.object({
  // Core Economic Indicators
  nominalGDP: z.number().optional(),
  realGDPGrowthRate: z.number().optional(),
  inflationRate: z.number().optional(),
  currencyExchangeRate: z.number().optional(),

  // Labor & Employment
  laborForceParticipationRate: z.number().optional(),
  employmentRate: z.number().optional(),
  unemploymentRate: z.number().optional(),
  totalWorkforce: z.number().optional(),
  averageWorkweekHours: z.number().optional(),
  minimumWage: z.number().optional(),
  averageAnnualIncome: z.number().optional(),

  // Fiscal System - Basic
  taxRevenueGDPPercent: z.number().optional(),
  governmentRevenueTotal: z.number().optional(),
  taxRevenuePerCapita: z.number().optional(),
  governmentBudgetGDPPercent: z.number().optional(),
  budgetDeficitSurplus: z.number().optional(),
  internalDebtGDPPercent: z.number().optional(),
  externalDebtGDPPercent: z.number().optional(),
  totalDebtGDPRatio: z.number().optional(),
  debtPerCapita: z.number().optional(),
  interestRates: z.number().optional(),
  debtServiceCosts: z.number().optional(),

  // Income & Wealth
  povertyRate: z.number().optional(),
  incomeInequalityGini: z.number().optional(),
  socialMobilityIndex: z.number().optional(),

  // Government Spending
  totalGovernmentSpending: z.number().optional(),
  spendingGDPPercent: z.number().optional(),
  spendingPerCapita: z.number().optional(),

  // Demographics - Basic
  lifeExpectancy: z.number().optional(),
  urbanPopulationPercent: z.number().optional(),
  ruralPopulationPercent: z.number().optional(),
  literacyRate: z.number().optional(),
});

export const countriesRouter = createTRPCRouter({
  // Get all countries with basic info + total count
  getAll: publicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
        search: z.string().optional(),
        continent: z.string().optional(),
        economicTier: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.search) {
        where.name = { contains: input.search, mode: "insensitive" };
      }
      if (input?.continent) {
        where.continent = input.continent;
      }
      if (input?.economicTier) {
        where.economicTier = input.economicTier;
      }

      const [countries, total] = await Promise.all([
        ctx.db.country.findMany({
          where,
          take: input?.limit,
          skip: input?.offset,
          orderBy: { name: "asc" },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        }),
        ctx.db.country.count({ where }),
      ]);

      return { countries, total };
    }),

  // FIXED: Get country by ID with enhanced economic data and safe relation handling
  getByIdWithEconomicData: publicProcedure
    .input(z.object({
      id: z.string(),
      timestamp: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      
      // FIXED: Check what relations are available
      const availableRelations = await safelyIncludeRelations(ctx.db);
      
      // Build include object based on available relations
      const includeObject: any = {
        dmInputs: {
          where: { isActive: true },
          orderBy: { ixTimeTimestamp: "desc" },
        },
      };

      // Only include relations that exist in the database
      if (availableRelations.economicProfile) includeObject.economicProfile = true;
      if (availableRelations.laborMarket) includeObject.laborMarket = true;
      if (availableRelations.fiscalSystem) includeObject.fiscalSystem = true;
      if (availableRelations.incomeDistribution) includeObject.incomeDistribution = true;
      if (availableRelations.governmentBudget) includeObject.governmentBudget = true;
      if (availableRelations.demographics) includeObject.demographics = true;

      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: includeObject,
      });

      if (!country) {
        throw new Error(`Country with ID ${input.id} not found`);
      }

      // Calculate current stats
      const econCfg = getEconomicConfig();
      const baselineDate = country.baselineDate.getTime();
      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);
      const baselineStats = calc.initializeCountryStats(base);

      const dmInputs = country.dmInputs.map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const result = calc.calculateTimeProgression(
        baselineStats,
        targetTime,
        dmInputs
      );

      // FIXED: Build response with available data and fallbacks for missing fields
      const response: any = {
        ...country,
        calculatedStats: result.newStats,
        dmInputs: country.dmInputs.map((dm: any) => ({
          ...dm,
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime()
        })),
        
        // FIXED: Provide fallback values for expected economic fields
        nominalGDP: country.nominalGDP || (country.baselinePopulation * country.baselineGdpPerCapita),
        realGDPGrowthRate: country.realGDPGrowthRate || country.adjustedGdpGrowth || 0.03,
        inflationRate: country.inflationRate || 0.02,
        currencyExchangeRate: country.currencyExchangeRate || 1.0,
        
        // Labor & Employment fallbacks
        laborForceParticipationRate: country.laborForceParticipationRate || 65,
        employmentRate: country.employmentRate || 95,
        unemploymentRate: country.unemploymentRate || 5,
        totalWorkforce: country.totalWorkforce || Math.round(country.baselinePopulation * 0.65),
        averageWorkweekHours: country.averageWorkweekHours || 40,
        minimumWage: country.minimumWage || 12,
        averageAnnualIncome: country.averageAnnualIncome || 35000,
        
        // Include available relations or null
        economicProfile: (country as any).economicProfile || null,
        laborMarket: (country as any).laborMarket || null,
        fiscalSystem: (country as any).fiscalSystem || null,
        incomeDistribution: (country as any).incomeDistribution || null,
        governmentBudget: (country as any).governmentBudget || null,
        demographics: (country as any).demographics || null,
      };

      return response;
    }),

  // FIXED: Update country economic data with graceful handling
  updateEconomicData: publicProcedure
    .input(z.object({
      countryId: z.string(),
      economicData: economicDataSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, economicData } = input;

      try {
        // Update basic economic fields on country
        const basicFields = {
          nominalGDP: economicData.nominalGDP,
          realGDPGrowthRate: economicData.realGDPGrowthRate,
          inflationRate: economicData.inflationRate,
          currencyExchangeRate: economicData.currencyExchangeRate,
          laborForceParticipationRate: economicData.laborForceParticipationRate,
          employmentRate: economicData.employmentRate,
          unemploymentRate: economicData.unemploymentRate,
          totalWorkforce: economicData.totalWorkforce,
          averageWorkweekHours: economicData.averageWorkweekHours,
          minimumWage: economicData.minimumWage,
          averageAnnualIncome: economicData.averageAnnualIncome,
          taxRevenueGDPPercent: economicData.taxRevenueGDPPercent,
          governmentRevenueTotal: economicData.governmentRevenueTotal,
          taxRevenuePerCapita: economicData.taxRevenuePerCapita,
          governmentBudgetGDPPercent: economicData.governmentBudgetGDPPercent,
          budgetDeficitSurplus: economicData.budgetDeficitSurplus,
          internalDebtGDPPercent: economicData.internalDebtGDPPercent,
          externalDebtGDPPercent: economicData.externalDebtGDPPercent,
          totalDebtGDPRatio: economicData.totalDebtGDPRatio,
          debtPerCapita: economicData.debtPerCapita,
          interestRates: economicData.interestRates,
          debtServiceCosts: economicData.debtServiceCosts,
          povertyRate: economicData.povertyRate,
          incomeInequalityGini: economicData.incomeInequalityGini,
          socialMobilityIndex: economicData.socialMobilityIndex,
          totalGovernmentSpending: economicData.totalGovernmentSpending,
          spendingGDPPercent: economicData.spendingGDPPercent,
          spendingPerCapita: economicData.spendingPerCapita,
          lifeExpectancy: economicData.lifeExpectancy,
          urbanPopulationPercent: economicData.urbanPopulationPercent,
          ruralPopulationPercent: economicData.ruralPopulationPercent,
          literacyRate: economicData.literacyRate,
        };

        // Filter out undefined values
        const filteredBasicFields = Object.fromEntries(
          Object.entries(basicFields).filter(([_, value]) => value !== undefined)
        );

        // Update country with basic fields
        const updatedCountry = await ctx.db.country.update({
          where: { id: countryId },
          data: filteredBasicFields,
        });

        return { success: true, message: "Economic data updated successfully" };
      } catch (error) {
        console.error('[Countries API] Failed to update economic data:', error);
        throw new Error(`Failed to update economic data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // FIXED: Get country by ID at time with proper validation
  getByIdAtTime: publicProcedure
    .input(z.object({
      id: z.string(),
      timestamp: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const countryFromDb = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });
      
      if (!countryFromDb) {
        throw new Error(`Country with ID ${input.id} not found`);
      }

      const currentTime = IxTime.getCurrentIxTime();
      const timeDiff = Math.abs(targetTime - currentTime);
      const isCurrentTime = timeDiff < (5 * 60 * 1000);

      let calculatedStats: CountryStats;

      if (isCurrentTime) {
        calculatedStats = {
          country: countryFromDb.name,
          continent: countryFromDb.continent,
          region: countryFromDb.region,
          governmentType: countryFromDb.governmentType,
          religion: countryFromDb.religion,
          leader: countryFromDb.leader,
          population: countryFromDb.baselinePopulation,
          gdpPerCapita: countryFromDb.baselineGdpPerCapita,
          landArea: countryFromDb.landArea,
          areaSqMi: countryFromDb.areaSqMi,
          maxGdpGrowthRate: validateGrowthRate(countryFromDb.maxGdpGrowthRate),
          adjustedGdpGrowth: validateGrowthRate(countryFromDb.adjustedGdpGrowth),
          populationGrowthRate: validateGrowthRate(countryFromDb.populationGrowthRate),
          actualGdpGrowth: validateGrowthRate((countryFromDb as any).actualGdpGrowth),
          projected2040Population: countryFromDb.projected2040Population || 0,
          projected2040Gdp: countryFromDb.projected2040Gdp || 0,
          projected2040GdpPerCapita: countryFromDb.projected2040GdpPerCapita || 0,
          localGrowthFactor: countryFromDb.localGrowthFactor,
          id: countryFromDb.id,
          name: countryFromDb.name,
          totalGdp: countryFromDb.currentTotalGdp,
          currentPopulation: validateNumber(countryFromDb.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(countryFromDb.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(countryFromDb.currentTotalGdp, 1e18, 1),
          lastCalculated: countryFromDb.lastCalculated.getTime(),
          baselineDate: countryFromDb.baselineDate.getTime(),
          economicTier: countryFromDb.economicTier as any,
          populationTier: countryFromDb.populationTier as any,
          populationDensity: countryFromDb.populationDensity,
          gdpDensity: countryFromDb.gdpDensity,
          globalGrowthFactor: getEconomicConfig().globalGrowthFactor,
        };
      } else {
        const econCfg = getEconomicConfig();
        const baselineDate = countryFromDb.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(countryFromDb);
        const initialStats = calc.initializeCountryStats(base);

        const dmInputs = countryFromDb.dmInputs.map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));

        const result = calc.calculateTimeProgression(
          initialStats,
          targetTime,
          dmInputs
        );
        
        calculatedStats = {
          ...result.newStats,
          currentPopulation: validateNumber(result.newStats.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(result.newStats.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(result.newStats.currentTotalGdp, 1e18, 1),
          populationDensity: result.newStats.populationDensity ? validateNumber(result.newStats.populationDensity, 1e7) : null,
          gdpDensity: result.newStats.gdpDensity ? validateNumber(result.newStats.gdpDensity, 1e12) : null,
          populationGrowthRate: validateGrowthRate(result.newStats.populationGrowthRate),
          adjustedGdpGrowth: validateGrowthRate(result.newStats.adjustedGdpGrowth),
          actualGdpGrowth: validateGrowthRate(result.newStats.actualGdpGrowth),
          country: result.newStats.country || base.country,
          name: result.newStats.name || base.country,
          id: countryFromDb.id,
          continent: result.newStats.continent || base.continent,
          region: result.newStats.region || base.region,
          governmentType: result.newStats.governmentType || base.governmentType,
          religion: result.newStats.religion || base.religion,
          leader: result.newStats.leader || base.leader,
          population: result.newStats.population,
          gdpPerCapita: result.newStats.gdpPerCapita,
          landArea: result.newStats.landArea || base.landArea,
          areaSqMi: result.newStats.areaSqMi || base.areaSqMi,
          maxGdpGrowthRate: validateGrowthRate(result.newStats.maxGdpGrowthRate),
          projected2040Population: result.newStats.projected2040Population || 0,
          projected2040Gdp: result.newStats.projected2040Gdp || 0,
          projected2040GdpPerCapita: result.newStats.projected2040GdpPerCapita || 0,
          localGrowthFactor: result.newStats.localGrowthFactor,
          totalGdp: result.newStats.totalGdp,
          lastCalculated: result.newStats.lastCalculated,
          baselineDate: result.newStats.baselineDate,
          economicTier: result.newStats.economicTier,
          populationTier: result.newStats.populationTier,
          globalGrowthFactor: result.newStats.globalGrowthFactor,
        };
      }

      return {
        id: countryFromDb.id,
        name: countryFromDb.name,
        continent: countryFromDb.continent,
        region: countryFromDb.region,
        governmentType: countryFromDb.governmentType,
        religion: countryFromDb.religion,
        leader: countryFromDb.leader,
        areaSqMi: countryFromDb.areaSqMi,
        landArea: countryFromDb.landArea,
        baselinePopulation: countryFromDb.baselinePopulation,
        baselineGdpPerCapita: countryFromDb.baselineGdpPerCapita,
        maxGdpGrowthRate: validateGrowthRate(countryFromDb.maxGdpGrowthRate),
        adjustedGdpGrowth: validateGrowthRate(countryFromDb.adjustedGdpGrowth),
        populationGrowthRate: validateGrowthRate(countryFromDb.populationGrowthRate),
        localGrowthFactor: countryFromDb.localGrowthFactor,
        projected2040Population: countryFromDb.projected2040Population || 0,
        projected2040Gdp: countryFromDb.projected2040Gdp || 0,
        projected2040GdpPerCapita: countryFromDb.projected2040GdpPerCapita || 0,
        createdAt: countryFromDb.createdAt,
        updatedAt: countryFromDb.updatedAt,
        baselineDate: countryFromDb.baselineDate,
        lastCalculated: countryFromDb.lastCalculated,
        calculatedStats,
        dmInputs: countryFromDb.dmInputs.map((dm: any) => ({
          ...dm,
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime()
        })),
      };
    }),

  // Rest of the endpoints remain the same but with FIXED error handling...
  getHistoricalAtTime: publicProcedure
    .input(z.object({
      id: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      limit: z.number().optional().default(500),
      interval: z.enum(["daily", "weekly", "monthly"]).optional().default("weekly"),
    }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: input.id,
          ixTimeTimestamp: {
            gte: new Date(input.startTime),
            lte: new Date(input.endTime),
          },
        },
        orderBy: { ixTimeTimestamp: "asc" },
        take: input.limit,
      });
      
      if (existing.length >= Math.min(input.limit, 50) || existing.length > 10) {
        return existing.map((p) => ({
          ...p,
          ixTimeTimestamp: p.ixTimeTimestamp.getTime(),
          population: validateNumber(p.population, 1e11),
          gdpPerCapita: validateNumber(p.gdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(p.totalGdp, 1e18, 1),
          populationGrowthRate: validateGrowthRate(p.populationGrowthRate),
          gdpGrowthRate: validateGrowthRate(p.gdpGrowthRate),
          landArea: p.landArea,
          populationDensity: p.populationDensity ? validateNumber(p.populationDensity, 1e7) : null,
          gdpDensity: p.gdpDensity ? validateNumber(p.gdpDensity, 1e12) : null,
        }));
      }

      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });
      
      if (!country) {
        throw new Error(`Country with ID ${input.id} not found`);
      }

      const intervalMs =
        input.interval === "daily"
          ? 24 * 60 * 60 * 1000
          : input.interval === "weekly"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

      const econCfg = getEconomicConfig();
      const baselineDate = country.baselineDate.getTime();
      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);
      const baselineStats = calc.initializeCountryStats(base);

      const dmInputs = country.dmInputs.map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const dataPoints = [];
      for (
        let t = input.startTime;
        t <= input.endTime && dataPoints.length < input.limit;
        t += intervalMs
      ) {
        const res = calc.calculateTimeProgression(baselineStats, t, dmInputs);
        dataPoints.push({
          ixTimeTimestamp: t,
          population: validateNumber(res.newStats.currentPopulation, 1e11),
          gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          landArea: res.newStats.landArea,
          populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
          gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
        });
      }
      return dataPoints;
    }),

  // Continue with other existing endpoints...
  getForecast: publicProcedure
    .input(z.object({
      id: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      points: z.number().optional().default(40),
    }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });
      
      if (!country) {
        throw new Error(`Country with ID ${input.id} not found`);
      }

      const totalDuration = input.endTime - input.startTime;
      if (totalDuration <= 0 || input.points <= 0) {
        return {
          countryId: input.id,
          countryName: country.name,
          startTime: input.startTime,
          endTime: input.endTime,
          dataPoints: [],
        };
      }
      
      const intervalMs = totalDuration / input.points;

      const econCfg = getEconomicConfig();
      const baselineDate = country.baselineDate.getTime();
      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);
      const baselineStats = calc.initializeCountryStats(base);

      const dmInputs = country.dmInputs.map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const dataPoints = [];
      for (let i = 0; i <= input.points; i++) {
        let forecastTime = input.startTime + (i * intervalMs);
        
        if (i === input.points) {
          forecastTime = Math.min(forecastTime, input.endTime);
        }
        if (forecastTime > input.endTime && i < input.points) break;

        const res = calc.calculateTimeProgression(
          baselineStats,
          forecastTime,
          dmInputs
        );
        
        dataPoints.push({
          ixTime: forecastTime,
          formattedTime: IxTime.formatIxTime(forecastTime),
          gameYear: IxTime.getCurrentGameYear(forecastTime),
          population: validateNumber(res.newStats.currentPopulation, 1e11),
          gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
          gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
          economicTier: res.newStats.economicTier,
          populationTier: res.newStats.populationTier,
        });
        
        if (forecastTime >= input.endTime) break;
      }
      
      return {
        countryId: input.id,
        countryName: country.name,
        startTime: input.startTime,
        endTime: input.endTime,
        dataPoints,
      };
    }),

  // Additional endpoints continued...
  getMultipleAtTime: publicProcedure
    .input(z.object({
      ids: z.array(z.string()),
      timestamp: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const countriesFromDb = await ctx.db.country.findMany({
        where: { id: { in: input.ids } },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });
      
      const econCfg = getEconomicConfig();
      const results = [];

      for (const country of countriesFromDb) {
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = country.dmInputs.map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        
        const res = calc.calculateTimeProgression(
          baselineStats,
          targetTime,
          dmInputs
        );
        
        const calculatedCountryStats: CountryStats = {
          ...res.newStats,
          id: country.id,
          name: res.newStats.name || base.country,
          currentPopulation: validateNumber(res.newStats.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          adjustedGdpGrowth: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          actualGdpGrowth: validateGrowthRate(res.newStats.actualGdpGrowth),
          country: res.newStats.country || base.country,
          continent: res.newStats.continent || base.continent,
          region: res.newStats.region || base.region,
          governmentType: res.newStats.governmentType || base.governmentType,
          religion: res.newStats.religion || base.religion,
          leader: res.newStats.leader || base.leader,
          population: res.newStats.population,
          gdpPerCapita: res.newStats.gdpPerCapita,
          landArea: res.newStats.landArea || base.landArea,
          areaSqMi: res.newStats.areaSqMi || base.areaSqMi,
          maxGdpGrowthRate: validateGrowthRate(res.newStats.maxGdpGrowthRate),
          projected2040Population: res.newStats.projected2040Population || 0,
          projected2040Gdp: res.newStats.projected2040Gdp || 0,
          projected2040GdpPerCapita: res.newStats.projected2040GdpPerCapita || 0,
          localGrowthFactor: res.newStats.localGrowthFactor,
          totalGdp: res.newStats.totalGdp,
          lastCalculated: res.newStats.lastCalculated,
          baselineDate: res.newStats.baselineDate,
          economicTier: res.newStats.economicTier,
          populationTier: res.newStats.populationTier,
          globalGrowthFactor: res.newStats.globalGrowthFactor,
        };

        results.push({
          id: country.id,
          name: country.name,
          continent: country.continent,
          region: country.region,
          calculatedStats: calculatedCountryStats,
          dmInputs: country.dmInputs.map((dm: any) => ({
            ...dm,
            ixTimeTimestamp: dm.ixTimeTimestamp.getTime()
          })),
        });
      }
      return results;
    }),

  getGlobalStats: publicProcedure
    .input(z.object({
      timestamp: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const targetTime = input?.timestamp ?? IxTime.getCurrentIxTime();
      const countries = await ctx.db.country.findMany({
        select: {
          id: true,
          name: true,
          currentPopulation: true,
          currentTotalGdp: true,
          economicTier: true,
          populationTier: true,
          landArea: true,
        },
      });

      let totalPopulation = 0;
      let totalGdp = 0;
      let totalLand = 0;
      const econCounts: Record<string, number> = {};
      const popCounts: Record<string, number> = {};

      for (const country of countries) {
        totalPopulation += validateNumber(country.currentPopulation || 0, 1e11);
        totalGdp += validateNumber(country.currentTotalGdp || 0, 1e18);
        if (country.landArea) totalLand += country.landArea;
        const econ = country.economicTier || 'Unknown';
        const pop = country.populationTier || 'Unknown';
        econCounts[econ] = (econCounts[econ] || 0) + 1;
        popCounts[pop] = (popCounts[pop] || 0) + 1;
      }

      const avgGdpPc = totalPopulation > 0 ? totalGdp / totalPopulation : 0;
      const avgPopD = totalLand > 0 ? totalPopulation / totalLand : 0;
      const avgGdpD = totalLand > 0 ? totalGdp / totalLand : 0;

      return {
        totalPopulation,
        totalGdp,
        averageGdpPerCapita: avgGdpPc,
        totalCountries: countries.length,
        economicTierDistribution: econCounts,
        populationTierDistribution: popCounts,
        averagePopulationDensity: avgPopD || null,
        averageGdpDensity: avgGdpD || null,
        globalGrowthRate: getEconomicConfig().globalGrowthFactor,
        ixTimeTimestamp: targetTime,
      };
    }),

  updateStats: publicProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const econCfg = getEconomicConfig();
      const now = IxTime.getCurrentIxTime();

      if (input.countryId) {
        const c = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" }
            }
          },
        });
        
        if (!c) throw new Error(`Country ${input.countryId} not found`);

        const calc = new IxStatsCalculator(econCfg, c.baselineDate.getTime());
        const base = prepareBaseCountryData(c);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = c.dmInputs.map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime()
        }));
        const res = calc.calculateTimeProgression(baselineStats, now, dmInputs);

        const updated = await ctx.db.country.update({
          where: { id: c.id },
          data: {
            currentPopulation: validateNumber(res.newStats.currentPopulation, 1e11),
            currentGdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
            currentTotalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
            economicTier: res.newStats.economicTier.toString(),
            populationTier: res.newStats.populationTier.toString(),
            populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
            gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
            adjustedGdpGrowth: validateGrowthRate(res.newStats.adjustedGdpGrowth),
            actualGdpGrowth: validateGrowthRate(res.newStats.actualGdpGrowth),
            populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
            lastCalculated: new Date(now),
          },
        });

        await ctx.db.historicalDataPoint.create({
          data: {
            countryId: c.id,
            ixTimeTimestamp: new Date(now),
            population: validateNumber(res.newStats.currentPopulation, 1e11),
            gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
            totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
            populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
            gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
            landArea: c.landArea,
            populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
            gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
          },
        });
        return updated;
      }

      // Bulk update logic for all countries
      const all = await ctx.db.country.findMany({
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" }
          }
        },
      });
      
      const start = Date.now();
      const results = [];
      const historicalPointsToCreate = [];

      for (const c of all) {
        const calc = new IxStatsCalculator(econCfg, c.baselineDate.getTime());
        const base = prepareBaseCountryData(c);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = c.dmInputs.map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime()
        }));
        const res = calc.calculateTimeProgression(baselineStats, now, dmInputs);
        
        const updateData = {
          currentPopulation: validateNumber(res.newStats.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          economicTier: res.newStats.economicTier.toString(),
          populationTier: res.newStats.populationTier.toString(),
          populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
          gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
          adjustedGdpGrowth: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          actualGdpGrowth: validateGrowthRate(res.newStats.actualGdpGrowth),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          lastCalculated: new Date(now),
        };
        
        const updated = await ctx.db.country.update({
          where: { id: c.id },
          data: updateData
        });
        results.push(updated);
        
        historicalPointsToCreate.push({
          countryId: c.id,
          ixTimeTimestamp: new Date(now),
          population: validateNumber(res.newStats.currentPopulation, 1e11),
          gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          landArea: c.landArea,
          populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
          gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
        });
      }

      if (historicalPointsToCreate.length > 0) {
        try {
          await ctx.db.calculationLog.create({
            data: {
              timestamp: new Date(),
              ixTimeTimestamp: new Date(now),
              countriesUpdated: results.length,
              executionTimeMs: Date.now() - start,
              globalGrowthFactor: econCfg.globalGrowthFactor,
              notes: "Bulk update triggered manually or by schedule",
            },
          });
        } catch (error) {
          console.warn("Failed to create calculation log:", error);
        }
      }
      
      return {
        count: results.length,
        message: `Updated ${results.length} countries`,
        executionTimeMs: Date.now() - start,
      };
    }),
});