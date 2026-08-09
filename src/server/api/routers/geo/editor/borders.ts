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
  // eslint-disable-next-line unused-imports/no-unused-imports
  countryOwnerProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/map-update-bus";
import { clearLayerCache } from "../core";
// eslint-disable-next-line unused-imports/no-unused-imports
import { ActivityGenerator } from "~/lib/activity-generator";
// eslint-disable-next-line unused-imports/no-unused-imports
import { normalizeFlagUrl } from "~/lib/unified-flag-service";
// eslint-disable-next-line unused-imports/no-unused-imports
import { featureIdToDisplayName } from "~/lib/map-utils";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo-service";
import { validateGeometryValid } from "~/lib/geo-validation";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoEditorBordersRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Border Editor
  // ──────────────────────────────────────────────

  /** Start a border editing session for a feature. Returns geometry + neighbor info. */
  startBorderEditSession: adminProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId, isActive: true },
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
      });
      if (!feature) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Feature not found: ${input.featureId}`,
        });
      }

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
            },
            select: {
              featureId: true,
              displayName: true,
              boundingBox: true,
              geometry: true,
            },
          })
          .then((layers) =>
            layers
              .filter((l) => {
                const nb = l.boundingBox as number[] | null;
                if (!nb || nb.length !== 4) return false;
                return (
                  nb[0]! < bbox[2]! + pad &&
                  nb[2]! > bbox[0]! - pad &&
                  nb[1]! < bbox[3]! + pad &&
                  nb[3]! > bbox[1]! - pad
                );
              })
              .map((l) => ({
                featureId: l.featureId,
                displayName: l.displayName,
                geometry: l.geometry,
              }))
          );
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
  saveBorderEditDraft: adminProcedure
    .input(
      z.object({
        sessionId: z.string(),
        sessionData: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.mapEditorSession.update({
        where: { id: input.sessionId },
        data: {
          sessionData: input.sessionData as any,
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return { ok: true };
    }),

  /** Submit a border edit for review (or apply directly for admins). */
  submitBorderEdit: adminProcedure
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId, isActive: true },
        select: { id: true, geometry: true, countryId: true, displayName: true, areaSqKm: true },
      });
      if (!feature) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Feature not found: ${input.featureId}`,
        });
      }

      if (input.applyDirectly) {
        // Admin direct apply — update geometry immediately
        const { calculateArea, calculateCentroid, calculateBBox } =
          await import("~/lib/border-editor");
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
  splitCountry: adminProcedure
    .input(
      z.object({
        featureId: z.string(),
        splitLine: z.array(z.tuple([z.number(), z.number()])),
        nameA: z.string(),
        nameB: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId, isActive: true },
      });
      if (!feature) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Feature not found: ${input.featureId}`,
        });
      }

      const { splitPolygon, calculateArea, calculateCentroid, calculateBBox } =
        await import("~/lib/border-editor");
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
  mergeCountries: adminProcedure
    .input(
      z.object({
        featureIds: z.array(z.string()).min(2),
        newName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const features = await ctx.db.mapLayer.findMany({
        where: { layerType: "political", featureId: { in: input.featureIds }, isActive: true },
      });

      if (features.length !== input.featureIds.length) {
        const found = new Set(features.map((f) => f.featureId));
        const missing = input.featureIds.filter((id) => !found.has(id));
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Features not found: ${missing.join(", ")}`,
        });
      }

      const { mergeGeometries, calculateArea, calculateCentroid, calculateBBox } =
        await import("~/lib/border-editor");

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
  repairBorderGeometry: adminProcedure
    .input(z.object({ geometry: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      const { sanitizeRegionShape } = await import("~/lib/border-editor");
      const geom = input.geometry as unknown as
        import("geojson").Polygon | import("geojson").MultiPolygon;
      const { geometry, issues } = sanitizeRegionShape(geom, geom);
      return { geometry, issues };
    }),

  /** Rebuild the province adjacency graph for all active political features.
   *  Requires PostGIS. Returns the number of features updated and pairs found.
   *  Safe to re-run; overwrites existing neighbors values. */
  rebuildAdjacency: adminProcedure
    .input(z.object({ worldId: z.string().default("default") }))
    .mutation(async ({ ctx }) => {
      const { isPostGISAvailable } = await import("~/lib/geo-validation");
      if (!(await isPostGISAvailable(ctx.db))) return { features: 0, pairs: 0, skipped: true };
      const pairs = await ctx.db.$queryRawUnsafe<Array<{ a: string; b: string }>>(
        `SELECT a."featureId" AS a, b."featureId" AS b
           FROM map_layers a
           JOIN map_layers b
             ON a.id < b.id
            AND a."layerType" = 'political' AND a."isActive" = true
            AND b."layerType" = 'political' AND b."isActive" = true
            AND a.geom_postgis IS NOT NULL AND b.geom_postgis IS NOT NULL
            AND ST_Intersects(a.geom_postgis, b.geom_postgis)
            AND NOT ST_Equals(a.geom_postgis, b.geom_postgis)`
      );
      const adj = new Map<string, Set<string>>();
      for (const { a, b } of pairs) {
        (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
        (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a);
      }
      let updated = 0;
      for (const [featureId, set] of Array.from(adj.entries())) {
        await ctx.db.mapLayer.updateMany({
          where: { layerType: "political", featureId, isActive: true },
          data: { neighbors: Array.from(set) as any },
        });
        updated++;
      }
      return { features: updated, pairs: pairs.length };
    }),

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
