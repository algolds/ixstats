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
export const militaryEquipmentManufacturersRouter = createTRPCRouter({
  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

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

        const manufacturers = await ctx.db.defenseManufacturer.findMany({
          where,
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

  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================

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
        const manufacturer = await ctx.db.defenseManufacturer.create({
          data: {
            key: input.name.toLowerCase().replace(/\s+/g, "-"),
            name: input.name,
            country: input.country,
            specialty: input.specialty || "",
            isActive: input.isActive ?? true,
          },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
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
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth!.userId} created manufacturer: ${manufacturer.name} (${manufacturer.id})`
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
              userId: ctx.auth!.userId,
              action: "military_manufacturer.create",
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
        const existing = await ctx.db.defenseManufacturer.findUnique({
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

        const manufacturer = await ctx.db.defenseManufacturer.update({
          where: { id: input.id },
          data: updateData,
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
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
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth!.userId} updated manufacturer: ${manufacturer.name} (${manufacturer.id})`
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
              userId: ctx.auth!.userId,
              action: "military_manufacturer.update",
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
          message: "Failed to update manufacturer",
          cause: error,
        });
      }
    }),

  // ==========================================
  // ANALYTICS ENDPOINTS
  // ==========================================

  /**
   * Get manufacturer statistics
   */
  getManufacturerStats: publicProcedure.query(async ({ ctx }) => {
    try {
      // Get all manufacturers
      const manufacturers = await ctx.db.defenseManufacturer.findMany({
        where: { isActive: true },
      });

      // Get all equipment
      const allEquipment = await ctx.db.militaryEquipmentCatalog.findMany({
        where: { isActive: true },
        select: {
          manufacturer: true,
          category: true,
          usageCount: true,
          technologyLevel: true,
        },
      });

      const stats = manufacturers.map((mfr) => {
        // Filter equipment for this manufacturer
        const mfrEquipment = allEquipment.filter((eq) => eq.manufacturer === mfr.name);

        const totalUsage = mfrEquipment.reduce((sum, eq) => sum + eq.usageCount, 0);
        const avgTechLevel =
          mfrEquipment.length > 0
            ? mfrEquipment.reduce((sum, eq) => sum + eq.technologyLevel, 0) / mfrEquipment.length
            : 0;

        // Category distribution
        const categoryDistribution = mfrEquipment.reduce(
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
          equipmentCount: mfrEquipment.length,
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

  // ==========================================
  // IMAGE RESOLUTION ENDPOINTS
  // ==========================================
});
