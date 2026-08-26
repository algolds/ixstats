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
import { TRPCError } from "@trpc/server";

// ==================== VALIDATION SCHEMAS ====================

const traitSchema = z.object({
  assertiveness: z.number().min(0).max(100),
  cooperativeness: z.number().min(0).max(100),
  economicFocus: z.number().min(0).max(100),
  culturalOpenness: z.number().min(0).max(100),
  riskTolerance: z.number().min(0).max(100),
  ideologicalRigidity: z.number().min(0).max(100),
  militarism: z.number().min(0).max(100),
  isolationism: z.number().min(0).max(100),
});

const archetypeEnum = z.enum([
  "aggressive_expansionist",
  "peaceful_merchant",
  "cautious_isolationist",
  "cultural_diplomat",
  "pragmatic_realist",
  "ideological_hardliner",
]);

// ==================== TRPC ROUTER ====================

export const npcPersonalitiesDiplomacyRouter = createTRPCRouter({
  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Predict response to diplomatic scenario
   */
  predictScenarioResponse: publicProcedure
    .input(
      z.object({
        personalityId: z.string(),
        scenario: z.string(),
        contextFactors: z.object({
          currentRelationship: z.string(),
          relationshipStrength: z.number(),
          recentActions: z.array(z.string()).optional(),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      const personality = await ctx.db.nPCPersonality.findUnique({
        where: { id: input.personalityId },
      });

      if (!personality) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Personality not found" });
      }

      const scenarioResponses = JSON.parse(personality.scenarioResponses);
      const response = scenarioResponses[input.scenario];

      if (!response) {
        // Generate generic response based on traits
        return generateGenericResponse(personality, input.scenario, input.contextFactors);
      }

      return response;
    }),

  /**
   * Get appropriate tone for diplomatic context
   */
  getToneForContext: publicProcedure
    .input(
      z.object({
        personalityId: z.string(),
        relationshipLevel: z.string(),
        formality: z.enum(["formal", "casual"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const personality = await ctx.db.nPCPersonality.findUnique({
        where: { id: input.personalityId },
      });

      if (!personality) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Personality not found" });
      }

      const toneMatrix = JSON.parse(personality.toneMatrix);
      const tone = toneMatrix[input.relationshipLevel]?.[input.formality];

      return {
        tone: tone || "Professional and measured",
        culturalProfile: personality.culturalProfile
          ? JSON.parse(personality.culturalProfile)
          : null,
      };
    }),

  /**
   * Increment personality usage count
   */
  incrementUsage: publicProcedure
    .input(z.object({ personalityId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.nPCPersonality.update({
        where: { id: input.personalityId },
        data: { usageCount: { increment: 1 } },
      });
    }),

  // ==================== ADMIN ENDPOINTS ====================
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

/**
 * Generate generic response based on personality traits
 */
function generateGenericResponse(personality: any, scenario: string, context: any) {
  // Use personality traits to generate a generic response
  const cooperationScore = (personality.cooperativeness + context.relationshipStrength) / 2;

  return {
    action: cooperationScore > 50 ? "negotiate" : "defer",
    confidence: 50,
    reasoning: ["Generic scenario uses cooperation baseline"],
  };
}

/**
 * Log admin action to database audit log
 */
async function logAdminAction(
  db: any,
  data: {
    action: string;
    targetType: string;
    targetId: string;
    targetName: string;
    adminId?: string;
    adminName?: string;
    changes?: string;
  }
) {
  // Check if AdminAuditLog model exists, otherwise skip logging
  try {
    await db.adminAuditLog.create({
      data: {
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        targetName: data.targetName,
        adminId: data.adminId || "system",
        adminName: data.adminName || "System",
        changes: data.changes || "",
        ipAddress: "",
      },
    });
  } catch  {
    // Silently fail if AdminAuditLog doesn't exist
    console.warn("Admin audit logging skipped (model may not exist)");
  }
}
