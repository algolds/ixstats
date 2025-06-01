// src/server/api/routers/countries.ts
// FIXED: TypeScript errors, growth rate processing, and validation
// FIXED: Ensured nullable fields are handled with ?? null for Prisma createMany

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { IxStatsCalculator } from "~/lib/calculations";
import type { EconomicConfig, BaseCountryData, CountryStats } from "~/types/ixstats";

// FIXED: Updated economic configuration to match user specifications
const getEconomicConfig = (): EconomicConfig => ({
  globalGrowthFactor: 1.0321, // FIXED: 3.21% annual global growth
  baseInflationRate: 0.02,
  
  // FIXED: Economic tier thresholds per user specifications
  economicTierThresholds: {
    impoverished: 0,        // $0-$9,999
    developing: 10000,      // $10,000-$24,999  
    developed: 25000,       // $25,000-$34,999
    healthy: 35000,         // $35,000-$44,999
    strong: 45000,          // $45,000-$54,999
    veryStrong: 55000,      // $55,000-$64,999
    extravagant: 65000,     // $65,000+
  },
  
  populationTierThresholds: {
    tier1: 0,               // 0-9,999,999
    tier2: 10_000_000,      // 10,000,000-29,999,999
    tier3: 30_000_000,      // 30,000,000-49,999,999
    tier4: 50_000_000,      // 50,000,000-79,999,999
    tier5: 80_000_000,      // 80,000,000-119,999,999
    tier6: 120_000_000,     // 120,000,000-349,999,999
    tier7: 350_000_000,     // 350,000,000-499,999,999
    tierX: 500_000_000,     // 500,000,000+
  },
  
  // FIXED: Tier growth modifiers per specifications
  tierGrowthModifiers: {
    "Impoverished": 1.0,    // Base modifier
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

// FIXED: Enhanced validation functions
const validateGrowthRate = (value: number | null | undefined): number => {
  const numValue = Number(value); 
  if (!isFinite(numValue) || isNaN(numValue)) return 0;
  // Growth rates are in decimal form (0.005 for 0.5%)
  return Math.min(Math.max(numValue, -0.5), 0.5); // ±50% max
};

const validateNumber = (value: number | null | undefined, max: number = 1e18, min: number = 0): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return min > 0 ? min : 0; 
  return Math.min(Math.max(numValue, min), max);
};

// Helper to prepare country data for calculator
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
  // FIXED: Ensure growth rates are properly validated as decimals
  maxGdpGrowthRate: validateGrowthRate(country.maxGdpGrowthRate),
  adjustedGdpGrowth: validateGrowthRate(country.adjustedGdpGrowth),
  populationGrowthRate: validateGrowthRate(country.populationGrowthRate),
  projected2040Population: country.projected2040Population || 0,
  projected2040Gdp: country.projected2040Gdp || 0,
  projected2040GdpPerCapita: country.projected2040GdpPerCapita || 0,
  actualGdpGrowth: validateGrowthRate(country.actualGdpGrowth),
  localGrowthFactor: country.localGrowthFactor || 1.0,
});

export const countriesRouter = createTRPCRouter({
  // Get all countries with basic info + total count
  getAll: publicProcedure
    .input(
      z
        .object({
          limit: z.number().optional().default(100),
          offset: z.number().optional().default(0),
          search: z.string().optional(),
          continent: z.string().optional(),
          economicTier: z.string().optional(),
        })
        .optional()
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

  // FIXED: Get country by ID at a specific IxTime with proper data handling
  getByIdAtTime: publicProcedure
    .input(
      z.object({
        id: z.string(),
        timestamp: z.number().optional(),
      })
    )
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
        // Use current database values for current time
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
          actualGdpGrowth: validateGrowthRate(countryFromDb.actualGdpGrowth), 
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
        // Calculate for specific time
        const econCfg = getEconomicConfig();
        const baselineDate = countryFromDb.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(countryFromDb);
        const initialStats = calc.initializeCountryStats(base);

        const dmInputs = countryFromDb.dmInputs.map((i) => ({
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

      // Return structured object with static and calculated fields separated
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
        
        // Baseline fields from roster
        baselinePopulation: countryFromDb.baselinePopulation,
        baselineGdpPerCapita: countryFromDb.baselineGdpPerCapita,
        maxGdpGrowthRate: validateGrowthRate(countryFromDb.maxGdpGrowthRate),
        adjustedGdpGrowth: validateGrowthRate(countryFromDb.adjustedGdpGrowth),
        populationGrowthRate: validateGrowthRate(countryFromDb.populationGrowthRate),
        localGrowthFactor: countryFromDb.localGrowthFactor,
        
        // Projected fields  
        projected2040Population: countryFromDb.projected2040Population || 0,
        projected2040Gdp: countryFromDb.projected2040Gdp || 0,
        projected2040GdpPerCapita: countryFromDb.projected2040GdpPerCapita || 0,
        
        // Timestamps
        createdAt: countryFromDb.createdAt,
        updatedAt: countryFromDb.updatedAt,
        baselineDate: countryFromDb.baselineDate,
        lastCalculated: countryFromDb.lastCalculated,

        // All dynamic/calculated statistics
        calculatedStats, 
        dmInputs: countryFromDb.dmInputs.map(dm => ({
          ...dm, 
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime()
        })),
      };
    }),

  // FIXED: Get historical data points for a country with better data handling
  getHistoricalAtTime: publicProcedure
    .input(
      z.object({
        id: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        limit: z.number().optional().default(500),
        interval: z.enum(["daily", "weekly", "monthly"]).optional().default("weekly"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check for existing historical data first
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
      
      // FIXED: Return existing data if we have enough
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

      // Generate historical data if not enough exists
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

      const dmInputs = country.dmInputs.map((i) => ({
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

  // FIXED: Get forecast data with better validation
  getForecast: publicProcedure
    .input(
      z.object({
        id: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        points: z.number().optional().default(40), 
      })
    )
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

      const dmInputs = country.dmInputs.map((i) => ({
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

  // Compare multiple countries at one time
  getMultipleAtTime: publicProcedure
    .input(
      z.object({
        ids: z.array(z.string()),
        timestamp: z.number().optional(),
      })
    )
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
        const dmInputs = country.dmInputs.map((i) => ({
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
          dmInputs: country.dmInputs.map(dm => ({
            ...dm, 
            ixTimeTimestamp: dm.ixTimeTimestamp.getTime()
          })),
        });
      }
      return results;
    }),

  // Global statistics
  getGlobalStats: publicProcedure
    .input(
      z
        .object({
          timestamp: z.number().optional(),
        })
        .optional()
    )
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

  // FIXED: Update stats for one or all countries with better validation
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
        const dmInputs = c.dmInputs.map((i) => ({ 
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
            landArea: c.landArea ?? null, // Ensure null if undefined
            populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
            gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
          },
        });
        return updated;
      }

      // Update all countries
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
        const dmInputs = c.dmInputs.map((i) => ({ 
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
          landArea: c.landArea ?? null, // Ensure null if undefined
          populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
          gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
        });
      }

      // FIXED: Batch create historical points
      if (historicalPointsToCreate.length > 0) {
        try {
          await ctx.db.historicalDataPoint.createMany({
            data: historicalPointsToCreate, // Already contains null-checked values
            skipDuplicates: true, 
          });
        } catch (error) {
          console.warn("Failed to create some historical points:", error);
          // Continue execution - this is not critical
        }
      }
      
      const execMs = Date.now() - start;
      
      // FIXED: Create calculation log
      try {
        await ctx.db.calculationLog.create({
          data: {
            timestamp: new Date(), 
            ixTimeTimestamp: new Date(now), 
            countriesUpdated: results.length,
            executionTimeMs: execMs,
            globalGrowthFactor: econCfg.globalGrowthFactor, 
            notes: "Bulk update triggered manually or by schedule",
          },
        });
      } catch (error) {
        console.warn("Failed to create calculation log:", error);
        // Continue execution - this is not critical
      }
      
      return {
        count: results.length,
        message: `Updated ${results.length} countries`,
        executionTimeMs: execMs,
      };
    }),
});