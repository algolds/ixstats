import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { clockForCountry } from "~/server/shared/realm-time";
import { assertRealmsMatch } from "~/server/shared/same-realm-guard";
import type { PrismaClient } from "@prisma/client";
import { DiplomaticChoiceTracker } from "~/lib/diplomacy/choice-tracker";
import { NPCPersonalitySystem } from "~/lib/diplomacy/npc-personality";
import { buildNpcObservableData, toMarkovState } from "~/lib/diplomacy/npc-observable-data";

/** A side of a scenario: openness from its observable diplomacy (as the NPC AI reads it), strength from GDP per head. */
async function scenarioSide(
  db: Pick<PrismaClient, "diplomaticRelation" | "embassy">,
  country: { id: string; name: string; currentGdpPerCapita: number | null }
) {
  const [relationships, embassies] = await Promise.all([
    db.diplomaticRelation.findMany({
      where: { OR: [{ country1: country.id }, { country2: country.id }] },
    }),
    db.embassy.findMany({
      where: { OR: [{ guestCountryId: country.id }, { hostCountryId: country.id }] },
    }),
  ]);
  const personality = NPCPersonalitySystem.calculatePersonality(
    country.id,
    country.name,
    buildNpcObservableData(relationships, embassies)
  );
  return {
    id: country.id,
    name: country.name,
    culturalOpenness: personality.traits.culturalOpenness,
    economicStrength: Math.min(100, Math.round((country.currentGdpPerCapita ?? 0) / 1000)),
  };
}

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
      assertRealmsMatch(userCountry.realmId, targetCountry.realmId);

      // Scenario context from the two nations and their relation as they stand
      const [country1, country2, existingExchanges] = await Promise.all([
        scenarioSide(ctx.db, userCountry),
        scenarioSide(ctx.db, targetCountry),
        ctx.db.culturalExchange.count({
          where: {
            OR: [
              {
                hostCountryId: userCountry.id,
                participatingCountries: { some: { countryId: targetCountry.id } },
              },
              {
                hostCountryId: targetCountry.id,
                participatingCountries: { some: { countryId: userCountry.id } },
              },
            ],
          },
        }),
      ]);
      const scenarioContext = {
        exchangeId: `exchange_${Date.now()}`,
        exchangeType: input.preferredScenarioType ?? "festival",
        country1,
        country2,
        relationshipState: toMarkovState(relationship.relationship),
        relationshipStrength: relationship.strength,
        existingExchanges,
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
        ixTimeTimestamp: (await clockForCountry(ctx.db, userCountry.id)).now(),
      });

      return {
        scenario: savedScenario,
        responseOptions: scenario.responseOptions,
        metadata: scenario.metadata,
      };
    }),
});
