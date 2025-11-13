/**
 * Crisis Events API Router
 *
 * Manages crisis events including natural disasters, economic crises, diplomatic incidents,
 * security threats, and other significant events that affect countries.
 *
 * Features:
 * - Full CRUD operations for crisis events
 * - Event severity tracking (low, medium, high, critical)
 * - Multi-country impact tracking
 * - Response status monitoring
 * - Historical event analysis
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { vaultService } from "~/lib/vault-service";

// Zod schemas for crisis events
const CrisisEventSchema = z.object({
  type: z.enum([
    "natural_disaster",
    "economic_crisis",
    "diplomatic_incident",
    "security_threat",
    "pandemic",
    "political_crisis",
    "environmental_crisis",
    "technological_crisis",
  ]),
  title: z.string().min(1).max(200),
  severity: z.enum(["low", "medium", "high", "critical"]),
  affectedCountries: z.string().optional(), // JSON array of country IDs
  casualties: z.number().int().min(0).optional(),
  economicImpact: z.number().optional(), // Economic impact in billions
  responseStatus: z
    .enum(["pending", "in_progress", "resolved", "monitoring"])
    .default("pending"),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  category: z
    .enum(["economic", "diplomatic", "social", "governance", "security"])
    .default("governance"),
  timestamp: z.date().optional(),
});

const CreateCrisisEventSchema = CrisisEventSchema;
const UpdateCrisisEventSchema = CrisisEventSchema.partial().extend({
  id: z.string(),
});

export const crisisEventsRouter = createTRPCRouter({
  /**
   * Get all crisis events with filtering and pagination
   */
  getAll: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        type: z.string().optional(),
        category: z.enum(["economic", "diplomatic", "social", "governance", "security"]).optional(),
        countryId: z.string().optional(),
        responseStatus: z
          .enum(["pending", "in_progress", "resolved", "monitoring"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const where: any = {};

      if (input.severity) {
        where.severity = input.severity;
      }

      if (input.type) {
        where.type = input.type;
      }

      if (input.category) {
        where.category = input.category;
      }

      if (input.responseStatus) {
        where.responseStatus = input.responseStatus;
      }

      if (input.countryId) {
        where.affectedCountries = {
          contains: input.countryId,
        };
      }

      const events = await db.crisisEvent.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined = undefined;
      if (events.length > input.limit) {
        const nextItem = events.pop();
        nextCursor = nextItem!.id;
      }

      return {
        events,
        nextCursor,
      };
    }),

  /**
   * Get a single crisis event by ID
   */
  getById: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.crisisEvent.findUnique({
        where: { id: input.id },
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crisis event not found",
        });
      }

      return event;
    }),

  /**
   * Get active/ongoing crisis events
   */
  getActive: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const activeEvents = await ctx.db.crisisEvent.findMany({
        where: {
          responseStatus: {
            in: ["pending", "in_progress", "monitoring"],
          },
        },
        orderBy: [{ severity: "desc" }, { timestamp: "desc" }],
        take: input.limit,
      });

      return activeEvents;
    }),

  /**
   * Get crisis events affecting a specific country
   */
  getByCountry: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        includeResolved: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        affectedCountries: {
          contains: input.countryId,
        },
      };

      if (!input.includeResolved) {
        where.responseStatus = {
          in: ["pending", "in_progress", "monitoring"],
        };
      }

      const events = await ctx.db.crisisEvent.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: input.limit,
      });

      return events;
    }),

  /**
   * Get crisis event statistics
   */
  getStatistics: publicProcedure
    .input(
      z.object({
        timeframe: z.enum(["week", "month", "quarter", "year", "all"]).default("month"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Calculate date threshold based on timeframe
      const now = new Date();
      let dateThreshold = new Date(0); // Default: all time

      switch (input.timeframe) {
        case "week":
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "quarter":
          dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "year":
          dateThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }

      const events = await db.crisisEvent.findMany({
        where:
          input.timeframe !== "all"
            ? {
                timestamp: {
                  gte: dateThreshold,
                },
              }
            : undefined,
      });

      // Calculate statistics
      const totalEvents = events.length;
      const criticalEvents = events.filter((e) => e.severity === "critical").length;
      const highSeverityEvents = events.filter((e) => e.severity === "high").length;
      const activeEvents = events.filter((e) =>
        ["pending", "in_progress", "monitoring"].includes(e.responseStatus || "")
      ).length;
      const resolvedEvents = events.filter((e) => e.responseStatus === "resolved").length;
      const totalCasualties = events.reduce((sum, e) => sum + (e.casualties || 0), 0);
      const totalEconomicImpact = events.reduce((sum, e) => sum + (e.economicImpact || 0), 0);

      // Events by type
      const eventsByType: Record<string, number> = {};
      events.forEach((e) => {
        eventsByType[e.type] = (eventsByType[e.type] || 0) + 1;
      });

      // Events by category
      const eventsByCategory: Record<string, number> = {};
      events.forEach((e) => {
        eventsByCategory[e.category] = (eventsByCategory[e.category] || 0) + 1;
      });

      return {
        totalEvents,
        criticalEvents,
        highSeverityEvents,
        activeEvents,
        resolvedEvents,
        totalCasualties,
        totalEconomicImpact,
        eventsByType,
        eventsByCategory,
        timeframe: input.timeframe,
      };
    }),

  /**
   * Create a new crisis event (admin only)
   */
  create: adminProcedure.input(CreateCrisisEventSchema).mutation(async ({ ctx, input }) => {
    const event = await ctx.db.crisisEvent.create({
      data: {
        ...input,
        timestamp: input.timestamp || new Date(),
      },
    });

    return event;
  }),

  /**
   * Update a crisis event (admin only)
   */
  update: adminProcedure.input(UpdateCrisisEventSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;

    const event = await ctx.db.crisisEvent.findUnique({
      where: { id },
    });

    if (!event) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Crisis event not found",
      });
    }

    const updatedEvent = await ctx.db.crisisEvent.update({
      where: { id },
      data,
    });

    return updatedEvent;
  }),

  /**
   * Update response status (protected - country officials can update events affecting their country)
   */
  updateResponseStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        responseStatus: z.enum(["pending", "in_progress", "resolved", "monitoring"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.crisisEvent.findUnique({
        where: { id: input.id },
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crisis event not found",
        });
      }

      const updatedEvent = await ctx.db.crisisEvent.update({
        where: { id: input.id },
        data: {
          responseStatus: input.responseStatus,
          updatedAt: new Date(),
        },
      });

      // 💰 Award IxCredits for crisis response (if user authenticated)
      let creditsEarned = 0;
      if (ctx.auth?.userId) {
        try {
          let creditReward = 0;
          let rewardSource = "";

          // Award credits based on status transitions
          if (event.responseStatus === "pending" && input.responseStatus === "in_progress") {
            // Taking action: 5 IxC base
            creditReward = 5;
            rewardSource = "crisis_response_action";
          } else if (event.responseStatus === "in_progress" && input.responseStatus === "resolved") {
            // Successful resolution: 10-20 IxC based on severity
            const severityBonus = {
              low: 10,
              medium: 15,
              high: 20,
              critical: 25,
            };
            creditReward = severityBonus[event.severity as keyof typeof severityBonus] || 10;
            rewardSource = "crisis_response_success";
          } else if (event.responseStatus === "in_progress" && input.responseStatus === "monitoring") {
            // Contained/mitigated: 8 IxC neutral response
            creditReward = 8;
            rewardSource = "crisis_response_contained";
          }

          if (creditReward > 0) {
            const earnResult = await vaultService.earnCredits(
              ctx.auth.userId,
              creditReward,
              "EARN_ACTIVE",
              rewardSource,
              ctx.db,
              {
                crisisId: event.id,
                crisisType: event.type,
                crisisSeverity: event.severity,
                statusTransition: `${event.responseStatus} -> ${input.responseStatus}`,
              }
            );

            if (earnResult.success) {
              creditsEarned = creditReward;
              console.log(
                `[Crisis Events] Awarded ${creditReward} IxC to ${ctx.auth.userId} for ${rewardSource}`
              );
            }
          }
        } catch (error) {
          // Don't block crisis response if earning fails
          console.error("[Crisis Events] Failed to award crisis response credits:", error);
        }
      }

      return {
        ...updatedEvent,
        creditsEarned,
      };
    }),

  /**
   * Delete a crisis event (admin only)
   */
  delete: adminProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.crisisEvent.findUnique({
        where: { id: input.id },
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crisis event not found",
        });
      }

      await ctx.db.crisisEvent.delete({
        where: { id: input.id },
      });

      return { success: true, id: input.id };
    }),

  /**
   * Batch create crisis events (admin only)
   */
  batchCreate: adminProcedure
    .input(
      z.object({
        events: z.array(CreateCrisisEventSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const createdEvents = await ctx.db.crisisEvent.createMany({
        data: input.events.map((event) => ({
          ...event,
          timestamp: event.timestamp || new Date(),
        })),
      });

      return {
        count: createdEvents.count,
        success: true,
      };
    }),
});
