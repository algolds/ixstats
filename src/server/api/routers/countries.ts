// src/server/api/routers/countries.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { IxStatsCalculator } from "~/lib/calculations";
import type { EconomicConfig, BaseCountryData, CountryStats, EconomicTier, PopulationTier } from "~/types/ixstats";

// Helper function to get the economic configuration
const getEconomicConfig = (): EconomicConfig => ({
  globalGrowthFactor: 1.0,
  baseInflationRate: 0.02,
  economicTierThresholds: {
    developing: 5000,
    emerging: 15000,
    developed: 35000,
    advanced: 60000,
  },
  populationTierThresholds: {
    micro: 1_000_000,
    small: 5_000_000,
    medium: 25_000_000,
    large: 100_000_000,
  },
  tierGrowthModifiers: {
    Developing: 1.2,
    Emerging: 1.1,
    Developed: 1.0,
    Advanced: 0.9,
  },
  calculationIntervalMs: 60_000,
  ixTimeUpdateFrequency: 30_000,
});

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
  maxGdpGrowthRate: country.maxGdpGrowthRate,
  adjustedGdpGrowth: country.adjustedGdpGrowth, // Raw value from DB for calculator input
  populationGrowthRate: country.populationGrowthRate, // Raw value from DB for calculator input
  projected2040Population: country.projected2040Population,
  projected2040Gdp: country.projected2040Gdp,
  projected2040GdpPerCapita: country.projected2040GdpPerCapita,
  actualGdpGrowth: country.actualGdpGrowth, // Raw value from DB for calculator input
  localGrowthFactor: country.localGrowthFactor,
});

export const countriesRouter = createTRPCRouter({
  // 1) Get all countries with basic info + total count
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

  // 2) Get country by ID at a specific IxTime
  getByIdAtTime: publicProcedure
    .input(
      z.object({
        id: z.string(),
        timestamp: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const countryFromDb = await ctx.db.country.findUnique({ // Renamed to avoid confusion
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
          maxGdpGrowthRate: countryFromDb.maxGdpGrowthRate, 
          // This is the actual current GDP per capita growth rate, validated.
          // Frontend should use this value and format as percentage (e.g., 0.05 -> 5.00%).
          adjustedGdpGrowth: validateGrowthRate(countryFromDb.adjustedGdpGrowth), 
          populationGrowthRate: validateGrowthRate(countryFromDb.populationGrowthRate),
          projected2040Population: countryFromDb.projected2040Population || 0,
          projected2040Gdp: countryFromDb.projected2040Gdp || 0,
          projected2040GdpPerCapita: countryFromDb.projected2040GdpPerCapita || 0,
          actualGdpGrowth: validateGrowthRate(countryFromDb.actualGdpGrowth), 
          localGrowthFactor: countryFromDb.localGrowthFactor,
          id: countryFromDb.id,
          name: countryFromDb.name,
          totalGdp: countryFromDb.currentTotalGdp, 
          currentPopulation: countryFromDb.currentPopulation,
          currentGdpPerCapita: countryFromDb.currentGdpPerCapita,
          currentTotalGdp: countryFromDb.currentTotalGdp,
          lastCalculated: countryFromDb.lastCalculated.getTime(),
          baselineDate: countryFromDb.baselineDate.getTime(),
          economicTier: countryFromDb.economicTier as EconomicTier,
          populationTier: countryFromDb.populationTier as PopulationTier,
          populationDensity: countryFromDb.populationDensity,
          gdpDensity: countryFromDb.gdpDensity,
          globalGrowthFactor: getEconomicConfig().globalGrowthFactor, 
        };
      } else {
        const econCfg = getEconomicConfig();
        const baselineDate = countryFromDb.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(countryFromDb); // Pass the DB object
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
            // This is the actual current GDP per capita growth rate, validated.
            // Frontend should use this value and format as percentage (e.g., 0.05 -> 5.00%).
            adjustedGdpGrowth: validateGrowthRate(result.newStats.adjustedGdpGrowth),
            actualGdpGrowth: validateGrowthRate(result.newStats.actualGdpGrowth), 
            country: result.newStats.country || base.country,
            name: result.newStats.name || base.country, // Ensure name is consistent
            id: countryFromDb.id, // Ensure ID is from the original DB object
            continent: result.newStats.continent || base.continent,
            region: result.newStats.region || base.region,
            governmentType: result.newStats.governmentType || base.governmentType,
            religion: result.newStats.religion || base.religion,
            leader: result.newStats.leader || base.leader,
            population: result.newStats.population, 
            gdpPerCapita: result.newStats.gdpPerCapita, 
            landArea: result.newStats.landArea || base.landArea,
            areaSqMi: result.newStats.areaSqMi || base.areaSqMi,
            maxGdpGrowthRate: result.newStats.maxGdpGrowthRate, 
            projected2040Population: result.newStats.projected2040Population, 
            projected2040Gdp: result.newStats.projected2040Gdp, 
            projected2040GdpPerCapita: result.newStats.projected2040GdpPerCapita, 
            localGrowthFactor: result.newStats.localGrowthFactor,
            totalGdp: result.newStats.totalGdp, 
            lastCalculated: result.newStats.lastCalculated, 
            baselineDate: result.newStats.baselineDate, 
            economicTier: result.newStats.economicTier, 
            populationTier: result.newStats.populationTier, 
            globalGrowthFactor: result.newStats.globalGrowthFactor, 
        };
      }

      // Return a structured object. Static fields at top level, all calculated/dynamic fields in `calculatedStats`.
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
        // Baseline fields that are static inputs to calculations
        baselinePopulation: countryFromDb.baselinePopulation,
        baselineGdpPerCapita: countryFromDb.baselineGdpPerCapita,
        maxGdpGrowthRate: countryFromDb.maxGdpGrowthRate, // This is a baseline parameter/cap
        localGrowthFactor: countryFromDb.localGrowthFactor, // Baseline parameter
        // Projected fields from DB (can be considered static baselines for display)
        projected2040Population: countryFromDb.projected2040Population,
        projected2040Gdp: countryFromDb.projected2040Gdp,
        projected2040GdpPerCapita: countryFromDb.projected2040GdpPerCapita,
        // Timestamps
        createdAt: countryFromDb.createdAt,
        updatedAt: countryFromDb.updatedAt,
        baselineDate: countryFromDb.baselineDate, // Original baseline date from DB
        lastCalculated: countryFromDb.lastCalculated, // Original lastCalculated from DB

        // All currently calculated or validated dynamic statistics are in this object.
        // The frontend should primarily use fields from `calculatedStats` for display of current values.
        calculatedStats, 
        dmInputs: countryFromDb.dmInputs.map(dm => ({...dm, ixTimeTimestamp: dm.ixTimeTimestamp.getTime()})),
      };
    }),

  // 3) Get historical data points for a country
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
      if (existing.length >= input.limit || (existing.length > 10 && input.limit > 50)) { 
        return existing.map((p) => ({
          ...p,
          ixTimeTimestamp: p.ixTimeTimestamp.getTime(),
          population: p.population,
          gdpPerCapita: p.gdpPerCapita,
          totalGdp: p.totalGdp,
          populationGrowthRate: p.populationGrowthRate,
          gdpGrowthRate: p.gdpGrowthRate,
          landArea: p.landArea,
          populationDensity: p.populationDensity,
          gdpDensity: p.gdpDensity,
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
          population: res.newStats.currentPopulation,
          gdpPerCapita: res.newStats.currentGdpPerCapita,
          totalGdp: res.newStats.currentTotalGdp,
          populationGrowthRate: res.newStats.populationGrowthRate,
          gdpGrowthRate: res.newStats.adjustedGdpGrowth, 
          landArea: res.newStats.landArea, 
          populationDensity: res.newStats.populationDensity,
          gdpDensity: res.newStats.gdpDensity,
        });
      }
      return dataPoints;
    }),

  // 4) Get forecast data
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
      if (totalDuration <=0 || input.points <=0) { 
        return {
            countryId: input.id,
            countryName: country.name,
            startTime: input.startTime,
            endTime: input.endTime,
            dataPoints: [],
        }
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
        
        if (i === input.points) { // For the last point, ensure it's exactly endTime or capped if overshot
            forecastTime = Math.min(forecastTime, input.endTime);
        }
        if (forecastTime > input.endTime && i < input.points) break; // Don't calculate beyond endTime for intermediate points


        const res = calc.calculateTimeProgression(
          baselineStats,
          forecastTime,
          dmInputs
        );
        dataPoints.push({
          ixTime: forecastTime,
          formattedTime: IxTime.formatIxTime(forecastTime),
          gameYear: IxTime.getCurrentGameYear(forecastTime),
          population: res.newStats.currentPopulation,
          gdpPerCapita: res.newStats.currentGdpPerCapita,
          totalGdp: res.newStats.currentTotalGdp,
          populationDensity: res.newStats.populationDensity,
          gdpDensity: res.newStats.gdpDensity,
          economicTier: res.newStats.economicTier,
          populationTier: res.newStats.populationTier,
        });
         if (forecastTime >= input.endTime && i <= input.points) break; // Ensure we capture the point at endTime
      }
      return {
        countryId: input.id,
        countryName: country.name,
        startTime: input.startTime,
        endTime: input.endTime,
        dataPoints,
      };
    }),

  // 5) Compare multiple countries at one time
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
            ...res.newStats, // Spread first
            id: country.id, // Ensure original ID is used
            name: res.newStats.name || base.country, // Fallback for name
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
            maxGdpGrowthRate: res.newStats.maxGdpGrowthRate,
            projected2040Population: res.newStats.projected2040Population,
            projected2040Gdp: res.newStats.projected2040Gdp,
            projected2040GdpPerCapita: res.newStats.projected2040GdpPerCapita,
            localGrowthFactor: res.newStats.localGrowthFactor,
            totalGdp: res.newStats.totalGdp,
            lastCalculated: res.newStats.lastCalculated,
            baselineDate: res.newStats.baselineDate,
            economicTier: res.newStats.economicTier,
            populationTier: res.newStats.populationTier,
            globalGrowthFactor: res.newStats.globalGrowthFactor,
        };

        results.push({
          // Static fields from DB
          id: country.id,
          name: country.name,
          continent: country.continent,
          region: country.region,
          // ... other necessary static fields from country object
          // Dynamic/Calculated fields
          calculatedStats: calculatedCountryStats,
          dmInputs: country.dmInputs.map(dm => ({...dm, ixTimeTimestamp: dm.ixTimeTimestamp.getTime()})),
        });
      }
      return results;
    }),

  // 6) Global statistics
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
        totalPopulation += country.currentPopulation || 0;
        totalGdp += country.currentTotalGdp || 0;
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

  // 7) Update stats for one or all countries
  updateStats: publicProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const econCfg = getEconomicConfig();
      const now = IxTime.getCurrentIxTime(); 
      const validateGrowthRate = (value: number | null | undefined): number => {
        const numValue = Number(value);
        if (!isFinite(numValue) || isNaN(numValue)) return 0;
        return Math.min(Math.max(numValue, -0.5), 0.5);
      };

      if (input.countryId) {
        const c = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: { dmInputs: { where: { isActive: true }, orderBy: {ixTimeTimestamp: "desc"} } }, 
        });
        if (!c) throw new Error(`Country ${input.countryId} not found`);

        const calc = new IxStatsCalculator(econCfg, c.baselineDate.getTime());
        const base = prepareBaseCountryData(c); 
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = c.dmInputs.map((i) => ({ ...i, ixTimeTimestamp: i.ixTimeTimestamp.getTime() }));
        const res = calc.calculateTimeProgression(baselineStats, now, dmInputs);

        const updated = await ctx.db.country.update({
          where: { id: c.id },
          data: {
            currentPopulation: res.newStats.currentPopulation,
            currentGdpPerCapita: res.newStats.currentGdpPerCapita,
            currentTotalGdp: res.newStats.currentTotalGdp,
            economicTier: res.newStats.economicTier.toString(), 
            populationTier: res.newStats.populationTier.toString(), 
            populationDensity: res.newStats.populationDensity,
            gdpDensity: res.newStats.gdpDensity,
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
            population: res.newStats.currentPopulation,
            gdpPerCapita: res.newStats.currentGdpPerCapita,
            totalGdp: res.newStats.currentTotalGdp,
            populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate), 
            gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth), 
            landArea: c.landArea,
            populationDensity: res.newStats.populationDensity,
            gdpDensity: res.newStats.gdpDensity,
          },
        });
        return updated;
      }

      const all = await ctx.db.country.findMany({
        include: { dmInputs: { where: { isActive: true }, orderBy: {ixTimeTimestamp: "desc"} } }, 
      });
      const start = Date.now(); 
      const results = [];
      const historicalPointsToCreate = [];

      for (const c of all) {
        const calc = new IxStatsCalculator(econCfg, c.baselineDate.getTime());
        const base = prepareBaseCountryData(c); 
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = c.dmInputs.map((i) => ({ ...i, ixTimeTimestamp: i.ixTimeTimestamp.getTime()}));
        const res = calc.calculateTimeProgression(baselineStats, now, dmInputs);
        const updateData = {
          currentPopulation: res.newStats.currentPopulation,
          currentGdpPerCapita: res.newStats.currentGdpPerCapita,
          currentTotalGdp: res.newStats.currentTotalGdp,
          economicTier: res.newStats.economicTier.toString(),
          populationTier: res.newStats.populationTier.toString(),
          populationDensity: res.newStats.populationDensity,
          gdpDensity: res.newStats.gdpDensity,
          adjustedGdpGrowth: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          actualGdpGrowth: validateGrowthRate(res.newStats.actualGdpGrowth),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          lastCalculated: new Date(now),
        };
        const updated = await ctx.db.country.update({ where: { id: c.id }, data: updateData });
        results.push(updated);
        historicalPointsToCreate.push({
          countryId: c.id,
          ixTimeTimestamp: new Date(now),
          population: res.newStats.currentPopulation,
          gdpPerCapita: res.newStats.currentGdpPerCapita,
          totalGdp: res.newStats.currentTotalGdp,
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          landArea: c.landArea,
          populationDensity: res.newStats.populationDensity,
          gdpDensity: res.newStats.gdpDensity,
        });
      }

      if (historicalPointsToCreate.length > 0) {
        await ctx.db.historicalDataPoint.createMany({
          data: historicalPointsToCreate,
          skipDuplicates: true, 
        });
      }
      const execMs = Date.now() - start;
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
      return {
        count: results.length,
        message: `Updated ${results.length} countries`,
        executionTimeMs: execMs,
      };
    }),
});
