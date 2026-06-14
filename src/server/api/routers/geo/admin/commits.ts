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
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/map-update-bus";
import type { FeatureCollection } from "geojson";
import { featureIdToDisplayName } from "~/lib/map-utils";
import { getZoneByColor } from "~/lib/elevation-config";
import { clearLayerCache, extractAllPositions } from "../core";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo-service";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoAdminCommitsRouter = createTRPCRouter({
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
            await syncCountryGeometryFromMapLayer(ctx.db, r.countryId!);
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
