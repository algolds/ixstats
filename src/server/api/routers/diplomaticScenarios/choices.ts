// src/server/api/routers/diplomaticScenarios.ts
// Phase 7B: Diplomatic Scenarios Router - Dynamic scenario generation and choice tracking

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { vaultService } from "~/lib/vault/vault-service";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

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
  recordChoice: protectedProcedure
    .input(
      z.object({
        scenarioId: z.string().cuid(),
        countryId: z.string().cuid(),
        choiceId: z.string(),
        choiceLabel: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

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

        if (
          input.countryId !== scenario.country1Id &&
          input.countryId !== scenario.country2Id
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This scenario does not involve your country",
          });
        }

        // Friendly pre-checks; the conditional updateMany below is the authority
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

        // Resolve the scenario only if it is still open (conditional write; plan 331)
        const now = new Date();
        const resolved = await ctx.db.culturalScenario.updateMany({
          where: {
            id: input.scenarioId,
            status: { in: ["active", "pending"] },
            expiresAt: { gt: now },
          },
          data: {
            status: "completed",
            resolvedAt: now,
            chosenOption: input.choiceId,
            actualCulturalImpact: selectedChoice.effects?.culturalImpact || 0,
            actualDiplomaticImpact: selectedChoice.effects?.relationshipChange || 0,
            actualEconomicCost: selectedChoice.effects?.economicImpact || 0,
            outcomeNotes: JSON.stringify({
              choiceLabel: input.choiceLabel,
              timestamp: now.toISOString(),
              countryId: input.countryId,
            }),
          },
        });
        if (resolved.count !== 1) {
          throw new TRPCError({ code: "CONFLICT", message: "Scenario was already resolved" });
        }
        const updatedScenario = await ctx.db.culturalScenario.findUniqueOrThrow({
          where: { id: input.scenarioId },
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
});
