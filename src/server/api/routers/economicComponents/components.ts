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
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { EconomicComponentType } from "@prisma/client";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";

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

export const economicComponentsComponentsRouter = createTRPCRouter({
  // ============================================================================
  // Admin Endpoints
  // ============================================================================

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
        console.error(`[economicComponents] Error creating component ${input.name}:`, {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.auth?.userId || "anonymous",
          adminUser: ctx.user
            ? `${(ctx.user as any).role?.name || "NO_ROLE"} (level ${(ctx.user as any).role?.level ?? "N/A"})`
            : "NO_USER",
          componentType: input.type,
          componentName: input.name,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create component "${input.name}". Please try again or contact support if the issue persists.`,
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
        console.error(`[economicComponents] Error updating component ${input.componentType}:`, {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.auth?.userId || "anonymous",
          adminUser: ctx.user
            ? `${(ctx.user as any).role?.name || "NO_ROLE"} (level ${(ctx.user as any).role?.level ?? "N/A"})`
            : "NO_USER",
          componentType: input.componentType,
          updateFields: Object.keys(input).join(", "),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update component ${input.componentType}. Please try again or contact support if the issue persists.`,
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
        console.error(`[economicComponents] Error deleting component ${input.componentType}:`, {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.auth?.userId || "anonymous",
          adminUser: ctx.user
            ? `${(ctx.user as any).role?.name || "NO_ROLE"} (level ${(ctx.user as any).role?.level ?? "N/A"})`
            : "NO_USER",
          componentType: input.componentType,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete component ${input.componentType}. Please try again or contact support if the issue persists.`,
        });
      }
    })
});
