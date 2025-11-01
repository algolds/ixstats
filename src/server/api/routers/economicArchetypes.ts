// src/server/api/routers/economicArchetypes.ts
// Economic Archetypes API Router - Phase 3 Migration
// Provides CRUD operations and analytics for economic archetype system

import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { EconomicArchetype as PrismaArchetype } from "@prisma/client";

// Import hardcoded fallback data
import { modernArchetypes } from "~/app/builder/data/archetypes/modern";
import { historicalArchetypes } from "~/app/builder/data/archetypes/historical";

/**
 * Parse JSON string fields back to objects
 * Transforms database representation to TypeScript interface
 */
function parseArchetypeJSON(archetype: PrismaArchetype) {
  try {
    return {
      ...archetype,
      characteristics: JSON.parse(archetype.characteristics) as string[],
      economicComponents: JSON.parse(archetype.economicComponents) as string[],
      governmentComponents: JSON.parse(archetype.governmentComponents) as string[],
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
      culturalFactors: JSON.parse(archetype.culturalFactors) as string[],
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
function getFallbackArchetypes(era: "modern" | "historical" | "all") {
  console.warn("[economicArchetypes.ts] Database empty, using fallback hardcoded archetypes");

  const modern = Array.from(modernArchetypes.values());
  const historical = Array.from(historicalArchetypes.values());

  if (era === "modern") return modern;
  if (era === "historical") return historical;
  return [...modern, ...historical];
}

/**
 * Zod schema for archetype creation/update
 * Validates input data structure
 */
const archetypeInputSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  region: z.string().min(1),
  era: z.enum(["modern", "historical"]),
  characteristics: z.array(z.string()),
  economicComponents: z.array(z.string()),
  governmentComponents: z.array(z.string()),
  taxProfile: z.object({
    corporateRate: z.number().min(0).max(100),
    incomeRate: z.number().min(0).max(100),
    consumptionRate: z.number().min(0).max(100),
    revenueEfficiency: z.number().min(0).max(1),
  }),
  sectorFocus: z.record(z.string(), z.number()),
  employmentProfile: z.object({
    unemploymentRate: z.number().min(0).max(100),
    laborParticipation: z.number().min(0).max(100),
    wageGrowth: z.number(),
  }),
  growthMetrics: z.object({
    gdpGrowth: z.number(),
    innovationIndex: z.number().min(0).max(100),
    competitiveness: z.number().min(0).max(100),
    stability: z.number().min(0).max(100),
  }),
  strengths: z.array(z.string()),
  challenges: z.array(z.string()),
  culturalFactors: z.array(z.string()),
  modernExamples: z.array(z.string()),
  recommendations: z.array(z.string()),
  implementationComplexity: z.enum(["Low", "Medium", "High"]),
  historicalContext: z.string(),
});

export const economicArchetypesRouter = createTRPCRouter({
  // ============================================================================
  // PUBLIC ENDPOINTS
  // ============================================================================

  /**
   * Get all archetypes with optional filters
   * Falls back to hardcoded data if database is empty
   */
  getAllArchetypes: publicProcedure
    .input(
      z.object({
        era: z.enum(["modern", "historical", "all"]).default("all"),
        region: z.string().optional(),
        complexity: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const archetypes = await ctx.db.economicArchetype.findMany({
          where: {
            ...(input.era !== "all" && { era: input.era }),
            ...(input.region && { region: input.region }),
            ...(input.complexity && { implementationComplexity: input.complexity }),
            ...(input.isActive !== undefined && { isActive: input.isActive }),
          },
          orderBy: [{ era: "asc" }, { usageCount: "desc" }],
        });

        // Fallback to hardcoded if database empty
        if (archetypes.length === 0) {
          return getFallbackArchetypes(input.era);
        }

        // Parse JSON fields back to objects
        return archetypes.map(parseArchetypeJSON);
      } catch (error) {
        console.error("Error fetching archetypes:", error);
        // Fallback on error
        return getFallbackArchetypes(input.era);
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
        const fallback = getFallbackArchetypes("all");
        return {
          modern: fallback.filter((a) => (a as any).era === "modern"),
          historical: fallback.filter((a) => (a as any).era === "historical"),
        };
      }

      return {
        modern: archetypes.filter((a) => a.era === "modern").map(parseArchetypeJSON),
        historical: archetypes.filter((a) => a.era === "historical").map(parseArchetypeJSON),
      };
    } catch (error) {
      console.error("Error fetching archetypes by category:", error);
      // Fallback on error
      const fallback = getFallbackArchetypes("all");
      return {
        modern: fallback.filter((a) => (a as any).era === "modern"),
        historical: fallback.filter((a) => (a as any).era === "historical"),
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

  /**
   * Create new archetype (admin only)
   */
  createArchetype: adminProcedure.input(archetypeInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const archetype = await ctx.db.economicArchetype.create({
        data: {
          key: input.key,
          name: input.name,
          description: input.description,
          region: input.region,
          era: input.era,
          characteristics: JSON.stringify(input.characteristics),
          economicComponents: JSON.stringify(input.economicComponents),
          governmentComponents: JSON.stringify(input.governmentComponents),
          taxProfile: JSON.stringify(input.taxProfile),
          sectorFocus: JSON.stringify(input.sectorFocus),
          employmentProfile: JSON.stringify(input.employmentProfile),
          growthMetrics: JSON.stringify(input.growthMetrics),
          strengths: JSON.stringify(input.strengths),
          challenges: JSON.stringify(input.challenges),
          culturalFactors: JSON.stringify(input.culturalFactors),
          modernExamples: JSON.stringify(input.modernExamples),
          recommendations: JSON.stringify(input.recommendations),
          implementationComplexity: input.implementationComplexity,
          historicalContext: input.historicalContext,
          isCustom: true,
          createdBy: ctx.auth?.userId || "system",
        },
      });

      // Audit log
      const ipAddress =
        ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        ctx.headers.get("x-real-ip") ||
        "unknown";

      await ctx.db.adminAuditLog.create({
        data: {
          action: "ARCHETYPE_CREATED",
          targetType: "economic_archetype",
          targetId: archetype.id,
          targetName: archetype.name,
          adminId: ctx.user?.id || "system",
          adminName: ctx.user?.id || "system",
          ipAddress: ipAddress || "",
          changes: JSON.stringify({
            era: archetype.era,
            region: archetype.region,
            key: archetype.key,
          }),
        },
      });

      return { success: true, archetype: parseArchetypeJSON(archetype) };
    } catch (error) {
      console.error("Error creating archetype:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create archetype",
      });
    }
  }),

  /**
   * Update existing archetype (admin only)
   */
  updateArchetype: adminProcedure
    .input(
      z.object({
        id: z.string(),
        ...archetypeInputSchema.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      try {
        const updated = await ctx.db.economicArchetype.update({
          where: { id },
          data: {
            key: data.key,
            name: data.name,
            description: data.description,
            region: data.region,
            era: data.era,
            characteristics: JSON.stringify(data.characteristics),
            economicComponents: JSON.stringify(data.economicComponents),
            governmentComponents: JSON.stringify(data.governmentComponents),
            taxProfile: JSON.stringify(data.taxProfile),
            sectorFocus: JSON.stringify(data.sectorFocus),
            employmentProfile: JSON.stringify(data.employmentProfile),
            growthMetrics: JSON.stringify(data.growthMetrics),
            strengths: JSON.stringify(data.strengths),
            challenges: JSON.stringify(data.challenges),
            culturalFactors: JSON.stringify(data.culturalFactors),
            modernExamples: JSON.stringify(data.modernExamples),
            recommendations: JSON.stringify(data.recommendations),
            implementationComplexity: data.implementationComplexity,
            historicalContext: data.historicalContext,
            updatedAt: new Date(),
          },
        });

        // Audit log
        const ipAddress =
          ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          ctx.headers.get("x-real-ip") ||
          "unknown";

        await ctx.db.adminAuditLog.create({
          data: {
            action: "ARCHETYPE_UPDATED",
            targetType: "economic_archetype",
            targetId: updated.id,
            targetName: updated.name,
            adminId: ctx.auth?.userId || "system",
            adminName: ctx.auth?.userId || "system",
            ipAddress: ipAddress || "",
            changes: JSON.stringify({
              era: updated.era,
              region: updated.region,
              key: updated.key,
            }),
          },
        });

        return { success: true, archetype: parseArchetypeJSON(updated) };
      } catch (error) {
        console.error("Error updating archetype:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update archetype",
        });
      }
    }),

  /**
   * Delete archetype (soft delete - sets isActive = false) (admin only)
   */
  deleteArchetype: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Soft delete (set isActive = false)
        const archetype = await ctx.db.economicArchetype.update({
          where: { id: input.id },
          data: { isActive: false },
        });

        // Audit log
        const ipAddress =
          ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          ctx.headers.get("x-real-ip") ||
          "unknown";

        await ctx.db.adminAuditLog.create({
          data: {
            action: "ARCHETYPE_DELETED",
            targetType: "economic_archetype",
            targetId: archetype.id,
            targetName: archetype.name,
            adminId: ctx.auth?.userId || "system",
            adminName: ctx.auth?.userId || "system",
            ipAddress: ipAddress || "",
            changes: JSON.stringify({ deactivated: true }),
          },
        });

        return { success: true };
      } catch (error) {
        console.error("Error deleting archetype:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete archetype",
        });
      }
    }),

  /**
   * Get archetype usage statistics (admin only)
   * Returns analytics data for admin dashboard
   */
  getArchetypeUsageStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const archetypes = await ctx.db.economicArchetype.findMany({
        orderBy: { usageCount: "desc" },
      });

      const totalArchetypes = archetypes.length;
      const activeArchetypes = archetypes.filter((a) => a.isActive).length;
      const totalUsage = archetypes.reduce((sum, a) => sum + a.usageCount, 0);

      const topArchetypes = archetypes.slice(0, 10);
      const leastUsed = archetypes.filter((a) => a.usageCount === 0);

      const eraStats = {
        modern: archetypes.filter((a) => a.era === "modern").length,
        historical: archetypes.filter((a) => a.era === "historical").length,
      };

      const regionStats = archetypes.reduce(
        (acc, a) => {
          acc[a.region] = (acc[a.region] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const complexityStats = archetypes.reduce(
        (acc, a) => {
          acc[a.implementationComplexity] = (acc[a.implementationComplexity] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        summary: {
          totalArchetypes,
          activeArchetypes,
          totalUsage,
          averageUsage: totalArchetypes > 0 ? (totalUsage / totalArchetypes).toFixed(2) : "0.00",
        },
        topArchetypes: topArchetypes.map(parseArchetypeJSON),
        leastUsed: leastUsed.map(parseArchetypeJSON),
        eraStats,
        regionStats,
        complexityStats,
      };
    } catch (error) {
      console.error("Error fetching archetype usage stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch usage statistics",
      });
    }
  }),
});
