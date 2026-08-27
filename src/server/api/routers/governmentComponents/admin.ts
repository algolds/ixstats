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
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS, COMPONENT_CATEGORIES } from "~/lib/government/atomic-data";

import {
  type ParsedComponent,
  transformDatabaseComponent,
} from "./serializer";

// ============================================================================
// Input Validation Schemas
// ============================================================================

const componentTypeSchema = z.nativeEnum(ComponentType);

const _getAllComponentsSchema = z
  .object({
    category: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .optional();

const _getComponentByTypeSchema = z.object({
  componentType: componentTypeSchema,
});

const _getSynergiesSchema = z.object({
  componentType: componentTypeSchema,
});

const _incrementUsageSchema = z.object({
  componentType: componentTypeSchema,
});

const createSynergySchema = z.object({
  component1: componentTypeSchema,
  component2: componentTypeSchema,
  synergyType: z.enum(["STRONG", "MODERATE", "WEAK", "CONFLICT"]),
  bonusPercent: z.number().min(-100).max(100),
  description: z.string().optional(),
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

/**
 * Get fallback component by type
 */
function getFallbackComponentByType(componentType: ComponentType): ParsedComponent | null {
  const component = ATOMIC_COMPONENTS[componentType];
  if (!component) return null;

  return {
    id: component.id,
    type: component.type,
    name: component.name,
    description: component.description,
    effectiveness: component.effectiveness,
    synergies: component.synergies,
    conflicts: component.conflicts,
    implementationCost: component.implementationCost,
    maintenanceCost: component.maintenanceCost,
    requiredCapacity: component.requiredCapacity,
    category: component.category,
    prerequisites: component.prerequisites,
    color: component.color,
    metadata: component.metadata,
    usageCount: 0,
    isActive: true,
  };
}

/**
 * Get components grouped by category
 */
// oxlint-disable-next-line typescript/no-unused-vars
function getComponentsByCategory(): Record<string, ParsedComponent[]> {
  const fallbackComponents = getFallbackComponents();
  const grouped: Record<string, ParsedComponent[]> = {};

  // Initialize all categories
  Object.keys(COMPONENT_CATEGORIES).forEach((category) => {
    grouped[category] = [];
  });

  // Group components by category
  fallbackComponents.forEach((component) => {
    for (const [categoryName, componentTypes] of Object.entries(COMPONENT_CATEGORIES)) {
      if ((componentTypes as ComponentType[]).includes(component.type)) {
        grouped[categoryName].push(component);
        break;
      }
    }
  });

  return grouped;
}

// ============================================================================
// Public Endpoints
// ============================================================================

export const governmentComponentsAdminRouter = createTRPCRouter({
  // ============================================================================
  // Admin Endpoints
  // ============================================================================

  /**
   * Get component usage statistics (admin only)
   */
  getComponentUsageStats: adminProcedure.query(async ({ ctx }) => {
    try {
      await ensureSeeded(ctx.db);
      const dbComponents = await ctx.db.governmentComponentData.findMany();
      const components = dbComponents.map(transformDatabaseComponent);
      const totalComponents = components.length;
      const activeComponents = components.filter((c) => c.isActive).length;

      // Get actual usage from GovernmentComponent instances
      const usageStats = await ctx.db.governmentComponent.groupBy({
        by: ["componentType"],
        where: { isActive: true },
        _count: { componentType: true },
      });

      const usageMap = new Map(
        usageStats.map((stat) => [stat.componentType, stat._count.componentType])
      );

      // Top 10 by usage
      const topComponents = components
        .map((comp) => ({
          ...comp,
          usageCount: usageMap.get(comp.type) || 0,
        }))
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10);

      // Least used (0 usage)
      const leastUsed = components.filter((comp) => !usageMap.has(comp.type)).slice(0, 10);

      // Category stats
      const categoryStats: Record<string, number> = {};
      for (const [categoryName, componentTypes] of Object.entries(COMPONENT_CATEGORIES)) {
        categoryStats[categoryName] = componentTypes.length;
      }

      // Synergy stats
      const allSynergies = components.reduce((acc, comp) => acc + comp.synergies.length, 0);
      const allConflicts = components.reduce((acc, comp) => acc + comp.conflicts.length, 0);

      return {
        success: true,
        summary: {
          total: totalComponents,
          active: activeComponents,
          totalUsage: Array.from(usageMap.values()).reduce((sum, count) => sum + count, 0),
          avgUsage:
            Array.from(usageMap.values()).reduce((sum, count) => sum + count, 0) / totalComponents,
        },
        topComponents,
        leastUsed,
        categoryStats,
        synergyStats: {
          totalSynergies: allSynergies,
          strongCount: allSynergies, // All defined synergies are considered strong
          moderateCount: 0,
          weakCount: 0,
          conflictCount: allConflicts,
        },
      };
    } catch (error) {
      console.error("Error fetching component usage stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch component usage statistics",
      });
    }
  }),

  /**
   * Create a custom synergy relationship (admin only)
   * Note: This would require a database table to persist custom synergies
   */
  createSynergy: adminProcedure.input(createSynergySchema).mutation(async ({ ctx, input }) => {
    try {
      // Validate both components exist
      const comp1 = getFallbackComponentByType(input.component1);
      const comp2 = getFallbackComponentByType(input.component2);

      if (!comp1 || !comp2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or both component types are invalid",
        });
      }

      // Log the admin action
      await ctx.db.adminAuditLog.create({
        data: {
          action: "GOVERNMENT_SYNERGY_CREATED",
          targetType: "component_synergy",
          targetId: `${input.component1}_${input.component2}`,
          targetName: `${comp1.name} <-> ${comp2.name}`,
          changes: JSON.stringify(input),
          adminId: ctx.user?.id || "system",
          adminName: ctx.user?.clerkUserId || "System",
          timestamp: new Date(),
          ipAddress:
            ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown",
        },
      });

      return {
        success: true,
        message: "Custom synergy created successfully",
        synergy: {
          component1: input.component1,
          component2: input.component2,
          synergyType: input.synergyType,
          bonusPercent: input.bonusPercent,
          description: input.description || `Custom ${input.synergyType.toLowerCase()} synergy`,
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error("Error creating synergy:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create synergy",
      });
    }
  }),

  /**
   * Create component (not supported - components are defined in ATOMIC_COMPONENTS)
   */
  createComponent: adminProcedure
    .input(z.object({ componentType: componentTypeSchema }).catchall(z.any()))
    .mutation(async () => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Creating government components is not supported. Components are defined in the ATOMIC_COMPONENTS library.",
      });
    }),

  /**
   * Update component (not supported - components are defined in ATOMIC_COMPONENTS)
   */
  updateComponent: adminProcedure
    .input(z.object({ componentType: componentTypeSchema }).catchall(z.any()))
    .mutation(async () => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Updating government components is not supported. Components are defined in the ATOMIC_COMPONENTS library.",
      });
    }),

  /**
   * Delete component (not supported - components are defined in ATOMIC_COMPONENTS)
   */
  deleteComponent: adminProcedure
    .input(z.object({ componentType: componentTypeSchema }))
    .mutation(async () => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Deleting government components is not supported. Components are defined in the ATOMIC_COMPONENTS library.",
      });
    }),
});
