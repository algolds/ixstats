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
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
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
   * Get equipment by key
   */
  getByKey: publicProcedure.input(z.object({ key: z.string() })).query(async ({ ctx, input }) => {
    const equipment = await ctx.db.smallArmsEquipment.findUnique({
      where: { key: input.key },
      include: {
        manufacturer: true,
        era: true,
      },
    });

    if (!equipment) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Equipment with key ${input.key} not found`,
      });
    }

    return equipment;
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

  /**
   * Get all manufacturers
   */
  getAllManufacturers: publicProcedure.query(async ({ ctx }) => {
    const manufacturers = await ctx.db.smallArmsManufacturer.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { equipment: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return manufacturers;
  }),

  /**
   * Get all weapon eras
   */
  getAllEras: publicProcedure.query(async ({ ctx }) => {
    const eras = await ctx.db.weaponEra.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { equipment: true },
        },
      },
      orderBy: { reliability: "asc" },
    });

    return eras;
  }),

  /**
   * Search equipment by name or category
   */
  searchEquipment: publicProcedure
    .input(
      z.object({
        query: z.string().min(2),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const equipment = await ctx.db.smallArmsEquipment.findMany({
        where: {
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { category: { contains: input.query, mode: "insensitive" } },
            { caliber: { contains: input.query, mode: "insensitive" } },
          ],
          isActive: true,
        },
        include: {
          manufacturer: true,
          era: true,
        },
        take: input.limit,
      });

      return equipment;
    }),

  /**
   * Get equipment by cost range
   */
  getByPriceRange: publicProcedure
    .input(
      z.object({
        minCost: z.number().min(0).optional(),
        maxCost: z.number().min(0).optional(),
        sortBy: z.enum(["unitCost", "maintenanceCost"]).default("unitCost"),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        isActive: true,
        ...(input.minCost !== undefined && {
          unitCost: { gte: input.minCost },
        }),
        ...(input.maxCost !== undefined && {
          unitCost: { lte: input.maxCost },
        }),
      };

      const equipment = await ctx.db.smallArmsEquipment.findMany({
        where,
        include: {
          manufacturer: true,
          era: true,
        },
        orderBy: { [input.sortBy]: "asc" },
      });

      return equipment;
    }),

  // ===========================
  // PROTECTED ENDPOINTS - USER ACTIONS
  // ===========================

  /**
   * Increment usage count when equipment is assigned to a unit
   */
  incrementUsage: protectedProcedure
    .input(z.object({ equipmentKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const equipment = await ctx.db.smallArmsEquipment.update({
        where: { key: input.equipmentKey },
        data: {
          usageCount: { increment: 1 },
        },
      });

      return equipment;
    }),

  // ===========================
  // ADMIN ENDPOINTS - CRUD OPERATIONS
  // ===========================
});
