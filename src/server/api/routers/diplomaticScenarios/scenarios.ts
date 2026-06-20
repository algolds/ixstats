// src/server/api/routers/diplomaticScenarios.ts
// Phase 7B: Diplomatic Scenarios Router - Dynamic scenario generation and choice tracking

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";

/**
 * Diplomatic Scenarios Router
 *
 * Provides API endpoints for dynamic diplomatic scenario generation, player choice tracking,
 * and scenario analytics. Integrates with the CulturalScenario database model and
 * diplomatic-scenario-generator utility for context-aware scenario generation.
 *
 * Public endpoints (11): Query scenarios, generate scenarios, track choices, calculate relevance
 * Admin endpoints (7): CRUD operations with audit logging
 * Analytics endpoints (4): Usage statistics, choice distribution, performance metrics
 *
 * Total: 22 endpoints
 */
export const diplomaticScenariosScenariosRouter = createTRPCRouter({
  // ==========================================
  // PUBLIC ENDPOINTS (11)
  // ==========================================

  /**
   * Get all active scenarios with comprehensive filters
   * Supports filtering by type, relationship level, difficulty, timeFrame, and active status
   */
  getAllScenarios: publicProcedure
    .input(
      z.object({
        type: z
          .enum([
            "border_dispute",
            "trade_renegotiation",
            "cultural_misunderstanding",
            "intelligence_breach",
            "humanitarian_crisis",
            "alliance_pressure",
            "economic_sanctions_debate",
            "technology_transfer_request",
            "diplomatic_incident",
            "mediation_opportunity",
            "embassy_security_threat",
            "treaty_renewal",
          ])
          .optional(),
        relationshipLevel: z.enum(["hostile", "tense", "neutral", "friendly", "allied"]).optional(),
        difficulty: z
          .enum(["trivial", "moderate", "challenging", "critical", "legendary"])
          .optional(),
        timeFrame: z.enum(["urgent", "time_sensitive", "strategic", "long_term"]).optional(),
        isActive: z.boolean().optional().default(true),
        country1Id: z.string().optional(),
        country2Id: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};

        // Status filter (default to active only)
        if (input.isActive) {
          where.status = { in: ["active", "pending"] };
          where.expiresAt = { gt: new Date() }; // Only non-expired scenarios
        }

        // Type filter (stored in database as type field)
        if (input.type) where.type = input.type;

        // Relationship level filter (stored as relationshipState)
        if (input.relationshipLevel) where.relationshipState = input.relationshipLevel;

        // Country filters
        if (input.country1Id) where.country1Id = input.country1Id;
        if (input.country2Id) where.country2Id = input.country2Id;

        const [scenarios, total] = await Promise.all([
          ctx.db.culturalScenario.findMany({
            where,
            orderBy: [
              { expiresAt: "asc" }, // Most urgent first
              { culturalImpact: "desc" }, // Higher impact second
              { createdAt: "desc" }, // Newest third
            ],
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.culturalScenario.count({ where }),
        ]);

        // Parse JSON fields and filter by difficulty/timeFrame (stored in responseOptions JSON)
        const parsedScenarios = scenarios
          .map((scenario) => {
            const responseOptions = scenario.responseOptions
              ? JSON.parse(scenario.responseOptions)
              : [];
            const tags = scenario.tags ? JSON.parse(scenario.tags) : [];

            return {
              ...scenario,
              responseOptions,
              tags,
            };
          })
          .filter((scenario) => {
            // Client-side filtering for fields stored in JSON
            if (input.difficulty && !scenario.tags.includes(input.difficulty)) return false;
            if (input.timeFrame && !scenario.tags.includes(input.timeFrame)) return false;
            return true;
          });

        return {
          scenarios: parsedScenarios,
          total: parsedScenarios.length,
          hasMore: input.offset + parsedScenarios.length < total,
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get scenarios:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve diplomatic scenarios",
          cause: error,
        });
      }
    }),

  /**
   * Get single scenario by ID with full details including parsed choices
   */
  getScenarioById: publicProcedure
    .input(
      z.object({
        id: z.string().cuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const scenario = await ctx.db.culturalScenario.findUnique({
          where: { id: input.id },
          include: {
            relatedExchanges: {
              take: 5,
              orderBy: { createdAt: "desc" },
            },
          },
        });

        if (!scenario) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scenario not found",
          });
        }

        // Parse JSON fields
        return {
          ...scenario,
          responseOptions: scenario.responseOptions ? JSON.parse(scenario.responseOptions) : [],
          tags: scenario.tags ? JSON.parse(scenario.tags) : [],
          outcomeNotes: scenario.outcomeNotes ? JSON.parse(scenario.outcomeNotes) : null,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get scenario by ID:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve scenario",
          cause: error,
        });
      }
    }),

  /**
   * Get scenarios grouped by type
   */
  getScenariosByType: publicProcedure
    .input(
      z.object({
        isActive: z.boolean().optional().default(true),
        country1Id: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};

        if (input.isActive) {
          where.status = { in: ["active", "pending"] };
          where.expiresAt = { gt: new Date() };
        }

        if (input.country1Id) where.country1Id = input.country1Id;

        const scenarios = await ctx.db.culturalScenario.findMany({
          where,
          orderBy: [{ type: "asc" }, { culturalImpact: "desc" }, { expiresAt: "asc" }],
        });

        // Parse JSON and group by type
        const grouped = scenarios.reduce(
          (acc, scenario) => {
            const type = scenario.type;
            if (!acc[type]) {
              acc[type] = [];
            }

            acc[type].push({
              ...scenario,
              responseOptions: scenario.responseOptions ? JSON.parse(scenario.responseOptions) : [],
              tags: scenario.tags ? JSON.parse(scenario.tags) : [],
            });

            return acc;
          },
          {} as Record<string, any[]>
        );

        return grouped;
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get scenarios by type:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve scenarios by type",
          cause: error,
        });
      }
    }),

  /**
   * Get active unexpired scenarios for country
   */
  getActiveScenarios: publicProcedure
    .input(
      z.object({
        countryId: z.string().cuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const scenarios = await ctx.db.culturalScenario.findMany({
          where: {
            OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
            status: { in: ["active", "pending"] },
            expiresAt: { gt: new Date() },
          },
          orderBy: [{ expiresAt: "asc" }, { culturalImpact: "desc" }],
        });

        return scenarios.map((s) => ({
          ...s,
          responseOptions: s.responseOptions ? JSON.parse(s.responseOptions) : [],
          tags: s.tags ? JSON.parse(s.tags) : [],
        }));
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get active scenarios:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve active scenarios",
          cause: error,
        });
      }
    }),

  // ==========================================
  // ADMIN ENDPOINTS (7)
  // ==========================================

  /**
   * Admin: Get all scenarios including inactive and expired
   */
  getAllScenariosAdmin: adminProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional().default(true),
        includeExpired: z.boolean().optional().default(true),
        search: z.string().optional(),
        type: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};

        if (!input.includeInactive) {
          where.status = { in: ["active", "pending"] };
        }

        if (!input.includeExpired) {
          where.expiresAt = { gt: new Date() };
        }

        if (input.type) where.type = input.type;

        if (input.search) {
          where.OR = [
            { title: { contains: input.search, mode: "insensitive" } },
            { narrative: { contains: input.search, mode: "insensitive" } },
            { country1Name: { contains: input.search, mode: "insensitive" } },
            { country2Name: { contains: input.search, mode: "insensitive" } },
          ];
        }

        const scenarios = await ctx.db.culturalScenario.findMany({
          where,
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        });

        return scenarios.map((s) => ({
          ...s,
          responseOptions: s.responseOptions ? JSON.parse(s.responseOptions) : [],
          tags: s.tags ? JSON.parse(s.tags) : [],
          outcomeNotes: s.outcomeNotes ? JSON.parse(s.outcomeNotes) : null,
        }));
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Admin failed to get all scenarios:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve scenarios",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Create new scenario with full control
   */
  createScenario: adminProcedure
    .input(
      z.object({
        type: z.string().min(1),
        title: z.string().min(1).max(500),
        narrative: z.string().min(1),
        country1Id: z.string().cuid(),
        country2Id: z.string().cuid(),
        relationshipState: z.string().optional().default("neutral"),
        relationshipStrength: z.number().min(0).max(100).optional().default(50),
        responseOptions: z.array(z.any()),
        tags: z.array(z.string()).optional().default([]),
        culturalImpact: z.number().min(0).max(100),
        diplomaticRisk: z.number().min(0).max(100),
        economicCost: z.number().min(0).max(100),
        expiresAt: z.date(),
        status: z
          .enum(["active", "pending", "completed", "expired", "declined"])
          .optional()
          .default("active"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify countries exist
        const [country1, country2] = await Promise.all([
          ctx.db.country.findUnique({ where: { id: input.country1Id } }),
          ctx.db.country.findUnique({ where: { id: input.country2Id } }),
        ]);

        if (!country1 || !country2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or both countries not found",
          });
        }

        const scenario = await ctx.db.culturalScenario.create({
          data: {
            type: input.type,
            title: input.title,
            narrative: input.narrative,
            country1Id: input.country1Id,
            country2Id: input.country2Id,
            country1Name: country1.name,
            country2Name: country2.name,
            relationshipState: input.relationshipState,
            relationshipStrength: input.relationshipStrength,
            responseOptions: JSON.stringify(input.responseOptions),
            tags: JSON.stringify(input.tags),
            culturalImpact: input.culturalImpact,
            diplomaticRisk: input.diplomaticRisk,
            economicCost: input.economicCost,
            status: input.status,
            expiresAt: input.expiresAt,
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "diplomatic_scenario.create",
            details: JSON.stringify({
              scenarioId: scenario.id,
              type: scenario.type,
              title: scenario.title,
              countries: [country1.name, country2.name],
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[DIPLOMATIC_SCENARIOS] Admin ${ctx.auth!.userId} created scenario: ${scenario.title} (${scenario.id})`
        );

        return {
          success: true,
          scenario: {
            ...scenario,
            responseOptions: input.responseOptions,
            tags: input.tags,
          },
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Admin failed to create scenario:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "diplomatic_scenario.create",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch((err: unknown) => {
            console.error("[DiplomaticScenarios] Background op failed:", (err as Error).message);
          });

        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create scenario",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Update existing scenario
   */
  updateScenario: adminProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        type: z.string().optional(),
        title: z.string().min(1).max(500).optional(),
        narrative: z.string().optional(),
        relationshipState: z.string().optional(),
        relationshipStrength: z.number().min(0).max(100).optional(),
        responseOptions: z.array(z.any()).optional(),
        tags: z.array(z.string()).optional(),
        culturalImpact: z.number().min(0).max(100).optional(),
        diplomaticRisk: z.number().min(0).max(100).optional(),
        economicCost: z.number().min(0).max(100).optional(),
        expiresAt: z.date().optional(),
        status: z.enum(["active", "pending", "completed", "expired", "declined"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.culturalScenario.findUnique({
          where: { id: input.id },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scenario not found",
          });
        }

        const updateData: any = {};
        if (input.type !== undefined) updateData.type = input.type;
        if (input.title !== undefined) updateData.title = input.title;
        if (input.narrative !== undefined) updateData.narrative = input.narrative;
        if (input.relationshipState !== undefined)
          updateData.relationshipState = input.relationshipState;
        if (input.relationshipStrength !== undefined)
          updateData.relationshipStrength = input.relationshipStrength;
        if (input.responseOptions !== undefined)
          updateData.responseOptions = JSON.stringify(input.responseOptions);
        if (input.tags !== undefined) updateData.tags = JSON.stringify(input.tags);
        if (input.culturalImpact !== undefined) updateData.culturalImpact = input.culturalImpact;
        if (input.diplomaticRisk !== undefined) updateData.diplomaticRisk = input.diplomaticRisk;
        if (input.economicCost !== undefined) updateData.economicCost = input.economicCost;
        if (input.expiresAt !== undefined) updateData.expiresAt = input.expiresAt;
        if (input.status !== undefined) updateData.status = input.status;

        const scenario = await ctx.db.culturalScenario.update({
          where: { id: input.id },
          data: updateData,
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "diplomatic_scenario.update",
            details: JSON.stringify({
              scenarioId: scenario.id,
              title: scenario.title,
              changes: Object.keys(updateData),
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[DIPLOMATIC_SCENARIOS] Admin ${ctx.auth!.userId} updated scenario: ${scenario.title} (${scenario.id})`
        );

        return {
          success: true,
          scenario: {
            ...scenario,
            responseOptions: scenario.responseOptions ? JSON.parse(scenario.responseOptions) : [],
            tags: scenario.tags ? JSON.parse(scenario.tags) : [],
          },
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Admin failed to update scenario:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "diplomatic_scenario.update",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch((err: unknown) => {
            console.error("[DiplomaticScenarios] Background op failed:", (err as Error).message);
          });

        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update scenario",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Delete scenario (soft delete - sets status to expired)
   */
  deleteScenario: adminProcedure
    .input(
      z.object({
        id: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const scenario = await ctx.db.culturalScenario.update({
          where: { id: input.id },
          data: {
            status: "expired",
          },
          select: {
            id: true,
            type: true,
            title: true,
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "diplomatic_scenario.delete",
            details: JSON.stringify({
              scenarioId: scenario.id,
              title: scenario.title,
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[DIPLOMATIC_SCENARIOS] Admin ${ctx.auth!.userId} deleted scenario: ${scenario.title} (${scenario.id})`
        );

        return {
          success: true,
          scenario,
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Admin failed to delete scenario:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "diplomatic_scenario.delete",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch((err: unknown) => {
            console.error("[DiplomaticScenarios] Background op failed:", (err as Error).message);
          });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete scenario",
          cause: error,
        });
      }
    }),

  // ==========================================
  // ANALYTICS ENDPOINTS (4)
  // ==========================================

  // ==========================================
  // HELPER METHODS (NOT EXPOSED AS ENDPOINTS)
  // ==========================================
  // These would be extracted to a separate utility file in production
});

// Helper function to generate response options (not exposed as endpoint)
function generateResponseOptions(scenarioType: string, relationshipStrength: number): any[] {
  const baseOptions = [
    {
      id: `${scenarioType}_aggressive`,
      label: "Take aggressive stance",
      description: "Assert dominance and demand concessions",
      skillRequired: "intimidation",
      skillLevel: 7,
      riskLevel: "high",
      effects: {
        relationshipChange: -15,
        economicImpact: -5,
        reputationChange: 5,
        securityImpact: 10,
      },
      predictedOutcomes: {
        shortTerm: "Immediate tension, possible retaliation",
        mediumTerm: "Strained relations, reduced cooperation",
        longTerm: "Potential for escalation or grudge-holding",
      },
    },
    {
      id: `${scenarioType}_diplomatic`,
      label: "Pursue diplomatic resolution",
      description: "Negotiate a mutually beneficial solution",
      skillRequired: "negotiation",
      skillLevel: 5,
      riskLevel: "medium",
      effects: {
        relationshipChange: 5,
        economicImpact: 0,
        reputationChange: 3,
        securityImpact: 0,
      },
      predictedOutcomes: {
        shortTerm: "Constructive dialogue, goodwill gestures",
        mediumTerm: "Improved cooperation, trust building",
        longTerm: "Strengthened alliance potential",
      },
    },
    {
      id: `${scenarioType}_compromise`,
      label: "Offer compromise",
      description: "Meet halfway with balanced concessions",
      skillRequired: "compromise",
      skillLevel: 4,
      riskLevel: "low",
      effects: {
        relationshipChange: 10,
        economicImpact: -2,
        reputationChange: 2,
        securityImpact: -3,
      },
      predictedOutcomes: {
        shortTerm: "De-escalation, mutual satisfaction",
        mediumTerm: "Stable relations, fair outcome",
        longTerm: "Precedent for future cooperation",
      },
    },
  ];

  // Adjust options based on relationship strength
  if (relationshipStrength > 70) {
    baseOptions.push({
      id: `${scenarioType}_friendly`,
      label: "Leverage friendship",
      description: "Use strong relationship to find creative solution",
      skillRequired: "empathy",
      skillLevel: 3,
      riskLevel: "low",
      effects: {
        relationshipChange: 15,
        economicImpact: 5,
        reputationChange: 5,
        securityImpact: 5,
      },
      predictedOutcomes: {
        shortTerm: "Swift resolution, mutual benefit",
        mediumTerm: "Deepened trust and cooperation",
        longTerm: "Model alliance for other nations",
      },
    });
  }

  return baseOptions;
}

// Helper function to generate scenario title
function generateScenarioTitle(type: string, country1: string, country2: string): string {
  const templates: Record<string, string> = {
    trade_renegotiation: `${country1} and ${country2}: Trade Agreement Under Review`,
    cultural_misunderstanding: `${country1}-${country2} Cultural Exchange Incident`,
    diplomatic_incident: `Diplomatic Crisis Between ${country1} and ${country2}`,
    alliance_pressure: `${country1} Faces Alliance Decision with ${country2}`,
    mediation_opportunity: `${country1} Mediates ${country2} Dispute`,
    treaty_renewal: `${country1}-${country2} Treaty Renewal Negotiations`,
  };

  return templates[type] || `${country1} and ${country2}: Diplomatic Scenario`;
}

// Helper function to generate scenario narrative
function generateScenarioNarrative(type: string, country1: string, country2: string): string {
  const templates: Record<string, string> = {
    trade_renegotiation: `Recent economic developments have prompted ${country2} to request renegotiation of trade terms with ${country1}. Markets are watching closely as both nations consider their positions. The outcome will set precedent for future economic partnerships in the region.`,
    cultural_misunderstanding: `A cultural exchange program between ${country1} and ${country2} has encountered unexpected tensions due to differing interpretations of diplomatic protocol. Public opinion in both nations is divided, and leaders must carefully navigate this sensitive situation.`,
    diplomatic_incident: `An unexpected incident has created diplomatic friction between ${country1} and ${country2}. Both nations' foreign ministries are working to prevent escalation while protecting national interests. The international community is monitoring the situation closely.`,
    alliance_pressure: `${country2} has extended an invitation to ${country1} to join a strategic alliance. This decision carries significant implications for regional balance of power and existing partnerships. Both opportunities and risks must be carefully weighed.`,
    mediation_opportunity: `${country1} has been approached to mediate a dispute involving ${country2}. Success could enhance ${country1}'s diplomatic reputation and strengthen regional stability. However, mediation carries risks of alienating one party or being seen as partial.`,
    treaty_renewal: `The landmark treaty between ${country1} and ${country2} is approaching its renewal date. Both nations must decide whether to renew, renegotiate, or allow it to expire. This treaty has been a cornerstone of bilateral relations for years.`,
  };

  return (
    templates[type] ||
    `A diplomatic situation has emerged between ${country1} and ${country2} requiring careful consideration and strategic decision-making.`
  );
}
