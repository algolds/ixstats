// src/server/api/routers/admin.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { IxSheetzCalculator } from "~/lib/enhanced-calculations";
import type { EconomicTier, PopulationTier } from "~/types/ixstats";

// Helper function for tier calculation (consistent with types)
function determineEconomicTier(gdpPerCapita: number): EconomicTier {
    if (gdpPerCapita >= 50000) return "Advanced" as EconomicTier.ADVANCED;
    if (gdpPerCapita >= 35000) return "Developed" as EconomicTier.DEVELOPED;
    if (gdpPerCapita >= 15000) return "Emerging" as EconomicTier.EMERGING;
    return "Developing" as EconomicTier.DEVELOPING;
}

function determinePopulationTier(population: number): PopulationTier {
    if (population >= 200000000) return "Massive" as PopulationTier.MASSIVE;
    if (population >= 50000000) return "Large" as PopulationTier.LARGE;
    if (population >= 10000000) return "Medium" as PopulationTier.MEDIUM;
    if (population >= 1000000) return "Small" as PopulationTier.SMALL;
    return "Micro" as PopulationTier.MICRO;
}

export const adminRouter = createTRPCRouter({
  getSystemConfig: publicProcedure.query(async ({ ctx }) => {
    let configs = await ctx.db.systemConfig.findMany();
    
    const defaultConfigsMap = new Map([
      ['time_multiplier', { value: '4.0', description: 'IxTime speed multiplier' }],
      ['global_growth_factor', { value: '1.0321', description: 'Global economic growth factor' }],
      ['auto_update', { value: 'true', description: 'Enable automatic calculations' }],
      // Add ixtime_override if it's managed here, though IxTime class handles it internally now
    ]);

    let createdNewConfig = false;
    for (const [key, defaultConfig] of defaultConfigsMap) {
      if (!configs.find(c => c.key === key)) {
        await ctx.db.systemConfig.create({ data: { key, ...defaultConfig } });
        createdNewConfig = true;
      }
    }
    
    if (createdNewConfig) {
      configs = await ctx.db.systemConfig.findMany(); // Refetch if new configs were added
    }
    return configs;
  }),

  updateSystemConfig: publicProcedure
    .input(z.object({
      configs: z.array(z.object({
        key: z.string(),
        value: z.string(),
        description: z.string().optional(),
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      const results = [];
      for (const config of input.configs) {
        const result = await ctx.db.systemConfig.upsert({
          where: { key: config.key },
          update: { value: config.value, description: config.description, updatedAt: new Date() },
          create: { key: config.key, value: config.value, description: config.description || `System config for ${config.key}` }
        });
        
        // Apply IxTime specific overrides if changed
        if (config.key === 'time_multiplier') {
          IxTime.setMultiplierOverride(parseFloat(config.value));
        }
        // If 'ixtime_override' is managed via DB:
        // if (config.key === 'ixtime_override' && config.value) {
        //   IxTime.setTimeOverride(parseFloat(config.value));
        // } else if (config.key === 'ixtime_override' && !config.value) {
        //   IxTime.clearTimeOverride();
        // }
        results.push(result);
      }
      return results;
    }),

  getCalculationLogs: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.calculationLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50
    });
  }),

  forceCalculation: publicProcedure.mutation(async ({ ctx }) => {
    const startTimeMs = Date.now(); // Real-world start time
    const currentIxTimeMs = IxTime.getCurrentIxTime(); // Current IxTime
    
    const countries = await ctx.db.country.findMany({
      include: { dmInputs: { where: { isActive: true } } }
    });
    
    const calculator = new IxSheetzCalculator();
    let updatedCount = 0;
    
    const globalGrowthConfig = await ctx.db.systemConfig.findUnique({
      where: { key: 'global_growth_factor' }
    });
    const globalGrowthFactor = parseFloat(globalGrowthConfig?.value || "1.0321");
    
    for (const country of countries) {
      // country.lastCalculated is a Date object. Convert to IxTime ms for comparison
      const lastCalculatedIxTimeMs = country.lastCalculated.getTime(); // Assuming this IS an IxTime epoch value
      const timeElapsed = IxTime.getYearsElapsed(lastCalculatedIxTimeMs, currentIxTimeMs);
      
      if (timeElapsed > 0) {
        const growthParams = {
          basePopulation: country.currentPopulation,
          baseGdpPerCapita: country.currentGdpPerCapita,
          populationGrowthRate: country.populationGrowthRate,
          gdpGrowthRate: country.adjustedGdpGrowth,
          maxGdpGrowthRate: country.maxGdpGrowthRate,
          economicTier: country.economicTier,
          populationTier: country.populationTier,
          globalGrowthFactor,
          localGrowthFactor: country.localGrowthFactor,
          timeElapsed,
        };

        const result = calculator.calculateEnhancedGrowth(growthParams);
        const newEconomicTier = determineEconomicTier(result.gdpPerCapita);
        const newPopulationTier = determinePopulationTier(result.population);

        await ctx.db.country.update({
          where: { id: country.id },
          data: {
            currentPopulation: result.population,
            currentGdpPerCapita: result.gdpPerCapita,
            currentTotalGdp: result.totalGdp,
            economicTier: newEconomicTier,
            populationTier: newPopulationTier,
            lastCalculated: new Date(currentIxTimeMs) // Store as Date object
          }
        });

        await ctx.db.historicalData.create({
          data: {
            countryId: country.id,
            ixTimeTimestamp: new Date(currentIxTimeMs), // Store as Date object
            population: result.population,
            gdpPerCapita: result.gdpPerCapita,
            totalGdp: result.totalGdp,
            populationGrowthRate: result.populationGrowthRate,
            gdpGrowthRate: result.gdpGrowthRate
          }
        });
        updatedCount++;
      }
    }
    
    const executionTimeMs = Date.now() - startTimeMs;
    
    await ctx.db.calculationLog.create({
      data: {
        ixTimeTimestamp: new Date(currentIxTimeMs),
        countriesUpdated: updatedCount,
        executionTimeMs: executionTimeMs,
        globalGrowthFactor,
      }
    });
    
    return { updated: updatedCount, executionTime: executionTimeMs, ixTime: currentIxTimeMs, message: `Forced calculation completed for ${updatedCount} countries.` };
  }),

  setCurrentIxTime: publicProcedure
    .input(z.object({ ixTime: z.number() })) // Expecting IxTime timestamp
    .mutation(async ({ input }) => {
      IxTime.setTimeOverride(input.ixTime);
      // Optionally, persist this to DB if needed for recovery or distributed systems
      // await ctx.db.systemConfig.upsert({ where: {key: 'ixtime_override'}, update: {value: input.ixTime.toString()}, create: {key: 'ixtime_override', value: input.ixTime.toString()}})
      return { success: true, newIxTime: IxTime.formatIxTime(input.ixTime, true) };
    }),

  resetIxTime: publicProcedure.mutation(async () => {
    IxTime.clearTimeOverride();
    IxTime.clearMultiplierOverride(); // Also reset multiplier if it was part of an override scenario
     // Optionally, remove from DB if persisted
    // await ctx.db.systemConfig.deleteMany({ where: { key: 'ixtime_override' }});
    // await ctx.db.systemConfig.upsert({ where: {key: 'time_multiplier'}, update: {value: '4.0'}, create: {key: 'time_multiplier', value: '4.0'}}) // Reset multiplier to default
    return { success: true, message: "IxTime override cleared. Resuming normal flow." };
  }),

  getSystemStatus: publicProcedure.query(async ({ ctx }) => {
    const countryCount = await ctx.db.country.count();
    const activeDmInputs = await ctx.db.dmInput.count({ where: { isActive: true } });
    const lastCalculation = await ctx.db.calculationLog.findFirst({ orderBy: { timestamp: 'desc' } });
    
    const ixtimeStatus = IxTime.getStatus(); // Get status directly from IxTime class

    return {
      ixTime: ixtimeStatus,
      countryCount,
      activeDmInputs,
      lastCalculation: lastCalculation ? {
        timestamp: lastCalculation.timestamp.toISOString(),
        ixTimeTimestamp: lastCalculation.ixTimeTimestamp.toISOString(),
        countriesUpdated: lastCalculation.countriesUpdated,
        executionTimeMs: lastCalculation.executionTimeMs,
      } : null,
    };
  }),

  emergencyStop: publicProcedure.mutation(async ({ ctx }) => {
    IxTime.setMultiplierOverride(0); // Pause IxTime progression
    // Persist this to DB
    await ctx.db.systemConfig.upsert({
      where: { key: 'time_multiplier' },
      update: { value: '0', updatedAt: new Date() },
      create: { key: 'time_multiplier', value: '0', description: 'IxTime speed multiplier (0 = PAUSED)'}
    });
    return { success: true, message: "System paused via emergency stop. Time multiplier set to 0." };
  }),

  resumeOperations: publicProcedure.mutation(async ({ ctx }) => {
    IxTime.clearMultiplierOverride(); // Resume normal multiplier
    // Persist this to DB
    const defaultConfig = await ctx.db.systemConfig.findFirst({where: {key: 'time_multiplier_default'}}); // Assuming a default stored
    const defaultMultiplier = defaultConfig?.value ?? '4.0';

    await ctx.db.systemConfig.upsert({
      where: { key: 'time_multiplier' },
      update: { value: defaultMultiplier, updatedAt: new Date() },
      create: { key: 'time_multiplier', value: defaultMultiplier, description: 'IxTime speed multiplier' }
    });
    return { success: true, message: `System resumed normal operations. Time multiplier reset to ${defaultMultiplier}.` };
  }),
});