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

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from '@/server/api/trpc';

export const smallArmsEquipmentRouter = createTRPCRouter({
  // ===========================
  // PUBLIC ENDPOINTS - READ ONLY
  // ===========================

  /**
   * Get all equipment items with optional filtering
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

      const equipment = await ctx.db.smallArmsEquipment.findMany({
        where,
        include: {
          manufacturer: input.includeManufacturer,
          era: input.includeEra,
        },
        orderBy: [
          { equipmentType: 'asc' },
          { category: 'asc' },
          { name: 'asc' },
        ],
      });

      return equipment;
    }),

  /**
   * Get equipment by key
   */
  getByKey: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const equipment = await ctx.db.smallArmsEquipment.findUnique({
        where: { key: input.key },
        include: {
          manufacturer: true,
          era: true,
        },
      });

      if (!equipment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Equipment with key ${input.key} not found`,
        });
      }

      return equipment;
    }),

  /**
   * Get equipment statistics and counts
   */
  getStatistics: publicProcedure.query(async ({ ctx }) => {
    const [
      totalEquipment,
      equipmentByType,
      equipmentByEra,
      manufacturers,
      topUsed,
    ] = await Promise.all([
      // Total count
      ctx.db.smallArmsEquipment.count(),

      // By equipment type
      ctx.db.smallArmsEquipment.groupBy({
        by: ['equipmentType'],
        _count: true,
        where: { isActive: true },
      }),

      // By era
      ctx.db.smallArmsEquipment.groupBy({
        by: ['eraKey'],
        _count: true,
        where: { isActive: true },
      }),

      // Manufacturer count
      ctx.db.smallArmsManufacturer.count({ where: { isActive: true } }),

      // Most used equipment
      ctx.db.smallArmsEquipment.findMany({
        where: { isActive: true },
        orderBy: { usageCount: 'desc' },
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
      orderBy: { name: 'asc' },
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
      orderBy: { reliability: 'asc' },
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
            { name: { contains: input.query, mode: 'insensitive' } },
            { category: { contains: input.query, mode: 'insensitive' } },
            { caliber: { contains: input.query, mode: 'insensitive' } },
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
        sortBy: z.enum(['unitCost', 'maintenanceCost']).default('unitCost'),
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
        orderBy: { [input.sortBy]: 'asc' },
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

  /**
   * Create new equipment item
   */
  createEquipment: adminProcedure
    .input(
      z.object({
        key: z.string(),
        name: z.string(),
        manufacturerKey: z.string(),
        category: z.string(),
        equipmentType: z.string(),
        eraKey: z.string(),
        weight: z.number(),
        unitCost: z.number(),
        maintenanceCost: z.number(),
        imageUrl: z.string().nullable().optional(),
        caliber: z.string().nullable().optional(),
        capacity: z.number().nullable().optional(),
        effectiveRange: z.number().nullable().optional(),
        fireRate: z.number().nullable().optional(),
        protectionLevel: z.string().nullable().optional(),
        range: z.number().nullable().optional(),
        altitude: z.number().nullable().optional(),
        description: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const equipment = await ctx.db.smallArmsEquipment.create({
          data: {
            ...input,
            isActive: true,
            usageCount: 0,
          },
        });

        // Log admin action
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.session.userId,
            action: 'CREATE_EQUIPMENT',
            details: {
              equipmentKey: equipment.key,
              name: equipment.name,
            },
            success: true,
          },
        });

        return equipment;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create equipment',
          cause: error,
        });
      }
    }),

  /**
   * Update equipment item
   */
  updateEquipment: adminProcedure
    .input(
      z.object({
        key: z.string(),
        data: z.object({
          name: z.string().optional(),
          manufacturerKey: z.string().optional(),
          category: z.string().optional(),
          equipmentType: z.string().optional(),
          eraKey: z.string().optional(),
          weight: z.number().optional(),
          unitCost: z.number().optional(),
          maintenanceCost: z.number().optional(),
          imageUrl: z.string().nullable().optional(),
          caliber: z.string().nullable().optional(),
          capacity: z.number().nullable().optional(),
          effectiveRange: z.number().nullable().optional(),
          fireRate: z.number().nullable().optional(),
          protectionLevel: z.string().nullable().optional(),
          range: z.number().nullable().optional(),
          altitude: z.number().nullable().optional(),
          description: z.string().nullable().optional(),
          isActive: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const equipment = await ctx.db.smallArmsEquipment.update({
          where: { key: input.key },
          data: input.data,
        });

        // Log admin action
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.session.userId,
            action: 'UPDATE_EQUIPMENT',
            details: {
              equipmentKey: equipment.key,
              changes: input.data,
            },
            success: true,
          },
        });

        return equipment;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update equipment',
          cause: error,
        });
      }
    }),

  /**
   * Delete equipment item (soft delete by setting isActive to false)
   */
  deleteEquipment: adminProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const equipment = await ctx.db.smallArmsEquipment.update({
          where: { key: input.key },
          data: { isActive: false },
        });

        // Log admin action
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.session.userId,
            action: 'DELETE_EQUIPMENT',
            details: {
              equipmentKey: equipment.key,
              name: equipment.name,
            },
            success: true,
          },
        });

        return equipment;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete equipment',
          cause: error,
        });
      }
    }),

  /**
   * Create new manufacturer
   */
  createManufacturer: adminProcedure
    .input(
      z.object({
        key: z.string(),
        name: z.string(),
        country: z.string(),
        specialty: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const manufacturer = await ctx.db.smallArmsManufacturer.create({
          data: {
            key: input.key,
            name: input.name,
            country: input.country,
            specialty: JSON.stringify(input.specialty),
            isActive: true,
          },
        });

        // Log admin action
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.session.userId,
            action: 'CREATE_MANUFACTURER',
            details: {
              manufacturerKey: manufacturer.key,
              name: manufacturer.name,
            },
            success: true,
          },
        });

        return manufacturer;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create manufacturer',
          cause: error,
        });
      }
    }),

  /**
   * Update manufacturer
   */
  updateManufacturer: adminProcedure
    .input(
      z.object({
        key: z.string(),
        data: z.object({
          name: z.string().optional(),
          country: z.string().optional(),
          specialty: z.array(z.string()).optional(),
          isActive: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updateData: any = { ...input.data };
        if (input.data.specialty) {
          updateData.specialty = JSON.stringify(input.data.specialty);
        }

        const manufacturer = await ctx.db.smallArmsManufacturer.update({
          where: { key: input.key },
          data: updateData,
        });

        // Log admin action
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.session.userId,
            action: 'UPDATE_MANUFACTURER',
            details: {
              manufacturerKey: manufacturer.key,
              changes: input.data,
            },
            success: true,
          },
        });

        return manufacturer;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update manufacturer',
          cause: error,
        });
      }
    }),

  /**
   * Create or update weapon era
   */
  upsertEra: adminProcedure
    .input(
      z.object({
        key: z.string(),
        label: z.string(),
        years: z.string(),
        reliability: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const era = await ctx.db.weaponEra.upsert({
          where: { key: input.key },
          update: {
            label: input.label,
            years: input.years,
            reliability: input.reliability,
          },
          create: {
            key: input.key,
            label: input.label,
            years: input.years,
            reliability: input.reliability,
            isActive: true,
          },
        });

        // Log admin action
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.session.userId,
            action: 'UPSERT_ERA',
            details: {
              eraKey: era.key,
              label: era.label,
            },
            success: true,
          },
        });

        return era;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upsert era',
          cause: error,
        });
      }
    }),

  /**
   * Bulk import equipment from JSON
   */
  bulkImportEquipment: adminProcedure
    .input(
      z.object({
        equipment: z.array(
          z.object({
            key: z.string(),
            name: z.string(),
            manufacturerKey: z.string(),
            category: z.string(),
            equipmentType: z.string(),
            eraKey: z.string(),
            weight: z.number(),
            unitCost: z.number(),
            maintenanceCost: z.number(),
            imageUrl: z.string().nullable().optional(),
            caliber: z.string().nullable().optional(),
            capacity: z.number().nullable().optional(),
            effectiveRange: z.number().nullable().optional(),
            fireRate: z.number().nullable().optional(),
            protectionLevel: z.string().nullable().optional(),
            range: z.number().nullable().optional(),
            altitude: z.number().nullable().optional(),
            description: z.string().nullable().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const results = await ctx.db.$transaction(
          input.equipment.map((item) =>
            ctx.db.smallArmsEquipment.upsert({
              where: { key: item.key },
              update: item,
              create: {
                ...item,
                isActive: true,
                usageCount: 0,
              },
            })
          )
        );

        // Log admin action
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.session.userId,
            action: 'BULK_IMPORT_EQUIPMENT',
            details: {
              count: results.length,
              keys: results.map((r) => r.key),
            },
            success: true,
          },
        });

        return {
          success: true,
          imported: results.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to bulk import equipment',
          cause: error,
        });
      }
    }),
});