import { z } from "zod";
import type { CulturalScenario } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

type ChoiceOption = {
  id: string;
  riskLevel?: string;
  effects?: { culturalImpact?: number; relationshipChange?: number; economicImpact?: number };
};

/** Friendly pre-checks; the conditional updateMany in recordChoice is the authority. */
function assertScenarioOpenFor(scenario: CulturalScenario, countryId: string) {
  if (countryId !== scenario.country1Id && countryId !== scenario.country2Id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This scenario does not involve your country",
    });
  }
  if (scenario.status !== "active" && scenario.status !== "pending") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Scenario is no longer active" });
  }
  if (scenario.expiresAt < new Date()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Scenario has expired" });
  }
}

export const diplomaticScenariosChoicesRouter = createTRPCRouter({
  /**
   * Record player choice and update scenario status
   * Creates ScenarioGeneration record for historical tracking
   */
  recordChoice: rateLimitedMutationProcedure
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

        assertScenarioOpenFor(scenario, input.countryId);

        // Parse response options to find selected choice
        const responseOptions = scenario.responseOptions
          ? JSON.parse(scenario.responseOptions)
          : [];
        const selectedChoice = responseOptions.find(
          (opt: ChoiceOption) => opt.id === input.choiceId
        );

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
              ixTimeContext: IxTime.getCurrentIxTime(),
              culturalImpact: selectedChoice.effects?.culturalImpact || 0,
              scenarioId: input.scenarioId,
              scenarioType: scenario.type,
            },
          });
        }

        console.log(
          `[DIPLOMATIC_SCENARIOS] Recorded choice ${input.choiceId} for scenario ${input.scenarioId} by country ${input.countryId}`
        );

        return {
          success: true,
          scenario: {
            ...updatedScenario,
            responseOptions,
            tags: updatedScenario.tags ? JSON.parse(updatedScenario.tags) : [],
          },
          effects: selectedChoice.effects,
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
