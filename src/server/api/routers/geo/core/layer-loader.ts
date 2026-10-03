import { readFile } from "fs/promises";
import { join } from "path";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import {
  splitCollectionAtAntimeridian,
  preparePoliticalFeatures,
  featureIdToDisplayName,
} from "~/lib/maps/map-utils";
import { compressFeatureCollection } from "~/lib/maps/geojson-compress";
import {
  DEFAULT_COUNTRY_COLORS,
  SOVEREIGNTY_TYPE_MAP,
  getSovereigntyColor,
  DEMOTED_COUNTRY_NAMES,
} from "~/lib/maps/map-config";
import {
  getCached,
  setCache,
  getCompressionForLayer,
  layerInflight,
  type ZoomBucket,
} from "./cache";
import { centroidLngLat, computeApproxAreaForFeature, computeVisualCenter } from "./geometry";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";

/** Warms IxWorld's layers only — other realms build on first request. */
export async function warmGeoCache(db: any): Promise<void> {
  const start = Date.now();
  const layers = [
    "background",
    "altitudes",
    "political",
    "rivers",
    "icecaps",
    "climate",
    "lakes",
    "country_labels",
  ];
  let warmed = 0;

  console.log(`[GeoCache] Warming cache for ${layers.length} layers...`);
  const zoomBuckets: ZoomBucket[] = [0, 1, 2];

  let totalBytes = 0;
  for (const zoomBucket of zoomBuckets) {
    console.log(`[GeoCache]   Zoom Bucket ${zoomBucket}:`);
    for (const layerType of layers) {
      try {
        const result = await loadLayerFromDB(db, layerType, zoomBucket, DEFAULT_REALM_ID);
        if (result) {
          warmed++;
          const bytes = JSON.stringify(result).length;
          totalBytes += bytes;
          console.log(
            `[GeoCache]     ${layerType}: ${(bytes / 1024 / 1024).toFixed(2)}MB, ${result.features.length} features`
          );
        }
      } catch (err) {
        console.warn(`[GeoCache] Failed to warm ${layerType} (z${zoomBucket}):`, err);
      }
    }
  }

  console.log(
    `[GeoCache] Warmed ${warmed} layer-zoom combinations in ${Date.now() - start}ms — total ${(totalBytes / 1024 / 1024).toFixed(2)}MB`
  );
}

/**
 * Lightweight cache warm-up for dev mode.
 * Only warms critical layers at default zoom bucket (1) — 4 queries instead of 24.
 * Runs as fire-and-forget at startup so the first map load is instant.
 */
export async function warmGeoCacheDev(db: any): Promise<void> {
  const start = Date.now();
  const criticalLayers = ["background", "altitudes", "political", "country_labels"];
  const defaultZoom: ZoomBucket = 1;

  console.log(
    `[GeoCache] Dev warm-up: ${criticalLayers.length} critical layers at z${defaultZoom}...`
  );

  await Promise.all(
    criticalLayers.map(async (layerType) => {
      try {
        const result = await loadLayerFromDB(db, layerType, defaultZoom, DEFAULT_REALM_ID);
        if (result) {
          console.log(`[GeoCache]   ${layerType}: ${result.features.length} features`);
        }
      } catch (err) {
        console.warn(`[GeoCache] Failed to warm ${layerType}:`, err);
      }
    })
  );

  console.log(`[GeoCache] Dev warm-up done in ${Date.now() - start}ms`);
}

const GEOJSON_DIR = join(process.cwd(), "scripts", "geojson_fixed");

async function loadGeoJSONFromFile(layerType: string): Promise<FeatureCollection> {
  const filePath = join(GEOJSON_DIR, `${layerType}.geojson`);
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as FeatureCollection;

  if (layerType === "political") {
    return preparePoliticalFeatures(parsed, DEFAULT_COUNTRY_COLORS);
  }
  const split = splitCollectionAtAntimeridian(parsed);
  // Ensure progressive layers (rivers, lakes) have _areaSqKm populated on their properties
  if (layerType === "rivers" || layerType === "lakes") {
    return {
      ...split,
      features: split.features.map((feat) => {
        let area = feat.properties?.areaSqKm ?? feat.properties?._areaSqKm;
        if (area === undefined) {
          area = computeApproxAreaForFeature(feat.geometry);
        }
        return {
          ...feat,
          properties: {
            ...feat.properties,
            _areaSqKm: area,
          },
        };
      }),
    };
  }
  return split;
}

/**
 * The realm's layer from the DB, else — for IxWorld only — the static GeoJSON file
 * (null when that file is missing too). Another realm with no DB layer gets an empty
 * collection: IxWorld's files are never drawn on another realm's map.
 */
export async function loadLayerWithFallback(
  db: Parameters<typeof loadLayerFromDB>[0],
  layerType: string,
  zoomBucket: ZoomBucket = 1,
  realmId: string = DEFAULT_REALM_ID
): Promise<FeatureCollection | null> {
  const fromDb = await loadLayerFromDB(db, layerType, zoomBucket, realmId);
  if (fromDb) return fromDb;
  if (realmId !== DEFAULT_REALM_ID) return { type: "FeatureCollection", features: [] };
  return loadGeoJSONFromFile(layerType).catch(() => null);
}

export async function loadLayerFromDB(
  db: any,
  layerType: string,
  zoomBucket: ZoomBucket = 1,
  realmId: string = DEFAULT_REALM_ID
): Promise<FeatureCollection | null> {
  // Check cache with a zoom- and realm-aware key (layer type stays first: TTLs and clearLayerCache key on it)
  const cacheKey = `${layerType}:z${zoomBucket}:${realmId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Share one build between concurrent callers (political is huge and requested in parallel)
  const existing = layerInflight.get(cacheKey);
  if (existing) return existing;
  const promise: Promise<FeatureCollection | null> = buildLayerFromDB(
    db,
    layerType,
    zoomBucket,
    realmId,
    cacheKey
  ).finally(() => {
    // Identity check: a clearLayerCache() may have replaced this entry with a newer build
    if (layerInflight.get(cacheKey) === promise) layerInflight.delete(cacheKey);
  });
  layerInflight.set(cacheKey, promise);
  return promise;
}

type LayerDb = Parameters<typeof loadLayerFromDB>[0];

function ringSizeOf(geometry: unknown): number {
  const geom = geometry as Geometry | null;
  if (geom?.type === "Polygon") return geom.coordinates?.[0]?.length ?? 0;
  if (geom?.type === "MultiPolygon") {
    return (geom.coordinates ?? []).reduce((sum, poly) => sum + (poly[0]?.length ?? 0), 0);
  }
  return 0;
}

/** Virtual layer: one label point per unique country name, derived from the realm's political layer. */
async function buildCountryLabels(
  db: LayerDb,
  zoomBucket: ZoomBucket,
  realmId: string,
  cacheKey: string
): Promise<FeatureCollection | null> {
  const politicalFC = await loadLayerFromDB(db, "political", zoomBucket, realmId);
  if (!politicalFC) return null;

  // One entry per country name, keeping the polygon with the biggest outline
  const seen = new Map<
    string,
    {
      lng: number;
      lat: number;
      area: number;
      name: string;
      continent?: string;
      region?: string;
      ringSize: number;
    }
  >();
  const demotedSet = new Set<string>(DEMOTED_COUNTRY_NAMES as unknown as string[]);

  for (const feat of politicalFC.features) {
    const p = feat.properties;
    if (!p?._displayName || p._sovereignId) continue;
    const name = p._displayName as string;
    const ringSize = ringSizeOf(feat.geometry);
    if (ringSize <= (seen.get(name)?.ringSize ?? -1)) continue;
    const [lng, lat] = computeVisualCenter(feat.geometry);
    seen.set(name, {
      lng,
      lat,
      area: (p._areaSqKm as number) ?? 0,
      name,
      ringSize,
      continent: p._continent as string | undefined,
      region: p._region as string | undefined,
    });
  }

  // The 30 largest countries get base importance; demoted names sink
  const sortedByArea = Array.from(seen.values()).sort((a, b) => b.area - a.area);
  const topNames = new Set(sortedByArea.slice(0, 30).map((c) => c.name));

  const features: Feature[] = sortedByArea.map((c, i) => {
    const importance = demotedSet.has(c.name) ? -1 : topNames.has(c.name) ? 1 : 0;
    return {
      type: "Feature" as const,
      id: i,
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
      properties: {
        _displayName: c.name,
        _areaSqKm: c.area,
        _continent: c.continent,
        _region: c.region,
        _importance: importance,
        _distFade: 1,
      },
    };
  });

  const fc: FeatureCollection = { type: "FeatureCollection", features };
  console.log(`[GeoRouter] Generated ${features.length} labels for country_labels layer`);
  setCache(cacheKey, fc);
  return fc;
}

type SovInfo = {
  sovereignCountryId: string;
  sovereignName: string;
  relationType: string;
  autonomyLevel: number;
  relationLabel: string;
};

/** Active sovereignty relations: subject -> its sovereign, plus the set of sovereigns. */
async function loadSovereignty(db: LayerDb) {
  const subjectMap = new Map<string, SovInfo>();
  const sovereignSet = new Set<string>();
  try {
    const rels = await db.countrySovereignty.findMany({
      where: { isActive: true },
      include: { sovereign: { select: { id: true, name: true } } },
    });
    for (const r of rels) {
      subjectMap.set(r.subjectId, {
        sovereignCountryId: r.sovereignId,
        sovereignName: r.sovereign.name,
        relationType: r.relationshipType,
        autonomyLevel: r.autonomyLevel,
        relationLabel:
          SOVEREIGNTY_TYPE_MAP[r.relationshipType as keyof typeof SOVEREIGNTY_TYPE_MAP]?.short ??
          r.relationshipType,
      });
      sovereignSet.add(r.sovereignId);
    }
  } catch {
    // Table may not exist yet — skip enrichment
  }
  return { subjectMap, sovereignSet };
}

type LayerRow = {
  featureId: string;
  geometry: unknown;
  properties: Record<string, unknown>;
  displayName: string | null;
  countryId: string | null;
  areaSqKm: number | null;
  centroid: unknown;
  country?: { continent: string | null; region: string | null } | null;
};

/** Political feature properties: fill colour (blended toward the root sovereign for subjects) and sovereignty tags. */
function politicalProperties(
  layer: LayerRow,
  sovereignty: Awaited<ReturnType<typeof loadSovereignty>>,
  countryColorMap: Map<string, string>
) {
  const { subjectMap, sovereignSet } = sovereignty;
  let fillColor = getColorForFeature(layer.featureId, layer.properties);
  const extraProps: Record<string, unknown> = {};

  if (layer.countryId) {
    const sovInfo = subjectMap.get(layer.countryId);
    if (sovInfo) {
      // This country is a subject — blend color toward root sovereign
      const sovereignColor = countryColorMap.get(resolveRootSovereign(subjectMap, layer.countryId));
      if (sovereignColor) {
        fillColor = getSovereigntyColor(fillColor, sovereignColor, sovInfo.autonomyLevel);
      }
      extraProps._sovereignId = sovInfo.sovereignCountryId;
      extraProps._sovereignName = sovInfo.sovereignName;
      extraProps._relationType = sovInfo.relationType;
      extraProps._relationLabel = sovInfo.relationLabel;
      extraProps._autonomyLevel = sovInfo.autonomyLevel;
    }
    if (sovereignSet.has(layer.countryId)) extraProps._isSovereign = true;
  }

  const [centroidLng, centroidLat] = centroidLngLat(layer.centroid);
  return {
    ...layer.properties,
    _id: layer.featureId,
    _displayName: layer.displayName || featureIdToDisplayName(layer.featureId),
    _fillColor: fillColor,
    _countryId: layer.countryId,
    _areaSqKm: layer.areaSqKm,
    _centroidLng: centroidLng,
    _centroidLat: centroidLat,
    ...(layer.country?.continent ? { _continent: layer.country.continent } : {}),
    ...(layer.country?.region ? { _region: layer.country.region } : {}),
    ...extraProps,
  };
}

/** Walks the sovereignty chain up to the root sovereign. */
function resolveRootSovereign(
  subjectMap: Map<string, SovInfo>,
  countryId: string,
  visited = new Set<string>()
): string {
  if (visited.has(countryId)) return countryId; // cycle guard
  visited.add(countryId);
  const parent = subjectMap.get(countryId);
  return parent ? resolveRootSovereign(subjectMap, parent.sovereignCountryId, visited) : countryId;
}

async function buildLayerFromDB(
  db: LayerDb,
  layerType: string,
  zoomBucket: ZoomBucket,
  realmId: string,
  cacheKey: string
): Promise<FeatureCollection | null> {
  if (layerType === "country_labels") return buildCountryLabels(db, zoomBucket, realmId, cacheKey);

  const isPolitical = layerType === "political";
  const layers: LayerRow[] = await db.mapLayer.findMany({
    where: { layerType, isActive: true, realmId },
    // Explicit take bypasses global findMany guard (db.ts caps at 1000 by default).
    // Map layers like altitudes have 4000+ features that must all be loaded.
    take: 50000,
    select: {
      featureId: true,
      geometry: true,
      properties: true,
      displayName: true,
      countryId: true,
      areaSqKm: true,
      centroid: true,
      // Join to Country for continent/region (used for geography tag highlighting)
      ...(isPolitical ? { country: { select: { continent: true, region: true } } } : {}),
    },
  });
  if (layers.length === 0) return null;

  const sovereignty = isPolitical
    ? await loadSovereignty(db)
    : { subjectMap: new Map<string, SovInfo>(), sovereignSet: new Set<string>() };
  // countryId -> feature colour, for sovereignty colour blending
  const countryColorMap = new Map<string, string>();
  if (isPolitical) {
    for (const layer of layers) {
      if (layer.countryId) {
        countryColorMap.set(layer.countryId, getColorForFeature(layer.featureId, layer.properties));
      }
    }
  }

  // Decorative layers (altitudes, rivers, climate, etc.) only need _id + _fillColor and skip the
  // raw SVG properties; the political layer carries full metadata for info panels and clicks.
  const features: Feature[] = layers.map((layer, index) => ({
    type: "Feature" as const,
    id: index,
    geometry: layer.geometry as Geometry,
    properties: isPolitical
      ? politicalProperties(layer, sovereignty, countryColorMap)
      : {
          _id: layer.featureId,
          _fillColor: layer.properties?.fill as string | undefined,
          _areaSqKm: layer.areaSqKm ?? computeApproxAreaForFeature(layer.geometry as Geometry),
        },
  }));
  const fc: FeatureCollection = { type: "FeatureCollection", features };

  // Compress geometry for transport (simplify + truncate coords + dedup) with zoom-aware LOD:
  // globe view = aggressive, detail view = minimal
  const compressed = compressFeatureCollection(fc, getCompressionForLayer(layerType, zoomBucket));

  // Split features crossing the antimeridian to prevent rendering artifacts
  const split = splitCollectionAtAntimeridian(compressed);

  // Merge decorative layers by fill color — these don't need individual feature identity.
  // Reduces 4000+ small Polygons to ~9 MultiPolygons (one per color), cutting payload ~30%.
  const result = DECORATIVE_LAYERS.has(layerType) ? mergeFeaturesByColor(split) : split;

  setCache(cacheKey, result);
  return result;
}

const DECORATIVE_LAYERS = new Set(["altitudes", "climate"]);

/**
 * Merge GeoJSON features that share the same _fillColor into single MultiPolygon features.
 * Only applied to decorative layers (altitudes, climate) that don't need per-feature identity.
 *
 * Example: 4068 altitude polygons across 9 colors → 9 MultiPolygon features.
 */
function mergeFeaturesByColor(fc: FeatureCollection): FeatureCollection {
  // Position[][][] = array of polygon rings, each polygon is Position[][] (ring of [lng,lat])
  const colorGroups = new Map<string, import("geojson").Position[][][]>();

  for (const feature of fc.features) {
    const color = ((feature.properties as Record<string, unknown>)?._fillColor as string) ?? "none";
    if (!colorGroups.has(color)) colorGroups.set(color, []);
    const polygons = colorGroups.get(color)!;

    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      polygons.push((geom as import("geojson").Polygon).coordinates);
    } else if (geom.type === "MultiPolygon") {
      for (const poly of (geom as import("geojson").MultiPolygon).coordinates) {
        polygons.push(poly);
      }
    }
    // Skip non-polygon geometries (shouldn't exist in altitude/climate layers)
  }

  const features: Feature[] = [];
  let id = 0;
  for (const [color, polygons] of colorGroups) {
    const geometry: import("geojson").MultiPolygon = {
      type: "MultiPolygon",
      coordinates: polygons,
    };
    features.push({
      type: "Feature",
      id: id++,
      geometry,
      properties: {
        _id: `merged_${id}`,
        _fillColor: color,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

export function getColorForFeature(featureId: string, properties: Record<string, unknown>): string {
  const fill = properties?.fill as string | undefined;
  if (fill && fill !== "#ffffff") return fill;

  let hash = 0;
  for (let i = 0; i < featureId.length; i++) {
    hash = featureId.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return DEFAULT_COUNTRY_COLORS[Math.abs(hash) % DEFAULT_COUNTRY_COLORS.length];
}
