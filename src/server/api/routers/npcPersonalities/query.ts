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

// eslint-disable-next-line unused-imports/no-unused-vars
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

  /**
   * Get personality by ID with full details
   */
  getPersonalityById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const personality = await ctx.db.nPCPersonality.findUnique({
        where: { id: input.id },
        include: { npcAssignments: true },
      });

      if (!personality) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Personality not found" });
      }

      return parsePersonalityJSON(personality);
    }),

  /**
   * Get personality by archetype type
   */
  getPersonalityByArchetype: publicProcedure
    .input(z.object({ archetype: archetypeEnum }))
    .query(async ({ ctx, input }) => {
      const personality = await ctx.db.nPCPersonality.findFirst({
        where: { archetype: input.archetype, isActive: true },
      });

      if (!personality) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Personality archetype not found" });
      }

      return parsePersonalityJSON(personality);
    }),

  /**
   * Get assigned personality for a country
   */
  getCountryPersonality: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const assignment = await ctx.db.nPCPersonalityAssignment.findUnique({
        where: { countryId: input.countryId },
        include: { personality: true },
      });

      if (!assignment) {
        return null;
      }

      return {
        ...parsePersonalityJSON(assignment.personality),
        assignedAt: assignment.assignedAt,
        driftHistory: assignment.driftHistory ? JSON.parse(assignment.driftHistory) : [],
      };
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
// eslint-disable-next-line unused-imports/no-unused-vars
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
// eslint-disable-next-line unused-imports/no-unused-vars
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
    // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (error) {
    // Silently fail if AdminAuditLog doesn't exist
    console.warn("Admin audit logging skipped (model may not exist)");
  }
}
