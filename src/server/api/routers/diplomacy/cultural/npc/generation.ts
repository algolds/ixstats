import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { DiplomaticChoiceTracker } from "~/lib/diplomacy/choice-tracker";

// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticCulturalNpcGenerationRouter = createTRPCRouter({
  /**
   * Generate cultural scenario for two countries
   */
  generateCulturalScenario: rateLimitedMutationProcedure
    .input(
      z.object({
        targetCountryId: z.string(),
        preferredScenarioType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get relationship data
      const relationship = await ctx.db.diplomaticRelation.findFirst({
        where: {
          OR: [
            { country1: ctx.user?.countryId || "", country2: input.targetCountryId },
            { country1: input.targetCountryId, country2: ctx.user?.countryId || "" },
          ],
        },
      });

      if (!relationship) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No diplomatic relationship exists with this country",
        });
      }

      // Get user's country
      const userCountry = await ctx.db.country.findUnique({
        where: { id: ctx.user?.countryId || "" },
      });

      const targetCountry = await ctx.db.country.findUnique({
        where: { id: input.targetCountryId },
      });

      if (!userCountry || !targetCountry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Country not found",
        });
      }

      // Create scenario context
      const scenarioContext = {
        exchangeId: `exchange_${Date.now()}`,
        exchangeType: "festival",
        country1: {
          id: userCountry.id,
          name: userCountry.name,
          culturalOpenness: 60,
          economicStrength: 55,
        },
        country2: {
          id: targetCountry.id,
          name: targetCountry.name,
          culturalOpenness: 60,
          economicStrength: 55,
        },
        relationshipState:
          relationship.status === "alliance"
            ? ("allied" as const)
            : relationship.status === "tension"
              ? ("tense" as const)
              : ("neutral" as const),
        relationshipStrength: 50,
        existingExchanges: 0,
        historicalTensions: false,
        economicTies: Math.min(100, (relationship.tradeVolume || 0) / 10000),
      };

      // Generate scenario using the scenario generator
      // Import is done at the top of the file
      const { CulturalScenarioGenerator, CULTURAL_SCENARIO_TEMPLATES } =
        await import("~/lib/diplomacy/cultural-scenario-generator");

      const template =
        input.preferredScenarioType &&
        CULTURAL_SCENARIO_TEMPLATES[
          input.preferredScenarioType as keyof typeof CULTURAL_SCENARIO_TEMPLATES
        ]
          ? CULTURAL_SCENARIO_TEMPLATES[
              input.preferredScenarioType as keyof typeof CULTURAL_SCENARIO_TEMPLATES
            ]
          : CulturalScenarioGenerator.selectScenarioTemplate(scenarioContext);

      const scenario = CulturalScenarioGenerator.generateScenario(template, scenarioContext);

      // Save scenario to database
      const savedScenario = await ctx.db.culturalScenario.create({
        data: {
          type: scenario.type,
          title: scenario.title,
          narrative: scenario.narrative,
          country1Id: userCountry.id,
          country2Id: targetCountry.id,
          country1Name: userCountry.name,
          country2Name: targetCountry.name,
          relationshipState: scenarioContext.relationshipState,
          relationshipStrength: scenarioContext.relationshipStrength,
          responseOptions: JSON.stringify(scenario.responseOptions),
          tags: JSON.stringify(scenario.tags),
          culturalImpact: template.culturalImpact,
          diplomaticRisk: template.diplomaticRisk,
          economicCost: template.economicCost,
          expiresAt: new Date(scenario.expiresAt),
        },
      });

      // Track cultural scenario generation (this represents engagement with cultural diplomacy)
      await DiplomaticChoiceTracker.recordChoice({
        countryId: userCountry.id,
        type: "generate_cultural_scenario",
        targetCountry: targetCountry.name,
        targetCountryId: targetCountry.id,
        details: {
          scenarioId: savedScenario.id,
          scenarioType: scenario.type,
          scenarioTitle: scenario.title,
          culturalImpact: template.culturalImpact,
          diplomaticRisk: template.diplomaticRisk,
          economicCost: template.economicCost,
        },
        ixTimeTimestamp: IxTime.getCurrentIxTime(),
      });

      return {
        scenario: savedScenario,
        responseOptions: scenario.responseOptions,
        metadata: scenario.metadata,
      };
    }),
});
