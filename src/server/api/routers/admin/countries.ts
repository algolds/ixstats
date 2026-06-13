// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import { IxTime } from "~/lib/ixtime";
import { parseRosterFile } from "~/lib/data-parser";
import { notificationHooks } from "~/lib/notification-hooks";
import type { ImportAnalysis, BaseCountryData } from "~/types/ixstats";
import { generateSlug } from "~/lib/slug-utils";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";

export const adminCountriesRouter = createTRPCRouter({
  // Internal calculation formulas management
  // Get global statistics for SDI interface

  // Get stash statistics (real DB values)

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

  // ============================================================================
  // STORYTELLER / WORLD EVENTS
  // ============================================================================

  // Event Chains

  // ─── Wiki Link Management ──────────────────────────────────────────
});

// getWikiDbPool is now imported from "~/lib/wiki-bridge"
