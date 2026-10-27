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
import { archetypeEnum, parsePersonalityJSON } from "./shared";

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

      return personalities.map(parsePersonalityJSON);
    }),
});
