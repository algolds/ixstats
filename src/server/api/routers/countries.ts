// src/server/api/routers/countries.ts
// Updated countries router with proper import functionality

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { csvHandler } from "~/lib/csv-handler";
import { IxStatsDataService } from "~/lib/data-service";
import { getDefaultIxStatsConfig } from "~/lib/config-service";
import { IxTime } from "~/lib/ixtime";
import type { BaseCountryData, ImportAnalysis } from "~/types/ixstats";

const dataService = new IxStatsDataService(getDefaultIxStatsConfig());

export const countriesRouter = createTRPCRouter({
  // Get all countries
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.country.findMany({
      orderBy: { name: "asc" },
    });
  }),

  // Get country by ID
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          historicalData: {
            orderBy: { ixTimeTimestamp: "desc" },
            take: 100, // Limit historical data
          },
        },
      });
    }),

  // Get country by ID at specific time
  getByIdAtTime: publicProcedure
    .input(z.object({ 
      id: z.string(),
      ixTime: z.number()
    }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          historicalData: {
            orderBy: { ixTimeTimestamp: "desc" },
            take: 100,
          },
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });

      if (!country) {
        throw new Error("Country not found");
      }

      // Convert database country to CountryStats and calculate at specific time
      const countryStats = {
        id: country.id,
        name: country.name,
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
        totalGdp: country.baselinePopulation * country.baselineGdpPerCapita,
        currentPopulation: country.currentPopulation,
        currentGdpPerCapita: country.currentGdpPerCapita,
        currentTotalGdp: country.currentTotalGdp,
        lastCalculated: country.lastCalculated,
        baselineDate: country.baselineDate,
        economicTier: country.economicTier as any,
        populationTier: country.populationTier as any,
        populationDensity: country.populationDensity,
        gdpDensity: country.gdpDensity,
        localGrowthFactor: country.localGrowthFactor,
        globalGrowthFactor: 1.0,
        historicalData: country.historicalData,
      };

      // Calculate stats at the specific time
      const statsAtTime = dataService.calculateCountryAtTime(countryStats, input.ixTime, country.dmInputs);
      
      return {
        ...statsAtTime,
        gameTimeDescription: IxTime.getGameTimeDescription(input.ixTime),
      };
    }),

  // Get time context
  getTimeContext: publicProcedure.query(() => {
    return dataService.getTimeContext();
  }),

  // Get forecast for country
  getForecast: publicProcedure
    .input(z.object({
      countryId: z.string(),
      targetTime: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          dmInputs: {
            where: { isActive: true },
          },
        },
      });

      if (!country) {
        throw new Error("Country not found");
      }

      // Convert to CountryStats format
      const countryStats = {
        id: country.id,
        name: country.name,
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
        totalGdp: country.baselinePopulation * country.baselineGdpPerCapita,
        currentPopulation: country.currentPopulation,
        currentGdpPerCapita: country.currentGdpPerCapita,
        currentTotalGdp: country.currentTotalGdp,
        lastCalculated: country.lastCalculated,
        baselineDate: country.baselineDate,
        economicTier: country.economicTier as any,
        populationTier: country.populationTier as any,
        populationDensity: country.populationDensity,
        gdpDensity: country.gdpDensity,
        localGrowthFactor: country.localGrowthFactor,
        globalGrowthFactor: 1.0,
      };

      return dataService.calculateCountryAtTime(countryStats, input.targetTime, country.dmInputs);
    }),

  // Get historical data for charts
  getHistoricalAtTime: publicProcedure
    .input(z.object({
      countryId: z.string(),
      ixTime: z.number(),
      windowYears: z.number().default(5),
    }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          dmInputs: {
            where: { isActive: true },
          },
        },
      });

      if (!country) {
        throw new Error("Country not found");
      }

      // Generate historical time series around the target time
      const startTime = IxTime.addYears(input.ixTime, -input.windowYears / 2);
      const endTime = IxTime.addYears(input.ixTime, input.windowYears / 2);
      
      const countryStats = {
        id: country.id,
        name: country.name,
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
        totalGdp: country.baselinePopulation * country.baselineGdpPerCapita,
        currentPopulation: country.currentPopulation,
        currentGdpPerCapita: country.currentGdpPerCapita,
        currentTotalGdp: country.currentTotalGdp,
        lastCalculated: country.lastCalculated,
        baselineDate: country.baselineDate,
        economicTier: country.economicTier as any,
        populationTier: country.populationTier as any,
        populationDensity: country.populationDensity,
        gdpDensity: country.gdpDensity,
        localGrowthFactor: country.localGrowthFactor,
        globalGrowthFactor: 1.0,
      };

      const timeSeries = dataService.generateTimeSeries(
        countryStats,
        startTime,
        endTime,
        20, // 20 data points
        country.dmInputs
      );

      return timeSeries.map(point => ({
        ixTimeTimestamp: point.time,
        population: point.stats.currentPopulation,
        gdpPerCapita: point.stats.currentGdpPerCapita,
        totalGdp: point.stats.currentTotalGdp,
        populationDensity: point.stats.populationDensity,
        gdpDensity: point.stats.gdpDensity,
      }));
    }),

  // Analyze import file
  analyzeImport: publicProcedure
    .input(z.object({
      fileData: z.string(), // Base64 encoded file data
      fileName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Decode base64 file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        
        // Parse the file
        const parseResult = await csvHandler.parseFile(fileBuffer.buffer, input.fileName);
        
        if (!parseResult.success) {
          throw new Error(`Failed to parse file: ${parseResult.errors.join(', ')}`);
        }

        if (parseResult.warnings.length > 0) {
          console.warn(`[CSV Import] Warnings: ${parseResult.warnings.join(', ')}`);
        }

        // Get existing countries to compare against
        const existingCountries = await ctx.db.country.findMany({
          select: {
            name: true,
            continent: true,
            region: true,
            governmentType: true,
            religion: true,
            leader: true,
            baselinePopulation: true,
            baselineGdpPerCapita: true,
            landArea: true,
            areaSqMi: true,
            maxGdpGrowthRate: true,
            adjustedGdpGrowth: true,
            populationGrowthRate: true,
            projected2040Population: true,
            projected2040Gdp: true,
            projected2040GdpPerCapita: true,
            actualGdpGrowth: true,
          },
        });

        const existingCountryMap = new Map(
          existingCountries.map(country => [country.name, country])
        );

        // Analyze changes
        const changes: ImportAnalysis['changes'] = [];
        let newCountries = 0;
        let updatedCountries = 0;

        for (const countryData of parseResult.data) {
          const existing = existingCountryMap.get(countryData.country);
          
          if (!existing) {
            // New country
            newCountries++;
            changes.push({
              type: 'new',
              country: countryData,
            });
          } else {
            // Check for changes
            const fieldChanges: any[] = [];
            
            // Compare all fields
            const fieldsToCompare = [
              { key: 'continent', label: 'Continent', dbKey: 'continent' },
              { key: 'region', label: 'Region', dbKey: 'region' },
              { key: 'governmentType', label: 'Government Type', dbKey: 'governmentType' },
              { key: 'religion', label: 'Religion', dbKey: 'religion' },
              { key: 'leader', label: 'Leader', dbKey: 'leader' },
              { key: 'population', label: 'Population', dbKey: 'baselinePopulation' },
              { key: 'gdpPerCapita', label: 'GDP per Capita', dbKey: 'baselineGdpPerCapita' },
              { key: 'landArea', label: 'Land Area (km²)', dbKey: 'landArea' },
              { key: 'areaSqMi', label: 'Area (sq mi)', dbKey: 'areaSqMi' },
              { key: 'maxGdpGrowthRate', label: 'Max GDP Growth Rate', dbKey: 'maxGdpGrowthRate' },
              { key: 'adjustedGdpGrowth', label: 'Adjusted GDP Growth', dbKey: 'adjustedGdpGrowth' },
              { key: 'populationGrowthRate', label: 'Population Growth Rate', dbKey: 'populationGrowthRate' },
              { key: 'projected2040Population', label: '2040 Population', dbKey: 'projected2040Population' },
              { key: 'projected2040Gdp', label: '2040 GDP', dbKey: 'projected2040Gdp' },
              { key: 'projected2040GdpPerCapita', label: '2040 GDP per Capita', dbKey: 'projected2040GdpPerCapita' },
              { key: 'actualGdpGrowth', label: 'Actual GDP Growth', dbKey: 'actualGdpGrowth' },
            ];

            for (const field of fieldsToCompare) {
              const newValue = (countryData as any)[field.key];
              const oldValue = (existing as any)[field.dbKey];
              
              // Compare values with tolerance for numbers
              let hasChanged = false;
              if (typeof newValue === 'number' && typeof oldValue === 'number') {
                hasChanged = Math.abs(newValue - oldValue) > 0.01;
              } else {
                hasChanged = newValue !== oldValue;
              }
              
              if (hasChanged) {
                fieldChanges.push({
                  field: field.key,
                  fieldLabel: field.label,
                  oldValue,
                  newValue,
                });
              }
            }

            if (fieldChanges.length > 0) {
              updatedCountries++;
              changes.push({
                type: 'update',
                country: countryData,
                existingData: existing,
                changes: fieldChanges,
              });
            }
          }
        }

        const analysis: ImportAnalysis = {
          totalCountries: parseResult.data.length,
          newCountries,
          updatedCountries,
          unchangedCountries: parseResult.data.length - newCountries - updatedCountries,
          changes,
          analysisTime: Date.now(),
        };

        console.log(`[Import Analysis] ${analysis.totalCountries} countries analyzed: ${analysis.newCountries} new, ${analysis.updatedCountries} updates`);

        return analysis;
      } catch (error) {
        console.error('[Import Analysis] Error:', error);
        throw new Error(`Failed to analyze import file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // Import countries from file
  importCountries: publicProcedure
    .input(z.object({
      fileData: z.string(),
      fileName: z.string(),
      replaceExisting: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Decode and parse file
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        const parseResult = await csvHandler.parseFile(fileBuffer.buffer, input.fileName);
        
        if (!parseResult.success) {
          throw new Error(`Failed to parse file: ${parseResult.errors.join(', ')}`);
        }

        const importedCountries: string[] = [];
        const currentTime = new Date();
        const baselineDate = new Date(IxTime.getInGameEpoch());

        // Process each country
        for (const countryData of parseResult.data) {
          // Initialize country stats
          const initializedStats = dataService.initializeCountries([countryData])[0];
          if (!initializedStats) continue;

          // Prepare data for database
          const dbData = {
            name: countryData.country,
            continent: countryData.continent,
            region: countryData.region,
            governmentType: countryData.governmentType,
            religion: countryData.religion,
            leader: countryData.leader,
            landArea: countryData.landArea,
            areaSqMi: countryData.areaSqMi,
            baselinePopulation: countryData.population,
            baselineGdpPerCapita: countryData.gdpPerCapita,
            maxGdpGrowthRate: countryData.maxGdpGrowthRate,
            adjustedGdpGrowth: countryData.adjustedGdpGrowth,
            populationGrowthRate: countryData.populationGrowthRate,
            projected2040Population: countryData.projected2040Population,
            projected2040Gdp: countryData.projected2040Gdp,
            projected2040GdpPerCapita: countryData.projected2040GdpPerCapita,
            actualGdpGrowth: countryData.actualGdpGrowth,
            currentPopulation: initializedStats.currentPopulation,
            currentGdpPerCapita: initializedStats.currentGdpPerCapita,
            currentTotalGdp: initializedStats.currentTotalGdp,
            populationDensity: initializedStats.populationDensity,
            gdpDensity: initializedStats.gdpDensity,
            economicTier: initializedStats.economicTier,
            populationTier: initializedStats.populationTier,
            localGrowthFactor: initializedStats.localGrowthFactor,
            lastCalculated: currentTime,
            baselineDate: baselineDate,
          };

          // Upsert country
          await ctx.db.country.upsert({
            where: { name: countryData.country },
            create: dbData,
            update: input.replaceExisting ? dbData : {},
          });

          importedCountries.push(countryData.country);
        }

        console.log(`[Import] Successfully imported ${importedCountries.length} countries`);

        return {
          imported: importedCountries.length,
          totalInFile: parseResult.data.length,
          countries: importedCountries,
          importTime: Date.now(),
          timeSource: 'File Import',
        };
      } catch (error) {
        console.error('[Import] Error:', error);
        throw new Error(`Failed to import countries: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),
});