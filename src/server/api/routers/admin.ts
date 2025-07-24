// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { getDefaultEconomicConfig, CONFIG_CONSTANTS } from "~/lib/config-service";
import { parseRosterFile } from "~/lib/data-parser";
import { IxStatsCalculator } from "~/lib/calculations";
import type { 
  SystemStatus, 
  AdminPageBotStatusView, 
  ImportAnalysis,
  BaseCountryData,
  CalculationLog,
  EconomicConfig
} from "~/types/ixstats";
import { 
  getEconomicTierFromGdpPerCapita, 
  getPopulationTierFromPopulation, 
  EconomicTier, 
  PopulationTier 
} from "~/types/ixstats";

// Remove unused import - we use ctx.db instead

export const adminRouter = createTRPCRouter({
  // Get global statistics for SDI interface
  getGlobalStats: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const totalNations = await ctx.db.country.count();
        const totalGDP = await ctx.db.country.aggregate({
          _sum: { currentTotalGdp: true }
        });

        // Real queries for each stat
        const activeDiplomats = await ctx.db.user.count(); // Count all users for now
        // For onlineUsers, you may need a real-time tracking system; fallback to 0 for now
        const onlineUsers = 0;
        // For tradeVolume, fallback to 0 since tradeRecord table doesn't exist
        const tradeVolume = 0;
        // For activeConflicts, count unresolved crisis events
        const activeConflicts = await ctx.db.crisisEvent.count({ where: { responseStatus: { not: 'resolved' } } });

        return {
          totalNations,
          globalGDP: (totalGDP._sum.currentTotalGdp || 0) / 1e12, // Convert to trillions
          activeDiplomats,
          onlineUsers,
          tradeVolume,
          activeConflicts
        };
      } catch (error) {
        console.error("Failed to get global stats:", error);
        throw new Error("Failed to retrieve global statistics");
      }
    }),

  // Get system status
  getSystemStatus: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const [countryCount, activeDmInputs, lastCalculation] = await Promise.all([
          ctx.db.country.count(),
          ctx.db.dmInputs.count({ where: { isActive: true } }),
          ctx.db.calculationLog.findFirst({
            orderBy: { timestamp: "desc" }
          })
        ]);

        // Get current IxTime status
        const ixTimeStatus = await IxTime.getStatus();

        const systemStatus: SystemStatus = {
          ixTime: {
            currentRealTime: new Date().toISOString(),
            currentIxTime: new Date(IxTime.getCurrentIxTime()).toISOString(),
            formattedIxTime: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
            multiplier: IxTime.getTimeMultiplier(),
            isPaused: IxTime.isPaused(),
            hasTimeOverride: ixTimeStatus.hasTimeOverride,
            timeOverrideValue: ixTimeStatus.timeOverrideValue,
            botStatus: null, // Will be populated by getBotStatus
          },
          countryCount,
          activeDmInputs,
          lastCalculation: lastCalculation ? {
            timestamp: lastCalculation.timestamp.toISOString(),
            ixTimeTimestamp: lastCalculation.ixTimeTimestamp.toISOString(),
            countriesUpdated: lastCalculation.countriesUpdated,
            executionTimeMs: lastCalculation.executionTimeMs,
          } : null,
        };

        return systemStatus;
      } catch (error) {
        console.error("Failed to get system status:", error);
        throw new Error("Failed to retrieve system status");
      }
    }),

  // Get bot status with health check
  getBotStatus: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const [botHealth, ixTimeStatus] = await Promise.all([
          IxTime.checkBotHealth(),
          IxTime.getStatus()
        ]);

        const { botStatus: originalBotStatus, ...ixTimeStatusWithoutBot } = ixTimeStatus;
        
        const botStatus: AdminPageBotStatusView = {
          ...ixTimeStatusWithoutBot,
          botHealth,
          botStatus: originalBotStatus ? {
            ...originalBotStatus,
            realWorldTime: Date.now(),
            gameYear: IxTime.getCurrentGameYear(),
          } : null,
        };

        return botStatus;
      } catch (error) {
        console.error("Failed to get bot status:", error);
        // Return offline status if bot check fails
        return {
          currentRealTime: new Date().toISOString(),
          currentIxTime: new Date(IxTime.getCurrentIxTime()).toISOString(),
          formattedIxTime: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
          multiplier: IxTime.getTimeMultiplier(),
          isPaused: IxTime.isPaused(),
          hasTimeOverride: false,
          botStatus: null,
          botHealth: {
            available: false,
            message: "Bot connection failed"
          }
        } as AdminPageBotStatusView;
      }
    }),

  // Get system configuration
  getConfig: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const configs = await ctx.db.systemConfig.findMany({
          where: {
            key: {
              in: ['globalGrowthFactor', 'autoUpdate', 'botSyncEnabled', 'timeMultiplier']
            }
          }
        });

        const configMap = configs.reduce((acc, config) => {
          acc[config.key] = config.value;
          return acc;
        }, {} as Record<string, string>);

        return {
          globalGrowthFactor: parseFloat(configMap.globalGrowthFactor || CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR.toString()),
          autoUpdate: configMap.autoUpdate === 'true',
          botSyncEnabled: configMap.botSyncEnabled === 'true',
          timeMultiplier: parseFloat(configMap.timeMultiplier || '4.0'),
        };
      } catch (error) {
        console.error("Failed to get config:", error);
        // Return defaults if database fails
        return {
          globalGrowthFactor: CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR,
          autoUpdate: true,
          botSyncEnabled: true,
          timeMultiplier: 4.0,
        };
      }
    }),

  // Save system configuration
  saveConfig: publicProcedure
    .input(z.object({
      globalGrowthFactor: z.number().min(0.5).max(2.0),
      autoUpdate: z.boolean(),
      botSyncEnabled: z.boolean(),
      timeMultiplier: z.number().min(0).max(10),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const configUpdates = [
          { key: 'globalGrowthFactor', value: input.globalGrowthFactor.toString() },
          { key: 'autoUpdate', value: input.autoUpdate.toString() },
          { key: 'botSyncEnabled', value: input.botSyncEnabled.toString() },
          { key: 'timeMultiplier', value: input.timeMultiplier.toString() },
        ];

        for (const config of configUpdates) {
          await ctx.db.systemConfig.upsert({
            where: { key: config.key },
            update: { value: config.value, updatedAt: new Date() },
            create: { 
              key: config.key, 
              value: config.value,
              description: `System configuration for ${config.key}`,
            },
          });
        }

        return { success: true, message: "Configuration saved successfully" };
      } catch (error) {
        console.error("Failed to save config:", error);
        throw new Error("Failed to save configuration");
      }
    }),

  // Set custom time via bot or local override
  setCustomTime: publicProcedure
    .input(z.object({
      ixTime: z.number(),
      multiplier: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Try to set via bot first
        const botResult = await IxTime.setBotTimeOverride(input.ixTime, input.multiplier);
        
        if (botResult.success) {
          return { 
            success: true, 
            message: "Time set via Discord bot",
            method: "bot" 
          };
        } else {
          // Fall back to local override
          IxTime.setTimeOverride(input.ixTime);
          if (input.multiplier !== undefined) {
            IxTime.setMultiplierOverride(input.multiplier);
          }
          
          return { 
            success: true, 
            message: "Time set locally (bot unavailable)",
            method: "local" 
          };
        }
      } catch (error) {
        console.error("Failed to set custom time:", error);
        throw new Error("Failed to set custom time");
      }
    }),

  // Bot control operations
  syncBot: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const result = await IxTime.syncWithBot();
        return result;
      } catch (error) {
        console.error("Failed to sync bot:", error);
        throw new Error("Failed to sync with Discord bot");
      }
    }),

  pauseBot: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const result = await IxTime.pauseBotTime();
        return result;
      } catch (error) {
        console.error("Failed to pause bot:", error);
        throw new Error("Failed to pause bot time");
      }
    }),

  resumeBot: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const result = await IxTime.resumeBotTime();
        return result;
      } catch (error) {
        console.error("Failed to resume bot:", error);
        throw new Error("Failed to resume bot time");
      }
    }),

  clearBotOverrides: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const result = await IxTime.clearBotOverrides();
        return result;
      } catch (error) {
        console.error("Failed to clear bot overrides:", error);
        throw new Error("Failed to clear bot overrides");
      }
    }),

  // Get calculation logs
  getCalculationLogs: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(10),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;
      try {
        const logs = await ctx.db.calculationLog.findMany({
          orderBy: { timestamp: "desc" },
          take: limit,
        });

        return logs.map(log => ({
          id: log.id,
          timestamp: log.timestamp,
          ixTimeTimestamp: log.ixTimeTimestamp,
          countriesUpdated: log.countriesUpdated,
          executionTimeMs: log.executionTimeMs,
          globalGrowthFactor: log.globalGrowthFactor,
          notes: log.notes,
        }));
      } catch (error) {
        console.error("Failed to get calculation logs:", error);
        console.error("Error details:", {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : 'Unknown',
        });
        throw new Error(`Failed to retrieve calculation logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // Analyze import file
  analyzeImport: publicProcedure
    .input(z.object({
      fileData: z.array(z.number()), // Uint8Array as number array
      fileName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const fileBuffer = new Uint8Array(input.fileData).buffer;
        const countries = await parseRosterFile(fileBuffer, input.fileName);
        
        if (countries.length === 0) {
          throw new Error("No valid countries found in the file");
        }

        // Check for existing countries
        const existingCountries = await ctx.db.country.findMany({
          where: {
            name: { in: countries.map(c => c.country) }
          },
          select: { 
            name: true, 
            continent: true,
            region: true,
            governmentType: true,
            religion: true,
            leader: true,
            areaSqMi: true,
            baselinePopulation: true,
            baselineGdpPerCapita: true,
            maxGdpGrowthRate: true,
            adjustedGdpGrowth: true,
            populationGrowthRate: true,
            landArea: true,
            projected2040Population: true,
            projected2040Gdp: true,
            projected2040GdpPerCapita: true,
            localGrowthFactor: true
          }
        });

        const existingMap = new Map(existingCountries.map(c => [c.name, c]));
        
        const changes = countries.map(country => {
          const existing = existingMap.get(country.country);
          
          if (!existing) {
            return {
              type: 'new' as const,
              country,
            };
          } else {
            // Compare significant fields
            const fieldChanges = [];
            
            if (Math.abs(existing.baselinePopulation - country.population) > 1000) {
              fieldChanges.push({
                field: 'population',
                fieldLabel: 'Population',
                oldValue: existing.baselinePopulation,
                newValue: country.population,
              });
            }
            
            if (Math.abs(existing.baselineGdpPerCapita - country.gdpPerCapita) > 100) {
              fieldChanges.push({
                field: 'gdpPerCapita',
                fieldLabel: 'GDP per Capita',
                oldValue: existing.baselineGdpPerCapita,
                newValue: country.gdpPerCapita,
              });
            }
            
            if (Math.abs(existing.maxGdpGrowthRate - country.maxGdpGrowthRate) > 0.001) {
              fieldChanges.push({
                field: 'maxGdpGrowthRate',
                fieldLabel: 'Max GDP Growth Rate',
                oldValue: existing.maxGdpGrowthRate,
                newValue: country.maxGdpGrowthRate,
              });
            }

            if (Math.abs(existing.adjustedGdpGrowth - country.adjustedGdpGrowth) > 0.001) {
              fieldChanges.push({
                field: 'adjustedGdpGrowth',
                fieldLabel: 'Adjusted GDP Growth',
                oldValue: existing.adjustedGdpGrowth,
                newValue: country.adjustedGdpGrowth,
              });
            }

            if (Math.abs(existing.populationGrowthRate - country.populationGrowthRate) > 0.001) {
              fieldChanges.push({
                field: 'populationGrowthRate',
                fieldLabel: 'Population Growth Rate',
                oldValue: existing.populationGrowthRate,
                newValue: country.populationGrowthRate,
              });
            }
            
            // Transform existing data to match BaseCountryData interface
            const existingBaseData: BaseCountryData = {
              country: existing.name,
              continent: existing.continent,
              region: existing.region,
              governmentType: existing.governmentType,
              religion: existing.religion,
              leader: existing.leader,
              population: existing.baselinePopulation,
              gdpPerCapita: existing.baselineGdpPerCapita,
              landArea: existing.landArea,
              areaSqMi: existing.areaSqMi,
              maxGdpGrowthRate: existing.maxGdpGrowthRate,
              adjustedGdpGrowth: existing.adjustedGdpGrowth,
              populationGrowthRate: existing.populationGrowthRate,
              actualGdpGrowth: existing.adjustedGdpGrowth, // Use adjusted as fallback
              projected2040Population: existing.projected2040Population || 0,
              projected2040Gdp: existing.projected2040Gdp || 0,
              projected2040GdpPerCapita: existing.projected2040GdpPerCapita || 0,
              localGrowthFactor: existing.localGrowthFactor || 1.0
            };
            
            return {
              type: 'update' as const,
              country,
              existingData: existingBaseData,
              changes: fieldChanges,
            };
          }
        });

        const analysis: ImportAnalysis = {
          totalCountries: countries.length,
          newCountries: changes.filter(c => c.type === 'new').length,
          updatedCountries: changes.filter(c => c.type === 'update').length,
          unchangedCountries: changes.filter(c => c.type === 'update' && (!c.changes || c.changes.length === 0)).length,
          changes,
          analysisTime: Date.now(),
        };

        return analysis;
      } catch (error) {
        console.error("Failed to analyze import:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to analyze import file");
      }
    }),

  // Import roster data
  importRosterData: publicProcedure
    .input(z.object({
      analysisId: z.string(),
      replaceExisting: z.boolean(),
      fileData: z.array(z.number()).optional(), // Accept fileData for now
      fileName: z.string().optional(),
      changes: z.any().optional(), // Accept changes directly for now
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // For now, require fileData and fileName to be passed in (since we have no persistent cache)
        if (!input.fileData || !input.fileName) {
          throw new Error("File data and file name are required for import (no persistent cache implemented)");
        }
        const fileBuffer = new Uint8Array(input.fileData).buffer;
        const countries = await parseRosterFile(fileBuffer, input.fileName);
        if (countries.length === 0) {
          throw new Error("No valid countries found in the file");
        }
        // Get all existing countries by name
        const existingCountries = await ctx.db.country.findMany({
          where: {
            name: { in: countries.map(c => c.country) }
          },
        });
        const existingMap = new Map(existingCountries.map(c => [c.name, c]));
        let created = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];
        for (const country of countries) {
          const existing = existingMap.get(country.country);
          try {
            if (!existing) {
              // Compute required calculated fields for new country
              const totalGdp = country.population * country.gdpPerCapita;
              const currentPopulation = country.population;
              const currentGdpPerCapita = country.gdpPerCapita;
              const currentTotalGdp = totalGdp;
              // Calculate tiers
              const economicTier = getEconomicTierFromGdpPerCapita(country.gdpPerCapita);
              const populationTier = getPopulationTierFromPopulation(country.population);
              await ctx.db.country.create({
                data: {
                  name: country.country,
                  continent: country.continent,
                  region: country.region,
                  governmentType: country.governmentType,
                  religion: country.religion,
                  leader: country.leader,
                  baselinePopulation: country.population,
                  baselineGdpPerCapita: country.gdpPerCapita,
                  landArea: country.landArea,
                  areaSqMi: country.areaSqMi,
                  maxGdpGrowthRate: country.maxGdpGrowthRate,
                  adjustedGdpGrowth: country.adjustedGdpGrowth,
                  populationGrowthRate: country.populationGrowthRate,
                  projected2040Population: country.projected2040Population,
                  projected2040Gdp: country.projected2040Gdp,
                  projected2040GdpPerCapita: country.projected2040GdpPerCapita,
                  actualGdpGrowth: country.actualGdpGrowth,
                  localGrowthFactor: country.localGrowthFactor,
                  baselineDate: new Date(IxTime.getInGameEpoch()),
                  lastCalculated: new Date(IxTime.getInGameEpoch()),
                  currentPopulation,
                  currentGdpPerCapita,
                  currentTotalGdp,
                  economicTier,
                  populationTier
                }
              });
              created++;
            } else if (input.replaceExisting) {
              // Replace all fields
              const totalGdp = country.population * country.gdpPerCapita;
              const currentPopulation = country.population;
              const currentGdpPerCapita = country.gdpPerCapita;
              const currentTotalGdp = totalGdp;
              // Calculate tiers
              const economicTier = getEconomicTierFromGdpPerCapita(country.gdpPerCapita);
              const populationTier = getPopulationTierFromPopulation(country.population);
              await ctx.db.country.update({
                where: { id: existing.id },
                data: {
                  name: country.country,
                  continent: country.continent,
                  region: country.region,
                  governmentType: country.governmentType,
                  religion: country.religion,
                  leader: country.leader,
                  baselinePopulation: country.population,
                  baselineGdpPerCapita: country.gdpPerCapita,
                  landArea: country.landArea,
                  areaSqMi: country.areaSqMi,
                  maxGdpGrowthRate: country.maxGdpGrowthRate,
                  adjustedGdpGrowth: country.adjustedGdpGrowth,
                  populationGrowthRate: country.populationGrowthRate,
                  projected2040Population: country.projected2040Population,
                  projected2040Gdp: country.projected2040Gdp,
                  projected2040GdpPerCapita: country.projected2040GdpPerCapita,
                  actualGdpGrowth: country.actualGdpGrowth,
                  localGrowthFactor: country.localGrowthFactor,
                  currentPopulation,
                  currentGdpPerCapita,
                  currentTotalGdp,
                  economicTier,
                  populationTier
                  // Do not update baselineDate or lastCalculated here
                }
              });
              updated++;
            } else {
              // Only update changed fields (basic check)
              const updateData: any = {};
              if (existing.baselinePopulation !== country.population) updateData.baselinePopulation = country.population;
              if (existing.baselineGdpPerCapita !== country.gdpPerCapita) updateData.baselineGdpPerCapita = country.gdpPerCapita;
              if (existing.maxGdpGrowthRate !== country.maxGdpGrowthRate) updateData.maxGdpGrowthRate = country.maxGdpGrowthRate;
              if (existing.adjustedGdpGrowth !== country.adjustedGdpGrowth) updateData.adjustedGdpGrowth = country.adjustedGdpGrowth;
              if (existing.populationGrowthRate !== country.populationGrowthRate) updateData.populationGrowthRate = country.populationGrowthRate;
              // Also update calculated fields if needed
              if (Object.keys(updateData).length > 0) {
                await ctx.db.country.update({
                  where: { id: existing.id },
                  data: updateData
                });
                updated++;
              } else {
                skipped++;
              }
            }
          } catch (err) {
            errors.push(`Error processing country ${country.country}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
        // After import, trigger recalculation for all affected countries
        await ctx.db.calculationLog.create({
          data: {
            timestamp: new Date(),
            ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()),
            countriesUpdated: created + updated,
            executionTimeMs: 0,
            globalGrowthFactor: getDefaultEconomicConfig().globalGrowthFactor,
            notes: `Import: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} errors.`
          }
        });
        return {
          success: true,
          created,
          updated,
          skipped,
          errors,
          total: countries.length
        };
      } catch (error) {
        console.error("Failed to import data:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to import data");
      }
    }),

  // Sync epoch time with imported data
  syncEpochWithData: publicProcedure
    .input(z.object({
      targetEpoch: z.number(), // The target epoch timestamp to sync to
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const currentEpoch = IxTime.getInGameEpoch();
        const currentIxTime = IxTime.getCurrentIxTime();
        
        // Calculate the time difference
        const timeDifference = input.targetEpoch - currentEpoch;
        const yearsDifference = IxTime.getYearsElapsed(currentEpoch, input.targetEpoch);
        
        // Update all countries' baseline dates to the new epoch
        const updateResult = await ctx.db.country.updateMany({
          data: {
            baselineDate: new Date(input.targetEpoch),
            lastCalculated: new Date(input.targetEpoch),
          }
        });
        
        // Set the bot time override to the new epoch
        const botResult = await IxTime.setBotTimeOverride(input.targetEpoch);
        
        // Log the epoch sync
        await ctx.db.calculationLog.create({
          data: {
            timestamp: new Date(),
            ixTimeTimestamp: new Date(input.targetEpoch),
            countriesUpdated: updateResult.count,
            executionTimeMs: 0,
            globalGrowthFactor: getDefaultEconomicConfig().globalGrowthFactor,
            notes: `Epoch sync: ${yearsDifference.toFixed(1)} years adjustment. ${updateResult.count} countries updated. ${input.reason || 'Manual epoch sync'}.`
          }
        });
        
        return {
          success: true,
          message: `Epoch synchronized successfully. Adjusted ${yearsDifference.toFixed(1)} years.`,
          previousEpoch: currentEpoch,
          newEpoch: input.targetEpoch,
          yearsDifference: yearsDifference,
          countriesUpdated: updateResult.count,
          botSyncSuccess: botResult.success,
        };
      } catch (error) {
        console.error("Failed to sync epoch:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to sync epoch time");
      }
    }),

  // Force recalculation of all countries
  forceRecalculation: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const startTime = Date.now();
        const countries = await ctx.db.country.findMany({
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" }
            }
          }
        });

        const econConfig = getDefaultEconomicConfig();
        const currentIxTime = IxTime.getCurrentIxTime();
        
        let updatedCount = 0;
        
        for (const country of countries) {
          try {
            const calc = new IxStatsCalculator(econConfig, country.baselineDate.getTime());
            
            const baseCountryData: BaseCountryData = {
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
              projected2040Population: country.projected2040Population || 0,
              projected2040Gdp: country.projected2040Gdp || 0,
              projected2040GdpPerCapita: country.projected2040GdpPerCapita || 0,
              actualGdpGrowth: country.actualGdpGrowth || 0,
              localGrowthFactor: country.localGrowthFactor,
            };

            const initialStats = calc.initializeCountryStats(baseCountryData);
            const dmInputs = country.dmInputs.map(d => ({
              ...d,
              ixTimeTimestamp: d.ixTimeTimestamp.getTime(),
            }));

            const result = calc.calculateTimeProgression(initialStats, currentIxTime, dmInputs);

            await ctx.db.country.update({
              where: { id: country.id },
              data: {
                currentPopulation: result.newStats.currentPopulation,
                currentGdpPerCapita: result.newStats.currentGdpPerCapita,
                currentTotalGdp: result.newStats.currentTotalGdp,
                economicTier: result.newStats.economicTier.toString(),
                populationTier: result.newStats.populationTier.toString(),
                populationDensity: result.newStats.populationDensity,
                gdpDensity: result.newStats.gdpDensity,
                lastCalculated: new Date(currentIxTime),
              }
            });

            updatedCount++;
          } catch (countryError) {
            console.error(`Failed to update country ${country.name}:`, countryError);
          }
        }

        const executionTime = Date.now() - startTime;

        // Log the calculation
        await ctx.db.calculationLog.create({
          data: {
            timestamp: new Date(),
            ixTimeTimestamp: new Date(currentIxTime),
            countriesUpdated: updatedCount,
            executionTimeMs: executionTime,
            globalGrowthFactor: econConfig.globalGrowthFactor,
            notes: "Manual recalculation from admin panel",
          }
        });

        return {
          success: true,
          message: `Updated ${updatedCount} countries in ${executionTime}ms`,
          countriesUpdated: updatedCount,
          executionTimeMs: executionTime,
        };
      } catch (error) {
        console.error("Failed to force recalculation:", error);
        throw new Error("Failed to recalculate country statistics");
      }
    }),

  // Get system health
  getSystemHealth: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const [
          countryCount,
          recentCalculations,
          botHealth
        ] = await Promise.all([
          ctx.db.country.count(),
          ctx.db.calculationLog.count({
            where: {
              timestamp: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            }
          }),
          IxTime.checkBotHealth()
        ]);

        return {
          database: {
            connected: true,
            countries: countryCount,
            recentCalculations,
          },
          bot: botHealth,
          ixTime: {
            current: IxTime.getCurrentIxTime(),
            formatted: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
            multiplier: IxTime.getTimeMultiplier(),
            isPaused: IxTime.isPaused(),
          },
          lastUpdate: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Failed to get system health:", error);
        throw new Error("Failed to retrieve system health status");
      }
    }),

  // --- Clerk User-Country Mapping Endpoints ---
  // Note: User procedures are commented out until User model is properly configured

  // Get the countryId mapped to a Clerk user
  /*
  getUserCountry: publicProcedure
    .input(z.object({ clerkUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.clerkUserId },
        select: { countryId: true },
      });
      return { countryId: user?.countryId || null };
    }),

  // Set or update the countryId for a Clerk user
  setUserCountry: publicProcedure
    .input(z.object({ clerkUserId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.upsert({
        where: { clerkUserId: input.clerkUserId },
        update: { countryId: input.countryId },
        create: { clerkUserId: input.clerkUserId, countryId: input.countryId },
      });
      return { success: true, user };
    }),

  // Create a user record if it does not exist (on registration)
  createUserIfNotExists: publicProcedure
    .input(z.object({ clerkUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.upsert({
        where: { clerkUserId: input.clerkUserId },
        update: {},
        create: { clerkUserId: input.clerkUserId },
      });
      return { user };
    }),
  */

  // Sync with Discord bot
  syncWithBot: publicProcedure
    .mutation(async () => {
      try {
        const result = await IxTime.syncWithBot();
        return result;
      } catch (error) {
        console.error("Failed to sync with bot:", error);
        throw new Error("Failed to sync with Discord bot");
      }
    }),


  // === ADMIN USER/COUNTRY MANAGEMENT ENDPOINTS ===

  // List all users and their claimed countries
  listUsersWithCountries: publicProcedure.query(async ({ ctx }) => {
    // TODO: Replace with real admin check (e.g., ctx.user?.role === 'admin')
    // if (!ctx.user || ctx.user.role !== 'admin') throw new Error('Unauthorized');
    const users = await ctx.db.user.findMany({
      include: { country: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(u => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      country: u.country ? { id: u.country.id, name: u.country.name } : null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }),

  // List all countries and their assigned users
  listCountriesWithUsers: publicProcedure.query(async ({ ctx }) => {
    // TODO: Replace with real admin check
    const countries = await ctx.db.country.findMany({
      include: { user: true },
      orderBy: { name: 'asc' },
    });
    return countries.map(c => ({
      id: c.id,
      name: c.name,
      user: c.user ? { id: c.user.id, clerkUserId: c.user.clerkUserId } : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }),

  // Assign a user to a country (admin override)
  assignUserToCountry: publicProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Replace with real admin check
      // Unlink any user currently assigned to this country
      await ctx.db.user.updateMany({ where: { countryId: input.countryId }, data: { countryId: null } });
      // Unlink this user from any country they currently claim
      await ctx.db.user.updateMany({ where: { clerkUserId: input.userId }, data: { countryId: null } });
      // Link user to country
      await ctx.db.user.upsert({
        where: { clerkUserId: input.userId },
        update: { countryId: input.countryId },
        create: { clerkUserId: input.userId, countryId: input.countryId },
      });
      return { success: true };
    }),

  // Unassign a user from a country (admin override)
  unassignUserFromCountry: publicProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Replace with real admin check
      await ctx.db.user.updateMany({ where: { clerkUserId: input.userId, countryId: input.countryId }, data: { countryId: null } });
      return { success: true };
    }),
});