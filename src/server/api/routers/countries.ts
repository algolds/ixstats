// src/server/api/routers/countries.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxStatsDataService } from "~/lib/data-service";
import { IxTime } from "~/lib/ixtime";
import { IxSheetzCalculator } from "~/lib/enhanced-calculations";

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
            take: 100
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
          economicTier: "Developing",
          populationTier: "Small",
        }
      });

      return country;
    }),

  // Update country stats using enhanced calculations
  updateStats: publicProcedure
    .input(z.object({ 
      countryId: z.string().optional(),
      targetTime: z.number().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const calculator = new IxSheetzCalculator();
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

        const timeElapsed = IxTime.getYearsElapsed(country.lastCalculated.getTime(), targetTime);
        
        if (timeElapsed > 0) {
          // Get global growth factor
          const globalGrowthConfig = await ctx.db.systemConfig.findUnique({
            where: { key: 'global_growth_factor' }
          });
          const globalGrowthFactor = parseFloat(globalGrowthConfig?.value || "1.0321");

          // Calculate new stats using enhanced formula
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
          
          // Determine new tiers
          const newEconomicTier = result.gdpPerCapita >= 50000 ? "Advanced" :
                                 result.gdpPerCapita >= 35000 ? "Developed" :
                                 result.gdpPerCapita >= 15000 ? "Emerging" : "Developing";
          
          const newPopulationTier = result.population >= 200000000 ? "Massive" :
                                   result.population >= 50000000 ? "Large" :
                                   result.population >= 10000000 ? "Medium" :
                                   result.population >= 1000000 ? "Small" : "Micro";

          // Update database
          await ctx.db.country.update({
            where: { id: input.countryId },
            data: {
              currentPopulation: result.population,
              currentGdpPerCapita: result.gdpPerCapita,
              currentTotalGdp: result.totalGdp,
              economicTier: newEconomicTier,
              populationTier: newPopulationTier,
              lastCalculated: new Date(targetTime)
            }
          });

          // Add historical data point
          await ctx.db.historicalData.create({
            data: {
              countryId: input.countryId,
              ixTimeTimestamp: new Date(targetTime),
              population: result.population,
              gdpPerCapita: result.gdpPerCapita,
              totalGdp: result.totalGdp,
              populationGrowthRate: result.populationGrowthRate,
              gdpGrowthRate: result.gdpGrowthRate
            }
          });

          return {
            country: country.name,
            oldStats: {
              population: country.currentPopulation,
              gdpPerCapita: country.currentGdpPerCapita,
              totalGdp: country.currentTotalGdp,
            },
            newStats: result,
            timeElapsed,
            calculationDate: targetTime
          };
        }
        
        return { message: "No time elapsed, no update needed" };
      } else {
        // Update all countries
        const countries = await ctx.db.country.findMany({
          include: { dmInputs: { where: { isActive: true } } }
        });
        
        const globalGrowthConfig = await ctx.db.systemConfig.findUnique({
          where: { key: 'global_growth_factor' }
        });
        const globalGrowthFactor = parseFloat(globalGrowthConfig?.value || "1.0321");
        
        const results = [];
        for (const country of countries) {
          const timeElapsed = IxTime.getYearsElapsed(country.lastCalculated.getTime(), targetTime);
          
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
                lastCalculated: new Date(targetTime)
              }
            });

            await ctx.db.historicalData.create({
              data: {
                countryId: country.id,
                ixTimeTimestamp: new Date(targetTime),
                population: result.population,
                gdpPerCapita: result.gdpPerCapita,
                totalGdp: result.totalGdp,
                populationGrowthRate: result.populationGrowthRate,
                gdpGrowthRate: result.gdpGrowthRate
              }
            });

            results.push({
              country: country.name,
              result,
              timeElapsed
            });
          }
        }
        
        return { updated: results.length, results };
      }
    }),

  // DM Input Management
  getDmInputs: publicProcedure
    .input(z.object({ 
      countryId: z.string().optional() 
    }))
    .query(async ({ ctx, input }) => {
      const dmInputs = await ctx.db.dmInput.findMany({
        where: {
          countryId: input.countryId || null,
          isActive: true
        },
        orderBy: { ixTimeTimestamp: 'desc' }
      });
      
      return dmInputs;
    }),

  addDmInput: publicProcedure
    .input(dmInputSchema)
    .mutation(async ({ ctx, input }) => {
      const currentIxTime = IxTime.getCurrentIxTime();
      
      const dmInput = await ctx.db.dmInput.create({
        data: {
          countryId: input.countryId || null,
          ixTimeTimestamp: new Date(currentIxTime),
          inputType: input.inputType,
          value: input.value,
          description: input.description || null,
          duration: input.duration || null,
          isActive: true
        }
      });

      return dmInput;
    }),

  updateDmInput: publicProcedure
    .input(z.object({
      id: z.string(),
      inputType: z.string(),
      value: z.number(),
      description: z.string().optional(),
      duration: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dmInput = await ctx.db.dmInput.update({
        where: { id: input.id },
        data: {
          inputType: input.inputType,
          value: input.value,
          description: input.description || null,
          duration: input.duration || null,
        }
      });
      
      return dmInput;
    }),

  deleteDmInput: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dmInput = await ctx.db.dmInput.update({
        where: { id: input.id },
        data: { isActive: false }
      });
      
      return dmInput;
    }),

  // Get global statistics
  getGlobalStats: publicProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany();
    
    if (countries.length === 0) {
      return {
        totalPopulation: 0,
        totalGdp: 0,
        avgGdpPerCapita: 0,
        countryCount: 0,
        economicTierDistribution: {},
        lastUpdated: IxTime.getCurrentIxTime()
      };
    }
    
    const totalPopulation = countries.reduce((sum, c) => sum + c.currentPopulation, 0);
    const totalGdp = countries.reduce((sum, c) => sum + c.currentTotalGdp, 0);
    const avgGdpPerCapita = totalGdp / totalPopulation;
    
    const economicTierCounts = countries.reduce((acc, c) => {
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
      fileData: z.string(),
      replaceExisting: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
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
      } catch (error) {
        console.error('Import error:', error);
        throw new Error(`Failed to import Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })
});