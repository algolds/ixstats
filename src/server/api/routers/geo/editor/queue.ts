/**
 * Geographic Map Router
 *
 * tRPC router for the IxEarth world map system.
 * Handles map layer data, country geometry, spatial queries,
 * and country-feature linking.
 *
 * Data source: PostgreSQL + PostGIS (map_layers table),
 * with file-based fallback for initial load.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  // eslint-disable-next-line unused-imports/no-unused-imports
  publicProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  rateLimitedPublicProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  cachedPublicProcedure,
  adminProcedure,
  countryOwnerProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// eslint-disable-next-line unused-imports/no-unused-imports
import { invalidateCache } from "~/lib/cache";
// eslint-disable-next-line unused-imports/no-unused-imports
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { clearLayerCache } from "../core";
import { ActivityGenerator } from "~/lib/activity";
// eslint-disable-next-line unused-imports/no-unused-imports
import { normalizeFlagUrl } from "~/lib/flags/normalization";
// eslint-disable-next-line unused-imports/no-unused-imports
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoEditorQueueRouter = createTRPCRouter({
  /**
   * Admin: Get the edit queue (pending map edit requests).
   */
  getEditQueue: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["pending", "approved", "rejected"]).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? "pending";
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const [edits, total] = await Promise.all([
        ctx.db.mapEditRequest.findMany({
          where: { status },
          include: {
            country: { select: { id: true, name: true, flag: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        ctx.db.mapEditRequest.count({ where: { status } }),
      ]);

      return {
        edits: (edits as any).map((e: any) => ({
          id: e.id,
          countryId: e.countryId,
          countryName: e.country.name,
          countryFlag: e.country?.flag ?? null,
          userId: e.userId,
          editType: e.editType,
          targetId: e.targetId,
          operation: e.operation,
          proposedData: e.proposedData,
          currentData: e.currentData,
          status: e.status,
          reviewedBy: e.reviewedBy,
          reviewedAt: e.reviewedAt,
          reviewNote: e.reviewNote,
          createdAt: e.createdAt,
        })),
        total,
        hasMore: offset + limit < total,
      };
    }),

  /**
   * Admin: Approve a map edit request.
   */
  approveEdit: adminProcedure
    .input(
      z.object({
        editId: z.string(),
        reviewNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edit = await ctx.db.mapEditRequest.findUnique({
        where: { id: input.editId },
      });

      if (!edit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Edit request not found",
        });
      }

      if (edit.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Edit already ${edit.status}`,
        });
      }

      // Apply the edit based on type
      const proposed = edit.proposedData as Record<string, unknown>;

      if (edit.editType === "border_adjust" && edit.operation === "update") {
        // Update the country's border geometry
        const mapLayer = await ctx.db.mapLayer.findFirst({
          where: { layerType: "political", countryId: edit.countryId },
        });
        if (mapLayer && proposed.geometry) {
          const oldAreaSqKm = mapLayer.areaSqKm;

          await ctx.db.mapLayer.update({
            where: { id: mapLayer.id },
            data: { geometry: proposed.geometry as object },
          });

          // Recalculate area via PostGIS and update records
          let newAreaSqKm: number | null = null;
          try {
            const areaResult = await ctx.db.$queryRawUnsafe<Array<{ area_sq_km: number }>>(
              `SELECT ST_Area(geom_postgis::geography) / 1000000 as area_sq_km
               FROM map_layers WHERE id = $1 AND geom_postgis IS NOT NULL`,
              mapLayer.id
            );
            const calculatedArea = areaResult[0]?.area_sq_km;
            if (calculatedArea != null) {
              newAreaSqKm = calculatedArea;
              await ctx.db.mapLayer.update({
                where: { id: mapLayer.id },
                data: { areaSqKm: newAreaSqKm },
              });
            }
          } catch (areaErr) {
            console.error("[geo.approveEdit] Area recalculation failed:", areaErr);
          }

          // Sync MapLayer to Country cached columns
          await syncCountryGeometryFromMapLayer(ctx.db, edit.countryId);

          if (newAreaSqKm != null) {
            // Create BorderHistory record
            const oldSqMi = oldAreaSqKm ? oldAreaSqKm * 0.386102 : null;
            const newSqMi = newAreaSqKm * 0.386102;
            await ctx.db.borderHistory.create({
              data: {
                countryId: edit.countryId,
                geometry: proposed.geometry as object,
                changedBy: ctx.auth!.userId ?? "system",
                reason: input.reviewNote ?? "Border adjustment approved",
                oldAreaSqMi: oldSqMi,
                newAreaSqMi: newSqMi,
                areaDeltaSqMi: newSqMi - (oldSqMi ?? 0),
              },
            });

            // Create activity feed entry
            const country = await ctx.db.country.findUnique({
              where: { id: edit.countryId },
              select: { name: true },
            });
            const deltaKm = newAreaSqKm - (oldAreaSqKm ?? 0);
            const direction = deltaKm >= 0 ? "expanded" : "contracted";
            await ActivityGenerator.createActivity({
              type: "economic",
              category: "game",
              countryId: edit.countryId,
              title: `Border ${direction === "expanded" ? "Expansion" : "Contraction"}: ${country?.name ?? "Unknown"}`,
              description: `${country?.name ?? "A country"} ${direction} by ${Math.abs(deltaKm).toFixed(0)} km². New area: ${newAreaSqKm.toFixed(0)} km².`,
              priority: "medium",
              visibility: "public",
              metadata: { oldArea: oldAreaSqKm, newArea: newAreaSqKm, delta: deltaKm },
            });
          }

          clearLayerCache("political");
        }
      } else if (edit.editType === "subdivision") {
        if (edit.operation === "create") {
          await ctx.db.subdivision.create({
            data: {
              name: proposed.name as string,
              countryId: edit.countryId,
              type: (proposed.type as string) ?? "province",
              level: (proposed.level as number) ?? 1,
              geometry: proposed.geometry as any,
              status: "approved",
              submittedBy: edit.userId ?? "system",
            },
          });
        } else if (edit.operation === "update" && edit.targetId) {
          await ctx.db.subdivision.update({
            where: { id: edit.targetId },
            data: {
              name: proposed.name as string | undefined,
              type: proposed.type as string | undefined,
              geometry: proposed.geometry as any,
            },
          });
        } else if (edit.operation === "delete" && edit.targetId) {
          await ctx.db.subdivision.delete({ where: { id: edit.targetId } });
        }
      } else if (edit.editType === "city") {
        if (edit.operation === "create") {
          await ctx.db.city.create({
            data: {
              name: proposed.name as string,
              countryId: edit.countryId,
              type: (proposed.cityType as string) ?? "city",
              coordinates: proposed.coordinates as any,
              population: proposed.population as number | undefined,
              isNationalCapital: proposed.isNationalCapital as boolean | undefined,
              status: "approved",
              submittedBy: edit.userId ?? "system",
            },
          });
        } else if (edit.operation === "update" && edit.targetId) {
          await ctx.db.city.update({
            where: { id: edit.targetId },
            data: {
              name: proposed.name as string | undefined,
              coordinates: proposed.coordinates as any,
              population: proposed.population as number | undefined,
              isNationalCapital: proposed.isNationalCapital as boolean | undefined,
            },
          });
        } else if (edit.operation === "delete" && edit.targetId) {
          await ctx.db.city.delete({ where: { id: edit.targetId } });
        }
      } else if (edit.editType === "poi") {
        if (edit.operation === "create") {
          const poi = await ctx.db.pointOfInterest.create({
            data: {
              name: proposed.name as string,
              countryId: edit.countryId,
              category: (proposed.category as string) ?? "landmark",
              coordinates: proposed.coordinates as any,
              description: proposed.description as string | undefined,
              status: "approved",
              submittedBy: edit.userId ?? "system",
            },
          });

          try {
            const country = await ctx.db.country.findUnique({
              where: { id: edit.countryId },
              select: { name: true },
            });
            await ActivityGenerator.createActivity({
              type: "meta",
              category: "game",
              countryId: edit.countryId,
              title: `New Point of Interest: ${poi.name}`,
              description: `${country?.name ?? "A country"} added a new point of interest: ${poi.name} (${poi.category}).`,
              priority: "low",
              visibility: "public",
              metadata: {
                poiId: poi.id,
                poiName: poi.name,
                category: poi.category,
                description: poi.description,
              },
            });
          } catch (e) {
            console.error("[geo.approveEdit] Failed to create activity for POI:", e);
          }
        } else if (edit.operation === "update" && edit.targetId) {
          await ctx.db.pointOfInterest.update({
            where: { id: edit.targetId },
            data: {
              name: proposed.name as string | undefined,
              category: proposed.category as string | undefined,
              coordinates: proposed.coordinates as any,
              description: proposed.description as string | undefined,
            },
          });
        } else if (edit.operation === "delete" && edit.targetId) {
          await ctx.db.pointOfInterest.delete({ where: { id: edit.targetId } });
        }
      }

      // Mark approved
      await ctx.db.mapEditRequest.update({
        where: { id: input.editId },
        data: {
          status: "approved",
          reviewedBy: ctx.auth!.userId,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote ?? null,
        },
      });

      return { id: input.editId, status: "approved" as const };
    }),

  /**
   * Admin: Reject a map edit request.
   */
  rejectEdit: adminProcedure
    .input(
      z.object({
        editId: z.string(),
        reviewNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edit = await ctx.db.mapEditRequest.findUnique({
        where: { id: input.editId },
      });

      if (!edit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Edit request not found",
        });
      }

      if (edit.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Edit already ${edit.status}`,
        });
      }

      await ctx.db.mapEditRequest.update({
        where: { id: input.editId },
        data: {
          status: "rejected",
          reviewedBy: ctx.auth!.userId,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote ?? null,
        },
      });

      return { id: input.editId, status: "rejected" as const };
    }),

  // ──────────────────────────────────────────────
  // Border Editor
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // User map editor endpoints (country owners)
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Story Pins — Narrative markers on the map
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Storylines — Narrative chains connecting story pins
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Map Labels — Custom styled text on the map
  // ──────────────────────────────────────────────

  /**
   * Get edit history for the user's country.
   */
  getMyEditHistory: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only view your own edit history",
        });
      }

      const edits = await ctx.db.mapEditRequest.findMany({
        where: { countryId: input.countryId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return edits.map(
        (e: {
          id: string;
          editType: string;
          operation: string;
          status: string;
          createdAt: Date;
          reviewedAt: Date | null;
          reviewNote: string | null;
          proposedData: unknown;
        }) => ({
          id: e.id,
          editType: e.editType,
          operation: e.operation,
          status: e.status,
          createdAt: e.createdAt,
          reviewedAt: e.reviewedAt,
          reviewNote: e.reviewNote,
          summary: (e.proposedData as Record<string, unknown>)?.name ?? "Unknown",
        })
      );
    }),

  // ──────────────────────────────────────────────
  // Sovereignty / dependency management
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Linkage validation & repair
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // SVG Upload & Processing Pipeline
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────
  // World Template / Clone System (Phase 3)
  // ──────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────
  // Procedural World Generation (Phase 4)
  // ──────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Map Pipeline Endpoints
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Province Import Endpoints
  // ──────────────────────────────────────────────

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────
});
