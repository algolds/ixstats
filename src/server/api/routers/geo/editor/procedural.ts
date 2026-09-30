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
import { MAX_PNG_BASE64_LENGTH, MAX_PNG_BYTES, PngDecodeError } from "~/lib/maps/png-realm-map";
import { polygonMetrics } from "~/lib/maps/feature-metrics";
import type { PipelineInput } from "~/lib/maps/map-pipeline";
import { clearLayerCache } from "../core";

const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours are #rrggbb hex");

const runPipelineInput = z.object({
  source: z.enum(["svg", "procedural", "png"]),
  svgContent: z.string().optional(),
  worldGenParams: z.record(z.string(), z.unknown()).optional(),
  targetLayers: z.array(z.string()).optional(),
  /** PNG/JPEG image, base64 without a data: prefix */
  pngBase64: z
    .string()
    .max(MAX_PNG_BASE64_LENGTH, `PNG maps are limited to ${MAX_PNG_BYTES / 1024 / 1024} MB`)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, "pngBase64 must be plain base64")
    .optional(),
  pngConfig: z
    .object({
      /** hex → feature id (the nation's name); omitted ⇒ the pipeline auto-detects colours */
      colorMapping: z.record(hexColour, z.string().trim().min(1).max(200)).optional(),
      backgroundColor: hexColour.optional(),
      minRegionSize: z.number().int().min(0).optional(),
      smoothing: z.number().min(0).max(10).optional(),
    })
    .optional(),
});

/** PNG input: decode the image and auto-detect colours until the admin has mapped them to nations. */
function pngPipelineInput(input: z.infer<typeof runPipelineInput>): PipelineInput {
  if (!input.pngBase64) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "pngBase64 is required for PNG input" });
  }
  const pngConfig = input.pngConfig ?? {};
  return {
    source: "png",
    pngBuffer: Buffer.from(input.pngBase64, "base64"),
    pngConfig: { ...pngConfig, autoDetectColors: !pngConfig.colorMapping },
  };
}

/** An image the decoder refuses (corrupt, not an image, over the pixel limit) is the admin's input: BAD_REQUEST. */
function decodeFailureAsBadRequest(error: Error): never {
  if (error instanceof PngDecodeError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoEditorProceduralRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Map Pipeline Endpoints
  // ──────────────────────────────────────────────

  /**
   * Run the map conversion pipeline (SVG, procedural or flat-colour PNG input — decisions 10–11).
   * A PNG run without pngConfig.colorMapping returns the detected colours for the colour → nation step.
   */
  runPipeline: adminProcedure.input(runPipelineInput).mutation(async ({ input }) => {
    const { runMapPipeline, validatePipelineResult } = await import("~/lib/maps/map-pipeline");

    const result = await runMapPipeline(
      input.source === "png"
        ? pngPipelineInput(input)
        : {
            source: input.source,
            svgContent: input.svgContent,
            worldGenParams: input.worldGenParams as
              import("~/lib/worldgen/types").WorldGenParams | undefined,
            targetLayers: input.targetLayers,
          }
    ).catch(decodeFailureAsBadRequest);

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
            // Worldgen features carry numeric ids; featureId is a String column
            const rawId = feature.properties?.featureId ?? feature.id;
            const featureId =
              rawId !== undefined && rawId !== null && String(rawId) !== ""
                ? String(rawId)
                : `${layerType}_${imported}`;

            // The parser's centroid/bbox/area, so a country linked to this region later syncs real values
            const metrics = polygonMetrics(feature.geometry);
            await tx.mapLayer.upsert({
              where: {
                realmId_layerType_featureId: { realmId: input.realmId, layerType, featureId },
              },
              update: {
                geometry: feature.geometry as any,
                properties: (feature.properties ?? {}) as any,
                ...metrics,
                isActive: true,
                realmId: input.realmId,
              },
              create: {
                layerType,
                featureId,
                geometry: feature.geometry as any,
                properties: (feature.properties ?? {}) as any,
                ...metrics,
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
