// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AppError } from "~/lib/app-error";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { isSystemOwner } from "~/lib/system-owner-constants";
import {
  CONFIG_CONSTANTS,
  getDefaultEconomicConfig,
  getEconomicConfigFromDB,
  invalidateConfigCache,
} from "~/lib/config-service";
import { IxTime } from "~/lib/ixtime";
import { parseRosterFile } from "~/lib/data-parser";
import { IxStatsCalculator } from "~/lib/calculations";
import { notificationHooks } from "~/lib/notification-hooks";
import type {
  SystemStatus,
  AdminPageBotStatusView,
  ImportAnalysis,
  BaseCountryData,
} from "~/types/ixstats";
import { generateSlug } from "~/lib/slug-utils";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { invalidateCache } from "~/lib/trpc-cache";
import { globalCache } from "~/lib/advanced-cache-system";
import { scoreDailyWikiOS } from "~/lib/lorewards-scoring";
import type { ScoringWeights } from "~/lib/lorewards-scoring";
import * as mysql from "mysql2/promise";
import { fetchTemplateData, categorizeTemplate } from "~/lib/wikios/template-registry";

export const adminRouter = createTRPCRouter({
  // Internal calculation formulas management
  getCalculationFormulas: adminProcedure.query(async ({ ctx }) => {
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
            localGrowthFactor: 1.0,
          },
        },
      ],
    };
  }),
  // Get global statistics for SDI interface
  getGlobalStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const totalNations = await ctx.db.country.count();
      const totalGDP = await ctx.db.country.aggregate({
        _sum: { currentTotalGdp: true },
      });

      // Real queries for each stat
      const activeDiplomats = await ctx.db.user.count(); // Count all users for now
      // For onlineUsers, you may need a real-time tracking system; fallback to 0 for now
      const onlineUsers = 0;
      // For tradeVolume, fallback to 0 since tradeRecord table doesn't exist
      const tradeVolume = 0;
      // For activeConflicts, count unresolved crisis events
      const activeConflicts = await ctx.db.crisisEvent.count({
        where: { responseStatus: { not: "resolved" } },
      });

      return {
        totalNations,
        globalGDP: (totalGDP._sum.currentTotalGdp || 0) / 1e12, // Convert to trillions
        activeDiplomats,
        onlineUsers,
        tradeVolume,
        activeConflicts,
      };
    } catch (error) {
      console.error("Failed to get global stats:", error);
      throw new Error("Failed to retrieve global statistics");
    }
  }),

  // Get system status
  getSystemStatus: adminProcedure.query(async ({ ctx }) => {
    try {
      const [countryCount, activeStorytellerEffects, lastCalculation] = await Promise.all([
        ctx.db.country.count(),
        ctx.db.storytellerEffect.count({ where: { isActive: true } }),
        ctx.db.calculationLog.findFirst({
          orderBy: { timestamp: "desc" },
        }),
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
        activeStorytellerEffects,
        lastCalculation: lastCalculation
          ? {
              timestamp: lastCalculation.timestamp.toISOString(),
              ixTimeTimestamp: lastCalculation.ixTimeTimestamp.toISOString(),
              countriesUpdated: lastCalculation.countriesUpdated,
              executionTimeMs: lastCalculation.executionTimeMs,
            }
          : null,
        warnings: [],
      };

      return systemStatus;
    } catch (error) {
      console.error("Failed to get system status:", error);
      throw new Error("Failed to retrieve system status");
    }
  }),

  // Get bot status with health check
  getBotStatus: adminProcedure.query(async ({ ctx }) => {
    try {
      const [botHealth, ixTimeStatus] = await Promise.all([
        IxTime.checkBotHealth(),
        IxTime.getStatus(),
      ]);

      const { botStatus: originalBotStatus, ...ixTimeStatusWithoutBot } = ixTimeStatus;

      const botStatus: AdminPageBotStatusView = {
        ...ixTimeStatusWithoutBot,
        botHealth,
        botStatus: originalBotStatus
          ? {
              ...originalBotStatus,
              botUser: originalBotStatus.botUser || undefined,
              realWorldTime: Date.now(),
              gameYear: IxTime.getCurrentGameYear(),
            }
          : null,
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
          message: "Bot connection failed",
        },
      } as AdminPageBotStatusView;
    }
  }),

  // Get system configuration (includes all economic control parameters)
  getConfig: adminProcedure.query(async ({ ctx }) => {
    const ALL_CONFIG_KEYS = [
      "globalGrowthFactor",
      "autoUpdate",
      "botSyncEnabled",
      "timeMultiplier",
      "baseInflationRate",
      "tierGrowthModifier_Impoverished",
      "tierGrowthModifier_Developing",
      "tierGrowthModifier_Developed",
      "tierGrowthModifier_Healthy",
      "tierGrowthModifier_Strong",
      "tierGrowthModifier_VeryStrong",
      "tierGrowthModifier_Extravagant",
      "diminishingReturnsThreshold",
      "diminishingReturnsFactor",
      "minGrowthFloor",
    ];

    try {
      const configs = await ctx.db.systemConfig.findMany({
        where: { key: { in: ALL_CONFIG_KEYS } },
      });

      const m = configs.reduce(
        (acc, config) => {
          acc[config.key] = config.value;
          return acc;
        },
        {} as Record<string, string>
      );

      return {
        globalGrowthFactor: parseFloat(
          m.globalGrowthFactor || CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR.toString()
        ),
        autoUpdate: m.autoUpdate !== undefined ? m.autoUpdate === "true" : true,
        botSyncEnabled: m.botSyncEnabled !== undefined ? m.botSyncEnabled === "true" : true,
        timeMultiplier: parseFloat(m.timeMultiplier || "2.0"),
        baseInflationRate: parseFloat(m.baseInflationRate || "0.02"),
        tierGrowthModifiers: {
          Impoverished: parseFloat(m.tierGrowthModifier_Impoverished || "1.0"),
          Developing: parseFloat(m.tierGrowthModifier_Developing || "1.0"),
          Developed: parseFloat(m.tierGrowthModifier_Developed || "1.0"),
          Healthy: parseFloat(m.tierGrowthModifier_Healthy || "1.0"),
          Strong: parseFloat(m.tierGrowthModifier_Strong || "1.0"),
          "Very Strong": parseFloat(m.tierGrowthModifier_VeryStrong || "1.0"),
          Extravagant: parseFloat(m.tierGrowthModifier_Extravagant || "1.0"),
        },
        diminishingReturnsThreshold: parseFloat(m.diminishingReturnsThreshold || "60000"),
        diminishingReturnsFactor: parseFloat(m.diminishingReturnsFactor || "0.5"),
        minGrowthFloor: parseFloat(m.minGrowthFloor || "-0.1"),
      };
    } catch (error) {
      console.error("Failed to get config:", error);
      return {
        globalGrowthFactor: CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR,
        autoUpdate: true,
        botSyncEnabled: true,
        timeMultiplier: 2.0,
        baseInflationRate: 0.02,
        tierGrowthModifiers: {
          Impoverished: 1.0,
          Developing: 1.0,
          Developed: 1.0,
          Healthy: 1.0,
          Strong: 1.0,
          "Very Strong": 1.0,
          Extravagant: 1.0,
        },
        diminishingReturnsThreshold: 60000,
        diminishingReturnsFactor: 0.5,
        minGrowthFloor: -0.1,
      };
    }
  }),

  // Save system configuration (all economic control parameters)
  saveConfig: adminProcedure
    .input(
      z.object({
        globalGrowthFactor: z.number().min(0.5).max(2.0),
        autoUpdate: z.boolean(),
        botSyncEnabled: z.boolean(),
        timeMultiplier: z.number().min(0).max(10),
        baseInflationRate: z.number().min(0).max(0.1).optional(),
        tierGrowthModifiers: z.record(z.string(), z.number().min(0.5).max(2.0)).optional(),
        diminishingReturnsThreshold: z.number().min(40000).max(100000).optional(),
        diminishingReturnsFactor: z.number().min(0.1).max(1.0).optional(),
        minGrowthFloor: z.number().min(-0.2).max(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const configUpdates: { key: string; value: string }[] = [
          { key: "globalGrowthFactor", value: input.globalGrowthFactor.toString() },
          { key: "autoUpdate", value: input.autoUpdate.toString() },
          { key: "botSyncEnabled", value: input.botSyncEnabled.toString() },
          { key: "timeMultiplier", value: input.timeMultiplier.toString() },
        ];

        // Add optional economic control parameters
        if (input.baseInflationRate !== undefined) {
          configUpdates.push({
            key: "baseInflationRate",
            value: input.baseInflationRate.toString(),
          });
        }
        if (input.tierGrowthModifiers) {
          const tierKeyMap: Record<string, string> = {
            Impoverished: "tierGrowthModifier_Impoverished",
            Developing: "tierGrowthModifier_Developing",
            Developed: "tierGrowthModifier_Developed",
            Healthy: "tierGrowthModifier_Healthy",
            Strong: "tierGrowthModifier_Strong",
            "Very Strong": "tierGrowthModifier_VeryStrong",
            Extravagant: "tierGrowthModifier_Extravagant",
          };
          for (const [tier, value] of Object.entries(input.tierGrowthModifiers)) {
            const dbKey = tierKeyMap[tier];
            if (dbKey) {
              configUpdates.push({ key: dbKey, value: value.toString() });
            }
          }
        }
        if (input.diminishingReturnsThreshold !== undefined) {
          configUpdates.push({
            key: "diminishingReturnsThreshold",
            value: input.diminishingReturnsThreshold.toString(),
          });
        }
        if (input.diminishingReturnsFactor !== undefined) {
          configUpdates.push({
            key: "diminishingReturnsFactor",
            value: input.diminishingReturnsFactor.toString(),
          });
        }
        if (input.minGrowthFloor !== undefined) {
          configUpdates.push({ key: "minGrowthFloor", value: input.minGrowthFloor.toString() });
        }

        await ctx.db.$transaction(
          configUpdates.map((config) =>
            ctx.db.systemConfig.upsert({
              where: { key: config.key },
              update: { value: config.value, updatedAt: new Date() },
              create: {
                key: config.key,
                value: config.value,
                description: `System configuration for ${config.key}`,
              },
            })
          )
        );

        // Invalidate config cache so next calculation uses fresh values
        invalidateConfigCache();

        return { success: true, message: "Configuration saved successfully" };
      } catch (error) {
        console.error("Failed to save config:", error);
        throw new Error("Failed to save configuration");
      }
    }),

  // Set custom time via bot or local override
  setCustomTime: adminProcedure
    .input(
      z.object({
        ixTime: z.number(),
        multiplier: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Try to set via bot first
        const botResult = await IxTime.setBotTimeOverride(input.ixTime, input.multiplier);

        if (botResult.success) {
          return {
            success: true,
            message: "Time set via Discord bot",
            method: "bot",
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
            method: "local",
          };
        }
      } catch (error) {
        console.error("Failed to set custom time:", error);
        throw new Error("Failed to set custom time");
      }
    }),

  // Bot control operations
  syncBot: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await IxTime.syncWithBot();
      return result;
    } catch (error) {
      console.error("Failed to sync bot:", error);
      throw new Error("Failed to sync with Discord bot");
    }
  }),

  pauseBot: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await IxTime.pauseBotTime();
      return result;
    } catch (error) {
      console.error("Failed to pause bot:", error);
      throw new Error("Failed to pause bot time");
    }
  }),

  resumeBot: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await IxTime.resumeBotTime();
      return result;
    } catch (error) {
      console.error("Failed to resume bot:", error);
      throw new Error("Failed to resume bot time");
    }
  }),

  clearBotOverrides: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await IxTime.clearBotOverrides();
      return result;
    } catch (error) {
      console.error("Failed to clear bot overrides:", error);
      throw new Error("Failed to clear bot overrides");
    }
  }),

  getBotProcesses: adminProcedure.query(async () => {
    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execPromise = promisify(exec);

      const { stdout } = await execPromise("pm2 jlist");
      const pm2List = JSON.parse(stdout);

      const whitelist = ["ixwiki-discord-bot", "ixstats-ixtwitter"];
      const result = whitelist.map((name) => {
        const proc = pm2List.find((p: any) => p.name === name);
        if (!proc) {
          return {
            name,
            status: "offline",
            cpu: 0,
            memory: 0,
            restarts: 0,
            uptime: 0,
          };
        }
        return {
          name,
          status: proc.pm2_env?.status || "offline",
          cpu: proc.monit?.cpu || 0,
          memory: proc.monit?.memory || 0,
          restarts: proc.pm2_env?.restart_time || 0,
          uptime: proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : 0,
        };
      });

      return result;
    } catch (error) {
      console.error("Failed to get bot processes:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get bot processes",
      });
    }
  }),

  controlBotProcess: adminProcedure
    .input(
      z.object({
        processName: z.enum(["ixwiki-discord-bot", "ixstats-ixtwitter"]),
        action: z.enum(["start", "stop", "restart"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execPromise = promisify(exec);

        const cmd = `pm2 ${input.action} ${input.processName}`;
        await execPromise(cmd);

        return {
          success: true,
          message: `Process ${input.processName} ${input.action}ed successfully`,
        };
      } catch (error) {
        console.error(`Failed to ${input.action} bot process ${input.processName}:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to ${input.action} process: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  getBotProcessLogs: adminProcedure
    .input(
      z.object({
        processName: z.enum(["ixwiki-discord-bot", "ixstats-ixtwitter"]),
        logType: z.enum(["out", "err"]),
      })
    )
    .query(async ({ input }) => {
      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execPromise = promisify(exec);

        const { stdout: jlistStdout } = await execPromise("pm2 jlist");
        const pm2List = JSON.parse(jlistStdout);
        const proc = pm2List.find((p: any) => p.name === input.processName);

        if (!proc) {
          throw new Error(`Process ${input.processName} not found in PM2`);
        }

        const logPath =
          input.logType === "out" ? proc.pm2_env?.pm_out_log_path : proc.pm2_env?.pm_err_log_path;
        if (!logPath) {
          throw new Error("Log path not configured in PM2");
        }

        const fs = await import("fs");
        if (!fs.existsSync(logPath)) {
          return [];
        }

        const content = fs.readFileSync(logPath, "utf-8");
        const lines = content.split("\n").filter(Boolean);
        return lines.slice(-50);
      } catch (error) {
        console.error(`Failed to read logs for ${input.processName}:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to read process logs: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  getBotCommands: adminProcedure.query(async () => {
    try {
      const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
      const response = await fetch(`${botUrl}/bot/commands`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`Bot API returned HTTP ${response.status}`);
      }
      const data = await response.json();
      return data.commands || [];
    } catch (error) {
      console.error("Failed to fetch bot commands:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch bot commands: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),

  getBotRoles: adminProcedure.query(async () => {
    try {
      const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
      const response = await fetch(`${botUrl}/bot/roles`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`Bot API returned HTTP ${response.status}`);
      }
      const data = await response.json();
      return data.roles || [];
    } catch (error) {
      console.error("Failed to fetch bot roles:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch bot roles: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),

  simulateBotCommand: adminProcedure
    .input(
      z.object({
        commandName: z.string(),
        subcommand: z.string().optional(),
        options: z.record(z.string(), z.any()).optional(),
        user: z
          .object({
            username: z.string().optional(),
            displayName: z.string().optional(),
            isAdmin: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
        const response = await fetch(`${botUrl}/bot/commands/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          throw new Error(`Bot API returned HTTP ${response.status}`);
        }
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Failed to simulate bot command:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to simulate bot command: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  // Get calculation logs
  getCalculationLogs: adminProcedure
    .input(
      z
        .object({
          limit: z.number().optional().default(10),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;
      try {
        const logs = await ctx.db.calculationLog.findMany({
          orderBy: { timestamp: "desc" },
          take: limit,
        });

        return logs.map((log) => ({
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
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : "Unknown",
        });
        throw new Error(
          `Failed to retrieve calculation logs: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // Analyze import file
  analyzeImport: adminProcedure
    .input(
      z.object({
        fileData: z.array(z.number()), // Uint8Array as number array
        fileName: z.string(),
      })
    )
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
            name: { in: countries.map((c) => c.country) },
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
            localGrowthFactor: true,
          },
        });

        const existingMap = new Map(existingCountries.map((c) => [c.name, c]));

        const changes = countries.map((country) => {
          const existing = existingMap.get(country.country);

          if (!existing) {
            return {
              type: "new" as const,
              country,
            };
          } else {
            // Compare significant fields
            const fieldChanges = [];

            if (Math.abs(existing.baselinePopulation - country.population) > 1000) {
              fieldChanges.push({
                field: "population",
                fieldLabel: "Population",
                oldValue: existing.baselinePopulation,
                newValue: country.population,
              });
            }

            if (Math.abs(existing.baselineGdpPerCapita - country.gdpPerCapita) > 100) {
              fieldChanges.push({
                field: "gdpPerCapita",
                fieldLabel: "GDP per Capita",
                oldValue: existing.baselineGdpPerCapita,
                newValue: country.gdpPerCapita,
              });
            }

            if (Math.abs(existing.maxGdpGrowthRate - country.maxGdpGrowthRate) > 0.001) {
              fieldChanges.push({
                field: "maxGdpGrowthRate",
                fieldLabel: "Max GDP Growth Rate",
                oldValue: existing.maxGdpGrowthRate,
                newValue: country.maxGdpGrowthRate,
              });
            }

            if (Math.abs(existing.adjustedGdpGrowth - country.adjustedGdpGrowth) > 0.001) {
              fieldChanges.push({
                field: "adjustedGdpGrowth",
                fieldLabel: "Adjusted GDP Growth",
                oldValue: existing.adjustedGdpGrowth,
                newValue: country.adjustedGdpGrowth,
              });
            }

            if (Math.abs(existing.populationGrowthRate - country.populationGrowthRate) > 0.001) {
              fieldChanges.push({
                field: "populationGrowthRate",
                fieldLabel: "Population Growth Rate",
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
              localGrowthFactor: existing.localGrowthFactor || 1.0,
            };

            return {
              type: "update" as const,
              country,
              existingData: existingBaseData,
              changes: fieldChanges,
            };
          }
        });

        const analysis: ImportAnalysis = {
          totalCountries: countries.length,
          newCountries: changes.filter((c) => c.type === "new").length,
          updatedCountries: changes.filter((c) => c.type === "update").length,
          unchangedCountries: changes.filter(
            (c) => c.type === "update" && (!c.changes || c.changes.length === 0)
          ).length,
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
    .input(
      z.object({
        analysisId: z.string(),
        replaceExisting: z.boolean(),
        fileData: z.array(z.number()).optional(), // Accept fileData for now
        fileName: z.string().optional(),
        changes: z
          .object({
            updateMode: z.enum(["create", "update", "upsert"]).optional(),
            skipValidation: z.boolean().optional(),
            preserveExisting: z.boolean().optional(),
            fieldMappings: z.record(z.string(), z.string()).optional(),
          })
          .optional(), // Import configuration options
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // For now, require fileData and fileName to be passed in (since we have no persistent cache)
        if (!input.fileData || !input.fileName) {
          throw new Error(
            "File data and file name are required for import (no persistent cache implemented)"
          );
        }
        const fileBuffer = new Uint8Array(input.fileData).buffer;
        const countries = await parseRosterFile(fileBuffer, input.fileName);
        if (countries.length === 0) {
          throw new Error("No valid countries found in the file");
        }
        // Get all existing countries by name
        const existingCountries = await ctx.db.country.findMany({
          where: {
            name: { in: countries.map((c) => c.country) },
          },
        });
        const existingMap = new Map(existingCountries.map((c) => [c.name, c]));
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
                  baselineDate: new Date(IxTime.getCurrentIxTime()),
                  lastCalculated: new Date(IxTime.getCurrentIxTime()),
                  currentPopulation,
                  currentGdpPerCapita,
                  currentTotalGdp,
                  economicTier,
                  populationTier,
                },
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
                  populationTier,
                  // Do not update baselineDate or lastCalculated here
                },
              });
              updated++;
            } else {
              // Only update changed fields (basic check)
              const updateData: any = {};
              if (existing.baselinePopulation !== country.population)
                updateData.baselinePopulation = country.population;
              if (existing.baselineGdpPerCapita !== country.gdpPerCapita)
                updateData.baselineGdpPerCapita = country.gdpPerCapita;
              if (existing.maxGdpGrowthRate !== country.maxGdpGrowthRate)
                updateData.maxGdpGrowthRate = country.maxGdpGrowthRate;
              if (existing.adjustedGdpGrowth !== country.adjustedGdpGrowth)
                updateData.adjustedGdpGrowth = country.adjustedGdpGrowth;
              if (existing.populationGrowthRate !== country.populationGrowthRate)
                updateData.populationGrowthRate = country.populationGrowthRate;
              // Also update calculated fields if needed
              if (Object.keys(updateData).length > 0) {
                await ctx.db.country.update({
                  where: { id: existing.id },
                  data: updateData,
                });
                updated++;
              } else {
                skipped++;
              }
            }
          } catch (err) {
            errors.push(
              `Error processing country ${country.country}: ${err instanceof Error ? err.message : "Unknown error"}`
            );
          }
        }
        // After import, trigger recalculation for all affected countries
        await ctx.db.calculationLog.create({
          data: {
            timestamp: new Date(),
            ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()),
            countriesUpdated: created + updated,
            executionTimeMs: 0,
            globalGrowthFactor: (await getEconomicConfigFromDB(ctx.db)).globalGrowthFactor,
            notes: `Import: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} errors.`,
          },
        });
        return {
          success: true,
          created,
          updated,
          skipped,
          errors,
          total: countries.length,
        };
      } catch (error) {
        console.error("Failed to import data:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to import data: ${errorMessage}`,
          cause: error,
        });
      }
    }),

  // Sync epoch time with imported data
  syncEpochWithData: adminProcedure
    .input(
      z.object({
        targetEpoch: z.number(), // The target epoch timestamp to sync to
        reason: z.string().optional(),
      })
    )
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
          },
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
            globalGrowthFactor: (await getEconomicConfigFromDB(ctx.db)).globalGrowthFactor,
            notes: `Epoch sync: ${yearsDifference.toFixed(1)} years adjustment. ${updateResult.count} countries updated. ${input.reason || "Manual epoch sync"}.`,
          },
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
  forceRecalculation: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const startTime = Date.now();
      const countries = await ctx.db.country.findMany({
        include: {
          storytellerEffects: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });

      const econConfig = await getEconomicConfigFromDB(ctx.db);
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
          const effects = country.storytellerEffects.map((d) => ({
            ...d,
            ixTimeTimestamp: d.ixTimeTimestamp.getTime(),
          }));

          const result = calc.calculateTimeProgression(initialStats, currentIxTime, effects);

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
            },
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
        },
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
  getSystemHealth: adminProcedure.query(async ({ ctx }) => {
    try {
      const [countryCount, recentCalculations, botHealth] = await Promise.all([
        ctx.db.country.count(),
        ctx.db.calculationLog.count({
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        }),
        IxTime.checkBotHealth(),
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
  syncWithBot: adminProcedure.mutation(async () => {
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
      orderBy: { createdAt: "asc" },
    });
    return users.map((u) => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      membershipTier: u.membershipTier || "basic",
      country: u.country ? { id: u.country.id, name: u.country.name } : null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }),

  // List all countries and their assigned users
  listCountriesWithUsers: adminProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany({
      include: { users: true },
      orderBy: { name: "asc" },
    });
    return countries.map((c) => ({
      id: c.id,
      name: c.name,
      user:
        c.users && c.users.length > 0
          ? { id: c.users[0].id, clerkUserId: c.users[0].clerkUserId }
          : null,
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
        await ctx.db.user.updateMany({
          where: { countryId: input.countryId },
          data: { countryId: null },
        });
        // Unlink this user from any country they currently claim
        await ctx.db.user.updateMany({
          where: { clerkUserId: input.userId },
          data: { countryId: null },
        });
        // Link user to country
        await ctx.db.user.upsert({
          where: { clerkUserId: input.userId },
          update: { countryId: input.countryId },
          create: { clerkUserId: input.userId, countryId: input.countryId },
        });
      }

      await globalCache.delete(`user_profile:${input.userId}`);
      await invalidateCache(["countries."]);

      return { success: true };
    }),

  // Unassign a user from a country (admin override)
  unassignUserFromCountry: adminProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.updateMany({
        where: { clerkUserId: input.userId, countryId: input.countryId },
        data: { countryId: null },
      });

      await globalCache.delete(`user_profile:${input.userId}`);
      await invalidateCache(["countries."]);

      return { success: true };
    }),

  // Get navigation settings (wiki/cards/labs visibility)
  getNavigationSettings: publicProcedure.query(async ({ ctx }) => {
    try {
      const settings = await ctx.db.systemConfig.findMany({
        where: {
          key: {
            in: [
              "showWikiTab",
              "showCardsTab",
              "showLabsTab",
              "showIntelligenceTab",
              "showDefenseTab",
              "showMapsTab",
              "showForumTab",
              "showHelpTab",
            ],
          },
        },
      });

      const settingsMap = settings.reduce(
        (acc, setting) => {
          acc[setting.key] = setting.value === "true";
          return acc;
        },
        {} as Record<string, boolean>
      );

      return {
        showWikiTab: settingsMap.showWikiTab ?? true,
        showCardsTab: settingsMap.showCardsTab ?? true,
        showLabsTab: settingsMap.showLabsTab ?? true,
        showIntelligenceTab: settingsMap.showIntelligenceTab ?? false,
        showDefenseTab: settingsMap.showDefenseTab ?? false,
        showMapsTab: settingsMap.showMapsTab ?? true,
        showForumTab: settingsMap.showForumTab ?? true,
        showHelpTab: settingsMap.showHelpTab ?? true,
      };
    } catch (error) {
      console.error("Failed to get navigation settings:", error);
      return {
        showWikiTab: true,
        showCardsTab: true,
        showLabsTab: true,
        showIntelligenceTab: false,
        showDefenseTab: false,
        showMapsTab: true,
        showForumTab: true,
        showHelpTab: true,
      };
    }
  }),

  // Update navigation settings (wiki/cards/labs visibility)
  updateNavigationSettings: adminProcedure
    .input(
      z.object({
        showWikiTab: z.boolean(),
        showCardsTab: z.boolean(),
        showLabsTab: z.boolean(),
        showIntelligenceTab: z.boolean(),
        showDefenseTab: z.boolean(),
        showMapsTab: z.boolean(),
        showForumTab: z.boolean(),
        showHelpTab: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const configUpdates = [
          { key: "showWikiTab", value: input.showWikiTab.toString() },
          { key: "showCardsTab", value: input.showCardsTab.toString() },
          { key: "showLabsTab", value: input.showLabsTab.toString() },
          { key: "showIntelligenceTab", value: input.showIntelligenceTab.toString() },
          { key: "showDefenseTab", value: input.showDefenseTab.toString() },
          { key: "showMapsTab", value: input.showMapsTab.toString() },
          { key: "showForumTab", value: input.showForumTab.toString() },
          { key: "showHelpTab", value: input.showHelpTab.toString() },
        ];

        // Batch upserts using transaction for better performance (avoids N+1 pattern)
        await ctx.db.$transaction(
          configUpdates.map((config) =>
            ctx.db.systemConfig.upsert({
              where: { key: config.key },
              update: { value: config.value, updatedAt: new Date() },
              create: {
                key: config.key,
                value: config.value,
                description: `Navigation tab visibility setting for ${config.key}`,
              },
            })
          )
        );

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
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // God-mode operations require system owner privileges
        // This check ensures only the system owner can directly manipulate country data
        // Regular admins must use standard update flows to prevent data corruption
        if (!ctx.auth?.userId || !isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "God-mode operations require system owner privileges. Regular admin access is insufficient.",
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
          const pop =
            data.population !== undefined
              ? data.population
              : (
                  await ctx.db.country.findUnique({
                    where: { id },
                    select: { currentPopulation: true },
                  })
                )?.currentPopulation || 0;
          const gdpPc =
            data.gdpPerCapita !== undefined
              ? data.gdpPerCapita
              : (
                  await ctx.db.country.findUnique({
                    where: { id },
                    select: { currentGdpPerCapita: true },
                  })
                )?.currentGdpPerCapita || 0;
          updateData.currentTotalGdp = pop * gdpPc;
        }

        const updated = await ctx.db.country.update({
          where: { id },
          data: updateData,
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
            ipAddress:
              ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown",
          },
        });

        // Notify the country owner about admin intervention
        try {
          const countryUser = await ctx.db.user.findFirst({
            where: { countryId: id },
            select: { clerkUserId: true },
          });

          if (countryUser) {
            await notificationHooks.onAdminAction({
              actionType: "data_intervention",
              title: "Admin Data Update",
              description: `An administrator has updated data for ${updated.name}. Please review your country dashboard for changes.`,
              affectedUserIds: [countryUser.clerkUserId],
              adminId: ctx.user?.id || "system",
              adminName: ctx.user?.clerkUserId || "System Administrator",
              severity: "important",
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
          country: updated,
        };
      } catch (error) {
        console.error("God-mode country update failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update country data",
        });
      }
    }),

  /**
   * Bulk update multiple countries (god-mode)
   */
  bulkUpdateCountries: adminProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            id: z.string(),
            data: z.record(
              z.string(),
              z.union([
                z.string(),
                z.number(),
                z.boolean(),
                z.null(),
                z.array(z.union([z.string(), z.number(), z.boolean()])),
              ])
            ),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // God-mode bulk operations require system owner privileges
        // This prevents mass data corruption by restricting bulk updates to the system owner
        // Regular admins must update countries individually through standard procedures
        if (!ctx.auth?.userId || !isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "God-mode operations require system owner privileges. Regular admin access is insufficient.",
          });
        }

        const results = [];

        for (const update of input.updates) {
          const result = await ctx.db.country.update({
            where: { id: update.id },
            data: update.data,
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
              timestamp: new Date(),
            },
          });
        }

        return {
          success: true,
          message: `Updated ${results.length} countries`,
          updated: results,
        };
      } catch (error) {
        console.error("Bulk god-mode update failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk update countries",
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
        targetId: z.string().optional(),
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
            skip: input.offset,
          }),
          ctx.db.adminAuditLog.count({ where }),
        ]);

        return {
          logs,
          total,
          hasMore: total > input.offset + input.limit,
        };
      } catch (error) {
        console.error("Failed to get audit log:", error);
        // Return empty if AdminAuditLog table doesn't exist yet
        return {
          logs: [],
          total: 0,
          hasMore: false,
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
        interventions: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            scale: z.enum(["macro", "micro", "sectoral", "crisis", "custom"]),
            category: z.enum([
              "economic",
              "political",
              "social",
              "military",
              "environmental",
              "technological",
            ]),
            targetCountryId: z.string().optional(),
            value: z.number(),
            duration: z.number().optional(),
            cascadeEffects: z.boolean().optional(),
            delayedStart: z.number().optional(),
            confidence: z.number().optional(),
          })
        ),
        affectedCountries: z.array(z.string()),
        estimatedImpact: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Create all interventions in the scenario
        const createdInterventions = [];

        for (const intervention of input.interventions) {
          const created = await ctx.db.storytellerEffect.create({
            data: {
              countryId: intervention.targetCountryId,
              ixTimeTimestamp: new Date(),
              inputType: intervention.type,
              value: intervention.value,
              description: `${input.name}: ${intervention.name}`,
              duration: intervention.duration,
              isActive: true,
              createdBy: ctx.user?.id || "system",
            },
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
              affectedCountries: input.affectedCountries,
            }),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
          },
        });

        return {
          success: true,
          message: `Scenario "${input.name}" created with ${createdInterventions.length} interventions`,
          interventions: createdInterventions,
        };
      } catch (error) {
        console.error("Failed to create custom scenario:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create custom scenario",
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
        severity: z.enum(["urgent", "important", "informational"]),
        category: z.enum(["maintenance", "feature", "security", "general"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await notificationHooks.onAdminAction({
          actionType: "global_announcement",
          title: input.title,
          description: input.message,
          adminId: ctx.user?.id || "system",
          adminName: ctx.user?.clerkUserId || "System Administrator",
          severity: input.severity,
          metadata: {
            category: input.category || "general",
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
          },
        });

        return {
          success: true,
          message: "Global announcement sent successfully",
        };
      } catch (error) {
        console.error("Failed to create global announcement:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create global announcement",
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
        severity: z.enum(["urgent", "important", "informational"]).default("important"),
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
          actionType: "maintenance",
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
          message: "Maintenance notification sent successfully",
        };
      } catch (error) {
        console.error("Failed to create maintenance notification:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create maintenance notification",
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
      z
        .object({
          type: z.enum(["strategic_priority", "partnership_goal", "key_achievement"]).optional(),
          category: z.string().optional(),
          isActive: z.boolean().optional(),
        })
        .optional()
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
          orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { value: "asc" }],
        });

        return options;
      } catch (error) {
        console.error("Failed to get diplomatic options:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve diplomatic options",
        });
      }
    }),

  /**
   * Create a new diplomatic option
   */
  createDiplomaticOption: adminProcedure
    .input(
      z.object({
        type: z.enum(["strategic_priority", "partnership_goal", "key_achievement"]),
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
          data: input,
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
            ipAddress:
              ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown",
          },
        });

        return {
          success: true,
          message: "Diplomatic option created successfully",
          option,
        };
      } catch (error) {
        console.error("Failed to create diplomatic option:", error);

        if (error instanceof AppError && error.code === "CONFLICT") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A diplomatic option with this type and value already exists",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create diplomatic option",
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
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const option = await ctx.db.diplomaticOption.update({
          where: { id: input.id },
          data: input.data,
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
            ipAddress:
              ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown",
          },
        });

        return {
          success: true,
          message: "Diplomatic option updated successfully",
          option,
        };
      } catch (error) {
        console.error("Failed to update diplomatic option:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update diplomatic option",
        });
      }
    }),

  /**
   * Delete (soft delete) a diplomatic option
   */
  deleteDiplomaticOption: adminProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Soft delete by setting isActive to false
        const option = await ctx.db.diplomaticOption.update({
          where: { id: input.id },
          data: { isActive: false },
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
            ipAddress:
              ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown",
          },
        });

        return {
          success: true,
          message: "Diplomatic option deleted successfully",
        };
      } catch (error) {
        console.error("Failed to delete diplomatic option:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete diplomatic option",
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
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.diplomaticOption.updateMany({
          where: {
            id: { in: input.ids },
          },
          data: {
            isActive: input.isActive,
          },
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
            ipAddress:
              ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown",
          },
        });

        return {
          success: true,
          message: `Successfully ${input.isActive ? "activated" : "deactivated"} ${result.count} diplomatic options`,
          count: result.count,
        };
      } catch (error) {
        console.error("Failed to bulk toggle diplomatic options:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk toggle diplomatic options",
        });
      }
    }),

  // ============================================================================
  // PHASE 2: COUNTRY GRID & UPCOMING EVENTS
  // ============================================================================

  /**
   * Get all countries with key metrics for the admin country grid.
   * Supports sorting, filtering, and search.
   */
  getCountryGrid: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          sortBy: z
            .enum([
              "name",
              "currentTotalGdp",
              "currentGdpPerCapita",
              "realGDPGrowthRate",
              "currentPopulation",
              "economicTier",
              "updatedAt",
            ])
            .optional()
            .default("name"),
          sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
          tierFilter: z.string().optional(),
          limit: z.number().min(1).max(200).optional().default(100),
          offset: z.number().min(0).optional().default(0),
        })
        .optional()
        .default({ sortBy: "name", sortOrder: "asc", limit: 100, offset: 0 })
    )
    .query(async ({ ctx, input }) => {
      const { search, sortBy, sortOrder, tierFilter, limit, offset } = input;

      const where: Record<string, unknown> = {};
      if (search) {
        where.name = { contains: search, mode: "insensitive" };
      }
      if (tierFilter) {
        where.economicTier = tierFilter;
      }

      const [countries, total, activeStorytellerEffectsByCountry] = await Promise.all([
        ctx.db.country.findMany({
          where,
          select: {
            id: true,
            name: true,
            slug: true,
            flag: true,
            isDemo: true,
            // Economic
            currentTotalGdp: true,
            currentGdpPerCapita: true,
            realGDPGrowthRate: true,
            totalDebtGDPRatio: true,
            economicTier: true,
            inflationRate: true,
            // Population
            currentPopulation: true,
            populationGrowthRate: true,
            // Governance
            governmentType: true,
            politicalStability: true,
            publicApproval: true,
            // Vitality
            overallNationalHealth: true,
            economicVitality: true,
            // Map linkage
            landArea: true,
            // Timestamps
            lastCalculated: true,
            updatedAt: true,
            createdAt: true,
            // Owner info
            users: {
              select: {
                id: true,
                clerkUserId: true,
                isActive: true,
                updatedAt: true,
              },
            },
            // Count active interventions
            _count: {
              select: {
                storytellerEffects: { where: { isActive: true } },
              },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip: offset,
        }),
        ctx.db.country.count({ where }),
        // Get active storyteller effects count per country for alert badges
        ctx.db.storytellerEffect.groupBy({
          by: ["countryId"],
          where: { isActive: true },
          _count: {
            id: true,
          },
        }),
      ]);

      // Build a lookup for active interventions
      const effectsLookup = new Map(
        activeStorytellerEffectsByCountry
          .filter((d) => d.countryId)
          .map((d) => [d.countryId!, d._count.id])
      );

      const rows = countries.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        flag: c.flag,
        isDemo: c.isDemo,
        // Economic
        gdp: c.currentTotalGdp,
        gdpPerCapita: c.currentGdpPerCapita,
        gdpGrowthRate: c.realGDPGrowthRate,
        debtToGdpRatio: c.totalDebtGDPRatio,
        economicTier: c.economicTier,
        inflationRate: c.inflationRate,
        // Population
        population: c.currentPopulation,
        populationGrowthRate: c.populationGrowthRate,
        // Governance
        governmentType: c.governmentType,
        stability: c.politicalStability,
        approval: c.publicApproval,
        // Vitality
        nationalHealth: c.overallNationalHealth,
        economicVitality: c.economicVitality,
        // Map
        hasMap: c.landArea != null && c.landArea > 0,
        // Timestamps
        lastCalculated: c.lastCalculated,
        updatedAt: c.updatedAt,
        // Owner
        owner: c.users[0]
          ? {
              id: c.users[0].id,
              clerkUserId: c.users[0].clerkUserId,
              lastActive: c.users[0].updatedAt,
            }
          : null,
        // Alerts
        activeInterventions: effectsLookup.get(c.id) ?? c._count.storytellerEffects,
      }));

      return { rows, total, limit, offset };
    }),

  /**
   * Get full detail for a single country (admin drill-down).
   */
  getCountryDetail: adminProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          users: {
            select: {
              id: true,
              clerkUserId: true,
              membershipTier: true,
              isActive: true,
              updatedAt: true,
            },
          },
          storytellerEffects: {
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!country) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Get recent audit log entries for this country
      const auditLogs = await ctx.db.adminAuditLog.findMany({
        where: { targetId: input.countryId },
        orderBy: { timestamp: "desc" },
        take: 10,
      });

      return { country, auditLogs };
    }),

  /**
   * Get upcoming events across all systems for the timeline widget.
   * Aggregates StorytellerEffects (future), Elections (upcoming), Policies (expiring), and CrisisEvents.
   */
  getUpcomingEvents: adminProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).optional().default(20),
        })
        .optional()
        .default({ limit: 20 })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();

      const [futureInterventions, upcomingElections, activeCrises, expiringPolicies, recentAudit] =
        await Promise.all([
          // Future StorytellerEffects (scheduled but not yet started)
          ctx.db.storytellerEffect.findMany({
            where: {
              isActive: true,
              ixTimeTimestamp: { gt: now },
            },
            include: {
              country: { select: { id: true, name: true, flag: true } },
            },
            orderBy: { ixTimeTimestamp: "asc" },
            take: input.limit,
          }),

          // Upcoming elections
          ctx.db.election.findMany({
            where: {
              status: { in: ["upcoming", "campaigning"] },
            },
            include: {
              country: { select: { id: true, name: true, flag: true } },
            },
            orderBy: { scheduledIxTime: "asc" },
            take: input.limit,
          }),

          // Active crisis events
          ctx.db.crisisEvent.findMany({
            where: {
              responseStatus: { not: "resolved" },
            },
            orderBy: { timestamp: "desc" },
            take: input.limit,
          }),

          // Policies expiring soon
          ctx.db.policy.findMany({
            where: {
              status: "active",
              expiryDate: { not: null, gt: now },
            },
            include: {
              country: { select: { id: true, name: true, flag: true } },
            },
            orderBy: { expiryDate: "asc" },
            take: input.limit,
          }),

          // Recent admin actions
          ctx.db.adminAuditLog.findMany({
            orderBy: { timestamp: "desc" },
            take: 5,
          }),
        ]);

      type TimelineEvent = {
        type: "intervention" | "election" | "crisis" | "policy_expiry" | "admin_action";
        id: string;
        title: string;
        description: string | null;
        countryName: string | null;
        countryFlag: string | null;
        severity: string | null;
        scheduledAt: Date;
      };

      const events: TimelineEvent[] = [
        ...futureInterventions.map((i) => ({
          type: "intervention" as const,
          id: i.id,
          title: `${i.inputType} intervention`,
          description: i.description,
          countryName: i.country?.name ?? "Global",
          countryFlag: i.country?.flag ?? null,
          severity: null,
          scheduledAt: i.ixTimeTimestamp,
        })),
        ...upcomingElections.map((e) => ({
          type: "election" as const,
          id: e.id,
          title: e.name,
          description: `${e.electionType} election - ${e.status}`,
          countryName: e.country?.name ?? null,
          countryFlag: e.country?.flag ?? null,
          severity: null,
          scheduledAt: new Date(e.scheduledIxTime),
        })),
        ...activeCrises.map((c) => ({
          type: "crisis" as const,
          id: c.id,
          title: c.title,
          description: c.description,
          countryName: null,
          countryFlag: null,
          severity: c.severity,
          scheduledAt: c.timestamp,
        })),
        ...expiringPolicies.map((p) => ({
          type: "policy_expiry" as const,
          id: p.id,
          title: `Policy expiring: ${p.name}`,
          description: p.description,
          countryName: p.country?.name ?? null,
          countryFlag: p.country?.flag ?? null,
          severity: null,
          scheduledAt: p.expiryDate!,
        })),
      ];

      // Sort all events by scheduled date
      events.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

      return {
        events: events.slice(0, input.limit),
        recentAdminActions: recentAudit,
        counts: {
          interventions: futureInterventions.length,
          elections: upcomingElections.length,
          crises: activeCrises.length,
          expiringPolicies: expiringPolicies.length,
        },
      };
    }),

  // ============================================================================
  // STORYTELLER / WORLD EVENTS
  // ============================================================================

  getWorldEvents: adminProcedure
    .input(
      z.object({
        activeOnly: z.boolean().optional().default(false),
        type: z.string().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.activeOnly) where.isActive = true;
      if (input.type) where.type = input.type;

      const [events, total] = await Promise.all([
        ctx.db.worldEvent.findMany({
          where,
          include: {
            affectedCountries: {
              include: { country: { select: { id: true, name: true, flag: true } } },
            },
            chain: { select: { id: true, name: true } },
            _count: { select: { storytellerEffects: true } },
          },
          orderBy: { startsAt: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.worldEvent.count({ where }),
      ]);

      return { events, total };
    }),

  getWorldEventDetail: adminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.worldEvent.findUnique({
        where: { id: input.eventId },
        include: {
          affectedCountries: {
            include: {
              country: {
                select: {
                  id: true,
                  name: true,
                  flag: true,
                  currentTotalGdp: true,
                  currentPopulation: true,
                  economicTier: true,
                },
              },
            },
          },
          storytellerEffects: {
            include: { country: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          },
          chain: true,
        },
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "World event not found" });
      return event;
    }),

  createWorldEvent: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.string(),
        description: z.string().optional(),
        severity: z.number().min(0).max(1),
        duration: z.number().optional(),
        startsAt: z.date(),
        endsAt: z.date().optional(),
        chainId: z.string().optional(),
        chainOrder: z.number().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        affectedCountryIds: z.array(z.string()),
        generateEffects: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Calculate end date from duration if not provided
      const endsAt =
        input.endsAt ??
        (input.duration
          ? new Date(input.startsAt.getTime() + input.duration * 365.25 * 24 * 60 * 60 * 1000)
          : null);

      // Create the world event
      const event = await ctx.db.worldEvent.create({
        data: {
          name: input.name,
          type: input.type,
          description: input.description,
          severity: input.severity,
          duration: input.duration,
          startsAt: input.startsAt,
          endsAt,
          parameters: (input.parameters as any) ?? undefined,
          chainId: input.chainId,
          chainOrder: input.chainOrder,
          createdBy: userId,
          affectedCountries: {
            create: input.affectedCountryIds.map((countryId) => ({
              countryId,
            })),
          },
        },
        include: {
          affectedCountries: {
            include: { country: { select: { id: true, name: true } } },
          },
        },
      });

      // Generate StorytellerEffects for each affected country
      if (input.generateEffects && input.affectedCountryIds.length > 0) {
        const effectsData = input.affectedCountryIds.map((countryId) => ({
          countryId,
          ixTimeTimestamp: input.startsAt,
          inputType: input.type,
          value: input.severity >= 0.5 ? -input.severity : input.severity,
          description: `[WorldEvent: ${input.name}] ${input.description ?? ""}`.trim(),
          duration: input.duration ? Math.round(input.duration) : null,
          isActive: true,
          createdBy: userId,
          worldEventId: event.id,
        }));

        await ctx.db.storytellerEffect.createMany({ data: effectsData });
      }

      // Audit log
      await ctx.db.adminAuditLog.create({
        data: {
          action: "CREATE_WORLD_EVENT",
          targetType: "world_event",
          targetId: event.id,
          targetName: event.name,
          changes: JSON.stringify({
            eventId: event.id,
            name: input.name,
            type: input.type,
            severity: input.severity,
            affectedCountries: input.affectedCountryIds.length,
          }),
          adminId: userId,
          adminName: ctx.user?.firstName ?? "Admin",
          timestamp: new Date(),
        },
      });

      return event;
    }),

  updateWorldEvent: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        severity: z.number().min(0).max(1).optional(),
        isActive: z.boolean().optional(),
        startsAt: z.date().optional(),
        endsAt: z.date().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { eventId, ...data } = input;
      const event = await ctx.db.worldEvent.update({
        where: { id: eventId },
        data: {
          ...data,
          parameters: (data.parameters as any) ?? undefined,
        },
      });

      // If deactivating, also deactivate linked StorytellerEffects
      if (input.isActive === false) {
        await ctx.db.storytellerEffect.updateMany({
          where: { worldEventId: eventId },
          data: { isActive: false },
        });
      }

      return event;
    }),

  deleteWorldEvent: adminProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Deactivate linked StorytellerEffects (don't delete - keep history)
      await ctx.db.storytellerEffect.updateMany({
        where: { worldEventId: input.eventId },
        data: { isActive: false, worldEventId: null },
      });

      await ctx.db.worldEvent.delete({ where: { id: input.eventId } });
      return { success: true };
    }),

  simulateWorldEvent: adminProcedure
    .input(
      z.object({
        type: z.string(),
        severity: z.number().min(0).max(1),
        duration: z.number().optional(),
        affectedCountryIds: z.array(z.string()),
        parameters: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch current state of affected countries
      const countries = await ctx.db.country.findMany({
        where: { id: { in: input.affectedCountryIds } },
        select: {
          id: true,
          name: true,
          flag: true,
          currentTotalGdp: true,
          currentGdpPerCapita: true,
          realGDPGrowthRate: true,
          currentPopulation: true,
          populationGrowthRate: true,
          economicTier: true,
          publicApproval: true,
          politicalStability: true,
          economicVitality: true,
        },
      });

      // Project impact based on severity and event type
      const projectedImpacts = countries.map((c) => {
        const severityMultiplier = input.severity;
        // Negative events reduce GDP; positive events (peace, tech) boost it
        const isNegative = [
          "economic_crisis",
          "trade_war",
          "natural_disaster",
          "pandemic",
          "political_upheaval",
          "global_recession",
          "currency_crisis",
          "cyber_attack",
          "climate_disaster",
          "financial_crisis",
        ].includes(input.type);

        const gdpImpactPct = isNegative
          ? -(severityMultiplier * 0.2) // up to -20% at max severity
          : severityMultiplier * 0.15; // up to +15% boost

        const popImpactPct = isNegative
          ? -(severityMultiplier * 0.02) // up to -2% population impact
          : severityMultiplier * 0.01;

        const stabilityImpact = isNegative
          ? -(severityMultiplier * 30) // up to -30 stability points
          : severityMultiplier * 10;

        const currentGdp = c.currentTotalGdp ?? 0;
        const currentPop = c.currentPopulation ?? 0;

        return {
          countryId: c.id,
          countryName: c.name,
          countryFlag: c.flag,
          economicTier: c.economicTier,
          current: {
            gdp: currentGdp,
            gdpPerCapita: c.currentGdpPerCapita,
            population: currentPop,
            growthRate: c.realGDPGrowthRate,
            approval: c.publicApproval,
            stability: c.politicalStability,
            vitality: c.economicVitality,
          },
          projected: {
            gdp: currentGdp * (1 + gdpImpactPct),
            gdpChange: gdpImpactPct,
            population: currentPop * (1 + popImpactPct),
            populationChange: popImpactPct,
            stabilityChange: stabilityImpact,
          },
        };
      });

      return {
        projectedImpacts,
        summary: {
          totalCountriesAffected: countries.length,
          avgGdpChange:
            projectedImpacts.reduce((sum, p) => sum + p.projected.gdpChange, 0) /
            Math.max(projectedImpacts.length, 1),
          totalGdpAtRisk: projectedImpacts.reduce(
            (sum, p) => sum + Math.abs(p.current.gdp * p.projected.gdpChange),
            0
          ),
        },
      };
    }),

  // Event Chains
  getEventChains: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.eventChain.findMany({
      include: {
        events: {
          orderBy: { chainOrder: "asc" },
          select: {
            id: true,
            name: true,
            type: true,
            severity: true,
            chainOrder: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  createEventChain: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return ctx.db.eventChain.create({
        data: { name: input.name, description: input.description, createdBy: userId },
      });
    }),

  // ─── Wiki Link Management ──────────────────────────────────────────

  setWikiLink: adminProcedure
    .input(
      z.object({
        countryId: z.string(),
        wikiPageTitle: z.string().nullable(),
        wikiSource: z.enum(["ixwiki", "iiwiki"]).default("ixwiki"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.country.update({
        where: { id: input.countryId },
        data: {
          wikiPageTitle: input.wikiPageTitle,
          wikiSource: input.wikiSource,
          wikiLastSynced: new Date(),
        },
        select: { id: true, name: true, wikiPageTitle: true, wikiSource: true },
      });
      await invalidateCache(["countries."]);
      return result;
    }),

  bulkSetWikiLinks: adminProcedure
    .input(
      z.object({
        links: z
          .array(
            z.object({
              countryId: z.string(),
              wikiPageTitle: z.string(),
              wikiSource: z.enum(["ixwiki", "iiwiki"]).default("ixwiki"),
            })
          )
          .max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.all(
        input.links.map((link) =>
          ctx.db.country.update({
            where: { id: link.countryId },
            data: {
              wikiPageTitle: link.wikiPageTitle,
              wikiSource: link.wikiSource,
              wikiLastSynced: new Date(),
            },
            select: { id: true, name: true },
          })
        )
      );
      await invalidateCache(["countries."]);
      return { updated: results.length, countries: results };
    }),

  resyncWikiCache: adminProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.countryId) {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { name: true },
        });
        if (country) {
          await ctx.db.wikiCache.deleteMany({ where: { countryName: country.name } });
          await ctx.db.country.update({
            where: { id: input.countryId },
            data: { wikiLastSynced: new Date() },
          });
        }
        await invalidateCache(["countries."]);
        return { cleared: 1 };
      }
      // Clear all wiki cache
      const result = await ctx.db.wikiCache.deleteMany();
      await ctx.db.country.updateMany({
        data: { wikiLastSynced: new Date() },
      });
      await invalidateCache(["countries."]);
      return { cleared: result.count };
    }),

  createWikiArticleAward: adminProcedure
    .input(
      z.object({
        pageTitle: z.string(),
        category: z.string(),
        name: z.string(),
        description: z.string().optional(),
        recipientUsers: z.array(z.string()).optional(),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const award = await ctx.db.wikiArticleAward.create({
        data: {
          pageTitle: input.pageTitle,
          pageSlug: generateSlug(input.pageTitle),
          category: input.category,
          name: input.name,
          description: input.description ?? null,
          recipientUsers: input.recipientUsers ? input.recipientUsers : undefined,
          metadata: input.metadata ?? null,
        },
      });
      await invalidateCache(["wiki."]);
      return award;
    }),

  deleteWikiArticleAward: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.wikiArticleAward.delete({
        where: { id: input.id },
      });
      await invalidateCache(["wiki."]);
      return deleted;
    }),

  getWikiArticleAwards: adminProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.category) {
        where.category = input.category;
      }
      if (input?.search) {
        where.pageTitle = {
          contains: input.search,
          mode: "insensitive",
        };
      }
      return ctx.db.wikiArticleAward.findMany({
        where,
        orderBy: { awardedAt: "desc" },
      });
    }),

  triggerLorewardScoring: adminProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      const result = await scoreDailyWikiOS(input.date);
      return result;
    }),

  saveLorewardWinnerOverride: adminProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        type: z.enum(["daily", "weekly", "monthly"]).default("daily"),
        winnerUser: z.string(),
        winnerPage: z.string(),
        winnerScore: z.number().optional(),
        winnerBytes: z.number().optional(),
        runnerUpUser: z.string().optional().nullable(),
        runnerUpPage: z.string().optional().nullable(),
        runnerUpScore: z.number().optional().nullable(),
        runnerUpBytes: z.number().optional().nullable(),
        status: z.string().default("approved"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.lorewardEntry.upsert({
        where: {
          date_type: {
            date: input.date,
            type: input.type,
          },
        },
        create: {
          date: input.date,
          type: input.type,
          winnerUser: input.winnerUser,
          winnerPage: input.winnerPage,
          winnerScore: input.winnerScore ?? null,
          winnerBytes: input.winnerBytes ?? null,
          runnerUpUser: input.runnerUpUser ?? null,
          runnerUpPage: input.runnerUpPage ?? null,
          runnerUpScore: input.runnerUpScore ?? null,
          runnerUpBytes: input.runnerUpBytes ?? null,
          status: input.status,
        },
        update: {
          winnerUser: input.winnerUser,
          winnerPage: input.winnerPage,
          winnerScore: input.winnerScore ?? null,
          winnerBytes: input.winnerBytes ?? null,
          runnerUpUser: input.runnerUpUser ?? null,
          runnerUpPage: input.runnerUpPage ?? null,
          runnerUpScore: input.runnerUpScore ?? null,
          runnerUpBytes: input.runnerUpBytes ?? null,
          status: input.status,
          syncedAt: new Date(),
        },
      });
      await invalidateCache(["lorewards."]);
      return entry;
    }),

  pushLorewardToBot: adminProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        winner: z.object({
          user: z.string(),
          page: z.string(),
          score: z.number(),
          bytesAdded: z.number(),
        }),
        runnerUp: z
          .object({
            user: z.string(),
            page: z.string(),
            score: z.number(),
            bytesAdded: z.number(),
          })
          .optional()
          .nullable(),
        candidates: z
          .array(
            z.object({
              user: z.string(),
              page: z.string(),
              score: z.number(),
              bytesAdded: z.number(),
            })
          )
          .optional(),
        editCount: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
      try {
        const response = await fetch(`${botUrl}/bot/lorewards/announce`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          throw new Error(`Bot API returned HTTP ${response.status}`);
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        console.error("Failed to push loreward to bot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to notify bot: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  purgeWikiCache: adminProcedure
    .input(z.object({ pageTitle: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.wikiCache.deleteMany({
        where: {
          OR: [{ key: input.pageTitle }, { key: { contains: input.pageTitle } }],
        },
      });
      await invalidateCache(["wiki."]);
      return { clearedCount: result.count };
    }),

  purgeAllWikiCache: adminProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.wikiCache.deleteMany();
    await invalidateCache(["wiki."]);
    return { clearedCount: result.count };
  }),

  getWikiTemplatesList: adminProcedure.query(async ({ ctx }) => {
    const templates = await ctx.db.wikiTemplate.findMany({
      orderBy: { name: "asc" },
    });
    return templates;
  }),

  getLorewardWeights: adminProcedure.query(async ({ ctx }) => {
    const keys = [
      "lorewardWeight_bytesAdded",
      "lorewardWeight_proseRatio",
      "lorewardWeight_editDepth",
      "lorewardWeight_collaborationBonus",
      "lorewardWeight_newArticleBonus",
    ];
    const configs = await ctx.db.systemConfig.findMany({
      where: { key: { in: keys } },
    });
    const weights = configs.reduce(
      (acc, config) => {
        acc[config.key] = parseFloat(config.value);
        return acc;
      },
      {
        lorewardWeight_bytesAdded: 1.0,
        lorewardWeight_proseRatio: 1.5,
        lorewardWeight_editDepth: 1.2,
        lorewardWeight_collaborationBonus: 1.3,
        lorewardWeight_newArticleBonus: 1.5,
      } as Record<string, number>
    );
    return weights;
  }),

  saveLorewardWeights: adminProcedure
    .input(
      z.object({
        lorewardWeight_bytesAdded: z.number(),
        lorewardWeight_proseRatio: z.number(),
        lorewardWeight_editDepth: z.number(),
        lorewardWeight_collaborationBonus: z.number(),
        lorewardWeight_newArticleBonus: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates = Object.entries(input).map(([key, value]) => ({
        key,
        value: value.toString(),
      }));
      await ctx.db.$transaction(
        updates.map((cfg) =>
          ctx.db.systemConfig.upsert({
            where: { key: cfg.key },
            update: { value: cfg.value, updatedAt: new Date() },
            create: {
              key: cfg.key,
              value: cfg.value,
              description: `Loreward weight parameter for ${cfg.key}`,
            },
          })
        )
      );
      invalidateConfigCache();
      return { success: true };
    }),

  createWikiArticleAwardBatch: adminProcedure
    .input(
      z.object({
        pageTitles: z.array(z.string().min(1)),
        category: z.string(),
        name: z.string(),
        description: z.string().optional(),
        recipientUsers: z.array(z.string()).optional(),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const created = [];
      for (const title of input.pageTitles) {
        const award = await ctx.db.wikiArticleAward.create({
          data: {
            pageTitle: title,
            pageSlug: generateSlug(title),
            category: input.category,
            name: input.name,
            description: input.description ?? null,
            recipientUsers: input.recipientUsers ? input.recipientUsers : undefined,
            metadata: input.metadata ?? null,
          },
        });
        created.push(award);
      }
      await invalidateCache(["wiki."]);
      return created;
    }),

  evaluateWikiMilestones: adminProcedure
    .input(z.object({ pageTitles: z.array(z.string()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getWikiDbPool();

      let query = `
        SELECT 
          p.page_id, 
          p.page_title, 
          p.page_len, 
          COUNT(r.rev_id) as edit_count, 
          COUNT(DISTINCT r.rev_actor) as contributor_count
        FROM page p
        LEFT JOIN revision r ON r.rev_page = p.page_id
        WHERE p.page_namespace = 0 AND p.page_is_redirect = 0
      `;
      const queryParams: any[] = [];
      if (input.pageTitles && input.pageTitles.length > 0) {
        const titles = input.pageTitles.map((t) => t.trim().replace(/ /g, "_"));
        query += ` AND p.page_title IN (${titles.map(() => "?").join(",")}) `;
        queryParams.push(...titles);
      }
      query += ` GROUP BY p.page_id, p.page_title, p.page_len `;

      const [rows] = await db.execute<mysql.RowDataPacket[]>(query, queryParams);

      const existingAwards = await ctx.db.wikiArticleAward.findMany({
        select: { pageTitle: true, category: true, name: true },
      });
      const existingSet = new Set(
        existingAwards.map((a) => `${a.pageTitle}|${a.category}|${a.name}`)
      );

      const createdAwards = [];

      for (const row of rows) {
        const pageTitle = String(row.page_title).replace(/_/g, " ");
        const pageLen = Number(row.page_len);
        const editCount = Number(row.edit_count);
        const contributorCount = Number(row.contributor_count);

        const addAwardIfNew = async (name: string, category: string, description: string) => {
          const key = `${pageTitle}|${category}|${name}`;
          if (!existingSet.has(key)) {
            const award = await ctx.db.wikiArticleAward.create({
              data: {
                pageTitle,
                pageSlug: generateSlug(pageTitle),
                category,
                name,
                description,
              },
            });
            createdAwards.push(award);
            existingSet.add(key);
          }
        };

        if (pageLen >= 100000) {
          await addAwardIfNew(
            "100k Prose Milestone",
            "EDITOR_MILESTONE",
            "Article reached 100,000 bytes of content."
          );
        } else if (pageLen >= 50000) {
          await addAwardIfNew(
            "50k Prose Milestone",
            "EDITOR_MILESTONE",
            "Article reached 50,000 bytes of content."
          );
        } else if (pageLen >= 10000) {
          await addAwardIfNew(
            "10k Prose Milestone",
            "EDITOR_MILESTONE",
            "Article reached 10,000 bytes of content."
          );
        }

        if (contributorCount >= 3) {
          await addAwardIfNew(
            "Collaborative Effort",
            "COLLABORATION",
            `Article co-authored by ${contributorCount} unique contributors.`
          );
        }

        if (editCount >= 50) {
          await addAwardIfNew(
            "Deep Dive",
            "SPECIAL",
            `Article has been revised ${editCount} times, showing extensive research depth.`
          );
        }
      }

      await invalidateCache(["wiki."]);
      return { createdCount: createdAwards.length, awards: createdAwards };
    }),

  previewLorewardScoring: adminProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        proseWeight: z.number(),
        collaborativeBonus: z.number(),
        depthMaxBonus: z.number(),
        noveltyBonus: z.number(),
        importanceMaxBonus: z.number(),
      })
    )
    .query(async ({ input }) => {
      const tempWeights: ScoringWeights = {
        proseWeight: input.proseWeight,
        collaborativeBonus: input.collaborativeBonus,
        depthMaxBonus: input.depthMaxBonus,
        noveltyBonus: input.noveltyBonus,
        importanceMaxBonus: input.importanceMaxBonus,
        listPenalty: 0.3,
        minorOnlyPenalty: 0.2,
        minSingleEdit: 1000,
      };
      const result = await scoreDailyWikiOS(input.date, tempWeights);
      return result;
    }),

  syncWikiTemplateByName: adminProcedure
    .input(z.object({ name: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const cleanName = input.name.replace(/^Template:/, "").trim();
      const tdMap = await fetchTemplateData([cleanName]);
      const td = tdMap.get(cleanName);
      if (!td) {
        throw new Error(`Template "${cleanName}" not found on wiki.`);
      }
      const category = categorizeTemplate(cleanName, td.description);
      const paramCount = Object.keys(td.params || {}).length;
      const synced = await ctx.db.wikiTemplate.upsert({
        where: { name: cleanName },
        create: {
          name: cleanName,
          description: td.description ?? null,
          category,
          templateData: td as any,
          paramCount,
          lastSynced: new Date(),
        },
        update: {
          description: td.description ?? null,
          category,
          templateData: td as any,
          paramCount,
          lastSynced: new Date(),
        },
      });
      return synced;
    }),

  syncWikiTemplatesByCategory: adminProcedure
    .input(z.object({ category: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const db = getWikiDbPool();
      const catKey = input.category.trim().replace(/ /g, "_");

      const [rows] = await db.execute<mysql.RowDataPacket[]>(
        `SELECT p.page_title 
         FROM page p
         JOIN categorylinks cl ON cl.cl_from = p.page_id
         WHERE p.page_namespace = 10 AND cl.cl_to = ?`,
        [catKey]
      );

      if (rows.length === 0) {
        return {
          synced: 0,
          total: 0,
          message: `No templates found in category "${input.category}".`,
        };
      }

      const names = rows.map((r) => String(r.page_title).replace(/_/g, " "));
      const tdMap = await fetchTemplateData(names);
      let syncedCount = 0;

      for (const [name, td] of tdMap) {
        const cat = categorizeTemplate(name, td.description);
        await ctx.db.wikiTemplate.upsert({
          where: { name },
          create: {
            name,
            description: td.description ?? null,
            category: cat,
            templateData: td as any,
            paramCount: Object.keys(td.params || {}).length,
            lastSynced: new Date(),
          },
          update: {
            description: td.description ?? null,
            category: cat,
            templateData: td as any,
            paramCount: Object.keys(td.params || {}).length,
            lastSynced: new Date(),
          },
        });
        syncedCount++;
      }

      return { synced: syncedCount, total: names.length };
    }),

  searchMediaWikiTemplates: adminProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      if (!input.query.trim()) return [];
      const db = getWikiDbPool();
      const searchKey = `%${input.query.trim().replace(/ /g, "_")}%`;
      const [rows] = await db.execute<mysql.RowDataPacket[]>(
        `SELECT page_title 
         FROM page 
         WHERE page_namespace = 10 AND page_is_redirect = 0 AND page_title LIKE ?
         LIMIT 10`,
        [searchKey]
      );
      return rows.map((r) => String(r.page_title).replace(/_/g, " "));
    }),

  getCronSchedules: adminProcedure.query(async ({ ctx }) => {
    const keys = [
      "cronSchedule_lorewardsScoring",
      "cronSchedule_passiveIncome",
      "cronSchedule_cardValue",
    ];
    const configs = await ctx.db.systemConfig.findMany({
      where: { key: { in: keys } },
    });
    const schedules = configs.reduce(
      (acc, config) => {
        acc[config.key] = config.value;
        return acc;
      },
      {
        cronSchedule_lorewardsScoring: "0 6 * * *",
        cronSchedule_passiveIncome: "0 0 * * *",
        cronSchedule_cardValue: "0 */6 * * *",
      } as Record<string, string>
    );
    return schedules;
  }),

  saveCronSchedules: adminProcedure
    .input(
      z.object({
        cronSchedule_lorewardsScoring: z.string(),
        cronSchedule_passiveIncome: z.string(),
        cronSchedule_cardValue: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates = Object.entries(input).map(([key, value]) => ({
        key,
        value: value.trim(),
      }));
      await ctx.db.$transaction(
        updates.map((cfg) =>
          ctx.db.systemConfig.upsert({
            where: { key: cfg.key },
            update: { value: cfg.value, updatedAt: new Date() },
            create: {
              key: cfg.key,
              value: cfg.value,
              description: `Cron schedule expression for ${cfg.key}`,
            },
          })
        )
      );
      invalidateConfigCache();
      return { success: true };
    }),
});

let wikiDbPool: mysql.Pool | null = null;
function getWikiDbPool(): mysql.Pool {
  if (!wikiDbPool) {
    wikiDbPool = mysql.createPool({
      host: process.env.IXWIKI_DB_HOST || "localhost",
      port: Number(process.env.IXWIKI_DB_PORT) || 3306,
      user: process.env.IXWIKI_DB_USER || "ixwiki",
      password: process.env.IXWIKI_DB_PASSWORD || "",
      database: process.env.IXWIKI_DB_NAME || "ixwiki",
      waitForConnections: true,
      connectionLimit: 3,
    });
  }
  return wikiDbPool;
}
