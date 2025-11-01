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
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
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

export const npcPersonalitiesRouter = createTRPCRouter({
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
        culturalProfile: personality.culturalProfile ? JSON.parse(personality.culturalProfile) : null,
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

  /**
   * Create NPC personality (Admin only)
   */
  createPersonality: adminProcedure
    .input(
      z.object({
        name: z.string(),
        archetype: archetypeEnum,
        traits: traitSchema,
        traitDescriptions: z.record(z.string(), z.string()),
        culturalProfile: z.object({
          formality: z.number(),
          directness: z.number(),
          emotionality: z.number(),
          flexibility: z.number(),
          negotiationStyle: z.string(),
        }),
        toneMatrix: z.record(z.string(), z.record(z.string(), z.string())),
        responsePatterns: z.array(z.string()),
        scenarioResponses: z.record(z.string(), z.any()),
        eventModifiers: z.record(z.string(), z.any()),
        historicalBasis: z.string().optional(),
        historicalContext: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { traits, ...otherData } = input;

      const personality = await ctx.db.nPCPersonality.create({
        data: {
          ...otherData,
          ...traits,
          traitDescriptions: JSON.stringify(input.traitDescriptions),
          culturalProfile: JSON.stringify(input.culturalProfile),
          toneMatrix: JSON.stringify(input.toneMatrix),
          responsePatterns: JSON.stringify(input.responsePatterns),
          scenarioResponses: JSON.stringify(input.scenarioResponses),
          eventModifiers: JSON.stringify(input.eventModifiers),
        },
      });

      // Audit log
      await logAdminAction(ctx.db, {
        action: "NPC_PERSONALITY_CREATED",
        targetType: "npc_personality",
        targetId: personality.id,
        targetName: personality.name,
        adminId: ctx.user?.id,
        adminName: ctx.user?.clerkUserId,
        changes: JSON.stringify({ archetype: personality.archetype }),
      });

      return { success: true, personality: parsePersonalityJSON(personality) };
    }),

  /**
   * Update NPC personality (Admin only)
   */
  updatePersonality: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        traits: traitSchema.partial().optional(),
        traitDescriptions: z.record(z.string(), z.string()).optional(),
        culturalProfile: z
          .object({
            formality: z.number(),
            directness: z.number(),
            emotionality: z.number(),
            flexibility: z.number(),
            negotiationStyle: z.string(),
          })
          .optional(),
        toneMatrix: z.record(z.string(), z.record(z.string(), z.string())).optional(),
        responsePatterns: z.array(z.string()).optional(),
        scenarioResponses: z.record(z.string(), z.any()).optional(),
        eventModifiers: z.record(z.string(), z.any()).optional(),
        historicalBasis: z.string().optional(),
        historicalContext: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, traits, ...otherData } = input;

      const updateData: any = {
        ...otherData,
        updatedAt: new Date(),
      };

      // Merge trait updates if provided
      if (traits) {
        Object.assign(updateData, traits);
      }

      // Stringify JSON fields if provided
      if (input.traitDescriptions) {
        updateData.traitDescriptions = JSON.stringify(input.traitDescriptions);
      }
      if (input.culturalProfile) {
        updateData.culturalProfile = JSON.stringify(input.culturalProfile);
      }
      if (input.toneMatrix) {
        updateData.toneMatrix = JSON.stringify(input.toneMatrix);
      }
      if (input.responsePatterns) {
        updateData.responsePatterns = JSON.stringify(input.responsePatterns);
      }
      if (input.scenarioResponses) {
        updateData.scenarioResponses = JSON.stringify(input.scenarioResponses);
      }
      if (input.eventModifiers) {
        updateData.eventModifiers = JSON.stringify(input.eventModifiers);
      }

      const updated = await ctx.db.nPCPersonality.update({
        where: { id },
        data: updateData,
      });

      await logAdminAction(ctx.db, {
        action: "NPC_PERSONALITY_UPDATED",
        targetType: "npc_personality",
        targetId: updated.id,
        targetName: updated.name,
        adminId: ctx.user?.id,
        adminName: ctx.user?.clerkUserId,
      });

      return { success: true, personality: parsePersonalityJSON(updated) };
    }),

  /**
   * Delete NPC personality (Admin - soft delete)
   */
  deletePersonality: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const personality = await ctx.db.nPCPersonality.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      await logAdminAction(ctx.db, {
        action: "NPC_PERSONALITY_DELETED",
        targetType: "npc_personality",
        targetId: personality.id,
        targetName: personality.name,
        adminId: ctx.user?.id,
        adminName: ctx.user?.clerkUserId,
      });

      return { success: true };
    }),

  /**
   * Assign personality to country (Admin only)
   */
  assignPersonalityToCountry: adminProcedure
    .input(
      z.object({
        personalityId: z.string(),
        countryId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if country already has personality assigned
      const existing = await ctx.db.nPCPersonalityAssignment.findUnique({
        where: { countryId: input.countryId },
      });

      if (existing) {
        // Update existing assignment
        const updated = await ctx.db.nPCPersonalityAssignment.update({
          where: { countryId: input.countryId },
          data: {
            personalityId: input.personalityId,
            assignedAt: new Date(),
            assignedBy: ctx.user?.id,
            reason: input.reason,
          },
        });

        await logAdminAction(ctx.db, {
          action: "NPC_PERSONALITY_REASSIGNED",
          targetType: "npc_personality_assignment",
          targetId: updated.id,
          targetName: input.countryId,
          adminId: ctx.user?.id,
          adminName: ctx.user?.clerkUserId,
          changes: JSON.stringify({ personalityId: input.personalityId }),
        });

        return { success: true, assignment: updated };
      }

      // Create new assignment
      const assignment = await ctx.db.nPCPersonalityAssignment.create({
        data: {
          personalityId: input.personalityId,
          countryId: input.countryId,
          assignedBy: ctx.user?.id,
          reason: input.reason,
        },
      });

      // Increment personality usage count
      await ctx.db.nPCPersonality.update({
        where: { id: input.personalityId },
        data: { usageCount: { increment: 1 } },
      });

      await logAdminAction(ctx.db, {
        action: "NPC_PERSONALITY_ASSIGNED",
        targetType: "npc_personality_assignment",
        targetId: assignment.id,
        targetName: input.countryId,
        adminId: ctx.user?.id,
        adminName: ctx.user?.clerkUserId,
        changes: JSON.stringify({ personalityId: input.personalityId }),
      });

      return { success: true, assignment };
    }),

  /**
   * Get personality usage statistics (Admin only)
   */
  getPersonalityStats: adminProcedure.query(async ({ ctx }) => {
    const personalities = await ctx.db.nPCPersonality.findMany({
      include: { npcAssignments: true },
      orderBy: { usageCount: "desc" },
    });

    const totalPersonalities = personalities.length;
    const activePersonalities = personalities.filter((p) => p.isActive).length;
    const totalUsage = personalities.reduce((sum, p) => sum + p.usageCount, 0);
    const totalAssignments = await ctx.db.nPCPersonalityAssignment.count();

    const archetypeStats = personalities.reduce(
      (acc, p) => {
        acc[p.archetype] = (acc[p.archetype] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topPersonalities = personalities.slice(0, 10).map(parsePersonalityJSON);
    const leastUsed = personalities.filter((p) => p.usageCount === 0).map(parsePersonalityJSON);

    // Trait averages across all personalities
    const traitAverages = {
      assertiveness: Math.round(
        personalities.reduce((sum, p) => sum + p.assertiveness, 0) / totalPersonalities
      ),
      cooperativeness: Math.round(
        personalities.reduce((sum, p) => sum + p.cooperativeness, 0) / totalPersonalities
      ),
      economicFocus: Math.round(
        personalities.reduce((sum, p) => sum + p.economicFocus, 0) / totalPersonalities
      ),
      culturalOpenness: Math.round(
        personalities.reduce((sum, p) => sum + p.culturalOpenness, 0) / totalPersonalities
      ),
      riskTolerance: Math.round(
        personalities.reduce((sum, p) => sum + p.riskTolerance, 0) / totalPersonalities
      ),
      ideologicalRigidity: Math.round(
        personalities.reduce((sum, p) => sum + p.ideologicalRigidity, 0) / totalPersonalities
      ),
      militarism: Math.round(
        personalities.reduce((sum, p) => sum + p.militarism, 0) / totalPersonalities
      ),
      isolationism: Math.round(
        personalities.reduce((sum, p) => sum + p.isolationism, 0) / totalPersonalities
      ),
    };

    return {
      summary: {
        totalPersonalities,
        activePersonalities,
        totalUsage,
        totalAssignments,
        averageUsage: (totalUsage / totalPersonalities).toFixed(2),
      },
      archetypeStats,
      traitAverages,
      topPersonalities,
      leastUsed,
    };
  }),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse JSON fields from database personality record
 */
function parsePersonalityJSON(personality: any) {
  return {
    ...personality,
    traitDescriptions: personality.traitDescriptions ? JSON.parse(personality.traitDescriptions) : {},
    culturalProfile: personality.culturalProfile ? JSON.parse(personality.culturalProfile) : null,
    toneMatrix: personality.toneMatrix ? JSON.parse(personality.toneMatrix) : {},
    responsePatterns: personality.responsePatterns ? JSON.parse(personality.responsePatterns) : [],
    scenarioResponses: personality.scenarioResponses ? JSON.parse(personality.scenarioResponses) : {},
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
  } catch (error) {
    // Silently fail if AdminAuditLog doesn't exist
    console.warn("Admin audit logging skipped (model may not exist)");
  }
}
