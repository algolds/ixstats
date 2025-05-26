// src/server/api/routers/admin.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { IxSheetzCalculator } from "~/lib/enhanced-calculations";

export const adminRouter = createTRPCRouter({
  // Get system configuration
  getSystemConfig: publicProcedure.query(async ({ ctx }) => {
    const configs = await ctx.db.systemConfig.findMany();
    
    // Ensure default configs exist
    const defaultConfigs = [
      { key: 'time_multiplier', value: '4.0', description: 'IxTime speed multiplier' },
      { key: 'global_growth_factor', value: '1.0321', description: 'Global economic growth factor' },
      { key: 'auto_update', value: 'true', description: 'Enable automatic calculations' },
    ];
    
    for (const defaultConfig of defaultConfigs) {
      const existing = configs.find(c => c.key === defaultConfig.key);
      if (!existing) {
        await ctx.db.systemConfig.create({
          data: defaultConfig
        });
      }
    }
    
    // Return fresh config
    return await ctx.db.systemConfig.findMany();
  }),

  // Update system configuration
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
          update: { 
            value: config.value,
            description: config.description,
            updatedAt: new Date()
          },
          create: {
            key: config.key,
            value: config.value,
            description: config.description || `System configuration for ${config.key}`,
          }
        });
        
        results.push(result);
      }
      
      return results;
    }),

  // Get calculation logs
  getCalculationLogs: publicProcedure.query(async ({ ctx }) => {
    const logs = await ctx.db.calculationLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50
    });
    return logs;
  }),

  // Force calculation update for all countries
  forceCalculation: publicProcedure.mutation(async ({ ctx }) => {
    const startTime = Date.now();
    const currentIxTime = IxTime.getCurrentIxTime();
    
    // Get all countries and update them
    const countries = await ctx.db.country.findMany({
      include: { dmInputs: { where: { isActive: true } } }
    });
    
    const calculator = new IxSheetzCalculator();
    let updatedCount = 0;
    
    // Get global growth factor
    const globalGrowthConfig = await ctx.db.systemConfig.findUnique({
      where: { key: 'global_growth_factor' }
    });
    const globalGrowthFactor = parseFloat(globalGrowthConfig?.value || "1.0321");
    
    for (const country of countries) {
      const timeElapsed = IxTime.getYearsElapsed(country.lastCalculated.getTime(), currentIxTime);
      
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
        
        const newEconomicTier = result.gdpPerCapita >= 50000 ? "Advanced" :
                               result.gdpPerCapita >= 35000 ? "Developed" :
                               result.gdpPerCapita >= 15000 ? "Emerging" : "Developing";
        
        const newPopulationTier = result.population >= 200000000 ? "Massive" :
                                 result.population >= 50000000 ? "Large" :
                                 result.population >= 10000000 ? "Medium" :
                                 result.population >= 1000000 ? "Small" : "Micro";

        await ctx.db.country.update({
          where: { id: country.id },
          data: {
            currentPopulation: result.population,
            currentGdpPerCapita: result.gdpPerCapita,
            currentTotalGdp: result.totalGdp,
            economicTier: newEconomicTier,
            populationTier: newPopulationTier,
            lastCalculated: new Date(currentIxTime)
          }
        });

        await ctx.db.historicalData.create({
          data: {
            countryId: country.id,
            ixTimeTimestamp: new Date(currentIxTime),
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
    
    const executionTime = Date.now() - startTime;
    
    // Log the calculation
    await ctx.db.calculationLog.create({
      data: {
        ixTimeTimestamp: new Date(currentIxTime),
        countriesUpdated: updatedCount,
        executionTimeMs: executionTime,
        globalGrowthFactor,
      }
    });
    
    return {
      updated: updatedCount,
      executionTime,
      ixTime: currentIxTime,
      timeElapsed: "Manual calculation"
    };
  }),

  // Set current IxTime (admin override)
  setCurrentIxTime: publicProcedure
    .input(z.object({
      ixTime: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      // Store the time override in system config
      await ctx.db.systemConfig.upsert({
        where: { key: 'ixtime_override' },
        update: { 
          value: input.ixTime.toString(),
          updatedAt: new Date()
        },
        create: {
          key: 'ixtime_override',
          value: input.ixTime.toString(),
          description: 'Admin override for current IxTime',
        }
      });
      
      return { success: true, ixTime: input.ixTime };
    }),

  // Reset IxTime to normal flow
  resetIxTime: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.db.systemConfig.deleteMany({
      where: { key: 'ixtime_override' }
    });
    
    return { success: true };
  }),

  // Get current system status
  getSystemStatus: publicProcedure.query(async ({ ctx }) => {
    const countryCount = await ctx.db.country.count();
    const activeDmInputs = await ctx.db.dmInput.count({
      where: { isActive: true }
    });
    
    const lastCalculation = await ctx.db.calculationLog.findFirst({
      orderBy: { timestamp: 'desc' }
    });
    
    return {
      ixTime: {
        currentTime: IxTime.getCurrentIxTime(),
        multiplier: 4.0, // Default multiplier
        isPaused: false,
        hasTimeOverride: false,
        hasMultiplierOverride: false,
      },
      countryCount,
      activeDmInputs,
      lastCalculation: lastCalculation ? {
        timestamp: lastCalculation.timestamp,
        ixTimeTimestamp: lastCalculation.ixTimeTimestamp,
        countriesUpdated: lastCalculation.countriesUpdated,
        executionTime: lastCalculation.executionTimeMs,
      } : null,
    };
  }),

  // Emergency stop (pause all calculations)
  emergencyStop: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.db.systemConfig.upsert({
      where: { key: 'time_multiplier' },
      update: { value: '0', updatedAt: new Date() },
      create: {
        key: 'time_multiplier',
        value: '0',
        description: 'Emergency stop - system paused',
      }
    });
    
    return { success: true, message: "System paused via emergency stop" };
  }),

  // Resume normal operations
  resumeOperations: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.db.systemConfig.upsert({
      where: { key: 'time_multiplier' },
      update: { value: '4.0', updatedAt: new Date() },
      create: {
        key: 'time_multiplier',
        value: '4.0',
        description: 'Normal IxTime operations',
      }
    });
    
    return { success: true, message: "System resumed normal operations" };
  }),
});