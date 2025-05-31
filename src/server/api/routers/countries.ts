// src/server/api/routers/countries.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { IxStatsCalculator } from "~/lib/calculations";
import { type EconomicConfig } from "~/types/ixstats";

// Enhanced countries router with comprehensive chart data support
export const countriesRouter = createTRPCRouter({
  // Get all countries with basic information
  getAll: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(100),
      offset: z.number().optional().default(0),
      search: z.string().optional(),
      continent: z.string().optional(),
      economicTier: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const whereConditions: any = {};
      
      if (input.search) {
        whereConditions.name = {
          contains: input.search,
          mode: 'insensitive',
        };
      }
      
      if (input.continent) {
        whereConditions.continent = input.continent;
      }
      
      if (input.economicTier) {
        whereConditions.economicTier = input.economicTier;
      }

      const [countries, total] = await Promise.all([
        ctx.db.country.findMany({
          where: whereConditions,
          take: input.limit,
          skip: input.offset,
          orderBy: { name: 'asc' },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: 'desc' },
            },
          },
        }),
        ctx.db.country.count({ where: whereConditions }),
      ]);

      return {
        countries,
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),

  // Get country by ID at specific time with calculated stats
  getByIdAtTime: publicProcedure
    .input(z.object({
      id: z.string(),
      timestamp: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp || IxTime.getCurrentIxTime();
      
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: 'desc' },
          },
        },
      });

      if (!country) {
        throw new Error(`Country with ID ${input.id} not found`);
      }

      // Get economic config from system settings
      const economicConfig: EconomicConfig = {
        globalGrowthFactor: 1.0,
        baseInflationRate: 0.02,
        economicTierThresholds: {
          developing: 5000,
          emerging: 15000,
          developed: 35000,
          advanced: 60000,
        },
        populationTierThresholds: {
          micro: 1000000,
          small: 5000000,
          medium: 25000000,
          large: 100000000,
        },
        tierGrowthModifiers: {
          Developing: 1.2,
          Emerging: 1.1,
          Developed: 1.0,
          Advanced: 0.9,
        },
        calculationIntervalMs: 60000,
        ixTimeUpdateFrequency: 30000,
      };

      // Initialize calculator with baseline date
      const baselineDate = country.baselineDate.getTime();
      const calculator = new IxStatsCalculator(economicConfig, baselineDate);

      // Convert country data to BaseCountryData format
      const baseData = {
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
        adjustedGdpGrowth: country.adjustedGdpGrowth,
        populationGrowthRate: country.populationGrowthRate,
        projected2040Population: 0, // Not used in calculations
        projected2040Gdp: 0, // Not used in calculations
        projected2040GdpPerCapita: 0, // Not used in calculations
        actualGdpGrowth: 0, // Not used in calculations
      };

      // Initialize baseline stats
      const baselineStats = calculator.initializeCountryStats(baseData);

      // Calculate stats for target time
      const dmInputs = country.dmInputs.map(input => ({
        ...input,
        ixTimeTimestamp: input.ixTimeTimestamp.getTime(),
        inputType: input.inputType,
        isActive: input.isActive,
      }));

      const calculationResult = calculator.calculateTimeProgression(
        baselineStats,
        targetTime,
        dmInputs
      );

      return {
        ...country,
        calculatedStats: calculationResult.newStats,
        dmInputs: country.dmInputs,
      };
    }),

  // Get historical data for a country within a time range
  getHistoricalAtTime: publicProcedure
    .input(z.object({
      id: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      limit: z.number().optional().default(500),
      interval: z.enum(['daily', 'weekly', 'monthly']).optional().default('weekly'),
    }))
    .query(async ({ ctx, input }) => {
      // Try to get existing historical data first
      const existingData = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: input.id,
          ixTimeTimestamp: {
            gte: new Date(input.startTime),
            lte: new Date(input.endTime),
          },
        },
        orderBy: { ixTimeTimestamp: 'asc' },
        take: input.limit,
      });

      // If we have sufficient data, return it
      if (existingData.length > 10) {
        return existingData.map(point => ({
          ...point,
          ixTimeTimestamp: point.ixTimeTimestamp.getTime(),
        }));
      }

      // Otherwise, generate historical data on the fly
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: 'desc' },
          },
        },
      });

      if (!country) {
        throw new Error(`Country with ID ${input.id} not found`);
      }

      // Generate data points
      const dataPoints = [];
      const intervalMs = input.interval === 'daily' ? 24 * 60 * 60 * 1000 :
                        input.interval === 'weekly' ? 7 * 24 * 60 * 60 * 1000 :
                        30 * 24 * 60 * 60 * 1000; // monthly

      // Get economic config
      const economicConfig: EconomicConfig = {
        globalGrowthFactor: 1.0,
        baseInflationRate: 0.02,
        economicTierThresholds: {
          developing: 5000,
          emerging: 15000,
          developed: 35000,
          advanced: 60000,
        },
        populationTierThresholds: {
          micro: 1000000,
          small: 5000000,
          medium: 25000000,
          large: 100000000,
        },
        tierGrowthModifiers: {
          Developing: 1.2,
          Emerging: 1.1,
          Developed: 1.0,
          Advanced: 0.9,
        },
        calculationIntervalMs: 60000,
        ixTimeUpdateFrequency: 30000,
      };

      const baselineDate = country.baselineDate.getTime();
      const calculator = new IxStatsCalculator(economicConfig, baselineDate);

      // Convert country data
      const baseData = {
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
        adjustedGdpGrowth: country.adjustedGdpGrowth,
        populationGrowthRate: country.populationGrowthRate,
        projected2040Population: 0,
        projected2040Gdp: 0,
        projected2040GdpPerCapita: 0,
        actualGdpGrowth: 0,
      };

      const baselineStats = calculator.initializeCountryStats(baseData);
      const dmInputs = country.dmInputs.map(input => ({
        ...input,
        ixTimeTimestamp: input.ixTimeTimestamp.getTime(),
        inputType: input.inputType,
        isActive: input.isActive,
      }));

      for (let time = input.startTime; time <= input.endTime && dataPoints.length < input.limit; time += intervalMs) {
        const result = calculator.calculateTimeProgression(baselineStats, time, dmInputs);
        
        dataPoints.push({
          ixTimeTimestamp: time,
          population: result.newStats.currentPopulation,
          gdpPerCapita: result.newStats.currentGdpPerCapita,
          totalGdp: result.newStats.currentTotalGdp,
          populationGrowthRate: result.newStats.populationGrowthRate,
          gdpGrowthRate: result.newStats.adjustedGdpGrowth,
          landArea: result.newStats.landArea,
          populationDensity: result.newStats.populationDensity,
          gdpDensity: result.newStats.gdpDensity,
        });
      }

      return dataPoints;
    }),

  // Get forecast data for a country
  getForecast: publicProcedure
    .input(z.object({
      id: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      points: z.number().optional().default(40), // 10 years of quarterly data
    }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: 'desc' },
          },
        },
      });

      if (!country) {
        throw new Error(`Country with ID ${input.id} not found`);
      }

      // Generate forecast data
      const dataPoints = [];
      const totalYears = IxTime.getYearsElapsed(input.startTime, input.endTime);
      const intervalYears = totalYears / input.points;

      // Get economic config
      const economicConfig: EconomicConfig = {
        globalGrowthFactor: 1.0,
        baseInflationRate: 0.02,
        economicTierThresholds: {
          developing: 5000,
          emerging: 15000,
          developed: 35000,
          advanced: 60000,
        },
        populationTierThresholds: {
          micro: 1000000,
          small: 5000000,
          medium: 25000000,
          large: 100000000,
        },
        tierGrowthModifiers: {
          Developing: 1.2,
          Emerging: 1.1,
          Developed: 1.0,
          Advanced: 0.9,
        },
        calculationIntervalMs: 60000,
        ixTimeUpdateFrequency: 30000,
      };

      const baselineDate = country.baselineDate.getTime();
      const calculator = new IxStatsCalculator(economicConfig, baselineDate);

      // Convert country data
      const baseData = {
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
        adjustedGdpGrowth: country.adjustedGdpGrowth,
        populationGrowthRate: country.populationGrowthRate,
        projected2040Population: 0,
        projected2040Gdp: 0,
        projected2040GdpPerCapita: 0,
        actualGdpGrowth: 0,
      };

      const baselineStats = calculator.initializeCountryStats(baseData);
      const dmInputs = country.dmInputs.map(input => ({
        ...input,
        ixTimeTimestamp: input.ixTimeTimestamp.getTime(),
        inputType: input.inputType,
        isActive: input.isActive,
      }));

      for (let i = 0; i <= input.points; i++) {
        const forecastTime = IxTime.addYears(input.startTime, i * intervalYears);
        
        if (forecastTime > input.endTime) break;

        const result = calculator.calculateTimeProgression(baselineStats, forecastTime, dmInputs);
        
        dataPoints.push({
          ixTime: forecastTime,
          formattedTime: IxTime.formatIxTime(forecastTime),
          gameYear: IxTime.getCurrentGameYear(forecastTime),
          population: result.newStats.currentPopulation,
          gdpPerCapita: result.newStats.currentGdpPerCapita,
          totalGdp: result.newStats.currentTotalGdp,
          populationDensity: result.newStats.populationDensity,
          gdpDensity: result.newStats.gdpDensity,
          economicTier: result.newStats.economicTier,
          populationTier: result.newStats.populationTier,
        });
      }

      return {
        countryId: input.id,
        countryName: country.name,
        startTime: input.startTime,
        endTime: input.endTime,
        dataPoints,
      };
    }),

  // Get multiple countries for comparison
  getMultipleAtTime: publicProcedure
    .input(z.object({
      ids: z.array(z.string()),
      timestamp: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp || IxTime.getCurrentIxTime();
      
      const countries = await ctx.db.country.findMany({
        where: { id: { in: input.ids } },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: 'desc' },
          },
        },
      });

      // Calculate stats for each country at the target time
      const economicConfig: EconomicConfig = {
        globalGrowthFactor: 1.0,
        baseInflationRate: 0.02,
        economicTierThresholds: {
          developing: 5000,
          emerging: 15000,
          developed: 35000,
          advanced: 60000,
        },
        populationTierThresholds: {
          micro: 1000000,
          small: 5000000,
          medium: 25000000,
          large: 100000000,
        },
        tierGrowthModifiers: {
          Developing: 1.2,
          Emerging: 1.1,
          Developed: 1.0,
          Advanced: 0.9,
        },
        calculationIntervalMs: 60000,
        ixTimeUpdateFrequency: 30000,
      };

      const results = [];

      for (const country of countries) {
        const baselineDate = country.baselineDate.getTime();
        const calculator = new IxStatsCalculator(economicConfig, baselineDate);

        const baseData = {
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
          adjustedGdpGrowth: country.adjustedGdpGrowth,
          populationGrowthRate: country.populationGrowthRate,
          projected2040Population: 0,
          projected2040Gdp: 0,
          projected2040GdpPerCapita: 0,
          actualGdpGrowth: 0,
        };

        const baselineStats = calculator.initializeCountryStats(baseData);
        const dmInputs = country.dmInputs.map(input => ({
          ...input,
          ixTimeTimestamp: input.ixTimeTimestamp.getTime(),
          inputType: input.inputType,
          isActive: input.isActive,
        }));

        const calculationResult = calculator.calculateTimeProgression(
          baselineStats,
          targetTime,
          dmInputs
        );

        results.push({
          ...country,
          calculatedStats: calculationResult.newStats,
          dmInputs: country.dmInputs,
        });
      }

      return results;
    }),

  // Get global economic statistics
  getGlobalStats: publicProcedure
    .input(z.object({
      timestamp: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp || IxTime.getCurrentIxTime();
      
      // Get all countries and calculate their stats at the target time
      const countries = await ctx.db.country.findMany({
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: 'desc' },
          },
        },
      });

      let totalPopulation = 0;
      let totalGdp = 0;
      let totalLandArea = 0;
      const economicTierCounts: Record<string, number> = {};
      const populationTierCounts: Record<string, number> = {};

      // Economic config
      const economicConfig: EconomicConfig = {
        globalGrowthFactor: 1.0,
        baseInflationRate: 0.02,
        economicTierThresholds: {
          developing: 5000,
          emerging: 15000,
          developed: 35000,
          advanced: 60000,
        },
        populationTierThresholds: {
          micro: 1000000,
          small: 5000000,
          medium: 25000000,
          large: 100000000,
        },
        tierGrowthModifiers: {
          Developing: 1.2,
          Emerging: 1.1,
          Developed: 1.0,
          Advanced: 0.9,
        },
        calculationIntervalMs: 60000,
        ixTimeUpdateFrequency: 30000,
      };

      for (const country of countries) {
        const baselineDate = country.baselineDate.getTime();
        const calculator = new IxStatsCalculator(economicConfig, baselineDate);

        const baseData = {
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
          adjustedGdpGrowth: country.adjustedGdpGrowth,
          populationGrowthRate: country.populationGrowthRate,
          projected2040Population: 0,
          projected2040Gdp: 0,
          projected2040GdpPerCapita: 0,
          actualGdpGrowth: 0,
        };

        const baselineStats = calculator.initializeCountryStats(baseData);
        const dmInputs = country.dmInputs.map(input => ({
          ...input,
          ixTimeTimestamp: input.ixTimeTimestamp.getTime(),
          inputType: input.inputType,
          isActive: input.isActive,
        }));

        const result = calculator.calculateTimeProgression(baselineStats, targetTime, dmInputs);
        
        totalPopulation += result.newStats.currentPopulation;
        totalGdp += result.newStats.currentTotalGdp;
        if (country.landArea) totalLandArea += country.landArea;

        economicTierCounts[result.newStats.economicTier] = 
          (economicTierCounts[result.newStats.economicTier] || 0) + 1;
        populationTierCounts[result.newStats.populationTier] = 
          (populationTierCounts[result.newStats.populationTier] || 0) + 1;
      }

      const averageGdpPerCapita = totalPopulation > 0 ? totalGdp / totalPopulation : 0;
      const averagePopulationDensity = totalLandArea > 0 ? totalPopulation / totalLandArea : 0;
      const averageGdpDensity = totalLandArea > 0 ? totalGdp / totalLandArea : 0;

      return {
        totalPopulation,
        totalGdp,
        averageGdpPerCapita,
        countryCount: countries.length,
        economicTierDistribution: economicTierCounts,
        populationTierDistribution: populationTierCounts,
        averagePopulationDensity,
        averageGdpDensity,
        globalGrowthRate: 0.025, // Could be calculated from historical data
        ixTimeTimestamp: targetTime,
      };
    }),
});