// src/server/api/routers/militaryEquipment.ts
// Phase 6: Military Equipment Catalog Migration

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import { createTRPCRouter, adminProcedure, publicProcedure } from "~/server/api/trpc";
import { buildEquipmentCatalogSeed, buildManufacturerSeed } from "~/lib/military/catalog-seed";
import {
  builtinEquipmentPresets,
  builtinManufacturers,
  catalogRowToPreset,
} from "~/lib/military/player-catalog";

/**
 * Military Equipment Catalog Router
 *
 * The MilitaryEquipmentCatalog table is the source of truth for the equipment templates
 * players pick from in the Defense asset dialog. The built-in data in ~/lib/military seeds
 * an empty catalog on first read and is the fallback when the table can't be read.
 *
 * Public endpoints: player catalog (active items + manufacturers)
 * Admin endpoints: CRUD operations with audit logging
 */

/** Catalog categories and eras; must match CATEGORIES and ERAS in ~/lib/military/catalog-utils. */
const CATALOG_CATEGORIES = ["aircraft", "naval", "vehicle", "missile", "support"] as const;
const CATALOG_ERAS = ["COLD_WAR", "MODERN", "CONTEMPORARY", "ADVANCED", "NEXT_GEN"] as const;

const equipmentFields = {
  name: z.string().trim().min(1).max(200),
  /** DefenseManufacturer key (or name). */
  manufacturer: z.string().trim().min(1).max(200),
  category: z.enum(CATALOG_CATEGORIES),
  subcategory: z.string().max(100).optional(),
  era: z.enum(CATALOG_ERAS),
  specifications: z.record(z.string(), z.any()).optional(),
  capabilities: z.record(z.string(), z.any()).optional(),
  acquisitionCost: z.number().min(0),
  maintenanceCost: z.number().min(0),
  technologyLevel: z.number().int().min(0).max(100),
  crewRequirement: z.number().int().min(0),
  maintenanceHours: z.number().int().min(0).optional(),
  /** An empty string clears the image. */
  imageUrl: z.union([z.string().url().max(2000), z.literal("")]).optional(),
  description: z.string().max(5000).optional(),
  historicalContext: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
};

type Db = PrismaClient;

/**
 * Seed an empty catalog (and manufacturer list) from the built-in data. `db:seed` doesn't run
 * in production, so this is what first fills the tables there.
 */
async function ensureCatalogSeeded(db: Db) {
  const [equipmentCount, manufacturerCount] = await Promise.all([
    db.militaryEquipmentCatalog.count(),
    db.defenseManufacturer.count(),
  ]);
  if (manufacturerCount === 0) {
    await db.defenseManufacturer.createMany({
      data: buildManufacturerSeed(),
      skipDuplicates: true,
    });
  }
  if (equipmentCount === 0) {
    const rows = buildEquipmentCatalogSeed();
    await db.militaryEquipmentCatalog.createMany({ data: rows, skipDuplicates: true });
    console.info(`[MILITARY_EQUIPMENT] Seeded empty catalog with ${rows.length} built-in items`);
  }
}

/** Resolve a manufacturer key or name to its key, or throw BAD_REQUEST. */
async function resolveManufacturerKey(db: Db, manufacturer: string): Promise<string> {
  const match = await db.defenseManufacturer.findFirst({
    where: { OR: [{ key: manufacturer }, { name: manufacturer }] },
    select: { key: true },
  });
  if (!match) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Manufacturer not found" });
  }
  return match.key;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const militaryEquipmentCatalogRouter = createTRPCRouter({
  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  /**
   * Active catalog items as player equipment templates, plus the manufacturer list.
   * Falls back to the built-in data if the catalog can't be read.
   */
  getPlayerCatalog: publicProcedure.query(async ({ ctx }) => {
    try {
      await ensureCatalogSeeded(ctx.db);
      const [rows, manufacturers] = await Promise.all([
        ctx.db.militaryEquipmentCatalog.findMany({
          where: { isActive: true },
          orderBy: [{ category: "asc" }, { name: "asc" }],
        }),
        ctx.db.defenseManufacturer.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { key: true, name: true, country: true },
        }),
      ]);
      return {
        equipment: rows.map(catalogRowToPreset),
        manufacturers,
        source: "catalog" as const,
      };
    } catch (error) {
      console.error("[MILITARY_EQUIPMENT] Failed to read catalog, using built-in data:", error);
      return {
        equipment: builtinEquipmentPresets(),
        manufacturers: builtinManufacturers(),
        source: "builtin" as const,
      };
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
        category: z.enum(CATALOG_CATEGORIES).optional(),
        era: z.enum(CATALOG_ERAS).optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        await ensureCatalogSeeded(ctx.db);

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
    .input(z.object({ key: z.string().trim().max(200).optional(), ...equipmentFields }))
    .mutation(async ({ ctx, input }) => {
      try {
        const manufacturer = await resolveManufacturerKey(ctx.db, input.manufacturer);

        const equipment = await ctx.db.militaryEquipmentCatalog.create({
          data: {
            key: input.key || `${input.category}_${input.name.toLowerCase().replace(/\s+/g, "_")}`,
            name: input.name,
            manufacturer,
            category: input.category,
            subcategory: input.subcategory || null,
            era: input.era,
            specifications: JSON.stringify(input.specifications ?? {}),
            capabilities: JSON.stringify(input.capabilities ?? {}),
            acquisitionCost: input.acquisitionCost,
            maintenanceCost: input.maintenanceCost,
            technologyLevel: input.technologyLevel,
            crewRequirement: input.crewRequirement,
            maintenanceHours: input.maintenanceHours ?? null,
            imageUrl: input.imageUrl || null,
            description: input.description || null,
            historicalContext: input.historicalContext || null,
            isActive: input.isActive ?? true,
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
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An equipment item with this key already exists",
          });
        }
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
    .input(z.object({ id: z.string().cuid(), ...z.object(equipmentFields).partial().shape }))
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

        const updateData: Prisma.MilitaryEquipmentCatalogUpdateInput = { updatedAt: new Date() };
        if (input.name !== undefined) updateData.name = input.name;
        if (input.manufacturer !== undefined) {
          updateData.manufacturer = await resolveManufacturerKey(ctx.db, input.manufacturer);
        }
        if (input.category !== undefined) updateData.category = input.category;
        if (input.subcategory !== undefined) updateData.subcategory = input.subcategory || null;
        if (input.era !== undefined) updateData.era = input.era;
        if (input.specifications !== undefined)
          updateData.specifications = JSON.stringify(input.specifications);
        if (input.capabilities !== undefined)
          updateData.capabilities = JSON.stringify(input.capabilities);
        if (input.acquisitionCost !== undefined) updateData.acquisitionCost = input.acquisitionCost;
        if (input.maintenanceCost !== undefined) updateData.maintenanceCost = input.maintenanceCost;
        if (input.technologyLevel !== undefined) updateData.technologyLevel = input.technologyLevel;
        if (input.crewRequirement !== undefined) updateData.crewRequirement = input.crewRequirement;
        if (input.maintenanceHours !== undefined)
          updateData.maintenanceHours = input.maintenanceHours;
        if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl || null;
        if (input.description !== undefined) updateData.description = input.description || null;
        if (input.historicalContext !== undefined)
          updateData.historicalContext = input.historicalContext || null;
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
