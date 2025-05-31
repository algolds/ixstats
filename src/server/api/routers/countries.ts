// src/server/api/routers/countries.ts
// Updated countries router using the new CSV handler

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxStatsDataService } from "~/lib/data-service";
import { IxStatsCalculator } from "~/lib/calculations";
import { IxTime } from "~/lib/ixtime";
import { IxSheetzCalculator } from "~/lib/enhanced-calculations";
import { csvHandler } from "~/lib/csv-handler"; // Import the new CSV handler
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

// Field labels for analysis
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

    return countries.map(country => ({
      ...country, 
      name: country.name, 
      country: country.name, 
      lastCalculated: country.lastCalculated.getTime(),
      baselineDate: country.baselineDate.getTime(),
      economicTier: country.economicTier as EconomicTier,
      populationTier: country.populationTier as PopulationTier,
    }));
  }),

  getByIdAtTime: publicProcedure
    .input(z.object({
      id: z.string(),
      ixTime: z.number(), 
    }))
    .query(async ({ ctx, input }) => {
      const countryFromDb = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          historicalData: { 
            orderBy: { ixTimeTimestamp: 'desc' },
            take: 50 
          },
          dmInputs: { 
            where: { isActive: true }
          }
        }
      });

      if (!countryFromDb) {
        throw new Error("Country not found");
      }

      const systemConfigs = await ctx.db.systemConfig.findMany();
      const globalGrowthFactor = parseFloat(
        systemConfigs.find(c => c.key === 'global_growth_factor')?.value || '1.0321'
      );

      const economicConfig = IxStatsDataService.getDefaultEconomicConfig();
      economicConfig.globalGrowthFactor = globalGrowthFactor;

      const calculator = new IxStatsCalculator(economicConfig, IxTime.getInGameEpoch());

      const countryStatsForCalc: CountryStats = {
        id: countryFromDb.id,
        country: countryFromDb.name, 
        name: countryFromDb.name,    

        // Initialize descriptive fields 
        continent: countryFromDb.continent ?? null,
        region: countryFromDb.region ?? null,
        governmentType: countryFromDb.governmentType ?? null,
        religion: countryFromDb.religion ?? null,
        leader: countryFromDb.leader ?? null,
        areaSqMi: countryFromDb.areaSqMi ?? null,

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
        landArea: countryFromDb.landArea ?? null,
        
        totalGdp: countryFromDb.baselinePopulation * countryFromDb.baselineGdpPerCapita,
        
        currentPopulation: countryFromDb.currentPopulation,
        currentGdpPerCapita: countryFromDb.currentGdpPerCapita,
        currentTotalGdp: countryFromDb.currentTotalGdp,
        
        lastCalculated: countryFromDb.lastCalculated.getTime(), 
        baselineDate: countryFromDb.baselineDate.getTime(),   
        
        economicTier: countryFromDb.economicTier as EconomicTier,
        populationTier: countryFromDb.populationTier as PopulationTier,
        localGrowthFactor: countryFromDb.localGrowthFactor,
        globalGrowthFactor: globalGrowthFactor, 
        
        populationDensity: countryFromDb.populationDensity ?? undefined,
        gdpDensity: countryFromDb.gdpDensity ?? undefined,
      };

      const targetTimeStatsResult = calculator.calculateTimeProgression(
        countryStatsForCalc, 
        input.ixTime,
        countryFromDb.dmInputs.map(dm => ({ 
          id: dm.id,
          countryId: dm.countryId,
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime(),
          inputType: dm.inputType as DmInputTypeEnum, 
          value: dm.value,
          description: dm.description,
          duration: dm.duration,
          isActive: dm.isActive,
          createdBy: dm.createdBy,
        }))
      );
      
      const historicalDataForResponse = countryFromDb.historicalData.map(h => ({
        id: h.id,
        countryId: h.countryId,
        ixTimeTimestamp: h.ixTimeTimestamp.getTime(), 
        formattedTime: IxTime.formatIxTime(h.ixTimeTimestamp.getTime()), 
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
        ...targetTimeStatsResult.newStats, 
        lastCalculated: targetTimeStatsResult.newStats.lastCalculated instanceof Date 
                        ? targetTimeStatsResult.newStats.lastCalculated.getTime() 
                        : targetTimeStatsResult.newStats.lastCalculated,
        baselineDate: targetTimeStatsResult.newStats.baselineDate instanceof Date
                        ? targetTimeStatsResult.newStats.baselineDate.getTime()
                        : targetTimeStatsResult.newStats.baselineDate,
        requestedTime: input.ixTime,
        formattedTime: IxTime.formatIxTime(input.ixTime, true),
        gameTimeDescription: calculator.getTimeDescription(input.ixTime), 
        timeFromPresent: IxTime.getYearsElapsed(await getCurrentIxTime(ctx), input.ixTime),
        historicalData: historicalDataForResponse,
      };
    }),

  getTimeContext: publicProcedure
    .query(async ({ctx}) => { 
      const currentIxTime = await getCurrentIxTime(ctx); 
      const gameEpoch = IxTime.getInGameEpoch();

      return {
        currentIxTime,
        formattedCurrentTime: IxTime.formatIxTime(currentIxTime, true),
        gameEpoch,
        formattedGameEpoch: IxTime.formatIxTime(gameEpoch, true),
        yearsSinceGameStart: IxTime.getYearsSinceGameEpoch(currentIxTime),
        currentGameYear: IxTime.getCurrentGameYear(currentIxTime),
        gameTimeDescription: IxTime.getGameTimeDescription(currentIxTime),
        timeMultiplier: IxTime.getTimeMultiplier(), 
        isPaused: IxTime.isPaused(), 
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
      const baselineDate = new Date(currentIxTimeMs); 

      const baselineYear = new Date(currentIxTimeMs).getUTCFullYear();
      const yearsTo2040 = 2040 - baselineYear;

      const projected2040Population = input.projected2040Population ??
        input.baselinePopulation * Math.pow(1 + input.populationGrowthRate, yearsTo2040);

      const projected2040GdpPerCapita = input.projected2040GdpPerCapita ??
        input.baselineGdpPerCapita * Math.pow(1 + input.adjustedGdpGrowth, yearsTo2040);

      const projected2040Gdp = input.projected2040Gdp ??
        projected2040Population * projected2040GdpPerCapita;

      const actualGdpGrowth = input.actualGdpGrowth ?? 
        (1 + input.populationGrowthRate) * (1 + input.adjustedGdpGrowth) - 1;

      const landArea = input.landArea ?? 0; 
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
        landArea: input.landArea ?? null, 
        continent: input.continent ?? null,
        region: input.region ?? null,
        governmentType: input.governmentType ?? null,
        religion: input.religion ?? null,
        leader: input.leader ?? null,
        areaSqMi: input.areaSqMi ?? null,
        currentPopulation: input.baselinePopulation,
        currentGdpPerCapita: input.baselineGdpPerCapita,
        currentTotalGdp: input.baselinePopulation * input.baselineGdpPerCapita,
        populationDensity: populationDensity ?? null, 
        gdpDensity: gdpDensityValue ?? null, 
        lastCalculated: baselineDate,
        baselineDate: baselineDate, 
        economicTier: determineEconomicTier(input.baselineGdpPerCapita),
        populationTier: determinePopulationTier(input.baselinePopulation),
        localGrowthFactor: 1.0, 
      };
      
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
          landArea: input.landArea ?? null,
          populationDensity: populationDensity ?? null,
          gdpDensity: gdpDensityValue ?? null,
        }
      });

      return country;
    }),

  updateStats: publicProcedure
    .input(z.object({
      countryId: z.string().optional(), 
      targetTime: z.number().optional() 
    }))
    .mutation(async ({ ctx, input }) => {
      const calculator = new IxSheetzCalculator(); 
      const targetIxTimeMs = input.targetTime || await getCurrentIxTime(ctx); 

      const processCountryUpdate = async (country: PrismaCountry & { dmInputs: any[] }) => {
        const lastCalculatedIxTimeMs = country.lastCalculated.getTime();
        const timeElapsed = IxTime.getYearsElapsed(lastCalculatedIxTimeMs, targetIxTimeMs);

        if (timeElapsed <= 0) { 
          return null;
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
            populationDensity: newPopulationDensity ?? null,
            gdpDensity: newGdpDensity ?? null,
            lastCalculated: new Date(targetIxTimeMs)
          }
        });

        await ctx.db.historicalData.create({
          data: {
            countryId: country.id,
            ixTimeTimestamp: new Date(targetIxTimeMs),
            population: result.population,
            gdpPerCapita: result.gdpPerCapita,
            totalGdp: result.totalGdp,
            populationGrowthRate: result.populationGrowthRate, 
            gdpGrowthRate: result.gdpGrowthRate,          
            landArea: country.landArea,
            populationDensity: newPopulationDensity ?? null,
            gdpDensity: newGdpDensity ?? null,
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
        targetTime: z.number(), 
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
    const globalGrowthRate = parseFloat(globalGrowthConfig?.value || "1.0321") - 1; 

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
      fileData: z.string(), 
      fileName: z.string().optional(), 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(`[CSV Import] Starting analysis of ${input.fileName || 'file'}`);
        
        const buffer = Buffer.from(input.fileData, 'base64');
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        // Use the new CSV handler instead of the old data parser
        const parseResult = await csvHandler.parseFile(arrayBuffer, input.fileName);
        
        if (!parseResult.success) {
          throw new Error(`CSV parsing failed: ${parseResult.errors.join(', ')}`);
        }

        console.log(`[CSV Import] Successfully parsed ${parseResult.data.length} countries`);
        
        if (parseResult.warnings.length > 0) {
          console.warn(`[CSV Import] Warnings: ${parseResult.warnings.join(', ')}`);
        }

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

        for (const countryData of parseResult.data) {
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
            
            // Compare fields for changes
            const fieldsToCompare: Array<{ field: keyof BaseCountryData, dbField: keyof PrismaCountry, label?: string }> = [
              { field: 'population', dbField: 'baselinePopulation' },
              { field: 'gdpPerCapita', dbField: 'baselineGdpPerCapita' },
              { field: 'landArea', dbField: 'landArea' },
              { field: 'areaSqMi', dbField: 'areaSqMi' as keyof PrismaCountry}, 
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
              const oldValue = (existing as any)[dbField]; 
              
              let isDifferent = false;
              if (typeof newValue === 'number' && typeof oldValue === 'number') {
                isDifferent = Math.abs(newValue - oldValue) > 0.001; 
              } else if ((newValue === null || newValue === undefined) && (oldValue === null || oldValue === undefined)) {
                isDifferent = false; 
              } else if (newValue === null || newValue === undefined) {
                isDifferent = oldValue !== null && oldValue !== undefined; 
              } else if (oldValue === null || oldValue === undefined) {
                isDifferent = true; 
              } else {
                isDifferent = String(newValue).trim() !== String(oldValue).trim();
              }
              
              if (isDifferent && (countryData as any)[field] !== undefined ) { 
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

        console.log(`[CSV Import] Analysis complete: ${changes.filter(c => c.type === 'new').length} new, ${changes.filter(c => c.type === 'update').length} updates`);

        return {
          totalCountries: parseResult.data.length,
          changes,
          newCountries: changes.filter(c => c.type === 'new').length,
          updatedCountries: changes.filter(c => c.type === 'update').length,
          unchangedCountries: parseResult.data.length - changes.length,
          analysisTime: await getCurrentIxTime(ctx),
          parseWarnings: parseResult.warnings,
          metadata: parseResult.metadata
        };
      } catch (error) {
        console.error('[CSV Import] Analysis error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error during import analysis';
        throw new Error(`Failed to analyze import file: ${message}`);
      }
    }),

  importFromExcel: publicProcedure 
    .input(z.object({
      fileData: z.string(), 
      fileName: z.string().optional(), 
      replaceExisting: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(`[CSV Import] Starting import of ${input.fileName || 'file'} (replace: ${input.replaceExisting})`);
        
        const buffer = Buffer.from(input.fileData, 'base64');
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        // Use the new CSV handler
        const parseResult = await csvHandler.parseFile(arrayBuffer, input.fileName);
        
        if (!parseResult.success) {
          throw new Error(`CSV parsing failed: ${parseResult.errors.join(', ')}`);
        }

        const currentIxTimeMs = await getCurrentIxTime(ctx); 

        if (input.replaceExisting) {
          console.log('[CSV Import] Clearing existing data for full replacement');
          await ctx.db.historicalData.deleteMany({});
          await ctx.db.dmInput.deleteMany({});
          await ctx.db.country.deleteMany({});
        }

        const results = [];
        for (const countryData of parseResult.data) {
          const existingCountry = !input.replaceExisting 
            ? await ctx.db.country.findUnique({ where: { name: countryData.country }}) 
            : null;

          if (existingCountry && !input.replaceExisting) {
            continue; // Skip existing countries when not replacing
          }
          
          const gdpDensityValue = countryData.landArea && countryData.landArea > 0 
            ? (countryData.population * countryData.gdpPerCapita) / countryData.landArea 
            : null; 

          const dataToCreate = {
            name: countryData.country,
            baselinePopulation: countryData.population,
            baselineGdpPerCapita: countryData.gdpPerCapita,
            maxGdpGrowthRate: countryData.maxGdpGrowthRate,
            adjustedGdpGrowth: countryData.adjustedGdpGrowth,
            populationGrowthRate: countryData.populationGrowthRate,
            projected2040Population: countryData.projected2040Population,
            projected2040Gdp: countryData.projected2040Gdp,
            projected2040GdpPerCapita: countryData.projected2040GdpPerCapita,
            actualGdpGrowth: countryData.actualGdpGrowth,
            landArea: countryData.landArea ?? null, 
            continent: countryData.continent ?? null,
            region: countryData.region ?? null,
            governmentType: countryData.governmentType ?? null,
            religion: countryData.religion ?? null,
            leader: countryData.leader ?? null,
            areaSqMi: countryData.areaSqMi ?? null,
            currentPopulation: countryData.population,
            currentGdpPerCapita: countryData.gdpPerCapita,
            currentTotalGdp: countryData.population * countryData.gdpPerCapita,
            populationDensity: countryData.landArea && countryData.landArea > 0 
              ? countryData.population / countryData.landArea 
              : null, 
            gdpDensity: gdpDensityValue, 
            lastCalculated: new Date(currentIxTimeMs), 
            baselineDate: new Date(IxTime.getInGameEpoch()), 
            economicTier: determineEconomicTier(countryData.gdpPerCapita),
            populationTier: determinePopulationTier(countryData.population),
            localGrowthFactor: 1.0,
          };
          
          const createdCountry = await ctx.db.country.create({
            data: dataToCreate,
          });

          await ctx.db.historicalData.create({
            data: {
                countryId: createdCountry.id,
                ixTimeTimestamp: new Date(IxTime.getInGameEpoch()), 
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
        
        console.log(`[CSV Import] Import complete: ${results.length}/${parseResult.data.length} countries imported`);
        
        return {
          imported: results.length,
          totalInFile: parseResult.data.length,
          countries: results.map(c => c.name),
          importTime: currentIxTimeMs,
          timeSource: timeSource,
          parseWarnings: parseResult.warnings,
          metadata: parseResult.metadata
        };
      } catch (error) {
        console.error('[CSV Import] Import error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error during import';
        throw new Error(`Failed to import file: ${message}`);
      }
    }),

  getHistoricalAtTime: publicProcedure
    .input(z.object({
      countryId: z.string(),
      ixTime: z.number(), 
      windowYears: z.number().default(5), 
    }))
    .query(async ({ ctx, input }) => {
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
        orderBy: { ixTimeTimestamp: 'asc' }, 
      });

      return historicalData.map(h => ({
        id: h.id,
        ixTimeTimestamp: h.ixTimeTimestamp.getTime(),
        formattedTime: IxTime.formatIxTime(h.ixTimeTimestamp.getTime()), 
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