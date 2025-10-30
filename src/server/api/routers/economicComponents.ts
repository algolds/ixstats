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
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { EconomicComponentType } from "@prisma/client";
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  COMPONENT_CATEGORIES,
  type AtomicEconomicComponent,
} from "~/lib/atomic-economic-data";

// ============================================================================
// Type Definitions
// ============================================================================

interface ParsedEconomicComponent {
  id: string;
  type: EconomicComponentType;
  name: string;
  description: string;
  effectiveness: number;
  synergies: EconomicComponentType[];
  conflicts: EconomicComponentType[];
  governmentSynergies: string[];
  governmentConflicts: string[];
  taxImpact: {
    optimalCorporateRate: number;
    optimalIncomeRate: number;
    revenueEfficiency: number;
  };
  sectorImpact: Record<string, number>;
  employmentImpact: {
    unemploymentModifier: number;
    participationModifier: number;
    wageGrowthModifier: number;
  };
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  category: string;
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
    console.warn("[economicComponents] Failed to parse JSON:", error);
    return fallback;
  }
}

/**
 * Transform database component to parsed format with 7-field JSON parsing
 */
function transformDatabaseComponent(dbComp: any): ParsedEconomicComponent {
  // Parse all JSON fields
  const synergies = safeJSONParse<EconomicComponentType[]>(dbComp.synergies, []);
  const conflicts = safeJSONParse<EconomicComponentType[]>(dbComp.conflicts, []);
  const governmentSynergies = safeJSONParse<string[]>(dbComp.governmentSynergies, []);
  const governmentConflicts = safeJSONParse<string[]>(dbComp.governmentConflicts, []);
  const taxImpact = safeJSONParse<ParsedEconomicComponent["taxImpact"]>(dbComp.taxImpact, {
    optimalCorporateRate: 20,
    optimalIncomeRate: 25,
    revenueEfficiency: 0.75,
  });
  const sectorImpact = safeJSONParse<Record<string, number>>(dbComp.sectorImpact, {});
  const employmentImpact = safeJSONParse<ParsedEconomicComponent["employmentImpact"]>(
    dbComp.employmentImpact,
    { unemploymentModifier: 0, participationModifier: 1, wageGrowthModifier: 1 }
  );
  const metadata = safeJSONParse<ParsedEconomicComponent["metadata"]>(dbComp.metadata, {
    complexity: "Medium",
    timeToImplement: "2-3 years",
    staffRequired: 150,
    technologyRequired: true,
  });

  return {
    id: dbComp.id || dbComp.componentType.toLowerCase(),
    type: dbComp.componentType,
    name: dbComp.name,
    description: dbComp.description || "",
    effectiveness: dbComp.effectiveness || dbComp.effectivenessScore || 75,
    synergies,
    conflicts,
    governmentSynergies,
    governmentConflicts,
    taxImpact,
    sectorImpact,
    employmentImpact,
    implementationCost: dbComp.implementationCost || 100000,
    maintenanceCost: dbComp.maintenanceCost || 50000,
    requiredCapacity: dbComp.requiredCapacity || 75,
    category: dbComp.category || "Economic Model",
    color: dbComp.color || "emerald",
    metadata,
    usageCount: dbComp.usageCount || 0,
    isActive: dbComp.isActive ?? true,
  };
}

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

// ============================================================================
// Router Definition
// ============================================================================

export const economicComponentsRouter = createTRPCRouter({
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

        console.error("[economicComponents] Error fetching component by type:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch component",
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
        // Try to increment in database
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
        console.error("[economicComponents] Error incrementing usage:", error);

        // Non-critical operation - return success even on failure
        return {
          success: true,
          componentType: input.componentType,
          newUsageCount: 0,
        };
      }
    }),

  /**
   * Get components grouped by category
   */
  getComponentsByCategory: publicProcedure.query(async ({ ctx }) => {
    try {
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
      console.error("[economicComponents] Error fetching components by category:", error);
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

      console.error("[economicComponents] Error fetching synergies:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch synergies",
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
        const { ECONOMIC_TEMPLATES } = await import("~/lib/atomic-economic-data");
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
      console.error("[economicComponents] Error fetching templates:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch economic templates",
      });
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

      // Get actual usage from EconomicComponent instances
      const usageStats = await ctx.db.economicComponent.groupBy({
        by: ["componentType"],
        where: { isActive: true },
        _count: { componentType: true },
      });

      const usageMap = new Map(
        usageStats.map((stat) => [stat.componentType, stat._count.componentType])
      );

      const totalUsage = Array.from(usageMap.values()).reduce((sum, count) => sum + count, 0);
      const totalSynergies = components.reduce((sum, comp) => sum + comp.synergies.length, 0);

      // Get template count
      const { ECONOMIC_TEMPLATES } = await import("~/lib/atomic-economic-data");

      return {
        totalComponents: components.length,
        activeComponents: components.filter((c) => c.isActive).length,
        totalUsage,
        totalSynergies,
        totalTemplates: ECONOMIC_TEMPLATES.length,
      };
    } catch (error) {
      console.error("[economicComponents] Error fetching stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch component usage statistics",
      });
    }
  }),

  /**
   * Create a new component (admin only)
   */
  createComponent: adminProcedure
    .input(
      z.object({
        type: economicComponentTypeSchema,
        name: z.string().min(1),
        description: z.string().min(1),
        category: z.string(),
        effectiveness: z.number().min(0).max(100),
        implementationCost: z.number().min(0),
        maintenanceCost: z.number().min(0),
        requiredCapacity: z.number().min(0).max(100),
        synergies: z.array(economicComponentTypeSchema).default([]),
        conflicts: z.array(economicComponentTypeSchema).default([]),
        governmentSynergies: z.array(z.string()).default([]),
        governmentConflicts: z.array(z.string()).default([]),
        taxImpact: z.object({
          optimalCorporateRate: z.number().min(0).max(50),
          optimalIncomeRate: z.number().min(0).max(60),
          revenueEfficiency: z.number().min(0).max(100),
        }),
        sectorImpact: z.object({
          services: z.number().min(0).max(2),
          finance: z.number().min(0).max(2),
          technology: z.number().min(0).max(2),
          manufacturing: z.number().min(0).max(2),
          agriculture: z.number().min(0).max(2),
          government: z.number().min(0).max(2),
        }),
        employmentImpact: z.object({
          unemploymentModifier: z.number().min(-2).max(2),
          participationModifier: z.number().min(0.5).max(2),
          wageGrowthModifier: z.number().min(0.5).max(2),
        }),
        complexity: z.enum(["Low", "Medium", "High"]),
        timeToImplement: z.string(),
        staffRequired: z.number().min(0),
        technologyRequired: z.boolean(),
        color: z.string(),
        icon: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Create component with stringified JSON fields
        const component = await ctx.db.economicComponentData.create({
          data: {
            componentType: input.type,
            name: input.name,
            description: input.description,
            category: input.category,
            effectiveness: input.effectiveness,
            synergies: JSON.stringify(input.synergies),
            conflicts: JSON.stringify(input.conflicts),
            governmentSynergies: JSON.stringify(input.governmentSynergies),
            governmentConflicts: JSON.stringify(input.governmentConflicts),
            taxImpact: JSON.stringify(input.taxImpact),
            sectorImpact: JSON.stringify(input.sectorImpact),
            employmentImpact: JSON.stringify(input.employmentImpact),
            implementationCost: input.implementationCost,
            maintenanceCost: input.maintenanceCost,
            requiredCapacity: input.requiredCapacity,
            color: input.color,
            iconName: input.icon,
            metadata: JSON.stringify({
              complexity: input.complexity,
              timeToImplement: input.timeToImplement,
              staffRequired: input.staffRequired,
              technologyRequired: input.technologyRequired,
            }),
          },
        });

        // Log the admin action
        await ctx.db.adminAuditLog.create({
          data: {
            action: "ECONOMIC_COMPONENT_CREATED",
            targetType: "economic_component",
            targetId: component.id,
            targetName: input.name,
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
          component: transformDatabaseComponent(component),
          message: "Component created successfully",
        };
      } catch (error) {
        console.error("[economicComponents] Error creating component:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create component",
        });
      }
    }),

  /**
   * Update a component (admin only)
   */
  updateComponent: adminProcedure
    .input(
      z.object({
        componentType: economicComponentTypeSchema,
        name: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        category: z.string().optional(),
        effectiveness: z.number().min(0).max(100).optional(),
        implementationCost: z.number().min(0).optional(),
        maintenanceCost: z.number().min(0).optional(),
        requiredCapacity: z.number().min(0).max(100).optional(),
        synergies: z.array(economicComponentTypeSchema).optional(),
        conflicts: z.array(economicComponentTypeSchema).optional(),
        governmentSynergies: z.array(z.string()).optional(),
        governmentConflicts: z.array(z.string()).optional(),
        taxImpact: z
          .object({
            optimalCorporateRate: z.number().min(0).max(50),
            optimalIncomeRate: z.number().min(0).max(60),
            revenueEfficiency: z.number().min(0).max(100),
          })
          .optional(),
        sectorImpact: z.record(z.string(), z.number()).optional(),
        employmentImpact: z
          .object({
            unemploymentModifier: z.number().min(-2).max(2),
            participationModifier: z.number().min(0.5).max(2),
            wageGrowthModifier: z.number().min(0.5).max(2),
          })
          .optional(),
        complexity: z.enum(["Low", "Medium", "High"]).optional(),
        timeToImplement: z.string().optional(),
        staffRequired: z.number().min(0).optional(),
        technologyRequired: z.boolean().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Build update data with stringified JSON fields
        const updateData: Record<string, unknown> = {};
        const metadata: Record<string, unknown> = {};

        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.effectiveness !== undefined) updateData.effectiveness = input.effectiveness;
        if (input.synergies !== undefined) updateData.synergies = JSON.stringify(input.synergies);
        if (input.conflicts !== undefined) updateData.conflicts = JSON.stringify(input.conflicts);
        if (input.governmentSynergies !== undefined)
          updateData.governmentSynergies = JSON.stringify(input.governmentSynergies);
        if (input.governmentConflicts !== undefined)
          updateData.governmentConflicts = JSON.stringify(input.governmentConflicts);
        if (input.taxImpact !== undefined) updateData.taxImpact = JSON.stringify(input.taxImpact);
        if (input.sectorImpact !== undefined)
          updateData.sectorImpact = JSON.stringify(input.sectorImpact);
        if (input.employmentImpact !== undefined)
          updateData.employmentImpact = JSON.stringify(input.employmentImpact);
        if (input.implementationCost !== undefined)
          updateData.implementationCost = input.implementationCost;
        if (input.maintenanceCost !== undefined) updateData.maintenanceCost = input.maintenanceCost;
        if (input.requiredCapacity !== undefined)
          updateData.requiredCapacity = input.requiredCapacity;
        if (input.color !== undefined) updateData.color = input.color;
        if (input.icon !== undefined) updateData.iconName = input.icon;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        // Build metadata
        if (input.complexity !== undefined) metadata.complexity = input.complexity;
        if (input.timeToImplement !== undefined) metadata.timeToImplement = input.timeToImplement;
        if (input.staffRequired !== undefined) metadata.staffRequired = input.staffRequired;
        if (input.technologyRequired !== undefined)
          metadata.technologyRequired = input.technologyRequired;

        if (Object.keys(metadata).length > 0) {
          // Get existing metadata and merge
          const existing = await ctx.db.economicComponentData.findUnique({
            where: { componentType: input.componentType },
            select: { metadata: true },
          });

          const existingMetadata = existing ? JSON.parse(existing.metadata) : {};
          updateData.metadata = JSON.stringify({ ...existingMetadata, ...metadata });
        }

        // Update component
        const component = await ctx.db.economicComponentData.update({
          where: { componentType: input.componentType },
          data: updateData,
        });

        // Log the admin action
        await ctx.db.adminAuditLog.create({
          data: {
            action: "ECONOMIC_COMPONENT_UPDATED",
            targetType: "economic_component",
            targetId: component.id,
            targetName: component.name,
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
          component: transformDatabaseComponent(component),
          message: "Component updated successfully",
        };
      } catch (error) {
        console.error("[economicComponents] Error updating component:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update component",
        });
      }
    }),

  /**
   * Delete (deactivate) a component (admin only)
   */
  deleteComponent: adminProcedure
    .input(
      z.object({
        componentType: economicComponentTypeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Soft delete by setting isActive to false
        const component = await ctx.db.economicComponentData.update({
          where: { componentType: input.componentType },
          data: { isActive: false },
        });

        // Log the admin action
        await ctx.db.adminAuditLog.create({
          data: {
            action: "ECONOMIC_COMPONENT_DELETED",
            targetType: "economic_component",
            targetId: component.id,
            targetName: component.name,
            changes: JSON.stringify({ componentType: input.componentType, isActive: false }),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
            ipAddress:
              ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown",
          },
        });

        return {
          success: true,
          message: "Component deactivated successfully",
        };
      } catch (error) {
        console.error("[economicComponents] Error deleting component:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete component",
        });
      }
    }),

  /**
   * Create a synergy relationship (admin only)
   */
  createSynergy: adminProcedure
    .input(
      z.object({
        component1: economicComponentTypeSchema,
        component2: economicComponentTypeSchema,
        synergyType: z.enum(["STRONG", "MODERATE", "WEAK", "CONFLICT"]),
        bonusPercent: z.number().min(-100).max(100),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Create synergy
        const synergy = await ctx.db.economicSynergy.create({
          data: {
            component1: input.component1,
            component2: input.component2,
            synergyType: input.synergyType,
            bonusPercent: input.bonusPercent,
            description: input.description || `${input.synergyType} synergy between components`,
          },
        });

        // Log the admin action
        await ctx.db.adminAuditLog.create({
          data: {
            action: "ECONOMIC_SYNERGY_CREATED",
            targetType: "economic_synergy",
            targetId: synergy.id,
            targetName: `${input.component1} <-> ${input.component2}`,
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
          synergy,
          message: "Synergy created successfully",
        };
      } catch (error) {
        console.error("[economicComponents] Error creating synergy:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create synergy",
        });
      }
    }),

  /**
   * Create a template (admin only)
   */
  createTemplate: adminProcedure
    .input(
      z.object({
        key: z.string().min(1),
        name: z.string().min(1),
        description: z.string().min(1),
        components: z.array(economicComponentTypeSchema),
        iconName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Create template with stringified components array
        const template = await ctx.db.economicTemplate.create({
          data: {
            key: input.key,
            name: input.name,
            description: input.description,
            components: JSON.stringify(input.components),
            iconName: input.iconName,
          },
        });

        // Log the admin action
        await ctx.db.adminAuditLog.create({
          data: {
            action: "ECONOMIC_TEMPLATE_CREATED",
            targetType: "economic_template",
            targetId: template.id,
            targetName: input.name,
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
          template: {
            ...template,
            components: JSON.parse(template.components) as EconomicComponentType[],
          },
          message: "Template created successfully",
        };
      } catch (error) {
        console.error("[economicComponents] Error creating template:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create template",
        });
      }
    }),
});
