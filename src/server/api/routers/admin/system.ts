// src/server/api/routers/admin/system.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  CONFIG_CONSTANTS,
  getEconomicConfigFromDB,
  invalidateConfigCache,
} from "~/lib/config-service";
import { IxTime } from "~/lib/ixtime";
import { withJobLock } from "~/lib/system/job-lock";
import { runStatProgression, type StatProgressionResult } from "~/server/cron/stat-progression";
import { ActivityHooks } from "~/lib/activity/hooks";
import type { SystemStatus } from "~/types/ixstats";
import { readConfigKeys, writeConfigKeys } from "./_config-kv";

export const adminSystemRouter = createTRPCRouter({
  // Get global platform statistics
  getGlobalStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const totalNations = await ctx.db.country.count();
      const totalGDP = await ctx.db.country.aggregate({
        _sum: { currentTotalGdp: true },
      });

      const activeDiplomats = await ctx.db.user.count();
      const onlineUsers = 0;
      const tradeVolume = 0;
      const activeConflicts = await ctx.db.crisisEvent.count({
        where: { responseStatus: { not: "resolved" } },
      });

      return {
        totalNations,
        globalGDP: (totalGDP._sum.currentTotalGdp || 0) / 1e12,
        activeDiplomats,
        onlineUsers,
        tradeVolume,
        activeConflicts,
      };
    } catch (error) {
      console.error("Failed to get global stats:", error);
      throw new Error("Failed to retrieve global statistics", { cause: error });
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
      throw new Error("Failed to retrieve system status", { cause: error });
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
      const m = await readConfigKeys(ctx.db, ALL_CONFIG_KEYS);

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

        await writeConfigKeys(ctx.db, configUpdates, (key) => `System configuration for ${key}`);

        // Invalidate config cache so next calculation uses fresh values
        invalidateConfigCache();

        return { success: true, message: "Configuration saved successfully" };
      } catch (error) {
        console.error("Failed to save config:", error);
        throw new Error("Failed to save configuration", { cause: error });
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
    .mutation(async ({ ctx: _ctx, input }) => {
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
        throw new Error("Failed to set custom time", { cause: error });
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
          `Failed to retrieve calculation logs: ${error instanceof Error ? error.message : "Unknown error"}`,
          { cause: error }
        );
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
      const currentEpoch = IxTime.getInGameEpoch();
      const _currentIxTime = IxTime.getCurrentIxTime();

      // Calculate the time difference
      const _timeDifference = input.targetEpoch - currentEpoch;
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
    }),

  // Force recalculation of all countries: the stat-progression job with every country written.
  forceRecalculation: adminProcedure.mutation(async ({ ctx }) => {
    let outcome: Awaited<ReturnType<typeof withJobLock<StatProgressionResult>>>;
    try {
      outcome = await withJobLock(
        ctx.db,
        "stat-progression",
        () =>
          runStatProgression({
            db: ctx.db,
            force: true,
            note: "Manual recalculation from admin panel",
            onEconomicTierChange: ({ countryId, from, to }) =>
              ActivityHooks.Economic.onEconomicTierChange(countryId, from, to),
          }),
        { timeoutMs: 30 * 60_000 }
      );
    } catch (error) {
      console.error("Failed to force recalculation:", error);
      throw new Error("Failed to recalculate country statistics", { cause: error });
    }

    if (!outcome.ran) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Stat progression is already running; try again shortly.",
      });
    }

    const { updated, executionTimeMs } = outcome.result;
    return {
      success: true,
      message: `Updated ${updated} countries in ${executionTimeMs}ms`,
      countriesUpdated: updated,
      executionTimeMs,
    };
  }),

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
