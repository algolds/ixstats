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
export const militaryEquipmentImagesRouter = createTRPCRouter({
  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================

  // ==========================================
  // ANALYTICS ENDPOINTS
  // ==========================================

  // ==========================================
  // IMAGE RESOLUTION ENDPOINTS
  // ==========================================

  /**
   * Public: Resolve equipment image from Wikimedia Commons
   * Returns cached URL if available, otherwise fetches from Wikimedia API
   */
  resolveEquipmentImage: publicProcedure
    .input(
      z.object({
        equipmentId: z.string().cuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { resolveEquipmentImage } =
          await import("~/server/services/wikimedia-equipment-image-resolver");

        const result = await resolveEquipmentImage(input.equipmentId);

        return {
          success: result.success,
          imageUrl: result.imageUrl,
          thumbnailUrl: result.thumbnailUrl,
          cached: result.cached,
          source: result.source,
          timestamp: result.timestamp,
          error: result.error,
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Failed to resolve equipment image:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to resolve equipment image",
          cause: error,
        });
      }
    }),

  /**
   * Admin: Batch resolve equipment images
   * Resolves images for multiple equipment items from Wikimedia Commons
   */
  batchResolveEquipmentImages: adminProcedure
    .input(
      z.object({
        equipmentIds: z.array(z.string().cuid()).min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { batchResolveImages } =
          await import("~/server/services/wikimedia-equipment-image-resolver");

        console.log(
          `[MILITARY_EQUIPMENT] Admin ${ctx.auth!.userId} batch resolving ${input.equipmentIds.length} images...`
        );

        const results = await batchResolveImages(input.equipmentIds);

        const successful = results.filter((r) => r.result.success).length;
        const failed = results.filter((r) => !r.result.success).length;

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth!.userId,
            action: "military_equipment.batch_resolve_images",
            details: JSON.stringify({
              total: results.length,
              successful,
              failed,
            }),
            success: true,
            timestamp: new Date(),
          },
        });

        return {
          success: true,
          total: results.length,
          successful,
          failed,
          results: results.map((r) => ({
            equipmentId: r.equipmentId,
            name: r.name,
            success: r.result.success,
            imageUrl: r.result.imageUrl,
            thumbnailUrl: r.result.thumbnailUrl,
            cached: r.result.cached,
            source: r.result.source,
            error: r.result.error,
          })),
        };
      } catch (error) {
        console.error("[MILITARY_EQUIPMENT] Failed to batch resolve images:", error);

        // Audit log failure
        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth!.userId,
              action: "military_equipment.batch_resolve_images",
              details: JSON.stringify({ equipmentIds: input.equipmentIds }),
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
          message: "Failed to batch resolve equipment images",
          cause: error,
        });
      }
    }),

  /**
   * Public: Get image cache statistics
   * Returns statistics about the equipment image cache
   */
  getImageCacheStats: publicProcedure.query(async ({ ctx }) => {
    try {
      const { getImageCacheStats } =
        await import("~/server/services/wikimedia-equipment-image-resolver");

      const stats = await getImageCacheStats();

      return stats;
    } catch (error) {
      console.error("[MILITARY_EQUIPMENT] Failed to get image cache stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve image cache statistics",
        cause: error,
      });
    }
  }),
});
