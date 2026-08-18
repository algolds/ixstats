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
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";

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

export const economicComponentsAdminRouter = createTRPCRouter({
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
      const { ECONOMIC_TEMPLATES } = await import("~/lib/economy/atomic-data/);

      return {
        totalComponents: components.length,
        activeComponents: components.filter((c) => c.isActive).length,
        totalUsage,
        totalSynergies,
        totalTemplates: ECONOMIC_TEMPLATES.length,
      };
    } catch (error) {
      console.error("[economicComponents] Error fetching stats:", {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.auth?.userId || "anonymous",
        adminUser: ctx.user
          ? `${(ctx.user as any).role?.name || "NO_ROLE"} (level ${(ctx.user as any).role?.level ?? "N/A"})`
          : "NO_USER",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Failed to fetch component usage statistics. Please try again or contact support if the issue persists.",
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
        console.error(
          `[economicComponents] Error creating synergy between ${input.component1} and ${input.component2}:`,
          {
            error: error instanceof Error ? error.message : String(error),
            userId: ctx.auth?.userId || "anonymous",
            adminUser: ctx.user
              ? `${(ctx.user as any).role?.name || "NO_ROLE"} (level ${(ctx.user as any).role?.level ?? "N/A"})`
              : "NO_USER",
            component1: input.component1,
            component2: input.component2,
            synergyType: input.synergyType,
            stack: error instanceof Error ? error.stack : undefined,
          }
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create synergy between ${input.component1} and ${input.component2}. Please try again or contact support if the issue persists.`,
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
        console.error(`[economicComponents] Error creating template ${input.name}:`, {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.auth?.userId || "anonymous",
          adminUser: ctx.user
            ? `${(ctx.user as any).role?.name || "NO_ROLE"} (level ${(ctx.user as any).role?.level ?? "N/A"})`
            : "NO_USER",
          templateKey: input.key,
          templateName: input.name,
          componentCount: input.components.length,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create template "${input.name}". Please try again or contact support if the issue persists.`,
        });
      }
    }),
});
