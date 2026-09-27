/**
 * Government Components Router (Phase 4 Migration)
 *
 * API layer for atomic government component library and synergy system.
 * Provides public endpoints for component catalog and admin endpoints for management.
 *
 * Database Models: GovernmentComponent, ComponentSynergy (country instances)
 * Fallback Data: ATOMIC_COMPONENTS from ~/lib/atomic-government-data
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";

import { type ParsedComponent, transformDatabaseComponent } from "./serializer";

// ============================================================================
// Input Validation Schemas
// ============================================================================

const componentTypeSchema = z.nativeEnum(ComponentType);

const getAllComponentsSchema = z
  .object({
    category: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .optional();

const incrementUsageSchema = z.object({
  componentType: componentTypeSchema,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure database is seeded with government component reference data
 */
async function ensureSeeded(db: any) {
  try {
    const count = await db.governmentComponentData.count();
    if (count === 0) {
      console.info("[governmentComponents] Reference database is empty. Seeding components...");
      const components = getFallbackComponents();
      const dataToInsert = components.map((comp) => ({
        componentType: comp.type,
        name: comp.name,
        description: comp.description,
        category: comp.category,
        effectiveness: comp.effectiveness,
        implementationCost: comp.implementationCost,
        maintenanceCost: comp.maintenanceCost,
        requiredCapacity: comp.requiredCapacity,
        synergies: JSON.stringify(comp.synergies),
        conflicts: JSON.stringify(comp.conflicts),
        prerequisites: JSON.stringify(comp.prerequisites),
        metadata: JSON.stringify(comp.metadata),
        color: comp.color,
        iconName: comp.type.toLowerCase(),
        isActive: true,
        usageCount: 0,
      }));

      await db.governmentComponentData.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });
      console.info(`[governmentComponents] Successfully seeded ${dataToInsert.length} components.`);
    }
  } catch (error) {
    console.error("[governmentComponents] Failed to self-seed reference database:", error);
  }
}

/**
 * Get fallback component data from ATOMIC_COMPONENTS library
 */
function getFallbackComponents(): ParsedComponent[] {
  return Object.values(ATOMIC_COMPONENTS)
    .filter((comp): comp is NonNullable<typeof comp> => comp !== undefined)
    .map((comp) => ({
      id: comp.id,
      type: comp.type,
      name: comp.name,
      description: comp.description,
      effectiveness: comp.effectiveness,
      synergies: comp.synergies,
      conflicts: comp.conflicts,
      implementationCost: comp.implementationCost,
      maintenanceCost: comp.maintenanceCost,
      requiredCapacity: comp.requiredCapacity,
      category: comp.category,
      prerequisites: comp.prerequisites,
      color: comp.color,
      metadata: comp.metadata,
      usageCount: 0,
      isActive: true,
    }));
}

// ============================================================================
// Public Endpoints
// ============================================================================

export const governmentComponentsCatalogRouter = createTRPCRouter({
  /**
   * Get all government components with optional filtering
   * Returns from database if available, falls back to ATOMIC_COMPONENTS
   */
  getAllComponents: publicProcedure.input(getAllComponentsSchema).query(async ({ ctx, input }) => {
    try {
      // Ensure database has reference data
      await ensureSeeded(ctx.db);

      // Query database
      const dbComponents = await ctx.db.governmentComponentData.findMany({
        where: {
          ...(input?.isActive !== undefined && { isActive: input.isActive }),
          ...(input?.category && { category: input.category }),
        },
        orderBy: [{ category: "asc" }, { usageCount: "desc" }],
      });

      if (dbComponents.length === 0) {
        let components = getFallbackComponents();

        // Apply filters
        if (input?.category) {
          components = components.filter((comp) => comp.category === input.category);
        }

        if (input?.isActive !== undefined) {
          components = components.filter((comp) => comp.isActive === input.isActive);
        }

        // Sort by category and name
        components.sort((a, b) => {
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return a.name.localeCompare(b.name);
        });

        return {
          success: true,
          components,
          count: components.length,
          isUsingFallback: true,
        };
      }

      // Parse and return database components
      const components = dbComponents.map(transformDatabaseComponent);

      return {
        success: true,
        components,
        count: components.length,
        isUsingFallback: false,
      };
    } catch (error) {
      console.error("Error fetching components:", error);
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
   * Increment component usage count
   * This tracks how often components are used across all countries
   */
  incrementComponentUsage: publicProcedure
    .input(incrementUsageSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ensureSeeded(ctx.db);

        const existing = await ctx.db.governmentComponentData.findUnique({
          where: { componentType: input.componentType },
        });

        if (!existing) {
          return {
            success: true,
            componentType: input.componentType,
            newUsageCount: 0,
            message: "Component not found in database",
          };
        }

        const updated = await ctx.db.governmentComponentData.update({
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
        console.error("Error incrementing component usage:", error);
        return {
          success: true,
          componentType: input.componentType,
          newUsageCount: 0,
          message: "Failed to track usage",
        };
      }
    }),
});
