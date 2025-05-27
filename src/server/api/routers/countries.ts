// src/server/api/routers/countries.ts
// src/server/api/routers/countries.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxStatsDataService } from "~/lib/data-service";
import { IxTime } from "~/lib/ixtime";
import { IxSheetzCalculator } from "~/lib/enhanced-calculations";
import type { EconomicTier, PopulationTier, DmInputType as DmInputTypeEnum, GlobalEconomicSnapshot } from "~/types/ixstats"; // For stricter typing

const countryInputSchema = z.object({
  name: z.string().min(1),
  baselinePopulation: z.number().positive(),
  baselineGdpPerCapita: z.number().positive(),
  maxGdpGrowthRate: z.number().min(0).max(1),
  adjustedGdpGrowth: z.number(),
  populationGrowthRate: z.number().min(-0.1).max(0.2),
  projected2040Population: z.number().positive().optional(), // Made optional, can be calculated
  projected2040Gdp: z.number().positive().optional(), // Made optional
  projected2040GdpPerCapita: z.number().positive().optional(), // Made optional
  actualGdpGrowth: z.number().optional(), // Made optional
  landArea: z.number().positive().optional(), // Added Land Area
});

const dmInputTypeValues = [
    "population_adjustment",
    "gdp_adjustment",
    "growth_rate_modifier",
    "special_event",
    "trade_agreement",
    "natural_disaster",
    "economic_policy"
] as const;


const dmInputSchema = z.object({
  countryId: z.string().optional(),
  // Using the enum values directly for Zod validation
  inputType: z.enum(dmInputTypeValues),
  value: z.number(),
  description: z.string().optional(),
  duration: z.number().positive().optional()
});

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


export const countriesRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.country.findMany({
      include: {
        historicalData: {
          orderBy: { ixTimeTimestamp: 'desc' },
          take: 1
        },
        dmInputs: {
          where: { isActive: true },
          orderBy: { ixTimeTimestamp: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          historicalData: {
            orderBy: { ixTimeTimestamp: 'asc' }, // Keep chronological for charts
            // take: 100 // Consider pagination if this list gets very long
          },
          dmInputs: {
            orderBy: { ixTimeTimestamp: 'desc' }
          }
        }
      });
    }),

  create: publicProcedure
    .input(countryInputSchema)
    .mutation(async ({ ctx, input }) => {
      const currentIxTimeMs = IxTime.getCurrentIxTime();
      const baselineDate = new Date(currentIxTimeMs); // Store as Date object

      // Default projections if not provided
      const baselineYear = new Date(currentIxTimeMs).getUTCFullYear();
      const yearsTo2040 = 2040 - baselineYear;

      const projected2040Population = input.projected2040Population ?? 
        input.baselinePopulation * Math.pow(1 + input.populationGrowthRate, yearsTo2040);
      
      const projected2040GdpPerCapita = input.projected2040GdpPerCapita ??
        input.baselineGdpPerCapita * Math.pow(1 + input.adjustedGdpGrowth, yearsTo2040);

      const projected2040Gdp = input.projected2040Gdp ??
        projected2040Population * projected2040GdpPerCapita;
        
      const actualGdpGrowth = input.actualGdpGrowth ?? input.populationGrowthRate + input.adjustedGdpGrowth;
      
      const landArea = input.landArea || 0;
      const populationDensity = landArea > 0 ? input.baselinePopulation / landArea : undefined;
      const gdpDensity = landArea > 0 ? (input.baselinePopulation * input.baselineGdpPerCapita) / landArea : undefined;


      const country = await ctx.db.country.create({
        data: {
          name: input.name,
          baselinePopulation: input.baselinePopulation,
          baselineGdpPerCapita: input.baselineGdpPerCapita,
          maxGdpGrowthRate: input.maxGdpGrowthRate,
          adjustedGdpGrowth: input.adjustedGdpGrowth,
          populationGrowthRate: input.populationGrowthRate,
          projected2040Population,
          projected2040Gdp,
          projected2040GdpPerCapita,
          actualGdpGrowth,
          landArea: input.landArea,
          
          currentPopulation: input.baselinePopulation,
          currentGdpPerCapita: input.baselineGdpPerCapita,
          currentTotalGdp: input.baselinePopulation * input.baselineGdpPerCapita,
          populationDensity,
          gdpDensity,
          
          lastCalculated: baselineDate,
          baselineDate: baselineDate,
          economicTier: determineEconomicTier(input.baselineGdpPerCapita),
          populationTier: determinePopulationTier(input.baselinePopulation),
          localGrowthFactor: 1.0, // Default local growth factor
        }
      });
      return country;
    }),

  updateStats: publicProcedure
    .input(z.object({ 
      countryId: z.string().optional(),
      targetTime: z.number().optional() // Expecting an IxTime timestamp
    }))
    .mutation(async ({ ctx, input }) => {
      const calculator = new IxSheetzCalculator();
      // If targetTime is not provided, use current IxTime
      const targetIxTimeMs = input.targetTime || IxTime.getCurrentIxTime();
      
      const processCountryUpdate = async (country: any) => { // Consider defining a proper type for country with dmInputs
        // country.lastCalculated is a Date object, convert to IxTime ms for comparison
        const lastCalculatedIxTimeMs = country.lastCalculated.getTime(); // Assuming lastCalculated IS an IxTime epoch value
        const timeElapsed = IxTime.getYearsElapsed(lastCalculatedIxTimeMs, targetIxTimeMs);
        
        if (timeElapsed <= 0) {
          return null; // No update needed
        }

        const globalGrowthConfig = await ctx.db.systemConfig.findUnique({
          where: { key: 'global_growth_factor' }
        });
        const globalGrowthFactor = parseFloat(globalGrowthConfig?.value || "1.0321");

        const growthParams = {
          basePopulation: country.currentPopulation,
          baseGdpPerCapita: country.currentGdpPerCapita,
          populationGrowthRate: country.populationGrowthRate,
          gdpGrowthRate: country.adjustedGdpGrowth,
          maxGdpGrowthRate: country.maxGdpGrowthRate,
          economicTier: country.economicTier,
          populationTier: country.populationTier,
          globalGrowthFactor,
          localGrowthFactor: country.localGrowthFactor, // Ensure this field exists and is used
          timeElapsed,
        };

        const result = calculator.calculateEnhancedGrowth(growthParams);
        
        const newEconomicTier = determineEconomicTier(result.gdpPerCapita);
        const newPopulationTier = determinePopulationTier(result.population);
        const landArea = country.landArea || 0;
        const newPopulationDensity = landArea > 0 ? result.population / landArea : undefined;
        const newGdpDensity = landArea > 0 ? result.totalGdp / landArea : undefined;


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
            lastCalculated: new Date(targetIxTimeMs) // Store as Date object
          }
        });

        await ctx.db.historicalData.create({
          data: {
            countryId: country.id,
            ixTimeTimestamp: new Date(targetIxTimeMs), // Store as Date object
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
        return { countryName: country.name, oldStats: { population: country.currentPopulation, gdpPerCapita: country.currentGdpPerCapita, totalGdp: country.currentTotalGdp }, newStats: result, timeElapsed, calculationDate: targetIxTimeMs };
      };

      if (input.countryId) {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: { dmInputs: { where: { isActive: true } } }
        });
        if (!country) throw new Error("Country not found");
        const updateResult = await processCountryUpdate(country);
        return updateResult || { message: "No time elapsed, no update needed for this country." };
      } else {
        const countries = await ctx.db.country.findMany({
          include: { dmInputs: { where: { isActive: true } } }
        });
        const results = (await Promise.all(countries.map(processCountryUpdate))).filter(r => r !== null);
        return { updated: results.length, results };
      }
    }),

  getForecast: publicProcedure
    .input(z.object({
        countryId: z.string(),
        targetTime: z.number(), // IxTime timestamp for the forecast end
    }))
    .query(async ({ ctx, input }) => {
        const country = await ctx.db.country.findUnique({
            where: { id: input.countryId },
        });
        if (!country) {
            throw new Error("Country not found for forecast");
        }

        const calculator = new IxSheetzCalculator();
        const lastCalculatedIxTimeMs = country.lastCalculated.getTime();
        const timeElapsed = IxTime.getYearsElapsed(lastCalculatedIxTimeMs, input.targetTime);

        if (timeElapsed <=0) {
            return { // Return current stats if target time is not in the future
                population: country.currentPopulation,
                gdpPerCapita: country.currentGdpPerCapita,
                totalGdp: country.currentTotalGdp,
                populationDensity: country.populationDensity,
                gdpDensity: country.gdpDensity,
                forecastDate: new Date(input.targetTime),
            };
        }
        
        const globalGrowthConfig = await ctx.db.systemConfig.findUnique({
            where: { key: 'global_growth_factor' }
        });
        const globalGrowthFactor = parseFloat(globalGrowthConfig?.value || "1.0321");

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
        const forecastResult = calculator.calculateEnhancedGrowth(growthParams);
        const landArea = country.landArea || 0;
        const populationDensity = landArea > 0 ? forecastResult.population / landArea : undefined;
        const gdpDensity = landArea > 0 ? forecastResult.totalGdp / landArea : undefined;
        
        return {
            ...forecastResult,
            populationDensity,
            gdpDensity,
            forecastDate: new Date(input.targetTime),
        };
    }),

  getDmInputs: publicProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.dmInput.findMany({
        where: {
          countryId: input.countryId || null, // Query for NULL if countryId is not provided
          isActive: true
        },
        orderBy: { ixTimeTimestamp: 'desc' }
      });
    }),

  addDmInput: publicProcedure
    .input(dmInputSchema) // countryId is already optional in dmInputSchema
    .mutation(async ({ ctx, input }) => {
      const currentIxTimeMs = IxTime.getCurrentIxTime();
      return ctx.db.dmInput.create({
        data: {
          countryId: input.countryId, // Pass as is (undefined or string)
          ixTimeTimestamp: new Date(currentIxTimeMs),
          inputType: input.inputType,
          value: input.value,
          description: input.description,
          duration: input.duration,
          isActive: true
        }
      });
    }),

  updateDmInput: publicProcedure
    .input(z.object({
      id: z.string(),
      inputType: z.enum(dmInputTypeValues),
      value: z.number(),
      description: z.string().optional(),
      duration: z.number().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.dmInput.update({
        where: { id: input.id },
        data: {
          inputType: input.inputType,
          value: input.value,
          description: input.description,
          duration: input.duration,
        }
      });
    }),

  deleteDmInput: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.dmInput.update({
        where: { id: input.id },
        data: { isActive: false } // Soft delete
      });
    }),

  getGlobalStats: publicProcedure.query(async ({ ctx }): Promise<GlobalEconomicSnapshot> => {
    const countries = await ctx.db.country.findMany();
    if (countries.length === 0) {
      return { 
        totalPopulation: 0, 
        totalGdp: 0, 
        averageGdpPerCapita: 0, 
        countryCount: 0, 
        economicTierDistribution: {} as Record<EconomicTier, number>,
        populationTierDistribution: {} as Record<PopulationTier, number>,
        averagePopulationDensity: 0,
        averageGdpDensity: 0,
        globalGrowthRate: 0, // Default or fetch from config
        ixTimeTimestamp: IxTime.getCurrentIxTime() 
      };
    }
    const totalPopulation = countries.reduce((sum, c) => sum + c.currentPopulation, 0);
    const totalGdp = countries.reduce((sum, c) => sum + c.currentTotalGdp, 0);
    const totalLandArea = countries.reduce((sum, c) => sum + (c.landArea || 0), 0);
    
    const avgGdpPerCapita = totalPopulation > 0 ? totalGdp / totalPopulation : 0;
    const averagePopulationDensity = totalLandArea > 0 ? totalPopulation / totalLandArea : 0;
    const averageGdpDensity = totalLandArea > 0 ? totalGdp / totalLandArea : 0;

    const economicTierDistribution = countries.reduce((acc, c) => {
      const tier = c.economicTier as EconomicTier;
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<EconomicTier, number>);

    const populationTierDistribution = countries.reduce((acc, c) => {
        const tier = c.populationTier as PopulationTier;
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      }, {} as Record<PopulationTier, number>);

    const globalGrowthConfig = await ctx.db.systemConfig.findUnique({
        where: { key: 'global_growth_factor' }
    });
    const globalGrowthRate = parseFloat(globalGrowthConfig?.value || "1.0321") -1; // as a rate, not factor


    return { 
        totalPopulation, 
        totalGdp, 
        averageGdpPerCapita, 
        countryCount: countries.length, 
        economicTierDistribution, 
        populationTierDistribution,
        averagePopulationDensity,
        averageGdpDensity,
        globalGrowthRate,
        ixTimeTimestamp: IxTime.getCurrentIxTime() 
    };
  }),

  importFromExcel: publicProcedure
    .input(z.object({ 
      fileData: z.string(), // Base64 encoded string
      replaceExisting: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const buffer = Buffer.from(input.fileData, 'base64');
        // XLSX.read expects ArrayBuffer or Uint8Array for 'buffer' type
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const dataService = new IxStatsDataService(IxStatsDataService.getDefaultConfig());
        const baseDataArray = await dataService.parseRosterFile(arrayBuffer); // Pass ArrayBuffer
        const initializedCountries = dataService.initializeCountries(baseDataArray);
        
        if (input.replaceExisting) {
          await ctx.db.historicalData.deleteMany({}); // Clear related historical data first
          await ctx.db.dmInput.deleteMany({}); // Clear related DM inputs
          await ctx.db.country.deleteMany({});
        }
        
        const results = [];
        for (const countryStats of initializedCountries) {
          const existingCountry = await ctx.db.country.findUnique({ where: { name: countryStats.country }});
          if (existingCountry && !input.replaceExisting) {
            // Skip if country exists and not replacing
            continue;
          }
          if(existingCountry && input.replaceExisting) {
            // If replacing, delete existing before creating anew to avoid unique constraint issues on `name`
            // Need to also delete related historical data and dm inputs specifically for this country
            await ctx.db.historicalData.deleteMany({ where: { countryId: existingCountry.id } });
            await ctx.db.dmInput.deleteMany({ where: { countryId: existingCountry.id } });
            await ctx.db.country.delete({ where: { id: existingCountry.id } });
          }

          const createdCountry = await ctx.db.country.create({
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
              landArea: countryStats.landArea, // Store land area
              currentPopulation: countryStats.currentPopulation,
              currentGdpPerCapita: countryStats.currentGdpPerCapita,
              currentTotalGdp: countryStats.currentTotalGdp,
              populationDensity: countryStats.populationDensity, // Store initial pop density
              gdpDensity: countryStats.gdpDensity, // Store initial gdp density
              lastCalculated: new Date(countryStats.lastCalculated),
              baselineDate: new Date(countryStats.baselineDate),
              economicTier: countryStats.economicTier as EconomicTier,
              populationTier: countryStats.populationTier as PopulationTier,
              localGrowthFactor: countryStats.localGrowthFactor,
            }
          });
          // Create initial historical data point
          await ctx.db.historicalData.create({
            data: {
                countryId: createdCountry.id,
                ixTimeTimestamp: new Date(countryStats.baselineDate),
                population: countryStats.currentPopulation,
                gdpPerCapita: countryStats.currentGdpPerCapita,
                totalGdp: countryStats.currentTotalGdp,
                populationGrowthRate: countryStats.populationGrowthRate,
                gdpGrowthRate: countryStats.adjustedGdpGrowth,
                landArea: countryStats.landArea,
                populationDensity: countryStats.populationDensity,
                gdpDensity: countryStats.gdpDensity,
            }
          });
          results.push(createdCountry);
        }
        return { imported: results.length, totalInFile: initializedCountries.length, countries: results.map(c => c.name) };
      } catch (error) {
        console.error('Import error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error during Excel import';
        // Consider re-throwing a tRPCError for better client-side error handling
        throw new Error(`Failed to import Excel file: ${message}`);
      }
    })
});