// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import { IxTime } from "~/lib/ixtime";
import { parseRosterFile } from "~/lib/admin/roster-parser";
import type { ImportAnalysis, BaseCountryData } from "~/types/ixstats";
import { generateSlug } from "~/lib/utils";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";

export const adminCountriesImportRouter = createTRPCRouter({

  // Get ThinkPages statistics (real DB values)

  // Get system status

  // Get bot status with health check

  // Get system configuration (includes all economic control parameters)

  // Save system configuration (all economic control parameters)

  // Set custom time via bot or local override

  // Bot control operations

  // Get calculation logs

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
        throw new Error(error instanceof Error ? error.message : "Failed to analyze import file", { cause: error });
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
              let hasDemographicChange = false;

              if (existing.baselinePopulation !== country.population) {
                updateData.baselinePopulation = country.population;
                updateData.currentPopulation = country.population;
                updateData.populationTier = getPopulationTierFromPopulation(country.population);
                hasDemographicChange = true;
              }
              if (existing.baselineGdpPerCapita !== country.gdpPerCapita) {
                updateData.baselineGdpPerCapita = country.gdpPerCapita;
                updateData.currentGdpPerCapita = country.gdpPerCapita;
                updateData.economicTier = getEconomicTierFromGdpPerCapita(country.gdpPerCapita);
                hasDemographicChange = true;
              }

              if (hasDemographicChange) {
                const targetPop = updateData.currentPopulation ?? existing.currentPopulation;
                const targetGdpPC = updateData.currentGdpPerCapita ?? existing.currentGdpPerCapita;
                const totalGdp = targetPop * targetGdpPC;
                updateData.currentTotalGdp = totalGdp;
                updateData.nominalGDP = totalGdp;
              }

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

  // Force recalculation of all countries

  // Get system health

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
});

// getWikiDbPool is now imported from "~/lib/wiki-os/adapters/mediawiki/bridge"
