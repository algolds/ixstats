// src/server/api/routers/countries.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxStatsDataService } from "~/lib/data-service";
import { IxStatsCalculator } from "~/lib/calculations";
import { IxTime } from "~/lib/ixtime";
import { IxSheetzCalculator } from "~/lib/enhanced-calculations";
// Corrected: Import enums as values, others as types
import { EconomicTier, PopulationTier, DmInputType as DmInputTypeEnum } from "~/types/ixstats";
import type { GlobalEconomicSnapshot, CountryStats, BaseCountryData } from "~/types/ixstats";
import { type Country as PrismaCountry } from "@prisma/client"; // Import Prisma's Country type


const countryInputSchema = z.object({
  name: z.string().min(1),
  baselinePopulation: z.number().positive(),
  baselineGdpPerCapita: z.number().positive(),
  maxGdpGrowthRate: z.number().min(0).max(1),
  adjustedGdpGrowth: z.number(),
  populationGrowthRate: z.number().min(-0.1).max(0.2),
  projected2040Population: z.number().positive().optional(),
  projected2040Gdp: z.number().positive().optional(),
  projected2040GdpPerCapita: z.number().positive().optional(),
  actualGdpGrowth: z.number().optional(),
  landArea: z.number().positive().optional(),
  // Descriptive fields that might come from import but are not part of this specific schema for direct creation via this input.
  // They are handled in importFromExcel if the DB schema supports them.
  continent: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  governmentType: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  leader: z.string().optional().nullable(),
  areaSqMi: z.number().positive().optional().nullable(),
});

const dmInputTypeValues = [
    DmInputTypeEnum.POPULATION_ADJUSTMENT,
    DmInputTypeEnum.GDP_ADJUSTMENT,
    DmInputTypeEnum.GROWTH_RATE_MODIFIER,
    DmInputTypeEnum.SPECIAL_EVENT,
    DmInputTypeEnum.TRADE_AGREEMENT,
    DmInputTypeEnum.NATURAL_DISASTER,
    DmInputTypeEnum.ECONOMIC_POLICY
] as const;

const dmInputSchema = z.object({
  countryId: z.string().optional(),
  inputType: z.enum(dmInputTypeValues),
  value: z.number(),
  description: z.string().optional(),
  duration: z.number().positive().optional()
});

// Field labels for analysis, similar to ImportPreviewDialog
const fieldLabelsForAnalysis: Record<string, string> = {
  'country': 'Country Name',
  'continent': 'Continent',
  'region': 'Region',
  'governmentType': 'Government Type',
  'religion': 'Religion',
  'leader': 'Leader',
  'population': 'Population',
  'gdpPerCapita': 'GDP per Capita',
  'landArea': 'Land Area (km²)',
  'areaSqMi': 'Area (sq mi)',
  'maxGdpGrowthRate': 'Max GDP Growth Rate',
  'adjustedGdpGrowth': 'Adjusted GDP Growth',
  'populationGrowthRate': 'Population Growth Rate',
  'projected2040Population': '2040 Population',
  'projected2040Gdp': '2040 GDP',
  'projected2040GdpPerCapita': '2040 GDP p.c.',
  'actualGdpGrowth': 'Actual GDP Growth'
};


function determineEconomicTier(gdpPerCapita: number): EconomicTier {
    if (gdpPerCapita >= 50000) return EconomicTier.ADVANCED;
    if (gdpPerCapita >= 35000) return EconomicTier.DEVELOPED;
    if (gdpPerCapita >= 15000) return EconomicTier.EMERGING;
    return EconomicTier.DEVELOPING;
}
function determinePopulationTier(population: number): PopulationTier {
    if (population >= 200000000) return PopulationTier.MASSIVE;
    if (population >= 50000000) return PopulationTier.LARGE;
    if (population >= 10000000) return PopulationTier.MEDIUM;
    if (population >= 1000000) return PopulationTier.SMALL;
    return PopulationTier.MICRO;
}

async function getCurrentIxTime(ctx: any): Promise<number> {
  try {
    const botSyncConfig = await ctx.db.systemConfig.findUnique({
      where: { key: 'bot_sync_enabled' }
    });
    
    if (botSyncConfig?.value === 'true') {
      const botTime = await IxTime.getCurrentIxTimeFromBot();
      return botTime;
    } else {
      return IxTime.getCurrentIxTime();
    }
  } catch (error) {
    console.warn('[IxTime] Bot sync failed, using local time:', error);
    return IxTime.getCurrentIxTime();
  }
}

export const countriesRouter = createTRPCRouter({
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
      },
      orderBy: { name: 'asc' }
    });

    // Map PrismaCountry to a structure that might be expected by frontend (e.g., CountryStats like)
    // This ensures `name` and `country` fields are consistently available.
    return countries.map(country => ({
      ...country, // Spread all fields from the Prisma model
      name: country.name, // Explicitly ensure 'name' is present
      country: country.name, // Add 'country' for compatibility if used elsewhere
      // Ensure date fields are consistently numbers (timestamps) or strings (ISO) if needed by client
      lastCalculated: country.lastCalculated.getTime(),
      baselineDate: country.baselineDate.getTime(),
      // Cast enums if they are stored as strings
      economicTier: country.economicTier as EconomicTier,
      populationTier: country.populationTier as PopulationTier,
    }));
  }),

  getByIdAtTime: publicProcedure
    .input(z.object({
      id: z.string(),
      ixTime: z.number(), // Expecting IxTime timestamp
    }))
    .query(async ({ ctx, input }) => {
      const countryFromDb = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          historicalData: { // For chart population, could be limited further
            orderBy: { ixTimeTimestamp: 'desc' },
            take: 50 // Example: last 50 historical points for context
          },
          dmInputs: { // Active DM inputs relevant to the period
            where: { isActive: true }
            // Further filtering by time might be needed if DM inputs have start/end dates
          }
        }
      });

      if (!countryFromDb) {
        throw new Error("Country not found");
      }

      // Fetch system configuration for global growth factor
      const systemConfigs = await ctx.db.systemConfig.findMany();
      const globalGrowthFactor = parseFloat(
        systemConfigs.find(c => c.key === 'global_growth_factor')?.value || '1.0321'
      );

      const economicConfig = IxStatsDataService.getDefaultEconomicConfig();
      economicConfig.globalGrowthFactor = globalGrowthFactor;

      // Initialize calculator with the game's epoch as baseline reference
      const calculator = new IxStatsCalculator(economicConfig, IxTime.getInGameEpoch());

      // Prepare CountryStats object for calculation. This uses the DB's baseline data.
      const countryStatsForCalc: CountryStats = {
        id: countryFromDb.id,
        country: countryFromDb.name, // from BaseCountryData.country
        name: countryFromDb.name,    // Prisma model field
        
        // Descriptive fields from Prisma model (if they exist)
        continent: countryFromDb.continent,
        region: countryFromDb.region,
        governmentType: countryFromDb.governmentType,
        religion: countryFromDb.religion,
        leader: countryFromDb.leader,
        areaSqMi: countryFromDb.areaSqMi,

        // Baseline data from DB
        population: countryFromDb.baselinePopulation,
        gdpPerCapita: countryFromDb.baselineGdpPerCapita,
        maxGdpGrowthRate: countryFromDb.maxGdpGrowthRate,
        adjustedGdpGrowth: countryFromDb.adjustedGdpGrowth,
        populationGrowthRate: countryFromDb.populationGrowthRate,
        projected2040Population: countryFromDb.projected2040Population,
        projected2040Gdp: countryFromDb.projected2040Gdp,
        projected2040GdpPerCapita: countryFromDb.projected2040GdpPerCapita,
        actualGdpGrowth: countryFromDb.actualGdpGrowth,
        landArea: countryFromDb.landArea,
        
        // Total GDP from baseline
        totalGdp: countryFromDb.baselinePopulation * countryFromDb.baselineGdpPerCapita,
        
        // Current stats (will be overridden by calculation if targetTime is different from lastCalculated)
        currentPopulation: countryFromDb.currentPopulation,
        currentGdpPerCapita: countryFromDb.currentGdpPerCapita,
        currentTotalGdp: countryFromDb.currentTotalGdp,
        
        lastCalculated: countryFromDb.lastCalculated.getTime(), // Use timestamp
        baselineDate: countryFromDb.baselineDate.getTime(),   // Use timestamp
        
        economicTier: countryFromDb.economicTier as EconomicTier,
        populationTier: countryFromDb.populationTier as PopulationTier,
        localGrowthFactor: countryFromDb.localGrowthFactor,
        globalGrowthFactor: globalGrowthFactor, // Use fetched global factor
        
        populationDensity: countryFromDb.populationDensity,
        gdpDensity: countryFromDb.gdpDensity,
      };

      // Calculate stats for the target time
      const targetTimeStatsResult = calculator.calculateTimeProgression(
        countryStatsForCalc, // Pass the fully formed CountryStats object
        input.ixTime,
        countryFromDb.dmInputs.map(dm => ({ // Map DM inputs to the expected type
          id: dm.id,
          countryId: dm.countryId,
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime(),
          inputType: dm.inputType as DmInputTypeEnum, // Ensure this matches your enum
          value: dm.value,
          description: dm.description,
          duration: dm.duration,
          isActive: dm.isActive,
          createdBy: dm.createdBy,
        }))
      );
      
      // Map historical data for response
      const historicalDataForResponse = countryFromDb.historicalData.map(h => ({
        id: h.id,
        countryId: h.countryId,
        ixTimeTimestamp: h.ixTimeTimestamp.getTime(), // Send as timestamp
        formattedTime: IxTime.formatIxTime(h.ixTimeTimestamp.getTime()), // Optional: formatted string
        population: h.population,
        gdpPerCapita: h.gdpPerCapita,
        totalGdp: h.totalGdp,
        populationGrowthRate: h.populationGrowthRate,
        gdpGrowthRate: h.gdpGrowthRate,
        landArea: h.landArea,
        populationDensity: h.populationDensity,
        gdpDensity: h.gdpDensity,
      }));

      return {
        ...targetTimeStatsResult.newStats, // Spread the calculated new stats
        // Ensure dates are numbers (timestamps) or ISO strings as expected by client
        lastCalculated: targetTimeStatsResult.newStats.lastCalculated instanceof Date 
                        ? targetTimeStatsResult.newStats.lastCalculated.getTime() 
                        : targetTimeStatsResult.newStats.lastCalculated,
        baselineDate: targetTimeStatsResult.newStats.baselineDate instanceof Date
                        ? targetTimeStatsResult.newStats.baselineDate.getTime()
                        : targetTimeStatsResult.newStats.baselineDate,
        requestedTime: input.ixTime,
        formattedTime: IxTime.formatIxTime(input.ixTime, true),
        gameTimeDescription: calculator.getTimeDescription(input.ixTime), // Use calculator's method
        timeFromPresent: IxTime.getYearsElapsed(IxTime.getCurrentIxTime(), input.ixTime), // Or use a synced current time
        historicalData: historicalDataForResponse,
      };
    }),

  getTimeContext: publicProcedure
    .query(async ({ctx}) => { // Added ctx to potentially use bot-synced time
      const currentIxTime = await getCurrentIxTime(ctx); // Use helper to get potentially bot-synced time
      const gameEpoch = IxTime.getInGameEpoch();

      return {
        currentIxTime,
        formattedCurrentTime: IxTime.formatIxTime(currentIxTime, true),
        gameEpoch,
        formattedGameEpoch: IxTime.formatIxTime(gameEpoch, true),
        yearsSinceGameStart: IxTime.getYearsSinceGameEpoch(currentIxTime),
        currentGameYear: IxTime.getCurrentGameYear(currentIxTime),
        gameTimeDescription: IxTime.getGameTimeDescription(currentIxTime),
        timeMultiplier: IxTime.getTimeMultiplier(), // This might need to be fetched from bot/config
        isPaused: IxTime.isPaused(), // This might need to be fetched from bot/config
      };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          historicalData: {
            orderBy: { ixTimeTimestamp: 'asc' },
          },
          dmInputs: {
            orderBy: { ixTimeTimestamp: 'desc' }
          }
        }
      });

      if (!country) return null;

      return {
        ...country,
        name: country.name, 
        country: country.name,
      };
    }),

  create: publicProcedure
    .input(countryInputSchema)
    .mutation(async ({ ctx, input }) => {
      const currentIxTimeMs = await getCurrentIxTime(ctx);
      const baselineDate = new Date(currentIxTimeMs); // Use current IxTime as baseline for new entries

      const baselineYear = new Date(currentIxTimeMs).getUTCFullYear();
      const yearsTo2040 = 2040 - baselineYear;

      // Calculate projected values if not provided, based on current baseline
      const projected2040Population = input.projected2040Population ??
        input.baselinePopulation * Math.pow(1 + input.populationGrowthRate, yearsTo2040);

      const projected2040GdpPerCapita = input.projected2040GdpPerCapita ??
        input.baselineGdpPerCapita * Math.pow(1 + input.adjustedGdpGrowth, yearsTo2040);

      const projected2040Gdp = input.projected2040Gdp ??
        projected2040Population * projected2040GdpPerCapita;

      // Simplified actualGdpGrowth; more complex models could be used
      const actualGdpGrowth = input.actualGdpGrowth ?? 
        (1 + input.populationGrowthRate) * (1 + input.adjustedGdpGrowth) - 1;

      const landArea = input.landArea ?? 0; // Default to 0 if not provided
      const populationDensity = landArea > 0 ? input.baselinePopulation / landArea : undefined;
      const gdpDensityValue = landArea > 0 ? (input.baselinePopulation * input.baselineGdpPerCapita) / landArea : undefined;

      const countryDataForCreate = {
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
        landArea: input.landArea, // This is km²

        // Descriptive fields - only include if they are part of the Prisma schema
        // and present in the input.
        ...(input.continent && { continent: input.continent }),
        ...(input.region && { region: input.region }),
        ...(input.governmentType && { governmentType: input.governmentType }),
        ...(input.religion && { religion: input.religion }),
        ...(input.leader && { leader: input.leader }),
        ...(input.areaSqMi && { areaSqMi: input.areaSqMi }),


        currentPopulation: input.baselinePopulation,
        currentGdpPerCapita: input.baselineGdpPerCapita,
        currentTotalGdp: input.baselinePopulation * input.baselineGdpPerCapita,
        populationDensity,
        gdpDensity: gdpDensityValue,

        lastCalculated: baselineDate,
        baselineDate: baselineDate, // Set baseline to current creation time
        economicTier: determineEconomicTier(input.baselineGdpPerCapita),
        populationTier: determinePopulationTier(input.baselinePopulation),
        localGrowthFactor: 1.0, // Default local growth factor
      };
      
      // @ts-expect-error // If descriptive fields are truly not in schema, this will error.
      // If they are optional in schema, this is fine.
      const country = await ctx.db.country.create({ data: countryDataForCreate });


      await ctx.db.historicalData.create({
        data: {
          countryId: country.id,
          ixTimeTimestamp: baselineDate,
          population: input.baselinePopulation,
          gdpPerCapita: input.baselineGdpPerCapita,
          totalGdp: input.baselinePopulation * input.baselineGdpPerCapita,
          populationGrowthRate: input.populationGrowthRate,
          gdpGrowthRate: input.adjustedGdpGrowth,
          landArea: input.landArea,
          populationDensity,
          gdpDensity: gdpDensityValue,
        }
      });

      return country;
    }),

  updateStats: publicProcedure
    .input(z.object({
      countryId: z.string().optional(), // Optional: if not provided, update all
      targetTime: z.number().optional() // Optional: if not provided, use current IxTime
    }))
    .mutation(async ({ ctx, input }) => {
      const calculator = new IxSheetzCalculator(); // Using the enhanced calculator
      const targetIxTimeMs = input.targetTime || await getCurrentIxTime(ctx); // Use potentially bot-synced time

      const processCountryUpdate = async (country: PrismaCountry & { dmInputs: any[] }) => {
        const lastCalculatedIxTimeMs = country.lastCalculated.getTime();
        const timeElapsed = IxTime.getYearsElapsed(lastCalculatedIxTimeMs, targetIxTimeMs);

        if (timeElapsed <= 0) { // No update needed if no time has passed or target is in past
          return null;
        }

        // Fetch global growth factor from config
        const globalGrowthConfig = await ctx.db.systemConfig.findUnique({
          where: { key: 'global_growth_factor' }
        });
        const globalGrowthFactor = parseFloat(globalGrowthConfig?.value || "1.0321");

        // Prepare parameters for the enhanced calculator
        const growthParams = {
          basePopulation: country.currentPopulation,
          baseGdpPerCapita: country.currentGdpPerCapita,
          populationGrowthRate: country.populationGrowthRate, // Base rate
          gdpGrowthRate: country.adjustedGdpGrowth, // Base rate
          maxGdpGrowthRate: country.maxGdpGrowthRate,
          economicTier: country.economicTier, // Current tier
          populationTier: country.populationTier, // Current tier
          globalGrowthFactor,
          localGrowthFactor: country.localGrowthFactor,
          timeElapsed,
          // dmInputs: country.dmInputs // Pass active DM inputs if calculator supports it
        };

        const result = calculator.calculateEnhancedGrowth(growthParams); // Use enhanced calculation

        const newEconomicTier = determineEconomicTier(result.gdpPerCapita);
        const newPopulationTier = determinePopulationTier(result.population);
        const landArea = country.landArea || 0;
        const newPopulationDensity = landArea > 0 ? result.population / landArea : undefined;
        const newGdpDensity = landArea > 0 ? result.totalGdp / landArea : undefined;

        // Update the country in the database
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
            lastCalculated: new Date(targetIxTimeMs)
          }
        });

        // Create a new historical data point
        await ctx.db.historicalData.create({
          data: {
            countryId: country.id,
            ixTimeTimestamp: new Date(targetIxTimeMs),
            population: result.population,
            gdpPerCapita: result.gdpPerCapita,
            totalGdp: result.totalGdp,
            populationGrowthRate: result.populationGrowthRate, // Store effective rate for this period
            gdpGrowthRate: result.gdpGrowthRate,           // Store effective rate for this period
            landArea: country.landArea,
            populationDensity: newPopulationDensity,
            gdpDensity: newGdpDensity,
          }
        });

        return {
          countryName: country.name,
          oldStats: {
            population: country.currentPopulation,
            gdpPerCapita: country.currentGdpPerCapita,
            totalGdp: country.currentTotalGdp
          },
          newStats: result,
          timeElapsed,
          calculationDate: targetIxTimeMs,
          timeSource: (await ctx.db.systemConfig.findUnique({ where: { key: 'bot_sync_enabled' } }))?.value === 'true' ? 'bot-synced' : 'local-calc'
        };
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
        // Update all countries
        const countries = await ctx.db.country.findMany({
          include: { dmInputs: { where: { isActive: true } } }
        });
        const results = (await Promise.all(countries.map(processCountryUpdate))).filter(r => r !== null);
        const timeSource = (await ctx.db.systemConfig.findUnique({ where: { key: 'bot_sync_enabled' } }))?.value === 'true' ? 'bot-synced' : 'local-calc';
        return { updated: results.length, results, timeSource };
      }
    }),

  getForecast: publicProcedure
    .input(z.object({
        countryId: z.string(),
        targetTime: z.number(), // Expecting IxTime timestamp for the forecast date
    }))
    .query(async ({ ctx, input }) => {
        const country = await ctx.db.country.findUnique({
            where: { id: input.countryId },
        });
        if (!country) {
            throw new Error("Country not found for forecast");
        }

        const calculator = new IxSheetzCalculator(); // Using enhanced calculator
        
        // Use current stats as the base for forecasting
        const lastCalculatedIxTimeMs = country.lastCalculated.getTime();
        const timeElapsed = IxTime.getYearsElapsed(lastCalculatedIxTimeMs, input.targetTime);

        // If targetTime is not in the future relative to lastCalculated, return current stats
        if (timeElapsed <= 0) {
            return {
                population: country.currentPopulation,
                gdpPerCapita: country.currentGdpPerCapita,
                totalGdp: country.currentTotalGdp,
                populationDensity: country.populationDensity,
                gdpDensity: country.gdpDensity,
                forecastDate: new Date(input.targetTime),
                forecastSource: 'current-data (target time not in future or same as last calc)'
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
        const gdpDensityValue = landArea > 0 ? forecastResult.totalGdp / landArea : undefined;

        return {
            ...forecastResult,
            populationDensity,
            gdpDensity: gdpDensityValue,
            forecastDate: new Date(input.targetTime),
            forecastSource: 'calculated-forecast'
        };
    }),

  getDmInputs: publicProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.dmInput.findMany({
        where: {
          countryId: input.countryId || null, 
          isActive: true
        },
        orderBy: { ixTimeTimestamp: 'desc' }
      });
    }),

  addDmInput: publicProcedure
    .input(dmInputSchema)
    .mutation(async ({ ctx, input }) => {
      const currentIxTimeMs = await getCurrentIxTime(ctx);
      return ctx.db.dmInput.create({
        data: {
          countryId: input.countryId, 
          ixTimeTimestamp: new Date(currentIxTimeMs),
          inputType: input.inputType,
          value: input.value,
          description: input.description,
          duration: input.duration,
          isActive: true
          // createdBy: // TODO: Add user context if authentication is implemented
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
      // isActive: z.boolean().optional(), // To deactivate/archive
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.dmInput.update({
        where: { id: input.id },
        data: {
          inputType: input.inputType,
          value: input.value,
          description: input.description,
          duration: input.duration,
          // isActive: input.isActive, // If allowing deactivation
        }
      });
    }),

  deleteDmInput: publicProcedure // This should probably be a soft delete (isActive: false)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.dmInput.update({ // Changed to update for soft delete
        where: { id: input.id },
        data: { isActive: false }
      });
    }),

  getGlobalStats: publicProcedure.query(async ({ ctx }): Promise<GlobalEconomicSnapshot> => {
    const countries = await ctx.db.country.findMany();
    const currentIxTimeMs = await getCurrentIxTime(ctx);

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
        globalGrowthRate: 0,
        ixTimeTimestamp: currentIxTimeMs
      };
    }

    const totalPopulation = countries.reduce((sum, c) => sum + c.currentPopulation, 0);
    const totalGdp = countries.reduce((sum, c) => sum + c.currentTotalGdp, 0);
    const totalLandArea = countries.reduce((sum, c) => sum + (c.landArea || 0), 0);

    const averageGdpPerCapita = totalPopulation > 0 ? totalGdp / totalPopulation : 0;
    const averagePopulationDensity = totalLandArea > 0 ? totalPopulation / totalLandArea : 0;
    const averageGdpDensity = totalLandArea > 0 ? totalGdp / totalLandArea : 0;

    const economicTierDistribution = countries.reduce((acc, c) => {
      const tier = c.economicTier as EconomicTier; // Cast to ensure type safety
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<EconomicTier, number>);

    const populationTierDistribution = countries.reduce((acc, c) => {
        const tier = c.populationTier as PopulationTier; // Cast to ensure type safety
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      }, {} as Record<PopulationTier, number>);

    const globalGrowthConfig = await ctx.db.systemConfig.findUnique({
        where: { key: 'global_growth_factor' }
    });
    const globalGrowthRate = parseFloat(globalGrowthConfig?.value || "1.0321") - 1; // Convert to a rate

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
        ixTimeTimestamp: currentIxTimeMs
    };
  }),

  analyzeImport: publicProcedure
    .input(z.object({
      fileData: z.string(), // Base64 encoded file data
      fileName: z.string().optional(), // Optional: for CSV header skipping logic
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const buffer = Buffer.from(input.fileData, 'base64');
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const dataService = new IxStatsDataService(IxStatsDataService.getDefaultConfig());
        const baseDataArray = await dataService.parseRosterFile(arrayBuffer, input.fileName);

        const existingCountries = await ctx.db.country.findMany();
        const existingCountriesMap = new Map(existingCountries.map(c => [c.name.toLowerCase(), c]));

        const changes: Array<{
          type: 'new' | 'update';
          country: BaseCountryData;
          existingData?: PrismaCountry; 
          changes?: Array<{
            field: keyof BaseCountryData;
            oldValue: any;
            newValue: any;
            fieldLabel: string;
          }>;
        }> = [];

        for (const countryData of baseDataArray) {
          const existing = existingCountriesMap.get(countryData.country.toLowerCase());

          if (!existing) {
            changes.push({
              type: 'new',
              country: countryData
            });
          } else {
            const fieldChanges: Array<{
              field: keyof BaseCountryData; 
              oldValue: any;
              newValue: any;
              fieldLabel: string;
            }> = [];
            
            // Define fields to compare, ensuring dbField is a valid key of PrismaCountry
            const fieldsToCompare: Array<{ field: keyof BaseCountryData, dbField: keyof PrismaCountry, label?: string }> = [
              { field: 'population', dbField: 'baselinePopulation' },
              { field: 'gdpPerCapita', dbField: 'baselineGdpPerCapita' },
              { field: 'landArea', dbField: 'landArea' },
              { field: 'areaSqMi', dbField: 'areaSqMi' as keyof PrismaCountry}, // Explicit cast if not directly on model
              { field: 'maxGdpGrowthRate', dbField: 'maxGdpGrowthRate' },
              { field: 'adjustedGdpGrowth', dbField: 'adjustedGdpGrowth' },
              { field: 'populationGrowthRate', dbField: 'populationGrowthRate' },
              { field: 'projected2040Population', dbField: 'projected2040Population' },
              { field: 'projected2040Gdp', dbField: 'projected2040Gdp' },
              { field: 'projected2040GdpPerCapita', dbField: 'projected2040GdpPerCapita' },
              { field: 'actualGdpGrowth', dbField: 'actualGdpGrowth' },
              { field: 'continent', dbField: 'continent' as keyof PrismaCountry },
              { field: 'region', dbField: 'region' as keyof PrismaCountry},
              { field: 'governmentType', dbField: 'governmentType' as keyof PrismaCountry },
              { field: 'religion', dbField: 'religion' as keyof PrismaCountry },
              { field: 'leader', dbField: 'leader' as keyof PrismaCountry },
            ];

            for (const { field, dbField, label } of fieldsToCompare) {
              const newValue = countryData[field];
              // Ensure dbField is a valid key for PrismaCountry before accessing
              const oldValue = (existing as any)[dbField]; 
              
              let isDifferent = false;
              if (typeof newValue === 'number' && typeof oldValue === 'number') {
                isDifferent = Math.abs(newValue - oldValue) > 0.001; 
              } else if ((newValue === null || newValue === undefined) && (oldValue === null || oldValue === undefined)) {
                isDifferent = false; // Both are null/undefined
              } else if (newValue === null || newValue === undefined) {
                isDifferent = oldValue !== null && oldValue !== undefined; // New is null, old was not
              } else if (oldValue === null || oldValue === undefined) {
                isDifferent = true; // Old was null, new is not
              } else {
                isDifferent = String(newValue).trim() !== String(oldValue).trim();
              }
              
              if (isDifferent && (countryData as any)[field] !== undefined ) { // Only consider changes if new value is defined
                 fieldChanges.push({
                  field,
                  oldValue,
                  newValue,
                  fieldLabel: label || fieldLabelsForAnalysis[field] || field 
                });
              }
            }

            if (fieldChanges.length > 0) {
              changes.push({
                type: 'update',
                country: countryData,
                existingData: existing,
                changes: fieldChanges
              });
            }
          }
        }

        return {
          totalCountries: baseDataArray.length,
          changes,
          newCountries: changes.filter(c => c.type === 'new').length,
          updatedCountries: changes.filter(c => c.type === 'update').length,
          unchangedCountries: baseDataArray.length - changes.length,
          analysisTime: await getCurrentIxTime(ctx)
        };
      } catch (error) {
        console.error('Import analysis error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error during import analysis';
        throw new Error(`Failed to analyze import file: ${message}`);
      }
    }),

  importFromExcel: publicProcedure 
    .input(z.object({
      fileData: z.string(), // Base64 encoded file data
      fileName: z.string().optional(), // For CSV header detection
      replaceExisting: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const buffer = Buffer.from(input.fileData, 'base64');
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const dataService = new IxStatsDataService(IxStatsDataService.getDefaultConfig());
        const baseDataArray = await dataService.parseRosterFile(arrayBuffer, input.fileName);
        const initializedCountries = dataService.initializeCountries(baseDataArray);

        const currentIxTimeMs = await getCurrentIxTime(ctx); // Use current IxTime for baselining new/replaced data

        if (input.replaceExisting) {
          // Order matters: delete dependents first if there are relations
          await ctx.db.historicalData.deleteMany({});
          await ctx.db.dmInput.deleteMany({});
          // Then delete the main Country records
          await ctx.db.country.deleteMany({});
        }

        const results = [];
        for (const countryStats of initializedCountries) {
          const existingCountry = !input.replaceExisting 
            ? await ctx.db.country.findUnique({ where: { name: countryStats.country }}) 
            : null;

          if (existingCountry && !input.replaceExisting) {
            // Skip if not replacing and country exists
            continue; 
          }
          // If replacing, or if country doesn't exist, proceed to create/update.
          // If replacing and country exists, we've already deleted it above.

          const gdpDensityValue = countryStats.landArea && countryStats.landArea > 0 
            ? countryStats.currentTotalGdp / countryStats.landArea 
            : undefined;

          // Data for Prisma create operation
          // Only include fields that are part of the Prisma Country model schema
          const dataToCreate: any = { // Use `any` for flexibility, or a more specific PrismaCreateInput type
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
            landArea: countryStats.landArea, // This is km²
            
            // Descriptive fields from BaseCountryData - only if they exist in Prisma schema
            // Ensure these are optional in your Prisma schema or handle nulls appropriately
            continent: countryStats.continent ?? null,
            region: countryStats.region ?? null, // This was the source of the original error if not in schema
            governmentType: countryStats.governmentType ?? null,
            religion: countryStats.religion ?? null,
            leader: countryStats.leader ?? null,
            areaSqMi: countryStats.areaSqMi ?? null, // If you have this field in schema

            // Current stats initialized from baseline
            currentPopulation: countryStats.currentPopulation,
            currentGdpPerCapita: countryStats.currentGdpPerCapita,
            currentTotalGdp: countryStats.currentTotalGdp,
            populationDensity: countryStats.populationDensity,
            gdpDensity: gdpDensityValue,
            
            lastCalculated: new Date(currentIxTimeMs), // Use current IxTime
            baselineDate: new Date(IxTime.getInGameEpoch()), // Roster data is for game epoch
            economicTier: countryStats.economicTier as EconomicTier,
            populationTier: countryStats.populationTier as PopulationTier,
            localGrowthFactor: countryStats.localGrowthFactor,
          };
          
          // Remove null/undefined descriptive fields if they are not explicitly nullable in Prisma
          // or if you prefer not to set them if they are empty.
          for (const key of ['continent', 'region', 'governmentType', 'religion', 'leader', 'areaSqMi']) {
            if (dataToCreate[key] === null) {
              delete dataToCreate[key];
            }
          }


          const createdCountry = await ctx.db.country.create({
            data: dataToCreate,
          });

          // Create initial historical data point at the game epoch
          await ctx.db.historicalData.create({
            data: {
                countryId: createdCountry.id,
                ixTimeTimestamp: new Date(IxTime.getInGameEpoch()), // Baseline historical data is for game epoch
                population: createdCountry.baselinePopulation,
                gdpPerCapita: createdCountry.baselineGdpPerCapita,
                totalGdp: createdCountry.baselinePopulation * createdCountry.baselineGdpPerCapita,
                populationGrowthRate: createdCountry.populationGrowthRate,
                gdpGrowthRate: createdCountry.adjustedGdpGrowth,
                landArea: createdCountry.landArea,
                populationDensity: createdCountry.populationDensity,
                gdpDensity: createdCountry.gdpDensity,
            }
          });
          results.push(createdCountry);
        }

        const timeSource = (await ctx.db.systemConfig.findUnique({ where: { key: 'bot_sync_enabled' } }))?.value === 'true' ? 'bot-synced' : 'local-calc';
        return {
          imported: results.length,
          totalInFile: initializedCountries.length,
          countries: results.map(c => c.name),
          importTime: currentIxTimeMs,
          timeSource: timeSource
        };
      } catch (error) {
        console.error('Import error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error during Excel import';
        // Consider if this error should be more specific or if it's a TRPCError
        throw new Error(`Failed to import Excel file: ${message}`);
      }
    }),

  getHistoricalAtTime: publicProcedure
    .input(z.object({
      countryId: z.string(),
      ixTime: z.number(), // Target IxTime timestamp
      windowYears: z.number().default(5), // Years before and after targetTime
    }))
    .query(async ({ ctx, input }) => {
      // Calculate the start and end of the window for historical data
      const startTime = IxTime.addYears(input.ixTime, -input.windowYears / 2);
      const endTime = IxTime.addYears(input.ixTime, input.windowYears / 2);

      const historicalData = await ctx.db.historicalData.findMany({
        where: {
          countryId: input.countryId,
          ixTimeTimestamp: {
            gte: new Date(startTime),
            lte: new Date(endTime),
          }
        },
        orderBy: { ixTimeTimestamp: 'asc' }, // Ensure data is sorted chronologically
      });

      // Map to a client-friendly format, converting Date to timestamp number
      return historicalData.map(h => ({
        id: h.id,
        ixTimeTimestamp: h.ixTimeTimestamp.getTime(),
        formattedTime: IxTime.formatIxTime(h.ixTimeTimestamp.getTime()), // Optional formatted string
        population: h.population,
        gdpPerCapita: h.gdpPerCapita,
        totalGdp: h.totalGdp,
        populationGrowthRate: h.populationGrowthRate,
        gdpGrowthRate: h.gdpGrowthRate,
        landArea: h.landArea,
        populationDensity: h.populationDensity,
        gdpDensity: h.gdpDensity,
      }));
    }),
});

