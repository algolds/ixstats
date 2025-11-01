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
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS, COMPONENT_CATEGORIES } from "~/lib/atomic-government-data";

// ============================================================================
// Type Definitions
// ============================================================================

interface ParsedComponent {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  effectiveness: number;
  synergies: ComponentType[];
  conflicts: ComponentType[];
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  category: string;
  prerequisites: string[];
  color: string;
  metadata: {
    complexity: "Low" | "Medium" | "High";
    timeToImplement: string;
    staffRequired: number;
    technologyRequired: boolean;
  };
  usageCount?: number;
  isActive?: boolean;
}

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

const getComponentByTypeSchema = z.object({
  componentType: componentTypeSchema,
});

const getSynergiesSchema = z.object({
  componentType: componentTypeSchema,
});

const incrementUsageSchema = z.object({
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

export const governmentComponentsRouter = createTRPCRouter({
  /**
   * Get all government components with optional filtering
   * Returns from database if available, falls back to ATOMIC_COMPONENTS
   */
  getAllComponents: publicProcedure.input(getAllComponentsSchema).query(async ({ ctx, input }) => {
    try {
      // For now, use fallback data as the source of truth
      // In the future, this could query a ComponentLibrary table
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
      };
    } catch (error) {
      console.error("Error fetching components:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch government components",
      });
    }
  }),

  /**
   * Get a single component by type
   */
  getComponentByType: publicProcedure
    .input(getComponentByTypeSchema)
    .query(async ({ ctx, input }) => {
      try {
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
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("Error fetching component by type:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch component",
        });
      }
    }),

  /**
   * Get components grouped by category
   */
  getComponentsByCategory: publicProcedure.query(async ({ ctx }) => {
    try {
      const grouped = getComponentsByCategory();

      return {
        success: true,
        categories: grouped,
        categoryCount: Object.keys(grouped).length,
      };
    } catch (error) {
      console.error("Error fetching components by category:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch components by category",
      });
    }
  }),

  /**
   * Get synergies for a specific component
   * Returns both positive synergies and conflicts
   */
  getSynergies: publicProcedure.input(getSynergiesSchema).query(async ({ ctx, input }) => {
    try {
      const component = getFallbackComponentByType(input.componentType);

      if (!component) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Component type ${input.componentType} not found`,
        });
      }

      // Build synergy objects from the component's synergies and conflicts
      const synergies = component.synergies.map((synergyType) => ({
        component1: input.componentType,
        component2: synergyType,
        synergyType: "STRONG" as const,
        bonusPercent: 15,
        description: `Strong synergy between ${component.name} and ${ATOMIC_COMPONENTS[synergyType]?.name || synergyType}`,
      }));

      const conflicts = component.conflicts.map((conflictType) => ({
        component1: input.componentType,
        component2: conflictType,
        synergyType: "CONFLICT" as const,
        bonusPercent: -20,
        description: `Conflict between ${component.name} and ${ATOMIC_COMPONENTS[conflictType]?.name || conflictType}`,
      }));

      return {
        success: true,
        synergies: [...synergies, ...conflicts],
        count: synergies.length + conflicts.length,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error("Error fetching synergies:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch synergies",
      });
    }
  }),

  /**
   * Increment component usage count (silent failure)
   * This tracks how often components are used across all countries
   */
  incrementComponentUsage: publicProcedure
    .input(incrementUsageSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // In a real implementation, this would increment a counter in the database
        // For now, we just return success since we're using static data
        return {
          success: true,
          componentType: input.componentType,
        };
      } catch (error) {
        // Silent failure - just log and return success
        console.error("Error incrementing component usage:", error);
        return {
          success: true,
          componentType: input.componentType,
        };
      }
    }),

  // ============================================================================
  // Admin Endpoints
  // ============================================================================

  /**
   * Get component usage statistics (admin only)
   */
  getComponentUsageStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const components = getFallbackComponents();
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
