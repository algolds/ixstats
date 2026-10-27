/**
 * Government Components Router — catalog
 *
 * Serves the atomic government component library. The code library (ATOMIC_COMPONENTS in
 * ~/lib/government/atomic-data) is the source of truth: the builder, editor and
 * calculations read it directly, and admins can't edit it. The GovernmentComponentData
 * table only records how often each component is picked.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { globalCache } from "~/lib/cache";
import { ComponentType } from "@prisma/client";

import { getAllComponentsSchema, listCatalogComponents } from "~/server/shared/component-catalog";
import { getLibraryComponents } from "./serializer";

// ============================================================================
// Input Validation Schemas
// ============================================================================

const componentTypeSchema = z.nativeEnum(ComponentType);

const incrementUsageSchema = z.object({
  componentType: componentTypeSchema,
});

/**
 * Whether `userId` already counted the government component `id` today. A pick counts once a day per player, so nobody can inflate the
 * popularity counters by calling the mutation over and over.
 */
async function countedToday(userId: string, id: string): Promise<boolean> {
  const key = `usage:government-component:${userId}:${id}:${new Date().toISOString().slice(0, 10)}`;
  if (await globalCache.get(key)) return true;
  await globalCache.set(key, true, { ttl: 86_400 });
  return false;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure the usage-count table has a row per component
 */
async function ensureSeeded(db: any) {
  try {
    const count = await db.governmentComponentData.count();
    if (count === 0) {
      console.info("[governmentComponents] Reference database is empty. Seeding components...");
      const components = getLibraryComponents();
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

// ============================================================================
// Public Endpoints
// ============================================================================

export const governmentComponentsCatalogRouter = createTRPCRouter({
  /**
   * Get all government components with optional filtering
   * Returns from database if available, falls back to ATOMIC_COMPONENTS
   */
  getAllComponents: publicProcedure.input(getAllComponentsSchema).query(({ ctx, input }) =>
    listCatalogComponents({
      label: "governmentComponents",
      library: getLibraryComponents,
      input,
      loadUsage: async () => {
        await ensureSeeded(ctx.db);
        return ctx.db.governmentComponentData.findMany({
          select: { componentType: true, usageCount: true },
        });
      },
    })
  ),

  /**
   * Increment component usage count
   * This tracks how often components are used across all countries: signed in, once a day per player and component
   */
  incrementComponentUsage: rateLimitedMutationProcedure
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
        if (await countedToday(ctx.user.id, input.componentType)) {
          return {
            success: true,
            componentType: input.componentType,
            newUsageCount: existing.usageCount,
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
