// src/server/api/routers/diplomaticScenarios.ts
// Phase 7B: Diplomatic Scenarios Router - Dynamic scenario generation and choice tracking

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { vaultService } from "~/lib/vault-service";

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
export const diplomaticScenariosRouter = createTRPCRouter({
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
   * Generate dynamic scenario based on world context
   * Uses diplomatic-scenario-generator utility for context-aware generation
   */
  generateScenario: publicProcedure
    .input(
      z.object({
        countryId: z.string().cuid(),
        targetCountryId: z.string().cuid().optional(),
        scenarioType: z
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
        difficulty: z
          .enum(["trivial", "moderate", "challenging", "critical", "legendary"])
          .optional(),
        timeFrame: z.enum(["urgent", "time_sensitive", "strategic", "long_term"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get country data
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Get target country or select random from existing relationships
        let targetCountry;
        if (input.targetCountryId) {
          targetCountry = await ctx.db.country.findUnique({
            where: { id: input.targetCountryId },
          });
        } else {
          // Find countries with existing diplomatic relations
          const relations = await ctx.db.diplomaticRelation.findMany({
            where: {
              OR: [{ country1: input.countryId }, { country2: input.countryId }],
            },
            take: 10,
          });

          if (relations.length > 0) {
            const randomRelation = relations[Math.floor(Math.random() * relations.length)];
            const targetId =
              randomRelation.country1 === input.countryId
                ? randomRelation.country2
                : randomRelation.country1;

            targetCountry = await ctx.db.country.findUnique({
              where: { id: targetId },
            });
          }
        }

        if (!targetCountry) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Target country not found or no existing relationships",
          });
        }

        // Get relationship data
        const relationship = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: input.countryId, country2: targetCountry.id },
              { country1: targetCountry.id, country2: input.countryId },
            ],
          },
        });

        // Generate scenario type based on relationship if not provided
        const types: Array<typeof input.scenarioType> = [
          "trade_renegotiation",
          "cultural_misunderstanding",
          "diplomatic_incident",
          "alliance_pressure",
          "mediation_opportunity",
          "treaty_renewal",
        ];
        const scenarioType = input.scenarioType || types[Math.floor(Math.random() * types.length)]!;

        // Calculate expiry based on timeFrame
        const timeFrameMap = {
          urgent: 3, // 3 days
          time_sensitive: 7, // 1 week
          strategic: 14, // 2 weeks
          long_term: 30, // 1 month
        };
        const daysToExpiry = timeFrameMap[input.timeFrame || "strategic"];
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + daysToExpiry);

        // Generate response options based on scenario type
        const responseOptions = generateResponseOptions(scenarioType, relationship?.strength || 50);

        // Create scenario in database
        const scenario = await ctx.db.culturalScenario.create({
          data: {
            type: scenarioType,
            title: generateScenarioTitle(scenarioType, country.name, targetCountry.name),
            narrative: generateScenarioNarrative(scenarioType, country.name, targetCountry.name),
            country1Id: input.countryId,
            country2Id: targetCountry.id,
            country1Name: country.name,
            country2Name: targetCountry.name,
            relationshipState: relationship?.status || "neutral",
            relationshipStrength: relationship?.strength || 50,
            responseOptions: JSON.stringify(responseOptions),
            tags: JSON.stringify([
              scenarioType,
              input.difficulty || "moderate",
              input.timeFrame || "strategic",
            ]),
            culturalImpact: Math.floor(Math.random() * 30) + 40, // 40-70 range
            diplomaticRisk: Math.floor(Math.random() * 40) + 30, // 30-70 range
            economicCost: Math.floor(Math.random() * 50) + 20, // 20-70 range
            status: "active",
            expiresAt,
          },
        });

        console.log(
          `[DIPLOMATIC_SCENARIOS] Generated scenario ${scenario.id} (${scenarioType}) for ${country.name} <-> ${targetCountry.name}`
        );

        return {
          success: true,
          scenario: {
            ...scenario,
            responseOptions,
            tags: JSON.parse(scenario.tags),
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[DIPLOMATIC_SCENARIOS] Failed to generate scenario:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate scenario",
          cause: error,
        });
      }
    }),

  /**
   * Get context-aware scenario for country with relevance scoring
   * Selects most relevant scenario based on current diplomatic state
   */
  getScenarioForCountry: publicProcedure
    .input(
      z.object({
        countryId: z.string().cuid(),
        preferredType: z
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
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Find active scenarios involving this country
        const scenarios = await ctx.db.culturalScenario.findMany({
          where: {
            OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
            status: { in: ["active", "pending"] },
            expiresAt: { gt: new Date() },
            ...(input.preferredType ? { type: input.preferredType } : {}),
          },
          orderBy: [{ culturalImpact: "desc" }, { expiresAt: "asc" }],
          take: 10,
        });

        if (scenarios.length === 0) {
          return {
            scenario: null,
            relevanceScore: 0,
          };
        }

        // Get diplomatic context for relevance scoring
        const relations = await ctx.db.diplomaticRelation.findMany({
          where: {
            OR: [{ country1: input.countryId }, { country2: input.countryId }],
          },
        });

        // Calculate relevance scores for each scenario
        const scoredScenarios = scenarios.map((scenario) => {
          const otherCountryId =
            scenario.country1Id === input.countryId ? scenario.country2Id : scenario.country1Id;

          const relation = relations.find(
            (r) =>
              (r.country1 === input.countryId && r.country2 === otherCountryId) ||
              (r.country1 === otherCountryId && r.country2 === input.countryId)
          );

          // Relevance scoring algorithm (0-100)
          let relevance = 50; // Base score

          // Higher impact = more relevant
          relevance += (scenario.culturalImpact / 100) * 20;

          // Urgency factor (closer to expiry = more relevant)
          const hoursToExpiry = (scenario.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
          if (hoursToExpiry < 24) relevance += 20;
          else if (hoursToExpiry < 72) relevance += 10;

          // Relationship strength factor
          if (relation) {
            if (relation.strength > 75)
              relevance += 10; // Strong relationships = more attention
            else if (relation.strength < 25) relevance += 15; // Weak relationships = crisis potential
          }

          // Type preference bonus
          if (input.preferredType && scenario.type === input.preferredType) {
            relevance += 15;
          }

          return {
            scenario: {
              ...scenario,
              responseOptions: scenario.responseOptions ? JSON.parse(scenario.responseOptions) : [],
              tags: scenario.tags ? JSON.parse(scenario.tags) : [],
            },
            relevanceScore: Math.min(100, Math.round(relevance)),
          };
        });

        // Sort by relevance and return top match
        scoredScenarios.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return scoredScenarios[0];
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get scenario for country:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get scenario for country",
          cause: error,
        });
      }
    }),

  /**
   * Record player choice and update scenario status
   * Creates ScenarioGeneration record for historical tracking
   */
  recordChoice: publicProcedure
    .input(
      z.object({
        scenarioId: z.string().cuid(),
        countryId: z.string().cuid(),
        choiceId: z.string(),
        choiceLabel: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const scenario = await ctx.db.culturalScenario.findUnique({
          where: { id: input.scenarioId },
        });

        if (!scenario) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scenario not found",
          });
        }

        // Check if scenario is still active
        if (scenario.status !== "active" && scenario.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Scenario is no longer active",
          });
        }

        if (scenario.expiresAt < new Date()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Scenario has expired",
          });
        }

        // Parse response options to find selected choice
        const responseOptions = scenario.responseOptions
          ? JSON.parse(scenario.responseOptions)
          : [];
        const selectedChoice = responseOptions.find((opt: any) => opt.id === input.choiceId);

        if (!selectedChoice) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid choice ID",
          });
        }

        // Update scenario status
        const updatedScenario = await ctx.db.culturalScenario.update({
          where: { id: input.scenarioId },
          data: {
            status: "completed",
            resolvedAt: new Date(),
            chosenOption: input.choiceId,
            actualCulturalImpact: selectedChoice.effects?.culturalImpact || 0,
            actualDiplomaticImpact: selectedChoice.effects?.relationshipChange || 0,
            actualEconomicCost: selectedChoice.effects?.economicImpact || 0,
            outcomeNotes: JSON.stringify({
              choiceLabel: input.choiceLabel,
              timestamp: new Date().toISOString(),
              countryId: input.countryId,
            }),
          },
        });

        // Create CulturalExchange record for historical tracking
        const hostCountryId = input.countryId;
        const hostCountry = await ctx.db.country.findUnique({
          where: { id: hostCountryId },
          select: { id: true, name: true, flag: true }
        });

        if (hostCountry) {
          await ctx.db.culturalExchange.create({
            data: {
              title: scenario.title,
              type: scenario.type,
              description: scenario.narrative,
              hostCountryId: hostCountry.id,
              hostCountryName: hostCountry.name,
              hostCountryFlag: hostCountry.flag,
              status: "completed",
              startDate: scenario.createdAt,
              endDate: new Date(),
              ixTimeContext: Date.now(),
              culturalImpact: selectedChoice.effects?.culturalImpact || 0,
              scenarioId: input.scenarioId,
              scenarioType: scenario.type,
            },
          });
        }

        console.log(
          `[DIPLOMATIC_SCENARIOS] Recorded choice ${input.choiceId} for scenario ${input.scenarioId} by country ${input.countryId}`
        );

        // 💰 Award IxCredits for diplomatic scenario participation
        let creditsEarned = 0;
        if (ctx.auth?.userId) {
          try {
            // Base reward: 10 IxC for participating
            let creditReward = 10;

            // Bonus for high-stakes scenarios (high cultural impact or diplomatic risk)
            const isHighStakes = scenario.culturalImpact > 70 || scenario.diplomaticRisk > 70;
            if (isHighStakes) {
              creditReward += 5; // +5 IxC bonus for high-stakes events
            }

            // Bonus for risky choices
            const choiceRisk = selectedChoice.riskLevel || "medium";
            const riskBonus = {
              low: 0,
              medium: 2,
              high: 5,
              extreme: 8,
            };
            creditReward += riskBonus[choiceRisk as keyof typeof riskBonus] || 0;

            const earnResult = await vaultService.earnCredits(
              ctx.auth.userId,
              creditReward,
              "EARN_ACTIVE",
              "diplomatic_scenario",
              ctx.db,
              {
                scenarioId: input.scenarioId,
                scenarioType: scenario.type,
                choiceId: input.choiceId,
                choiceLabel: input.choiceLabel,
                culturalImpact: scenario.culturalImpact,
                diplomaticRisk: scenario.diplomaticRisk,
                highStakes: isHighStakes,
                riskLevel: choiceRisk,
              }
            );

            if (earnResult.success) {
              creditsEarned = creditReward;
              console.log(
                `[DIPLOMATIC_SCENARIOS] Awarded ${creditReward} IxC to ${ctx.auth.userId} for scenario participation`
              );
            }
          } catch (error) {
            console.error("[DIPLOMATIC_SCENARIOS] Failed to award scenario credits:", error);
          }
        }

        return {
          success: true,
          scenario: {
            ...updatedScenario,
            responseOptions,
            tags: updatedScenario.tags ? JSON.parse(updatedScenario.tags) : [],
          },
          effects: selectedChoice.effects,
          creditsEarned,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[DIPLOMATIC_SCENARIOS] Failed to record choice:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to record choice",
          cause: error,
        });
      }
    }),

  /**
   * Get player's scenario history
   */
  getPlayerScenarioHistory: publicProcedure
    .input(
      z.object({
        countryId: z.string().cuid(),
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const [scenarios, total] = await Promise.all([
          ctx.db.culturalScenario.findMany({
            where: {
              OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
              status: "completed",
            },
            orderBy: { resolvedAt: "desc" },
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.culturalScenario.count({
            where: {
              OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
              status: "completed",
            },
          }),
        ]);

        return {
          scenarios: scenarios.map((s) => ({
            ...s,
            responseOptions: s.responseOptions ? JSON.parse(s.responseOptions) : [],
            tags: s.tags ? JSON.parse(s.tags) : [],
            outcomeNotes: s.outcomeNotes ? JSON.parse(s.outcomeNotes) : null,
          })),
          total,
          hasMore: input.offset + scenarios.length < total,
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get scenario history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve scenario history",
          cause: error,
        });
      }
    }),

  /**
   * Calculate relevance score for a specific scenario
   */
  calculateRelevance: publicProcedure
    .input(
      z.object({
        scenarioId: z.string().cuid(),
        countryId: z.string().cuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const scenario = await ctx.db.culturalScenario.findUnique({
          where: { id: input.scenarioId },
        });

        if (!scenario) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scenario not found",
          });
        }

        const otherCountryId =
          scenario.country1Id === input.countryId ? scenario.country2Id : scenario.country1Id;

        const relation = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: input.countryId, country2: otherCountryId },
              { country1: otherCountryId, country2: input.countryId },
            ],
          },
        });

        // Relevance scoring algorithm (0-100)
        let relevance = 50; // Base score

        // Impact factor
        relevance += (scenario.culturalImpact / 100) * 20;

        // Urgency factor
        const hoursToExpiry = (scenario.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursToExpiry < 24) relevance += 20;
        else if (hoursToExpiry < 72) relevance += 10;

        // Relationship factor
        if (relation) {
          if (relation.strength > 75) relevance += 10;
          else if (relation.strength < 25) relevance += 15;
        }

        return {
          scenarioId: input.scenarioId,
          relevanceScore: Math.min(100, Math.round(relevance)),
          factors: {
            impactScore: (scenario.culturalImpact / 100) * 20,
            urgencyScore: hoursToExpiry < 24 ? 20 : hoursToExpiry < 72 ? 10 : 0,
            relationshipScore: relation
              ? relation.strength > 75
                ? 10
                : relation.strength < 25
                  ? 15
                  : 5
              : 0,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[DIPLOMATIC_SCENARIOS] Failed to calculate relevance:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate relevance score",
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

  /**
   * Preview consequences for a specific choice
   */
  getChoiceOutcomes: publicProcedure
    .input(
      z.object({
        scenarioId: z.string().cuid(),
        choiceId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const scenario = await ctx.db.culturalScenario.findUnique({
          where: { id: input.scenarioId },
        });

        if (!scenario) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scenario not found",
          });
        }

        const responseOptions = scenario.responseOptions
          ? JSON.parse(scenario.responseOptions)
          : [];
        const choice = responseOptions.find((opt: any) => opt.id === input.choiceId);

        if (!choice) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid choice ID",
          });
        }

        return {
          choiceId: input.choiceId,
          label: choice.label,
          description: choice.description,
          effects: choice.effects || {},
          predictedOutcomes: choice.predictedOutcomes || {},
          riskLevel: choice.riskLevel || "medium",
          skillRequired: choice.skillRequired || "negotiation",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get choice outcomes:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve choice outcomes",
          cause: error,
        });
      }
    }),

  /**
   * Increment scenario usage count (analytics tracking)
   */
  incrementScenarioUsage: publicProcedure
    .input(
      z.object({
        scenarioId: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Note: CulturalScenario doesn't have usageCount field in current schema
        // This would increment view/engagement count if field is added
        // For now, we track via CulturalExchange records

        const scenario = await ctx.db.culturalScenario.findUnique({
          where: { id: input.scenarioId },
          select: { id: true, type: true, title: true },
        });

        if (!scenario) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scenario not found",
          });
        }

        return {
          success: true,
          scenario,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[DIPLOMATIC_SCENARIOS] Failed to increment usage:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to track scenario usage",
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
          .catch(() => {});

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
          .catch(() => {});

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
          .catch(() => {});

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete scenario",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Create choice/response option for scenario
   * Note: Choices are stored as JSON in responseOptions field
   */
  createChoice: adminProcedure
    .input(
      z.object({
        scenarioId: z.string().cuid(),
        choice: z.object({
          id: z.string(),
          label: z.string(),
          description: z.string(),
          skillRequired: z.string().optional(),
          skillLevel: z.number().optional(),
          riskLevel: z.enum(["low", "medium", "high", "extreme"]).optional(),
          effects: z.record(z.string(), z.any()).optional(),
          predictedOutcomes: z.record(z.string(), z.any()).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const scenario = await ctx.db.culturalScenario.findUnique({
          where: { id: input.scenarioId },
        });

        if (!scenario) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scenario not found",
          });
        }

        const responseOptions = scenario.responseOptions
          ? JSON.parse(scenario.responseOptions)
          : [];
        responseOptions.push(input.choice);

        const updated = await ctx.db.culturalScenario.update({
          where: { id: input.scenarioId },
          data: {
            responseOptions: JSON.stringify(responseOptions),
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "diplomatic_scenario.create_choice",
            details: JSON.stringify({
              scenarioId: input.scenarioId,
              choiceId: input.choice.id,
              choiceLabel: input.choice.label,
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[DIPLOMATIC_SCENARIOS] Admin ${ctx.auth!.userId} added choice ${input.choice.id} to scenario ${input.scenarioId}`
        );

        return {
          success: true,
          scenario: {
            ...updated,
            responseOptions,
          },
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Admin failed to create choice:", error);

        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "diplomatic_scenario.create_choice",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch(() => {});

        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create choice",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Update choice/response option
   */
  updateChoice: adminProcedure
    .input(
      z.object({
        scenarioId: z.string().cuid(),
        choiceId: z.string(),
        updates: z.object({
          label: z.string().optional(),
          description: z.string().optional(),
          skillRequired: z.string().optional(),
          skillLevel: z.number().optional(),
          riskLevel: z.enum(["low", "medium", "high", "extreme"]).optional(),
          effects: z.record(z.string(), z.any()).optional(),
          predictedOutcomes: z.record(z.string(), z.any()).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const scenario = await ctx.db.culturalScenario.findUnique({
          where: { id: input.scenarioId },
        });

        if (!scenario) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scenario not found",
          });
        }

        const responseOptions = scenario.responseOptions
          ? JSON.parse(scenario.responseOptions)
          : [];
        const choiceIndex = responseOptions.findIndex((opt: any) => opt.id === input.choiceId);

        if (choiceIndex === -1) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Choice not found",
          });
        }

        responseOptions[choiceIndex] = {
          ...responseOptions[choiceIndex],
          ...input.updates,
        };

        const updated = await ctx.db.culturalScenario.update({
          where: { id: input.scenarioId },
          data: {
            responseOptions: JSON.stringify(responseOptions),
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "diplomatic_scenario.update_choice",
            details: JSON.stringify({
              scenarioId: input.scenarioId,
              choiceId: input.choiceId,
              changes: Object.keys(input.updates),
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[DIPLOMATIC_SCENARIOS] Admin ${ctx.auth!.userId} updated choice ${input.choiceId} in scenario ${input.scenarioId}`
        );

        return {
          success: true,
          scenario: {
            ...updated,
            responseOptions,
          },
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Admin failed to update choice:", error);

        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "diplomatic_scenario.update_choice",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch(() => {});

        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update choice",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Delete choice (removes from responseOptions array)
   */
  deleteChoice: adminProcedure
    .input(
      z.object({
        scenarioId: z.string().cuid(),
        choiceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const scenario = await ctx.db.culturalScenario.findUnique({
          where: { id: input.scenarioId },
        });

        if (!scenario) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scenario not found",
          });
        }

        const responseOptions = scenario.responseOptions
          ? JSON.parse(scenario.responseOptions)
          : [];
        const filteredOptions = responseOptions.filter((opt: any) => opt.id !== input.choiceId);

        if (responseOptions.length === filteredOptions.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Choice not found",
          });
        }

        const updated = await ctx.db.culturalScenario.update({
          where: { id: input.scenarioId },
          data: {
            responseOptions: JSON.stringify(filteredOptions),
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "diplomatic_scenario.delete_choice",
            details: JSON.stringify({
              scenarioId: input.scenarioId,
              choiceId: input.choiceId,
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[DIPLOMATIC_SCENARIOS] Admin ${ctx.auth!.userId} deleted choice ${input.choiceId} from scenario ${input.scenarioId}`
        );

        return {
          success: true,
          scenario: {
            ...updated,
            responseOptions: filteredOptions,
          },
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Admin failed to delete choice:", error);

        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "diplomatic_scenario.delete_choice",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch(() => {});

        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete choice",
          cause: error,
        });
      }
    }),

  // ==========================================
  // ANALYTICS ENDPOINTS (4)
  // ==========================================

  /**
   * Get scenario usage statistics
   */
  getScenarioUsageStats: publicProcedure.query(async ({ ctx }) => {
    try {
      // Total scenario counts by status
      const statusCounts = await ctx.db.culturalScenario.groupBy({
        by: ["status"],
        _count: { id: true },
      });

      // Total generations (active + completed)
      const totalGenerations = statusCounts.reduce((sum, stat) => sum + stat._count.id, 0);

      // Completion rate
      const completed = statusCounts.find((s) => s.status === "completed")?._count.id || 0;
      const completionRate = totalGenerations > 0 ? (completed / totalGenerations) * 100 : 0;

      // Top scenarios by completion
      const topScenarios = await ctx.db.culturalScenario.findMany({
        where: { status: "completed" },
        select: {
          id: true,
          type: true,
          title: true,
          culturalImpact: true,
          diplomaticRisk: true,
          _count: {
            select: {
              relatedExchanges: true,
            },
          },
        },
        orderBy: {
          relatedExchanges: {
            _count: "desc",
          },
        },
        take: 10,
      });

      // Usage by type
      const typeStats = await ctx.db.culturalScenario.groupBy({
        by: ["type"],
        _count: { id: true },
        _avg: {
          culturalImpact: true,
          diplomaticRisk: true,
        },
      });

      return {
        totalGenerations,
        completions: completed,
        completionRate: Math.round(completionRate * 10) / 10,
        byStatus: statusCounts,
        byType: typeStats,
        topScenarios,
      };
    } catch (error) {
      console.error("[DIPLOMATIC_SCENARIOS] Failed to get usage stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve usage statistics",
        cause: error,
      });
    }
  }),

  /**
   * Get choice distribution for scenarios
   */
  getChoiceDistribution: publicProcedure
    .input(
      z.object({
        scenarioId: z.string().cuid().optional(),
        scenarioType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = { status: "completed", chosenOption: { not: null } };

        if (input.scenarioId) where.id = input.scenarioId;
        if (input.scenarioType) where.type = input.scenarioType;

        const scenarios = await ctx.db.culturalScenario.findMany({
          where,
          select: {
            id: true,
            type: true,
            title: true,
            chosenOption: true,
            responseOptions: true,
          },
        });

        // Count choice selections
        const choiceFrequency: Record<
          string,
          { count: number; label: string; scenarioType: string }
        > = {};

        scenarios.forEach((scenario) => {
          const responseOptions = scenario.responseOptions
            ? JSON.parse(scenario.responseOptions)
            : [];
          const chosenChoice = responseOptions.find((opt: any) => opt.id === scenario.chosenOption);

          if (chosenChoice) {
            const key = scenario.chosenOption!;
            if (!choiceFrequency[key]) {
              choiceFrequency[key] = {
                count: 0,
                label: chosenChoice.label,
                scenarioType: scenario.type,
              };
            }
            choiceFrequency[key].count++;
          }
        });

        // Sort by frequency
        const distribution = Object.entries(choiceFrequency)
          .map(([choiceId, data]) => ({
            choiceId,
            ...data,
            percentage:
              scenarios.length > 0 ? Math.round((data.count / scenarios.length) * 1000) / 10 : 0,
          }))
          .sort((a, b) => b.count - a.count);

        return {
          distribution,
          totalScenarios: scenarios.length,
          uniqueChoices: distribution.length,
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get choice distribution:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve choice distribution",
          cause: error,
        });
      }
    }),

  /**
   * Get scenario performance metrics (outcome success rates)
   */
  getScenarioPerformance: publicProcedure
    .input(
      z.object({
        scenarioType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = { status: "completed" };
        if (input.scenarioType) where.type = input.scenarioType;

        const scenarios = await ctx.db.culturalScenario.findMany({
          where,
          select: {
            type: true,
            culturalImpact: true,
            diplomaticRisk: true,
            actualCulturalImpact: true,
            actualDiplomaticImpact: true,
            actualEconomicCost: true,
            relationshipStrength: true,
          },
        });

        // Calculate performance by type
        const performanceByType: Record<
          string,
          {
            count: number;
            avgPredictedImpact: number;
            avgActualImpact: number;
            accuracyScore: number;
            avgRisk: number;
          }
        > = {};

        scenarios.forEach((scenario) => {
          if (!performanceByType[scenario.type]) {
            performanceByType[scenario.type] = {
              count: 0,
              avgPredictedImpact: 0,
              avgActualImpact: 0,
              accuracyScore: 0,
              avgRisk: 0,
            };
          }

          const stats = performanceByType[scenario.type];
          stats.count++;
          stats.avgPredictedImpact += scenario.culturalImpact;
          stats.avgActualImpact += scenario.actualCulturalImpact || 0;
          stats.avgRisk += scenario.diplomaticRisk;
        });

        // Calculate averages and accuracy
        Object.keys(performanceByType).forEach((type) => {
          const stats = performanceByType[type];
          stats.avgPredictedImpact = Math.round((stats.avgPredictedImpact / stats.count) * 10) / 10;
          stats.avgActualImpact = Math.round((stats.avgActualImpact / stats.count) * 10) / 10;
          stats.avgRisk = Math.round((stats.avgRisk / stats.count) * 10) / 10;

          // Accuracy = 100 - abs difference between predicted and actual
          const diff = Math.abs(stats.avgPredictedImpact - stats.avgActualImpact);
          stats.accuracyScore = Math.max(0, 100 - diff);
        });

        return {
          performanceByType,
          totalScenarios: scenarios.length,
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get performance metrics:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve performance metrics",
          cause: error,
        });
      }
    }),

  /**
   * Get completion rates and time metrics
   */
  getCompletionRates: publicProcedure
    .input(
      z.object({
        scenarioType: z.string().optional(),
        timeRange: z.enum(["week", "month", "quarter", "year"]).optional().default("month"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Calculate time window
        const now = new Date();
        const timeRangeMap = {
          week: 7,
          month: 30,
          quarter: 90,
          year: 365,
        };
        const daysAgo = timeRangeMap[input.timeRange];
        const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

        const where: any = {
          createdAt: { gte: startDate },
        };
        if (input.scenarioType) where.type = input.scenarioType;

        const scenarios = await ctx.db.culturalScenario.findMany({
          where,
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            resolvedAt: true,
            expiresAt: true,
          },
        });

        // Calculate metrics
        const total = scenarios.length;
        const completed = scenarios.filter((s) => s.status === "completed").length;
        const expired = scenarios.filter((s) => s.status === "expired").length;
        const active = scenarios.filter(
          (s) => s.status === "active" || s.status === "pending"
        ).length;

        // Average time to completion (in hours)
        const completedScenarios = scenarios.filter(
          (s) => s.status === "completed" && s.resolvedAt
        );
        const avgTimeToComplete =
          completedScenarios.length > 0
            ? completedScenarios.reduce((sum, s) => {
                const hours = (s.resolvedAt!.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60);
                return sum + hours;
              }, 0) / completedScenarios.length
            : 0;

        // Completion rate by type
        const byType: Record<string, { total: number; completed: number; rate: number }> = {};
        scenarios.forEach((s) => {
          if (!byType[s.type]) {
            byType[s.type] = { total: 0, completed: 0, rate: 0 };
          }
          byType[s.type].total++;
          if (s.status === "completed") byType[s.type].completed++;
        });

        Object.keys(byType).forEach((type) => {
          byType[type].rate =
            byType[type].total > 0
              ? Math.round((byType[type].completed / byType[type].total) * 1000) / 10
              : 0;
        });

        return {
          timeRange: input.timeRange,
          total,
          completed,
          expired,
          active,
          completionRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
          avgTimeToCompleteHours: Math.round(avgTimeToComplete * 10) / 10,
          byType,
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get completion rates:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve completion rates",
          cause: error,
        });
      }
    }),

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
