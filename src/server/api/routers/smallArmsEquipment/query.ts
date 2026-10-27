/**
 * Small Arms Equipment tRPC Router
 * Phase 9 Migration - October 2025
 *
 * Provides API endpoints for small arms equipment catalog management.
 * Replaces hardcoded data from src/lib/small-arms-equipment.ts.
 *
 * Public endpoints: Browse catalog, filter by type/era/manufacturer
 * Admin endpoints: CRUD operations for equipment and manufacturers
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { memoryConfig } from "~/lib/system/dev-memory-config";

export const smallArmsEquipmentQueryRouter = createTRPCRouter({
  // ===========================
  // PUBLIC ENDPOINTS - READ ONLY
  // ===========================

  /**
   * Get all equipment items with optional filtering
   * Memory optimization: Added pagination with default limits
   */
  getAllEquipment: publicProcedure
    .input(
      z.object({
        equipmentType: z.string().optional(),
        eraKey: z.string().optional(),
        manufacturerKey: z.string().optional(),
        category: z.string().optional(),
        isActive: z.boolean().optional(),
        includeManufacturer: z.boolean().default(true),
        includeEra: z.boolean().default(true),
        // Pagination for memory optimization
        limit: z.number().min(1).max(500).default(memoryConfig.query.defaultLimit),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.equipmentType && { equipmentType: input.equipmentType }),
        ...(input.eraKey && { eraKey: input.eraKey }),
        ...(input.manufacturerKey && { manufacturerKey: input.manufacturerKey }),
        ...(input.category && { category: input.category }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      };

      const [equipment, totalCount] = await Promise.all([
        ctx.db.smallArmsEquipment.findMany({
          where,
          include: {
            manufacturer: input.includeManufacturer,
            era: input.includeEra,
          },
          orderBy: [{ equipmentType: "asc" }, { category: "asc" }, { name: "asc" }],
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.smallArmsEquipment.count({ where }),
      ]);

      return {
        equipment,
        pagination: {
          total: totalCount,
          limit: input.limit,
          offset: input.offset,
          hasMore: input.offset + equipment.length < totalCount,
        },
      };
    }),

  /**
   * Get equipment statistics and counts
   */
  getStatistics: publicProcedure.query(async ({ ctx }) => {
    const [totalEquipment, equipmentByType, equipmentByEra, manufacturers, topUsed] =
      await Promise.all([
        // Total count
        ctx.db.smallArmsEquipment.count(),

        // By equipment type
        ctx.db.smallArmsEquipment.groupBy({
          by: ["equipmentType"],
          _count: true,
          where: { isActive: true },
        }),

        // By era
        ctx.db.smallArmsEquipment.groupBy({
          by: ["eraKey"],
          _count: true,
          where: { isActive: true },
        }),

        // Manufacturer count
        ctx.db.smallArmsManufacturer.count({ where: { isActive: true } }),

        // Most used equipment
        ctx.db.smallArmsEquipment.findMany({
          where: { isActive: true },
          orderBy: { usageCount: "desc" },
          take: 10,
          include: {
            manufacturer: true,
            era: true,
          },
        }),
      ]);

    return {
      totalEquipment,
      equipmentByType: equipmentByType.map((e) => ({
        type: e.equipmentType,
        count: e._count,
      })),
      equipmentByEra: equipmentByEra.map((e) => ({
        era: e.eraKey,
        count: e._count,
      })),
      totalManufacturers: manufacturers,
      topUsedEquipment: topUsed,
    };
  }),
});
