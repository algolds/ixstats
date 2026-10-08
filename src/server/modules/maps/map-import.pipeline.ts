/**
 * The Full Pipeline's layer import (geoEditor.importPipelineResult) on the shared realm map writer: validated
 * geometry, batched transactions with an explicit timeout, display names, PostGIS geometry and areas. A replacing
 * import retires only the stale features of the layer types it brings (never every layer), and every import keeps
 * a rollback snapshot (MapImport). The political layer's shared vertex index and adjacency are rebuilt after.
 */
import type { FeatureCollection } from "geojson";
import type { PrismaClient } from "@prisma/client";
import {
  deactivateOtherFeatures,
  writeRealmMapFeatures,
  type RealmMapFeatureInput,
} from "~/lib/maps/realm-map-writer";
import { captureMapSnapshot, packSnapshot } from "~/lib/maps/realm-map-snapshot";
import { refreshRealmMap } from "./map-import.apply";

export interface PipelineLayerWrite {
  realmId: string;
  layers: Record<string, FeatureCollection | null | undefined>;
  mode: "merge" | "replace";
  createdBy: string;
  /** The background job writing it (a realm map pipeline run), recorded on the map import. */
  jobId?: string | null;
}

export interface PipelineLayerResult {
  imported: number;
  rejected: Array<{ layerType: string; key: string; reason: string }>;
  deactivated: number;
  mode: "merge" | "replace";
  adjacencyBuilt: boolean;
  mapImportId: string | null;
}

function layerFeatures(layerType: string, collection: FeatureCollection): RealmMapFeatureInput[] {
  return collection.features
    .filter((feature) => feature?.geometry)
    .map((feature, index) => {
      // Worldgen features carry numeric ids; featureId is a String column
      const rawId = feature.properties?.featureId ?? feature.id;
      const key =
        rawId !== undefined && rawId !== null && String(rawId) !== ""
          ? String(rawId)
          : `${layerType}_${index}`;
      const rawName = feature.properties?.name ?? feature.properties?.displayName;
      return {
        key,
        geometry: feature.geometry,
        name: typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 200) : null,
        properties: (feature.properties ?? {}) as Record<string, unknown>,
      };
    });
}

async function rebuildSharedVertices(
  db: PrismaClient,
  realmId: string,
  political: FeatureCollection
) {
  try {
    const { buildSharedVertexIndex } = await import("~/lib/maps/shared-vertex-builder");
    const sharedVertices = buildSharedVertexIndex(
      political.features
        .filter((f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon")
        .map((f) => ({
          featureId: (f.properties?.featureId as string) ?? (f.id as string) ?? "",
          geometry: f.geometry as import("geojson").Polygon | import("geojson").MultiPolygon,
        }))
    );
    await db.sharedVertex.deleteMany({ where: { realmId } });
    if (sharedVertices.length > 0) {
      await db.sharedVertex.createMany({
        data: sharedVertices.map((sv) => ({
          lng: sv.lng,
          lat: sv.lat,
          featureRefs: sv.featureRefs as object,
          realmId,
        })),
      });
    }
  } catch {
    // Shared vertex build failed — non-blocking
  }
}

export async function writePipelineLayers(
  db: PrismaClient,
  input: PipelineLayerWrite
): Promise<PipelineLayerResult> {
  const entries = Object.entries(input.layers).flatMap(([layerType, collection]) =>
    collection?.features
      ? [{ layerType, collection, features: layerFeatures(layerType, collection) }]
      : []
  );
  const result: PipelineLayerResult = {
    imported: 0,
    rejected: [],
    deactivated: 0,
    mode: input.mode,
    adjacencyBuilt: false,
    mapImportId: null,
  };
  if (entries.length === 0) return result;

  const snapshot = await captureMapSnapshot(
    db,
    input.realmId,
    entries.map((e) => ({
      layerType: e.layerType,
      keys: e.features.map((f) => f.key),
      wholeLayer: input.mode === "replace",
      countryIds: [],
    }))
  );

  for (const entry of entries) {
    const written = await writeRealmMapFeatures(db, input.realmId, entry.features, {
      layerType: entry.layerType,
      geometryKinds: entry.layerType === "political" ? "polygonal" : "any",
    });
    result.imported += written.written.length;
    result.rejected.push(...written.rejected.map((r) => ({ layerType: entry.layerType, ...r })));
    if (input.mode === "replace") {
      result.deactivated += await deactivateOtherFeatures(
        db,
        input.realmId,
        entry.layerType,
        written.written
      );
    }
  }

  const packed = packSnapshot(snapshot);
  const record = await db.mapImport.create({
    data: {
      realmId: input.realmId,
      jobId: input.jobId ?? null,
      layerTypes: entries.map((e) => e.layerType),
      mode: input.mode,
      createdBy: input.createdBy,
      summary: {
        written: result.imported,
        rejected: result.rejected.length,
        deactivated: result.deactivated,
        source: "pipeline",
      },
      snapshot: packed.bytes,
      snapshotBytes: packed.size,
      rollbackAvailable: packed.bytes !== null,
    },
    select: { id: true },
  });
  result.mapImportId = record.id;

  const political = input.layers.political;
  if (political?.features) {
    await rebuildSharedVertices(db, input.realmId, political);
    result.adjacencyBuilt = (await refreshRealmMap(db, input.realmId)) !== null;
  } else {
    await refreshRealmMap(db, input.realmId, { adjacency: false });
  }
  return result;
}
