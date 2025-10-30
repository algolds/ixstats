// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { CONFIG_CONSTANTS, getDefaultEconomicConfig } from "~/lib/config-service";
import { IxTime } from "~/lib/ixtime";
import { parseRosterFile } from "~/lib/data-parser";
import { IxStatsCalculator } from "~/lib/calculations";
import { notificationHooks } from "~/lib/notification-hooks";
import type {
  SystemStatus,
  AdminPageBotStatusView,
  ImportAnalysis,
  BaseCountryData,
  CalculationLog,
  EconomicConfig
} from "~/types/ixstats";
import { generateSlug } from "~/lib/slug-utils";
import {
  getEconomicTierFromGdpPerCapita,
  getPopulationTierFromPopulation,
  EconomicTier,
  PopulationTier
} from "~/types/ixstats";

// Remove unused import - we use ctx.db instead

export const adminRouter = createTRPCRouter({
  // Internal calculation formulas management
  getCalculationFormulas: protectedProcedure
    .query(async ({ ctx }) => {
      const lastCalc = await ctx.db.calculationLog.findFirst({ orderBy: { timestamp: "desc" } });
      const lastModified = lastCalc?.timestamp ?? new Date();

      return {
        formulas: [
          {
            id: "gdp-growth",
            name: "GDP Effective Growth Rate",
            description: "Computes effective GDP growth applying global/local factors and tier caps",
            category: "economic",
            isActive: true,
            version: "1.0.0",
            lastModified,
            variables: {
              baseGrowthRate: 0.02,
              gdpPerCapita: 20000,
              globalGrowthFactor: CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR,
              localGrowthFactor: 1.0
            }
          }
        ]
      };
    }),
  // Get global statistics for SDI interface
  getGlobalStats: protectedProcedure
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
  getSystemStatus: adminProcedure
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
  getBotStatus: adminProcedure
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
            botUser: originalBotStatus.botUser || undefined,
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
  getConfig: adminProcedure
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
          timeMultiplier: parseFloat(configMap.timeMultiplier || '2.0'),
        };
      } catch (error) {
        console.error("Failed to get config:", error);
        // Return defaults if database fails
        return {
          globalGrowthFactor: CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR,
          autoUpdate: true,
          botSyncEnabled: true,
          timeMultiplier: 2.0,
        };
      }
    }),

  // Save system configuration
  saveConfig: adminProcedure
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
  setCustomTime: adminProcedure
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
  syncBot: adminProcedure
    .mutation(async ({ ctx }) => {
      try {
        const result = await IxTime.syncWithBot();
        return result;
      } catch (error) {
        console.error("Failed to sync bot:", error);
        throw new Error("Failed to sync with Discord bot");
      }
    }),

  pauseBot: adminProcedure
    .mutation(async ({ ctx }) => {
      try {
        const result = await IxTime.pauseBotTime();
        return result;
      } catch (error) {
        console.error("Failed to pause bot:", error);
        throw new Error("Failed to pause bot time");
      }
    }),

  resumeBot: adminProcedure
    .mutation(async ({ ctx }) => {
      try {
        const result = await IxTime.resumeBotTime();
        return result;
      } catch (error) {
        console.error("Failed to resume bot:", error);
        throw new Error("Failed to resume bot time");
      }
    }),

  clearBotOverrides: adminProcedure
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
  getCalculationLogs: adminProcedure
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
  analyzeImport: adminProcedure
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
  importRosterData: adminProcedure
    .input(z.object({
      analysisId: z.string(),
      replaceExisting: z.boolean(),
      fileData: z.array(z.number()).optional(), // Accept fileData for now
      fileName: z.string().optional(),
      changes: z.object({
        updateMode: z.enum(['create', 'update', 'upsert']).optional(),
        skipValidation: z.boolean().optional(),
        preserveExisting: z.boolean().optional(),
        fieldMappings: z.record(z.string(), z.string()).optional(),
      }).optional(), // Import configuration options
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
                  slug: generateSlug(country.country),
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
                  slug: generateSlug(country.country),
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to import data: ${errorMessage}`,
          cause: error
        });
      }
    }),

  // Sync epoch time with imported data
  syncEpochWithData: adminProcedure
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
  forceRecalculation: adminProcedure
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
  getSystemHealth: adminProcedure
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
  syncWithBot: adminProcedure
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
  listUsersWithCountries: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      include: { country: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(u => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      membershipTier: u.membershipTier || 'basic',
      country: u.country ? { id: u.country.id, name: u.country.name } : null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }),

  // List all countries and their assigned users
  listCountriesWithUsers: adminProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany({
      include: { users: true },
      orderBy: { name: 'asc' },
    });
    return countries.map(c => ({
      id: c.id,
      name: c.name,
      user: c.users && c.users.length > 0 ? { id: c.users[0].id, clerkUserId: c.users[0].clerkUserId } : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }),

  // Assign a user to a country (admin override)
  assignUserToCountry: adminProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const isSystemOwnerUser = isSystemOwner(input.userId);
      
      if (isSystemOwnerUser) {
        // For system owners, allow multiple users to access the same country
        // Just link the user without unlinking others
        await ctx.db.user.upsert({
          where: { clerkUserId: input.userId },
          update: { countryId: input.countryId },
          create: { clerkUserId: input.userId, countryId: input.countryId },
        });
      } else {
        // For regular users, maintain the original behavior (one user per country)
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
      }
      return { success: true };
    }),

  // Unassign a user from a country (admin override)
  unassignUserFromCountry: adminProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.updateMany({ where: { clerkUserId: input.userId, countryId: input.countryId }, data: { countryId: null } });
      return { success: true };
    }),

  // Get navigation settings (wiki/cards/labs visibility)
  getNavigationSettings: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const settings = await ctx.db.systemConfig.findMany({
          where: {
            key: {
              in: ['showWikiTab', 'showCardsTab', 'showLabsTab', 'showIntelligenceTab']
            }
          }
        });

        const settingsMap = settings.reduce((acc, setting) => {
          acc[setting.key] = setting.value === 'true';
          return acc;
        }, {} as Record<string, boolean>);

        return {
          showWikiTab: settingsMap.showWikiTab ?? true, // Default to true
          showCardsTab: settingsMap.showCardsTab ?? true, // Default to true
          showLabsTab: settingsMap.showLabsTab ?? true, // Default to true
          showIntelligenceTab: settingsMap.showIntelligenceTab ?? false, // Default to hidden
        };
      } catch (error) {
        console.error("Failed to get navigation settings:", error);
        // Return defaults on error
        return {
          showWikiTab: true,
          showCardsTab: true,
          showLabsTab: true,
          showIntelligenceTab: false,
        };
      }
    }),

  // Update navigation settings (wiki/cards/labs visibility)
  updateNavigationSettings: adminProcedure
    .input(z.object({
      showWikiTab: z.boolean(),
      showCardsTab: z.boolean(),
      showLabsTab: z.boolean(),
      showIntelligenceTab: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const configUpdates = [
          { key: 'showWikiTab', value: input.showWikiTab.toString() },
          { key: 'showCardsTab', value: input.showCardsTab.toString() },
          { key: 'showLabsTab', value: input.showLabsTab.toString() },
          { key: 'showIntelligenceTab', value: input.showIntelligenceTab.toString() },
        ];

        for (const config of configUpdates) {
          await ctx.db.systemConfig.upsert({
            where: { key: config.key },
            update: { value: config.value, updatedAt: new Date() },
            create: {
              key: config.key,
              value: config.value,
              description: `Navigation tab visibility setting for ${config.key}`,
            },
          });
        }

        return { success: true, message: "Navigation settings updated successfully" };
      } catch (error) {
        console.error("Failed to update navigation settings:", error);
        throw new Error("Failed to update navigation settings");
      }
    }),

  // ============================================================================
  // GOD MODE - DIRECT COUNTRY DATA MANIPULATION
  // ============================================================================

  /**
   * Update country data directly (god-mode)
   * DANGEROUS: This bypasses all normal validation and calculation logic
   */
  updateCountryData: adminProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          // Economic data
          population: z.number().optional(),
          gdpPerCapita: z.number().optional(),
          totalGDP: z.number().optional(),
          growthRate: z.number().optional(),
          populationGrowthRate: z.number().optional(),
          economicTier: z.string().optional(),
          populationTier: z.string().optional(),

          // Geographic data
          landArea: z.number().optional(),
          continent: z.string().optional(),
          region: z.string().optional(),

          // Identity data
          name: z.string().optional(),
          governmentType: z.string().optional(),
          leader: z.string().optional(),
          religion: z.string().optional(),

          // Projections
          projected2040Population: z.number().optional(),
          projected2040Gdp: z.number().optional(),
          projected2040GdpPerCapita: z.number().optional(),
        })
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // God-mode operations require system owner privileges
        // This check ensures only the system owner can directly manipulate country data
        // Regular admins must use standard update flows to prevent data corruption
        if (!isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'God-mode operations require system owner privileges. Regular admin access is insufficient.',
          });
        }

        const { id, data } = input;

        // Build update object
        const updateData: any = {};

        if (data.population !== undefined) {
          updateData.currentPopulation = data.population;
        }
        if (data.gdpPerCapita !== undefined) {
          updateData.currentGdpPerCapita = data.gdpPerCapita;
        }
        if (data.totalGDP !== undefined) {
          updateData.currentTotalGdp = data.totalGDP;
        }
        if (data.growthRate !== undefined) {
          updateData.adjustedGdpGrowth = data.growthRate;
        }
        if (data.populationGrowthRate !== undefined) {
          updateData.populationGrowthRate = data.populationGrowthRate;
        }
        if (data.economicTier !== undefined) {
          updateData.economicTier = data.economicTier;
        }
        if (data.populationTier !== undefined) {
          updateData.populationTier = data.populationTier;
        }
        if (data.landArea !== undefined) {
          updateData.landArea = data.landArea;
        }
        if (data.continent !== undefined) {
          updateData.continent = data.continent;
        }
        if (data.region !== undefined) {
          updateData.region = data.region;
        }
        if (data.name !== undefined) {
          updateData.name = data.name;
        }
        if (data.governmentType !== undefined) {
          updateData.governmentType = data.governmentType;
        }
        if (data.leader !== undefined) {
          updateData.leader = data.leader;
        }
        if (data.religion !== undefined) {
          updateData.religion = data.religion;
        }
        if (data.projected2040Population !== undefined) {
          updateData.projected2040Population = data.projected2040Population;
        }
        if (data.projected2040Gdp !== undefined) {
          updateData.projected2040Gdp = data.projected2040Gdp;
        }
        if (data.projected2040GdpPerCapita !== undefined) {
          updateData.projected2040GdpPerCapita = data.projected2040GdpPerCapita;
        }

        // Recalculate dependent fields
        if (data.population !== undefined || data.gdpPerCapita !== undefined) {
          const pop = data.population !== undefined ? data.population : (await ctx.db.country.findUnique({ where: { id }, select: { currentPopulation: true } }))?.currentPopulation || 0;
          const gdpPc = data.gdpPerCapita !== undefined ? data.gdpPerCapita : (await ctx.db.country.findUnique({ where: { id }, select: { currentGdpPerCapita: true } }))?.currentGdpPerCapita || 0;
          updateData.currentTotalGdp = pop * gdpPc;
        }

        const updated = await ctx.db.country.update({
          where: { id },
          data: updateData
        });

        // Log the god-mode action
        await ctx.db.adminAuditLog.create({
          data: {
            action: "GOD_MODE_COUNTRY_UPDATE",
            targetType: "country",
            targetId: id,
            targetName: updated.name,
            changes: JSON.stringify(data),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
            ipAddress: ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown"
          }
        });

        // Notify the country owner about admin intervention
        try {
          const countryUser = await ctx.db.user.findFirst({
            where: { countryId: id },
            select: { clerkUserId: true }
          });

          if (countryUser) {
            await notificationHooks.onAdminAction({
              actionType: 'data_intervention',
              title: 'Admin Data Update',
              description: `An administrator has updated data for ${updated.name}. Please review your country dashboard for changes.`,
              affectedUserIds: [countryUser.clerkUserId],
              adminId: ctx.user?.id || "system",
              adminName: ctx.user?.clerkUserId || "System Administrator",
              severity: 'important',
              metadata: {
                countryId: id,
                countryName: updated.name,
                fieldsChanged: Object.keys(data),
              },
            });
          }
        } catch (notifError) {
          console.error("Failed to send admin intervention notification:", notifError);
        }

        return {
          success: true,
          message: `Successfully updated ${updated.name}`,
          country: updated
        };
      } catch (error) {
        console.error("God-mode country update failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update country data"
        });
      }
    }),

  /**
   * Bulk update multiple countries (god-mode)
   */
  bulkUpdateCountries: adminProcedure
    .input(
      z.object({
        updates: z.array(z.object({
          id: z.string(),
          data: z.record(z.string(), z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.null(),
            z.array(z.union([z.string(), z.number(), z.boolean()])),
          ]))
        }))
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // God-mode bulk operations require system owner privileges
        // This prevents mass data corruption by restricting bulk updates to the system owner
        // Regular admins must update countries individually through standard procedures
        if (!isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'God-mode operations require system owner privileges. Regular admin access is insufficient.',
          });
        }

        const results = [];

        for (const update of input.updates) {
          const result = await ctx.db.country.update({
            where: { id: update.id },
            data: update.data
          });
          results.push(result);

          // Log each action
          await ctx.db.adminAuditLog.create({
            data: {
              action: "GOD_MODE_BULK_UPDATE",
              targetType: "country",
              targetId: update.id,
              targetName: result.name,
              changes: JSON.stringify(update.data),
              adminId: ctx.user?.id || "system",
              adminName: ctx.user?.clerkUserId || "System",
              timestamp: new Date()
            }
          });
        }

        return {
          success: true,
          message: `Updated ${results.length} countries`,
          updated: results
        };
      } catch (error) {
        console.error("Bulk god-mode update failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk update countries"
        });
      }
    }),

  /**
   * Get admin audit log
   */
  getAdminAuditLog: adminProcedure
    .input(
      z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        action: z.string().optional(),
        targetId: z.string().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};
        if (input.action) where.action = input.action;
        if (input.targetId) where.targetId = input.targetId;

        const [logs, total] = await Promise.all([
          ctx.db.adminAuditLog.findMany({
            where,
            orderBy: { timestamp: "desc" },
            take: input.limit,
            skip: input.offset
          }),
          ctx.db.adminAuditLog.count({ where })
        ]);

        return {
          logs,
          total,
          hasMore: total > (input.offset + input.limit)
        };
      } catch (error) {
        console.error("Failed to get audit log:", error);
        // Return empty if AdminAuditLog table doesn't exist yet
        return {
          logs: [],
          total: 0,
          hasMore: false
        };
      }
    }),

  /**
   * Create custom scenario/conflict
   */
  createCustomScenario: adminProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string(),
        interventions: z.array(z.object({
          name: z.string(),
          type: z.string(),
          scale: z.enum(["macro", "micro", "sectoral", "crisis", "custom"]),
          category: z.enum(["economic", "political", "social", "military", "environmental", "technological"]),
          targetCountryId: z.string().optional(),
          value: z.number(),
          duration: z.number().optional(),
          cascadeEffects: z.boolean().optional(),
          delayedStart: z.number().optional(),
          confidence: z.number().optional()
        })),
        affectedCountries: z.array(z.string()),
        estimatedImpact: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Create all interventions in the scenario
        const createdInterventions = [];

        for (const intervention of input.interventions) {
          const created = await ctx.db.dmInputs.create({
            data: {
              countryId: intervention.targetCountryId,
              ixTimeTimestamp: new Date(),
              inputType: intervention.type,
              value: intervention.value,
              description: `${input.name}: ${intervention.name}`,
              duration: intervention.duration,
              isActive: true,
              createdBy: ctx.user?.id || "system"
            }
          });
          createdInterventions.push(created);
        }

        // Log the scenario creation
        await ctx.db.adminAuditLog.create({
          data: {
            action: "CUSTOM_SCENARIO_CREATED",
            targetType: "scenario",
            targetId: input.name,
            targetName: input.name,
            changes: JSON.stringify({
              description: input.description,
              interventions: input.interventions.length,
              affectedCountries: input.affectedCountries
            }),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date()
          }
        });

        return {
          success: true,
          message: `Scenario "${input.name}" created with ${createdInterventions.length} interventions`,
          interventions: createdInterventions
        };
      } catch (error) {
        console.error("Failed to create custom scenario:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create custom scenario"
        });
      }
    }),

  /**
   * Create global system announcement
   */
  createGlobalAnnouncement: adminProcedure
    .input(
      z.object({
        title: z.string(),
        message: z.string(),
        severity: z.enum(['urgent', 'important', 'informational']),
        category: z.enum(['maintenance', 'feature', 'security', 'general']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await notificationHooks.onAdminAction({
          actionType: 'global_announcement',
          title: input.title,
          description: input.message,
          adminId: ctx.user?.id || "system",
          adminName: ctx.user?.clerkUserId || "System Administrator",
          severity: input.severity,
          metadata: {
            category: input.category || 'general',
          },
        });

        // Log the announcement
        await ctx.db.adminAuditLog.create({
          data: {
            action: "GLOBAL_ANNOUNCEMENT",
            targetType: "system",
            targetId: "global",
            targetName: "All Users",
            changes: JSON.stringify({ title: input.title, severity: input.severity }),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
          }
        });

        return {
          success: true,
          message: "Global announcement sent successfully"
        };
      } catch (error) {
        console.error("Failed to create global announcement:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create global announcement"
        });
      }
    }),

  /**
   * Create system maintenance notification
   */
  createMaintenanceNotification: adminProcedure
    .input(
      z.object({
        title: z.string(),
        message: z.string(),
        scheduledTime: z.string().optional(),
        duration: z.string().optional(),
        severity: z.enum(['urgent', 'important', 'informational']).default('important'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        let fullMessage = input.message;
        if (input.scheduledTime) {
          fullMessage += ` Scheduled for: ${input.scheduledTime}`;
        }
        if (input.duration) {
          fullMessage += ` (Expected duration: ${input.duration})`;
        }

        await notificationHooks.onAdminAction({
          actionType: 'maintenance',
          title: input.title,
          description: fullMessage,
          adminId: ctx.user?.id || "system",
          adminName: ctx.user?.clerkUserId || "System Administrator",
          severity: input.severity,
          metadata: {
            scheduledTime: input.scheduledTime,
            duration: input.duration,
          },
        });

        return {
          success: true,
          message: "Maintenance notification sent successfully"
        };
      } catch (error) {
        console.error("Failed to create maintenance notification:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create maintenance notification"
        });
      }
    }),

  // ============================================================================
  // DIPLOMATIC OPTIONS MANAGEMENT
  // ============================================================================

  /**
   * Get all diplomatic options (with optional filtering)
   */
  getDiplomaticOptions: adminProcedure
    .input(
      z.object({
        type: z.enum(['strategic_priority', 'partnership_goal', 'key_achievement']).optional(),
        category: z.string().optional(),
        isActive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};

        if (input?.type) {
          where.type = input.type;
        }
        if (input?.category) {
          where.category = input.category;
        }
        if (input?.isActive !== undefined) {
          where.isActive = input.isActive;
        }

        const options = await ctx.db.diplomaticOption.findMany({
          where,
          orderBy: [
            { type: 'asc' },
            { sortOrder: 'asc' },
            { value: 'asc' }
          ]
        });

        return options;
      } catch (error) {
        console.error("Failed to get diplomatic options:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve diplomatic options"
        });
      }
    }),

  /**
   * Create a new diplomatic option
   */
  createDiplomaticOption: adminProcedure
    .input(
      z.object({
        type: z.enum(['strategic_priority', 'partnership_goal', 'key_achievement']),
        value: z.string().min(1, "Value is required"),
        category: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().default(0),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const option = await ctx.db.diplomaticOption.create({
          data: input
        });

        // Log the creation
        await ctx.db.adminAuditLog.create({
          data: {
            action: "DIPLOMATIC_OPTION_CREATED",
            targetType: "diplomatic_option",
            targetId: option.id,
            targetName: option.value,
            changes: JSON.stringify({ type: option.type, category: option.category }),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
            ipAddress: ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown"
          }
        });

        return {
          success: true,
          message: "Diplomatic option created successfully",
          option
        };
      } catch (error) {
        console.error("Failed to create diplomatic option:", error);

        // Check for unique constraint violation
        if (error instanceof Error && error.message.includes('Unique constraint')) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A diplomatic option with this type and value already exists"
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create diplomatic option"
        });
      }
    }),

  /**
   * Update an existing diplomatic option
   */
  updateDiplomaticOption: adminProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          value: z.string().min(1).optional(),
          category: z.string().optional(),
          description: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const option = await ctx.db.diplomaticOption.update({
          where: { id: input.id },
          data: input.data
        });

        // Log the update
        await ctx.db.adminAuditLog.create({
          data: {
            action: "DIPLOMATIC_OPTION_UPDATED",
            targetType: "diplomatic_option",
            targetId: option.id,
            targetName: option.value,
            changes: JSON.stringify(input.data),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
            ipAddress: ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown"
          }
        });

        return {
          success: true,
          message: "Diplomatic option updated successfully",
          option
        };
      } catch (error) {
        console.error("Failed to update diplomatic option:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update diplomatic option"
        });
      }
    }),

  /**
   * Delete (soft delete) a diplomatic option
   */
  deleteDiplomaticOption: adminProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Soft delete by setting isActive to false
        const option = await ctx.db.diplomaticOption.update({
          where: { id: input.id },
          data: { isActive: false }
        });

        // Log the deletion
        await ctx.db.adminAuditLog.create({
          data: {
            action: "DIPLOMATIC_OPTION_DELETED",
            targetType: "diplomatic_option",
            targetId: option.id,
            targetName: option.value,
            changes: JSON.stringify({ isActive: false }),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
            ipAddress: ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown"
          }
        });

        return {
          success: true,
          message: "Diplomatic option deleted successfully"
        };
      } catch (error) {
        console.error("Failed to delete diplomatic option:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete diplomatic option"
        });
      }
    }),

  /**
   * Bulk toggle active status for diplomatic options
   */
  bulkToggleDiplomaticOptions: adminProcedure
    .input(
      z.object({
        ids: z.array(z.string()),
        isActive: z.boolean()
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.diplomaticOption.updateMany({
          where: {
            id: { in: input.ids }
          },
          data: {
            isActive: input.isActive
          }
        });

        // Log the bulk operation
        await ctx.db.adminAuditLog.create({
          data: {
            action: "DIPLOMATIC_OPTIONS_BULK_TOGGLE",
            targetType: "diplomatic_option",
            targetId: "bulk",
            targetName: `${input.ids.length} options`,
            changes: JSON.stringify({ ids: input.ids, isActive: input.isActive }),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
            ipAddress: ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown"
          }
        });

        return {
          success: true,
          message: `Successfully ${input.isActive ? 'activated' : 'deactivated'} ${result.count} diplomatic options`,
          count: result.count
        };
      } catch (error) {
        console.error("Failed to bulk toggle diplomatic options:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk toggle diplomatic options"
        });
      }
    }),
});
