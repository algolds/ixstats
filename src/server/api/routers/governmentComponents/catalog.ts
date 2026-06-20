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
 * Parse JSON field safely with fallback
 */
function safeJSONParse<T>(jsonString: string | null, fallback: T): T {
  if (!jsonString) return fallback;

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn("[governmentComponents] Failed to parse JSON:", error);
    return fallback;
  }
}

/**
 * Transform database component to parsed format
 */
function transformDatabaseComponent(dbComp: any): ParsedComponent {
  const synergies = safeJSONParse<ComponentType[]>(dbComp.synergies, []);
  const conflicts = safeJSONParse<ComponentType[]>(dbComp.conflicts, []);
  const prerequisites = safeJSONParse<string[]>(dbComp.prerequisites, []);
  const metadata = safeJSONParse<ParsedComponent["metadata"]>(dbComp.metadata, {
    complexity: "Medium",
    timeToImplement: "12-18 months",
    staffRequired: 10,
    technologyRequired: false,
  });

  return {
    id: dbComp.id || dbComp.componentType.toLowerCase(),
    type: dbComp.componentType,
    name: dbComp.name,
    description: dbComp.description || "",
    effectiveness: dbComp.effectiveness || 50,
    synergies,
    conflicts,
    implementationCost: dbComp.implementationCost || 0,
    maintenanceCost: dbComp.maintenanceCost || 0,
    requiredCapacity: dbComp.requiredCapacity || 50,
    category: dbComp.category || "general",
    prerequisites,
    color: dbComp.color || "blue",
    metadata,
    usageCount: dbComp.usageCount || 0,
    isActive: dbComp.isActive ?? true,
  };
}

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
   * Get a single component by type
   */
  getComponentByType: publicProcedure
    .input(getComponentByTypeSchema)
    .query(async ({ ctx, input }) => {
      try {
        await ensureSeeded(ctx.db);

        const dbComponent = await ctx.db.governmentComponentData.findUnique({
          where: { componentType: input.componentType },
        });

        if (dbComponent) {
          return {
            success: true,
            component: transformDatabaseComponent(dbComponent),
            isUsingFallback: false,
          };
        }

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
      await ensureSeeded(ctx.db);

      const dbComponents = await ctx.db.governmentComponentData.findMany({
        where: { isActive: true },
        orderBy: { usageCount: "desc" },
      });

      if (dbComponents.length === 0) {
        const grouped = getComponentsByCategory();

        return {
          success: true,
          categories: grouped,
          categoryCount: Object.keys(grouped).length,
          isUsingFallback: true,
        };
      }

      const parsed = dbComponents.map(transformDatabaseComponent);
      const grouped: Record<string, ParsedComponent[]> = {};

      // Initialize all categories
      Object.keys(COMPONENT_CATEGORIES).forEach((category) => {
        grouped[category] = [];
      });

      parsed.forEach((component) => {
        for (const [categoryName, componentTypes] of Object.entries(COMPONENT_CATEGORIES)) {
          if ((componentTypes as ComponentType[]).includes(component.type)) {
            grouped[categoryName].push(component);
            break;
          }
        }
      });

      return {
        success: true,
        categories: grouped,
        categoryCount: Object.keys(grouped).length,
        isUsingFallback: false,
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
      await ensureSeeded(ctx.db);

      const component = await ctx.db.governmentComponentData
        .findUnique({
          where: { componentType: input.componentType },
        })
        .then((res) =>
          res ? transformDatabaseComponent(res) : getFallbackComponentByType(input.componentType)
        );

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

  // ============================================================================
  // Admin Endpoints
  // ============================================================================
});
