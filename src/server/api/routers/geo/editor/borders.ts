import { z } from "zod";
import { createTRPCRouter, adminProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { clearLayerCache } from "../core";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";
import { validateGeometryValid } from "~/lib/maps/geo-validation";
import { rebuildAdjacency } from "~/lib/maps/adjacency";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { editableMapRealmId, realmScopeInput } from "~/server/api/trpc/realm-scope";
import { assertFound, neighbourFeatures } from "../core/shared";
import { realmRadiusKmById } from "~/server/modules/realms/realms.map";
import { scaleAreaToRadius } from "~/lib/maps/planet";

type PolygonalGeometry = import("geojson").Polygon | import("geojson").MultiPolygon;

/** The border editor's area measure on the realm's planet (`Realm.settings.map.radiusKm`, else Earth's). */
async function realmAreaOf(
  db: Parameters<typeof realmRadiusKmById>[0],
  realmId: string,
  flatArea: (geometry: PolygonalGeometry) => number
) {
  const radiusKm = await realmRadiusKmById(db, realmId);
  return (geometry: PolygonalGeometry) => scaleAreaToRadius(flatArea(geometry), radiusKm);
}

export const geoEditorBordersRouter = createTRPCRouter({
  /** Start a border editing session for a feature. Returns geometry + neighbor info. */
  startBorderEditSession: rateLimitedMutationProcedure
    .input(z.object({ featureId: z.string(), ...realmScopeInput.shape }))
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      const feature = assertFound(
        await ctx.db.mapLayer.findFirst({
          where: { layerType: "political", featureId: input.featureId, isActive: true, realmId },
          select: {
            id: true,
            featureId: true,
            displayName: true,
            geometry: true,
            centroid: true,
            boundingBox: true,
            areaSqKm: true,
            countryId: true,
          },
        }),
        `Feature not found: ${input.featureId}`
      );

      // Find neighboring features by bounding box overlap
      const bbox = feature.boundingBox as number[] | null;
      let neighbors: Array<{
        featureId: string;
        displayName: string | null;
        geometry: unknown;
      }> = [];
      if (bbox && bbox.length === 4) {
        const pad = 1; // 1° padding for neighbor search
        neighbors = await ctx.db.mapLayer
          .findMany({
            where: {
              layerType: "political",
              featureId: { not: input.featureId },
              isActive: true,
              realmId,
            },
            select: {
              featureId: true,
              displayName: true,
              boundingBox: true,
              geometry: true,
            },
          })
          .then((layers) => neighbourFeatures(layers, bbox, pad));
      }

      // Create or resume session
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const session = await ctx.db.mapEditorSession.upsert({
        where: { id: `${ctx.auth!.userId ?? "system"}_${input.featureId}` },
        create: {
          id: `${ctx.auth!.userId ?? "system"}_${input.featureId}`,
          userId: ctx.auth!.userId ?? "system",
          featureId: input.featureId,
          sessionData: { undoStack: [], mode: "select" } as any,
          expiresAt,
        },
        update: { expiresAt, updatedAt: new Date() },
      });

      return {
        session: { id: session.id, sessionData: session.sessionData },
        feature: {
          featureId: feature.featureId,
          displayName: feature.displayName,
          geometry: feature.geometry,
          centroid: feature.centroid,
          boundingBox: feature.boundingBox,
          areaSqKm: feature.areaSqKm,
          countryId: feature.countryId,
        },
        neighbors,
      };
    }),

  /** Save border edit draft (auto-save editor state). */
  saveBorderEditDraft: rateLimitedMutationProcedure
    .input(
      z.object({
        sessionId: z.string(),
        sessionData: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only the session's own editor saves into it (session ids are `<userId>_<featureId>`).
      const { count } = await ctx.db.mapEditorSession.updateMany({
        where: { id: input.sessionId, userId: ctx.auth?.userId ?? "system" },
        data: {
          sessionData: input.sessionData as any,
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      if (count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Editor session not found" });
      }
      return { ok: true };
    }),

  /** Submit a border edit for review, or apply it directly (site admins, the founder, map officers). */
  submitBorderEdit: rateLimitedMutationProcedure
    .input(
      z.object({
        featureId: z.string(),
        editSubtype: z.enum(["vertex_edit", "redraw", "split", "merge"]),
        proposedGeometry: z.record(z.string(), z.unknown()), // GeoJSON geometry
        affectedFeatures: z.array(z.string()).optional(),
        neighborUpdates: z
          .array(
            z.object({
              featureId: z.string(),
              geometry: z.record(z.string(), z.unknown()),
            })
          )
          .optional(),
        applyDirectly: z.boolean().default(false),
        reason: z.string().optional(),
        ...realmScopeInput.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      const feature = assertFound(
        await ctx.db.mapLayer.findFirst({
          where: { layerType: "political", featureId: input.featureId, isActive: true, realmId },
          select: { id: true, geometry: true, countryId: true, displayName: true, areaSqKm: true },
        }),
        `Feature not found: ${input.featureId}`
      );

      if (input.applyDirectly) {
        // Direct apply (the realm's map editors) — update geometry immediately
        const {
          calculateArea: flatArea,
          calculateCentroid,
          calculateBBox,
        } = await import("~/lib/maps/border-editor");
        const calculateArea = await realmAreaOf(ctx.db, realmId, flatArea);
        const geom = input.proposedGeometry as unknown as
          import("geojson").Polygon | import("geojson").MultiPolygon;
        await validateGeometryValid(ctx.db, input.proposedGeometry);
        const centroid = calculateCentroid(geom);
        const bbox = calculateBBox(geom);
        const area = calculateArea(geom);

        // Look up neighbor features so we can update them and link to their countries.
        const neighborUpdates = input.neighborUpdates ?? [];
        const neighborRows =
          neighborUpdates.length > 0
            ? await ctx.db.mapLayer.findMany({
                where: {
                  layerType: "political",
                  featureId: { in: neighborUpdates.map((n) => n.featureId) },
                  isActive: true,
                  realmId,
                },
                select: { id: true, featureId: true, countryId: true, areaSqKm: true },
              })
            : [];
        const neighborByFeatureId = new Map(neighborRows.map((r) => [r.featureId, r]));

        // Wrap primary + neighbor updates in a single transaction so a partial
        // failure rolls back everything (no half-moved shared border).
        await ctx.db.$transaction(async (tx) => {
          await tx.mapLayer.update({
            where: { id: feature.id },
            data: {
              geometry: input.proposedGeometry as any,
              centroid,
              boundingBox: bbox,
              areaSqKm: area,
            },
          });

          for (const nUpdate of neighborUpdates) {
            const neighborRow = neighborByFeatureId.get(nUpdate.featureId);
            if (!neighborRow) continue;
            const nGeom = nUpdate.geometry as unknown as
              import("geojson").Polygon | import("geojson").MultiPolygon;
            await validateGeometryValid(ctx.db, nUpdate.geometry);
            const nCentroid = calculateCentroid(nGeom);
            const nBbox = calculateBBox(nGeom);
            const nArea = calculateArea(nGeom);

            await tx.mapLayer.update({
              where: { id: neighborRow.id },
              data: {
                geometry: nUpdate.geometry as any,
                centroid: nCentroid,
                boundingBox: nBbox,
                areaSqKm: nArea,
              },
            });

            if (neighborRow.countryId) {
              await syncCountryGeometryFromMapLayer(tx, neighborRow.countryId);
            }
          }
        });

        if (feature.countryId) {
          // Sync outside the transaction — it does its own internal commits.
          await syncCountryGeometryFromMapLayer(ctx.db, feature.countryId);

          // Log in BorderHistory
          await ctx.db.borderHistory.create({
            data: {
              countryId: feature.countryId,
              geometry: input.proposedGeometry as any,
              changedBy: ctx.auth?.userId ?? "admin",
              reason: input.reason ?? "Direct map edit via World Editor",
              oldAreaSqMi: feature.areaSqKm ? feature.areaSqKm * 0.386102 : null,
              newAreaSqMi: area ? area * 0.386102 : null,
              areaDeltaSqMi: feature.areaSqKm && area ? (area - feature.areaSqKm) * 0.386102 : null,
            },
          });
        }

        // Clear cache
        clearLayerCache("political");
        await invalidateCache([
          "geoCore.getCountryFeatures",
          "geoCore.getMapBundle",
          "geoCore.getWorldMap",
          "geoCore.getAllMapFeatures",
          "countryGeo.getCountryGeoBundle",
          "geoCore.getCountryGeometry",
        ]);
        broadcastMapUpdate("borders", feature.countryId ?? undefined);

        // Clean up session
        await ctx.db.mapEditorSession.deleteMany({
          where: { userId: ctx.auth!.userId ?? "system", featureId: input.featureId },
        });

        return { applied: true, editRequestId: null };
      }

      // Create edit request for review
      const editRequest = await ctx.db.mapEditRequest.create({
        data: {
          countryId: feature.countryId ?? "unknown",
          realmId,
          userId: ctx.auth!.userId ?? "system",
          editType: "border_adjust",
          editSubtype: input.editSubtype,
          operation: "update",
          proposedData: input.proposedGeometry as any,
          currentData: feature.geometry ?? undefined,
          previousGeometry: feature.geometry ?? undefined,
          affectedFeatures:
            input.neighborUpdates?.map((n) => n.featureId) ?? input.affectedFeatures ?? [],
          status: "pending",
        },
      });

      return { applied: false, editRequestId: editRequest.id };
    }),

  /** Split a country into two new features. */
  splitCountry: rateLimitedMutationProcedure
    .input(
      z.object({
        featureId: z.string(),
        splitLine: z.array(z.tuple([z.number(), z.number()])),
        nameA: z.string(),
        nameB: z.string(),
        ...realmScopeInput.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      const feature = assertFound(
        await ctx.db.mapLayer.findFirst({
          where: { layerType: "political", featureId: input.featureId, isActive: true, realmId },
        }),
        `Feature not found: ${input.featureId}`
      );

      const {
        splitPolygon,
        calculateArea: flatArea,
        calculateCentroid,
        calculateBBox,
      } = await import("~/lib/maps/border-editor");
      const calculateArea = await realmAreaOf(ctx.db, realmId, flatArea);
      const geometry = feature.geometry as unknown as
        import("geojson").Polygon | import("geojson").MultiPolygon;
      const result = splitPolygon(geometry, input.splitLine);

      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Split line does not properly intersect the feature",
        });
      }

      const [geomA, geomB] = result;
      const featureIdA = input.nameA.replace(/\s+/g, "_");
      const featureIdB = input.nameB.replace(/\s+/g, "_");
      // Capture before the transaction nulls the original feature's link.
      const originalCountryId = feature.countryId;

      await ctx.db.$transaction(async (tx) => {
        // Deactivate and rename original to prevent unique constraint violation
        await tx.mapLayer.update({
          where: { id: feature.id },
          data: {
            isActive: false,
            featureId: `${feature.featureId}_deactivated_${Date.now()}`,
            countryId: null,
          },
        });

        // Create two new features
        await tx.mapLayer.createMany({
          data: [
            {
              realmId,
              layerType: "political",
              featureId: featureIdA,
              displayName: input.nameA,
              geometry: geomA as object,
              properties: { id: featureIdA, name: input.nameA },
              centroid: calculateCentroid(geomA),
              boundingBox: calculateBBox(geomA),
              areaSqKm: calculateArea(geomA),
              isActive: true,
            },
            {
              realmId,
              layerType: "political",
              featureId: featureIdB,
              displayName: input.nameB,
              geometry: geomB as object,
              properties: { id: featureIdB, name: input.nameB },
              centroid: calculateCentroid(geomB),
              boundingBox: calculateBBox(geomB),
              areaSqKm: calculateArea(geomB),
              isActive: true,
            },
          ],
        });
      });

      if (originalCountryId) {
        await syncCountryGeometryFromMapLayer(ctx.db, originalCountryId);
      }

      clearLayerCache("political");
      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
        "geoCore.getCountryGeometry",
      ]);
      broadcastMapUpdate("borders");

      return {
        originalFeatureId: input.featureId,
        newFeatures: [
          { featureId: featureIdA, name: input.nameA },
          { featureId: featureIdB, name: input.nameB },
        ],
      };
    }),

  /** Merge two or more countries into one. */
  mergeCountries: rateLimitedMutationProcedure
    .input(
      z.object({
        featureIds: z.array(z.string()).min(2),
        newName: z.string(),
        ...realmScopeInput.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      const features = await ctx.db.mapLayer.findMany({
        where: {
          layerType: "political",
          featureId: { in: input.featureIds },
          isActive: true,
          realmId,
        },
      });

      if (features.length !== input.featureIds.length) {
        const found = new Set(features.map((f) => f.featureId));
        const missing = input.featureIds.filter((id) => !found.has(id));
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Features not found: ${missing.join(", ")}`,
        });
      }

      const {
        mergeGeometries,
        calculateArea: flatArea,
        calculateCentroid,
        calculateBBox,
      } = await import("~/lib/maps/border-editor");
      const calculateArea = await realmAreaOf(ctx.db, realmId, flatArea);

      // Merge all geometries
      type GeoType = import("geojson").Polygon | import("geojson").MultiPolygon;
      let merged = features[0]!.geometry as unknown as GeoType;
      for (let i = 1; i < features.length; i++) {
        merged = mergeGeometries(merged, features[i]!.geometry as unknown as GeoType);
      }

      const newFeatureId = input.newName.replace(/\s+/g, "_");
      const countryIds = Array.from(
        new Set(features.map((f) => f.countryId).filter(Boolean))
      ) as string[];

      await ctx.db.$transaction(async (tx) => {
        // Deactivate and rename originals to prevent unique constraint violation
        for (const f of features) {
          await tx.mapLayer.update({
            where: { id: f.id },
            data: {
              isActive: false,
              featureId: `${f.featureId}_deactivated_${Date.now()}`,
              countryId: null,
            },
          });
        }

        // Create merged feature
        await tx.mapLayer.create({
          data: {
            realmId,
            layerType: "political",
            featureId: newFeatureId,
            displayName: input.newName,
            geometry: merged as object,
            properties: { id: newFeatureId, name: input.newName },
            centroid: calculateCentroid(merged),
            boundingBox: calculateBBox(merged),
            areaSqKm: calculateArea(merged),
            isActive: true,
          },
        });
      });

      // Sync geometries of any country that was linked to the merged features
      for (const countryId of countryIds) {
        await syncCountryGeometryFromMapLayer(ctx.db, countryId);
      }

      clearLayerCache("political");
      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
        "geoCore.getCountryGeometry",
      ]);
      broadcastMapUpdate("borders");

      return {
        mergedFeatures: input.featureIds,
        newFeature: { featureId: newFeatureId, name: input.newName },
      };
    }),

  /** Clean up the current editor geometry (dedupe vertices, remove spikes). */
  repairBorderGeometry: rateLimitedMutationProcedure
    .input(z.object({ geometry: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      const { sanitizeRegionShape } = await import("~/lib/maps/border-editor");
      const geom = input.geometry as unknown as
        import("geojson").Polygon | import("geojson").MultiPolygon;
      const { geometry, issues } = sanitizeRegionShape(geom, geom);
      return { geometry, issues };
    }),

  /** Rebuild the province adjacency graph for all active political features of a realm (also run after an
   *  import). Requires PostGIS. Returns the number of features updated and pairs found. */
  rebuildAdjacency: adminProcedure
    .input(z.object({ realmId: z.string().default(DEFAULT_REALM_ID) }))
    .mutation(({ ctx, input }) => rebuildAdjacency(ctx.db, input.realmId)),
});
