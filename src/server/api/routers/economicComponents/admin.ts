/**
 * Economic Components Router — admin
 *
 * Usage statistics for the economic component library. Components are defined in code
 * (ATOMIC_ECONOMIC_COMPONENTS in ~/lib/economy/atomic-data) and aren't editable here.
 */

import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";

import { type ParsedEconomicComponent } from "./serializer";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Components from the ATOMIC_ECONOMIC_COMPONENTS code library
 */
function getLibraryComponents(): ParsedEconomicComponent[] {
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
      const components = getLibraryComponents();

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
      const { ECONOMIC_TEMPLATES } = await import("~/lib/economy/atomic-data");

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
});
