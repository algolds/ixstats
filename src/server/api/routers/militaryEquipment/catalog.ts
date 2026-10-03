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

/**
 * Seed an empty catalog (and manufacturer list) from the built-in data. `db:seed` doesn't run
 * in production, so this is what first fills the tables there.
 */
async function ensureCatalogSeeded(db: PrismaClient) {
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
async function resolveManufacturerKey(db: PrismaClient, manufacturer: string): Promise<string> {
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

/** Admin context the audited mutations run in. */
type AdminCtx = { db: PrismaClient; auth?: { userId: string | null } | null };

const parseJsonColumns = <T extends { specifications: string | null; capabilities: string | null }>(
  item: T
) => ({
  ...item,
  specifications: item.specifications ? JSON.parse(item.specifications) : null,
  capabilities: item.capabilities ? JSON.parse(item.capabilities) : null,
});

/** Records a successful admin action in the audit log and the server log. */
async function auditSuccess(ctx: AdminCtx, action: string, details: object, logLine: string) {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.auth!.userId,
      action: `military_equipment.${action}`,
      details: JSON.stringify(details),
      success: true,
      timestamp: new Date(),
    },
  });
  console.log(`[MILITARY_EQUIPMENT] Admin ${ctx.auth!.userId} ${logLine}`);
}

/**
 * Runs an admin mutation; on failure it is logged, recorded in the audit log, and surfaced as
 * `failureMessage` (INTERNAL_SERVER_ERROR) unless `mapError` or `passThroughTrpc` says otherwise.
 */
async function auditedMutation<T>(
  ctx: AdminCtx,
  opts: {
    action: string;
    label: string;
    input: object;
    failureMessage: string;
    passThroughTrpc?: boolean;
    mapError?: (error: unknown) => TRPCError | null;
  },
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[MILITARY_EQUIPMENT] Admin failed to ${opts.label}:`, error);
    await ctx.db.auditLog
      .create({
        data: {
          userId: ctx.auth!.userId,
          action: `military_equipment.${opts.action}`,
          details: JSON.stringify({ input: opts.input }),
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        },
      })
      .catch((err: unknown) => {
        console.error("[MilitaryEquipment] Background op failed:", (err as Error).message);
      });

    if (opts.passThroughTrpc && error instanceof TRPCError) throw error;
    throw (
      opts.mapError?.(error) ??
      new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: opts.failureMessage,
        cause: error,
      })
    );
  }
}

/** Update fields that store an empty string as null. */
const NULLABLE_TEXT_FIELDS = [
  "subcategory",
  "imageUrl",
  "description",
  "historicalContext",
] as const;
const PLAIN_FIELDS = [
  "name",
  "category",
  "era",
  "acquisitionCost",
  "maintenanceCost",
  "technologyLevel",
  "crewRequirement",
  "maintenanceHours",
  "isActive",
] as const;

export const militaryEquipmentCatalogRouter = createTRPCRouter({
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

        const equipment = await ctx.db.militaryEquipmentCatalog.findMany({
          where: {
            ...(input.includeInactive ? {} : { isActive: true }),
            ...(input.category ? { category: input.category } : {}),
            ...(input.era ? { era: input.era } : {}),
            ...(input.search
              ? {
                  OR: [
                    { name: { contains: input.search, mode: "insensitive" } },
                    { subcategory: { contains: input.search, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: [
            { category: "asc" },
            { era: "desc" },
            { technologyLevel: "desc" },
            { name: "asc" },
          ],
        });
        return equipment.map(parseJsonColumns);
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
    .mutation(({ ctx, input }) =>
      auditedMutation(
        ctx,
        {
          action: "create",
          label: "create equipment",
          input,
          failureMessage: "Failed to create equipment",
          passThroughTrpc: true,
          mapError: (error) =>
            isUniqueViolation(error)
              ? new TRPCError({
                  code: "CONFLICT",
                  message: "An equipment item with this key already exists",
                })
              : null,
        },
        async () => {
          const manufacturer = await resolveManufacturerKey(ctx.db, input.manufacturer);

          const equipment = await ctx.db.militaryEquipmentCatalog.create({
            data: {
              key:
                input.key || `${input.category}_${input.name.toLowerCase().replace(/\s+/g, "_")}`,
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

          await auditSuccess(
            ctx,
            "create",
            {
              equipmentId: equipment.id,
              name: equipment.name,
              category: equipment.category,
              era: equipment.era,
            },
            `created equipment: ${equipment.name} (${equipment.id})`
          );
          return { success: true, equipment: parseJsonColumns(equipment) };
        }
      )
    ),

  /**
   * Admin: Update existing catalog equipment
   */
  updateCatalogEquipment: adminProcedure
    .input(z.object({ id: z.string().cuid(), ...z.object(equipmentFields).partial().shape }))
    .mutation(({ ctx, input }) =>
      auditedMutation(
        ctx,
        {
          action: "update",
          label: "update equipment",
          input,
          failureMessage: "Failed to update equipment",
          passThroughTrpc: true,
        },
        async () => {
          const existing = await ctx.db.militaryEquipmentCatalog.findUnique({
            where: { id: input.id },
          });
          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found" });
          }

          const updateData: Prisma.MilitaryEquipmentCatalogUpdateInput = { updatedAt: new Date() };
          for (const field of PLAIN_FIELDS) {
            if (input[field] !== undefined) Object.assign(updateData, { [field]: input[field] });
          }
          for (const field of NULLABLE_TEXT_FIELDS) {
            if (input[field] !== undefined) updateData[field] = input[field] || null;
          }
          if (input.manufacturer !== undefined) {
            updateData.manufacturer = await resolveManufacturerKey(ctx.db, input.manufacturer);
          }
          if (input.specifications !== undefined) {
            updateData.specifications = JSON.stringify(input.specifications);
          }
          if (input.capabilities !== undefined) {
            updateData.capabilities = JSON.stringify(input.capabilities);
          }

          const equipment = await ctx.db.militaryEquipmentCatalog.update({
            where: { id: input.id },
            data: updateData,
          });

          await auditSuccess(
            ctx,
            "update",
            { equipmentId: equipment.id, name: equipment.name, changes: Object.keys(updateData) },
            `updated equipment: ${equipment.name} (${equipment.id})`
          );
          return { success: true, equipment: parseJsonColumns(equipment) };
        }
      )
    ),

  /**
   * Admin: Delete equipment (soft delete - sets isActive=false)
   */
  deleteCatalogEquipment: adminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      auditedMutation(
        ctx,
        {
          action: "delete",
          label: "delete equipment",
          input,
          failureMessage: "Failed to delete equipment",
        },
        async () => {
          const equipment = await ctx.db.militaryEquipmentCatalog.update({
            where: { id: input.id },
            data: { isActive: false, updatedAt: new Date() },
            select: { id: true, name: true, category: true },
          });

          await auditSuccess(
            ctx,
            "delete",
            { equipmentId: equipment.id, name: equipment.name },
            `deleted equipment: ${equipment.name} (${equipment.id})`
          );
          return { success: true, equipment };
        }
      )
    ),

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
    .mutation(({ ctx, input }) =>
      auditedMutation(
        ctx,
        {
          action: "bulk_toggle",
          label: "bulk toggle equipment",
          input,
          failureMessage: "Failed to bulk toggle equipment",
        },
        async () => {
          const result = await ctx.db.militaryEquipmentCatalog.updateMany({
            where: { id: { in: input.equipmentIds } },
            data: { isActive: input.isActive, updatedAt: new Date() },
          });

          await auditSuccess(
            ctx,
            "bulk_toggle",
            { count: result.count, equipmentIds: input.equipmentIds, isActive: input.isActive },
            `bulk toggled ${result.count} equipment items to ${input.isActive ? "active" : "inactive"}`
          );
          return { success: true, count: result.count };
        }
      )
    ),
});
