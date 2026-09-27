/**
 * NPC Personalities tRPC Router
 *
 * Provides endpoints for querying and managing NPC personality archetypes,
 * assigning personalities to countries, and predicting behavioral responses.
 *
 * Public Endpoints (7):
 * - getAllPersonalities - Query all personalities with filters
 * - getPersonalityById - Get single personality with full details
 * - getPersonalityByArchetype - Get personality by archetype type
 * - getCountryPersonality - Get assigned personality for a country
 * - predictScenarioResponse - Predict NPC response to diplomatic scenario
 * - getToneForContext - Get appropriate diplomatic tone
 * - incrementUsage - Track personality usage
 *
 * Admin Endpoints (6):
 * - createPersonality - Create new personality (with audit logging)
 * - updatePersonality - Update personality (with audit logging)
 * - deletePersonality - Soft delete personality (with audit logging)
 * - assignPersonalityToCountry - Assign personality to country
 * - getPersonalityStats - Usage analytics
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// ==================== VALIDATION SCHEMAS ====================

const archetypeEnum = z.enum([
  "aggressive_expansionist",
  "peaceful_merchant",
  "cautious_isolationist",
  "cultural_diplomat",
  "pragmatic_realist",
  "ideological_hardliner",
]);

// ==================== TRPC ROUTER ====================

export const npcPersonalitiesQueryRouter = createTRPCRouter({
  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Get all NPC personalities with optional filters
   */
  getAllPersonalities: publicProcedure
    .input(
      z.object({
        archetype: archetypeEnum.optional(),
        isActive: z.boolean().optional(),
        orderBy: z.enum(["usageCount", "name", "archetype"]).default("usageCount"),
      })
    )
    .query(async ({ ctx, input }) => {
      const personalities = await ctx.db.nPCPersonality.findMany({
        where: {
          ...(input.archetype && { archetype: input.archetype }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        orderBy:
          input.orderBy === "usageCount" ? { usageCount: "desc" } : { [input.orderBy]: "asc" },
      });

      // Fallback to hardcoded if database empty
      if (personalities.length === 0) {
        return getFallbackPersonalities();
      }

      return personalities.map(parsePersonalityJSON);
    }),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse JSON fields from database personality record
 */
function parsePersonalityJSON(personality: any) {
  return {
    ...personality,
    traitDescriptions: personality.traitDescriptions
      ? JSON.parse(personality.traitDescriptions)
      : {},
    culturalProfile: personality.culturalProfile ? JSON.parse(personality.culturalProfile) : null,
    toneMatrix: personality.toneMatrix ? JSON.parse(personality.toneMatrix) : {},
    responsePatterns: personality.responsePatterns ? JSON.parse(personality.responsePatterns) : [],
    scenarioResponses: personality.scenarioResponses
      ? JSON.parse(personality.scenarioResponses)
      : {},
    eventModifiers: personality.eventModifiers ? JSON.parse(personality.eventModifiers) : {},
  };
}

/**
 * Fallback to hardcoded personalities if database empty
 */
function getFallbackPersonalities() {
  // In production, this would return hardcoded data
  // For now, return empty array to encourage database population
  return [];
}
