/**
 * Economic Components Router — admin
 *
 * Usage statistics for the economic component library. Components are defined in code
 * (ATOMIC_ECONOMIC_COMPONENTS in ~/lib/economy/atomic-data) and aren't editable here.
 */

import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getLibraryComponents } from "./serializer";

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
