/**
 * The pipeline's `physical` step: the realm's physical layers traced from its map art by the PNG layer engine
 * (src/lib/maps/import/png/layer-engine.ts; in a worker thread under Bun): land and lakes from the blank map and,
 * when the config names their art, climate zones (with the climate key), ice caps, elevation bands and rivers.
 * The traced features are compared with the stored ones exactly as the realm map writer would store them, so a dry
 * run lists what an apply would create, change or retire, and an apply with nothing to change writes nothing. An
 * apply replaces each traced layer type as one map import (with a rollback snapshot), sets the climate key and
 * measures the areas again.
 */
import type { Prisma } from "@prisma/client";
import type { FeatureCollection, Polygon, Position } from "geojson";
import { readClimateKeySource } from "~/lib/maps/import/climate-key-source";
import type {
  LayerEngineResult,
  LayerEngineSources,
  LayerFeature,
} from "~/lib/maps/import/png/layer-engine";
import type { RealmLayerConfig } from "~/lib/maps/import/realm-layer-config";
import { runLayerEngineTask } from "~/lib/maps/import/run-engine";
import { isPostGISAvailable } from "~/lib/maps/geo-validation";
import { haversineKm, sphericalRingAreaSqKm } from "~/lib/maps/planet";
import { repairPolygonalGeometry } from "~/lib/maps/realm-geometry-repair";
import {
  parseRealmMapSettings,
  realmRadiusKm,
  withRealmMapSettings,
  type ClimateKey,
} from "~/lib/maps/realm-map-settings";
import { recomputeRealmMapAreas } from "~/server/modules/realms/realms.map";
import { writePipelineLayers } from "./map-import.pipeline";
import { artText, type ArtResolver } from "./realm-map-pipeline.art";
import {
  capDetails,
  changedStatus,
  currentSettings,
  skipped,
  type StepContext,
  type StepReport,
} from "./realm-map-pipeline.context";

const polygonAreaKm2 = (polygon: Polygon, radiusKm: number) =>
  polygon.coordinates.reduce(
    (sum, ring, i) => sum + (i === 0 ? 1 : -1) * sphericalRingAreaSqKm(ring, radiusKm),
    0
  );

const lineKm = (line: Position[], radiusKm: number) =>
  line.reduce((sum, p, i) => (i === 0 ? 0 : sum + haversineKm(line[i - 1]!, p, radiusKm)), 0);

/** A feature's area in km² (a polygon) or its length in km (a river). */
function measureKm(geometry: LayerFeature["geometry"], radiusKm: number): number {
  if (geometry.type === "Polygon") return polygonAreaKm2(geometry, radiusKm);
  const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
  return lines.reduce((sum, line) => sum + lineKm(line, radiusKm), 0);
}

const vertexCount = (geometry: LayerFeature["geometry"]) =>
  geometry.type === "LineString"
    ? geometry.coordinates.length
    : geometry.coordinates.reduce((n, part) => n + part.length, 0);

function layerLines(result: LayerEngineResult, radiusKm: number): string[] {
  return Object.entries(result.layers).map(([layerType, features]) => {
    const vertices = features.reduce((n, f) => n + vertexCount(f.geometry), 0);
    const total = features.reduce((sum, f) => sum + measureKm(f.geometry, radiusKm), 0);
    const unit = layerType === "rivers" ? "km" : "km²";
    return `${layerType}: ${features.length} features, ${vertices} vertices, ${Math.round(total).toLocaleString("en-US")} ${unit}`;
  });
}

/** The climate key: typed in, or read (as literals, never run) from a data file of the art. */
async function climateKey(
  config: NonNullable<RealmLayerConfig["climate"]>,
  art: ArtResolver
): Promise<ClimateKey> {
  if (!("art" in config.key)) return config.key;
  return readClimateKeySource(await artText(art, config.key.art), config.key);
}

/** The engine's sources: each art key read once (the resolver caches it). */
async function readSources(
  config: RealmLayerConfig,
  art: ArtResolver
): Promise<{ sources: LayerEngineSources; key: ClimateKey | null }> {
  const image = async (key: string) => (await art(key)).bytes;
  const { climate, ice, elevation, rivers } = config;
  const key = climate ? await climateKey(climate, art) : null;
  return {
    key,
    sources: {
      land: await image(config.land),
      ...(climate && key && { climate: { image: await image(climate.art), key } }),
      ...(ice && { ice: await image(ice.art) }),
      ...(elevation && {
        elevation: { image: await image(elevation.art), bands: elevation.bands },
      }),
      ...(rivers && { rivers: { image: await image(rivers.art), colours: rivers.colours } }),
    },
  };
}

/** Coordinates closer than this (degrees, about 0.1 mm) are the same: floating-point noise of the arithmetic. */
const SAME_COORDINATE = 1e-9;

type JsonLike = Prisma.JsonValue | object | undefined;

/**
 * Two JSON values (outlines, properties) equal but for coordinate noise (SAME_COORDINATE); object key order is
 * ignored, as Postgres does not keep it.
 */
function nearlyEqual(a: JsonLike, b: JsonLike): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= SAME_COORDINATE;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v: JsonLike, i) => nearlyEqual(v, b[i] as JsonLike));
  }
  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((k) => nearlyEqual((a as Prisma.JsonObject)[k], (b as Prisma.JsonObject)[k]))
    );
  }
  return a === b;
}

interface LayerDiff {
  created: number;
  changed: number;
  retired: number;
  unchanged: number;
}

const changes = (diff: LayerDiff) => diff.created + diff.changed + diff.retired;

/** What the writer stores for a traced feature: repaired outline, the name as a property and as its name. */
async function storedForm(
  ctx: StepContext,
  feature: LayerFeature,
  postgis: boolean
): Promise<{ geometry: object | undefined; properties: object; name: string }> {
  const geometry =
    feature.geometry.type === "Polygon"
      ? await repairPolygonalGeometry(ctx.db, feature.geometry, postgis)
      : feature.geometry;
  return {
    geometry: geometry ?? undefined,
    properties: { ...feature.properties, name: feature.name },
    name: feature.name.trim().slice(0, 200),
  };
}

/** Each traced layer compared with the realm's stored features of that type. */
async function diffLayers(
  ctx: StepContext,
  result: LayerEngineResult
): Promise<Record<string, LayerDiff>> {
  const postgis = await isPostGISAvailable(ctx.db);
  const diffs: Record<string, LayerDiff> = {};
  for (const [layerType, features] of Object.entries(result.layers)) {
    const stored = await ctx.db.mapLayer.findMany({
      where: { realmId: ctx.realm.id, layerType, isActive: true },
      select: { featureId: true, displayName: true, properties: true, geometry: true },
    });
    const byKey = new Map(stored.map((row) => [row.featureId, row]));
    const diff: LayerDiff = { created: 0, changed: 0, retired: 0, unchanged: 0 };
    for (const feature of features) {
      const row = byKey.get(feature.key);
      byKey.delete(feature.key);
      if (!row) {
        diff.created++;
        continue;
      }
      const form = await storedForm(ctx, feature, postgis);
      const same =
        nearlyEqual(form.geometry, row.geometry) &&
        nearlyEqual(form.properties, row.properties) &&
        (!form.name || form.name === row.displayName);
      diff[same ? "unchanged" : "changed"]++;
    }
    diff.retired = byKey.size;
    diffs[layerType] = diff;
  }
  return diffs;
}

/** The traced features as the pipeline writer reads them: key as the feature id, name as a property. */
const collection = (features: LayerFeature[]): FeatureCollection => ({
  type: "FeatureCollection",
  features: features.map((f) => ({
    type: "Feature",
    id: f.key,
    properties: { ...f.properties, name: f.name },
    geometry: f.geometry,
  })),
});

async function write(
  ctx: StepContext,
  result: LayerEngineResult,
  key: ClimateKey | null,
  keyChanged: boolean
): Promise<string[]> {
  const written = await writePipelineLayers(ctx.db, {
    realmId: ctx.realm.id,
    layers: Object.fromEntries(Object.entries(result.layers).map(([t, f]) => [t, collection(f)])),
    mode: "replace",
    createdBy: ctx.requestedBy,
    jobId: ctx.jobId,
  });
  const lines = [
    `written: ${written.imported} features, ${written.deactivated} previous retired, map import ${written.mapImportId}`,
    ...written.rejected.map((r) => `rejected ${r.layerType}/${r.key}: ${r.reason}`),
  ];
  if (key && keyChanged) {
    await ctx.db.realm.update({
      where: { id: ctx.realm.id },
      data: {
        settings: withRealmMapSettings(await currentSettings(ctx), {
          climateKey: key,
        }) as Prisma.InputJsonValue,
      },
    });
    lines.push(`climate key: ${key.system}, ${key.zones.length} zones`);
  }
  const areas = await recomputeRealmMapAreas(ctx.db, ctx.actor, ctx.realm.id);
  lines.push(`areas measured again: ${areas.updated} features (radius ${areas.radiusKm} km)`);
  return lines;
}

export async function runPhysicalStep(ctx: StepContext): Promise<StepReport> {
  const config = ctx.pipeline.physical;
  if (!config) return skipped("No physical layers in the pipeline");
  ctx.progress(0.02, "Reading the art");
  const { sources, key } = await readSources(config, ctx.art);
  const engine = ctx.deps.runLayerEngine ?? runLayerEngineTask;
  const result = await engine(
    sources,
    config.engine ?? {},
    (percent, stage) => ctx.progress(0.05 + (percent / 100) * 0.65, stage),
    ctx.isCancelled
  );
  ctx.progress(0.72, "Comparing with the stored layers");
  const settings = await currentSettings(ctx);
  const diffs = await diffLayers(ctx, result);
  const stored = parseRealmMapSettings(settings).climateKey;
  const keyChanged = key !== null && !nearlyEqual(key, stored);
  const total = Object.values(diffs).reduce((n, d) => n + changes(d), 0);
  const diffLines = Object.entries(diffs).map(
    ([layer, d]) =>
      `${layer}: ${d.created} new, ${d.changed} changed, ${d.retired} retired, ${d.unchanged} unchanged`
  );
  const lines = [
    ...result.log,
    ...layerLines(result, realmRadiusKm(settings)),
    ...diffLines,
    ...(keyChanged ? ["the climate key changes"] : []),
  ];
  const changed = total > 0 || keyChanged;
  if (changed && !ctx.dryRun) {
    ctx.progress(0.8, "Writing the layers");
    lines.push(...(await write(ctx, result, key, keyChanged)));
  }
  return {
    status: changed ? changedStatus(ctx) : "unchanged",
    summary: `${Object.keys(diffs).join(", ")}: ${total} feature changes${keyChanged ? ", a new climate key" : ""}`,
    details: capDetails(lines),
    counts: { changes: total, climateKey: keyChanged ? 1 : 0 },
  };
}
