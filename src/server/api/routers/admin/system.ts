// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  CONFIG_CONSTANTS,
  getEconomicConfigFromDB,
  invalidateConfigCache,
} from "~/lib/config-service";
import { IxTime } from "~/lib/ixtime";
import { IxStatsCalculator } from "~/lib/calculations";
import type { SystemStatus, BaseCountryData } from "~/types/ixstats";
import { prepareBaseCountryData, getCountryComponentsStatsData } from "../countries/utils";

export const adminSystemRouter = createTRPCRouter({
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

  // Get stash statistics (real DB values)
  getStashStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const [totalStashes, totalHighlights] = await Promise.all([
        ctx.db.loreStashItem.count(),
        ctx.db.loreStashAnnotation.count(),
      ]);
      return {
        totalStashes,
        totalHighlights,
        avgCacheSizeKb: 143, // Fallback/average baseline
      };
    } catch (error) {
      console.error("Failed to get stash stats:", error);
      throw new Error("Failed to retrieve stash statistics");
    }
  }),

  // Get ThinkPages statistics (real DB values)
  getThinkPagesStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const [totalPosts, totalAccounts] = await Promise.all([
        ctx.db.thinkpagesPost.count(),
        ctx.db.thinkpagesAccount.count(),
      ]);

      // Calculate weekly engagement growth (real DB ratio of posts in last 7 days vs previous 7 days)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const [postsThisWeek, postsLastWeek] = await Promise.all([
        ctx.db.thinkpagesPost.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
        ctx.db.thinkpagesPost.count({
          where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
        }),
      ]);

      let weeklyGrowth = 0.0;
      if (postsLastWeek > 0) {
        weeklyGrowth = ((postsThisWeek - postsLastWeek) / postsLastWeek) * 100;
      } else if (postsThisWeek > 0) {
        weeklyGrowth = 100.0;
      }

      return {
        totalPosts,
        totalAccounts,
        weeklyGrowth: parseFloat(weeklyGrowth.toFixed(1)),
      };
    } catch (error) {
      console.error("Failed to get thinkpages stats:", error);
      throw new Error("Failed to retrieve ThinkPages statistics");
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

  // Import roster data

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

          const componentsData = await getCountryComponentsStatsData(ctx.db, country.id);
          const baseCountryData = prepareBaseCountryData(country, componentsData);

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

  // Sync with Discord bot

  // === ADMIN USER/COUNTRY MANAGEMENT ENDPOINTS ===

  // List all users and their claimed countries

  // List all countries and their assigned users

  // Assign a user to a country (admin override)

  // Unassign a user from a country (admin override)

  // Get navigation settings (wiki/cards/labs visibility)

  // Update navigation settings (wiki/cards/labs visibility)

  // ============================================================================
  // GOD MODE - DIRECT COUNTRY DATA MANIPULATION
  // ============================================================================

  // ============================================================================
  // DIPLOMATIC OPTIONS MANAGEMENT
  // ============================================================================

  // ============================================================================
  // PHASE 2: COUNTRY GRID & UPCOMING EVENTS
  // ============================================================================

  // ============================================================================
  // STORYTELLER / WORLD EVENTS
  // ============================================================================

  // Event Chains

  // ─── Wiki Link Management ──────────────────────────────────────────

  getSystemLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
        level: z.string().optional(),
        category: z.string().optional(),
        searchTerm: z.string().optional(),
        userId: z.string().optional(),
        nextJsErrors: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};

        if (input.level && input.level !== "ALL") {
          where.level = input.level;
        }

        if (input.category && input.category !== "ALL") {
          where.category = input.category;
        }

        if (input.userId) {
          where.userId = input.userId;
        }

        if (input.nextJsErrors) {
          where.OR = [
            { component: { contains: "Global Error Handler", mode: "insensitive" } },
            { component: { contains: "Unhandled Promise Rejection", mode: "insensitive" } },
            { errorName: { not: null } },
            { errorMessage: { not: null } },
            { level: { in: ["ERROR", "CRITICAL", "FATAL"] } },
          ];
        }

        if (input.searchTerm) {
          const searchFilter = [
            { message: { contains: input.searchTerm, mode: "insensitive" } },
            { component: { contains: input.searchTerm, mode: "insensitive" } },
            { errorMessage: { contains: input.searchTerm, mode: "insensitive" } },
            { errorStack: { contains: input.searchTerm, mode: "insensitive" } },
            { category: { contains: input.searchTerm, mode: "insensitive" } },
          ];
          if (where.OR) {
            // Combine nextJsErrors conditions and search filters
            where.AND = [{ OR: where.OR }, { OR: searchFilter }];
            delete where.OR;
          } else {
            where.OR = searchFilter;
          }
        }

        const [logs, total] = await Promise.all([
          ctx.db.systemLog.findMany({
            where,
            orderBy: { timestamp: "desc" },
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.systemLog.count({ where }),
        ]);

        return {
          logs,
          total,
          hasMore: total > (input.offset || 0) + (input.limit || 100),
        };
      } catch (error) {
        console.error("Failed to get system logs:", error);
        return {
          logs: [],
          total: 0,
          hasMore: false,
        };
      }
    }),

  clearSystemLogs: adminProcedure.mutation(async ({ ctx }) => {
    try {
      await ctx.db.systemLog.deleteMany({});
      return { success: true, message: "System logs cleared successfully" };
    } catch (error) {
      console.error("Failed to clear system logs:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to clear system logs",
      });
    }
  }),
});

// getWikiDbPool is now imported from "~/lib/wiki-bridge"
