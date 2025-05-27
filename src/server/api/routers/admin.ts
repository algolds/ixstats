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
      ['bot_sync_enabled', { value: 'true', description: 'Enable Discord bot time sync' }],
      ['bot_api_url', { value: 'http://localhost:3001', description: 'Discord bot API URL' }],
    ]);

    let createdNewConfig = false;
    for (const [key, defaultConfig] of defaultConfigsMap) {
      if (!configs.find(c => c.key === key)) {
        await ctx.db.systemConfig.create({ data: { key, ...defaultConfig } });
        createdNewConfig = true;
      }
    }
    
    if (createdNewConfig) {
      configs = await ctx.db.systemConfig.findMany();
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
        
        // Apply IxTime specific overrides via bot if possible
        if (config.key === 'time_multiplier') {
          const multiplier = parseFloat(config.value);
          if (multiplier === 0) {
            await IxTime.pauseBotTime();
          } else {
            await IxTime.setBotTimeOverride(undefined, multiplier);
          }
        }
        
        results.push(result);
      }
      return results;
    }),

  // New bot sync endpoints
  syncWithBot: publicProcedure.mutation(async () => {
    const syncResult = await IxTime.syncWithBot();
    return syncResult;
  }),

  getBotStatus: publicProcedure.query(async () => {
    const status = await IxTime.getStatus();
    const health = await IxTime.checkBotHealth();
    
    return {
      ...status,
      botHealth: health
    };
  }),

  setBotTimeOverride: publicProcedure
    .input(z.object({ 
      ixTime: z.number(),
      multiplier: z.number().optional()
    }))
    .mutation(async ({ input }) => {
      // Fixed: Ensure ixTime is always a number
      const result = await IxTime.setBotTimeOverride(input.ixTime, input.multiplier);
      if (result.success) {
        // Update local config to reflect the change
        return { success: true, newIxTime: IxTime.formatIxTime(input.ixTime, true) };
      } else {
        throw new Error(result.message);
      }
    }),

  clearBotOverrides: publicProcedure.mutation(async () => {
    const result = await IxTime.clearBotOverrides();
    if (result.success) {
      return { success: true, message: result.message };
    } else {
      throw new Error(result.message);
    }
  }),

  pauseBotTime: publicProcedure.mutation(async () => {
    const result = await IxTime.pauseBotTime();
    if (result.success) {
      return { success: true, message: result.message };
    } else {
      throw new Error(result.message);
    }
  }),

  resumeBotTime: publicProcedure.mutation(async () => {
    const result = await IxTime.resumeBotTime();
    if (result.success) {
      return { success: true, message: result.message };
    } else {
      throw new Error(result.message);
    }
  }),

  getCalculationLogs: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.calculationLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50
    });
  }),

  forceCalculation: publicProcedure.mutation(async ({ ctx }) => {
    const startTimeMs = Date.now();
    const currentIxTimeMs = await IxTime.getCurrentIxTimeFromBot(); // Use bot time
    
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
      const lastCalculatedIxTimeMs = country.lastCalculated.getTime();
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

        // Calculate densities if land area exists
        const landArea = country.landArea || 0;
        const newPopulationDensity = landArea > 0 ? result.population / landArea : null;
        const newGdpDensity = landArea > 0 ? result.totalGdp / landArea : null;

        await ctx.db.country.update({
          where: { id: country.id },
          data: {
            currentPopulation: result.population,
            currentGdpPerCapita: result.gdpPerCapita,
            currentTotalGdp: result.totalGdp,
            economicTier: newEconomicTier,
            populationTier: newPopulationTier,
            populationDensity: newPopulationDensity,
            gdpDensity: newGdpDensity,
            lastCalculated: new Date(currentIxTimeMs)
          }
        });

        await ctx.db.historicalData.create({
          data: {
            countryId: country.id,
            ixTimeTimestamp: new Date(currentIxTimeMs),
            population: result.population,
            gdpPerCapita: result.gdpPerCapita,
            totalGdp: result.totalGdp,
            populationGrowthRate: result.populationGrowthRate,
            gdpGrowthRate: result.gdpGrowthRate,
            landArea: country.landArea,
            populationDensity: newPopulationDensity,
            gdpDensity: newGdpDensity,
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
    
    return { 
      updated: updatedCount, 
      executionTime: executionTimeMs, 
      ixTime: currentIxTimeMs, 
      message: `Forced calculation completed for ${updatedCount} countries using bot time.` 
    };
  }),

  // Legacy endpoints (kept for backward compatibility, but prefer bot methods)
  setCurrentIxTime: publicProcedure
    .input(z.object({ ixTime: z.number() }))
    .mutation(async ({ input }) => {
      // Try to set via bot first
      const botResult = await IxTime.setBotTimeOverride(input.ixTime);
      if (botResult.success) {
        return { success: true, newIxTime: IxTime.formatIxTime(input.ixTime, true), source: 'bot' };
      } else {
        // Fall back to local override
        IxTime.setTimeOverride(input.ixTime);
        return { success: true, newIxTime: IxTime.formatIxTime(input.ixTime, true), source: 'local', warning: botResult.message };
      }
    }),

  resetIxTime: publicProcedure.mutation(async () => {
    // Try to clear bot overrides first
    const botResult = await IxTime.clearBotOverrides();
    
    // Also clear local overrides
    IxTime.clearTimeOverride();
    IxTime.clearMultiplierOverride();
    
    if (botResult.success) {
      return { success: true, message: "IxTime overrides cleared on bot and locally. Resuming normal flow.", source: 'bot' };
    } else {
      return { success: true, message: "Local IxTime overrides cleared. Bot override clear failed - check bot connection.", source: 'local', warning: botResult.message };
    }
  }),

  getSystemStatus: publicProcedure.query(async ({ ctx }) => {
    const countryCount = await ctx.db.country.count();
    const activeDmInputs = await ctx.db.dmInput.count({ where: { isActive: true } });
    const lastCalculation = await ctx.db.calculationLog.findFirst({ orderBy: { timestamp: 'desc' } });
    
    const ixtimeStatus = await IxTime.getStatus();

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
    // Try to pause via bot first
    const botResult = await IxTime.pauseBotTime();
    
    // Also set local multiplier to 0 as fallback
    IxTime.setMultiplierOverride(0);
    
    // Persist this to DB
    await ctx.db.systemConfig.upsert({
      where: { key: 'time_multiplier' },
      update: { value: '0', updatedAt: new Date() },
      create: { key: 'time_multiplier', value: '0', description: 'IxTime speed multiplier (0 = PAUSED)'}
    });
    
    if (botResult.success) {
      return { success: true, message: "System paused via bot and locally. Time multiplier set to 0.", source: 'bot' };
    } else {
      return { success: true, message: "System paused locally. Bot pause failed - check bot connection.", source: 'local', warning: botResult.message };
    }
  }),

  resumeOperations: publicProcedure.mutation(async ({ ctx }) => {
    // Try to resume via bot first
    const botResult = await IxTime.resumeBotTime();
    
    // Clear local overrides
    IxTime.clearMultiplierOverride();
    
    // Get default multiplier from config or use 4.0
    const defaultConfig = await ctx.db.systemConfig.findFirst({where: {key: 'time_multiplier_default'}});
    const defaultMultiplier = defaultConfig?.value ?? '4.0';

    await ctx.db.systemConfig.upsert({
      where: { key: 'time_multiplier' },
      update: { value: defaultMultiplier, updatedAt: new Date() },
      create: { key: 'time_multiplier', value: defaultMultiplier, description: 'IxTime speed multiplier' }
    });
    
    if (botResult.success) {
      return { success: true, message: `System resumed normal operations via bot and locally. Time multiplier reset to ${defaultMultiplier}.`, source: 'bot' };
    } else {
      return { success: true, message: `System resumed locally. Bot resume failed - check bot connection. Multiplier set to ${defaultMultiplier}.`, source: 'local', warning: botResult.message };
    }
  }),
});