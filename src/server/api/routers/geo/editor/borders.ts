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
  publicProcedure,
  rateLimitedPublicProcedure,
  cachedPublicProcedure,
  adminProcedure,
  countryOwnerProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/map-update-bus";
import { clearLayerCache } from "../core";
import { ActivityGenerator } from "~/lib/activity-generator";
import { normalizeFlagUrl } from "~/lib/unified-flag-service";
import { featureIdToDisplayName } from "~/lib/map-utils";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo-service";

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
      let neighbors: Array<{ featureId: string; displayName: string | null }> = [];
      if (bbox && bbox.length === 4) {
        const pad = 1; // 1° padding for neighbor search
        neighbors = await ctx.db.mapLayer
          .findMany({
            where: {
              layerType: "political",
              featureId: { not: input.featureId },
              isActive: true,
            },
            select: { featureId: true, displayName: true, boundingBox: true },
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
              .map((l) => ({ featureId: l.featureId, displayName: l.displayName }))
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
          | import("geojson").Polygon
          | import("geojson").MultiPolygon;
        const centroid = calculateCentroid(geom);
        const bbox = calculateBBox(geom);
        const area = calculateArea(geom);

        await ctx.db.mapLayer.update({
          where: { id: feature.id },
          data: {
            geometry: input.proposedGeometry as any,
            centroid,
            boundingBox: bbox,
            areaSqKm: area,
          },
        });

        if (feature.countryId) {
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
          affectedFeatures: input.affectedFeatures ?? [],
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
        | import("geojson").Polygon
        | import("geojson").MultiPolygon;
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

      await ctx.db.$transaction(async (tx) => {
        // Deactivate original
        await tx.mapLayer.update({
          where: { id: feature.id },
          data: { isActive: false },
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

      clearLayerCache("political");

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

      await ctx.db.$transaction(async (tx) => {
        // Deactivate originals
        await tx.mapLayer.updateMany({
          where: { id: { in: features.map((f) => f.id) } },
          data: { isActive: false },
        });

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

      clearLayerCache("political");

      return {
        mergedFeatures: input.featureIds,
        newFeature: { featureId: newFeatureId, name: input.newName },
      };
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
