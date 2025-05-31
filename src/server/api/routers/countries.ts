// src/server/api/routers/countries.ts
// Fixed TypeScript errors for new schema fields

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxStatsDataService } from "~/lib/data-service";
import { IxTime } from "~/lib/ixtime";
import { excelHandler } from "~/lib/excel-handler";
import type { BaseCountryData, ImportAnalysis, EconomicTier, PopulationTier, CountryStats } from "~/types/ixstats"; 

export const countriesRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany({
      orderBy: { name: "asc" },
    });
    
    return countries.map(country => ({
      ...country,
      lastCalculated: country.lastCalculated.getTime(),
      baselineDate: country.baselineDate.getTime(),
    }));
  }),

  // Add getGlobalStats procedure
  getGlobalStats: publicProcedure.query(async ({ ctx }) => {
    try {
      // Get basic stats for all countries
      const countries = await ctx.db.country.findMany({
        select: {
          id: true,
          name: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          economicTier: true,
          populationTier: true,
          landArea: true,
        },
      });

      // Calculate global stats
      const totalPopulation = countries.reduce((sum, c) => sum + c.currentPopulation, 0);
      const totalGdp = countries.reduce((sum, c) => sum + c.currentTotalGdp, 0);
      const averageGdpPerCapita = totalPopulation > 0 ? totalGdp / totalPopulation : 0;
      
      // Calculate tier distributions
      const economicTierDistribution = countries.reduce((acc, country) => {
        acc[country.economicTier] = (acc[country.economicTier] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const populationTierDistribution = countries.reduce((acc, country) => {
        acc[country.populationTier] = (acc[country.populationTier] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Calculate density metrics
      const countriesWithArea = countries.filter(c => c.landArea && c.landArea > 0);
      const totalLandArea = countriesWithArea.reduce((sum, c) => sum + (c.landArea || 0), 0);
      
      const averagePopulationDensity = totalLandArea > 0 
        ? countriesWithArea.reduce((sum, c) => sum + (c.currentPopulation / (c.landArea || 1)), 0) / countriesWithArea.length
        : 0;
        
      const averageGdpDensity = totalLandArea > 0
        ? countriesWithArea.reduce((sum, c) => sum + (c.currentTotalGdp / (c.landArea || 1)), 0) / countriesWithArea.length
        : 0;
      
      // Get the current game time
      const currentIxTime = IxTime.getCurrentIxTime();
      
      return {
        totalCountries: countries.length,
        totalPopulation,
        totalGdp,
        averageGdpPerCapita,
        economicTierDistribution,
        populationTierDistribution,
        averagePopulationDensity,
        averageGdpDensity,
        ixTimeTimestamp: currentIxTime,
        formattedTime: IxTime.formatIxTime(currentIxTime),
        gameYear: IxTime.getCurrentGameYear(),
        lastUpdated: new Date().toISOString(),
        // Add fields needed for GlobalEconomicSnapshot compatibility
        countryCount: countries.length,
        globalGrowthRate: 0.03 // Default value, you might want to calculate this
      };
    } catch (error) {
      console.error("Error in getGlobalStats:", error);
      throw new Error(`Failed to get global statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
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

      return {
        ...country,
        lastCalculated: country.lastCalculated.getTime(),
        baselineDate: country.baselineDate.getTime(),
        historicalData: country.historicalData.map(point => ({
          ...point,
          ixTimeTimestamp: point.ixTimeTimestamp.getTime(),
        })),
        dmInputs: country.dmInputs.map(input => ({
          ...input,
          ixTimeTimestamp: input.ixTimeTimestamp.getTime(),
        })),
      };
    }),

  analyzeImport: publicProcedure
    .input(z.object({
      fileData: z.string(),
      fileName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }): Promise<ImportAnalysis> => {
      const startTime = Date.now();
      
      try {
        // Only support Excel files
        if (input.fileName && !input.fileName.toLowerCase().match(/\.(xlsx|xls)$/)) {
          throw new Error('Only Excel files (.xlsx, .xls) are supported. CSV import has been removed.');
        }

        // Decode the file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        
        // Parse the Excel file
        const parseResult = await excelHandler.parseFile(fileBuffer.buffer, input.fileName);
        
        if (!parseResult.success) {
          throw new Error(`Excel parsing failed: ${parseResult.errors.join(', ')}`);
        }

        const importedCountries = parseResult.data;
        console.log(`[Countries Router] Parsed ${importedCountries.length} countries from Excel file`);

        // Get existing countries for comparison - only include fields that exist in database
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
          },
        });

        const existingCountryMap = new Map(
          existingCountries.map(country => [country.name.toLowerCase(), country])
        );

        // Analyze changes
        const changes: ImportAnalysis['changes'] = [];
        let newCountries = 0;
        let updatedCountries = 0;
        let unchangedCountries = 0;

        for (const country of importedCountries) {
          const existing = existingCountryMap.get(country.country.toLowerCase());
          
          if (!existing) {
            // New country
            changes.push({
              type: 'new',
              country,
            });
            newCountries++;
          } else {
            // Enhance existing with empty projected fields for comparison
            const enhancedExisting = {
              ...existing,
              // Add missing fields with default values for comparison
              projected2040Population: 0, 
              projected2040Gdp: 0,
              projected2040GdpPerCapita: 0,
              actualGdpGrowth: 0,
            };

            // Check for changes in the core fields
            const fieldChanges: Array<{
              field: string;
              oldValue: any;
              newValue: any;
              fieldLabel: string;
            }> = [];

            // Helper function to check field changes
            const checkField = (
              field: keyof BaseCountryData, 
              oldVal: any, 
              newVal: any, 
              label: string
            ) => {
              // Handle null/undefined comparisons
              const normalizedOld = oldVal ?? null;
              const normalizedNew = newVal ?? null;
              
              if (typeof normalizedOld === 'number' && typeof normalizedNew === 'number') {
                // For numbers, check if difference is significant (>0.1% or >0.001 absolute)
                const diff = Math.abs(normalizedOld - normalizedNew);
                const relDiff = normalizedOld !== 0 ? diff / Math.abs(normalizedOld) : diff;
                if (diff > 0.0001 && relDiff > 0.0001) {
                  fieldChanges.push({ field, oldValue: normalizedOld, newValue: normalizedNew, fieldLabel: label });
                }
              } else if (normalizedOld !== normalizedNew) {
                fieldChanges.push({ field, oldValue: normalizedOld, newValue: normalizedNew, fieldLabel: label });
              }
            };

            // Check all BaseCountryData fields
            checkField('continent', enhancedExisting.continent, country.continent, 'Continent');
            checkField('region', enhancedExisting.region, country.region, 'Region');
            checkField('governmentType', enhancedExisting.governmentType, country.governmentType, 'Government Type');
            checkField('religion', enhancedExisting.religion, country.religion, 'Religion');
            checkField('leader', enhancedExisting.leader, country.leader, 'Leader');
            checkField('population', enhancedExisting.baselinePopulation, country.population, 'Population');
            checkField('gdpPerCapita', enhancedExisting.baselineGdpPerCapita, country.gdpPerCapita, 'GDP per Capita');
            checkField('landArea', enhancedExisting.landArea, country.landArea, 'Land Area (km²)');
            checkField('areaSqMi', enhancedExisting.areaSqMi, country.areaSqMi, 'Area (sq mi)');
            checkField('maxGdpGrowthRate', enhancedExisting.maxGdpGrowthRate, country.maxGdpGrowthRate, 'Max GDP Growth Rate');
            checkField('adjustedGdpGrowth', enhancedExisting.adjustedGdpGrowth, country.adjustedGdpGrowth, 'Adjusted GDP Growth');
            checkField('populationGrowthRate', enhancedExisting.populationGrowthRate, country.populationGrowthRate, 'Population Growth Rate');
            checkField('projected2040Population', enhancedExisting.projected2040Population, country.projected2040Population, '2040 Population');
            checkField('projected2040Gdp', enhancedExisting.projected2040Gdp, country.projected2040Gdp, '2040 GDP');
            checkField('projected2040GdpPerCapita', enhancedExisting.projected2040GdpPerCapita, country.projected2040GdpPerCapita, '2040 GDP PC');
            checkField('actualGdpGrowth', enhancedExisting.actualGdpGrowth, country.actualGdpGrowth, 'Actual GDP Growth');

            if (fieldChanges.length > 0) {
              changes.push({
                type: 'update',
                country,
                existingData: enhancedExisting,
                changes: fieldChanges,
              });
              updatedCountries++;
            } else {
              unchangedCountries++;
            }
          }
        }

        const analysisTime = Date.now() - startTime;
        
        console.log(`[Countries Router] Analysis complete: ${newCountries} new, ${updatedCountries} updated, ${unchangedCountries} unchanged in ${analysisTime}ms`);

        return {
          totalCountries: importedCountries.length,
          newCountries,
          updatedCountries,
          unchangedCountries,
          changes,
          analysisTime,
        };

      } catch (error) {
        console.error('[Countries Router] Analysis error:', error);
        throw new Error(`Failed to analyze Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  importFromExcel: publicProcedure
    .input(z.object({
      fileData: z.string(), 
      fileName: z.string().optional(),
      replaceExisting: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      
      try {
        // Only support Excel files
        if (input.fileName && !input.fileName.toLowerCase().match(/\.(xlsx|xls)$/)) {
          throw new Error('Only Excel files (.xlsx, .xls) are supported. CSV import has been removed.');
        }

        // Decode the file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        
        // Parse the Excel file
        const parseResult = await excelHandler.parseFile(fileBuffer.buffer, input.fileName);
        
        if (!parseResult.success) {
          throw new Error(`Excel parsing failed: ${parseResult.errors.join(', ')}`);
        }

        const importedCountries = parseResult.data;
        console.log(`[Countries Router] Starting import of ${importedCountries.length} countries`);

        // Initialize data service
        const dataService = new IxStatsDataService(IxStatsDataService.getDefaultConfig());
        const currentIxTime = IxTime.getCurrentIxTime();
        const gameEpoch = IxTime.getInGameEpoch();
        
        let imported = 0;
        const importedCountryNames: string[] = [];
        
        // Process each country
        for (const countryData of importedCountries) {
          try {
            const existing = await ctx.db.country.findUnique({
              where: { name: countryData.country },
            });

            if (existing && !input.replaceExisting) {
              console.log(`[Countries Router] Skipping existing country: ${countryData.country}`);
              continue;
            }

            // Initialize the country stats
            const countryStats = dataService.getCalculator().initializeCountryStats(countryData);
            
            // Prepare the data for database insertion/update
            const countryDbData = {
              name: countryData.country,
              continent: countryData.continent,
              region: countryData.region,
              governmentType: countryData.governmentType,
              religion: countryData.religion,
              leader: countryData.leader,
              landArea: countryData.landArea,
              areaSqMi: countryData.areaSqMi,
              
              // Baseline data (from Excel - represents 2028)
              baselinePopulation: countryData.population,
              baselineGdpPerCapita: countryData.gdpPerCapita,
              maxGdpGrowthRate: countryData.maxGdpGrowthRate,
              adjustedGdpGrowth: countryData.adjustedGdpGrowth,
              populationGrowthRate: countryData.populationGrowthRate,
              
              // Current calculated values (start at baseline)
              currentPopulation: countryStats.currentPopulation,
              currentGdpPerCapita: countryStats.currentGdpPerCapita,
              currentTotalGdp: countryStats.currentTotalGdp,
              populationDensity: countryStats.populationDensity,
              gdpDensity: countryStats.gdpDensity,
              
              // Classification
              economicTier: countryStats.economicTier,
              populationTier: countryStats.populationTier,
              
              // System fields
              localGrowthFactor: 1.0,
              lastCalculated: new Date(currentIxTime),
              baselineDate: new Date(gameEpoch),
              
              // Use database default values for projection fields
              // projected2040Population, projected2040Gdp, projected2040GdpPerCapita, and actualGdpGrowth
              // will use default(0) from the schema
            };

            if (existing) {
              // Update existing country
              await ctx.db.country.update({
                where: { id: existing.id },
                data: {
                  ...countryDbData,
                  updatedAt: new Date(),
                },
              });
              console.log(`[Countries Router] Updated country: ${countryData.country}`);
            } else {
              // Create new country
              await ctx.db.country.create({
                data: countryDbData,
              });
              console.log(`[Countries Router] Created country: ${countryData.country}`);
            }

            imported++;
            importedCountryNames.push(countryData.country);
            
          } catch (error) {
            console.error(`[Countries Router] Error importing ${countryData.country}:`, error);
            // Continue with other countries rather than failing completely
          }
        }

        const importTime = Date.now() - startTime;
        const timeSource = IxTime.formatIxTime(currentIxTime, true);

        console.log(`[Countries Router] Import complete: ${imported}/${importedCountries.length} countries imported in ${importTime}ms`);

        return {
          imported,
          totalInFile: importedCountries.length,
          countries: importedCountryNames,
          importTime,
          timeSource,
        };

      } catch (error) {
        console.error('[Countries Router] Import error:', error);
        throw new Error(`Failed to import Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  updateStats: publicProcedure
    .input(z.object({
      countryId: z.string(),
      targetTime: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
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

      // Initialize data service and calculator
      const dataService = new IxStatsDataService(IxStatsDataService.getDefaultConfig());
      
      // Convert database country to CountryStats format, handling missing fields
      const countryStats: CountryStats = {
        ...country,
        country: country.name, // Ensure 'country' field is present
        name: country.name,
        population: country.baselinePopulation,
        gdpPerCapita: country.baselineGdpPerCapita,
        totalGdp: country.currentTotalGdp, 
        landArea: country.landArea,
        lastCalculated: country.lastCalculated.getTime(),
        baselineDate: country.baselineDate.getTime(),
        globalGrowthFactor: 1.0321, // Default value, should come from system config
        economicTier: country.economicTier as EconomicTier,
        populationTier: country.populationTier as PopulationTier,
        // Handle potentially missing fields with defaults
        projected2040Population: (country as any).projected2040Population || 0,
        projected2040Gdp: (country as any).projected2040Gdp || 0,
        projected2040GdpPerCapita: (country as any).projected2040GdpPerCapita || 0,
        actualGdpGrowth: (country as any).actualGdpGrowth || 0,
      };

      // Calculate updated stats
      const targetTime = input.targetTime || IxTime.getCurrentIxTime();
      const result = dataService.getCalculator().calculateTimeProgression(
        countryStats,
        targetTime,
        country.dmInputs
      );

      // Update the database
      const updatedCountry = await ctx.db.country.update({
        where: { id: input.countryId },
        data: {
          currentPopulation: result.newStats.currentPopulation,
          currentGdpPerCapita: result.newStats.currentGdpPerCapita,
          currentTotalGdp: result.newStats.currentTotalGdp,
          populationDensity: result.newStats.populationDensity,
          gdpDensity: result.newStats.gdpDensity,
          economicTier: result.newStats.economicTier,
          populationTier: result.newStats.populationTier,
          lastCalculated: new Date(targetTime),
          updatedAt: new Date(),
        },
      });

      // Create historical data point
      await ctx.db.historicalDataPoint.create({
        data: {
          countryId: input.countryId,
          ixTimeTimestamp: new Date(targetTime),
          population: result.newStats.currentPopulation,
          gdpPerCapita: result.newStats.currentGdpPerCapita,
          totalGdp: result.newStats.currentTotalGdp,
          populationGrowthRate: result.newStats.populationGrowthRate,
          gdpGrowthRate: result.newStats.adjustedGdpGrowth,
          landArea: result.newStats.landArea,
          populationDensity: result.newStats.populationDensity,
          gdpDensity: result.newStats.gdpDensity,
        },
      });

      return {
        ...updatedCountry,
        lastCalculated: updatedCountry.lastCalculated.getTime(),
        baselineDate: updatedCountry.baselineDate.getTime(),
        calculationResult: result,
      };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Delete the country (cascade will handle historical data and DM inputs)
      await ctx.db.country.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
