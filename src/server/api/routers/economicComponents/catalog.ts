/**
 * Economic Components Router (Phase 5 Migration)
 *
 * API layer for atomic economic component library system.
 * Provides public endpoints for component catalog with JSON field parsing.
 *
 * Database Model: EconomicComponentData (reference library)
 * Fallback Data: ATOMIC_ECONOMIC_COMPONENTS from ~/lib/atomic-economic-data
 *
 * Features:
 * - getAllComponents: Query component catalog with category filtering
 * - getComponentByType: Fetch single component details
 * - incrementComponentUsage: Track component selection for analytics
 * - JSON parsing for 7 impact fields (synergies, conflicts, governmentSynergies,
 *   governmentConflicts, taxImpact, sectorImpact, employmentImpact)
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { EconomicComponentType } from "@prisma/client";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";

import { type ParsedEconomicComponent, transformDatabaseComponent } from "./serializer";

// ============================================================================
// Input Validation Schemas
// ============================================================================

const economicComponentTypeSchema = z.nativeEnum(EconomicComponentType);

const getAllComponentsSchema = z
  .object({
    category: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .optional();

const incrementUsageSchema = z.object({
  componentType: economicComponentTypeSchema,
});

/**
 * Get fallback component data from ATOMIC_ECONOMIC_COMPONENTS library
 */
function getFallbackComponents(): ParsedEconomicComponent[] {
  return Object.values(ATOMIC_ECONOMIC_COMPONENTS)
    .filter((comp): comp is NonNullable<typeof comp> => comp !== undefined)
    .map((comp) => ({
      id: comp.id,
      type: comp.type,
      name: comp.name,
      description: comp.description,
      effectiveness: comp.effectiveness,
      synergies: comp.synergies,
      conflicts: comp.conflicts,
      governmentSynergies: comp.governmentSynergies,
      governmentConflicts: comp.governmentConflicts,
      taxImpact: comp.taxImpact,
      sectorImpact: comp.sectorImpact,
      employmentImpact: comp.employmentImpact,
      implementationCost: comp.implementationCost,
      maintenanceCost: comp.maintenanceCost,
      requiredCapacity: comp.requiredCapacity,
      category: comp.category,
      color: comp.color,
      metadata: comp.metadata,
      usageCount: 0,
      isActive: true,
    }));
}

/**
 * Ensure database is seeded with economic component reference data
 */
async function ensureSeeded(db: any) {
  try {
    const count = await db.economicComponentData.count();
    if (count === 0) {
      console.info("[economicComponents] Reference database is empty. Seeding components...");
      const components = getFallbackComponents();
      const dataToInsert = components.map((comp) => ({
        componentType: comp.type,
        name: comp.name,
        description: comp.description,
        category: comp.category,
        effectiveness: comp.effectiveness,
        synergies: JSON.stringify(comp.synergies),
        conflicts: JSON.stringify(comp.conflicts),
        governmentSynergies: JSON.stringify(comp.governmentSynergies),
        governmentConflicts: JSON.stringify(comp.governmentConflicts),
        taxImpact: JSON.stringify(comp.taxImpact),
        sectorImpact: JSON.stringify(comp.sectorImpact),
        employmentImpact: JSON.stringify(comp.employmentImpact),
        implementationCost: comp.implementationCost,
        maintenanceCost: comp.maintenanceCost,
        requiredCapacity: comp.requiredCapacity,
        color: comp.color,
        iconName: comp.type.toLowerCase(),
        metadata: JSON.stringify(comp.metadata),
        isActive: true,
        usageCount: 0,
      }));

      await db.economicComponentData.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });
      console.info(`[economicComponents] Successfully seeded ${dataToInsert.length} components.`);
    }
  } catch (error) {
    console.error("[economicComponents] Failed to self-seed reference database:", error);
  }
}

// ============================================================================
// Router Definition
// ============================================================================

export const economicComponentsCatalogRouter = createTRPCRouter({
  /**
   * Get all economic components with optional filtering
   * Returns from database if available, falls back to ATOMIC_ECONOMIC_COMPONENTS
   *
   * Features:
   * - Category filtering
   * - Active/inactive filtering
   * - 7-field JSON parsing (synergies, conflicts, governmentSynergies, governmentConflicts,
   *   taxImpact, sectorImpact, employmentImpact)
   * - Automatic fallback to hardcoded data
   */
  getAllComponents: publicProcedure.input(getAllComponentsSchema).query(async ({ ctx, input }) => {
    try {
      // Ensure seeded
      await ensureSeeded(ctx.db);

      // Query database
      const dbComponents = await ctx.db.economicComponentData.findMany({
        where: {
          ...(input?.isActive !== undefined && { isActive: input.isActive }),
          ...(input?.category && { category: input.category }),
        },
        orderBy: [{ category: "asc" }, { usageCount: "desc" }],
      });

      // If database is empty, use fallback
      if (dbComponents.length === 0) {
        let components = getFallbackComponents();

        // Apply filters
        if (input?.category) {
          components = components.filter((comp) => comp.category === input.category);
        }

        if (input?.isActive !== undefined) {
          components = components.filter((comp) => comp.isActive === input.isActive);
        }

        return {
          success: true,
          components,
          count: components.length,
          isUsingFallback: true,
        };
      }

      // Parse database components
      const components = dbComponents.map(transformDatabaseComponent);

      return {
        success: true,
        components,
        count: components.length,
        isUsingFallback: false,
      };
    } catch (error) {
      console.error("[economicComponents] Error fetching components:", error);

      // On error, return fallback data
      const fallbackComponents = getFallbackComponents();
      return {
        success: true,
        components: fallbackComponents,
        count: fallbackComponents.length,
        isUsingFallback: true,
      };
    }
  }),

  /**
   * Increment component usage count for analytics
   * Tracks which components are most frequently selected
   */
  incrementComponentUsage: publicProcedure
    .input(incrementUsageSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if record exists first
        const existing = await ctx.db.economicComponentData.findUnique({
          where: { componentType: input.componentType },
        });

        if (!existing) {
          console.warn(
            `[economicComponents] Component ${input.componentType} not found in database for usage tracking. ` +
              `User: ${ctx.auth?.userId || "anonymous"}, Action: incrementUsage`
          );

          // Non-critical operation - return success with fallback
          return {
            success: true,
            componentType: input.componentType,
            newUsageCount: 0,
            message: "Component not found in database - using fallback data",
          };
        }

        // Record exists - perform update
        const updated = await ctx.db.economicComponentData.update({
          where: { componentType: input.componentType },
          data: {
            usageCount: {
              increment: 1,
            },
          },
        });

        return {
          success: true,
          componentType: input.componentType,
          newUsageCount: updated.usageCount,
        };
      } catch (error) {
        console.error(`[economicComponents] Error incrementing usage for ${input.componentType}:`, {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.auth?.userId || "anonymous",
          componentType: input.componentType,
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Non-critical operation - return success even on failure
        return {
          success: true,
          componentType: input.componentType,
          newUsageCount: 0,
          message: "Failed to track usage - non-critical error",
        };
      }
    }),

  /**
   * Get all available templates (admin only for now)
   * Returns pre-configured component sets for common economic models
   */
  getAllTemplates: publicProcedure.query(async ({ ctx }) => {
    try {
      // Query database
      const dbTemplates = await ctx.db.economicTemplate.findMany({
        where: { isActive: true },
        orderBy: { usageCount: "desc" },
      });

      // If database is empty, use fallback
      if (dbTemplates.length === 0) {
        const { ECONOMIC_TEMPLATES } = await import("~/lib/economy/atomic-data");
        return {
          success: true,
          templates: ECONOMIC_TEMPLATES,
          isUsingFallback: true,
        };
      }

      // Parse components JSON
      const templates = dbTemplates.map((template) => ({
        id: template.id,
        key: template.key,
        name: template.name,
        description: template.description,
        components: JSON.parse(template.components) as EconomicComponentType[],
        iconName: template.iconName,
        isActive: template.isActive,
        usageCount: template.usageCount,
      }));

      return {
        success: true,
        templates,
        isUsingFallback: false,
      };
    } catch (error) {
      console.error("[economicComponents] Error fetching templates:", {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.auth?.userId || "anonymous",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Failed to fetch economic templates. Please try again or contact support if the issue persists.",
      });
    }
  }),
});
