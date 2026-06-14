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
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export const smallArmsEquipmentEquipmentAdminRouter = createTRPCRouter({
  // ===========================
  // PUBLIC ENDPOINTS - READ ONLY
  // ===========================

  // ===========================
  // PROTECTED ENDPOINTS - USER ACTIONS
  // ===========================

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

        // Log admin action (user context not available, skip audit log)
        // await ctx.db.auditLog.create({
        //   data: {
        //     userId: ctx.auth.userId,
        //     action: "CREATE_EQUIPMENT",
        //     details: JSON.stringify({
        //       equipmentKey: equipment.key,
        //       name: equipment.name,
        //     }),
        //     success: true,
        //     timestamp: new Date(),
        //   },
        // });

        return equipment;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create equipment",
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

        // Log admin action (user context not available, skip audit log)
        // await ctx.db.auditLog.create({
        //   data: {
        //     userId: ctx.auth.userId,
        //     action: "UPDATE_EQUIPMENT",
        //     details: JSON.stringify({
        //       equipmentKey: equipment.key,
        //       changes: input.data,
        //     }),
        //     success: true,
        //     timestamp: new Date(),
        //   },
        // });

        return equipment;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update equipment",
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

        // Log admin action (user context not available, skip audit log)
        // await ctx.db.auditLog.create({
        //   data: {
        //     userId: ctx.auth.userId,
        //     action: "DELETE_EQUIPMENT",
        //     details: JSON.stringify({
        //       equipmentKey: equipment.key,
        //       name: equipment.name,
        //     }),
        //     success: true,
        //     timestamp: new Date(),
        //   },
        // });

        return equipment;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete equipment",
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

        // Log admin action (user context not available, skip audit log)
        // await ctx.db.auditLog.create({
        //   data: {
        //     userId: ctx.auth.userId,
        //     action: "BULK_IMPORT_EQUIPMENT",
        //     details: JSON.stringify({
        //       count: results.length,
        //       keys: results.map((r) => r.key),
        //     }),
        //     success: true,
        //     timestamp: new Date(),
        //   },
        // });

        return {
          success: true,
          imported: results.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk import equipment",
          cause: error,
        });
      }
    }),
});
