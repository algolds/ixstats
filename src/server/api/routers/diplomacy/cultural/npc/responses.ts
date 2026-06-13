import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";


import {
  NPCCulturalParticipation,
  type NPCParticipationContext,
} from "~/lib/npc-cultural-participation";
import { NPCPersonalitySystem, type ObservableData } from "~/lib/diplomatic-npc-personality";




// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticCulturalNpcResponsesRouter = createTRPCRouter({
  // Get diplomatic relationships for a country

  // Get recent diplomatic changes

  // Update diplomatic relationship

  // Create a new diplomatic relationship

  // Delete/terminate a diplomatic relationship

  // Embassy Network Operations

  // Diplomatic messaging has been unified into ThinkShare (/messages).
  // Use api.messages.getConversationsByFolder with folder="diplomatic" instead.
  // Use api.messages.sendMessage with conversationType="diplomatic" instead.

  // Cultural Exchanges

  // Link existing cultural exchange to an embassy mission

  // Embassy Game System Endpoints

  // Embassy Management

  // Embassy Upgrades

  // Embassy Missions

  // Embassy Economics

  // Influence and Relationship Management Procedures

  // Follow/Unfollow system for countries

  // Embassy Shared Data System

  // Embassy Profile Management

  /**
   * Get NPC cultural response to exchange invitation
   */
  getNPCCulturalResponse: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        npcCountryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get exchange
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
      });

      if (!exchange) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cultural exchange not found",
        });
      }

      // Get relationship
      const relationship = await ctx.db.diplomaticRelation.findFirst({
        where: {
          OR: [
            { country1: exchange.hostCountryId, country2: input.npcCountryId },
            { country1: input.npcCountryId, country2: exchange.hostCountryId },
          ],
        },
      });

      // Get NPC country
      const npcCountry = await ctx.db.country.findUnique({
        where: { id: input.npcCountryId },
      });

      if (!npcCountry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "NPC country not found",
        });
      }

      // Generate NPC personality based on observables
      const { NPCPersonalitySystem } = await import("~/lib/diplomatic-npc-personality");
      const { NPCCulturalParticipation } = await import("~/lib/npc-cultural-participation");

      const observableData = {
        relationships: relationship
          ? [
              {
                relationship: relationship.status || "neutral",
                strength: relationship.strength || 50,
                tradeVolume: relationship.tradeVolume ?? undefined,
                culturalExchange: undefined,
                treaties: undefined,
              },
            ]
          : [],
        embassies: [],
        treaties: [],
        historicalActions: [],
      };

      const { createObservableDataFromDatabase } = await import("~/lib/diplomatic-npc-personality");

      const personality = NPCPersonalitySystem.calculatePersonality(
        input.npcCountryId,
        npcCountry.name,
        createObservableDataFromDatabase(observableData)
      );

      // Evaluate participation
      const participationContext = {
        npcCountryId: input.npcCountryId,
        npcCountryName: npcCountry.name,
        npcPersonality: personality,
        hostCountryId: exchange.hostCountryId,
        hostCountryName: exchange.hostCountryName,
        relationshipStrength: relationship?.strength || 50,
        relationshipState: relationship?.status || "neutral",
        exchangeType: exchange.type,
        exchangeDetails: {
          title: exchange.title,
          description: exchange.description,
          culturalImpact: exchange.culturalImpact,
          diplomaticValue: exchange.diplomaticValue,
          economicCost: exchange.economicCost,
          duration: Math.ceil(
            (exchange.endDate.getTime() - exchange.startDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
        },
        existingExchanges: 0,
        historicalSuccess: 50,
      };

      const decision = NPCCulturalParticipation.evaluateParticipation(participationContext);

      return decision;
    }),

  // Get cultural compatibility scores for a country with all other countries

  // Get recommended diplomatic partners based on cultural compatibility

  // Update cultural exchange (only title and description)

  // Cancel cultural exchange (with diplomatic penalties)

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

        // Generate NPC responses for each participant
        const responses = await Promise.all(
          participants.map(async (participant) => {
            try {
              // Get relationship data for NPC personality calculation
              const relationships = await ctx.db.diplomaticRelation.findMany({
                where: {
                  OR: [{ country1: participant.countryId }, { country2: participant.countryId }],
                },
              });

              const embassies = await ctx.db.embassy.findMany({
                where: {
                  OR: [
                    { guestCountryId: participant.countryId },
                    { hostCountryId: participant.countryId },
                  ],
                },
              });

              // Build observable data for personality calculation
              const observableData: ObservableData = {
                relationships: {
                  total: relationships.length,
                  allied: relationships.filter(
                    (r: { relationship: string }) => r.relationship === "alliance"
                  ).length,
                  friendly: relationships.filter(
                    (r: { relationship: string }) =>
                      r.relationship === "friendly" || r.relationship === "cooperative"
                  ).length,
                  tense: relationships.filter(
                    (r: { relationship: string }) =>
                      r.relationship === "cool" || r.relationship === "strained"
                  ).length,
                  hostile: relationships.filter(
                    (r: { relationship: string }) => r.relationship === "hostile"
                  ).length,
                  neutral: relationships.filter(
                    (r: { relationship: string }) => r.relationship === "neutral"
                  ).length,
                  averageStrength:
                    relationships.length > 0
                      ? relationships.reduce(
                          (sum: number, r: { strength: number }) => sum + r.strength,
                          0
                        ) / relationships.length
                      : 50,
                  deterioratingCount: 0, // Could track this in future
                },
                embassies: {
                  total: embassies.length,
                  culturalSpecialized: embassies.filter(
                    (e: { specialization: string | null }) => e.specialization === "cultural"
                  ).length,
                  economicSpecialized: embassies.filter(
                    (e: { specialization: string | null }) => e.specialization === "economic"
                  ).length,
                  securitySpecialized: embassies.filter(
                    (e: { specialization: string | null }) => e.specialization === "security"
                  ).length,
                  averageLevel:
                    embassies.length > 0
                      ? embassies.reduce((sum: number, e: { level: number }) => sum + e.level, 0) /
                        embassies.length
                      : 1,
                  averageInfluence:
                    embassies.length > 0
                      ? embassies.reduce(
                          (sum: number, e: { influence: number }) => sum + e.influence,
                          0
                        ) / embassies.length
                      : 50,
                },
                treaties: {
                  total: 0, // Would need treaty data
                  multilateral: 0,
                  defensive: 0,
                  trade: 0,
                  cultural: 0,
                },
                economic: {
                  totalTradeVolume: 0, // Would need trade data
                  highValuePartners: 0,
                  tradeTreatyCount: 0,
                  tradeGrowthTrend: 0,
                },
                cultural: {
                  highExchangeCount: relationships.filter(
                    (r: { culturalExchange: string | null }) => r.culturalExchange === "High"
                  ).length,
                  mediumExchangeCount: relationships.filter(
                    (r: { culturalExchange: string | null }) => r.culturalExchange === "Medium"
                  ).length,
                  culturalTreatyCount: 0,
                  totalExchangePrograms: 0, // Could calculate from cultural exchange data
                },
                historical: {
                  totalActions: Math.max(1, relationships.length + embassies.length),
                  cooperativeActions: relationships.filter(
                    (r: { relationship: string }) =>
                      r.relationship === "alliance" || r.relationship === "friendly"
                  ).length,
                  aggressiveActions: relationships.filter(
                    (r: { relationship: string }) =>
                      r.relationship === "hostile" || r.relationship === "strained"
                  ).length,
                  consistencyScore: 70, // Default moderate consistency
                  policyVolatility: 30, // Default moderate volatility
                },
              };

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
                    (new Date(exchange.endDate).getTime() -
                      new Date(exchange.startDate).getTime()) /
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
          })
        );

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

  // ============================================================
  // Foreign Policy Actions (Phase 2)
  // ============================================================

  // Get active foreign policies for a country (as initiator or target)

  // Get bilateral trade data between two countries

  // Preview the economic impact of a foreign policy action before confirming

  // Propose / enact a foreign policy action

  // Lift / end an active foreign policy action

  // ============================================================
  // Alliance / Bloc System (Phase 3)
  // ============================================================

  // Get alliances a country belongs to

  // Get a single alliance dashboard

  // Create a new alliance

  // Invite a country to join an alliance

  // Leave an alliance

  // Propose an alliance action (collective sanction, shared defense, etc.)

  // Vote on an alliance action

  // Create an alliance document

  // Get documents for an alliance

  // Get active embassy missions for a country
});

// Helper function to determine category from option value
// Helper functions for embassy game mechanics
// Influence and Relationship Mechanics
