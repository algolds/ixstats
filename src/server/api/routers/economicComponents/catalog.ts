/**
 * Economic Components Router — catalog
 *
 * Serves the atomic economic component library. The code library
 * (ATOMIC_ECONOMIC_COMPONENTS in ~/lib/economy/atomic-data) is the source of truth: the
 * builder, editor and calculations read it directly, and admins can't edit it. The
 * EconomicComponentData table only records how often each component is picked.
 *
 * - getAllComponents: the component catalog, with usage counts
 * - incrementComponentUsage: track component selection for analytics
 * - getAllTemplates: preset component sets
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { EconomicComponentType } from "@prisma/client";
import { ECONOMIC_TEMPLATES } from "~/lib/economy/atomic-data";

import { getLibraryComponents } from "./serializer";

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
 * Ensure the usage-count table has a row per component
 */
async function ensureSeeded(db: any) {
  try {
    const count = await db.economicComponentData.count();
    if (count === 0) {
      console.info("[economicComponents] Reference database is empty. Seeding components...");
      const components = getLibraryComponents();
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
    // The code library is the only catalog: the builder, editor and calculations read it
    // directly. Every component is active; the database only keeps usage counts.
    let components = (input?.isActive === false ? [] : getLibraryComponents())
      .filter((comp) => !input?.category || comp.category === input.category)
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

    try {
      await ensureSeeded(ctx.db);
      const usage = await ctx.db.economicComponentData.findMany({
        select: { componentType: true, usageCount: true },
      });
      const usageByType = new Map(usage.map((row) => [row.componentType, row.usageCount]));
      components = components.map((comp) => ({
        ...comp,
        usageCount: usageByType.get(comp.type) ?? 0,
      }));
    } catch (error) {
      console.error("[economicComponents] Failed to read usage counts:", error);
    }

    return {
      success: true,
      components,
      count: components.length,
    };
  }),

  /**
   * Increment component usage count for analytics
   * Tracks which components are most frequently selected
   */
  incrementComponentUsage: rateLimitedPublicProcedure
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
   * Preset component sets from the code library (ECONOMIC_TEMPLATES), as the economy builder
   * offers them
   */
  getAllTemplates: publicProcedure.query(() => ({
    success: true,
    templates: ECONOMIC_TEMPLATES.map(({ id, name, description, components }) => ({
      id,
      name,
      description,
      components,
    })),
  })),
});
