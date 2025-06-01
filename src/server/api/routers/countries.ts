// src/server/api/routers/countries.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { IxStatsCalculator } from "~/lib/calculations";
import type { EconomicConfig } from "~/types/ixstats";

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
const prepareBaseCountryData = (country: any) => ({
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

      // Check if we're requesting current time or very close to it - use database values
      const currentTime = IxTime.getCurrentIxTime();
      const timeDiff = Math.abs(targetTime - currentTime);
      const isCurrentTime = timeDiff < (5 * 60 * 1000); // Within 5 minutes

      let calculatedStats;

      if (isCurrentTime) {
        // Use the already-calculated database values for current time to avoid calculation errors
        // But still validate growth rates to prevent display issues
        const validateGrowthRate = (value: number): number => {
          if (!isFinite(value) || isNaN(value)) return 0;
          // Cap growth rates to realistic economic bounds (-0.5 to +0.5 = -50% to +50%)
          return Math.min(Math.max(value, -0.5), 0.5);
        };

        calculatedStats = {
          country: country.name,
          continent: country.continent,
          region: country.region,
          governmentType: country.governmentType,
          religion: country.religion,
          leader: country.leader,
          name: country.name,
          population: country.baselinePopulation,
          gdpPerCapita: country.baselineGdpPerCapita,
          landArea: country.landArea,
          areaSqMi: country.areaSqMi,
          maxGdpGrowthRate: country.maxGdpGrowthRate,
          adjustedGdpGrowth: validateGrowthRate(country.adjustedGdpGrowth), // Validate this too
          populationGrowthRate: validateGrowthRate(country.populationGrowthRate), // And this
          projected2040Population: country.projected2040Population || 0,
          projected2040Gdp: country.projected2040Gdp || 0,
          projected2040GdpPerCapita: country.projected2040GdpPerCapita || 0,
          actualGdpGrowth: country.actualGdpGrowth || 0,
          totalGdp: country.currentTotalGdp,
          currentPopulation: country.currentPopulation,
          currentGdpPerCapita: country.currentGdpPerCapita,
          currentTotalGdp: country.currentTotalGdp,
          lastCalculated: country.lastCalculated,
          baselineDate: country.baselineDate,
          economicTier: country.economicTier,
          populationTier: country.populationTier,
          populationDensity: country.populationDensity,
          gdpDensity: country.gdpDensity,
          localGrowthFactor: country.localGrowthFactor,
          globalGrowthFactor: 1.0,
        };
      } else {
        // Use calculator for historical/future times with validation
        const econCfg = getEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);

        const dmInputs = country.dmInputs.map((i) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));

        const result = calc.calculateTimeProgression(
          baselineStats,
          targetTime,
          dmInputs
        );

        // Validate calculated values and cap extreme ones
        const validateNumber = (value: number, max: number = 1e12): number => {
          if (!isFinite(value) || isNaN(value) || value < 0) return 0;
          return Math.min(value, max);
        };

        const validateGrowthRate = (value: number): number => {
          if (!isFinite(value) || isNaN(value)) return 0;
          // Cap growth rates to realistic economic bounds (-0.5 to +0.5 = -50% to +50%)
          return Math.min(Math.max(value, -0.5), 0.5);
        };

        calculatedStats = {
          ...result.newStats,
          currentPopulation: validateNumber(result.newStats.currentPopulation, 1e11), // Max 100B population
          currentGdpPerCapita: validateNumber(result.newStats.currentGdpPerCapita, 1e6), // Max $1M per capita
          currentTotalGdp: validateNumber(result.newStats.currentTotalGdp, 1e15), // Max $1000T total GDP
          populationDensity: result.newStats.populationDensity ? validateNumber(result.newStats.populationDensity, 1e6) : null,
          gdpDensity: result.newStats.gdpDensity ? validateNumber(result.newStats.gdpDensity, 1e12) : null,
          // Validate growth rates to prevent extreme percentages
          populationGrowthRate: validateGrowthRate(result.newStats.populationGrowthRate),
          adjustedGdpGrowth: validateGrowthRate(result.newStats.adjustedGdpGrowth),
        };
      }

      return {
        ...country,
        calculatedStats,
        dmInputs: country.dmInputs,
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
      if (existing.length > 10) {
        return existing.map((p) => ({
          ...p,
          ixTimeTimestamp: p.ixTimeTimestamp.getTime(),
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

      const totalYears = IxTime.getYearsElapsed(
        input.startTime,
        input.endTime
      );
      const intervalYears = totalYears / input.points;

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
        const forecastTime = IxTime.addYears(
          input.startTime,
          i * intervalYears
        );
        if (forecastTime > input.endTime) break;
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
      const countries = await ctx.db.country.findMany({
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
      for (const country of countries) {
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
        results.push({
          ...country,
          calculatedStats: res.newStats,
          dmInputs: country.dmInputs,
        });
      }
      return results;
    }),

  // 6) FIXED: Global statistics now uses the same approach as countries page
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
      
      // Use the same approach as the countries page - just sum up the already-calculated values
      const countries = await ctx.db.country.findMany({
        select: {
          id: true,
          name: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          economicTier: true,
          populationTier: true,
          landArea: true,
          populationDensity: true,
          gdpDensity: true,
        },
      });

      let totalPopulation = 0;
      let totalGdp = 0;
      let totalLand = 0;
      const econCounts: Record<string, number> = {};
      const popCounts: Record<string, number> = {};

      // Sum up the already-calculated values (same as countries page)
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
        totalCountries: countries.length, // This field name matches the countries page
        economicTierDistribution: econCounts,
        populationTierDistribution: popCounts,
        averagePopulationDensity: avgPopD || null,
        averageGdpDensity: avgGdpD || null,
        globalGrowthRate: 0.025, // Could be calculated from historical data if needed
        ixTimeTimestamp: targetTime,
      };
    }),

  // 7) Update stats for one or all countries
  updateStats: publicProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const econCfg = getEconomicConfig();
      const now = IxTime.getCurrentIxTime();

      // Update a single country
      if (input.countryId) {
        const c = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: { dmInputs: { where: { isActive: true } } },
        });
        if (!c) throw new Error(`Country ${input.countryId} not found`);

        const calc = new IxStatsCalculator(
          econCfg,
          c.baselineDate.getTime()
        );
        const base = prepareBaseCountryData(c);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = c.dmInputs.map((i) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const res = calc.calculateTimeProgression(
          baselineStats,
          now,
          dmInputs
        );

        const updated = await ctx.db.country.update({
          where: { id: c.id },
          data: {
            currentPopulation: res.newStats.currentPopulation,
            currentGdpPerCapita: res.newStats.currentGdpPerCapita,
            currentTotalGdp: res.newStats.currentTotalGdp,
            economicTier: res.newStats.economicTier,
            populationTier: res.newStats.populationTier,
            populationDensity: res.newStats.populationDensity,
            gdpDensity: res.newStats.gdpDensity,
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
            populationGrowthRate: c.populationGrowthRate,
            gdpGrowthRate: c.adjustedGdpGrowth,
            landArea: c.landArea,
            populationDensity: res.newStats.populationDensity,
            gdpDensity: res.newStats.gdpDensity,
          },
        });

        return updated;
      }

      // Bulk update all countries
      const all = await ctx.db.country.findMany({
        include: { dmInputs: { where: { isActive: true } } },
      });
      const start = Date.now();
      const results = [];

      for (const c of all) {
        const calc = new IxStatsCalculator(
          econCfg,
          c.baselineDate.getTime()
        );
        const base = prepareBaseCountryData(c);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = c.dmInputs.map((i) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const res = calc.calculateTimeProgression(
          baselineStats,
          now,
          dmInputs
        );

        const updated = await ctx.db.country.update({
          where: { id: c.id },
          data: {
            currentPopulation: res.newStats.currentPopulation,
            currentGdpPerCapita: res.newStats.currentGdpPerCapita,
            currentTotalGdp: res.newStats.currentTotalGdp,
            economicTier: res.newStats.economicTier,
            populationTier: res.newStats.populationTier,
            populationDensity: res.newStats.populationDensity,
            gdpDensity: res.newStats.gdpDensity,
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
            populationGrowthRate: c.populationGrowthRate,
            gdpGrowthRate: c.adjustedGdpGrowth,
            landArea: c.landArea,
            populationDensity: res.newStats.populationDensity,
            gdpDensity: res.newStats.gdpDensity,
          },
        });

        results.push(updated);
      }

      const execMs = Date.now() - start;
      await ctx.db.calculationLog.create({
        data: {
          timestamp: new Date(),
          ixTimeTimestamp: new Date(now),
          countriesUpdated: results.length,
          executionTimeMs: execMs,
          globalGrowthFactor: econCfg.globalGrowthFactor,
          notes: "Bulk update triggered manually",
        },
      });

      return {
        count: results.length,
        message: `Updated ${results.length} countries`,
        executionTimeMs: execMs,
      };
    }),
});