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
import { createHash } from "crypto";
import type { FeatureCollection } from "geojson";
import { featureIdToDisplayName } from "~/lib/map-utils";
import { getZoneByColor } from "~/lib/elevation-config";
import { checkNameUniqueness } from "~/lib/geo-validation";
import { clearLayerCache, extractAllPositions } from "./core";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoAdminRouter = createTRPCRouter({
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
      const { extractSvgMetadata } = await import("~/lib/svg-parser");
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
        const { parseSvgToGeoJson, matchFeaturesToCountries } = await import("~/lib/svg-parser");
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
        const { computeLayerDiff } = await import("~/lib/svg-parser");
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

  /** Commit a processed SVG upload to the MapLayer table */
  commitSvgUpload: adminProcedure
    .input(
      z.object({
        uploadId: z.string(),
        countryMappings: z
          .array(
            z.object({
              featureId: z.string(),
              countryId: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const upload = await ctx.db.svgUpload.findUnique({
        where: { id: input.uploadId },
        select: { id: true, status: true, layerType: true, geojsonData: true, svgMetadata: true },
      });
      if (!upload) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["processed", "committed"].includes(upload.status) || !upload.geojsonData) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload must be processed first" });
      }

      const geojson = upload.geojsonData as unknown as FeatureCollection;

      // Guard: refuse to commit empty feature sets (would wipe the entire layer)
      if (geojson.features.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot commit an SVG with 0 features — this would wipe the layer",
        });
      }

      // 3-layer country mapping: existing DB linkages → auto-match NEW features → manual overrides
      const countryMap = new Map<string, string>();

      // Layer 1: Preserve ALL existing featureId→countryId linkages from DB
      const existingLinked = await ctx.db.mapLayer.findMany({
        where: { layerType: upload.layerType, countryId: { not: null } },
        select: { featureId: true, countryId: true },
      });
      const existingFeatureIds = new Set<string>();
      for (const existing of existingLinked) {
        countryMap.set(existing.featureId, existing.countryId!);
        existingFeatureIds.add(existing.featureId);
      }
      // Also track all existing featureIds (even unlinked) to identify truly new features
      const allExisting = await ctx.db.mapLayer.findMany({
        where: { layerType: upload.layerType },
        select: { featureId: true },
      });
      for (const e of allExisting) existingFeatureIds.add(e.featureId);

      // Layer 2: Auto-match only NEW features (not in existing DB)
      if (upload.layerType === "political") {
        const { matchFeaturesToCountries } = await import("~/lib/svg-parser");
        const countries = await ctx.db.country.findMany({
          select: { id: true, name: true, slug: true },
        });

        const newFeatures = geojson.features
          .filter((f) => {
            const fId = String(f.id ?? f.properties?.id ?? "");
            return fId && !existingFeatureIds.has(fId);
          })
          .map((f) => ({
            featureId: String(f.id ?? f.properties?.id ?? ""),
            displayName: String(f.properties?.name ?? f.id ?? ""),
            geometry: f.geometry,
            properties: f.properties ?? {},
            centroid: [0, 0] as [number, number],
            boundingBox: [0, 0, 0, 0] as [number, number, number, number],
            areaSqKm: 0,
          }));

        if (newFeatures.length > 0) {
          const autoMatches = matchFeaturesToCountries(newFeatures as any, countries);
          for (const [fId, match] of autoMatches) {
            countryMap.set(fId, match.countryId);
          }
        }
      }

      // Layer 3: Manual overrides always win
      if (input.countryMappings) {
        for (const mapping of input.countryMappings) {
          countryMap.set(mapping.featureId, mapping.countryId);
        }
      }

      // Pre-compute all record data outside the transaction
      const records = geojson.features.map((feature) => {
        const featureId = String(
          feature.id ?? feature.properties?.id ?? `unknown_${Math.random()}`
        );
        const displayName = String(feature.properties?.name ?? featureIdToDisplayName(featureId));
        const countryId = countryMap.get(featureId) ?? null;
        const coords = extractAllPositions(feature.geometry);
        const centroid =
          coords.length > 0
            ? [
                coords.reduce((s, c) => s + c[0]!, 0) / coords.length,
                coords.reduce((s, c) => s + c[1]!, 0) / coords.length,
              ]
            : null;
        let bbox: number[] | null = null;
        if (coords.length > 0) {
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
          for (const c of coords) {
            if (c[0]! < minX) minX = c[0]!;
            if (c[1]! < minY) minY = c[1]!;
            if (c[0]! > maxX) maxX = c[0]!;
            if (c[1]! > maxY) maxY = c[1]!;
          }
          bbox = [minX, minY, maxX, maxY];
        }
        return {
          featureId,
          displayName,
          countryId,
          geometry: feature.geometry,
          properties: (feature.properties ?? {}) as Record<string, unknown>,
          centroid,
          bbox,
        };
      });

      // Deduplicate by featureId (last occurrence wins) to avoid unique constraint violations
      const seenIds = new Map<string, number>();
      for (let i = 0; i < records.length; i++) {
        seenIds.set(records[i]!.featureId, i);
      }
      const dedupedRecords = [...seenIds.values()].sort((a, b) => a - b).map((i) => records[i]!);
      if (dedupedRecords.length < records.length) {
        console.warn(
          `[commitSvgUpload] Deduplicated ${records.length - dedupedRecords.length} duplicate featureIds`
        );
      }

      // Altitude enrichment: auto-enrich altitude features with zone metadata
      if (upload.layerType === "altitudes") {
        for (const r of dedupedRecords) {
          const props = r.properties as Record<string, unknown>;
          // Skip already-enriched features
          if (props.elevationMin != null) continue;
          const fillColor = (props.fill ?? props.fillColor ?? props.color) as string | undefined;
          if (fillColor) {
            const zone = getZoneByColor(fillColor);
            if (zone) {
              props.zoneId = zone.zoneId;
              props.zoneName = zone.zoneName;
              props.elevationMin = zone.elevationMin;
              props.elevationMax = zone.elevationMax;
              props.elevationLabel = `${zone.elevationMin}-${zone.elevationMax}m`;
            }
          }
        }
      }

      // Fast transaction: bulk delete + bulk create (2 queries instead of 233 upserts)
      await ctx.db.$transaction(
        async (tx) => {
          // Remove all existing records for this layer
          await tx.mapLayer.deleteMany({
            where: { layerType: upload.layerType },
          });

          // Bulk create all new records
          await tx.mapLayer.createMany({
            data: dedupedRecords.map((r) => ({
              layerType: upload.layerType,
              featureId: r.featureId,
              geometry: r.geometry as any,
              properties: (r.properties ?? {}) as any,
              countryId: r.countryId,
              displayName: r.displayName,
              centroid: r.centroid as any,
              boundingBox: r.bbox as any,
              isActive: true,
              sourceUploadId: upload.id,
            })),
          });

          // Mark this upload as active, deactivate others
          await tx.svgUpload.updateMany({
            where: { layerType: upload.layerType, isActive: true },
            data: { isActive: false },
          });
          // Store country linkages in svgMetadata for rollback recovery
          const countryLinkages = dedupedRecords
            .filter((r) => r.countryId)
            .map((r) => ({ featureId: r.featureId, countryId: r.countryId! }));
          await tx.svgUpload.update({
            where: { id: upload.id },
            data: {
              isActive: true,
              status: "committed",
              svgMetadata: {
                ...((upload.svgMetadata as Record<string, unknown>) ?? {}),
                countryLinkages,
              },
            },
          });
        },
        { timeout: 30000 }
      );

      // Update Country records outside the transaction (best-effort, non-blocking)
      if (upload.layerType === "political") {
        const countryUpdates = dedupedRecords.filter((r) => r.countryId);
        for (const r of countryUpdates) {
          try {
            await ctx.db.country.update({
              where: { id: r.countryId! },
              data: {
                geometry: r.geometry as any,
                centroid: r.centroid as any,
                boundingBox: r.bbox as any,
              },
            });
          } catch (e) {
            console.warn(
              `[commitSvgUpload] Failed to update country ${r.countryId}:`,
              e instanceof Error ? e.message : e
            );
          }
        }
      }

      // PostGIS area recalculation (best-effort, non-blocking)
      // The sync_map_layer_geom trigger auto-populates geom_postgis on INSERT
      try {
        await ctx.db.$executeRawUnsafe(
          `UPDATE map_layers SET "areaSqKm" = ST_Area(geom_postgis::geography) / 1000000.0
           WHERE "layerType" = $1 AND "isActive" = true AND geom_postgis IS NOT NULL`,
          upload.layerType
        );
      } catch (e) {
        console.warn("PostGIS area recalculation skipped:", e instanceof Error ? e.message : e);
      }

      // Clear cache for this layer
      clearLayerCache(upload.layerType);
      await invalidateCache([
        "geoCore.getWorldMap",
        "geoCore.getMapStats",
        "geoCore.getAllMapFeatures",
        "geoCore.listCountries",
      ]);
      broadcastMapUpdate("bulk", undefined);

      return {
        success: true,
        layerType: upload.layerType,
        featuresCommitted: dedupedRecords.length,
        countriesLinked: countryMap.size,
        linkagesPreserved: existingLinked.length,
      };
    }),

  /** Rollback to a previous SVG upload */
  rollbackSvgUpload: adminProcedure
    .input(z.object({ uploadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const targetUpload = await ctx.db.svgUpload.findUnique({
        where: { id: input.uploadId },
        select: { id: true, layerType: true, geojsonData: true, svgMetadata: true },
      });
      if (!targetUpload) throw new TRPCError({ code: "NOT_FOUND" });
      if (!targetUpload.geojsonData) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target upload has no GeoJSON data to restore",
        });
      }

      const geojson = targetUpload.geojsonData as unknown as FeatureCollection;

      // Snapshot the currently active upload BEFORE deactivating
      const currentActiveUpload = await ctx.db.svgUpload.findFirst({
        where: { layerType: targetUpload.layerType, isActive: true, id: { not: targetUpload.id } },
        select: { id: true },
      });

      // Load existing country linkages to preserve during rollback
      const existingLinks = await ctx.db.mapLayer.findMany({
        where: { layerType: targetUpload.layerType, countryId: { not: null } },
        select: { featureId: true, countryId: true },
      });
      const linkageMap = new Map(existingLinks.map((l) => [l.featureId, l.countryId!]));

      // Also check if linkages were stored in svgMetadata at commit time
      const metaLinkages = (targetUpload.svgMetadata as Record<string, unknown>)
        ?.countryLinkages as Array<{ featureId: string; countryId: string }> | undefined;
      if (metaLinkages) {
        for (const l of metaLinkages) linkageMap.set(l.featureId, l.countryId);
      }

      await ctx.db.$transaction(
        async (tx) => {
          await tx.mapLayer.deleteMany({
            where: { layerType: targetUpload.layerType },
          });

          // Rebuild full records with centroid, bbox, displayName, and preserved linkages
          const rollbackRecords = geojson.features.map((feature) => {
            const featureId = String(feature.id ?? feature.properties?.id ?? "unknown");
            const displayName = String(
              feature.properties?.name ?? featureIdToDisplayName(featureId)
            );
            const countryId = linkageMap.get(featureId) ?? null;
            const coords = extractAllPositions(feature.geometry);
            const centroid =
              coords.length > 0
                ? [
                    coords.reduce((s, c) => s + c[0]!, 0) / coords.length,
                    coords.reduce((s, c) => s + c[1]!, 0) / coords.length,
                  ]
                : null;
            let bbox: number[] | null = null;
            if (coords.length > 0) {
              let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;
              for (const c of coords) {
                if (c[0]! < minX) minX = c[0]!;
                if (c[1]! < minY) minY = c[1]!;
                if (c[0]! > maxX) maxX = c[0]!;
                if (c[1]! > maxY) maxY = c[1]!;
              }
              bbox = [minX, minY, maxX, maxY];
            }
            return {
              layerType: targetUpload.layerType,
              featureId,
              displayName,
              countryId,
              geometry: feature.geometry as any,
              properties: (feature.properties ?? {}) as any,
              centroid: centroid as any,
              boundingBox: bbox as any,
              isActive: true,
              sourceUploadId: targetUpload.id,
            };
          });
          await tx.mapLayer.createMany({ data: rollbackRecords });

          // Update upload statuses
          await tx.svgUpload.updateMany({
            where: { layerType: targetUpload.layerType, isActive: true },
            data: { isActive: false },
          });
          await tx.svgUpload.update({
            where: { id: targetUpload.id },
            data: { isActive: true, status: "processed" },
          });

          // Mark the previously active upload as rolled back
          if (currentActiveUpload) {
            await tx.svgUpload.update({
              where: { id: currentActiveUpload.id },
              data: { status: "rolled_back" },
            });
          }
        },
        { timeout: 30000 }
      );

      clearLayerCache(targetUpload.layerType);
      await invalidateCache([
        "geoCore.getWorldMap",
        "geoCore.getMapStats",
        "geoCore.getAllMapFeatures",
        "geoCore.listCountries",
      ]);
      broadcastMapUpdate("bulk");

      return { success: true, restoredUploadId: targetUpload.id };
    }),

  /** Get SVG upload history for a layer type */
  getSvgUploadHistory: adminProcedure
    .input(z.object({ layerType: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const uploads = await ctx.db.svgUpload.findMany({
        where: input.layerType ? { layerType: input.layerType } : undefined,
        select: {
          id: true,
          layerType: true,
          fileName: true,
          fileSizeBytes: true,
          status: true,
          featureCount: true,
          errorMessage: true,
          isActive: true,
          uploadedBy: true,
          processedAt: true,
          createdAt: true,
          svgMetadata: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return uploads;
    }),

  /** Delete a non-active SVG upload */
  deleteSvgUpload: adminProcedure
    .input(z.object({ uploadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const upload = await ctx.db.svgUpload.findUnique({
        where: { id: input.uploadId },
        select: { id: true, isActive: true, status: true },
      });
      if (!upload) throw new TRPCError({ code: "NOT_FOUND" });
      if (upload.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete the currently active upload. Roll back first.",
        });
      }

      await ctx.db.svgUpload.delete({ where: { id: input.uploadId } });
      return { success: true };
    }),

  // ──────────────────────────────────────────────────────────────
  // World Template / Clone System (Phase 3)
  // ──────────────────────────────────────────────────────────────

  /** Export current world as a template */
  exportWorldTemplate: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        isPublic: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Gather all active map layers grouped by type
      const allLayers = await ctx.db.mapLayer.findMany({
        where: { isActive: true },
        select: {
          layerType: true,
          featureId: true,
          geometry: true,
          properties: true,
          displayName: true,
          areaSqKm: true,
          centroid: true,
          boundingBox: true,
          countryId: true,
        },
      });

      // Group into FeatureCollections by layer type
      const layerMap: Record<string, { type: string; features: unknown[] }> = {};
      for (const layer of allLayers) {
        if (!layerMap[layer.layerType]) {
          layerMap[layer.layerType] = { type: "FeatureCollection", features: [] };
        }
        layerMap[layer.layerType]!.features.push({
          type: "Feature",
          id: layer.featureId,
          geometry: layer.geometry,
          properties: {
            ...(layer.properties as Record<string, unknown>),
            featureId: layer.featureId,
            displayName: layer.displayName,
            areaSqKm: layer.areaSqKm,
            countryId: layer.countryId,
          },
        });
      }

      // Gather country data
      const countries = await ctx.db.country.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          region: true,
        },
      });

      // Gather sovereignty relationships
      const sovereignty = await ctx.db.countrySovereignty.findMany({
        select: {
          sovereignId: true,
          subjectId: true,
          relationshipType: true,
          autonomyLevel: true,
          description: true,
        },
      });

      // Build feature counts
      const featureCounts: Record<string, number> = {};
      for (const [layerType, fc] of Object.entries(layerMap)) {
        featureCounts[layerType] = fc.features.length;
      }

      const templateData = JSON.stringify({
        layers: layerMap,
        countries: countries.map((c) => ({
          name: c.name,
          slug: c.slug,
          flagCode: c.flag,
          region: c.region,
        })),
        sovereignty: sovereignty.map((s) => ({
          sovereign: s.sovereignId,
          subject: s.subjectId,
          type: s.relationshipType,
          autonomy: s.autonomyLevel,
          description: s.description,
        })),
      });

      const template = await ctx.db.worldTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          createdBy: ctx.auth!.userId ?? "system",
          metadata: {
            featureCounts,
            totalFeatures: allLayers.length,
            totalCountries: countries.length,
            layerTypes: Object.keys(layerMap),
            exportedAt: new Date().toISOString(),
          },
          layers: layerMap as any,
          countries: countries.map((c) => ({
            name: c.name,
            slug: c.slug,
            flagCode: c.flag,
            region: c.region,
          })),
          sovereignty: sovereignty.map((s) => ({
            sovereign: s.sovereignId,
            subject: s.subjectId,
            type: s.relationshipType,
            autonomy: s.autonomyLevel,
          })),
          fileSizeBytes: Buffer.byteLength(templateData, "utf-8"),
          isPublic: input.isPublic,
        },
      });

      return {
        templateId: template.id,
        name: template.name,
        featureCounts,
        totalFeatures: allLayers.length,
        fileSizeBytes: template.fileSizeBytes,
      };
    }),

  /** Download full template JSON for file export */
  downloadWorldTemplate: adminProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.worldTemplate.findUnique({
        where: { id: input.templateId },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        version: template.version,
        metadata: template.metadata,
        layers: template.layers,
        countries: template.countries,
        sovereignty: template.sovereignty,
        mapConfig: template.mapConfig,
      };
    }),

  /** Import a world template (replace or merge mode) */
  importWorldTemplate: adminProcedure
    .input(
      z.object({
        templateId: z.string().optional(),
        templateJson: z.string().optional(), // Direct JSON import
        mode: z.enum(["replace", "merge"]).default("replace"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let layers: Record<
        string,
        {
          features: Array<{ id?: string; geometry: unknown; properties?: Record<string, unknown> }>;
        }
      >;
      let templateName = "direct import";

      if (input.templateId) {
        const template = await ctx.db.worldTemplate.findUnique({
          where: { id: input.templateId },
        });
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });
        layers = template.layers as typeof layers;
        templateName = template.name;
      } else if (input.templateJson) {
        try {
          const parsed = JSON.parse(input.templateJson) as { layers: typeof layers };
          layers = parsed.layers;
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid template JSON",
          });
        }
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provide either templateId or templateJson",
        });
      }

      const log: string[] = [];
      let totalImported = 0;

      if (input.mode === "replace") {
        // Deactivate all existing features
        const deactivated = await ctx.db.mapLayer.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
        log.push(`Deactivated ${deactivated.count} existing features`);
      }

      // Import each layer
      for (const [layerType, fc] of Object.entries(layers)) {
        if (!fc.features || !Array.isArray(fc.features)) continue;

        if (input.mode === "merge") {
          // In merge mode, deactivate existing features of this layer type only
          await ctx.db.mapLayer.updateMany({
            where: { layerType, isActive: true },
            data: { isActive: false },
          });
        }

        const records = fc.features.map((f) => {
          const props = (f.properties || {}) as Record<string, unknown>;
          return {
            layerType,
            featureId:
              (props.featureId as string) ||
              (f.id as string) ||
              `imported-${Math.random().toString(36).slice(2, 10)}`,
            geometry: f.geometry as any,
            properties: props as any,
            displayName: (props.displayName as string) || null,
            areaSqKm: (props.areaSqKm as number) || null,
            centroid: (props.centroid as any) || null,
            boundingBox: (props.boundingBox as any) || null,
            countryId: (props.countryId as string) || null,
            isActive: true,
          };
        });

        // Batch insert
        const created = await ctx.db.mapLayer.createMany({
          data: records,
          skipDuplicates: true,
        });

        log.push(`${layerType}: imported ${created.count} features`);
        totalImported += created.count;
      }

      log.push(`Import complete from template: ${templateName}`);

      return { totalImported, log };
    }),

  /** List saved world templates (metadata only) */
  listWorldTemplates: adminProcedure
    .input(
      z
        .object({
          includePublic: z.boolean().optional().default(true),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where = input?.includePublic
        ? { OR: [{ createdBy: ctx.auth!.userId }, { isPublic: true }] }
        : { createdBy: ctx.auth!.userId };

      return ctx.db.worldTemplate.findMany({
        where: where as any,
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          createdBy: true,
          metadata: true,
          fileSizeBytes: true,
          isPublic: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /** Delete a world template */
  deleteWorldTemplate: adminProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.worldTemplate.findUnique({
        where: { id: input.templateId },
        select: { id: true, createdBy: true },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.worldTemplate.delete({ where: { id: input.templateId } });
      return { success: true };
    }),

  // ──────────────────────────────────────────────────────────────
  // Procedural World Generation (Phase 4)
  // ──────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Map Pipeline Endpoints
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Province Import Endpoints
  // ──────────────────────────────────────────────

  /**
   * Parse an uploaded province SVG and return parsed province features.
   * Also returns the country border geometry for alignment.
   */
  parseProvinceUpload: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        uploadId: z.string().optional(),
        svgContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only import provinces for your own country",
        });
      }

      // Get content from upload record or direct input
      let svgContent = input.svgContent;
      let isPng = false;
      let pngBase64: string | undefined;

      if (!svgContent && input.uploadId) {
        const upload = await ctx.db.svgUpload.findUnique({
          where: { id: input.uploadId },
        });
        if (!upload) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
        }
        const isAdmin = !ctx.country; // countryOwnerMiddleware sets ctx.country = null for admins
        if (!isAdmin && upload.uploadedBy !== (ctx.auth?.userId ?? ctx.user?.clerkUserId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this upload" });
        }

        // Detect PNG: check file extension from metadata or filename
        const meta = upload.svgMetadata as Record<string, unknown> | null;
        const fileType = (meta?.fileType as string) ?? "";
        const fileName = upload.fileName ?? "";
        isPng = fileType === "png" || fileName.toLowerCase().endsWith(".png");

        if (isPng) {
          pngBase64 = upload.svgContent ?? undefined;
        } else {
          svgContent = upload.svgContent ?? undefined;
        }
      }

      // Also detect PNG from direct svgContent (base64-encoded PNG starts without '<')
      if (svgContent && !svgContent.trimStart().startsWith("<")) {
        isPng = true;
        pngBase64 = svgContent;
        svgContent = undefined;
      }

      // Get country border geometry (needed for both SVG and PNG paths)
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { countryId: input.countryId, layerType: "political" },
        select: { geometry: true },
      });

      if (isPng && pngBase64) {
        // PNG path: extract provinces directly via boundary-line detection
        const pngBuffer = Buffer.from(pngBase64, "base64");
        const { extractProvincesFromPng } = await import("~/lib/png-to-svg");

        const result = await extractProvincesFromPng(pngBuffer);

        return {
          provinces: result.provinces,
          viewBox: { width: result.width, height: result.height },
          log: result.log,
          layersFound: ["png-boundary-detection"],
          countryBorder: mapLayer?.geometry ?? null,
        };
      }

      if (!svgContent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "SVG or PNG content required (provide uploadId or svgContent)",
        });
      }

      // Preprocess SVG (strip non-visual elements, remove fragments, normalize)
      const { preprocessSvg } = await import("~/lib/province-importer/svg-preprocessor");
      const preprocessed = preprocessSvg(svgContent);

      // Parse provinces from cleaned SVG
      const { parseProvinceSvg } = await import("~/lib/province-importer/parse-provinces");
      const result = parseProvinceSvg(preprocessed.svgContent);

      // Prepend preprocessing log
      result.log.unshift(...preprocessed.log);

      return {
        provinces: result.provinces,
        viewBox: result.viewBox,
        log: result.log,
        layersFound: result.layersFound,
        countryBorder: mapLayer?.geometry ?? null,
      };
    }),

  /**
   * Validate province geometries against the country border using PostGIS.
   */
  validateProvinceImport: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        provinces: z.array(
          z.object({
            name: z.string(),
            geometry: z.record(z.string(), z.unknown()),
          })
        ),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only validate provinces for your own country",
        });
      }

      const validationResults: Array<{
        name: string;
        isValid: boolean;
        isContained: boolean;
        issues: string[];
      }> = [];

      for (const province of input.provinces) {
        const issues: string[] = [];
        let isValid = true;
        let isContained = true;

        try {
          const geoJson = JSON.stringify(province.geometry);

          // Check geometry validity
          const validResult = await ctx.db.$queryRawUnsafe<
            Array<{ is_valid: boolean; reason: string | null }>
          >(
            `SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as is_valid,
                    ST_IsValidReason(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as reason`,
            geoJson
          );
          if (validResult[0] && !validResult[0].is_valid) {
            isValid = false;
            issues.push(`Invalid geometry: ${validResult[0].reason}`);
          }

          // Check containment within country
          const containResult = await ctx.db.$queryRawUnsafe<Array<{ is_inside: boolean }>>(
            `SELECT ST_Contains(
               (SELECT geom_postgis FROM map_layers WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL LIMIT 1),
               ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)
             ) as is_inside`,
            input.countryId,
            geoJson
          );
          if (containResult[0] && !containResult[0].is_inside) {
            isContained = false;
            issues.push("Province extends beyond country borders");
          }
        } catch (err) {
          issues.push(
            `PostGIS validation failed: ${err instanceof Error ? err.message : "unknown error"}`
          );
        }

        validationResults.push({
          name: province.name,
          isValid,
          isContained,
          issues,
        });
      }

      return { results: validationResults };
    }),

  /**
   * Commit imported provinces as Subdivision records.
   * Creates all subdivisions in a single transaction.
   */
  commitProvinceImport: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        provinces: z.array(
          z.object({
            name: z.string().min(1).max(100),
            type: z.string().default("province"),
            geometry: z.record(z.string(), z.unknown()),
            level: z.number().int().min(1).max(5).default(1),
            capital: z.string().optional(),
            population: z.number().int().min(0).optional(),
            color: z.string().optional(),
          })
        ),
        replaceExisting: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only import provinces for your own country",
        });
      }

      const userId = ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system";

      // Server-side validation: check coordinate bounds on all province geometries
      for (const province of input.provinces) {
        if ("coordinates" in province.geometry) {
          const { validateGeometryBounds } = await import("~/lib/geo-validation");
          validateGeometryBounds(province.geometry as unknown as import("geojson").Geometry);
        }
      }

      // Check for duplicate names within the import batch
      const nameSet = new Set<string>();
      for (const province of input.provinces) {
        const key = province.name.trim().toLowerCase();
        if (nameSet.has(key)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Duplicate province name in import: "${province.name}"`,
          });
        }
        nameSet.add(key);
      }

      // Check for name conflicts with existing subdivisions (unless replacing)
      if (!input.replaceExisting) {
        for (const province of input.provinces) {
          await checkNameUniqueness(ctx.db as any, input.countryId, province.name, "subdivision");
        }
      }

      return await ctx.db.$transaction(async (tx) => {
        // Optionally delete existing subdivisions
        if (input.replaceExisting) {
          await tx.subdivision.deleteMany({
            where: { countryId: input.countryId },
          });
        }

        // Batch create subdivisions
        const created: Array<{ id: string; name: string }> = [];
        for (const province of input.provinces) {
          const subdivision = await tx.subdivision.create({
            data: {
              name: province.name,
              countryId: input.countryId,
              type: province.type,
              level: province.level,
              geometry: province.geometry as any,
              capital: province.capital,
              population: province.population,
              color: province.color,
              status: "approved",
              submittedBy: userId,
            },
          });
          created.push({ id: subdivision.id, name: subdivision.name });
        }

        return {
          created: created.length,
          replaced: input.replaceExisting,
          subdivisions: created,
        };
      });
    }),

  /**
   * Get existing subdivisions and country border for province import preview.
   */
  getProvinceImportPreview: countryOwnerProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only preview your own country",
        });
      }

      const [subdivisions, mapLayer] = await Promise.all([
        ctx.db.subdivision.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: {
            id: true,
            name: true,
            type: true,
            level: true,
            geometry: true,
            capital: true,
            population: true,
          },
        }),
        ctx.db.mapLayer.findFirst({
          where: { countryId: input.countryId, layerType: "political" },
          select: { geometry: true, featureId: true },
        }),
      ]);

      return {
        existingSubdivisions: subdivisions,
        countryBorder: mapLayer?.geometry ?? null,
        featureId: mapLayer?.featureId ?? null,
      };
    }),

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────
});


