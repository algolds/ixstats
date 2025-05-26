// server/api/routers/countries.ts
// tRPC router for country operations

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxStatsDataService } from "~/lib/data-service";
import { IxTime } from "~/lib/ixtime";
import type { CountryStats, DmInputs } from "~/types/ixstats";

const countryInputSchema = z.object({
  name: z.string().min(1),
  baselinePopulation: z.number().positive(),
  baselineGdpPerCapita: z.number().positive(),
  maxGdpGrowthRate: z.number().min(0).max(1),
  adjustedGdpGrowth: z.number(),
  populationGrowthRate: z.number().min(-0.1).max(0.2),
  projected2040Population: z.number().positive(),
  projected2040Gdp: z.number().positive(),
  projected2040GdpPerCapita: z.number().positive(),
  actualGdpGrowth: z.number()
});

const dmInputSchema = z.object({
  countryId: z.string().optional(),
  inputType: z.enum([
    "population_adjustment",
    "gdp_adjustment", 
    "growth_rate_modifier",
    "special_event",
    "trade_agreement",
    "natural_disaster",
    "economic_policy"
  ]),
  value: z.number(),
  description: z.string().optional(),
  duration: z.number().positive().optional()
});

export const countriesRouter = createTRPCRouter({
  // Get all countries with current stats
  getAll: publicProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany({
      include: {
        historicalData: {
          orderBy: { ixTimeTimestamp: 'desc' },
          take: 1
        },
        dmInputs: {
          where: { isActive: true },
          orderBy: { ixTimeTimestamp: 'desc' }
        }
      }
    });

    return countries;
  }),

  // Get single country with full historical data
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          historicalData: {
            orderBy: { ixTimeTimestamp: 'desc' },
            take: 100 // Last 100 data points
          },
          dmInputs: {
            orderBy: { ixTimeTimestamp: 'desc' }
          }
        }
      });

      return country;
    }),

  // Add new country
  create: publicProcedure
    .input(countryInputSchema)
    .mutation(async ({ ctx, input }) => {
      const currentIxTime = IxTime.getCurrentIxTime();
      
      const country = await ctx.db.country.create({
        data: {
          name: input.name,
          baselinePopulation: input.baselinePopulation,
          baselineGdpPerCapita: input.baselineGdpPerCapita,
          maxGdpGrowthRate: input.maxGdpGrowthRate,
          adjustedGdpGrowth: input.adjustedGdpGrowth,
          populationGrowthRate: input.populationGrowthRate,
          projected2040Population: input.projected2040Population,
          projected2040Gdp: input.projected2040Gdp,
          projected2040GdpPerCapita: input.projected2040GdpPerCapita,
          actualGdpGrowth: input.actualGdpGrowth,
          
          // Initialize current values to baseline
          currentPopulation: input.baselinePopulation,
          currentGdpPerCapita: input.baselineGdpPerCapita,
          currentTotalGdp: input.baselinePopulation * input.baselineGdpPerCapita,
          
          lastCalculated: new Date(currentIxTime),
          baselineDate: new Date(currentIxTime),
          economicTier: "Developing", // Will be calculated
          populationTier: "Small", // Will be calculated
        }
      });

      return country;
    }),

  // Update country stats (manual calculation trigger)
  updateStats: publicProcedure
    .input(z.object({ 
      countryId: z.string().optional(), // If not provided, update all
      targetTime: z.number().optional() // IxTime timestamp
    }))
    .mutation(async ({ ctx, input }) => {
      const dataService = new IxStatsDataService(
        IxStatsDataService.getDefaultConfig()
      );
      const calculator = dataService.getCalculator();
      
      const targetTime = input.targetTime || IxTime.getCurrentIxTime();
      
      if (input.countryId) {
        // Update single country
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: { dmInputs: { where: { isActive: true } } }
        });
        
        if (!country) {
          throw new Error("Country not found");
        }

        const currentStats: CountryStats = {
          country: country.name,
          population: country.baselinePopulation,
          gdpPerCapita: country.baselineGdpPerCapita,
          maxGdpGrowthRate: country.maxGdpGrowthRate,
          adjustedGdpGrowth: country.adjustedGdpGrowth,
          populationGrowthRate: country.populationGrowthRate,
          projected2040Population: country.projected2040Population,
          projected2040Gdp: country.projected2040Gdp,
          projected2040GdpPerCapita: country.projected2040GdpPerCapita,
          actualGdpGrowth: country.actualGdpGrowth,
          totalGdp: country.currentTotalGdp,
          currentPopulation: country.currentPopulation,
          currentGdpPerCapita: country.currentGdpPerCapita,
          currentTotalGdp: country.currentTotalGdp,
          lastCalculated: country.lastCalculated.getTime(),
          baselineDate: country.baselineDate.getTime(),
          economicTier: country.economicTier as any,
          populationTier: country.populationTier as any,
          localGrowthFactor: country.localGrowthFactor,
          globalGrowthFactor: 1.0321
        };

        const dmInputs: DmInputs[] = country.dmInputs.map((input: any) => ({
          countryName: country.name,
          ixTimeTimestamp: input.ixTimeTimestamp.getTime(),
          inputType: input.inputType as any,
          value: input.value,
          description: input.description || undefined,
          duration: input.duration || undefined
        }));

        const result = calculator.calculateTimeProgression(currentStats, targetTime, dmInputs);
        
        // Update database
        await ctx.db.country.update({
          where: { id: input.countryId },
          data: {
            currentPopulation: result.newStats.currentPopulation,
            currentGdpPerCapita: result.newStats.currentGdpPerCapita,
            currentTotalGdp: result.newStats.currentTotalGdp,
            economicTier: result.newStats.economicTier,
            populationTier: result.newStats.populationTier,
            lastCalculated: new Date(targetTime)
          }
        });

        // Add historical data point
        await ctx.db.historicalData.create({
          data: {
            countryId: input.countryId,
            ixTimeTimestamp: new Date(targetTime),
            population: result.newStats.currentPopulation,
            gdpPerCapita: result.newStats.currentGdpPerCapita,
            totalGdp: result.newStats.currentTotalGdp,
            populationGrowthRate: result.newStats.populationGrowthRate,
            gdpGrowthRate: result.newStats.adjustedGdpGrowth
          }
        });

        return result;
      } else {
        // Update all countries
        const countries = await ctx.db.country.findMany({
          include: { dmInputs: { where: { isActive: true } } }
        });
        
        const results: any[] = [];
        for (const country of countries) {
          // Similar logic as above for each country
          // ... (implementation would be similar to single country update)
        }
        
        return results;
      }
    }),

  // Add DM input
  addDmInput: publicProcedure
    .input(dmInputSchema.extend({ countryId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const currentIxTime = IxTime.getCurrentIxTime();
      
      const dmInput = await ctx.db.dmInput.create({
        data: {
          countryId: input.countryId,
          ixTimeTimestamp: new Date(currentIxTime),
          inputType: input.inputType,
          value: input.value,
          description: input.description,
          duration: input.duration,
          isActive: true
        }
      });

      return dmInput;
    }),

  // Get global statistics
  getGlobalStats: publicProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany();
    
    const totalPopulation = countries.reduce((sum: number, c: any) => sum + c.currentPopulation, 0);
    const totalGdp = countries.reduce((sum: number, c: any) => sum + c.currentTotalGdp, 0);
    const avgGdpPerCapita = totalGdp / totalPopulation;
    
    const economicTierCounts = countries.reduce((acc: Record<string, number>, c: any) => {
      acc[c.economicTier] = (acc[c.economicTier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPopulation,
      totalGdp,
      avgGdpPerCapita,
      countryCount: countries.length,
      economicTierDistribution: economicTierCounts,
      lastUpdated: IxTime.getCurrentIxTime()
    };
  }),

  // Import from Excel file
  importFromExcel: publicProcedure
    .input(z.object({ 
      fileData: z.string(), // Base64 encoded file data
      replaceExisting: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileData, 'base64');
      
      const dataService = new IxStatsDataService(
        IxStatsDataService.getDefaultConfig()
      );
      
      const baseData = await dataService.parseRosterFile(buffer);
      const initializedCountries = dataService.initializeCountries(baseData);
      
      if (input.replaceExisting) {
        await ctx.db.country.deleteMany();
      }
      
      const results = [];
      for (const countryStats of initializedCountries) {
        const existing = await ctx.db.country.findUnique({
          where: { name: countryStats.country }
        });
        
        if (!existing) {
          const country = await ctx.db.country.create({
            data: {
              name: countryStats.country,
              baselinePopulation: countryStats.population,
              baselineGdpPerCapita: countryStats.gdpPerCapita,
              maxGdpGrowthRate: countryStats.maxGdpGrowthRate,
              adjustedGdpGrowth: countryStats.adjustedGdpGrowth,
              populationGrowthRate: countryStats.populationGrowthRate,
              projected2040Population: countryStats.projected2040Population,
              projected2040Gdp: countryStats.projected2040Gdp,
              projected2040GdpPerCapita: countryStats.projected2040GdpPerCapita,
              actualGdpGrowth: countryStats.actualGdpGrowth,
              currentPopulation: countryStats.currentPopulation,
              currentGdpPerCapita: countryStats.currentGdpPerCapita,
              currentTotalGdp: countryStats.currentTotalGdp,
              lastCalculated: new Date(countryStats.lastCalculated),
              baselineDate: new Date(countryStats.baselineDate),
              economicTier: countryStats.economicTier,
              populationTier: countryStats.populationTier
            }
          });
          results.push(country);
        }
      }
      
      return {
        imported: results.length,
        total: initializedCountries.length,
        countries: results
      };
    })
});