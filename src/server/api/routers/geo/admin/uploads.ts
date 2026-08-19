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
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";
import type { FeatureCollection } from "geojson";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoAdminUploadsRouter = createTRPCRouter({
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

  // ──────────────────────────────────────────────
  // Sovereignty / dependency management
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Linkage validation & repair
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // SVG Upload & Processing Pipeline
  // ──────────────────────────────────────────────

  /** Upload an SVG file for a specific layer type */
  uploadSvg: adminProcedure
    .input(
      z.object({
        layerType: z.enum([
          "political",
          "climate",
          "altitudes",
          "rivers",
          "lakes",
          "icecaps",
          "background",
        ]),
        svgContent: z.string().min(100, "SVG content is too short"),
        fileName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svgBuffer = Buffer.from(input.svgContent, "base64");
      const svgString = svgBuffer.toString("utf-8");
      const svgHash = createHash("sha256").update(svgString).digest("hex");

      // Check for duplicate uploads
      const existingUpload = await ctx.db.svgUpload.findFirst({
        where: { svgHash, layerType: input.layerType, status: { not: "rolled_back" } },
      });
      if (existingUpload) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `This SVG has already been uploaded (ID: ${existingUpload.id}, status: ${existingUpload.status})`,
        });
      }

      // Extract metadata before storing
      const { extractSvgMetadata } = await import("~/lib/flags/svg-parser");
      const metadata = extractSvgMetadata(svgString);

      const upload = await ctx.db.svgUpload.create({
        data: {
          layerType: input.layerType,
          fileName: input.fileName,
          fileSizeBytes: svgBuffer.length,
          svgHash,
          status: "pending",
          uploadedBy: ctx.auth!.userId ?? "system",
          svgContent: svgString,
          svgMetadata: metadata as any,
        },
      });

      return {
        id: upload.id,
        fileName: upload.fileName,
        fileSizeBytes: upload.fileSizeBytes,
        layerType: upload.layerType,
        svgMetadata: metadata,
      };
    }),

  /** Process an uploaded SVG: parse paths, convert to GeoJSON, match countries */
  processSvgUpload: adminProcedure
    .input(z.object({ uploadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const upload = await ctx.db.svgUpload.findUnique({
        where: { id: input.uploadId },
      });
      if (!upload) throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      if (!upload.svgContent)
        throw new TRPCError({ code: "BAD_REQUEST", message: "No SVG content stored" });
      if (
        upload.status !== "pending" &&
        upload.status !== "processed" &&
        upload.status !== "failed"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Upload cannot be reprocessed (status: ${upload.status})`,
        });
      }

      // Mark as processing
      await ctx.db.svgUpload.update({
        where: { id: input.uploadId },
        data: { status: "processing" },
      });

      try {
        const { parseSvgToGeoJson, matchFeaturesToCountries } =
          await import("~/lib/flags/svg-parser");
        const { readFileSync, existsSync } = await import("fs");
        const { join } = await import("path");

        // Try to load reference GeoJSON for coordinate calibration
        let referenceGeoJson: import("geojson").FeatureCollection | undefined;
        const refPath = join(
          process.cwd(),
          "scripts",
          "geojson_fixed",
          `${upload.layerType}.geojson`
        );
        if (existsSync(refPath)) {
          try {
            referenceGeoJson = JSON.parse(readFileSync(refPath, "utf8"));
          } catch {
            /* ignore parse errors */
          }
        }

        const result = parseSvgToGeoJson(upload.svgContent, upload.layerType, {
          referenceGeoJson,
        });

        // For political layer, match features to countries
        let countryMatches: Record<
          string,
          { countryId: string; countryName: string; matchType: string }
        > = {};
        if (upload.layerType === "political") {
          const countries = await ctx.db.country.findMany({
            select: { id: true, name: true, slug: true },
          });
          const matches = matchFeaturesToCountries(result.features, countries);
          countryMatches = Object.fromEntries(matches);
        }

        // Compute diff against current DB state
        const { computeLayerDiff } = await import("~/lib/flags/svg-parser");
        const existingFeatures = await ctx.db.mapLayer.findMany({
          where: { layerType: upload.layerType, isActive: true },
          select: {
            featureId: true,
            displayName: true,
            geometry: true,
            properties: true,
            countryId: true,
            areaSqKm: true,
            country: { select: { name: true } },
          },
        });
        const diff = computeLayerDiff(result.features, existingFeatures);
        diff.layerType = upload.layerType;

        // Store result + diff summary
        await ctx.db.svgUpload.update({
          where: { id: input.uploadId },
          data: {
            status: "processed",
            geojsonData: result.featureCollection as any,
            featureCount: result.features.length,
            processingLog: result.log,
            processedAt: new Date(),
            svgMetadata: {
              ...((upload.svgMetadata as Record<string, unknown>) ?? {}),
              diffSummary: diff.summary,
              preservedLinkages: diff.preservedLinkages,
            },
          },
        });

        return {
          featureCount: result.features.length,
          layersFound: result.layersFound,
          viewBox: result.viewBox,
          log: result.log,
          countryMatches,
          diff,
          features: result.features.map((f) => ({
            featureId: f.featureId,
            displayName: f.displayName,
            areaSqKm: f.areaSqKm,
            centroid: f.centroid,
            countryMatch: countryMatches[f.featureId] ?? null,
          })),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await ctx.db.svgUpload.update({
          where: { id: input.uploadId },
          data: {
            status: "failed",
            errorMessage,
          },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Processing failed: ${errorMessage}`,
        });
      }
    }),

  /** Preview processed SVG data (returns GeoJSON for MapLibre rendering) */
  previewSvgUpload: adminProcedure
    .input(z.object({ uploadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const upload = await ctx.db.svgUpload.findUnique({
        where: { id: input.uploadId },
        select: { id: true, status: true, geojsonData: true, layerType: true, featureCount: true },
      });
      if (!upload) throw new TRPCError({ code: "NOT_FOUND" });
      if (upload.status !== "processed" || !upload.geojsonData) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Upload must be processed before preview",
        });
      }

      return {
        geojson: upload.geojsonData as unknown as FeatureCollection,
        layerType: upload.layerType,
        featureCount: upload.featureCount,
      };
    }),

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
