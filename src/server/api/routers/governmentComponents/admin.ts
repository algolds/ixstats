/**
 * Government Components Router — admin
 *
 * Usage statistics for the government component library. Components are defined in code
 * (ATOMIC_COMPONENTS in ~/lib/government/atomic-data) and aren't editable here.
 */

import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { ATOMIC_COMPONENTS, COMPONENT_CATEGORIES } from "~/lib/government/atomic-data";

import { type ParsedComponent } from "./serializer";

/**
 * Components from the ATOMIC_COMPONENTS code library
 */
function getLibraryComponents(): ParsedComponent[] {
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

export const governmentComponentsAdminRouter = createTRPCRouter({
  /**
   * Get component usage statistics (admin only)
   */
  getComponentUsageStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const components = getLibraryComponents();
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
});
