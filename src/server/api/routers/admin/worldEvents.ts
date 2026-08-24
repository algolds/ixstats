// src/server/api/routers/admin/worldEvents.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AppError } from "~/lib/app-error";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export const adminWorldEventsRouter = createTRPCRouter({
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
});

// getWikiDbPool is now imported from "~/lib/wiki-os/adapters/mediawiki/bridge"
