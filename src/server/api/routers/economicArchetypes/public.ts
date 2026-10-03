// src/server/api/routers/economicArchetypes.ts
// Economic Archetypes API Router - Phase 3 Migration
// The EconomicArchetype table is the source of truth for the archetypes players pick in the
// builder. The built-in archetypes seed an empty table on first read and are the fallback
// when the table can't be read.

import { z } from "zod";
import { createTRPCRouter, publicProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { EconomicArchetype as PrismaArchetype, PrismaClient } from "@prisma/client";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
import type { EconomicComponentType } from "~/lib/economy/atomic-data";
import type { ComponentType } from "@prisma/client";
import { memoryConfig } from "~/lib/system/dev-memory-config";
import {
  buildArchetypeSeedRows,
  builtinArchetypes,
  type ArchetypeEra,
} from "~/lib/economy/archetypes/seed";

/** An archetype as the API serves it: `id` is the row id, `key` the stable archetype id. */
type CatalogArchetype = EconomicArchetype & {
  key: string;
  era: ArchetypeEra;
  isActive: boolean;
  isCustom: boolean;
  usageCount: number;
};

/**
 * Parse JSON string fields back to objects
 * Transforms database representation to TypeScript interface
 */
function parseArchetypeJSON(archetype: PrismaArchetype): CatalogArchetype {
  try {
    return {
      id: archetype.id,
      key: archetype.key,
      era: archetype.era === "historical" ? "historical" : "modern",
      isActive: archetype.isActive,
      isCustom: archetype.isCustom,
      usageCount: archetype.usageCount,
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
      implementationComplexity: archetype.implementationComplexity.toLowerCase() as
        "low" | "medium" | "high",
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
 * Used when the database can't be read
 */
function getFallbackArchetypes(era: "modern" | "historical" | "all"): CatalogArchetype[] {
  console.warn("[economicArchetypes] Database unavailable, using built-in archetypes");

  return builtinArchetypes()
    .filter((archetype) => era === "all" || archetype.era === era)
    .map((archetype) => ({
      ...archetype,
      key: archetype.id,
      isActive: true,
      isCustom: false,
      usageCount: 0,
    }));
}

/**
 * Seed an empty table from the built-in archetypes. `db:seed` doesn't run in production, so
 * this is what first fills the table there.
 */
async function ensureSeeded(db: PrismaClient) {
  if ((await db.economicArchetype.count()) > 0) return;
  const rows = buildArchetypeSeedRows();
  await db.economicArchetype.createMany({ data: rows, skipDuplicates: true });
  console.info(`[economicArchetypes] Seeded empty table with ${rows.length} built-in archetypes`);
}

export const economicArchetypesPublicRouter = createTRPCRouter({
  // ============================================================================
  // PUBLIC ENDPOINTS
  // ============================================================================

  /**
   * Get all archetypes with optional filters
   * Seeds an empty table from the built-in archetypes; falls back to them if the table
   * can't be read
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
        await ensureSeeded(ctx.db);

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
   * Increment archetype usage count
   * Called when user selects an archetype; accepts the row id or the archetype key
   */
  incrementArchetypeUsage: rateLimitedPublicProcedure
    .input(z.object({ archetypeId: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { count } = await ctx.db.economicArchetype.updateMany({
          where: { OR: [{ id: input.archetypeId }, { key: input.archetypeId }] },
          data: { usageCount: { increment: 1 } },
        });
        return { count };
      } catch (error) {
        console.error("Error incrementing archetype usage:", error);
        // Don't throw error for usage tracking failures
        return null;
      }
    }),
});
