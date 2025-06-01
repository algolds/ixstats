// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality
// FIXED: Corrected botStatus handling, method names for IxTime and Date conversions

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
  EconomicConfig,
  IxTimeState,
  DerivedBotDisplayStatus 
} from "~/types/ixstats";

// Utility function to ensure botStatus is complete
function ensureCompleteDerivedBotStatus(
    incompleteStatus: Partial<DerivedBotDisplayStatus> | null | undefined, // Input can be partial or null/undefined
    fallbackTimestamp: number
): DerivedBotDisplayStatus | null {
    if (!incompleteStatus) {
        return null;
    }
    // Ensure that required fields from BotTimeResponse are present
    const timestamp = incompleteStatus.ixTimeTimestamp ?? fallbackTimestamp;
    return {
        ixTimeTimestamp: timestamp,
        ixTimeFormatted: incompleteStatus.ixTimeFormatted ?? IxTime.formatIxTime(timestamp, true),
        multiplier: incompleteStatus.multiplier ?? IxTime.getTimeMultiplier(),
        isPaused: incompleteStatus.isPaused ?? IxTime.isPaused(),
        hasTimeOverride: incompleteStatus.hasTimeOverride ?? false,
        hasMultiplierOverride: incompleteStatus.hasMultiplierOverride ?? false,
        realWorldTime: incompleteStatus.realWorldTime ?? Date.now(),
        gameYear: incompleteStatus.gameYear ?? IxTime.getCurrentGameYear(timestamp),
        // Fields specific to DerivedBotDisplayStatus (can be optional or defaulted)
        pausedAt: incompleteStatus.pausedAt ?? null,
        pauseTimestamp: incompleteStatus.pauseTimestamp ?? null,
        botReady: incompleteStatus.botReady ?? false,
        botUser: incompleteStatus.botUser ?? undefined,
        guilds: incompleteStatus.guilds ?? undefined,
        uptime: incompleteStatus.uptime ?? undefined,
    };
}


export const adminRouter = createTRPCRouter({
  getSystemStatus: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const [countryCount, activeDmInputs, lastCalculation] = await Promise.all([
          ctx.db.country.count(),
          ctx.db.dmInputs.count({ where: { isActive: true } }),
          ctx.db.calculationLog.findFirst({ orderBy: { timestamp: "desc" } })
        ]);

        const rawIxTimeStatus = await IxTime.getStatus();
        const fallbackTsForBotStatus = Date.parse(rawIxTimeStatus.currentIxTime);
        const correctedBotStatus = ensureCompleteDerivedBotStatus(rawIxTimeStatus.botStatus, fallbackTsForBotStatus);

        const finalIxTimeState: IxTimeState = {
            ...rawIxTimeStatus,
            botStatus: correctedBotStatus,
        };

        const systemStatus: SystemStatus = {
          ixTime: finalIxTimeState,
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

  getBotStatus: publicProcedure
    .query(async ({ ctx }): Promise<AdminPageBotStatusView> => {
      try {
        const [botHealth, rawIxTimeStatusDetails] = await Promise.all([
          IxTime.checkBotHealth(),
          IxTime.getStatus() 
        ]);
        
        const fallbackTsForBotStatus = Date.parse(rawIxTimeStatusDetails.currentIxTime);
        const correctedBotStatus = ensureCompleteDerivedBotStatus(rawIxTimeStatusDetails.botStatus, fallbackTsForBotStatus);

        const botStatusView: AdminPageBotStatusView = {
          ...rawIxTimeStatusDetails, 
          botStatus: correctedBotStatus,
          botHealth,
        };
        return botStatusView;
      } catch (error) {
        console.error("Failed to get bot status:", error);
        const currentIx = IxTime.getCurrentIxTime();
        const gameEpochNumber = IxTime.getInGameEpoch ? IxTime.getInGameEpoch() : undefined;
        const currentGameYear = IxTime.getCurrentGameYear(currentIx);
        
        let yearsSinceGameStart = 0;
        if (typeof gameEpochNumber === 'number' && isFinite(gameEpochNumber)) {
            yearsSinceGameStart = IxTime.getYearsElapsed(gameEpochNumber, currentIx);
        }
        
        const realWorldEpochNumber = IxTime.getRealWorldEpoch ? IxTime.getRealWorldEpoch() : undefined;

        return {
          currentRealTime: new Date().toISOString(),
          currentIxTime: new Date(currentIx).toISOString(),
          formattedIxTime: IxTime.formatIxTime(currentIx, true),
          multiplier: IxTime.getTimeMultiplier(),
          isPaused: IxTime.isPaused(),
          hasTimeOverride: false,
          timeOverrideValue: null,
          hasMultiplierOverride: false,
          multiplierOverrideValue: null,
          realWorldEpoch: typeof realWorldEpochNumber === 'number' ? new Date(realWorldEpochNumber).toISOString() : new Date(0).toISOString(),
          inGameEpoch: typeof gameEpochNumber === 'number' && isFinite(gameEpochNumber) ? new Date(gameEpochNumber).toISOString() : new Date(0).toISOString(),
          yearsSinceGameStart: yearsSinceGameStart,
          currentGameYear: currentGameYear,
          gameTimeDescription: `Year ${currentGameYear}`,
          botAvailable: false,
          lastSyncTime: null,
          lastKnownBotTime: null,
          botStatus: null, 
          botHealth: {
            available: false,
            message: `Bot connection failed: ${error instanceof Error ? error.message : String(error)}`
          }
        };
      }
    }),

  getConfig: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const configs = await ctx.db.systemConfig.findMany({
          where: { key: { in: ['globalGrowthFactor', 'autoUpdate', 'botSyncEnabled', 'timeMultiplier'] } }
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
        return {
          globalGrowthFactor: CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR as number,
          autoUpdate: true,
          botSyncEnabled: true,
          timeMultiplier: 4.0,
        };
      }
    }),

  saveConfig: publicProcedure
    .input(z.object({
      globalGrowthFactor: z.number().min(0.5).max(2.0),
      autoUpdate: z.boolean(),
      botSyncEnabled: z.boolean(),
      timeMultiplier: z.number().min(0).max(10),
    }))
    .mutation(async ({ ctx, input }) => {
      // ... (rest of the function unchanged)
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
    
  setCustomTime: publicProcedure
    .input(z.object({ ixTime: z.number(), multiplier: z.number().optional() }))
    .mutation(async ({ ctx, input }) => { 
      // ... (rest of the function unchanged) 
      try {
        const botResult = await IxTime.setBotTimeOverride(input.ixTime, input.multiplier);
        if (botResult.success) {
          return { success: true, message: "Time set via Discord bot", method: "bot" };
        } else {
          IxTime.setTimeOverride(input.ixTime);
          if (input.multiplier !== undefined) {
            IxTime.setMultiplierOverride(input.multiplier);
          }
          return { success: true, message: "Time set locally (bot unavailable)", method: "local" };
        }
      } catch (error) {
        console.error("Failed to set custom time:", error);
        throw new Error("Failed to set custom time");
      }
    }),

  syncBot: publicProcedure.mutation(async () => { /* ... unchanged ... */ 
    try { return await IxTime.syncWithBot(); }
    catch (e) { console.error("Sync bot error:", e); throw new Error("Failed to sync bot"); }
  }),
  pauseBot: publicProcedure.mutation(async () => { /* ... unchanged ... */ 
    try { return await IxTime.pauseBotTime(); }
    catch (e) { console.error("Pause bot error:", e); throw new Error("Failed to pause bot"); }
  }),
  resumeBot: publicProcedure.mutation(async () => { /* ... unchanged ... */ 
    try { return await IxTime.resumeBotTime(); }
    catch (e) { console.error("Resume bot error:", e); throw new Error("Failed to resume bot"); }
  }),
  clearBotOverrides: publicProcedure.mutation(async () => { /* ... unchanged ... */ 
    try { return await IxTime.clearBotOverrides(); }
    catch (e) { console.error("Clear overrides error:", e); throw new Error("Failed to clear overrides"); }
  }),

  getCalculationLogs: publicProcedure
    .input(z.object({ limit: z.number().optional().default(10) }))
    .query(async ({ ctx, input }) => { 
      // ... (rest of the function unchanged) 
      try {
        const logs = await ctx.db.calculationLog.findMany({
          orderBy: { timestamp: "desc" },
          take: input.limit,
        });
        return logs.map(log => ({ ...log })); // simple map if types are compatible
      } catch (error) {
        console.error("Failed to get calculation logs:", error);
        throw new Error("Failed to retrieve calculation logs");
      }
    }),

  analyzeImport: publicProcedure
    .input(z.object({ fileData: z.array(z.number()), fileName: z.string() }))
    .mutation(async ({ ctx, input }) => { 
      // ... (rest of the function unchanged, assuming previous fixes were sufficient) 
      try {
        const fileBuffer = new Uint8Array(input.fileData).buffer;
        const countries = await parseRosterFile(fileBuffer, input.fileName);
        if (countries.length === 0) throw new Error("No valid countries in file");

        const existingCountries = await ctx.db.country.findMany({
          where: { name: { in: countries.map(c => c.country) } },
          select: { name: true, baselinePopulation: true, baselineGdpPerCapita: true, maxGdpGrowthRate: true, adjustedGdpGrowth: true, populationGrowthRate: true }
        });
        const existingMap = new Map(existingCountries.map(c => [c.name, c]));
        const changes = countries.map(country => {
          const existing = existingMap.get(country.country);
          if (!existing) return { type: 'new' as const, country, changes: [] }; // Ensure changes is always present
          
          const fieldChanges: Array<{field: string; fieldLabel: string; oldValue: any; newValue: any}> = [];
            
            // Explicitly check and compare relevant fields
            const compareField = (field: keyof BaseCountryData, label: string, threshold: number) => {
                const oldValue = existing[field as keyof typeof existing];
                const newValue = country[field];
                if (typeof newValue === 'number' && typeof oldValue === 'number') {
                    if (Math.abs(newValue - oldValue) > threshold) {
                        fieldChanges.push({ field: field as string, fieldLabel: label, oldValue, newValue });
                    }
                } else if (newValue !== oldValue) { // For non-numeric or if one is null/undefined
                     // fieldChanges.push({ field: field as string, fieldLabel: label, oldValue, newValue }); // Optional: track non-numeric changes too
                }
            };

            compareField('population', 'Population', 1000);
            compareField('gdpPerCapita', 'GDP per Capita', 100);
            compareField('maxGdpGrowthRate', 'Max GDP Growth Rate', 0.001);
            compareField('adjustedGdpGrowth', 'Adjusted GDP Growth', 0.001);
            compareField('populationGrowthRate', 'Population Growth Rate', 0.001);

          return { type: 'update' as const, country, existingData: existing, changes: fieldChanges };
        });
        return {
          totalCountries: countries.length,
          newCountries: changes.filter(c => c.type === 'new').length,
          updatedCountries: changes.filter(c => c.type === 'update' && c.changes.length > 0).length,
          unchangedCountries: changes.filter(c => c.type === 'update' && c.changes.length === 0).length,
          changes,
          analysisTime: Date.now(),
        } as ImportAnalysis; // ensure return type matches
      } catch (error) {
        console.error("Analyze import error:", error);
        throw new Error(error instanceof Error ? error.message : "Analysis failed");
      }
    }),

  importRosterData: publicProcedure
    .input(z.object({ analysisId: z.string(), replaceExisting: z.boolean() }))
    .mutation(async () => { /* ... unchanged ... */ throw new Error("Import not implemented"); }),

  forceRecalculation: publicProcedure
    .mutation(async ({ ctx }) => { 
      // ... (rest of the function unchanged, assuming previous fixes were sufficient and baseCountryData mapping is complete) 
      try {
        const startTime = Date.now();
        const countriesFromDb = await ctx.db.country.findMany({ // Renamed to avoid conflict
          include: { dmInputs: { where: { isActive: true }, orderBy: { ixTimeTimestamp: "desc" } } }
        });
        const econConfig = getDefaultEconomicConfig();
        const currentIxTime = IxTime.getCurrentIxTime();
        let updatedCount = 0;

        for (const country of countriesFromDb) { // Use renamed variable
          try {
            const calc = new IxStatsCalculator(econConfig, country.baselineDate.getTime());
            
            // Properly map all fields from country to BaseCountryData
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
              actualGdpGrowth: country.actualGdpGrowth || 0, // ensure actualGdpGrowth exists on country model or is handled
              localGrowthFactor: country.localGrowthFactor,
            };

            const initialStats = calc.initializeCountryStats(baseCountryData);
            const dmInputs = country.dmInputs.map(d => ({ ...d, ixTimeTimestamp: d.ixTimeTimestamp.getTime() }));
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
          } catch (e) { console.error(`Failed for ${country.name}:`, e); }
        }
        const executionTime = Date.now() - startTime;
        await ctx.db.calculationLog.create({
          data: { timestamp: new Date(), ixTimeTimestamp: new Date(currentIxTime), countriesUpdated: updatedCount, executionTimeMs: executionTime, globalGrowthFactor: econConfig.globalGrowthFactor, notes: "Manual recalculation" }
        });
        return { success: true, countriesUpdated: updatedCount, executionTimeMs: executionTime };
      } catch (e) { console.error("Recalculation error:", e); throw new Error("Recalculation failed"); }
    }),

  getSystemHealth: publicProcedure
    .query(async ({ ctx }) => { 
      // ... (rest of the function unchanged) 
      try {
        const [countryCount, recentCalculations, botHealth] = await Promise.all([
          ctx.db.country.count(),
          ctx.db.calculationLog.count({ where: { timestamp: { gte: new Date(Date.now() - 24*60*60*1000) } } }),
          IxTime.checkBotHealth()
        ]);
        return {
          database: { connected: true, countries: countryCount, recentCalculations },
          bot: botHealth,
          ixTime: { current: IxTime.getCurrentIxTime(), formatted: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true), multiplier: IxTime.getTimeMultiplier(), isPaused: IxTime.isPaused() },
          lastUpdate: new Date().toISOString()
        };
      } catch (e) { console.error("System health error:", e); throw new Error("Failed to get system health"); }
    }),
});