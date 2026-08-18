// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { notificationHooks } from "~/lib/notification-hooks";

export const adminCountriesGodModeRouter = createTRPCRouter({
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

  // Import roster data

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

  // ============================================================================
  // STORYTELLER / WORLD EVENTS
  // ============================================================================

  // Event Chains

  // ─── Wiki Link Management ──────────────────────────────────────────
});

// getWikiDbPool is now imported from "~/lib/wiki/bridge"
