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
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { invalidateCache } from "~/lib/cache";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { clearLayerCache } from "../core";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoEditorProceduralRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Map Pipeline Endpoints
  // ──────────────────────────────────────────────

  /**
   * Run the map conversion pipeline (SVG or procedural input).
   * PNG input should be pre-processed to SVG on the client or via uploadAndProcessImage.
   */
  runPipeline: adminProcedure
    .input(
      z.object({
        source: z.enum(["svg", "procedural"]),
        svgContent: z.string().optional(),
        worldGenParams: z.record(z.string(), z.unknown()).optional(),
        targetLayers: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { runMapPipeline, validatePipelineResult } = await import("~/lib/maps/map-pipeline");

      const result = await runMapPipeline({
        source: input.source,
        svgContent: input.svgContent,
        worldGenParams: input.worldGenParams as
          import("~/lib/worldgen/types").WorldGenParams | undefined,
        targetLayers: input.targetLayers,
      });

      const validation = validatePipelineResult(result);

      return {
        ...result,
        validation,
      };
    }),

  /**
   * Import pipeline result into the database as MapLayer records.
   */
  importPipelineResult: adminProcedure
    .input(
      z.object({
        layers: z.record(z.string(), z.unknown()),
        mode: z.enum(["replace", "merge"]).default("merge"),
        realmId: z.string().default(DEFAULT_REALM_ID),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // An unknown id would otherwise write layers no realm's map ever reads
      const realm = await ctx.db.realm.findUnique({
        where: { id: input.realmId },
        select: { id: true },
      });
      if (!realm) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown realm" });

      const layers = input.layers as Record<string, import("geojson").FeatureCollection>;
      let imported = 0;

      await ctx.db.$transaction(async (tx) => {
        if (input.mode === "replace") {
          // Deactivate existing layers for this world
          await tx.mapLayer.updateMany({
            where: { realmId: input.realmId, isActive: true },
            data: { isActive: false },
          });
        }

        for (const [layerType, collection] of Object.entries(layers)) {
          if (!collection?.features) continue;

          for (const feature of collection.features) {
            const featureId =
              (feature.properties?.featureId as string) ??
              (feature.id as string) ??
              `${layerType}_${imported}`;

            await tx.mapLayer.upsert({
              where: {
                realmId_layerType_featureId: { realmId: input.realmId, layerType, featureId },
              },
              update: {
                geometry: feature.geometry as any,
                properties: (feature.properties ?? {}) as any,
                isActive: true,
                realmId: input.realmId,
              },
              create: {
                layerType,
                featureId,
                geometry: feature.geometry as any,
                properties: (feature.properties ?? {}) as any,
                isActive: true,
                realmId: input.realmId,
              },
            });
            imported++;
          }
        }
      });

      // Build shared vertex index for political features
      if (layers.political) {
        try {
          const { buildSharedVertexIndex } = await import("~/lib/maps/shared-vertex-builder");
          const politicalFeatures = layers.political.features
            .filter((f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon")
            .map((f) => ({
              featureId: (f.properties?.featureId as string) ?? (f.id as string) ?? "",
              geometry: f.geometry as import("geojson").Polygon | import("geojson").MultiPolygon,
            }));

          const sharedVertices = buildSharedVertexIndex(politicalFeatures);

          // Clear existing shared vertices for this world
          await ctx.db.sharedVertex.deleteMany({
            where: { realmId: input.realmId },
          });

          // Insert new shared vertices
          if (sharedVertices.length > 0) {
            await ctx.db.sharedVertex.createMany({
              data: sharedVertices.map((sv) => ({
                lng: sv.lng,
                lat: sv.lat,
                featureRefs: sv.featureRefs as any,
                realmId: input.realmId,
              })),
            });
          }
        } catch {
          // Shared vertex build failed — non-blocking
        }
      }

      // Invalidate the assembled-layer cache and the cached map responses (keys carry the realm)
      clearLayerCache();
      invalidateCache(["geoCore.getWorldMap", "geoCore.getMapBundle"]);

      return { imported, mode: input.mode };
    }),
});
