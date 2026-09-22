// src/server/api/routers/economicArchetypes.ts
// Economic Archetypes API Router - Phase 3 Migration
// Provides CRUD operations and analytics for economic archetype system

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { EconomicArchetype as PrismaArchetype } from "@prisma/client";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
import type { EconomicComponentType } from "~/lib/economy/atomic-data";
import type { ComponentType } from "@prisma/client";
import { memoryConfig } from "~/lib/system/dev-memory-config";

// Import hardcoded fallback data
import { modernArchetypes } from "~/lib/economy/archetypes/modern";
import { historicalArchetypes } from "~/lib/economy/archetypes/historical";

/**
 * Parse JSON string fields back to objects
 * Transforms database representation to TypeScript interface
 */
function parseArchetypeJSON(archetype: PrismaArchetype): EconomicArchetype {
  try {
    return {
      id: archetype.id,
      name: archetype.name,
      description: archetype.description,
      region: archetype.region,
      characteristics: JSON.parse(archetype.characteristics) as string[],
      economicComponents: JSON.parse(archetype.economicComponents) as EconomicComponentType[],
      governmentComponents: JSON.parse(archetype.governmentComponents) as ComponentType[],
      taxProfile: JSON.parse(archetype.taxProfile) as {
        corporateRate: number;
        incomeRate: number;
        consumptionRate: number;
        revenueEfficiency: number;
      },
      sectorFocus: JSON.parse(archetype.sectorFocus) as Record<string, number>,
      employmentProfile: JSON.parse(archetype.employmentProfile) as {
        unemploymentRate: number;
        laborParticipation: number;
        wageGrowth: number;
      },
      growthMetrics: JSON.parse(archetype.growthMetrics) as {
        gdpGrowth: number;
        innovationIndex: number;
        competitiveness: number;
        stability: number;
      },
      strengths: JSON.parse(archetype.strengths) as string[],
      challenges: JSON.parse(archetype.challenges) as string[],
      implementationComplexity: archetype.implementationComplexity as "low" | "medium" | "high",
      culturalFactors: JSON.parse(archetype.culturalFactors) as string[],
      historicalContext: archetype.historicalContext,
      modernExamples: JSON.parse(archetype.modernExamples) as string[],
      recommendations: JSON.parse(archetype.recommendations) as string[],
    };
  } catch (error) {
    console.error("Failed to parse archetype JSON:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to parse archetype data",
    });
  }
}

/**
 * Get fallback archetypes from hardcoded data
 * Used when database is empty for graceful degradation
 */
function getFallbackArchetypes(era: "modern" | "historical" | "all"): EconomicArchetype[] {
  console.warn("[economicArchetypes.ts] Database empty, using fallback hardcoded archetypes");

  const modern = Array.from(modernArchetypes.values());
  const historical = Array.from(historicalArchetypes.values());

  if (era === "modern") return modern;
  if (era === "historical") return historical;
  return [...modern, ...historical];
}

export const economicArchetypesPublicRouter = createTRPCRouter({
  // ============================================================================
  // PUBLIC ENDPOINTS
  // ============================================================================

  /**
   * Get all archetypes with optional filters
   * Falls back to hardcoded data if database is empty
   * Memory optimization: Added pagination with default limits
   */
  getAllArchetypes: publicProcedure
    .input(
      z.object({
        era: z.enum(["modern", "historical", "all"]).default("all"),
        region: z.string().optional(),
        complexity: z.string().optional(),
        isActive: z.boolean().optional(),
        // Pagination for memory optimization
        limit: z.number().min(1).max(200).default(memoryConfig.query.defaultLimit),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where = {
          ...(input.era !== "all" && { era: input.era }),
          ...(input.region && { region: input.region }),
          ...(input.complexity && { implementationComplexity: input.complexity }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        };

        const [archetypes, totalCount] = await Promise.all([
          ctx.db.economicArchetype.findMany({
            where,
            orderBy: [{ era: "asc" }, { usageCount: "desc" }],
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.economicArchetype.count({ where }),
        ]);

        // Fallback to hardcoded if database empty
        if (archetypes.length === 0 && input.offset === 0) {
          const fallback = getFallbackArchetypes(input.era);
          return {
            archetypes: fallback.slice(0, input.limit),
            pagination: {
              total: fallback.length,
              limit: input.limit,
              offset: 0,
              hasMore: fallback.length > input.limit,
            },
          };
        }

        // Parse JSON fields back to objects
        return {
          archetypes: archetypes.map(parseArchetypeJSON),
          pagination: {
            total: totalCount,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + archetypes.length < totalCount,
          },
        };
      } catch (error) {
        console.error("Error fetching archetypes:", error);
        // Fallback on error
        const fallback = getFallbackArchetypes(input.era);
        return {
          archetypes: fallback.slice(0, input.limit),
          pagination: {
            total: fallback.length,
            limit: input.limit,
            offset: 0,
            hasMore: fallback.length > input.limit,
          },
        };
      }
    }),

  /**
   * Get single archetype by ID
   */
  getArchetypeById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const archetype = await ctx.db.economicArchetype.findUnique({
        where: { id: input.id },
      });

      if (!archetype) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Archetype not found",
        });
      }

      return parseArchetypeJSON(archetype);
    }),

  /**
   * Get archetypes grouped by category (modern/historical)
   */
  getArchetypesByCategory: publicProcedure.query(async ({ ctx }) => {
    try {
      const archetypes = await ctx.db.economicArchetype.findMany({
        where: { isActive: true },
        orderBy: { usageCount: "desc" },
      });

      // If database empty, use fallback
      if (archetypes.length === 0) {
        return {
          modern: Array.from(modernArchetypes.values()),
          historical: Array.from(historicalArchetypes.values()),
        };
      }

      return {
        modern: archetypes.filter((a) => a.era === "modern").map(parseArchetypeJSON),
        historical: archetypes.filter((a) => a.era === "historical").map(parseArchetypeJSON),
      };
    } catch (error) {
      console.error("Error fetching archetypes by category:", error);
      // Fallback on error
      return {
        modern: Array.from(modernArchetypes.values()),
        historical: Array.from(historicalArchetypes.values()),
      };
    }
  }),

  /**
   * Increment archetype usage count
   * Called when user selects an archetype
   */
  incrementArchetypeUsage: publicProcedure
    .input(z.object({ archetypeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.economicArchetype.update({
          where: { id: input.archetypeId },
          data: { usageCount: { increment: 1 } },
        });
      } catch (error) {
        console.error("Error incrementing archetype usage:", error);
        // Don't throw error for usage tracking failures
        return null;
      }
    }),

  // ============================================================================
  // ADMIN ENDPOINTS
  // ============================================================================
});
