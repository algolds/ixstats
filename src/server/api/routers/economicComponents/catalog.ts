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

const getComponentByTypeSchema = z.object({
  componentType: economicComponentTypeSchema,
});

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
 * Get fallback component by type
 */
function getFallbackComponentByType(
  componentType: EconomicComponentType
): ParsedEconomicComponent | null {
  const component = ATOMIC_ECONOMIC_COMPONENTS[componentType];
  if (!component) return null;

  return {
    id: component.id,
    type: component.type,
    name: component.name,
    description: component.description,
    effectiveness: component.effectiveness,
    synergies: component.synergies,
    conflicts: component.conflicts,
    governmentSynergies: component.governmentSynergies,
    governmentConflicts: component.governmentConflicts,
    taxImpact: component.taxImpact,
    sectorImpact: component.sectorImpact,
    employmentImpact: component.employmentImpact,
    implementationCost: component.implementationCost,
    maintenanceCost: component.maintenanceCost,
    requiredCapacity: component.requiredCapacity,
    category: component.category,
    color: component.color,
    metadata: component.metadata,
    usageCount: 0,
    isActive: true,
  };
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
   * Get a single component by type
   * Returns component with all impact fields parsed from JSON
   */
  getComponentByType: publicProcedure
    .input(getComponentByTypeSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Ensure seeded
        await ensureSeeded(ctx.db);

        // Try database first
        const dbComponent = await ctx.db.economicComponentData.findUnique({
          where: { componentType: input.componentType },
        });

        if (dbComponent) {
          return {
            success: true,
            component: transformDatabaseComponent(dbComponent),
            isUsingFallback: false,
          };
        }

        // Fallback to hardcoded data
        const component = getFallbackComponentByType(input.componentType);

        if (!component) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Component type ${input.componentType} not found`,
          });
        }

        return {
          success: true,
          component,
          isUsingFallback: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error(
          `[economicComponents] Error fetching component by type ${input.componentType}:`,
          {
            error: error instanceof Error ? error.message : String(error),
            userId: ctx.auth?.userId || "anonymous",
            componentType: input.componentType,
            stack: error instanceof Error ? error.stack : undefined,
          }
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch component ${input.componentType}. Please try again or contact support if the issue persists.`,
        });
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
   * Get components grouped by category
   */
  getComponentsByCategory: publicProcedure.query(async ({ ctx }) => {
    try {
      // Ensure seeded
      await ensureSeeded(ctx.db);

      // Query database
      const dbComponents = await ctx.db.economicComponentData.findMany({
        where: { isActive: true },
        orderBy: { usageCount: "desc" },
      });

      // If database is empty, use fallback
      if (dbComponents.length === 0) {
        const fallbackComponents = getFallbackComponents();
        const grouped: Record<string, ParsedEconomicComponent[]> = {};

        // Group components by category
        fallbackComponents.forEach((component) => {
          if (!grouped[component.category]) {
            grouped[component.category] = [];
          }
          grouped[component.category].push(component);
        });

        return {
          success: true,
          categories: grouped,
          categoryCount: Object.keys(grouped).length,
          isUsingFallback: true,
        };
      }

      // Parse and group database components
      const components = dbComponents.map(transformDatabaseComponent);
      const grouped: Record<string, ParsedEconomicComponent[]> = {};

      components.forEach((component) => {
        if (!grouped[component.category]) {
          grouped[component.category] = [];
        }
        grouped[component.category].push(component);
      });

      return {
        success: true,
        categories: grouped,
        categoryCount: Object.keys(grouped).length,
        isUsingFallback: false,
      };
    } catch (error) {
      console.error("[economicComponents] Error fetching components by category:", {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.auth?.userId || "anonymous",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Failed to fetch components by category. Please try again or contact support if the issue persists.",
      });
    }
  }),

  /**
   * Get synergies for a specific component
   * Returns both positive synergies and conflicts
   */
  getSynergies: publicProcedure.input(getComponentByTypeSchema).query(async ({ ctx, input }) => {
    try {
      // Query database synergies
      const dbSynergies = await ctx.db.economicSynergy.findMany({
        where: {
          OR: [{ component1: input.componentType }, { component2: input.componentType }],
          isActive: true,
        },
      });

      // If database has synergies, return them
      if (dbSynergies.length > 0) {
        return {
          success: true,
          synergies: dbSynergies,
          count: dbSynergies.length,
          isUsingFallback: false,
        };
      }

      // Fallback: Build synergies from component data
      const component = getFallbackComponentByType(input.componentType);

      if (!component) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Component type ${input.componentType} not found`,
        });
      }

      // Build synergy objects from the component's synergies and conflicts
      const synergies = component.synergies.map((synergyType, idx) => ({
        id: `fallback_${input.componentType}_${synergyType}_${idx}`,
        component1: input.componentType,
        component2: synergyType,
        synergyType: "STRONG" as const,
        bonusPercent: 15,
        description: `Strong synergy between ${component.name} and ${ATOMIC_ECONOMIC_COMPONENTS[synergyType]?.name || synergyType}`,
        isActive: true,
      }));

      const conflicts = component.conflicts.map((conflictType, idx) => ({
        id: `fallback_conflict_${input.componentType}_${conflictType}_${idx}`,
        component1: input.componentType,
        component2: conflictType,
        synergyType: "CONFLICT" as const,
        bonusPercent: -20,
        description: `Conflict between ${component.name} and ${ATOMIC_ECONOMIC_COMPONENTS[conflictType]?.name || conflictType}`,
        isActive: true,
      }));

      return {
        success: true,
        synergies: [...synergies, ...conflicts],
        count: synergies.length + conflicts.length,
        isUsingFallback: true,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error(`[economicComponents] Error fetching synergies for ${input.componentType}:`, {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.auth?.userId || "anonymous",
        componentType: input.componentType,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch synergies for ${input.componentType}. Please try again or contact support if the issue persists.`,
      });
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

  // ============================================================================
  // Admin Endpoints
  // ============================================================================
});
