// src/server/api/routers/militaryEquipment.ts
// Phase 6: Military Equipment Catalog Migration

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

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
export const militaryEquipmentCatalogRouter = createTRPCRouter({
  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================

  /**
   * Admin: Get all catalog equipment including inactive items
   */
  getAllCatalogEquipment: adminProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional().default(true),
        category: z
          .enum(["infantry", "vehicle", "aircraft", "naval", "missile", "support"])
          .optional(),
        era: z.enum(["wwi", "wwii", "cold-war", "modern", "future"]).optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};

        if (!input.includeInactive) where.isActive = true;
        if (input.category) where.category = input.category;
        if (input.era) where.era = input.era;
        if (input.search) {
          where.OR = [
            { name: { contains: input.search, mode: "insensitive" } },
            { subcategory: { contains: input.search, mode: "insensitive" } },
          ];
        }

        const equipment = await ctx.db.militaryEquipmentCatalog.findMany({
          where,
          orderBy: [
            { category: "asc" },
            { era: "desc" },
            { technologyLevel: "desc" },
            { name: "asc" },
          ],
        });

        // Parse JSON fields
        const parsedEquipment = equipment.map((item) => ({
          ...item,
          specifications: item.specifications ? JSON.parse(item.specifications) : null,
          capabilities: item.capabilities ? JSON.parse(item.capabilities) : null,
        }));

        return parsedEquipment;
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Admin failed to get all equipment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve all equipment",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Create new catalog equipment
   */
  createCatalogEquipment: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        category: z.enum(["infantry", "vehicle", "aircraft", "naval", "missile", "support"]),
        subcategory: z.string().optional(),
        era: z.enum(["wwi", "wwii", "cold-war", "modern", "future"]),
        manufacturerId: z.string().cuid(),
        specifications: z.record(z.string(), z.any()).optional(),
        capabilities: z.record(z.string(), z.any()).optional(),
        requirements: z.record(z.string(), z.any()).optional(),
        procurementCost: z.number().int().min(0),
        maintenanceCost: z.number().int().min(0),
        technologyTier: z.number().int().min(1).max(10),
        isActive: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify manufacturer exists
        const manufacturer = await ctx.db.defenseManufacturer.findUnique({
          where: { id: input.manufacturerId },
        });

        if (!manufacturer) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Manufacturer not found",
          });
        }

        const equipment = await ctx.db.militaryEquipmentCatalog.create({
          data: {
            key: `${input.category}_${input.name.toLowerCase().replace(/\s+/g, "_")}`,
            name: input.name,
            manufacturer: manufacturer.name,
            category: input.category,
            subcategory: input.subcategory,
            era: input.era,
            specifications: input.specifications ? JSON.stringify(input.specifications) : "",
            capabilities: input.capabilities ? JSON.stringify(input.capabilities) : "",
            acquisitionCost: input.procurementCost,
            maintenanceCost: input.maintenanceCost,
            technologyLevel: input.technologyTier,
            crewRequirement: 1,
            isActive: input.isActive,
            usageCount: 0,
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "military_equipment.create",
            details: JSON.stringify({
              equipmentId: equipment.id,
              name: equipment.name,
              category: equipment.category,
              era: equipment.era,
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth!.userId} created equipment: ${equipment.name} (${equipment.id})`
        );

        return {
          success: true,
          equipment: {
            ...equipment,
            specifications: equipment.specifications ? JSON.parse(equipment.specifications) : null,
            capabilities: equipment.capabilities ? JSON.parse(equipment.capabilities) : null,
          },
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Admin failed to create equipment:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "military_equipment.create",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch((err: unknown) => {
            console.error("[MilitaryEquipment] Background op failed:", (err as Error).message);
          });

        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create equipment",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Update existing catalog equipment
   */
  updateCatalogEquipment: adminProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(200).optional(),
        category: z
          .enum(["infantry", "vehicle", "aircraft", "naval", "missile", "support"])
          .optional(),
        subcategory: z.string().optional(),
        era: z.enum(["wwi", "wwii", "cold-war", "modern", "future"]).optional(),
        manufacturerId: z.string().cuid().optional(),
        specifications: z.record(z.string(), z.any()).optional(),
        capabilities: z.record(z.string(), z.any()).optional(),
        requirements: z.record(z.string(), z.any()).optional(),
        procurementCost: z.number().int().min(0).optional(),
        maintenanceCost: z.number().int().min(0).optional(),
        technologyTier: z.number().int().min(1).max(10).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify equipment exists
        const existing = await ctx.db.militaryEquipmentCatalog.findUnique({
          where: { id: input.id },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Equipment not found",
          });
        }

        // If changing manufacturer, verify it exists
        if (input.manufacturerId) {
          const manufacturer = await ctx.db.defenseManufacturer.findUnique({
            where: { id: input.manufacturerId },
          });

          if (!manufacturer) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Manufacturer not found",
            });
          }
        }

        const updateData: any = { updatedAt: new Date() };
        if (input.name !== undefined) updateData.name = input.name;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.subcategory !== undefined) updateData.subcategory = input.subcategory;
        if (input.era !== undefined) updateData.era = input.era;
        if (input.manufacturerId !== undefined) {
          // Look up manufacturer name
          const manufacturer = await ctx.db.defenseManufacturer.findUnique({
            where: { id: input.manufacturerId },
          });
          if (manufacturer) {
            updateData.manufacturer = manufacturer.name;
          }
        }
        if (input.specifications !== undefined)
          updateData.specifications = JSON.stringify(input.specifications);
        if (input.capabilities !== undefined)
          updateData.capabilities = JSON.stringify(input.capabilities);
        if (input.procurementCost !== undefined) updateData.acquisitionCost = input.procurementCost;
        if (input.maintenanceCost !== undefined) updateData.maintenanceCost = input.maintenanceCost;
        if (input.technologyTier !== undefined) updateData.technologyLevel = input.technologyTier;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        const equipment = await ctx.db.militaryEquipmentCatalog.update({
          where: { id: input.id },
          data: updateData,
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "military_equipment.update",
            details: JSON.stringify({
              equipmentId: equipment.id,
              name: equipment.name,
              changes: Object.keys(updateData),
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth!.userId} updated equipment: ${equipment.name} (${equipment.id})`
        );

        return {
          success: true,
          equipment: {
            ...equipment,
            specifications: equipment.specifications ? JSON.parse(equipment.specifications) : null,
            capabilities: equipment.capabilities ? JSON.parse(equipment.capabilities) : null,
          },
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Admin failed to update equipment:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "military_equipment.update",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch((err: unknown) => {
            console.error("[MilitaryEquipment] Background op failed:", (err as Error).message);
          });

        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update equipment",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Delete equipment (soft delete - sets isActive=false)
   */
  deleteCatalogEquipment: adminProcedure
    .input(
      z.object({
        id: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const equipment = await ctx.db.militaryEquipmentCatalog.update({
          where: { id: input.id },
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
          select: {
            id: true,
            name: true,
            category: true,
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "military_equipment.delete",
            details: JSON.stringify({
              equipmentId: equipment.id,
              name: equipment.name,
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth!.userId} deleted equipment: ${equipment.name} (${equipment.id})`
        );

        return {
          success: true,
          equipment,
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Admin failed to delete equipment:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "military_equipment.delete",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch((err: unknown) => {
            console.error("[MilitaryEquipment] Background op failed:", (err as Error).message);
          });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete equipment",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Bulk toggle equipment active status
   */
  bulkToggleEquipment: adminProcedure
    .input(
      z.object({
        equipmentIds: z.array(z.string().cuid()).min(1),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.militaryEquipmentCatalog.updateMany({
          where: {
            id: { in: input.equipmentIds },
          },
          data: {
            isActive: input.isActive,
            updatedAt: new Date(),
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "military_equipment.bulk_toggle",
            details: JSON.stringify({
              count: result.count,
              equipmentIds: input.equipmentIds,
              isActive: input.isActive,
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth!.userId} bulk toggled ${result.count} equipment items to ${input.isActive ? "active" : "inactive"}`
        );

        return {
          success: true,
          count: result.count,
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Admin failed to bulk toggle equipment:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "military_equipment.bulk_toggle",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch((err: unknown) => {
            console.error("[MilitaryEquipment] Background op failed:", (err as Error).message);
          });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk toggle equipment",
          cause: error,
        });
      }
    }),
});
