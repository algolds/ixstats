// src/server/api/routers/countries.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { IxStatsCalculator } from "~/lib/calculations";
import { type EconomicConfig } from "~/types/ixstats";

// Helper function to get the economic configuration
// Extracted to avoid repetition across procedures
const getEconomicConfig = (): EconomicConfig => {
  return {
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
};

// Helper to prepare country data for calculator
const prepareBaseCountryData = (country: any) => {
  return {
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
    projected2040Population: country.projected2040Population,
    projected2040Gdp: country.projected2040Gdp,
    projected2040GdpPerCapita: country.projected2040GdpPerCapita,
    actualGdpGrowth: country.actualGdpGrowth,
  };
};

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
    }).optional())
    .query(async ({ ctx, input }) => {
      const whereConditions: any = {};
      
      if (input?.search) {
        whereConditions.name = {
          contains: input.search,
          mode: 'insensitive',
        };
      }
      
      if (input?.continent) {
        whereConditions.continent = input.continent;
      }
      
      if (input?.economicTier) {
        whereConditions.economicTier = input.economicTier;
      }

      const countries = await ctx.db.country.findMany({
        where: whereConditions,
        take: input?.limit ?? 100,
        skip: input?.offset ?? 0,
        orderBy: { name: 'asc' },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: 'desc' },
          },
        },
      });

      const total = await ctx.db.country.count({ where: whereConditions });

      return countries;
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

      // Get economic config
      const economicConfig = getEconomicConfig();

      // Initialize calculator with baseline date
      const baselineDate = country.baselineDate.getTime();
      const calculator = new IxStatsCalculator(economicConfig, baselineDate);

      // Convert country data to BaseCountryData format
      const baseData = prepareBaseCountryData(country);

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

      // Get economic config and calculator
      const economicConfig = getEconomicConfig();
      const baselineDate = country.baselineDate.getTime();
      const calculator = new IxStatsCalculator(economicConfig, baselineDate);

      // Convert country data
      const baseData = prepareBaseCountryData(country);

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

      // Get economic config and calculator
      const economicConfig = getEconomicConfig();
      const baselineDate = country.baselineDate.getTime();
      const calculator = new IxStatsCalculator(economicConfig, baselineDate);

      // Convert country data
      const baseData = prepareBaseCountryData(country);

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
      const economicConfig = getEconomicConfig();
      const results = [];

      for (const country of countries) {
        const baselineDate = country.baselineDate.getTime();
        const calculator = new IxStatsCalculator(economicConfig, baselineDate);

        const baseData = prepareBaseCountryData(country);

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
    }).optional())
    .query(async ({ ctx, input }) => {
      const targetTime = input?.timestamp || IxTime.getCurrentIxTime();
      
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
      const economicConfig = getEconomicConfig();

      for (const country of countries) {
        const baselineDate = country.baselineDate.getTime();
        const calculator = new IxStatsCalculator(economicConfig, baselineDate);

        const baseData = prepareBaseCountryData(country);

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
        totalCountries: countries.length,
        economicTierDistribution: economicTierCounts,
        populationTierDistribution: populationTierCounts,
        averagePopulationDensity,
        averageGdpDensity,
        globalGrowthRate: 0.025, // Could be calculated from historical data
        ixTimeTimestamp: targetTime,
      };
    }),

  // Update country statistics - handles both single country and all countries
  updateStats: publicProcedure
    .input(z.object({
      countryId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get economic config
      const economicConfig = getEconomicConfig();
      
      // If countryId is provided, update only that country
      if (input.countryId) {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
            },
          },
        });
        
        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }
        
        // Calculate current stats
        const currentTime = IxTime.getCurrentIxTime();
        const baselineDate = country.baselineDate.getTime();
        const calculator = new IxStatsCalculator(economicConfig, baselineDate);
        
        // Convert country data to format needed by calculator
        const baseData = prepareBaseCountryData(country);
        
        const baselineStats = calculator.initializeCountryStats(baseData);
        const dmInputs = country.dmInputs.map(input => ({
          ...input,
          ixTimeTimestamp: input.ixTimeTimestamp.getTime(),
          inputType: input.inputType,
          isActive: input.isActive,
        }));
        
        const calculationResult = calculator.calculateTimeProgression(
          baselineStats,
          currentTime,
          dmInputs
        );
        
        // Update the country with new calculations
        const updated = await ctx.db.country.update({
          where: { id: input.countryId },
          data: {
            currentPopulation: calculationResult.newStats.currentPopulation,
            currentGdpPerCapita: calculationResult.newStats.currentGdpPerCapita,
            currentTotalGdp: calculationResult.newStats.currentTotalGdp,
            economicTier: calculationResult.newStats.economicTier,
            populationTier: calculationResult.newStats.populationTier,
            populationDensity: calculationResult.newStats.populationDensity,
            gdpDensity: calculationResult.newStats.gdpDensity,
            lastCalculated: new Date(currentTime),
          },
        });

        // Optionally save a historical data point
        await ctx.db.historicalDataPoint.create({
          data: {
            countryId: country.id,
            ixTimeTimestamp: new Date(currentTime),
            population: calculationResult.newStats.currentPopulation,
            gdpPerCapita: calculationResult.newStats.currentGdpPerCapita,
            totalGdp: calculationResult.newStats.currentTotalGdp,
            populationGrowthRate: country.populationGrowthRate,
            gdpGrowthRate: country.adjustedGdpGrowth,
            landArea: country.landArea,
            populationDensity: calculationResult.newStats.populationDensity,
            gdpDensity: calculationResult.newStats.gdpDensity,
          }
        });
        
        return updated;
      } 
      // If no countryId, update all countries
      else {
        const countries = await ctx.db.country.findMany({
          include: {
            dmInputs: {
              where: { isActive: true },
            },
          },
        });
        
        const currentTime = IxTime.getCurrentIxTime();
        const updatedCountries = [];
        const startTime = Date.now();
        
        for (const country of countries) {
          const baselineDate = country.baselineDate.getTime();
          const calculator = new IxStatsCalculator(economicConfig, baselineDate);
          
          const baseData = prepareBaseCountryData(country);
          
          const baselineStats = calculator.initializeCountryStats(baseData);
          const dmInputs = country.dmInputs.map(input => ({
            ...input,
            ixTimeTimestamp: input.ixTimeTimestamp.getTime(),
            inputType: input.inputType,
            isActive: input.isActive,
          }));
          
          const calculationResult = calculator.calculateTimeProgression(
            baselineStats,
            currentTime,
            dmInputs
          );
          
          const updated = await ctx.db.country.update({
            where: { id: country.id },
            data: {
              currentPopulation: calculationResult.newStats.currentPopulation,
              currentGdpPerCapita: calculationResult.newStats.currentGdpPerCapita,
              currentTotalGdp: calculationResult.newStats.currentTotalGdp,
              economicTier: calculationResult.newStats.economicTier,
              populationTier: calculationResult.newStats.populationTier,
              populationDensity: calculationResult.newStats.populationDensity,
              gdpDensity: calculationResult.newStats.gdpDensity,
              lastCalculated: new Date(currentTime),
            },
          });
          
          // Optionally save historical data points
          await ctx.db.historicalDataPoint.create({
            data: {
              countryId: country.id,
              ixTimeTimestamp: new Date(currentTime),
              population: calculationResult.newStats.currentPopulation,
              gdpPerCapita: calculationResult.newStats.currentGdpPerCapita,
              totalGdp: calculationResult.newStats.currentTotalGdp,
              populationGrowthRate: country.populationGrowthRate,
              gdpGrowthRate: country.adjustedGdpGrowth,
              landArea: country.landArea,
              populationDensity: calculationResult.newStats.populationDensity,
              gdpDensity: calculationResult.newStats.gdpDensity,
            }
          });
          
          updatedCountries.push(updated);
        }
        
        const executionTimeMs = Date.now() - startTime;
        
        // Create a calculation log entry
        await ctx.db.calculationLog.create({
          data: {
            timestamp: new Date(),
            ixTimeTimestamp: new Date(currentTime),
            countriesUpdated: updatedCountries.length,
            executionTimeMs,
            globalGrowthFactor: economicConfig.globalGrowthFactor,
            notes: "Bulk update triggered manually",
          }
        });
        
        return { 
          count: updatedCountries.length,
          message: `Updated ${updatedCountries.length} countries`,
          executionTimeMs
        };
      }
    }),
});
