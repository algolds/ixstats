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

export const smallArmsEquipmentReferenceAdminRouter = createTRPCRouter({
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

        // Log admin action (user context not available, skip audit log)
        // await ctx.db.auditLog.create({
        //   data: {
        //     userId: ctx.auth.userId,
        //     action: "CREATE_MANUFACTURER",
        //     details: JSON.stringify({
        //       manufacturerKey: manufacturer.key,
        //       name: manufacturer.name,
        //     }),
        //     success: true,
        //     timestamp: new Date(),
        //   },
        // });

        return manufacturer;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create manufacturer",
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

        // Log admin action (user context not available, skip audit log)
        // await ctx.db.auditLog.create({
        //   data: {
        //     userId: ctx.auth.userId,
        //     action: "UPDATE_MANUFACTURER",
        //     details: JSON.stringify({
        //       manufacturerKey: manufacturer.key,
        //       changes: input.data,
        //     }),
        //     success: true,
        //     timestamp: new Date(),
        //   },
        // });

        return manufacturer;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update manufacturer",
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

        // Log admin action (user context not available, skip audit log)
        // await ctx.db.auditLog.create({
        //   data: {
        //     userId: ctx.auth.userId,
        //     action: "UPSERT_ERA",
        //     details: JSON.stringify({
        //       eraKey: era.key,
        //       label: era.label,
        //     }),
        //     success: true,
        //     timestamp: new Date(),
        //   },
        // });

        return era;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upsert era",
          cause: error,
        });
      }
    }),
});
