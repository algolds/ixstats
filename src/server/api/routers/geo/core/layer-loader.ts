import { readFile } from "fs/promises";
import { join } from "path";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import {
  splitCollectionAtAntimeridian,
  preparePoliticalFeatures,
  featureIdToDisplayName,
} from "~/lib/map-utils";
import { compressFeatureCollection } from "~/lib/geojson-compress";
import {
  DEFAULT_COUNTRY_COLORS,
  SOVEREIGNTY_TYPE_MAP,
  getSovereigntyColor,
  DEMOTED_COUNTRY_NAMES,
} from "~/lib/map-config";
import { getCached, setCache, getCompressionForLayer, type ZoomBucket } from "./cache";
import { computeApproxAreaForFeature, computeVisualCenter } from "./geometry";

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
        const result = await loadLayerFromDB(db, layerType, zoomBucket);
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
        const result = await loadLayerFromDB(db, layerType, defaultZoom);
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

export async function loadGeoJSONFromFile(layerType: string): Promise<FeatureCollection> {
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

export async function loadLayerFromDB(
  db: any,
  layerType: string,
  zoomBucket: ZoomBucket = 1
): Promise<FeatureCollection | null> {
  // Check cache with zoom-aware key
  const cacheKey = `${layerType}:z${zoomBucket}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Virtual layer: country_labels is derived from the political layer
  if (layerType === "country_labels") {
    const politicalFC = await loadLayerFromDB(db, "political", zoomBucket);
    if (!politicalFC) return null;

    // Build deduplicated point source: one centroid per unique country name
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
        importance: number;
      }
    >();

    // Get top countries set (could be injected but we'll use a local fetch if needed)
    // For now we'll just use the DEMOTED list and area-based importance
    const demotedSet = new Set<string>(DEMOTED_COUNTRY_NAMES as unknown as string[]);

    for (const feat of politicalFC.features) {
      const p = feat.properties;
      if (!p?._displayName || p._sovereignId) continue;
      const name = p._displayName as string;
      const area = (p._areaSqKm as number) ?? 0;
      const existing = seen.get(name);

      const [lng, lat] = computeVisualCenter(feat.geometry);

      const geom = feat.geometry as any;
      let ringSize = 0;
      if (geom?.type === "Polygon") ringSize = geom.coordinates?.[0]?.length ?? 0;
      else if (geom?.type === "MultiPolygon") {
        for (const poly of geom.coordinates ?? []) ringSize += poly[0]?.length ?? 0;
      }

      if (!existing || ringSize > existing.ringSize) {
        seen.set(name, {
          lng,
          lat,
          area,
          name,
          ringSize,
          continent: p._continent as string | undefined,
          region: p._region as string | undefined,
          importance: demotedSet.has(name) ? -1 : 0,
        });
      }
    }

    // Sort by area to find top countries for base importance
    const sortedByArea = Array.from(seen.values()).sort((a, b) => b.area - a.area);
    const topNames = new Set(sortedByArea.slice(0, 30).map((c) => c.name));

    const features: Feature[] = sortedByArea.map((c, i) => {
      let importance = 0;
      if (demotedSet.has(c.name)) importance = -1;
      else if (topNames.has(c.name)) importance = 1;

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

  const layers = await db.mapLayer.findMany({
    where: { layerType, isActive: true },
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
      ...(layerType === "political"
        ? { country: { select: { continent: true, region: true } } }
        : {}),
    },
  });

  if (layers.length === 0) return null;

  // ── Sovereignty enrichment for political layer ──
  type SovInfo = {
    sovereignCountryId: string;
    sovereignName: string;
    relationType: string;
    autonomyLevel: number;
    relationLabel: string;
  };
  const subjectMap = new Map<string, SovInfo>();
  const sovereignSet = new Set<string>();

  if (layerType === "political") {
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
  }

  // Build countryId → featureColor lookup for sovereignty color blending
  const countryColorMap = new Map<string, string>();
  if (layerType === "political") {
    for (const layer of layers) {
      if (layer.countryId) {
        countryColorMap.set(
          layer.countryId,
          getColorForFeature(layer.featureId, layer.properties as Record<string, unknown>)
        );
      }
    }
  }

  // Resolve sovereignty chains: walk up to root sovereign
  function resolveRootSovereign(countryId: string, visited = new Set<string>()): string {
    if (visited.has(countryId)) return countryId; // cycle guard
    visited.add(countryId);
    const parent = subjectMap.get(countryId);
    if (!parent) return countryId;
    return resolveRootSovereign(parent.sovereignCountryId, visited);
  }

  const features: Feature[] = layers.map(
    (
      layer: {
        featureId: string;
        geometry: unknown;
        properties: Record<string, unknown>;
        displayName: string | null;
        countryId: string | null;
        areaSqKm: number | null;
        centroid: unknown;
      },
      index: number
    ) => {
      // Centroid stored as [lng, lat] array or { coordinates: [lng, lat] } GeoJSON Point
      const rawCentroid = layer.centroid as
        [number, number] | { coordinates?: [number, number] } | null;
      let centroidLng = 0;
      let centroidLat = 0;
      if (Array.isArray(rawCentroid) && rawCentroid.length >= 2) {
        centroidLng = rawCentroid[0];
        centroidLat = rawCentroid[1];
      } else if (
        rawCentroid &&
        "coordinates" in rawCentroid &&
        Array.isArray(rawCentroid.coordinates)
      ) {
        centroidLng = rawCentroid.coordinates[0];
        centroidLat = rawCentroid.coordinates[1];
      }

      let fillColor: string | undefined;
      const extraProps: Record<string, unknown> = {};

      if (layerType === "political") {
        fillColor = getColorForFeature(
          layer.featureId,
          layer.properties as Record<string, unknown>
        );

        // Sovereignty enrichment
        if (layer.countryId) {
          const sovInfo = subjectMap.get(layer.countryId);
          if (sovInfo) {
            // This country is a subject — blend color toward root sovereign
            const rootSovereignId = resolveRootSovereign(layer.countryId);
            const sovereignColor = countryColorMap.get(rootSovereignId);
            if (sovereignColor) {
              fillColor = getSovereigntyColor(fillColor, sovereignColor, sovInfo.autonomyLevel);
            }
            extraProps._sovereignId = sovInfo.sovereignCountryId;
            extraProps._sovereignName = sovInfo.sovereignName;
            extraProps._relationType = sovInfo.relationType;
            extraProps._relationLabel = sovInfo.relationLabel;
            extraProps._autonomyLevel = sovInfo.autonomyLevel;
          }
          if (sovereignSet.has(layer.countryId)) {
            extraProps._isSovereign = true;
          }
        }
      } else {
        fillColor = (layer.properties as Record<string, unknown>)?.fill as string | undefined;
      }

      // For non-political layers, skip raw SVG properties (fill, ixmap-subgroup, etc.)
      // — _fillColor already contains the computed color
      const baseProps =
        layerType === "political" ? { ...(layer.properties as Record<string, unknown>) } : {};

      // Decorative layers (altitudes, rivers, climate, etc.) only need _id + _fillColor.
      // Political layer carries full metadata for info panels and click handling.
      const isPolitical = layerType === "political";
      const properties = isPolitical
        ? {
            ...baseProps,
            _id: layer.featureId,
            _displayName: layer.displayName || featureIdToDisplayName(layer.featureId),
            _fillColor: fillColor,
            _countryId: layer.countryId,
            _areaSqKm: layer.areaSqKm,
            _centroidLng: centroidLng,
            _centroidLat: centroidLat,
            ...((layer as any).country?.continent
              ? { _continent: (layer as any).country.continent }
              : {}),
            ...((layer as any).country?.region ? { _region: (layer as any).country.region } : {}),
            ...extraProps,
          }
        : {
            _id: layer.featureId,
            _fillColor: fillColor,
            _areaSqKm: layer.areaSqKm ?? computeApproxAreaForFeature(layer.geometry as Geometry),
          };

      return {
        type: "Feature" as const,
        id: index,
        geometry: layer.geometry as Geometry,
        properties,
      };
    }
  );

  const fc: FeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  // Compress geometry for transport (simplify + truncate coords + dedup)
  // Uses zoom-aware LOD: globe view = aggressive, detail view = minimal
  const compressionOpts = getCompressionForLayer(layerType, zoomBucket);
  const compressed =
    compressionOpts.simplifyTolerance > 0
      ? compressFeatureCollection(fc, compressionOpts)
      : compressFeatureCollection(fc, { ...compressionOpts, simplifyTolerance: 0 });

  // Split features crossing the antimeridian to prevent rendering artifacts
  const split = splitCollectionAtAntimeridian(compressed);

  // Merge decorative layers by fill color — these don't need individual feature identity.
  // Reduces 4000+ small Polygons to ~9 MultiPolygons (one per color), cutting payload ~30%.
  const DECORATIVE_LAYERS = new Set(["altitudes", "climate"]);
  const result = DECORATIVE_LAYERS.has(layerType) ? mergeFeaturesByColor(split) : split;

  setCache(cacheKey, result);
  return result;
}

/**
 * Merge GeoJSON features that share the same _fillColor into single MultiPolygon features.
 * Only applied to decorative layers (altitudes, climate) that don't need per-feature identity.
 *
 * Example: 4068 altitude polygons across 9 colors → 9 MultiPolygon features.
 */
export function mergeFeaturesByColor(fc: FeatureCollection): FeatureCollection {
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
