import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { DiplomaticChoiceTracker } from "~/lib/diplomacy/choice-tracker";

export const diplomaticCulturalCompatibilityImpactRouter = createTRPCRouter({
  /**
   * Calculate exchange impact using Markov engine
   */
  calculateExchangeImpact: rateLimitedMutationProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        responseChoice: z.string(),
        participantSatisfaction: z.number().min(0).max(100),
        publicPerception: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get exchange
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
        include: {
          participatingCountries: true,
        },
      });

      if (!exchange) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cultural exchange not found",
        });
      }

      // Get relationship for main participant
      const mainParticipant = exchange.participatingCountries[0];
      if (!mainParticipant) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No participants in exchange",
        });
      }

      const relationship = await ctx.db.diplomaticRelation.findFirst({
        where: {
          OR: [
            { country1: exchange.hostCountryId, country2: mainParticipant.countryId },
            { country1: mainParticipant.countryId, country2: exchange.hostCountryId },
          ],
        },
      });

      // Calculate impact using CulturalImpactCalculator
      const { CulturalImpactCalculator } =
        await import("~/lib/diplomacy/cultural-impact-calculator");

      const exchangeData = {
        id: exchange.id,
        type: exchange.type,
        scenarioType: exchange.scenarioType as any,
        hostCountryId: exchange.hostCountryId,
        participantCountryIds: exchange.participatingCountries.map((p) => p.countryId),
        status: exchange.status as any,
        culturalImpact: exchange.culturalImpact,
        diplomaticValue: exchange.diplomaticValue,
        participants: exchange.participants,
        startDate: exchange.startDate,
        endDate: exchange.endDate,
      };

      const outcome = {
        exchangeId: exchange.id,
        responseChoice: input.responseChoice,
        culturalImpactChange: exchange.culturalImpact - 50,
        diplomaticChange: exchange.diplomaticValue - 50,
        economicCost: exchange.economicCost,
        participantSatisfaction: input.participantSatisfaction,
        publicPerception: input.publicPerception,
      };

      const currentRelationship = {
        state: (relationship?.status === "alliance"
          ? "allied"
          : relationship?.status === "tension"
            ? "tense"
            : "neutral") as any,
        strength: relationship?.strength || 50,
        tradeVolume: relationship?.tradeVolume || 0,
        existingCulturalTies: 50,
      };

      const history = {
        totalExchanges: 1,
        successfulExchanges: 1,
        failedExchanges: 0,
        averageCulturalImpact: exchange.culturalImpact,
        averageDiplomaticValue: exchange.diplomaticValue,
        exchangeTypeDistribution: { [exchange.type]: 1 },
        scenarioOutcomes: {},
      };

      const impact = CulturalImpactCalculator.calculateRelationshipImpact(
        exchangeData,
        outcome,
        currentRelationship,
        history
      );

      // Save outcome to database
      const savedOutcome = await ctx.db.culturalExchangeOutcome.create({
        data: {
          exchangeId: exchange.id,
          countryId: ctx.user?.countryId || "",
          responseChoice: input.responseChoice,
          culturalImpactChange: outcome.culturalImpactChange,
          diplomaticChange: outcome.diplomaticChange,
          economicCostActual: outcome.economicCost,
          participantSatisfaction: input.participantSatisfaction,
          publicPerception: input.publicPerception,
          relationshipStateBefore: impact.currentState,
          relationshipStateAfter: impact.newState,
          stateChanged: impact.stateChanged,
          transitionProbability: impact.transitionProbability,
          relationshipStrengthDelta: impact.relationshipStrengthDelta,
          culturalBonusDelta: impact.culturalBonusDelta,
          diplomaticBonusDelta: impact.diplomaticBonusDelta,
          culturalTiesStrength: impact.longTermEffects.culturalTiesStrength,
          softPowerGain: impact.longTermEffects.softPowerGain,
          peopleTopeopleBonds: impact.longTermEffects.peopleTopeopleBonds,
          impactReasoning: JSON.stringify(impact.reasoning),
        },
      });

      // Track cultural exchange outcome (success or failure)
      // Success: positive cultural impact, high satisfaction, positive diplomatic change
      // Failure: negative impact or low satisfaction
      const isSuccess =
        outcome.culturalImpactChange > 0 &&
        input.participantSatisfaction >= 60 &&
        outcome.diplomaticChange >= 0;

      await DiplomaticChoiceTracker.recordChoice({
        countryId: ctx.user?.countryId || "",
        type: isSuccess ? "cultural_exchange_success" : "cultural_exchange_failure",
        targetCountry: mainParticipant.countryName,
        targetCountryId: mainParticipant.countryId,
        details: {
          exchangeId: exchange.id,
          exchangeType: exchange.type,
          exchangeTitle: exchange.title,
          responseChoice: input.responseChoice,
          culturalImpactChange: outcome.culturalImpactChange,
          diplomaticChange: outcome.diplomaticChange,
          participantSatisfaction: input.participantSatisfaction,
          publicPerception: input.publicPerception,
          relationshipStateBefore: impact.currentState,
          relationshipStateAfter: impact.newState,
          stateChanged: impact.stateChanged,
        },
        ixTimeTimestamp: IxTime.getCurrentIxTime(),
      });

      return {
        impact,
        outcome: savedOutcome,
      };
    }),
});
