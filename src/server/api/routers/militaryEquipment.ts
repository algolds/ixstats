// src/server/api/routers/militaryEquipment.ts
// Phase 6: Military Equipment Catalog Migration

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";

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
export const militaryEquipmentRouter = createTRPCRouter({
  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  /**
   * Get catalog equipment with filters
   * Supports filtering by category, era, manufacturer, tech level, cost range, and active status
   */
  getCatalogEquipment: publicProcedure
    .input(
      z.object({
        category: z
          .enum(["infantry", "vehicle", "aircraft", "naval", "missile", "support"])
          .optional(),
        subcategory: z.string().optional(),
        era: z.enum(["wwi", "wwii", "cold-war", "modern", "future"]).optional(),
        manufacturerId: z.string().optional(),
        minTechLevel: z.number().int().min(1).max(10).optional(),
        maxTechLevel: z.number().int().min(1).max(10).optional(),
        minCost: z.number().int().min(0).optional(),
        maxCost: z.number().int().min(0).optional(),
        isActive: z.boolean().optional().default(true),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};

        if (input.category) where.category = input.category;
        if (input.subcategory) where.subcategory = input.subcategory;
        if (input.era) where.era = input.era;
        if (input.manufacturerId) where.manufacturerId = input.manufacturerId;
        if (input.isActive !== undefined) where.isActive = input.isActive;

        // Tech level range filter
        if (input.minTechLevel || input.maxTechLevel) {
          where.technologyTier = {};
          if (input.minTechLevel) where.technologyTier.gte = input.minTechLevel;
          if (input.maxTechLevel) where.technologyTier.lte = input.maxTechLevel;
        }

        // Cost range filter
        if (input.minCost || input.maxCost) {
          where.procurementCost = {};
          if (input.minCost) where.procurementCost.gte = input.minCost;
          if (input.maxCost) where.procurementCost.lte = input.maxCost;
        }

        const [equipment, total] = await Promise.all([
          ctx.db.militaryCatalogEquipment.findMany({
            where,
            include: {
              manufacturer: {
                select: {
                  id: true,
                  name: true,
                  country: true,
                  specialty: true,
                },
              },
            },
            orderBy: [{ category: "asc" }, { subcategory: "asc" }, { name: "asc" }],
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.militaryCatalogEquipment.count({ where }),
        ]);

        // Parse JSON fields
        const parsedEquipment = equipment.map((item) => ({
          ...item,
          specifications: item.specifications ? JSON.parse(item.specifications) : null,
          capabilities: item.capabilities ? JSON.parse(item.capabilities) : null,
          requirements: item.requirements ? JSON.parse(item.requirements) : null,
        }));

        return {
          equipment: parsedEquipment,
          total,
          hasMore: input.offset + equipment.length < total,
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Failed to get catalog equipment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve catalog equipment",
          cause: error,
        });
      }
    }),

  /**
   * Get single equipment item by ID with full details
   */
  getEquipmentById: publicProcedure
    .input(
      z.object({
        id: z.string().cuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const equipment = await ctx.db.militaryCatalogEquipment.findUnique({
          where: { id: input.id },
          include: {
            manufacturer: true,
          },
        });

        if (!equipment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Equipment not found",
          });
        }

        // Parse JSON fields
        return {
          ...equipment,
          specifications: equipment.specifications ? JSON.parse(equipment.specifications) : null,
          capabilities: equipment.capabilities ? JSON.parse(equipment.capabilities) : null,
          requirements: equipment.requirements ? JSON.parse(equipment.requirements) : null,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[MILITARY_EQUIPMENT] Failed to get equipment by ID:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve equipment",
          cause: error,
        });
      }
    }),

  /**
   * Get equipment grouped by category and subcategory
   */
  getEquipmentByCategory: publicProcedure
    .input(
      z.object({
        isActive: z.boolean().optional().default(true),
        era: z.enum(["wwi", "wwii", "cold-war", "modern", "future"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = { isActive: input.isActive };
        if (input.era) where.era = input.era;

        const equipment = await ctx.db.militaryCatalogEquipment.findMany({
          where,
          include: {
            manufacturer: {
              select: {
                id: true,
                name: true,
                country: true,
              },
            },
          },
          orderBy: [
            { category: "asc" },
            { subcategory: "asc" },
            { technologyTier: "desc" },
            { name: "asc" },
          ],
        });

        // Parse JSON and group by category and subcategory
        const grouped = equipment.reduce(
          (acc, item) => {
            if (!acc[item.category]) {
              acc[item.category] = {};
            }

            const subcategory = item.subcategory || "general";
            if (!acc[item.category][subcategory]) {
              acc[item.category][subcategory] = [];
            }

            acc[item.category][subcategory].push({
              ...item,
              specifications: item.specifications ? JSON.parse(item.specifications) : null,
              capabilities: item.capabilities ? JSON.parse(item.capabilities) : null,
              requirements: item.requirements ? JSON.parse(item.requirements) : null,
            });

            return acc;
          },
          {} as Record<string, Record<string, any[]>>
        );

        return grouped;
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Failed to get equipment by category:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve equipment by category",
          cause: error,
        });
      }
    }),

  /**
   * Get all manufacturers with optional specialty filter
   */
  getManufacturers: publicProcedure
    .input(
      z.object({
        specialty: z.string().optional(),
        isActive: z.boolean().optional().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = { isActive: input.isActive };
        if (input.specialty) where.specialty = { contains: input.specialty };

        const manufacturers = await ctx.db.militaryManufacturer.findMany({
          where,
          include: {
            equipment: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                category: true,
                technologyTier: true,
              },
            },
          },
          orderBy: { name: "asc" },
        });

        return manufacturers;
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Failed to get manufacturers:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve manufacturers",
          cause: error,
        });
      }
    }),

  /**
   * Increment equipment usage count (track procurement)
   */
  incrementEquipmentUsage: publicProcedure
    .input(
      z.object({
        equipmentId: z.string().cuid(),
        countryId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const equipment = await ctx.db.militaryCatalogEquipment.update({
          where: { id: input.equipmentId },
          data: {
            usageCount: { increment: 1 },
            updatedAt: new Date(),
          },
          select: {
            id: true,
            name: true,
            usageCount: true,
          },
        });

        return {
          success: true,
          equipment,
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Failed to increment usage:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to track equipment usage",
          cause: error,
        });
      }
    }),

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

        const equipment = await ctx.db.militaryCatalogEquipment.findMany({
          where,
          include: {
            manufacturer: true,
          },
          orderBy: [
            { category: "asc" },
            { era: "desc" },
            { technologyTier: "desc" },
            { name: "asc" },
          ],
        });

        // Parse JSON fields
        const parsedEquipment = equipment.map((item) => ({
          ...item,
          specifications: item.specifications ? JSON.parse(item.specifications) : null,
          capabilities: item.capabilities ? JSON.parse(item.capabilities) : null,
          requirements: item.requirements ? JSON.parse(item.requirements) : null,
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
        specifications: z.record(z.any()).optional(),
        capabilities: z.record(z.any()).optional(),
        requirements: z.record(z.any()).optional(),
        procurementCost: z.number().int().min(0),
        maintenanceCost: z.number().int().min(0),
        technologyTier: z.number().int().min(1).max(10),
        isActive: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify manufacturer exists
        const manufacturer = await ctx.db.militaryManufacturer.findUnique({
          where: { id: input.manufacturerId },
        });

        if (!manufacturer) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Manufacturer not found",
          });
        }

        const equipment = await ctx.db.militaryCatalogEquipment.create({
          data: {
            name: input.name,
            category: input.category,
            subcategory: input.subcategory,
            era: input.era,
            manufacturerId: input.manufacturerId,
            specifications: input.specifications ? JSON.stringify(input.specifications) : null,
            capabilities: input.capabilities ? JSON.stringify(input.capabilities) : null,
            requirements: input.requirements ? JSON.stringify(input.requirements) : null,
            procurementCost: input.procurementCost,
            maintenanceCost: input.maintenanceCost,
            technologyTier: input.technologyTier,
            isActive: input.isActive,
            usageCount: 0,
          },
          include: {
            manufacturer: true,
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
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
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth.userId} created equipment: ${equipment.name} (${equipment.id})`
        );

        return {
          success: true,
          equipment: {
            ...equipment,
            specifications: equipment.specifications ? JSON.parse(equipment.specifications) : null,
            capabilities: equipment.capabilities ? JSON.parse(equipment.capabilities) : null,
            requirements: equipment.requirements ? JSON.parse(equipment.requirements) : null,
          },
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Admin failed to create equipment:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth.userId,
              action: "military_equipment.create",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch(() => {});

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
        specifications: z.record(z.any()).optional(),
        capabilities: z.record(z.any()).optional(),
        requirements: z.record(z.any()).optional(),
        procurementCost: z.number().int().min(0).optional(),
        maintenanceCost: z.number().int().min(0).optional(),
        technologyTier: z.number().int().min(1).max(10).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify equipment exists
        const existing = await ctx.db.militaryCatalogEquipment.findUnique({
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
          const manufacturer = await ctx.db.militaryManufacturer.findUnique({
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
        if (input.manufacturerId !== undefined) updateData.manufacturerId = input.manufacturerId;
        if (input.specifications !== undefined)
          updateData.specifications = JSON.stringify(input.specifications);
        if (input.capabilities !== undefined)
          updateData.capabilities = JSON.stringify(input.capabilities);
        if (input.requirements !== undefined)
          updateData.requirements = JSON.stringify(input.requirements);
        if (input.procurementCost !== undefined) updateData.procurementCost = input.procurementCost;
        if (input.maintenanceCost !== undefined) updateData.maintenanceCost = input.maintenanceCost;
        if (input.technologyTier !== undefined) updateData.technologyTier = input.technologyTier;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        const equipment = await ctx.db.militaryCatalogEquipment.update({
          where: { id: input.id },
          data: updateData,
          include: {
            manufacturer: true,
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
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
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth.userId} updated equipment: ${equipment.name} (${equipment.id})`
        );

        return {
          success: true,
          equipment: {
            ...equipment,
            specifications: equipment.specifications ? JSON.parse(equipment.specifications) : null,
            capabilities: equipment.capabilities ? JSON.parse(equipment.capabilities) : null,
            requirements: equipment.requirements ? JSON.parse(equipment.requirements) : null,
          },
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Admin failed to update equipment:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth.userId,
              action: "military_equipment.update",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch(() => {});

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
        const equipment = await ctx.db.militaryCatalogEquipment.update({
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
            userId: ctx.auth.userId,
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
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth.userId} deleted equipment: ${equipment.name} (${equipment.id})`
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
              userId: ctx.auth.userId,
              action: "military_equipment.delete",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch(() => {});

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
        const result = await ctx.db.militaryCatalogEquipment.updateMany({
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
            userId: ctx.auth.userId,
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
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth.userId} bulk toggled ${result.count} equipment items to ${input.isActive ? "active" : "inactive"}`
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
              userId: ctx.auth.userId,
              action: "military_equipment.bulk_toggle",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch(() => {});

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk toggle equipment",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Create manufacturer
   */
  createManufacturer: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        country: z.string().min(1).max(100),
        specialty: z.string().optional(),
        founded: z.number().int().min(1800).max(2100).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const manufacturer = await ctx.db.militaryManufacturer.create({
          data: {
            name: input.name,
            country: input.country,
            specialty: input.specialty,
            founded: input.founded,
            description: input.description,
            isActive: input.isActive,
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
            action: "military_manufacturer.create",
            details: JSON.stringify({
              manufacturerId: manufacturer.id,
              name: manufacturer.name,
              country: manufacturer.country,
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth.userId} created manufacturer: ${manufacturer.name} (${manufacturer.id})`
        );

        return {
          success: true,
          manufacturer,
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Admin failed to create manufacturer:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth.userId,
              action: "military_manufacturer.create",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch(() => {});

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create manufacturer",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Update manufacturer
   */
  updateManufacturer: adminProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(200).optional(),
        country: z.string().min(1).max(100).optional(),
        specialty: z.string().optional(),
        founded: z.number().int().min(1800).max(2100).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify manufacturer exists
        const existing = await ctx.db.militaryManufacturer.findUnique({
          where: { id: input.id },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Manufacturer not found",
          });
        }

        const updateData: any = { updatedAt: new Date() };
        if (input.name !== undefined) updateData.name = input.name;
        if (input.country !== undefined) updateData.country = input.country;
        if (input.specialty !== undefined) updateData.specialty = input.specialty;
        if (input.founded !== undefined) updateData.founded = input.founded;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        const manufacturer = await ctx.db.militaryManufacturer.update({
          where: { id: input.id },
          data: updateData,
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
            action: "military_manufacturer.update",
            details: JSON.stringify({
              manufacturerId: manufacturer.id,
              name: manufacturer.name,
              changes: Object.keys(updateData),
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        console.log(
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth.userId} updated manufacturer: ${manufacturer.name} (${manufacturer.id})`
        );

        return {
          success: true,
          manufacturer,
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Admin failed to update manufacturer:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth.userId,
              action: "military_manufacturer.update",
              details: JSON.stringify({ input }),
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date(),
            },
          })
          .catch(() => {});

        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update manufacturer",
          cause: error,
        });
      }
    }),

  // ==========================================
  // ANALYTICS ENDPOINTS
  // ==========================================

  /**
   * Get equipment usage statistics
   */
  getEquipmentUsageStats: publicProcedure.query(async ({ ctx }) => {
    try {
      // Top 10 most procured equipment
      const topEquipment = await ctx.db.militaryCatalogEquipment.findMany({
        where: { isActive: true },
        orderBy: { usageCount: "desc" },
        take: 10,
        include: {
          manufacturer: {
            select: {
              name: true,
              country: true,
            },
          },
        },
      });

      // Usage by category
      const categoryStats = await ctx.db.militaryCatalogEquipment.groupBy({
        by: ["category"],
        where: { isActive: true },
        _sum: { usageCount: true },
        _count: { id: true },
      });

      // Usage by era
      const eraStats = await ctx.db.militaryCatalogEquipment.groupBy({
        by: ["era"],
        where: { isActive: true },
        _sum: { usageCount: true },
        _count: { id: true },
      });

      // Usage by manufacturer
      const manufacturerStats = await ctx.db.militaryManufacturer.findMany({
        where: { isActive: true },
        include: {
          equipment: {
            where: { isActive: true },
            select: {
              usageCount: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const manufacturerUsage = manufacturerStats
        .map((mfr) => ({
          manufacturerId: mfr.id,
          manufacturerName: mfr.name,
          country: mfr.country,
          totalUsage: mfr.equipment.reduce((sum, eq) => sum + eq.usageCount, 0),
          equipmentCount: mfr.equipment.length,
        }))
        .sort((a, b) => b.totalUsage - a.totalUsage);

      return {
        topEquipment: topEquipment.map((eq) => ({
          ...eq,
          specifications: eq.specifications ? JSON.parse(eq.specifications) : null,
          capabilities: eq.capabilities ? JSON.parse(eq.capabilities) : null,
          requirements: eq.requirements ? JSON.parse(eq.requirements) : null,
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

  /**
   * Get manufacturer statistics
   */
  getManufacturerStats: publicProcedure.query(async ({ ctx }) => {
    try {
      const manufacturers = await ctx.db.militaryManufacturer.findMany({
        where: { isActive: true },
        include: {
          equipment: {
            where: { isActive: true },
            select: {
              id: true,
              category: true,
              usageCount: true,
              technologyTier: true,
            },
          },
        },
      });

      const stats = manufacturers.map((mfr) => {
        const totalUsage = mfr.equipment.reduce((sum, eq) => sum + eq.usageCount, 0);
        const avgTechLevel =
          mfr.equipment.length > 0
            ? mfr.equipment.reduce((sum, eq) => sum + eq.technologyTier, 0) / mfr.equipment.length
            : 0;

        // Category distribution
        const categoryDistribution = mfr.equipment.reduce(
          (acc, eq) => {
            acc[eq.category] = (acc[eq.category] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        return {
          id: mfr.id,
          name: mfr.name,
          country: mfr.country,
          specialty: mfr.specialty,
          equipmentCount: mfr.equipment.length,
          totalUsage,
          avgTechLevel: Math.round(avgTechLevel * 10) / 10,
          categoryDistribution,
          marketShare: 0, // Will be calculated after
        };
      });

      // Calculate market share
      const totalMarketUsage = stats.reduce((sum, s) => sum + s.totalUsage, 0);
      stats.forEach((s) => {
        s.marketShare =
          totalMarketUsage > 0 ? Math.round((s.totalUsage / totalMarketUsage) * 1000) / 10 : 0;
      });

      // Sort by total usage
      stats.sort((a, b) => b.totalUsage - a.totalUsage);

      return {
        manufacturers: stats,
        totalManufacturers: stats.length,
        totalEquipment: stats.reduce((sum, s) => sum + s.equipmentCount, 0),
        totalUsage: totalMarketUsage,
      };
    } catch (error) {
      console.error("[MILITARY_EQUIPMENT] Failed to get manufacturer stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve manufacturer statistics",
        cause: error,
      });
    }
  }),
});
