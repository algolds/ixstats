import { z } from "zod";
import type { MapEditRequest, PrismaClient } from "@prisma/client";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { clearLayerCache } from "../core";
import { ActivityGenerator } from "~/lib/activity";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";

const reviewInput = z.object({
  editId: z.string(),
  reviewNote: z.string().optional(),
});

async function loadPendingEdit(db: PrismaClient, editId: string) {
  const edit = await db.mapEditRequest.findUnique({ where: { id: editId } });
  if (!edit) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Edit request not found" });
  }
  if (edit.status !== "pending") {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Edit already ${edit.status}` });
  }
  return edit;
}

type Proposed = Record<string, unknown>;

/** Runs the create / update / delete the edit asks for; update and delete need a target. */
async function applyCrud(
  edit: MapEditRequest,
  handlers: {
    create: () => Promise<unknown>;
    update: (id: string) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
  }
) {
  if (edit.operation === "create") await handlers.create();
  else if (edit.operation === "update" && edit.targetId) await handlers.update(edit.targetId);
  else if (edit.operation === "delete" && edit.targetId) await handlers.remove(edit.targetId);
}

/** PostGIS area of a map layer in km2, or null when it has no PostGIS geometry or the query fails. */
async function recalculateAreaSqKm(db: PrismaClient, layerId: string) {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ area_sq_km: number }>>(
      `SELECT ST_Area(geom_postgis::geography) / 1000000 as area_sq_km
               FROM map_layers WHERE id = $1 AND geom_postgis IS NOT NULL`,
      layerId
    );
    return rows[0]?.area_sq_km ?? null;
  } catch (areaErr) {
    console.error("[geo.approveEdit] Area recalculation failed:", areaErr);
    return null;
  }
}

async function applyBorderAdjust(
  db: PrismaClient,
  edit: MapEditRequest,
  proposed: Proposed,
  actorId: string,
  reviewNote: string | undefined
) {
  const mapLayer = await db.mapLayer.findFirst({
    where: { layerType: "political", countryId: edit.countryId },
  });
  if (!mapLayer || !proposed.geometry) return;
  const oldAreaSqKm = mapLayer.areaSqKm;

  await db.mapLayer.update({
    where: { id: mapLayer.id },
    data: { geometry: proposed.geometry as object },
  });

  const newAreaSqKm = await recalculateAreaSqKm(db, mapLayer.id);
  if (newAreaSqKm != null) {
    await db.mapLayer.update({ where: { id: mapLayer.id }, data: { areaSqKm: newAreaSqKm } });
  }

  // Sync MapLayer to Country cached columns
  await syncCountryGeometryFromMapLayer(db, edit.countryId);

  if (newAreaSqKm != null) {
    const oldSqMi = oldAreaSqKm ? oldAreaSqKm * 0.386102 : null;
    const newSqMi = newAreaSqKm * 0.386102;
    await db.borderHistory.create({
      data: {
        countryId: edit.countryId,
        geometry: proposed.geometry as object,
        changedBy: actorId,
        reason: reviewNote ?? "Border adjustment approved",
        oldAreaSqMi: oldSqMi,
        newAreaSqMi: newSqMi,
        areaDeltaSqMi: newSqMi - (oldSqMi ?? 0),
      },
    });

    const country = await db.country.findUnique({
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

function applySubdivisionEdit(db: PrismaClient, edit: MapEditRequest, p: Proposed) {
  return applyCrud(edit, {
    create: () =>
      db.subdivision.create({
        data: {
          name: p.name as string,
          countryId: edit.countryId,
          type: (p.type as string) ?? "province",
          level: (p.level as number) ?? 1,
          geometry: p.geometry as any,
          status: "approved",
          submittedBy: edit.userId ?? "system",
        },
      }),
    update: (id) =>
      db.subdivision.update({
        where: { id },
        data: {
          name: p.name as string | undefined,
          type: p.type as string | undefined,
          geometry: p.geometry as any,
        },
      }),
    remove: (id) => db.subdivision.delete({ where: { id } }),
  });
}

function applyCityEdit(db: PrismaClient, edit: MapEditRequest, p: Proposed) {
  const fields = {
    name: p.name as string | undefined,
    coordinates: p.coordinates as any,
    population: p.population as number | undefined,
    isNationalCapital: p.isNationalCapital as boolean | undefined,
  };
  return applyCrud(edit, {
    create: () =>
      db.city.create({
        data: {
          ...fields,
          name: p.name as string,
          countryId: edit.countryId,
          type: (p.cityType as string) ?? "city",
          status: "approved",
          submittedBy: edit.userId ?? "system",
        },
      }),
    update: (id) => db.city.update({ where: { id }, data: fields }),
    remove: (id) => db.city.delete({ where: { id } }),
  });
}

async function announceNewPoi(
  db: PrismaClient,
  countryId: string,
  poi: { id: string; name: string; category: string; description: string | null }
) {
  try {
    const country = await db.country.findUnique({
      where: { id: countryId },
      select: { name: true },
    });
    await ActivityGenerator.createActivity({
      type: "meta",
      category: "game",
      countryId,
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
}

function applyPoiEdit(db: PrismaClient, edit: MapEditRequest, p: Proposed) {
  const fields = {
    name: p.name as string | undefined,
    category: p.category as string | undefined,
    coordinates: p.coordinates as any,
    description: p.description as string | undefined,
  };
  return applyCrud(edit, {
    create: async () => {
      const poi = await db.pointOfInterest.create({
        data: {
          ...fields,
          name: p.name as string,
          countryId: edit.countryId,
          category: (p.category as string) ?? "landmark",
          status: "approved",
          submittedBy: edit.userId ?? "system",
        },
      });
      await announceNewPoi(db, edit.countryId, poi);
    },
    update: (id) => db.pointOfInterest.update({ where: { id }, data: fields }),
    remove: (id) => db.pointOfInterest.delete({ where: { id } }),
  });
}

/** Marks a pending edit request approved or rejected. */
function recordReview(
  db: PrismaClient,
  input: { editId: string; reviewNote?: string },
  status: "approved" | "rejected",
  reviewerId: string
) {
  return db.mapEditRequest.update({
    where: { id: input.editId },
    data: {
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote ?? null,
    },
  });
}

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
  approveEdit: adminProcedure.input(reviewInput).mutation(async ({ ctx, input }) => {
    const edit = await loadPendingEdit(ctx.db, input.editId);
    const proposed = edit.proposedData as Proposed;

    if (edit.editType === "border_adjust" && edit.operation === "update") {
      await applyBorderAdjust(
        ctx.db,
        edit,
        proposed,
        ctx.user.clerkUserId ?? "system",
        input.reviewNote
      );
    } else if (edit.editType === "subdivision") {
      await applySubdivisionEdit(ctx.db, edit, proposed);
    } else if (edit.editType === "city") {
      await applyCityEdit(ctx.db, edit, proposed);
    } else if (edit.editType === "poi") {
      await applyPoiEdit(ctx.db, edit, proposed);
    }

    await recordReview(ctx.db, input, "approved", ctx.user.clerkUserId);
    return { id: input.editId, status: "approved" as const };
  }),

  /**
   * Admin: Reject a map edit request.
   */
  rejectEdit: adminProcedure.input(reviewInput).mutation(async ({ ctx, input }) => {
    await loadPendingEdit(ctx.db, input.editId);
    await recordReview(ctx.db, input, "rejected", ctx.user.clerkUserId);
    return { id: input.editId, status: "rejected" as const };
  }),
});
