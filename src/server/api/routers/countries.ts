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

    return countries.map(country => ({
      ...country,
      name: country.name, // Ensure name is present
      country: country.name, // Keep 'country' for compatibility if used elsewhere
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
        landArea: countryFromDb.landArea,
        population: countryFromDb.baselinePopulation,
        gdpPerCapita: countryFromDb.baselineGdpPerCapita,
        maxGdpGrowthRate: countryFromDb.maxGdpGrowthRate,
        adjustedGdpGrowth: countryFromDb.adjustedGdpGrowth,
        populationGrowthRate: countryFromDb.populationGrowthRate,
        projected2040Population: countryFromDb.projected2040Population,
        projected2040Gdp: countryFromDb.projected2040Gdp,
        projected2040GdpPerCapita: countryFromDb.projected2040GdpPerCapita,
        actualGdpGrowth: countryFromDb.actualGdpGrowth,
        totalGdp: countryFromDb.baselinePopulation * countryFromDb.baselineGdpPerCapita,
        currentPopulation: countryFromDb.currentPopulation,
        currentGdpPerCapita: countryFromDb.currentGdpPerCapita,
        currentTotalGdp: countryFromDb.currentTotalGdp,
        lastCalculated: countryFromDb.lastCalculated,
        baselineDate: countryFromDb.baselineDate,
        economicTier: countryFromDb.economicTier as EconomicTier,
        populationTier: countryFromDb.populationTier as PopulationTier,
        localGrowthFactor: countryFromDb.localGrowthFactor,
        globalGrowthFactor: globalGrowthFactor,
        populationDensity: countryFromDb.populationDensity,
        gdpDensity: countryFromDb.gdpDensity,
      };

      const targetTimeStatsResult = calculator.calculateTimeProgression(
        countryStatsForCalc,
        input.ixTime,
        countryFromDb.dmInputs.map(dm => ({
          id: dm.id,
          countryId: dm.countryId,
          ixTimeTimestamp: dm.ixTimeTimestamp,
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
        requestedTime: input.ixTime,
        formattedTime: IxTime.formatIxTime(input.ixTime, true),
        gameTimeDescription: IxTime.getGameTimeDescription(input.ixTime),
        timeFromPresent: IxTime.getYearsElapsed(IxTime.getCurrentIxTime(), input.ixTime),
        historicalData: historicalDataForResponse,
      };
    }),

  getTimeContext: publicProcedure
    .query(async () => {
      const currentIxTime = IxTime.getCurrentIxTime();
      const gameEpoch = IxTime.getInGameEpoch();

      return {
        currentIxTime,
        formattedCurrentTime: IxTime.formatIxTime(currentIxTime, true),
        gameEpoch,
        formattedGameEpoch: IxTime.formatIxTime(gameEpoch, true),
        yearsSinceGameStart: IxTime.getYearsSinceGameEpoch(),
        currentGameYear: IxTime.getCurrentGameYear(),
        gameTimeDescription: IxTime.getGameTimeDescription(),
        timeMultiplier: IxTime.getTimeMultiplier(),
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
        name: country.name, // Ensure name is present
        country: country.name, // Keep 'country' for compatibility
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

      const actualGdpGrowth = input.actualGdpGrowth ?? input.populationGrowthRate + input.adjustedGdpGrowth;

      const landArea = input.landArea || 0;
      const populationDensity = landArea > 0 ? input.baselinePopulation / landArea : undefined;
      const gdpDensityValue = landArea > 0 ? (input.baselinePopulation * input.baselineGdpPerCapita) / landArea : undefined;


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
          gdpDensity: gdpDensityValue,

          lastCalculated: baselineDate,
          baselineDate: baselineDate,
          economicTier: determineEconomicTier(input.baselineGdpPerCapita),
          populationTier: determinePopulationTier(input.baselinePopulation),
          localGrowthFactor: 1.0,
        }
      });

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
      countryId: z.string().optional(),
      targetTime: z.number().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const calculator = new IxSheetzCalculator();
      const targetIxTimeMs = input.targetTime || await getCurrentIxTime(ctx);

      const processCountryUpdate = async (country: any) => {
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
            populationDensity: newPopulationDensity,
            gdpDensity: newGdpDensity,
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
          timeSource: 'bot-sync' // Or determine dynamically
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
        return { updated: results.length, results, timeSource: 'bot-sync' }; // Or determine dynamically
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
                forecastSource: 'current-data'
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
            forecastSource: 'calculated'
        };
    }),

  getDmInputs: publicProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.dmInput.findMany({
        where: {
          countryId: input.countryId || null, // Prisma expects null for optional relations
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
          countryId: input.countryId, // Will be undefined for global, which Prisma handles as null
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
      fileData: z.string(), // Base64 encoded file data
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const buffer = Buffer.from(input.fileData, 'base64');
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const dataService = new IxStatsDataService(IxStatsDataService.getDefaultConfig());
        const baseDataArray = await dataService.parseRosterFile(arrayBuffer);

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
            
            const fieldsToCompare: Array<{ field: keyof BaseCountryData, dbField: keyof PrismaCountry, label: string }> = [
              { field: 'population', dbField: 'baselinePopulation', label: 'Population' },
              { field: 'gdpPerCapita', dbField: 'baselineGdpPerCapita', label: 'GDP per Capita' },
              { field: 'landArea', dbField: 'landArea', label: 'Land Area' },
              { field: 'areaSqMi', dbField: 'areaSqMi' as keyof PrismaCountry, label: 'Area (sq mi)' }, // Cast if sure it exists in Prisma Model
              { field: 'maxGdpGrowthRate', dbField: 'maxGdpGrowthRate', label: 'Max GDP Growth Rate' },
              { field: 'adjustedGdpGrowth', dbField: 'adjustedGdpGrowth', label: 'Adjusted GDP Growth' },
              { field: 'populationGrowthRate', dbField: 'populationGrowthRate', label: 'Population Growth Rate' },
              { field: 'projected2040Population', dbField: 'projected2040Population', label: '2040 Population Projection' },
              { field: 'projected2040Gdp', dbField: 'projected2040Gdp', label: '2040 GDP Projection' },
              { field: 'projected2040GdpPerCapita', dbField: 'projected2040GdpPerCapita', label: '2040 GDP per Capita Projection' },
              { field: 'actualGdpGrowth', dbField: 'actualGdpGrowth', label: 'Actual GDP Growth' },
              { field: 'continent', dbField: 'continent' as keyof PrismaCountry, label: 'Continent' },
              { field: 'region', dbField: 'region' as keyof PrismaCountry, label: 'Region' },
              { field: 'governmentType', dbField: 'governmentType' as keyof PrismaCountry, label: 'Government Type' },
              { field: 'religion', dbField: 'religion' as keyof PrismaCountry, label: 'Religion' },
              { field: 'leader', dbField: 'leader' as keyof PrismaCountry, label: 'Leader' },
            ];

            for (const { field, dbField, label } of fieldsToCompare) {
              const newValue = countryData[field];
              // Ensure dbField is a valid key for PrismaCountry before accessing
              const oldValue = (existing as any)[dbField]; // Use 'as any' or ensure dbField is valid key
              
              let isDifferent = false;
              if (typeof newValue === 'number' && typeof oldValue === 'number') {
                isDifferent = Math.abs(newValue - oldValue) > 0.001; 
              } else if (newValue === null || newValue === undefined) {
                isDifferent = oldValue !== null && oldValue !== undefined;
              } else {
                isDifferent = String(newValue).trim() !== String(oldValue ?? '').trim(); // Handle potential null/undefined oldValue
              }
              
              if (isDifferent && (countryData as any)[field] !== undefined ) {
                 fieldChanges.push({
                  field,
                  oldValue,
                  newValue,
                  fieldLabel: fieldLabelsForAnalysis[field] || label 
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
      fileData: z.string(), 
      replaceExisting: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const buffer = Buffer.from(input.fileData, 'base64');
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const dataService = new IxStatsDataService(IxStatsDataService.getDefaultConfig());
        const baseDataArray = await dataService.parseRosterFile(arrayBuffer);
        const initializedCountries = dataService.initializeCountries(baseDataArray);

        const currentIxTimeMs = await getCurrentIxTime(ctx);

        if (input.replaceExisting) {
          await ctx.db.historicalData.deleteMany({});
          await ctx.db.dmInput.deleteMany({});
          await ctx.db.country.deleteMany({});
        }

        const results = [];
        for (const countryStats of initializedCountries) {
          const existingCountry = await ctx.db.country.findUnique({ where: { name: countryStats.country }});
          if (existingCountry && !input.replaceExisting) {
            continue;
          }
          if(existingCountry && input.replaceExisting) {
            await ctx.db.historicalData.deleteMany({ where: { countryId: existingCountry.id } });
            await ctx.db.dmInput.deleteMany({ where: { countryId: existingCountry.id } });
            await ctx.db.country.delete({ where: { id: existingCountry.id } });
          }

          const countryWithBotTime = {
            ...countryStats,
            lastCalculated: currentIxTimeMs,
            baselineDate: currentIxTimeMs,
          };
          
          const gdpDensityValue = countryWithBotTime.landArea && countryWithBotTime.landArea > 0 ? countryWithBotTime.currentTotalGdp / countryWithBotTime.landArea : undefined;


          const createdCountry = await ctx.db.country.create({
            data: {
              name: countryWithBotTime.country,
              region: countryWithBotTime.region,
              governmentType: countryWithBotTime.governmentType,
              religion: countryWithBotTime.religion,
              leader: countryWithBotTime.leader,
              landArea: countryWithBotTime.areaSqMi,
              baselinePopulation: countryWithBotTime.population,
              baselineGdpPerCapita: countryWithBotTime.gdpPerCapita,
              maxGdpGrowthRate: countryWithBotTime.maxGdpGrowthRate,
              adjustedGdpGrowth: countryWithBotTime.adjustedGdpGrowth,
              populationGrowthRate: countryWithBotTime.populationGrowthRate,
              projected2040Population: countryWithBotTime.projected2040Population,
              projected2040Gdp: countryWithBotTime.projected2040Gdp,
              projected2040GdpPerCapita: countryWithBotTime.projected2040GdpPerCapita,
              actualGdpGrowth: countryWithBotTime.actualGdpGrowth,
              landArea: countryWithBotTime.landArea,
              currentPopulation: countryWithBotTime.currentPopulation,
              currentGdpPerCapita: countryWithBotTime.currentGdpPerCapita,
              currentTotalGdp: countryWithBotTime.currentTotalGdp,
              populationDensity: countryWithBotTime.populationDensity,
              gdpDensity: gdpDensityValue,
              lastCalculated: new Date(countryWithBotTime.lastCalculated),
              baselineDate: new Date(countryWithBotTime.baselineDate),
              economicTier: countryWithBotTime.economicTier as EconomicTier,
              populationTier: countryWithBotTime.populationTier as PopulationTier,
              localGrowthFactor: countryWithBotTime.localGrowthFactor,
            }
          });

          await ctx.db.historicalData.create({
            data: {
                countryId: createdCountry.id,
                ixTimeTimestamp: new Date(countryWithBotTime.baselineDate),
                population: countryWithBotTime.currentPopulation,
                gdpPerCapita: countryWithBotTime.currentGdpPerCapita,
                totalGdp: countryWithBotTime.currentTotalGdp,
                populationGrowthRate: countryWithBotTime.populationGrowthRate,
                gdpGrowthRate: countryWithBotTime.adjustedGdpGrowth,
                landArea: countryWithBotTime.landArea,
                populationDensity: countryWithBotTime.populationDensity,
                gdpDensity: gdpDensityValue,
            }
          });
          results.push(createdCountry);
        }

        return {
          imported: results.length,
          totalInFile: initializedCountries.length,
          countries: results.map(c => c.name),
          importTime: currentIxTimeMs,
          timeSource: 'bot-sync' // Or determine dynamically
        };
      } catch (error) {
        console.error('Import error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error during Excel import';
        throw new Error(`Failed to import Excel file: ${message}`);
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