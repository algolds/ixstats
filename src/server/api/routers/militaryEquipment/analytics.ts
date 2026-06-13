// src/server/api/routers/militaryEquipment.ts
// Phase 6: Military Equipment Catalog Migration

import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Military Equipment Catalog Router
 *
 * Provides API endpoints for querying and managing military equipment catalog data,
 * manufacturers, and procurement analytics.
 *
 * Public endpoints: Query catalog, track usage
 * Admin endpoints: CRUD operations with audit logging
 * Analytics endpoints: Usage statistics and trends
 */
export const militaryEquipmentAnalyticsRouter = createTRPCRouter({
  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================

  // ==========================================
  // ANALYTICS ENDPOINTS
  // ==========================================

  /**
   * Get equipment usage statistics
   */
  getEquipmentUsageStats: publicProcedure.query(async ({ ctx }) => {
    try {
      // Top 10 most procured equipment
      const topEquipment = await ctx.db.militaryEquipmentCatalog.findMany({
        where: { isActive: true },
        orderBy: { usageCount: "desc" },
        take: 10,
      });

      // Usage by category
      const categoryStats = await ctx.db.militaryEquipmentCatalog.groupBy({
        by: ["category"],
        where: { isActive: true },
        _sum: { usageCount: true },
        _count: { id: true },
      });

      // Usage by era
      const eraStats = await ctx.db.militaryEquipmentCatalog.groupBy({
        by: ["era"],
        where: { isActive: true },
        _sum: { usageCount: true },
        _count: { id: true },
      });

      // Usage by manufacturer (get unique manufacturers from equipment)
      const equipmentWithManufacturers = await ctx.db.militaryEquipmentCatalog.findMany({
        where: { isActive: true },
        select: {
          manufacturer: true,
          usageCount: true,
        },
      });

      const manufacturerUsageMap = new Map<
        string,
        { totalUsage: number; equipmentCount: number }
      >();
      equipmentWithManufacturers.forEach((eq) => {
        const existing = manufacturerUsageMap.get(eq.manufacturer) || {
          totalUsage: 0,
          equipmentCount: 0,
        };
        manufacturerUsageMap.set(eq.manufacturer, {
          totalUsage: existing.totalUsage + eq.usageCount,
          equipmentCount: existing.equipmentCount + 1,
        });
      });

      const manufacturerUsage = Array.from(manufacturerUsageMap.entries())
        .map(([name, stats]) => ({
          manufacturerName: name,
          totalUsage: stats.totalUsage,
          equipmentCount: stats.equipmentCount,
        }))
        .sort((a, b) => b.totalUsage - a.totalUsage);

      return {
        topEquipment: topEquipment.map((eq) => ({
          ...eq,
          specifications: eq.specifications ? JSON.parse(eq.specifications) : null,
          capabilities: eq.capabilities ? JSON.parse(eq.capabilities) : null,
        })),
        byCategory: categoryStats,
        byEra: eraStats,
        byManufacturer: manufacturerUsage,
      };
    } catch (error) {
      console.error("[MILITARY_EQUIPMENT] Failed to get usage stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve usage statistics",
        cause: error,
      });
    }
  }),

  // ==========================================
  // IMAGE RESOLUTION ENDPOINTS
  // ==========================================
});
