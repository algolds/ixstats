import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import {
  NPCCulturalParticipation,
  type NPCParticipationContext,
} from "~/lib/diplomacy/npc-cultural-participation";
import { NPCPersonalitySystem } from "~/lib/diplomacy/npc-personality";
import { buildNpcObservableData } from "~/lib/diplomacy/npc-observable-data";

// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticCulturalNpcResponsesRouter = createTRPCRouter({
  // Get NPC responses for cultural exchange using diplomatic AI
  getNPCCulturalResponses: publicProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        hostCountryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get the cultural exchange with all participant countries
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

        // Get all participants (excluding the host)
        const participants = exchange.participatingCountries.filter(
          (p: { countryId: string }) => p.countryId !== input.hostCountryId
        );

        if (participants.length === 0) {
          return [];
        }

        // Collect unique participant country IDs for batch queries
        const participantCountryIds = [...new Set(participants.map((p: any) => p.countryId))];

        // Batch fetch all relationships and embassies for participants
        const [allRelationships, allEmbassies] = await Promise.all([
          ctx.db.diplomaticRelation.findMany({
            where: {
              OR: [
                { country1: { in: participantCountryIds } },
                { country2: { in: participantCountryIds } },
              ],
            },
          }),
          ctx.db.embassy.findMany({
            where: {
              OR: [
                { guestCountryId: { in: participantCountryIds } },
                { hostCountryId: { in: participantCountryIds } },
              ],
            },
          }),
        ]);

        // Generate NPC responses for each participant
        const responses = participants.map((participant: any) => {
          try {
            // Filter relationship and embassy data in memory for this participant
            const relationships = allRelationships.filter(
              (r: any) =>
                r.country1 === participant.countryId || r.country2 === participant.countryId
            );

            const embassies = allEmbassies.filter(
              (e: any) =>
                e.guestCountryId === participant.countryId ||
                e.hostCountryId === participant.countryId
            );

            // Build observable data for personality calculation
            const observableData = buildNpcObservableData(relationships, embassies);

            // Calculate NPC personality
            const npcPersonality = NPCPersonalitySystem.calculatePersonality(
              participant.countryId,
              participant.countryName,
              observableData
            );

            // Get relationship with host country
            const relationshipWithHost = relationships.find(
              (r: any) =>
                (r.country1 === participant.countryId && r.country2 === input.hostCountryId) ||
                (r.country2 === participant.countryId && r.country1 === input.hostCountryId)
            );

            // Build participation context
            const participationContext: NPCParticipationContext = {
              npcCountryId: participant.countryId,
              npcCountryName: participant.countryName,
              npcPersonality,
              hostCountryId: input.hostCountryId,
              hostCountryName: exchange.hostCountryName,
              relationshipStrength: relationshipWithHost?.strength ?? 50,
              relationshipState: relationshipWithHost?.relationship ?? "neutral",
              exchangeType: exchange.type,
              exchangeDetails: {
                title: exchange.title,
                description: exchange.description || "",
                culturalImpact: 50, // Default values - could calculate based on exchange type
                diplomaticValue: 40,
                economicCost: 25000,
                duration: Math.ceil(
                  (new Date(exchange.endDate).getTime() - new Date(exchange.startDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                ),
              },
              existingExchanges:
                observableData.cultural.highExchangeCount +
                observableData.cultural.mediumExchangeCount,
              historicalSuccess: 70, // Default - could track actual success rate
            };

            // Get AI-generated participation decision
            const decision = NPCCulturalParticipation.evaluateParticipation(participationContext);

            return {
              countryId: participant.countryId,
              countryName: participant.countryName,
              flagUrl: participant.flagUrl || "",
              role: participant.role,
              willParticipate: decision.willParticipate,
              enthusiasmLevel: decision.enthusiasmLevel,
              resourceCommitment: decision.resourceCommitment,
              confidence: decision.confidence,
              reasoning: decision.reasoning,
              conditions: decision.conditions,
              responseMessage: decision.responseMessage,
              responseTimeline: decision.responseTimeline,
              alternativeProposal: decision.alternativeProposal,
              personality: {
                archetype: npcPersonality.archetype,
                culturalOpenness: npcPersonality.traits.culturalOpenness,
                cooperativeness: npcPersonality.traits.cooperativeness,
                assertiveness: npcPersonality.traits.assertiveness,
              },
            };
          } catch (error) {
            console.error(`Error generating NPC response for ${participant.countryId}:`, error);
            // Return default response if AI generation fails
            return {
              countryId: participant.countryId,
              countryName: participant.countryName,
              flagUrl: participant.flagUrl || "",
              role: participant.role,
              willParticipate: true,
              enthusiasmLevel: 60,
              resourceCommitment: 50,
              confidence: 50,
              reasoning: ["Default response due to calculation error"],
              responseMessage: `${participant.countryName} is evaluating this cultural exchange opportunity.`,
              responseTimeline: "short_term" as const,
              personality: {
                archetype: "Pragmatic Realist",
                culturalOpenness: 60,
                cooperativeness: 60,
                assertiveness: 50,
              },
            };
          }
        });

        return responses;
      } catch (error) {
        console.error("Error getting NPC cultural responses:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get NPC cultural responses",
          cause: error,
        });
      }
    }),
});
