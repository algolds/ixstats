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
export const diplomaticScenariosChoicesRouter = createTRPCRouter({
  // ==========================================
  // PUBLIC ENDPOINTS (11)
  // ==========================================

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
          select: { id: true, name: true, flag: true },
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

  // ==========================================
  // ADMIN ENDPOINTS (7)
  // ==========================================

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
          .catch((err: unknown) => {
            console.error("[DiplomaticScenarios] Background op failed:", (err as Error).message);
          });

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
          .catch((err: unknown) => {
            console.error("[DiplomaticScenarios] Background op failed:", (err as Error).message);
          });

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
          .catch((err: unknown) => {
            console.error("[DiplomaticScenarios] Background op failed:", (err as Error).message);
          });

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

  // ==========================================
  // HELPER METHODS (NOT EXPOSED AS ENDPOINTS)
  // ==========================================
  // These would be extracted to a separate utility file in production
});

// Helper function to generate response options (not exposed as endpoint)
// eslint-disable-next-line unused-imports/no-unused-vars
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
// eslint-disable-next-line unused-imports/no-unused-vars
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
// eslint-disable-next-line unused-imports/no-unused-vars
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
