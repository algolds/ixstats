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
import { readFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import {
  splitCollectionAtAntimeridian,
  preparePoliticalFeatures,
  featureIdToDisplayName,
} from "~/lib/map-utils";
import { compressFeatureCollection, type CompressOptions } from "~/lib/geojson-compress";
import {
  MAP_LAYER_TYPES,
  DEFAULT_COUNTRY_COLORS,
  SOVEREIGNTY_TYPES,
  SOVEREIGNTY_TYPE_MAP,
  getSovereigntyColor,
  DEMOTED_COUNTRY_NAMES,
} from "~/lib/map-config";
import { ActivityGenerator } from "~/lib/activity-generator";
import { getTerrainForArea } from "~/lib/base-layer-query";
import { getZoneByColor } from "~/lib/elevation-config";
import {
  validatePointContainment,
  validatePolygonContainment,
  checkPointCollision,
  checkNameUniqueness,
} from "~/lib/geo-validation";
import {
  buildGeoProfile,
  computeEconomicGeoModifiers,
  computeNPCGeoModifiers,
  computeCrisisRiskFactors,
  estimateTemperature,
  estimatePrecipitation,
  getAgricultureFactor,
  resolveClimateFromColor,
  ELEVATION_ZONES,
  type ClimateZoneEntry,
  type ElevationZoneEntry,
} from "~/lib/geo-analytics";
import {
  parseInfobox,
  extractCoordsFromFields,
  parseCoordTemplate,
} from "~/lib/wiki-infobox-parser";
import { detectConflicts, type FeatureData } from "~/lib/map-conflict-detector";

/** Reusable Zod schema for WGS84 coordinate pair [lng, lat] with bounds checking. */
const coordinatesSchema = z
  .tuple([z.number(), z.number()])
  .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
    message: "Coordinates must be valid WGS84 (lng: -180 to 180, lat: -90 to 90)",
  });

import { normalizeFlagUrl } from "~/lib/unified-flag-service";

/**
 * Climate color map: maps fill colors to human-readable Trewartha climate names.
 * Includes both canonical Trewartha colors and legacy SVG colors for backward compat.
 */
const CLIMATE_COLOR_MAP: Record<string, string> = {
  // Canonical Trewartha colors (from climate-system.ts)
  "#990000": "Ar: Tropical Wet",
  "#ff3300": "Aw: Tropical Wet-And-Dry",
  "#ffff33": "Bw: Desert or Arid",
  "#ff9933": "Bs: Steppe or Semiarid",
  "#669900": "Cs: Subtropical Dry Summer",
  "#336600": "Cf: Subtropical Humid",
  "#00ff99": "Do: Temperate Oceanic",
  "#0099ff": "Dc: Temperate Continental",
  "#0066cc": "E: Boreal",
  "#b9b9b9": "Ft: Tundra",
  "#99ffff": "Fi: Ice Cap",
  "#ffccff": "H: Highland",
  // Legacy SVG colors (pre-Trewartha import data)
  "#00fd97": "Do: Temperate Oceanic",
  "#326500": "Cf: Subtropical Humid",
  "#fd9833": "Bs: Steppe or Semiarid",
  "#659700": "Cs: Subtropical Dry Summer",
  "#fc3502": "Aw: Tropical Wet-And-Dry",
  "#980000": "Ar: Tropical Wet",
  "#fcfc33": "Bw: Desert or Arid",
  "#0098fd": "Dc: Temperate Continental",
  "#9ea7b0": "Ft: Tundra",
  "#0065ca": "E: Boreal",
  "#fecbfe": "H: Highland",
};

// ──────────────────────────────────────────────
// In-memory cache for assembled FeatureCollections
// ──────────────────────────────────────────────

const layerCache = new Map<string, { data: FeatureCollection; timestamp: number }>();
/** Per-layer cache TTL — static layers imported from SVGs rarely change */
const CACHE_TTLS: Record<string, number> = {
  political: 15 * 60 * 1000, // 15 min (editable)
  background: 24 * 60 * 60 * 1000, // 24 hours (static)
  altitudes: 24 * 60 * 60 * 1000, // 24 hours (static)
  climate: 24 * 60 * 60 * 1000, // 24 hours (static)
  rivers: 24 * 60 * 60 * 1000, // 24 hours (static)
  lakes: 24 * 60 * 60 * 1000, // 24 hours (static)
  icecaps: 24 * 60 * 60 * 1000, // 24 hours (static)
};
const DEFAULT_CACHE_TTL = 15 * 60 * 1000;

/** Per-layer geometry compression — simplify + truncate + dedup.
 * Decorative layers use precision 3 (~111m) and higher tolerance to cut payload.
 * Political borders keep precision 4 (~11m) for crisp rendering. */
const LAYER_COMPRESSION: Record<string, CompressOptions> = {
  altitudes: { simplifyTolerance: 0.05, coordinatePrecision: 3 }, // decorative — aggressive
  rivers: { simplifyTolerance: 0.035, coordinatePrecision: 3 }, // decorative — aggressive
  climate: { simplifyTolerance: 0.05, coordinatePrecision: 3 }, // decorative — aggressive
  political: { simplifyTolerance: 0.008, coordinatePrecision: 4 }, // borders — keep crisp
  lakes: { simplifyTolerance: 0.02, coordinatePrecision: 3 }, // decorative
  icecaps: { simplifyTolerance: 0, coordinatePrecision: 3 }, // no simplification — preserves polar vertices
  background: { simplifyTolerance: 0, coordinatePrecision: 3 },
};

/**
 * Zoom-level LOD compression overrides.
 * At low zoom (globe view), aggressively simplify to reduce payload.
 * At high zoom, use full detail for crisp borders.
 * Zoom buckets: 0 = globe (0-3), 1 = mid (4-6), 2 = detail (7+)
 */
type ZoomBucket = 0 | 1 | 2;

function getZoomBucket(zoom?: number): ZoomBucket {
  if (zoom === undefined || zoom === null) return 1; // default = mid
  if (zoom < 4) return 0; // globe view
  if (zoom < 7) return 1; // mid zoom
  return 2; // detail zoom
}

const LOD_OVERRIDES: Record<ZoomBucket, Record<string, Partial<CompressOptions>>> = {
  0: {
    // Globe view — very aggressive (user can't see detail anyway)
    altitudes: { simplifyTolerance: 0.12, coordinatePrecision: 2 },
    rivers: { simplifyTolerance: 0.1, coordinatePrecision: 2 },
    climate: { simplifyTolerance: 0.12, coordinatePrecision: 2 },
    political: { simplifyTolerance: 0.025 },
    lakes: { simplifyTolerance: 0.06, coordinatePrecision: 2 },
  },
  1: {}, // Mid zoom — use defaults
  2: {
    // Detail view — minimal simplification for crisp borders
    political: { simplifyTolerance: 0.002, coordinatePrecision: 4 },
    altitudes: { simplifyTolerance: 0.01, coordinatePrecision: 4 },
    rivers: { simplifyTolerance: 0.008, coordinatePrecision: 4 },
    climate: { simplifyTolerance: 0.01, coordinatePrecision: 4 },
    lakes: { simplifyTolerance: 0.005, coordinatePrecision: 4 },
  },
};

function getCompressionForLayer(layerType: string, zoomBucket: ZoomBucket): CompressOptions {
  const base = LAYER_COMPRESSION[layerType] ?? { simplifyTolerance: 0, coordinatePrecision: 4 };
  const override = LOD_OVERRIDES[zoomBucket]?.[layerType];
  return override ? { ...base, ...override } : base;
}

function getCached(key: string): FeatureCollection | null {
  const entry = layerCache.get(key);
  if (!entry) return null;
  const ttl = CACHE_TTLS[key] ?? DEFAULT_CACHE_TTL;
  if (Date.now() - entry.timestamp > ttl) {
    layerCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: FeatureCollection): void {
  layerCache.set(key, { data, timestamp: Date.now() });
  // Prevent unbounded growth
  if (layerCache.size > 20) {
    const now = Date.now();
    for (const [k, v] of layerCache) {
      const ttl = CACHE_TTLS[k] ?? DEFAULT_CACHE_TTL;
      if (now - v.timestamp > ttl) layerCache.delete(k);
    }
  }
}

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

// ──────────────────────────────────────────────
// Geometry helpers
// ──────────────────────────────────────────────

/** Recursively extract all [lng, lat] positions from a GeoJSON geometry */
function extractAllPositions(geometry: Geometry): [number, number][] {
  const positions: [number, number][] = [];
  function scan(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      positions.push([coords[0] as number, coords[1] as number]);
      return;
    }
    for (const c of coords) scan(c);
  }
  if ("coordinates" in geometry) {
    scan((geometry as { coordinates: unknown }).coordinates);
  }
  return positions;
}

/**
 * Compute the visual center of a polygon ring (approximate center of its bounding box).
 * Handles antimeridian wrapping by normalizing longitudes.
 */
function computeVisualCenter(geometry: any): [number, number] {
  const rings: number[][][] = [];
  const geomType = geometry?.type;
  const coords = geometry?.coordinates;
  if (geomType === "Polygon" && coords) {
    rings.push(coords[0]);
  } else if (geomType === "MultiPolygon" && coords) {
    for (const poly of coords) rings.push(poly[0]);
  }
  if (rings.length === 0) return [0, 0];

  let largestRing = rings[0];
  for (let i = 1; i < rings.length; i++) {
    if (rings[i].length > largestRing.length) largestRing = rings[i];
  }

  let minLng = Infinity,
    maxLng = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of largestRing) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  // Handle antimeridian wrap: if bbox width > 300deg, it likely wraps
  if (maxLng - minLng > 300) {
    minLng = Infinity;
    maxLng = -Infinity;
    for (const [lng] of largestRing) {
      const norm = lng < 0 ? lng + 360 : lng;
      if (norm < minLng) minLng = norm;
      if (norm > maxLng) maxLng = norm;
    }
    let centerLng = (minLng + maxLng) / 2;
    if (centerLng > 180) centerLng -= 360;
    return [centerLng, (minLat + maxLat) / 2];
  }

  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

// ──────────────────────────────────────────────
// File-based fallback (for layers not yet in DB)
// ──────────────────────────────────────────────

const GEOJSON_DIR = join(process.cwd(), "scripts", "geojson_fixed");

async function loadGeoJSONFromFile(layerType: string): Promise<FeatureCollection> {
  const filePath = join(GEOJSON_DIR, `${layerType}.geojson`);
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as FeatureCollection;

  if (layerType === "political") {
    return preparePoliticalFeatures(parsed, DEFAULT_COUNTRY_COLORS);
  }
  // Split features crossing the antimeridian (lng > 180) into two halves
  return splitCollectionAtAntimeridian(parsed);
}

// ──────────────────────────────────────────────
// Database layer assembly
// ──────────────────────────────────────────────

async function loadLayerFromDB(
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
    const demotedSet = new Set(DEMOTED_COUNTRY_NAMES);

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
        | [number, number]
        | { coordinates?: [number, number] }
        | null;
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
  setCache(cacheKey, split);
  return split;
}

function getColorForFeature(featureId: string, properties: Record<string, unknown>): string {
  const fill = properties?.fill as string | undefined;
  if (fill && fill !== "#ffffff") return fill;

  let hash = 0;
  for (let i = 0; i < featureId.length; i++) {
    hash = featureId.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return DEFAULT_COUNTRY_COLORS[Math.abs(hash) % DEFAULT_COUNTRY_COLORS.length];
}

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoRouter = createTRPCRouter({
  /**
   * Get all map layers (or specific ones).
   * Reads from database, falls back to file if DB is empty.
   */
  getWorldMap: cachedPublicProcedure
    .input(
      z
        .object({
          layers: z.array(z.enum(MAP_LAYER_TYPES as unknown as [string, ...string[]])).optional(),
          /** Current map zoom level for LOD-based geometry simplification */
          zoom: z.number().min(0).max(20).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const requestedLayers = input?.layers ?? [
        "background",
        "political",
        "lakes",
        "rivers",
        "icecaps",
        "country_labels",
      ];
      const zoomBucket = getZoomBucket(input?.zoom);

      const results: Record<string, FeatureCollection> = {};

      await Promise.all(
        requestedLayers.map(async (layer) => {
          // Try database first
          const dbData = await loadLayerFromDB(ctx.db, layer, zoomBucket);
          if (dbData) {
            results[layer] = dbData;
          } else {
            // Fallback to file
            try {
              results[layer] = await loadGeoJSONFromFile(layer);
            } catch {
              // Layer not available
            }
          }
        })
      );

      return results;
    }),

  /**
   * Batched map data endpoint — returns world map layers + overlay features + capitals
   * in a single request to reduce HTTP round-trips on initial map load.
   */
  getMapBundle: cachedPublicProcedure
    .input(
      z
        .object({
          layers: z.array(z.enum(MAP_LAYER_TYPES as unknown as [string, ...string[]])).optional(),
          zoom: z.number().min(0).max(20).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const requestedLayers = input?.layers ?? [
        "background",
        "political",
        "lakes",
        "rivers",
        "icecaps",
        "country_labels",
      ];
      const zoomBucket = getZoomBucket(input?.zoom);

      // Run all three queries in parallel
      const [worldMap, allFeatures, capitalCities] = await Promise.all([
        // 1. World map layers
        (async () => {
          const results: Record<string, FeatureCollection> = {};
          await Promise.all(
            requestedLayers.map(async (layer) => {
              const dbData = await loadLayerFromDB(ctx.db, layer, zoomBucket);
              if (dbData) {
                results[layer] = dbData;
              } else {
                try {
                  results[layer] = await loadGeoJSONFromFile(layer);
                } catch {
                  // Layer not available
                }
              }
            })
          );
          return results;
        })(),

        // 2. Overlay features (cities, POIs, subdivisions)
        (async () => {
          const [cities, pois, subdivisions] = await Promise.all([
            ctx.db.city.findMany({
              where: { status: "approved" },
              select: {
                id: true,
                name: true,
                coordinates: true,
                population: true,
                type: true,
                isNationalCapital: true,
                wikiPageTitle: true,
                countryId: true,
                country: { select: { name: true, slug: true } },
              },
            }),
            ctx.db.pointOfInterest.findMany({
              where: { status: "approved" },
              select: {
                id: true,
                name: true,
                coordinates: true,
                category: true,
                icon: true,
                description: true,
                wikiPageTitle: true,
                countryId: true,
                country: { select: { name: true, slug: true } },
              },
            }),
            ctx.db.subdivision.findMany({
              where: { status: "approved" },
              select: {
                id: true,
                name: true,
                type: true,
                level: true,
                areaSqKm: true,
                geometry: true,
                countryId: true,
                country: { select: { name: true, slug: true } },
              },
            }),
          ]);
          return { cities, pois, subdivisions };
        })(),

        // 3. Capital cities
        ctx.db.city.findMany({
          where: { isNationalCapital: true, status: "approved" },
          select: {
            id: true,
            name: true,
            coordinates: true,
            population: true,
            wikiPageTitle: true,
            countryId: true,
            country: { select: { name: true, slug: true } },
          },
        }),
      ]);

      // Format overlay features as GeoJSON
      const features = {
        cities: {
          type: "FeatureCollection" as const,
          features: allFeatures.cities
            .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
            .map((c) => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: c.coordinates as [number, number] },
              properties: {
                id: c.id,
                name: c.name,
                cityType: c.type,
                isCapital: c.isNationalCapital,
                population: c.population,
                countryId: c.countryId,
                countryName: c.country.name,
                countrySlug: c.country.slug,
                wikiPageTitle: c.wikiPageTitle,
              },
            })),
        },
        pois: {
          type: "FeatureCollection" as const,
          features: allFeatures.pois
            .filter((p) => Array.isArray(p.coordinates) && (p.coordinates as number[]).length >= 2)
            .map((p) => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: p.coordinates as [number, number] },
              properties: {
                id: p.id,
                name: p.name,
                category: p.category,
                icon: p.icon,
                description: p.description,
                wikiPageTitle: p.wikiPageTitle,
                countryId: p.countryId,
                countryName: p.country.name,
                countrySlug: p.country.slug,
              },
            })),
        },
        subdivisions: {
          type: "FeatureCollection" as const,
          features: allFeatures.subdivisions
            .filter((s) => s.geometry)
            .map((s) => ({
              type: "Feature" as const,
              geometry: s.geometry as unknown as import("geojson").Geometry,
              properties: {
                id: s.id,
                name: s.name,
                subdivisionType: s.type,
                level: s.level,
                areaSqKm: s.areaSqKm,
                countryId: s.countryId,
                countryName: s.country.name,
                countrySlug: s.country.slug,
              },
            })),
        },
      };

      // Format capitals as GeoJSON
      const capitals = {
        type: "FeatureCollection" as const,
        features: capitalCities
          .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
          .map((c) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: c.coordinates as [number, number] },
            properties: {
              id: c.id,
              name: c.name,
              countryId: c.countryId,
              countryName: c.country.name,
              countrySlug: c.country.slug,
              population: c.population,
              wikiPageTitle: c.wikiPageTitle,
            },
          })),
      };

      return { worldMap, features, capitals };
    }),

  /**
   * Get a single country's geometry by feature ID, country name, or country DB ID.
   */
  getCountryGeometry: cachedPublicProcedure
    .input(
      z.object({
        featureId: z.string().optional(),
        countryName: z.string().optional(),
        countryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!input.featureId && !input.countryName && !input.countryId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One of featureId, countryName, or countryId is required",
        });
      }

      // Query MapLayer directly from DB
      let mapLayer;

      if (input.countryId) {
        mapLayer = await ctx.db.mapLayer.findFirst({
          where: {
            layerType: "political",
            countryId: input.countryId,
            isActive: true,
          },
          include: {
            country: {
              select: { id: true, name: true, flag: true },
            },
          },
        });
      } else if (input.featureId) {
        mapLayer = await ctx.db.mapLayer.findFirst({
          where: {
            layerType: "political",
            featureId: input.featureId,
            isActive: true,
          },
          include: {
            country: {
              select: { id: true, name: true, flag: true },
            },
          },
        });
      } else if (input.countryName) {
        // Search by display name (case-insensitive)
        mapLayer = await ctx.db.mapLayer.findFirst({
          where: {
            layerType: "political",
            displayName: { contains: input.countryName, mode: "insensitive" as const },
            isActive: true,
          },
          include: {
            country: {
              select: { id: true, name: true, flag: true },
            },
          },
        });
      }

      if (!mapLayer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Country not found`,
        });
      }

      const rawC = mapLayer.centroid as
        | [number, number]
        | { coordinates?: [number, number] }
        | null;
      let parsedCentroid: { lng: number; lat: number } | null = null;
      if (Array.isArray(rawC) && rawC.length >= 2) {
        parsedCentroid = { lng: rawC[0], lat: rawC[1] };
      } else if (rawC && "coordinates" in rawC && Array.isArray(rawC.coordinates)) {
        parsedCentroid = { lng: rawC.coordinates[0], lat: rawC.coordinates[1] };
      }
      const bbox = mapLayer.boundingBox as number[] | null;

      return {
        featureId: mapLayer.featureId,
        displayName: mapLayer.displayName || featureIdToDisplayName(mapLayer.featureId),
        geometry: mapLayer.geometry,
        centroid: parsedCentroid,
        bbox: bbox ? { minLng: bbox[0], minLat: bbox[1], maxLng: bbox[2], maxLat: bbox[3] } : null,
        areaSqKm: mapLayer.areaSqKm,
        country: mapLayer.country,
      };
    }),

  /**
   * Get country at a given point using PostGIS ST_Contains.
   */
  getCountryAtPoint: rateLimitedPublicProcedure
    .input(
      z.object({
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
      })
    )
    .query(async ({ ctx, input }) => {
      // Use PostGIS spatial query
      try {
        const results = await ctx.db.$queryRawUnsafe<
          Array<{
            id: string;
            featureId: string;
            displayName: string | null;
            countryId: string | null;
            properties: unknown;
          }>
        >(
          `SELECT id, "featureId", "displayName", "countryId", properties
           FROM map_layers
           WHERE "layerType" = 'political'
             AND "isActive" = true
             AND geom_postgis IS NOT NULL
             AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($1, $2), 4326))
           LIMIT 1`,
          input.lng,
          input.lat
        );

        if (results.length > 0) {
          const r = results[0];
          return {
            featureId: r.featureId,
            displayName: r.displayName || featureIdToDisplayName(r.featureId),
            countryId: r.countryId,
            fillColor: getColorForFeature(r.featureId, r.properties as Record<string, unknown>),
          };
        }
      } catch {
        // PostGIS query failed, geometry may not be synced yet
      }

      return null;
    }),

  /**
   * Get comprehensive info at a map point: elevation, climate, country, subdivision.
   * Queries all relevant layers via PostGIS ST_Contains in a single call.
   */
  getPointInfo: rateLimitedPublicProcedure
    .input(
      z.object({
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Query altitude, climate, and political layers at this point
        const layerResults = await ctx.db.$queryRawUnsafe<
          Array<{
            layerType: string;
            featureId: string;
            displayName: string | null;
            properties: Record<string, unknown>;
            countryId: string | null;
          }>
        >(
          `SELECT "layerType", "featureId", "displayName", properties, "countryId"
           FROM map_layers
           WHERE "isActive" = true
             AND geom_postgis IS NOT NULL
             AND "layerType" IN ('altitudes', 'climate', 'political')
             AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($1, $2), 4326))`,
          input.lng,
          input.lat
        );

        const altitude = layerResults.find((r) => r.layerType === "altitudes");
        const climate = layerResults.find((r) => r.layerType === "climate");
        const political = layerResults.find((r) => r.layerType === "political");

        // If we found a country, also check for subdivision
        let subdivision: { id: string; name: string; type: string | null } | null = null;
        let countryInfo: {
          id: string;
          name: string;
          slug: string | null;
          flag: string | null;
        } | null = null;

        if (political?.countryId) {
          // Get country info
          const country = await ctx.db.country.findUnique({
            where: { id: political.countryId },
            select: { id: true, name: true, slug: true, flag: true },
          });
          if (country) countryInfo = country;

          // Check for subdivision at this point
          try {
            const subResults = await ctx.db.$queryRawUnsafe<
              Array<{ id: string; name: string; type: string | null }>
            >(
              `SELECT id, name, type FROM subdivisions
               WHERE "countryId" = $1 AND status = 'approved'
                 AND geom_postgis IS NOT NULL
                 AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($2, $3), 4326))
               LIMIT 1`,
              political.countryId,
              input.lng,
              input.lat
            );
            if (subResults.length > 0) subdivision = subResults[0]!;
          } catch {
            // Subdivision query failed — no PostGIS data yet
          }
        }

        const altProps = altitude?.properties ?? {};
        const climProps = climate?.properties ?? {};

        // Derive elevation zone from fill color if metadata not yet enriched
        const altFill = (altProps.fill as string) ?? null;
        const derivedZone = altFill ? getZoneByColor(altFill) : null;

        // Derive climate name from fill color if metadata not yet enriched
        const climFill = (climProps.fill as string) ?? null;
        const derivedClimate = climFill
          ? (CLIMATE_COLOR_MAP[climFill.toLowerCase()] ?? null)
          : null;

        return {
          coordinates: { lng: input.lng, lat: input.lat },
          elevation: altitude
            ? {
                zoneId: (altProps.zoneId as string) ?? derivedZone?.zoneId ?? null,
                zoneName: (altProps.zoneName as string) ?? derivedZone?.zoneName ?? null,
                elevationMin:
                  (altProps.elevationMin as number) ?? derivedZone?.elevationMin ?? null,
                elevationMax:
                  (altProps.elevationMax as number) ?? derivedZone?.elevationMax ?? null,
                elevationLabel:
                  (altProps.elevationLabel as string) ??
                  (derivedZone ? `${derivedZone.elevationMin}-${derivedZone.elevationMax}m` : null),
                color: altFill ?? derivedZone?.color ?? null,
              }
            : null,
          climate: climate
            ? {
                climateId: (climProps.climateId as string) ?? null,
                climateName: (climProps.climateName as string) ?? derivedClimate ?? null,
                color: climFill,
              }
            : null,
          country: political
            ? {
                featureId: political.featureId,
                displayName: political.displayName || featureIdToDisplayName(political.featureId),
                countryId: political.countryId,
                ...(countryInfo
                  ? {
                      name: countryInfo.name,
                      slug: countryInfo.slug,
                      flag: normalizeFlagUrl(countryInfo.flag),
                    }
                  : {}),
              }
            : null,
          subdivision,
        };
      } catch {
        // PostGIS not available or geometry not synced
        return {
          coordinates: { lng: input.lng, lat: input.lat },
          elevation: null,
          climate: null,
          country: null,
          subdivision: null,
        };
      }
    }),

  /**
   * List all political features with basic metadata (no geometry).
   */
  listCountries: cachedPublicProcedure.query(async ({ ctx }) => {
    const layers = await ctx.db.mapLayer.findMany({
      where: { layerType: "political", isActive: true },
      select: {
        featureId: true,
        displayName: true,
        properties: true,
        countryId: true,
        areaSqKm: true,
        centroid: true,
      },
      orderBy: { displayName: "asc" },
    });

    return layers.map(
      (l: {
        featureId: string;
        displayName: string | null;
        properties: Record<string, unknown>;
        countryId: string | null;
        areaSqKm: number | null;
        centroid: unknown;
      }) => {
        const raw = l.centroid as [number, number] | { coordinates?: [number, number] } | null;
        let cLng = 0,
          cLat = 0;
        if (Array.isArray(raw) && raw.length >= 2) {
          cLng = raw[0];
          cLat = raw[1];
        } else if (raw && "coordinates" in raw && Array.isArray(raw.coordinates)) {
          cLng = raw.coordinates[0];
          cLat = raw.coordinates[1];
        }
        return {
          featureId: l.featureId,
          displayName: l.displayName || featureIdToDisplayName(l.featureId),
          fillColor: getColorForFeature(l.featureId, l.properties as Record<string, unknown>),
          countryId: l.countryId,
          areaSqKm: l.areaSqKm,
          centroidLng: cLng,
          centroidLat: cLat,
          isClaimed: !!l.countryId,
        };
      }
    );
  }),

  /**
   * Get available layer types and their metadata.
   */
  getLayerInfo: cachedPublicProcedure.query(async ({ ctx }) => {
    const counts = await ctx.db.mapLayer.groupBy({
      by: ["layerType"],
      where: { isActive: true },
      _count: { id: true },
    });

    const countMap = new Map(
      counts.map((c: { layerType: string; _count: { id: number } }) => [c.layerType, c._count.id])
    );

    return MAP_LAYER_TYPES.map((type) => ({
      type,
      featureCount: countMap.get(type) || 0,
      available: (countMap.get(type) || 0) > 0,
    }));
  }),

  /**
   * Search map features by name (full-text search).
   */
  searchFeatures: cachedPublicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        types: z.array(z.enum(["political", "city", "poi", "subdivision"])).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;
      const results: Array<{
        type: string;
        id: string;
        name: string;
        countryId: string | null;
        centroidLng: number;
        centroidLat: number;
      }> = [];

      const searchTypes = input.types ?? ["political", "city", "poi", "subdivision"];

      // Search map layers (political features) — search displayName OR featureId
      if (searchTypes.includes("political")) {
        const features = await ctx.db.mapLayer.findMany({
          where: {
            layerType: "political",
            isActive: true,
            OR: [
              { displayName: { contains: input.query, mode: "insensitive" as const } },
              { featureId: { contains: input.query, mode: "insensitive" as const } },
            ],
          },
          select: {
            featureId: true,
            displayName: true,
            countryId: true,
            centroid: true,
          },
          take: limit,
          orderBy: { displayName: "asc" },
        });

        for (const f of features) {
          const raw = f.centroid as [number, number] | { coordinates?: [number, number] } | null;
          let cLng = 0,
            cLat = 0;
          if (Array.isArray(raw) && raw.length >= 2) {
            cLng = raw[0];
            cLat = raw[1];
          } else if (raw && "coordinates" in raw && Array.isArray(raw.coordinates)) {
            cLng = raw.coordinates[0];
            cLat = raw.coordinates[1];
          }
          results.push({
            type: "country",
            id: f.featureId,
            name: f.displayName || featureIdToDisplayName(f.featureId),
            countryId: f.countryId,
            centroidLng: cLng,
            centroidLat: cLat,
          });
        }
      }

      // Search cities
      if (searchTypes.includes("city")) {
        const cities = await ctx.db.city.findMany({
          where: {
            name: { contains: input.query, mode: "insensitive" as const },
            status: "approved",
          },
          select: {
            id: true,
            name: true,
            countryId: true,
            coordinates: true,
          },
          take: limit,
        });

        for (const c of cities) {
          const coords = c.coordinates as [number, number] | null;
          results.push({
            type: "city",
            id: c.id,
            name: c.name,
            countryId: c.countryId,
            centroidLng: coords?.[0] ?? 0,
            centroidLat: coords?.[1] ?? 0,
          });
        }
      }

      // Search subdivisions
      if (searchTypes.includes("subdivision")) {
        const subs = await ctx.db.subdivision.findMany({
          where: {
            name: { contains: input.query, mode: "insensitive" as const },
            status: "approved",
          },
          select: {
            id: true,
            name: true,
            countryId: true,
          },
          take: limit,
        });

        for (const s of subs) {
          results.push({
            type: "subdivision",
            id: s.id,
            name: s.name,
            countryId: s.countryId,
            centroidLng: 0,
            centroidLat: 0,
          });
        }
      }

      return results.slice(0, limit);
    }),

  /**
   * Get neighboring countries using PostGIS ST_Touches / ST_Intersects.
   */
  getNeighbors: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get the country's map feature
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: {
          layerType: "political",
          countryId: input.countryId,
          isActive: true,
        },
      });

      if (!mapLayer) {
        return [];
      }

      // Use PostGIS to find touching/intersecting features
      // Uses pre-computed centroid JSON field instead of ST_Centroid()
      try {
        const neighbors = await ctx.db.$queryRawUnsafe<
          Array<{
            featureId: string;
            displayName: string | null;
            countryId: string | null;
            centroidLng: number | null;
            centroidLat: number | null;
          }>
        >(
          `SELECT ml2."featureId", ml2."displayName", ml2."countryId",
                  (ml2.centroid -> 'coordinates' ->> 0)::float AS "centroidLng",
                  (ml2.centroid -> 'coordinates' ->> 1)::float AS "centroidLat"
           FROM map_layers ml1
           JOIN map_layers ml2 ON ml2."layerType" = 'political'
             AND ml2."isActive" = true
             AND ml2.id != ml1.id
             AND ml1.geom_postgis IS NOT NULL
             AND ml2.geom_postgis IS NOT NULL
             AND ST_Touches(ml1.geom_postgis, ml2.geom_postgis)
           WHERE ml1.id = $1`,
          mapLayer.id
        );

        return neighbors.map((n) => ({
          featureId: n.featureId,
          displayName: n.displayName || featureIdToDisplayName(n.featureId),
          countryId: n.countryId,
          centroidLng: Number(n.centroidLng) || 0,
          centroidLat: Number(n.centroidLat) || 0,
        }));
      } catch {
        // PostGIS query failed
        return [];
      }
    }),

  /**
   * Get all geographic features for a specific country.
   * Includes subdivisions, cities, and points of interest.
   */
  getCountryFeatures: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [subdivisions, cities, pois, storyPins, mapLabels] = await Promise.all([
        ctx.db.subdivision.findMany({
          where: { countryId: input.countryId, status: "approved" },
          orderBy: { name: "asc" },
        }),
        ctx.db.city.findMany({
          where: { countryId: input.countryId, status: "approved" },
          orderBy: [{ isNationalCapital: "desc" }, { population: "desc" }],
        }),
        ctx.db.pointOfInterest.findMany({
          where: { countryId: input.countryId, status: "approved" },
          orderBy: { name: "asc" },
        }),
        ctx.db.storyPin.findMany({
          where: { countryId: input.countryId, status: "approved" },
          orderBy: { ixTimeYear: "asc" },
        }),
        ctx.db.mapLabel.findMany({
          where: { countryId: input.countryId, status: "approved" },
          orderBy: { text: "asc" },
        }),
      ]);

      return { subdivisions, cities, pois, storyPins, mapLabels };
    }),

  /**
   * Get map statistics (admin dashboard).
   */
  getMapStats: cachedPublicProcedure.query(async ({ ctx }) => {
    const [totalFeatures, politicalFeatures, linkedFeatures, unlinkedFeatures] = await Promise.all([
      ctx.db.mapLayer.count({ where: { isActive: true } }),
      ctx.db.mapLayer.count({
        where: { layerType: "political", isActive: true },
      }),
      ctx.db.mapLayer.count({
        where: {
          layerType: "political",
          isActive: true,
          countryId: { not: null },
        },
      }),
      ctx.db.mapLayer.count({
        where: {
          layerType: "political",
          isActive: true,
          countryId: null,
        },
      }),
    ]);

    const [totalCountries, countriesWithGeometry] = await Promise.all([
      ctx.db.country.count(),
      ctx.db.country.count({ where: { geometry: { not: null } } }),
    ]);

    return {
      totalFeatures,
      politicalFeatures,
      linkedFeatures,
      unlinkedFeatures,
      totalCountries,
      countriesWithGeometry,
      linkageRate:
        politicalFeatures > 0 ? Math.round((linkedFeatures / politicalFeatures) * 100) : 0,
    };
  }),

  /**
   * Admin: Link a map feature to a Country record.
   */
  assignCountryGeometry: adminProcedure
    .input(
      z.object({
        featureId: z.string(),
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify feature exists
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId },
      });
      if (!mapLayer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Map feature not found: ${input.featureId}`,
        });
      }

      // Verify country exists
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
      });
      if (!country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Country not found: ${input.countryId}`,
        });
      }

      // Update map layer with country link
      await ctx.db.mapLayer.update({
        where: { id: mapLayer.id },
        data: { countryId: input.countryId },
      });

      // Update country with geometry + area
      await ctx.db.country.update({
        where: { id: input.countryId },
        data: {
          geometry: mapLayer.geometry as object,
          centroid: mapLayer.centroid as object | undefined,
          boundingBox: mapLayer.boundingBox as object | undefined,
          landArea: mapLayer.areaSqKm ?? undefined,
          areaSqMi: mapLayer.areaSqKm ? mapLayer.areaSqKm * 0.386102 : undefined,
        },
      });

      // Invalidate caches
      layerCache.delete("political");
      await invalidateCache([
        "geo.listCountries",
        "geo.getWorldMap",
        "geo.validateLinkage",
        "geo.getCountryLinkage",
      ]);
      broadcastMapUpdate("linkage", input.countryId);

      return {
        featureId: input.featureId,
        countryId: input.countryId,
        countryName: country.name,
      };
    }),

  /**
   * Admin: Unlink a map feature from a Country record.
   */
  unlinkCountryGeometry: adminProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId },
      });

      if (!mapLayer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Map feature not found: ${input.featureId}`,
        });
      }

      const previousCountryId = mapLayer.countryId;

      await ctx.db.mapLayer.update({
        where: { id: mapLayer.id },
        data: { countryId: null },
      });

      // Clear geometry + area from country
      if (previousCountryId) {
        await ctx.db.country.update({
          where: { id: previousCountryId },
          data: {
            geometry: null,
            centroid: null,
            boundingBox: null,
            landArea: null,
            areaSqMi: null,
          },
        });
      }

      layerCache.delete("political");
      await invalidateCache([
        "geo.listCountries",
        "geo.getWorldMap",
        "geo.validateLinkage",
        "geo.getCountryLinkage",
      ]);
      broadcastMapUpdate("linkage", previousCountryId ?? undefined);

      return { featureId: input.featureId, previousCountryId };
    }),

  /**
   * Admin: Auto-link all unlinked political map features to Country records.
   * For each unlinked feature:
   *   1. Try to match an existing Country by name (case-insensitive)
   *   2. If no match, auto-create a new Country record
   * Also auto-detects wiki articles and sets wikiPageTitle.
   */
  autoLinkAllCountries: adminProcedure.mutation(async ({ ctx }) => {
    const unlinked = await ctx.db.mapLayer.findMany({
      where: { layerType: "political", countryId: null, isActive: true },
      select: {
        id: true,
        featureId: true,
        displayName: true,
        geometry: true,
        areaSqKm: true,
        centroid: true,
        boundingBox: true,
      },
    });

    if (unlinked.length === 0) return { linked: 0, created: 0, failed: [] as string[] };

    // Get all existing countries for name matching
    const existingCountries = await ctx.db.country.findMany({
      where: { isDemo: false },
      select: { id: true, name: true },
    });
    const countryByName = new Map(existingCountries.map((c) => [c.name.toLowerCase(), c]));

    // Track which countries are already linked
    const alreadyLinked = new Set(
      (
        await ctx.db.mapLayer.findMany({
          where: { layerType: "political", countryId: { not: null }, isActive: true },
          select: { countryId: true },
        })
      ).map((ml) => ml.countryId)
    );

    let linked = 0;
    let created = 0;
    const failed: string[] = [];

    // Load WikiBridge for auto-detecting wiki articles
    let wikiBridge: typeof import("~/lib/wiki-bridge") | null = null;
    try {
      wikiBridge = await import("~/lib/wiki-bridge");
    } catch {
      /* wiki bridge unavailable */
    }

    for (const feature of unlinked) {
      const name = feature.displayName || feature.featureId;
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      try {
        // Try to match existing country by name
        const existing = countryByName.get(name.toLowerCase());

        if (existing && !alreadyLinked.has(existing.id)) {
          // Link to existing country
          await ctx.db.mapLayer.update({
            where: { id: feature.id },
            data: { countryId: existing.id },
          });
          await ctx.db.country.update({
            where: { id: existing.id },
            data: {
              geometry: feature.geometry as object,
              centroid: feature.centroid as object | undefined,
              boundingBox: feature.boundingBox as object | undefined,
              landArea: feature.areaSqKm ?? undefined,
              areaSqMi: feature.areaSqKm ? feature.areaSqKm * 0.386102 : undefined,
            },
          });
          alreadyLinked.add(existing.id);
          linked++;
        } else {
          // Auto-detect wiki article
          let wikiPageTitle: string | null = null;
          if (wikiBridge) {
            const wikiResults = await wikiBridge.searchPages(name, 1, "ixwiki");
            if (
              wikiResults.length > 0 &&
              wikiResults[0]!.title.toLowerCase() === name.toLowerCase()
            ) {
              wikiPageTitle = wikiResults[0]!.title;
            }
          }

          // Create new country
          const newCountry = await ctx.db.country.create({
            data: {
              name,
              slug,
              geometry: feature.geometry as object,
              centroid: feature.centroid as object | undefined,
              boundingBox: feature.boundingBox as object | undefined,
              landArea: feature.areaSqKm ?? undefined,
              areaSqMi: feature.areaSqKm ? feature.areaSqKm * 0.386102 : undefined,
              economicTier: "developing",
              isDemo: false,
              wikiPageTitle,
              wikiSource: wikiPageTitle ? "ixwiki" : undefined,
            },
          });

          // Link map feature to new country
          await ctx.db.mapLayer.update({
            where: { id: feature.id },
            data: { countryId: newCountry.id },
          });
          alreadyLinked.add(newCountry.id);
          created++;
        }
      } catch (err) {
        failed.push(`${name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    layerCache.delete("political");
    await invalidateCache(["geo.listCountries", "geo.getWorldMap", "geo.validateLinkage"]);

    return { linked, created, failed, total: unlinked.length };
  }),

  /**
   * Admin: Get system health — linkage completeness and data integrity.
   */
  getSystemHealth: cachedPublicProcedure.query(async ({ ctx }) => {
    const [totalFeatures, linkedFeatures, totalCountries, countriesWithGeo, countriesWithWiki] =
      await Promise.all([
        ctx.db.mapLayer.count({ where: { layerType: "political", isActive: true } }),
        ctx.db.mapLayer.count({
          where: { layerType: "political", isActive: true, countryId: { not: null } },
        }),
        ctx.db.country.count({ where: { isDemo: false } }),
        ctx.db.country.count({ where: { isDemo: false, geometry: { not: null } } }),
        ctx.db.country.count({ where: { isDemo: false, wikiPageTitle: { not: null } } }),
      ]);

    return {
      mapFeatures: {
        total: totalFeatures,
        linked: linkedFeatures,
        unlinked: totalFeatures - linkedFeatures,
      },
      countries: {
        total: totalCountries,
        withGeometry: countriesWithGeo,
        withWiki: countriesWithWiki,
      },
      linkageHealth: totalFeatures > 0 ? Math.round((linkedFeatures / totalFeatures) * 100) : 0,
    };
  }),

  /**
   * Admin: Get the edit queue (pending map edit requests).
   */
  getEditQueue: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["pending", "approved", "rejected"]).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? "pending";
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const [edits, total] = await Promise.all([
        ctx.db.mapEditRequest.findMany({
          where: { status },
          include: {
            country: { select: { id: true, name: true, flagUrl: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        ctx.db.mapEditRequest.count({ where: { status } }),
      ]);

      return {
        edits: edits.map(
          (e: {
            id: string;
            countryId: string;
            userId: string;
            editType: string;
            targetId: string | null;
            operation: string;
            proposedData: unknown;
            currentData: unknown;
            status: string;
            reviewedBy: string | null;
            reviewedAt: Date | null;
            reviewNote: string | null;
            createdAt: Date;
            country: { id: string; name: string; flagUrl: string | null };
          }) => ({
            id: e.id,
            countryId: e.countryId,
            countryName: e.country.name,
            countryFlag: e.country.flagUrl,
            userId: e.userId,
            editType: e.editType,
            targetId: e.targetId,
            operation: e.operation,
            proposedData: e.proposedData,
            currentData: e.currentData,
            status: e.status,
            reviewedBy: e.reviewedBy,
            reviewedAt: e.reviewedAt,
            reviewNote: e.reviewNote,
            createdAt: e.createdAt,
          })
        ),
        total,
        hasMore: offset + limit < total,
      };
    }),

  /**
   * Admin: Approve a map edit request.
   */
  approveEdit: adminProcedure
    .input(
      z.object({
        editId: z.string(),
        reviewNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edit = await ctx.db.mapEditRequest.findUnique({
        where: { id: input.editId },
      });

      if (!edit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Edit request not found",
        });
      }

      if (edit.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Edit already ${edit.status}`,
        });
      }

      // Apply the edit based on type
      const proposed = edit.proposedData as Record<string, unknown>;

      if (edit.editType === "border_adjust" && edit.operation === "update") {
        // Update the country's border geometry
        const mapLayer = await ctx.db.mapLayer.findFirst({
          where: { layerType: "political", countryId: edit.countryId },
        });
        if (mapLayer && proposed.geometry) {
          const oldAreaSqKm = mapLayer.areaSqKm;

          await ctx.db.mapLayer.update({
            where: { id: mapLayer.id },
            data: { geometry: proposed.geometry as object },
          });
          await ctx.db.country.update({
            where: { id: edit.countryId },
            data: { geometry: proposed.geometry as object },
          });

          // Recalculate area via PostGIS and update records
          try {
            const areaResult = await ctx.db.$queryRawUnsafe<Array<{ area_sq_km: number }>>(
              `SELECT ST_Area(geom_postgis::geography) / 1000000 as area_sq_km
               FROM map_layers WHERE id = $1 AND geom_postgis IS NOT NULL`,
              mapLayer.id
            );
            const newAreaSqKm = areaResult[0]?.area_sq_km;
            if (newAreaSqKm != null) {
              const areaSqMi = newAreaSqKm * 0.386102;
              await ctx.db.mapLayer.update({
                where: { id: mapLayer.id },
                data: { areaSqKm: newAreaSqKm },
              });
              await ctx.db.country.update({
                where: { id: edit.countryId },
                data: { landArea: newAreaSqKm, areaSqMi },
              });

              // Create BorderHistory record
              const oldSqMi = oldAreaSqKm ? oldAreaSqKm * 0.386102 : null;
              const newSqMi = newAreaSqKm * 0.386102;
              await ctx.db.borderHistory.create({
                data: {
                  countryId: edit.countryId,
                  geometry: proposed.geometry as object,
                  changedBy: ctx.auth!.userId,
                  reason: input.reviewNote ?? "Border adjustment approved",
                  oldAreaSqMi: oldSqMi,
                  newAreaSqMi: newSqMi,
                  areaDeltaSqMi: newSqMi - (oldSqMi ?? 0),
                },
              });

              // Create activity feed entry
              const country = await ctx.db.country.findUnique({
                where: { id: edit.countryId },
                select: { name: true },
              });
              const deltaKm = newAreaSqKm - (oldAreaSqKm ?? 0);
              const direction = deltaKm >= 0 ? "expanded" : "contracted";
              await ActivityGenerator.createActivity({
                type: "economic",
                category: "game",
                countryId: edit.countryId,
                title: `Border ${direction === "expanded" ? "Expansion" : "Contraction"}: ${country?.name ?? "Unknown"}`,
                description: `${country?.name ?? "A country"} ${direction} by ${Math.abs(deltaKm).toFixed(0)} km². New area: ${newAreaSqKm.toFixed(0)} km².`,
                priority: "medium",
                visibility: "public",
                metadata: { oldArea: oldAreaSqKm, newArea: newAreaSqKm, delta: deltaKm },
              });
            }
          } catch (areaErr) {
            console.error("[geo.approveEdit] Area recalculation failed:", areaErr);
          }

          layerCache.delete("political");
        }
      } else if (edit.editType === "subdivision") {
        if (edit.operation === "create") {
          await ctx.db.subdivision.create({
            data: {
              name: proposed.name as string,
              countryId: edit.countryId,
              type: (proposed.type as string) ?? "province",
              level: (proposed.level as number) ?? 1,
              geometry: proposed.geometry as object | undefined,
              status: "approved",
            },
          });
        } else if (edit.operation === "update" && edit.targetId) {
          await ctx.db.subdivision.update({
            where: { id: edit.targetId },
            data: {
              name: proposed.name as string | undefined,
              type: proposed.type as string | undefined,
              geometry: proposed.geometry as object | undefined,
            },
          });
        } else if (edit.operation === "delete" && edit.targetId) {
          await ctx.db.subdivision.delete({ where: { id: edit.targetId } });
        }
      } else if (edit.editType === "city") {
        if (edit.operation === "create") {
          await ctx.db.city.create({
            data: {
              name: proposed.name as string,
              countryId: edit.countryId,
              cityType: (proposed.cityType as string) ?? "city",
              coordinates: proposed.coordinates as object | undefined,
              population: proposed.population as number | undefined,
              isNationalCapital: proposed.isNationalCapital as boolean | undefined,
              status: "approved",
            },
          });
        } else if (edit.operation === "update" && edit.targetId) {
          await ctx.db.city.update({
            where: { id: edit.targetId },
            data: {
              name: proposed.name as string | undefined,
              coordinates: proposed.coordinates as object | undefined,
              population: proposed.population as number | undefined,
              isNationalCapital: proposed.isNationalCapital as boolean | undefined,
            },
          });
        } else if (edit.operation === "delete" && edit.targetId) {
          await ctx.db.city.delete({ where: { id: edit.targetId } });
        }
      } else if (edit.editType === "poi") {
        if (edit.operation === "create") {
          const poi = await ctx.db.pointOfInterest.create({
            data: {
              name: proposed.name as string,
              countryId: edit.countryId,
              category: (proposed.category as string) ?? "landmark",
              coordinates: proposed.coordinates as object | undefined,
              description: proposed.description as string | undefined,
              status: "approved",
            },
          });

          try {
            const country = await ctx.db.country.findUnique({
              where: { id: edit.countryId },
              select: { name: true },
            });
            await ActivityGenerator.createActivity({
              type: "meta",
              category: "game",
              countryId: edit.countryId,
              title: `New Point of Interest: ${poi.name}`,
              description: `${country?.name ?? "A country"} added a new point of interest: ${poi.name} (${poi.category}).`,
              priority: "low",
              visibility: "public",
              metadata: {
                poiId: poi.id,
                poiName: poi.name,
                category: poi.category,
                description: poi.description,
              },
            });
          } catch (e) {
            console.error("[geo.approveEdit] Failed to create activity for POI:", e);
          }
        } else if (edit.operation === "update" && edit.targetId) {
          await ctx.db.pointOfInterest.update({
            where: { id: edit.targetId },
            data: {
              name: proposed.name as string | undefined,
              category: proposed.category as string | undefined,
              coordinates: proposed.coordinates as object | undefined,
              description: proposed.description as string | undefined,
            },
          });
        } else if (edit.operation === "delete" && edit.targetId) {
          await ctx.db.pointOfInterest.delete({ where: { id: edit.targetId } });
        }
      }

      // Mark approved
      await ctx.db.mapEditRequest.update({
        where: { id: input.editId },
        data: {
          status: "approved",
          reviewedBy: ctx.auth!.userId,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote ?? null,
        },
      });

      return { id: input.editId, status: "approved" as const };
    }),

  /**
   * Admin: Reject a map edit request.
   */
  rejectEdit: adminProcedure
    .input(
      z.object({
        editId: z.string(),
        reviewNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edit = await ctx.db.mapEditRequest.findUnique({
        where: { id: input.editId },
      });

      if (!edit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Edit request not found",
        });
      }

      if (edit.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Edit already ${edit.status}`,
        });
      }

      await ctx.db.mapEditRequest.update({
        where: { id: input.editId },
        data: {
          status: "rejected",
          reviewedBy: ctx.auth!.userId,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote ?? null,
        },
      });

      return { id: input.editId, status: "rejected" as const };
    }),

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
        where: { id: `${ctx.auth!.userId}_${input.featureId}` },
        create: {
          id: `${ctx.auth!.userId}_${input.featureId}`,
          userId: ctx.auth!.userId,
          featureId: input.featureId,
          sessionData: { undoStack: [], mode: "select" },
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
          sessionData: input.sessionData,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId, isActive: true },
        select: { id: true, geometry: true, countryId: true, displayName: true },
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
            geometry: input.proposedGeometry,
            centroid,
            boundingBox: bbox,
            areaSqKm: area,
          },
        });

        // Clear cache
        layerCache.delete("political");

        // Clean up session
        await ctx.db.mapEditorSession.deleteMany({
          where: { userId: ctx.auth!.userId, featureId: input.featureId },
        });

        return { applied: true, editRequestId: null };
      }

      // Create edit request for review
      const editRequest = await ctx.db.mapEditRequest.create({
        data: {
          countryId: feature.countryId ?? "unknown",
          userId: ctx.auth!.userId,
          editType: "border_adjust",
          editSubtype: input.editSubtype,
          operation: "update",
          proposedData: input.proposedGeometry,
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

      layerCache.delete("political");

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

      layerCache.delete("political");

      return {
        mergedFeatures: input.featureIds,
        newFeature: { featureId: newFeatureId, name: input.newName },
      };
    }),

  /** Get neighbor geometries for a feature (for shared border visualization). */
  getNeighborGeometries: adminProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const feature = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId, isActive: true },
        select: { boundingBox: true },
      });
      if (!feature) return [];

      const bbox = feature.boundingBox as number[] | null;
      if (!bbox || bbox.length !== 4) return [];

      const pad = 1;
      const neighbors = await ctx.db.mapLayer.findMany({
        where: {
          layerType: "political",
          featureId: { not: input.featureId },
          isActive: true,
        },
        select: { featureId: true, displayName: true, geometry: true, boundingBox: true },
      });

      return neighbors
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
        .map((l) => ({
          featureId: l.featureId,
          displayName: l.displayName,
          geometry: l.geometry,
        }));
    }),

  /**
   * Admin: Recalculate area for a map feature using PostGIS.
   */
  recalculateArea: adminProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId },
      });

      if (!mapLayer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Map feature not found: ${input.featureId}`,
        });
      }

      try {
        const result = await ctx.db.$queryRawUnsafe<Array<{ area_sqkm: number }>>(
          `SELECT ST_Area(geom_postgis::geography) / 1000000.0 as area_sqkm
           FROM map_layers WHERE id = $1 AND geom_postgis IS NOT NULL`,
          mapLayer.id
        );

        if (result.length > 0 && result[0].area_sqkm) {
          await ctx.db.mapLayer.update({
            where: { id: mapLayer.id },
            data: { areaSqKm: result[0].area_sqkm },
          });
          return {
            featureId: input.featureId,
            areaSqKm: result[0].area_sqkm,
          };
        }
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "PostGIS area calculation failed",
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No geometry available for area calculation",
      });
    }),

  /**
   * Admin: Bulk recalculate areas for all political features.
   */
  recalculateAllAreas: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await ctx.db.$executeRawUnsafe(`
        UPDATE map_layers
        SET "areaSqKm" = ST_Area(geom_postgis::geography) / 1000000.0
        WHERE "layerType" = 'political'
          AND geom_postgis IS NOT NULL
      `);
      return { updated: result };
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "PostGIS bulk area recalculation failed",
      });
    }
  }),

  // ──────────────────────────────────────────────
  // User map editor endpoints (country owners)
  // ──────────────────────────────────────────────

  /**
   * Validate that a point is inside the user's country borders (PostGIS).
   * Returns true/false.
   */
  validatePointInCountry: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        lng: z.number(),
        lat: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.$queryRawUnsafe<Array<{ is_inside: boolean }>>(
          `SELECT ST_Contains(
             (SELECT geom_postgis FROM map_layers WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL LIMIT 1),
             ST_SetSRID(ST_MakePoint($2, $3), 4326)
           ) as is_inside`,
          input.countryId,
          input.lng,
          input.lat
        );
        return { isInside: result[0]?.is_inside ?? false };
      } catch {
        return { isInside: false };
      }
    }),

  /**
   * Create a city within the user's country.
   * Auto-approved if the point is inside the country's borders.
   */
  createCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        cityType: z.string().default("city"),
        coordinates: coordinatesSchema,
        population: z.number().int().min(0).optional(),
        isNationalCapital: z.boolean().default(false),
        isSubdivisionCapital: z.boolean().default(false),
        subdivisionId: z.string().optional(),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Validate containment + collision + name uniqueness
      await validatePointContainment(
        ctx.db,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "City"
      );
      await checkPointCollision(
        ctx.db,
        "city",
        input.countryId,
        input.coordinates[0],
        input.coordinates[1]
      );
      await checkNameUniqueness(ctx.db, input.countryId, input.name, "city");

      // If marking as capital, clear any existing capital for this country
      if (input.isNationalCapital) {
        await ctx.db.city.updateMany({
          where: { countryId: input.countryId, isNationalCapital: true },
          data: { isNationalCapital: false },
        });
      }

      const city = await ctx.db.city.create({
        data: {
          name: input.name,
          countryId: input.countryId,
          type: input.cityType,
          coordinates: input.coordinates,
          population: input.population,
          isNationalCapital: input.isNationalCapital,
          isSubdivisionCapital: input.isSubdivisionCapital,
          subdivisionId: input.subdivisionId,
          wikiPageTitle: input.wikiPageTitle,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });

      // Invalidate map caches so the public map updates
      await invalidateCache(["geo.getAllMapFeatures"]);
      if (input.isNationalCapital) {
        await invalidateCache(["geo.getCapitalCities"]);
      }
      broadcastMapUpdate("city", input.countryId);

      return { id: city.id, name: city.name, status: "approved" as const };
    }),

  /**
   * Update a city within the user's country.
   */
  updateCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        cityId: z.string(),
        name: z.string().min(1).max(100).optional(),
        cityType: z.string().optional(),
        coordinates: coordinatesSchema.optional(),
        population: z.number().int().min(0).optional(),
        isNationalCapital: z.boolean().optional(),
        isSubdivisionCapital: z.boolean().optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Verify city belongs to country
      const city = await ctx.db.city.findFirst({
        where: { id: input.cityId, countryId: input.countryId },
      });
      if (!city) {
        throw new TRPCError({ code: "NOT_FOUND", message: "City not found" });
      }

      // If coordinates changed, validate containment + collision
      if (input.coordinates) {
        await validatePointContainment(
          ctx.db,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "City"
        );
        await checkPointCollision(
          ctx.db,
          "city",
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          input.cityId
        );
      }
      if (input.name) {
        await checkNameUniqueness(ctx.db, input.countryId, input.name, "city", input.cityId);
      }

      const updated = await ctx.db.city.update({
        where: { id: input.cityId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.cityType && { type: input.cityType }),
          ...(input.coordinates && { coordinates: input.coordinates }),
          ...(input.population !== undefined && { population: input.population }),
          ...(input.isNationalCapital !== undefined && {
            isNationalCapital: input.isNationalCapital,
          }),
          ...(input.isSubdivisionCapital !== undefined && {
            isSubdivisionCapital: input.isSubdivisionCapital,
          }),
          ...(input.wikiPageTitle !== undefined && { wikiPageTitle: input.wikiPageTitle }),
        },
      });

      await invalidateCache(["geo.getAllMapFeatures"]);
      broadcastMapUpdate("city", input.countryId);
      return { id: updated.id, name: updated.name };
    }),

  /**
   * Delete a city from the user's country.
   */
  deleteCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        cityId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const city = await ctx.db.city.findFirst({
        where: { id: input.cityId, countryId: input.countryId },
      });
      if (!city) {
        throw new TRPCError({ code: "NOT_FOUND", message: "City not found" });
      }

      const wasCapital = city.isNationalCapital;
      await ctx.db.city.delete({ where: { id: input.cityId } });
      await invalidateCache(["geo.getAllMapFeatures"]);
      if (wasCapital) {
        await invalidateCache(["geo.getCapitalCities"]);
      }
      broadcastMapUpdate("city", input.countryId);
      return { id: input.cityId, deleted: true };
    }),

  /**
   * Create a subdivision within the user's country.
   * Auto-approved if polygon is inside country borders.
   */
  createSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        type: z.string().default("province"),
        level: z.number().int().min(1).max(5).default(1),
        geometry: z.record(z.string(), z.unknown()),
        capital: z.string().optional(),
        population: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Validate containment + name uniqueness
      await validatePolygonContainment(ctx.db, input.countryId, input.geometry, "Subdivision");
      await checkNameUniqueness(ctx.db, input.countryId, input.name, "subdivision");

      const subdivision = await ctx.db.subdivision.create({
        data: {
          name: input.name,
          countryId: input.countryId,
          type: input.type,
          level: input.level,
          geometry: input.geometry,
          capital: input.capital,
          population: input.population,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });

      // Get terrain breakdown for the subdivision (informational)
      let terrainInfo: Awaited<ReturnType<typeof getTerrainForArea>> | null = null;
      try {
        terrainInfo = await getTerrainForArea(ctx.db, input.geometry as unknown as import("geojson").Geometry);
      } catch {
        // Terrain query failed — non-blocking
      }

      await invalidateCache(["geo.getAllMapFeatures"]);
      broadcastMapUpdate("subdivision", input.countryId);
      return {
        id: subdivision.id,
        name: subdivision.name,
        status: "approved" as const,
        terrain: terrainInfo,
      };
    }),

  /**
   * Update a subdivision within the user's country.
   */
  updateSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        subdivisionId: z.string(),
        name: z.string().min(1).max(100).optional(),
        type: z.string().optional(),
        level: z.number().int().min(1).max(5).optional(),
        geometry: z.record(z.string(), z.unknown()).optional(),
        capital: z.string().optional(),
        population: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const sub = await ctx.db.subdivision.findFirst({
        where: { id: input.subdivisionId, countryId: input.countryId },
      });
      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Subdivision not found" });
      }

      // Validate new geometry if provided
      if (input.geometry) {
        await validatePolygonContainment(ctx.db, input.countryId, input.geometry, "Subdivision");
      }
      if (input.name) {
        await checkNameUniqueness(
          ctx.db,
          input.countryId,
          input.name,
          "subdivision",
          input.subdivisionId
        );
      }

      const updated = await ctx.db.subdivision.update({
        where: { id: input.subdivisionId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.type && { type: input.type }),
          ...(input.level !== undefined && { level: input.level }),
          ...(input.geometry && { geometry: input.geometry }),
          ...(input.capital !== undefined && { capital: input.capital }),
          ...(input.population !== undefined && { population: input.population }),
        },
      });

      await invalidateCache(["geo.getAllMapFeatures"]);
      broadcastMapUpdate("subdivision", input.countryId);
      return { id: updated.id, name: updated.name };
    }),

  /**
   * Delete a subdivision from the user's country.
   */
  deleteSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        subdivisionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const sub = await ctx.db.subdivision.findFirst({
        where: { id: input.subdivisionId, countryId: input.countryId },
      });
      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Subdivision not found" });
      }

      await ctx.db.subdivision.delete({ where: { id: input.subdivisionId } });
      await invalidateCache(["geo.getAllMapFeatures"]);
      broadcastMapUpdate("subdivision", input.countryId);
      return { id: input.subdivisionId, deleted: true };
    }),

  /**
   * Batch simplify all subdivisions for a country.
   * Reduces vertex count using Douglas-Peucker, sanitizes shapes,
   * and snaps shared borders between neighbors.
   */
  simplifySubdivisions: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        targetVerticesPerProvince: z.number().min(30).max(300).default(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const subdivisions = await ctx.db.subdivision.findMany({
        where: { countryId: input.countryId },
        select: { id: true, name: true, geometry: true },
      });

      if (subdivisions.length === 0) {
        return { updated: 0, total: 0, verticesBefore: 0, verticesAfter: 0, reduction: 0 };
      }

      const { simplifyProvinceBatch, countVertices } =
        await import("~/lib/province-importer/topo-simplify");

      // Build Feature array from all subdivisions with valid geometry
      const validSubs = subdivisions.filter((s) => s.geometry);
      const features = validSubs.map((sub) => ({
        type: "Feature" as const,
        properties: { name: sub.name, _dbId: sub.id },
        geometry: sub.geometry as any,
      }));

      const verticesBefore = features.reduce((s, f) => s + countVertices(f.geometry), 0);

      const result = simplifyProvinceBatch(features, {
        targetVerticesPerProvince: input.targetVerticesPerProvince,
      });

      // Write simplified geometries back to the database
      let updated = 0;
      for (let i = 0; i < validSubs.length; i++) {
        const sub = validSubs[i]!;
        const simplified = result.features[i];
        if (!simplified?.geometry) continue;

        const beforeCount = countVertices(features[i]!.geometry);
        const afterCount = countVertices(simplified.geometry);

        // Only update if actually reduced
        if (afterCount < beforeCount) {
          await ctx.db.subdivision.update({
            where: { id: sub.id },
            data: { geometry: simplified.geometry as any },
          });
          updated++;
        }
      }

      await invalidateCache(["geo.getAllMapFeatures"]);

      return {
        updated,
        total: subdivisions.length,
        verticesBefore,
        verticesAfter: result.totalVerticesAfter,
        reduction:
          verticesBefore > 0
            ? Math.round((1 - result.totalVerticesAfter / verticesBefore) * 100)
            : 0,
      };
    }),

  /**
   * Get per-subdivision stats for the Province Painter map mode.
   * Returns population, area, feature counts, development score, etc.
   */
  getSubdivisionStats: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const subdivisions = await ctx.db.subdivision.findMany({
        where: { countryId: input.countryId, status: "approved" },
        select: {
          id: true,
          name: true,
          type: true,
          population: true,
          areaSqKm: true,
          geometry: true,
          color: true,
        },
      });

      if (subdivisions.length === 0) return [];

      // Fetch related features for the country
      const [cities, pois, resources, routes] = await Promise.all([
        ctx.db.city.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: { id: true, coordinates: true, population: true, wikiPageTitle: true },
        }),
        ctx.db.pointOfInterest.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: { id: true, coordinates: true, wikiPageTitle: true },
        }),
        ctx.db.geographicResource.findMany({
          where: { countryId: input.countryId },
          select: { id: true, coordinates: true, resourceType: true },
        }),
        ctx.db.transportRoute.findMany({
          where: { countryId: input.countryId },
          select: { id: true, geometry: true },
        }),
      ]);

      // Simple bbox containment check (no PostGIS needed)
      function pointInBbox(pt: unknown, bbox: [number, number, number, number]): boolean {
        if (!Array.isArray(pt) || pt.length < 2) return false;
        const [lng, lat] = pt as [number, number];
        return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
      }

      function geoBbox(geo: any): [number, number, number, number] | null {
        if (!geo || !geo.coordinates) return null;
        const coords = geo.type === "Polygon" ? geo.coordinates[0] : geo.coordinates?.[0]?.[0];
        if (!Array.isArray(coords) || coords.length === 0) return null;
        let minLng = Infinity,
          maxLng = -Infinity,
          minLat = Infinity,
          maxLat = -Infinity;
        for (const c of coords) {
          if (c[0] < minLng) minLng = c[0];
          if (c[0] > maxLng) maxLng = c[0];
          if (c[1] < minLat) minLat = c[1];
          if (c[1] > maxLat) maxLat = c[1];
        }
        return [minLng, minLat, maxLng, maxLat];
      }

      return subdivisions.map((sub) => {
        const bbox = geoBbox(sub.geometry);

        // Count features within this subdivision's bbox
        let cityCount = 0,
          poiCount = 0,
          resourceCount = 0,
          wikiLinked = 0;
        const resourceTypes = new Set<string>();

        if (bbox) {
          for (const c of cities) {
            if (pointInBbox(c.coordinates, bbox)) {
              cityCount++;
              if (c.wikiPageTitle) wikiLinked++;
            }
          }
          for (const p of pois) {
            if (pointInBbox(p.coordinates, bbox)) {
              poiCount++;
              if (p.wikiPageTitle) wikiLinked++;
            }
          }
          for (const r of resources) {
            if (pointInBbox(r.coordinates, bbox)) {
              resourceCount++;
              if (r.resourceType) resourceTypes.add(r.resourceType);
            }
          }
        }

        const totalFeatures = cityCount + poiCount;
        const routeCount = routes.length; // simplified: all routes count for all regions

        // Development score (0-10): weighted combination of metrics
        const popScore = Math.min((sub.population ?? 0) / 1_000_000, 3); // up to 3 pts for 1M+ pop
        const cityScore = Math.min(cityCount * 1.5, 3); // up to 3 pts for 2+ cities
        const resourceScore = Math.min(resourceCount * 0.5, 2); // up to 2 pts for 4+ resources
        const infraScore = Math.min(routeCount * 0.3, 1); // up to 1 pt for routes
        const wikiScore = totalFeatures > 0 ? wikiLinked / totalFeatures : 0; // up to 1 pt
        const developmentScore = Math.min(
          10,
          Math.round((popScore + cityScore + resourceScore + infraScore + wikiScore) * 10) / 10
        );

        return {
          id: sub.id,
          name: sub.name,
          type: sub.type,
          population: sub.population,
          areaSqKm: sub.areaSqKm,
          color: sub.color,
          cityCount,
          poiCount,
          resourceCount,
          resourceTypes: Array.from(resourceTypes),
          wikiLinked,
          totalFeatures,
          developmentScore,
        };
      });
    }),

  /**
   * Create a point of interest within the user's country.
   * Auto-approved if point is inside borders.
   */
  createPOI: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        category: z.string().default("landmark"),
        coordinates: coordinatesSchema,
        description: z.string().max(500).optional(),
        icon: z.string().optional(),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Validate containment + collision + name uniqueness
      await validatePointContainment(
        ctx.db,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "Point of interest"
      );
      await checkPointCollision(
        ctx.db,
        "pointOfInterest",
        input.countryId,
        input.coordinates[0],
        input.coordinates[1]
      );
      await checkNameUniqueness(ctx.db, input.countryId, input.name, "poi");

      const poi = await ctx.db.pointOfInterest.create({
        data: {
          name: input.name,
          countryId: input.countryId,
          category: input.category,
          coordinates: input.coordinates,
          description: input.description,
          icon: input.icon,
          wikiPageTitle: input.wikiPageTitle,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });

      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { name: true },
        });
        await ActivityGenerator.createActivity({
          type: "meta",
          category: "game",
          countryId: input.countryId,
          title: `New Point of Interest: ${poi.name}`,
          description: `${country?.name ?? "A country"} added a new point of interest: ${poi.name} (${poi.category}).`,
          priority: "low",
          visibility: "public",
          metadata: {
            poiId: poi.id,
            poiName: poi.name,
            category: poi.category,
            wikiPageTitle: poi.wikiPageTitle,
            description: poi.description,
          },
        });
      } catch (e) {
        console.error("[geo.createPOI] Failed to create activity for POI:", e);
      }

      await invalidateCache(["geo.getAllMapFeatures"]);
      broadcastMapUpdate("poi", input.countryId);
      return { id: poi.id, name: poi.name, status: "approved" as const };
    }),

  /**
   * Update a point of interest within the user's country.
   */
  updatePOI: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        poiId: z.string(),
        name: z.string().min(1).max(100).optional(),
        category: z.string().optional(),
        coordinates: coordinatesSchema.optional(),
        description: z.string().max(500).optional(),
        icon: z.string().optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const poi = await ctx.db.pointOfInterest.findFirst({
        where: { id: input.poiId, countryId: input.countryId },
      });
      if (!poi) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Point of interest not found" });
      }

      if (input.coordinates) {
        await validatePointContainment(
          ctx.db,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "Point of interest"
        );
        await checkPointCollision(
          ctx.db,
          "pointOfInterest",
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          input.poiId
        );
      }
      if (input.name) {
        await checkNameUniqueness(ctx.db, input.countryId, input.name, "poi", input.poiId);
      }

      const updated = await ctx.db.pointOfInterest.update({
        where: { id: input.poiId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.category && { category: input.category }),
          ...(input.coordinates && { coordinates: input.coordinates }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.wikiPageTitle !== undefined && { wikiPageTitle: input.wikiPageTitle }),
        },
      });

      await invalidateCache(["geo.getAllMapFeatures"]);
      broadcastMapUpdate("poi", input.countryId);
      return { id: updated.id, name: updated.name };
    }),

  /**
   * Delete a point of interest from the user's country.
   */
  deletePOI: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        poiId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const poi = await ctx.db.pointOfInterest.findFirst({
        where: { id: input.poiId, countryId: input.countryId },
      });
      if (!poi) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Point of interest not found" });
      }

      await ctx.db.pointOfInterest.delete({ where: { id: input.poiId } });
      await invalidateCache(["geo.getAllMapFeatures"]);
      broadcastMapUpdate("poi", input.countryId);
      return { id: input.poiId, deleted: true };
    }),

  // ──────────────────────────────────────────────
  // Story Pins — Narrative markers on the map
  // ──────────────────────────────────────────────

  createStoryPin: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(15000),
        contentFormat: z.enum(["plain", "markdown"]).default("plain"),
        category: z.enum([
          "battle",
          "founding",
          "treaty",
          "cultural",
          "religious",
          "natural",
          "trade",
          "exploration",
          "naval",
          "settlement",
          "government",
          "biography",
          "linguistic",
          "upheaval",
        ]),
        importance: z.number().int().min(0).max(2).default(0),
        coordinates: coordinatesSchema,
        ixTimeYear: z.number().int().optional(),
        eraLabel: z.string().max(100).optional(),
        wikiPageTitle: z.string().max(200).optional(),
        photos: z.array(z.string().url()).max(10).optional(),
        thumbnailUrl: z.string().url().optional(),
        icon: z.string().optional(),
        storylineId: z.string().optional(),
        storylineOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      await validatePointContainment(
        ctx.db,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "Story pin"
      );
      await checkNameUniqueness(ctx.db, input.countryId, input.title, "storyPin");

      const pin = await ctx.db.storyPin.create({
        data: {
          title: input.title,
          content: input.content,
          contentFormat: input.contentFormat,
          countryId: input.countryId,
          category: input.category,
          importance: input.importance,
          coordinates: input.coordinates,
          ixTimeYear: input.ixTimeYear,
          eraLabel: input.eraLabel,
          wikiPageTitle: input.wikiPageTitle,
          photos: input.photos ?? [],
          thumbnailUrl: input.thumbnailUrl,
          icon: input.icon,
          storylineId: input.storylineId,
          storylineOrder: input.storylineOrder,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });
      await invalidateCache(["geo.getAllMapFeatures", "geo.getAllStoryPins"]);
      broadcastMapUpdate("storyPin", input.countryId);

      // Auto-generate ThinkPages news for major/legendary story pins
      if (input.importance >= 1) {
        import("~/lib/diplomatic-news-generator")
          .then(({ generateStoryPinNews }) => {
            generateStoryPinNews(
              ctx.db,
              input.countryId,
              pin.title,
              input.category,
              input.importance,
              input.ixTimeYear
            ).catch((err: unknown) => {
              console.error("[Geo] Background op failed:", (err as Error).message);
            });
          })
          .catch((err: unknown) => {
            console.error("[Geo] Background op failed:", (err as Error).message);
          });
      }

      return { id: pin.id, title: pin.title, status: "approved" as const };
    }),

  updateStoryPin: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        pinId: z.string(),
        title: z.string().min(1).max(200).optional(),
        content: z.string().min(1).max(15000).optional(),
        contentFormat: z.enum(["plain", "markdown"]).optional(),
        category: z
          .enum([
            "battle",
            "founding",
            "treaty",
            "cultural",
            "religious",
            "natural",
            "trade",
            "exploration",
            "naval",
            "settlement",
            "government",
            "biography",
            "linguistic",
            "upheaval",
          ])
          .optional(),
        importance: z.number().int().min(0).max(2).optional(),
        coordinates: coordinatesSchema.optional(),
        ixTimeYear: z.number().int().nullable().optional(),
        eraLabel: z.string().max(100).nullable().optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
        photos: z.array(z.string().url()).max(10).optional(),
        thumbnailUrl: z.string().url().nullable().optional(),
        icon: z.string().nullable().optional(),
        storylineId: z.string().nullable().optional(),
        storylineOrder: z.number().int().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const pin = await ctx.db.storyPin.findFirst({
        where: { id: input.pinId, countryId: input.countryId },
      });
      if (!pin) throw new TRPCError({ code: "NOT_FOUND", message: "Story pin not found" });

      if (input.coordinates) {
        await validatePointContainment(
          ctx.db,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "Story pin"
        );
      }
      if (input.title) {
        await checkNameUniqueness(ctx.db, input.countryId, input.title, "storyPin", input.pinId);
      }

      const updated = await ctx.db.storyPin.update({
        where: { id: input.pinId },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.content && { content: input.content }),
          ...(input.contentFormat && { contentFormat: input.contentFormat }),
          ...(input.category && { category: input.category }),
          ...(input.importance !== undefined && { importance: input.importance }),
          ...(input.coordinates && { coordinates: input.coordinates }),
          ...(input.ixTimeYear !== undefined && { ixTimeYear: input.ixTimeYear }),
          ...(input.eraLabel !== undefined && { eraLabel: input.eraLabel }),
          ...(input.wikiPageTitle !== undefined && { wikiPageTitle: input.wikiPageTitle }),
          ...(input.photos && { photos: input.photos }),
          ...(input.thumbnailUrl !== undefined && { thumbnailUrl: input.thumbnailUrl }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.storylineId !== undefined && { storylineId: input.storylineId }),
          ...(input.storylineOrder !== undefined && { storylineOrder: input.storylineOrder }),
        },
      });
      await invalidateCache(["geo.getAllMapFeatures", "geo.getAllStoryPins"]);
      broadcastMapUpdate("storyPin", input.countryId);
      return { id: updated.id, title: updated.title };
    }),

  deleteStoryPin: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), pinId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const pin = await ctx.db.storyPin.findFirst({
        where: { id: input.pinId, countryId: input.countryId },
      });
      if (!pin) throw new TRPCError({ code: "NOT_FOUND", message: "Story pin not found" });
      await ctx.db.storyPin.delete({ where: { id: input.pinId } });
      await invalidateCache(["geo.getAllMapFeatures", "geo.getAllStoryPins"]);
      broadcastMapUpdate("storyPin", input.countryId);
      return { id: input.pinId, deleted: true };
    }),

  getStoryPin: cachedPublicProcedure
    .input(z.object({ pinId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.storyPin.findUnique({
        where: { id: input.pinId },
        include: {
          country: { select: { name: true, slug: true } },
          storyline: { select: { id: true, title: true, color: true } },
        },
      });
    }),

  /** Full story pin data with wiki enrichment for the modal view. */
  getStoryPinFull: cachedPublicProcedure
    .input(z.object({ pinId: z.string() }))
    .query(async ({ ctx, input }) => {
      const pin = await ctx.db.storyPin.findUnique({
        where: { id: input.pinId },
        include: {
          country: { select: { id: true, name: true, slug: true } },
          storyline: {
            select: {
              id: true,
              title: true,
              color: true,
              description: true,
              pins: {
                select: {
                  id: true,
                  title: true,
                  ixTimeYear: true,
                  eraLabel: true,
                  category: true,
                  coordinates: true,
                },
                where: { status: "approved" },
                orderBy: [{ storylineOrder: "asc" }, { ixTimeYear: "asc" }],
              },
            },
          },
        },
      });
      if (!pin) throw new TRPCError({ code: "NOT_FOUND", message: "Story pin not found" });

      // Fetch wiki enrichment if linked
      let wikiEnrichment = null;
      if (pin.wikiPageTitle) {
        try {
          const { enrichFromWiki } = await import("~/lib/story-pin-enrichment");
          wikiEnrichment = await enrichFromWiki(pin.wikiPageTitle);
        } catch {
          // Wiki enrichment is best-effort
        }
      }

      // Fetch related pins: nearby (same country) and same-era
      const relatedPins = await ctx.db.storyPin.findMany({
        where: {
          countryId: pin.countryId,
          status: "approved",
          id: { not: pin.id },
          ...(pin.ixTimeYear != null
            ? {
                ixTimeYear: { gte: pin.ixTimeYear - 50, lte: pin.ixTimeYear + 50 },
              }
            : {}),
        },
        select: {
          id: true,
          title: true,
          category: true,
          ixTimeYear: true,
          eraLabel: true,
          coordinates: true,
          thumbnailUrl: true,
        },
        take: 10,
        orderBy: { ixTimeYear: "asc" },
      });

      return { pin, wikiEnrichment, relatedPins };
    }),

  getStoryPinsByCountry: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.storyPin.findMany({
        where: { countryId: input.countryId, status: "approved" },
        orderBy: { ixTimeYear: "asc" },
      });
    }),

  getAllStoryPins: cachedPublicProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          minYear: z.number().int().optional(),
          maxYear: z.number().int().optional(),
          storylineId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { status: "approved" };
      if (input?.category) where.category = input.category;
      if (input?.storylineId) where.storylineId = input.storylineId;
      if (input?.minYear !== undefined || input?.maxYear !== undefined) {
        where.ixTimeYear = {};
        if (input?.minYear !== undefined)
          (where.ixTimeYear as Record<string, unknown>).gte = input.minYear;
        if (input?.maxYear !== undefined)
          (where.ixTimeYear as Record<string, unknown>).lte = input.maxYear;
      }
      const pins = await ctx.db.storyPin.findMany({
        where,
        include: { country: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        type: "FeatureCollection" as const,
        features: pins
          .filter((p) => Array.isArray(p.coordinates) && (p.coordinates as number[]).length >= 2)
          .map((p) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: p.coordinates as [number, number] },
            properties: {
              id: p.id,
              title: p.title,
              category: p.category,
              importance: p.importance,
              storylineId: p.storylineId,
              ixTimeYear: p.ixTimeYear,
              eraLabel: p.eraLabel,
              wikiPageTitle: p.wikiPageTitle,
              icon: p.icon,
              thumbnailUrl: p.thumbnailUrl,
              countryId: p.countryId,
              countryName: p.country.name,
              countrySlug: p.country.slug,
            },
          })),
      };
    }),

  // ──────────────────────────────────────────────
  // Storylines — Narrative chains connecting story pins
  // ──────────────────────────────────────────────

  createStoryline: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      return ctx.db.storyline.create({
        data: {
          title: input.title,
          description: input.description,
          countryId: input.countryId,
          color: input.color ?? "#6366f1",
        },
      });
    }),

  updateStoryline: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        storylineId: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const sl = await ctx.db.storyline.findFirst({
        where: { id: input.storylineId, countryId: input.countryId },
      });
      if (!sl) throw new TRPCError({ code: "NOT_FOUND", message: "Storyline not found" });
      return ctx.db.storyline.update({
        where: { id: input.storylineId },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.color && { color: input.color }),
        },
      });
    }),

  deleteStoryline: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), storylineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const sl = await ctx.db.storyline.findFirst({
        where: { id: input.storylineId, countryId: input.countryId },
      });
      if (!sl) throw new TRPCError({ code: "NOT_FOUND", message: "Storyline not found" });
      // Unlink pins before deleting
      await ctx.db.storyPin.updateMany({
        where: { storylineId: input.storylineId },
        data: { storylineId: null, storylineOrder: null },
      });
      await ctx.db.storyline.delete({ where: { id: input.storylineId } });
      return { id: input.storylineId, deleted: true };
    }),

  getStorylinesByCountry: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.storyline.findMany({
        where: { countryId: input.countryId },
        include: { _count: { select: { pins: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  getStorylineWithPins: cachedPublicProcedure
    .input(z.object({ storylineId: z.string() }))
    .query(async ({ ctx, input }) => {
      const storyline = await ctx.db.storyline.findUnique({
        where: { id: input.storylineId },
        include: {
          pins: {
            where: { status: "approved" },
            orderBy: [{ storylineOrder: "asc" }, { ixTimeYear: "asc" }],
            select: {
              id: true,
              title: true,
              category: true,
              ixTimeYear: true,
              eraLabel: true,
              coordinates: true,
              importance: true,
              thumbnailUrl: true,
            },
          },
          country: { select: { name: true, slug: true } },
        },
      });
      if (!storyline) throw new TRPCError({ code: "NOT_FOUND", message: "Storyline not found" });
      return storyline;
    }),

  // ──────────────────────────────────────────────
  // Map Labels — Custom styled text on the map
  // ──────────────────────────────────────────────

  createMapLabel: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        text: z.string().min(1).max(100),
        labelType: z.enum([
          "mountain_range",
          "strait",
          "bay",
          "peninsula",
          "plateau",
          "valley",
          "desert",
          "sea",
          "region",
          "historical",
        ]),
        coordinates: coordinatesSchema,
        fontSize: z.number().min(8).max(48).default(14),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#374151"),
        rotation: z.number().min(-180).max(180).default(0),
        letterSpacing: z.number().min(0).max(1).default(0),
        fontWeight: z.enum(["normal", "bold"]).default("normal"),
        opacity: z.number().min(0.1).max(1).default(1),
        minZoom: z.number().min(0).max(18).default(4),
        maxZoom: z.number().min(0).max(22).default(18),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      await validatePointContainment(
        ctx.db,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "Map label"
      );

      const label = await ctx.db.mapLabel.create({
        data: {
          text: input.text,
          countryId: input.countryId,
          labelType: input.labelType,
          coordinates: input.coordinates,
          fontSize: input.fontSize,
          color: input.color,
          rotation: input.rotation,
          letterSpacing: input.letterSpacing,
          fontWeight: input.fontWeight,
          opacity: input.opacity,
          minZoom: input.minZoom,
          maxZoom: input.maxZoom,
          wikiPageTitle: input.wikiPageTitle,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });
      await invalidateCache(["geo.getAllMapFeatures", "geo.getAllMapLabels"]);
      broadcastMapUpdate("mapLabel", input.countryId);
      return { id: label.id, text: label.text, status: "approved" as const };
    }),

  updateMapLabel: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        labelId: z.string(),
        text: z.string().min(1).max(100).optional(),
        labelType: z
          .enum([
            "mountain_range",
            "strait",
            "bay",
            "peninsula",
            "plateau",
            "valley",
            "desert",
            "sea",
            "region",
            "historical",
          ])
          .optional(),
        coordinates: coordinatesSchema.optional(),
        fontSize: z.number().min(8).max(48).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        rotation: z.number().min(-180).max(180).optional(),
        letterSpacing: z.number().min(0).max(1).optional(),
        fontWeight: z.enum(["normal", "bold"]).optional(),
        opacity: z.number().min(0.1).max(1).optional(),
        minZoom: z.number().min(0).max(18).optional(),
        maxZoom: z.number().min(0).max(22).optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const label = await ctx.db.mapLabel.findFirst({
        where: { id: input.labelId, countryId: input.countryId },
      });
      if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Map label not found" });

      if (input.coordinates) {
        await validatePointContainment(
          ctx.db,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "Map label"
        );
      }

      const { countryId: _, labelId: __, ...updateData } = input;
      const updated = await ctx.db.mapLabel.update({
        where: { id: input.labelId },
        data: Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== undefined)),
      });
      await invalidateCache(["geo.getAllMapFeatures", "geo.getAllMapLabels"]);
      broadcastMapUpdate("mapLabel", input.countryId);
      return { id: updated.id, text: updated.text };
    }),

  deleteMapLabel: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), labelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const label = await ctx.db.mapLabel.findFirst({
        where: { id: input.labelId, countryId: input.countryId },
      });
      if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Map label not found" });
      await ctx.db.mapLabel.delete({ where: { id: input.labelId } });
      await invalidateCache(["geo.getAllMapFeatures", "geo.getAllMapLabels"]);
      broadcastMapUpdate("mapLabel", input.countryId);
      return { id: input.labelId, deleted: true };
    }),

  getMapLabelsByCountry: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.mapLabel.findMany({
        where: { countryId: input.countryId, status: "approved" },
        orderBy: { text: "asc" },
      });
    }),

  getAllMapLabels: cachedPublicProcedure.query(async ({ ctx }) => {
    const labels = await ctx.db.mapLabel.findMany({
      where: { status: "approved" },
      include: { country: { select: { name: true, slug: true } } },
    });
    return {
      type: "FeatureCollection" as const,
      features: labels
        .filter((l) => Array.isArray(l.coordinates) && (l.coordinates as number[]).length >= 2)
        .map((l) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: l.coordinates as [number, number] },
          properties: {
            id: l.id,
            text: l.text,
            labelType: l.labelType,
            fontSize: l.fontSize,
            color: l.color,
            rotation: l.rotation,
            letterSpacing: l.letterSpacing,
            fontWeight: l.fontWeight,
            opacity: l.opacity,
            minZoom: l.minZoom,
            maxZoom: l.maxZoom,
            wikiPageTitle: l.wikiPageTitle,
            countryId: l.countryId,
            countryName: l.country.name,
          },
        })),
    };
  }),

  /**
   * Get edit history for the user's country.
   */
  getMyEditHistory: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only view your own edit history",
        });
      }

      const edits = await ctx.db.mapEditRequest.findMany({
        where: { countryId: input.countryId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return edits.map(
        (e: {
          id: string;
          editType: string;
          operation: string;
          status: string;
          createdAt: Date;
          reviewedAt: Date | null;
          reviewNote: string | null;
          proposedData: unknown;
        }) => ({
          id: e.id,
          editType: e.editType,
          operation: e.operation,
          status: e.status,
          createdAt: e.createdAt,
          reviewedAt: e.reviewedAt,
          reviewNote: e.reviewNote,
          summary: (e.proposedData as Record<string, unknown>)?.name ?? "Unknown",
        })
      );
    }),

  // ──────────────────────────────────────────────
  // Sovereignty / dependency management
  // ──────────────────────────────────────────────

  /** Get all active sovereignty relationships (public, cached) */
  getSovereigntyRelations: cachedPublicProcedure.query(async ({ ctx }) => {
    const relations = await ctx.db.countrySovereignty.findMany({
      where: { isActive: true },
      include: {
        sovereign: { select: { id: true, name: true, flag: true, slug: true } },
        subject: { select: { id: true, name: true, flag: true, slug: true } },
      },
      orderBy: [{ sovereign: { name: "asc" } }, { subject: { name: "asc" } }],
    });
    return relations.map((r) => ({
      id: r.id,
      sovereignId: r.sovereignId,
      sovereignName: r.sovereign.name,
      sovereignFlag: normalizeFlagUrl(r.sovereign.flag),
      sovereignSlug: r.sovereign.slug,
      subjectId: r.subjectId,
      subjectName: r.subject.name,
      subjectFlag: normalizeFlagUrl(r.subject.flag),
      subjectSlug: r.subject.slug,
      relationshipType: r.relationshipType,
      autonomyLevel: r.autonomyLevel,
      description: r.description,
      establishedDate: r.establishedDate,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
  }),

  /** Get sovereignty info for a specific country (subjects + sovereign) */
  getCountrySovereignty: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [sovereign, subjects] = await Promise.all([
        ctx.db.countrySovereignty.findFirst({
          where: { subjectId: input.countryId, isActive: true },
          include: {
            sovereign: { select: { id: true, name: true, flag: true, slug: true } },
          },
        }),
        ctx.db.countrySovereignty.findMany({
          where: { sovereignId: input.countryId, isActive: true },
          include: {
            subject: { select: { id: true, name: true, flag: true, slug: true } },
          },
          orderBy: { subject: { name: "asc" } },
        }),
      ]);

      return {
        sovereign: sovereign
          ? {
              id: sovereign.id,
              countryId: sovereign.sovereignId,
              name: sovereign.sovereign.name,
              flag: normalizeFlagUrl(sovereign.sovereign.flag),
              slug: sovereign.sovereign.slug,
              relationshipType: sovereign.relationshipType,
              autonomyLevel: sovereign.autonomyLevel,
              description: sovereign.description,
              establishedDate: sovereign.establishedDate,
            }
          : null,
        subjects: subjects.map((s) => ({
          id: s.id,
          countryId: s.subjectId,
          name: s.subject.name,
          flag: normalizeFlagUrl(s.subject.flag),
          slug: s.subject.slug,
          relationshipType: s.relationshipType,
          autonomyLevel: s.autonomyLevel,
        })),
      };
    }),

  /** Create a sovereignty relationship (admin only) */
  createSovereignty: adminProcedure
    .input(
      z.object({
        sovereignId: z.string(),
        subjectId: z.string(),
        relationshipType: z.string(),
        autonomyLevel: z.number().min(0).max(1).optional().default(0.5),
        description: z.string().optional(),
        establishedDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.sovereignId === input.subjectId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A country cannot be its own sovereign.",
        });
      }

      // Validate relationship type
      const validTypes = SOVEREIGNTY_TYPES.map((t) => t.value);
      if (!validTypes.includes(input.relationshipType as any)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid relationship type. Must be one of: ${validTypes.join(", ")}`,
        });
      }

      // Check for circular chains: walk from sovereign upward
      const allRels = await ctx.db.countrySovereignty.findMany({
        where: { isActive: true },
        select: { sovereignId: true, subjectId: true },
      });
      const parentMap = new Map(allRels.map((r) => [r.subjectId, r.sovereignId]));

      // If we add this relation, the subject's sovereign chain must not reach back to subject
      let current = input.sovereignId;
      const visited = new Set<string>();
      while (current) {
        if (current === input.subjectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This would create a circular sovereignty chain.",
          });
        }
        if (visited.has(current)) break;
        visited.add(current);
        current = parentMap.get(current) ?? "";
      }

      const relation = await ctx.db.countrySovereignty.create({
        data: {
          sovereignId: input.sovereignId,
          subjectId: input.subjectId,
          relationshipType: input.relationshipType,
          autonomyLevel: input.autonomyLevel,
          description: input.description,
          establishedDate: input.establishedDate,
        },
      });

      // Invalidate political layer cache so map reflects the change
      layerCache.delete("political");
      // Invalidate server-side tRPC cache so queries return fresh data
      await invalidateCache([
        "geo.getSovereigntyRelations",
        "geo.getCountrySovereignty",
        "geo.getWorldMap",
      ]);
      broadcastMapUpdate("sovereignty");

      return relation;
    }),

  /** Update a sovereignty relationship (admin only) */
  updateSovereignty: adminProcedure
    .input(
      z.object({
        id: z.string(),
        relationshipType: z.string().optional(),
        autonomyLevel: z.number().min(0).max(1).optional(),
        description: z.string().optional(),
        establishedDate: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      if (data.relationshipType) {
        const validTypes = SOVEREIGNTY_TYPES.map((t) => t.value);
        if (!validTypes.includes(data.relationshipType as any)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid relationship type.`,
          });
        }
      }

      const updated = await ctx.db.countrySovereignty.update({
        where: { id },
        data,
      });

      layerCache.delete("political");
      await invalidateCache([
        "geo.getSovereigntyRelations",
        "geo.getCountrySovereignty",
        "geo.getWorldMap",
      ]);
      broadcastMapUpdate("sovereignty");
      return updated;
    }),

  /** Delete a sovereignty relationship (admin only) */
  deleteSovereignty: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.countrySovereignty.delete({ where: { id: input.id } });
      layerCache.delete("political");
      await invalidateCache([
        "geo.getSovereigntyRelations",
        "geo.getCountrySovereignty",
        "geo.getWorldMap",
      ]);
      broadcastMapUpdate("sovereignty");
      return { success: true };
    }),

  // ──────────────────────────────────────────────
  // Linkage validation & repair
  // ──────────────────────────────────────────────

  /** Validate country ↔ map feature linkage. Returns inconsistencies. */
  validateLinkage: adminProcedure.query(async ({ ctx }) => {
    // Get all political map layers with country links
    const mapLayers = await ctx.db.mapLayer.findMany({
      where: { layerType: "political", isActive: true },
      select: {
        id: true,
        featureId: true,
        displayName: true,
        countryId: true,
        areaSqKm: true,
        centroid: true,
        boundingBox: true,
      },
    });

    // Get all countries with their users
    const countries = await ctx.db.country.findMany({
      where: { isDemo: false },
      select: {
        id: true,
        name: true,
        slug: true,
        flag: true,
        landArea: true,
        geometry: true,
        centroid: true,
        boundingBox: true,
        users: { select: { clerkUserId: true, forumUsername: true } },
      },
    });

    const mapLayerByCountryId = new Map(
      mapLayers.filter((l) => l.countryId).map((l) => [l.countryId!, l])
    );
    const countryById = new Map(countries.map((c) => [c.id, c]));

    const issues: Array<{
      type:
        | "no_map_link"
        | "orphan_geometry"
        | "missing_geometry_sync"
        | "missing_area_sync"
        | "stale_map_link";
      countryId: string;
      countryName: string;
      featureId?: string;
      featureName?: string;
      detail: string;
    }> = [];

    // Countries with no MapLayer link
    for (const country of countries) {
      const mapLayer = mapLayerByCountryId.get(country.id);

      if (!mapLayer) {
        // Country has no linked map feature
        if (country.geometry || (country.landArea && country.landArea > 0)) {
          issues.push({
            type: "orphan_geometry",
            countryId: country.id,
            countryName: country.name,
            detail: `Country has geometry/landArea but no MapLayer link`,
          });
        } else {
          issues.push({
            type: "no_map_link",
            countryId: country.id,
            countryName: country.name,
            detail: `Country has no linked map feature`,
          });
        }
      } else {
        // Country IS linked — check data sync
        if (!country.geometry) {
          issues.push({
            type: "missing_geometry_sync",
            countryId: country.id,
            countryName: country.name,
            featureId: mapLayer.featureId,
            featureName: mapLayer.displayName ?? mapLayer.featureId,
            detail: `MapLayer linked but Country.geometry is null`,
          });
        }
        if (!country.landArea && mapLayer.areaSqKm) {
          issues.push({
            type: "missing_area_sync",
            countryId: country.id,
            countryName: country.name,
            featureId: mapLayer.featureId,
            featureName: mapLayer.displayName ?? mapLayer.featureId,
            detail: `MapLayer has areaSqKm=${mapLayer.areaSqKm?.toFixed(0)} but Country.landArea is null`,
          });
        }
      }
    }

    // MapLayers pointing to non-existent countries
    for (const layer of mapLayers) {
      if (layer.countryId && !countryById.has(layer.countryId)) {
        issues.push({
          type: "stale_map_link",
          countryId: layer.countryId,
          countryName: "(deleted)",
          featureId: layer.featureId,
          featureName: layer.displayName ?? layer.featureId,
          detail: `MapLayer links to non-existent country ${layer.countryId}`,
        });
      }
    }

    // Build linkage summary
    const linked = countries.filter((c) => mapLayerByCountryId.has(c.id));
    const unlinked = countries.filter((c) => !mapLayerByCountryId.has(c.id));

    return {
      totalCountries: countries.length,
      linkedCount: linked.length,
      unlinkedCount: unlinked.length,
      issueCount: issues.length,
      issues,
      linked: linked.map((c) => {
        const ml = mapLayerByCountryId.get(c.id)!;
        return {
          countryId: c.id,
          countryName: c.name,
          countryFlag: normalizeFlagUrl(c.flag),
          featureId: ml.featureId,
          featureName: ml.displayName ?? ml.featureId,
          areaSqKm: ml.areaSqKm,
          hasOwner: c.users.length > 0,
          ownerName: c.users[0]?.forumUsername ?? c.users[0]?.clerkUserId ?? null,
        };
      }),
      unlinked: unlinked.map((c) => ({
        countryId: c.id,
        countryName: c.name,
        countryFlag: normalizeFlagUrl(c.flag),
        hasGeometry: !!c.geometry,
        hasLandArea: !!(c.landArea && c.landArea > 0),
        hasOwner: c.users.length > 0,
        ownerName: c.users[0]?.forumUsername ?? c.users[0]?.clerkUserId ?? null,
      })),
    };
  }),

  /** Repair linkage: sync geometry/area from MapLayer to Country, or auto-match by name. */
  repairLinkage: adminProcedure
    .input(
      z.object({
        action: z.enum(["sync_all", "auto_match", "link_by_name"]),
        /** For link_by_name: map featureId to countryId */
        featureId: z.string().optional(),
        countryId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let repaired = 0;

      if (input.action === "sync_all") {
        // Re-sync geometry + area from MapLayer → Country for all linked countries
        const linkedLayers = await ctx.db.mapLayer.findMany({
          where: { layerType: "political", countryId: { not: null }, isActive: true },
          select: {
            countryId: true,
            geometry: true,
            centroid: true,
            boundingBox: true,
            areaSqKm: true,
          },
        });

        for (const ml of linkedLayers) {
          if (!ml.countryId) continue;
          await ctx.db.country.update({
            where: { id: ml.countryId },
            data: {
              geometry: ml.geometry as object,
              centroid: ml.centroid as object | undefined,
              boundingBox: ml.boundingBox as object | undefined,
              landArea: ml.areaSqKm ?? undefined,
              areaSqMi: ml.areaSqKm ? ml.areaSqKm * 0.386102 : undefined,
            },
          });
          repaired++;
        }
      }

      if (input.action === "auto_match") {
        // Try to match unlinked countries to unlinked features by name
        const unlinkedLayers = await ctx.db.mapLayer.findMany({
          where: { layerType: "political", countryId: null, isActive: true },
          select: {
            id: true,
            featureId: true,
            displayName: true,
            geometry: true,
            centroid: true,
            boundingBox: true,
            areaSqKm: true,
          },
        });
        const unlinkedCountries = await ctx.db.country.findMany({
          where: {
            isDemo: false,
            id: {
              notIn: (
                await ctx.db.mapLayer.findMany({
                  where: { layerType: "political", countryId: { not: null } },
                  select: { countryId: true },
                })
              )
                .map((m) => m.countryId!)
                .filter(Boolean),
            },
          },
          select: { id: true, name: true },
        });

        const countryNameMap = new Map(unlinkedCountries.map((c) => [c.name.toLowerCase(), c]));

        for (const layer of unlinkedLayers) {
          const name = (layer.displayName || featureIdToDisplayName(layer.featureId)).toLowerCase();
          const match = countryNameMap.get(name);
          if (match) {
            await ctx.db.mapLayer.update({
              where: { id: layer.id },
              data: { countryId: match.id },
            });
            await ctx.db.country.update({
              where: { id: match.id },
              data: {
                geometry: layer.geometry as object,
                centroid: layer.centroid as object | undefined,
                boundingBox: layer.boundingBox as object | undefined,
                landArea: layer.areaSqKm ?? undefined,
                areaSqMi: layer.areaSqKm ? layer.areaSqKm * 0.386102 : undefined,
              },
            });
            repaired++;
            countryNameMap.delete(name);
          }
        }
      }

      if (input.action === "link_by_name" && input.featureId && input.countryId) {
        const ml = await ctx.db.mapLayer.findFirst({
          where: { layerType: "political", featureId: input.featureId, isActive: true },
        });
        if (!ml) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

        await ctx.db.mapLayer.update({
          where: { id: ml.id },
          data: { countryId: input.countryId },
        });
        await ctx.db.country.update({
          where: { id: input.countryId },
          data: {
            geometry: ml.geometry as object,
            centroid: ml.centroid as object | undefined,
            boundingBox: ml.boundingBox as object | undefined,
            landArea: ml.areaSqKm ?? undefined,
            areaSqMi: ml.areaSqKm ? ml.areaSqKm * 0.386102 : undefined,
          },
        });
        repaired = 1;
      }

      layerCache.delete("political");
      await invalidateCache([
        "geo.listCountries",
        "geo.getWorldMap",
        "geo.validateLinkage",
        "geo.getCountryGeometry",
      ]);

      return { repaired };
    }),

  /** Get all approved cities, POIs, and subdivisions as GeoJSON for the world map overlays. */
  getAllMapFeatures: cachedPublicProcedure.query(async ({ ctx }) => {
    const [cities, pois, subdivisions] = await Promise.all([
      ctx.db.city.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          name: true,
          coordinates: true,
          population: true,
          type: true,
          isNationalCapital: true,
          wikiPageTitle: true,
          countryId: true,
          country: { select: { name: true, slug: true } },
        },
      }),
      ctx.db.pointOfInterest.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          name: true,
          coordinates: true,
          category: true,
          icon: true,
          description: true,
          wikiPageTitle: true,
          countryId: true,
          country: { select: { name: true, slug: true } },
        },
      }),
      ctx.db.subdivision.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          name: true,
          type: true,
          level: true,
          areaSqKm: true,
          geometry: true,
          countryId: true,
          country: { select: { name: true, slug: true } },
        },
      }),
    ]);

    return {
      cities: {
        type: "FeatureCollection" as const,
        features: cities
          .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
          .map((c) => {
            const coords = c.coordinates as [number, number];
            return {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: coords },
              properties: {
                id: c.id,
                name: c.name,
                cityType: c.type,
                isCapital: c.isNationalCapital,
                population: c.population,
                countryId: c.countryId,
                countryName: c.country.name,
                countrySlug: c.country.slug,
                wikiPageTitle: c.wikiPageTitle,
              },
            };
          }),
      },
      pois: {
        type: "FeatureCollection" as const,
        features: pois
          .filter((p) => Array.isArray(p.coordinates) && (p.coordinates as number[]).length >= 2)
          .map((p) => {
            const coords = p.coordinates as [number, number];
            return {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: coords },
              properties: {
                id: p.id,
                name: p.name,
                category: p.category,
                icon: p.icon,
                description: p.description,
                wikiPageTitle: p.wikiPageTitle,
                countryId: p.countryId,
                countryName: p.country.name,
                countrySlug: p.country.slug,
              },
            };
          }),
      },
      subdivisions: {
        type: "FeatureCollection" as const,
        features: subdivisions
          .filter((s) => s.geometry)
          .map((s) => ({
            type: "Feature" as const,
            geometry: s.geometry as unknown as import("geojson").Geometry,
            properties: {
              id: s.id,
              name: s.name,
              subdivisionType: s.type,
              level: s.level,
              areaSqKm: s.areaSqKm,
              countryId: s.countryId,
              countryName: s.country.name,
              countrySlug: s.country.slug,
            },
          })),
      },
    };
  }),

  /** Get all national capital cities as GeoJSON FeatureCollection for map display. */
  getCapitalCities: cachedPublicProcedure.query(async ({ ctx }) => {
    const capitals = await ctx.db.city.findMany({
      where: { isNationalCapital: true, status: "approved" },
      select: {
        id: true,
        name: true,
        coordinates: true,
        population: true,
        wikiPageTitle: true,
        countryId: true,
        country: { select: { name: true, slug: true } },
      },
    });

    return {
      type: "FeatureCollection" as const,
      features: capitals
        .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
        .map((c) => {
          const coords = c.coordinates as [number, number];
          return {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: coords },
            properties: {
              id: c.id,
              name: c.name,
              countryId: c.countryId,
              countryName: c.country.name,
              countrySlug: c.country.slug,
              population: c.population,
              wikiPageTitle: c.wikiPageTitle,
            },
          };
        }),
    };
  }),

  /** Fetch wiki article intro for a map feature (city/POI) by its linked wiki page title. */
  getFeatureWikiIntro: cachedPublicProcedure
    .input(z.object({ wikiPageTitle: z.string() }))
    .query(async ({ input }) => {
      const name = input.wikiPageTitle.trim();
      if (!name) return null;

      const { getArticleIntro } = await import("~/lib/wiki-bridge");

      // Try ixwiki first (direct MySQL, ~8ms), then iiwiki (HTTP, ~400ms)
      for (const wiki of ["ixwiki", "iiwiki"] as const) {
        const result = await getArticleIntro(name, wiki);
        if (result?.text) {
          const base = wiki === "ixwiki" ? "https://ixwiki.com" : "https://iiwiki.com";
          return {
            extract: result.text.substring(0, 400),
            wikiSource: wiki,
            wikiUrl: `${base}/wiki/${encodeURIComponent(result.title)}`,
          };
        }
      }
      return null;
    }),

  /**
   * Parse a wiki page's infobox template and return structured fields.
   * Used by the map editor WikiLinkWizard for auto-filling city/POI data.
   */
  parseWikiInfobox: cachedPublicProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const title = input.pageTitle.trim();
      const { getArticleWikitext } = await import("~/lib/wiki-bridge");

      for (const wiki of ["ixwiki", "iiwiki"] as const) {
        const article = await getArticleWikitext(title, wiki);
        if (!article) continue;

        const base = wiki === "ixwiki" ? "https://ixwiki.com" : "https://iiwiki.com";
        const parsed = parseInfobox(article.wikitext);

        if (!parsed) {
          return {
            found: true,
            hasInfobox: false,
            pageTitle: article.title,
            pageUrl: `${base}/wiki/${encodeURIComponent(article.title)}`,
            wikiSource: wiki,
            fields: [],
            coordinates: null,
          };
        }

        const splitCoords = extractCoordsFromFields(parsed.fields);
        const templateCoords = parseCoordTemplate(article.wikitext);
        const coordinates = splitCoords ?? templateCoords;

        return {
          found: true,
          hasInfobox: true,
          templateName: parsed.templateName,
          pageTitle: article.title,
          pageUrl: `${base}/wiki/${encodeURIComponent(article.title)}`,
          wikiSource: wiki,
          fields: parsed.fields.map((f) => ({
            key: f.key,
            cleanValue: f.cleanValue,
            typedValue: f.typedValue ?? null,
            fieldType: f.fieldType,
          })),
          coordinates,
        };
      }

      return {
        found: false,
        hasInfobox: false,
        pageTitle: title,
        pageUrl: null,
        wikiSource: null,
        fields: [],
        coordinates: null,
      };
    }),

  /**
   * Search wiki pages by prefix (opensearch). Used by WikiLinkWizard for
   * type-ahead suggestions when linking a map feature to a wiki article.
   */
  searchWikiPages: cachedPublicProcedure
    .input(
      z.object({ query: z.string().min(1).max(100), limit: z.number().min(1).max(20).default(10) })
    )
    .query(async ({ input }) => {
      const { searchPages } = await import("~/lib/wiki-bridge");

      // Try ixwiki first (MySQL, ~30ms), then iiwiki (HTTP, ~400ms)
      for (const wiki of ["ixwiki", "iiwiki"] as const) {
        const results = await searchPages(input.query, input.limit, wiki);
        if (results.length > 0) {
          const base = wiki === "ixwiki" ? "https://ixwiki.com" : "https://iiwiki.com";
          return {
            wikiSource: wiki,
            results: results.map((r) => ({
              title: r.title,
              description: "",
              url: `${base}/wiki/${encodeURIComponent(r.title)}`,
            })),
          };
        }
      }

      return { wikiSource: null, results: [] };
    }),

  /**
   * Scan a wiki article for place names that match known map features.
   * Returns matched/unmatched place names for the auto-linker.
   */
  scanWikiForPlaces: cachedPublicProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const title = input.pageTitle.trim();

      // Fetch article intro via WikiBridge (direct MySQL for ixwiki)
      const { getArticleIntro } = await import("~/lib/wiki-bridge");
      let plaintext = "";

      for (const wiki of ["ixwiki", "iiwiki"] as const) {
        const result = await getArticleIntro(title, wiki);
        if (result?.text) {
          plaintext = result.text;
          break;
        }
      }

      if (!plaintext) return { matches: [], unmatched: [] };

      // Get all known place names from the database
      const [countries, cities, pois, subdivisions] = await Promise.all([
        ctx.db.country.findMany({
          select: { id: true, name: true },
          where: { geometry: { not: null } },
        }),
        ctx.db.city.findMany({
          select: { id: true, name: true, countryId: true },
          where: { status: "approved" },
        }),
        ctx.db.pointOfInterest.findMany({
          select: { id: true, name: true, countryId: true },
          where: { status: "approved" },
        }),
        ctx.db.subdivision.findMany({
          select: { id: true, name: true, countryId: true },
          where: { status: "approved" },
        }),
      ]);

      // Build a name → feature lookup (case-insensitive, min 3 chars to avoid noise)
      const knownPlaces = new Map<string, { id: string; type: string; name: string }>();
      for (const c of countries)
        if (c.name.length >= 3)
          knownPlaces.set(c.name.toLowerCase(), { id: c.id, type: "country", name: c.name });
      for (const c of cities)
        if (c.name.length >= 3)
          knownPlaces.set(c.name.toLowerCase(), { id: c.id, type: "city", name: c.name });
      for (const p of pois)
        if (p.name.length >= 3)
          knownPlaces.set(p.name.toLowerCase(), { id: p.id, type: "poi", name: p.name });
      for (const s of subdivisions)
        if (s.name.length >= 3)
          knownPlaces.set(s.name.toLowerCase(), { id: s.id, type: "subdivision", name: s.name });

      // Scan plaintext for known place names
      const matches: Array<{ name: string; type: string; id: string; linked: boolean }> = [];
      const seen = new Set<string>();

      // Check each known place name against the article text
      for (const [lowerName, place] of knownPlaces) {
        if (seen.has(lowerName)) continue;
        // Word-boundary match (avoid matching "an" inside "Canpei")
        const regex = new RegExp(`\\b${lowerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (regex.test(plaintext)) {
          seen.add(lowerName);

          // Check if this feature already has a wikiPageTitle linking to it
          let linked = false;
          if (place.type === "city") {
            const city = await ctx.db.city.findUnique({
              where: { id: place.id },
              select: { wikiPageTitle: true },
            });
            linked = !!city?.wikiPageTitle;
          } else if (place.type === "poi") {
            const poi = await ctx.db.pointOfInterest.findUnique({
              where: { id: place.id },
              select: { wikiPageTitle: true },
            });
            linked = !!poi?.wikiPageTitle;
          } else if (place.type === "country") {
            linked = true; // Countries are always "linked" by nature
          }

          matches.push({ name: place.name, type: place.type, id: place.id, linked });
        }
      }

      return {
        matches: matches.sort((a, b) => a.name.localeCompare(b.name)),
        scannedChars: plaintext.length,
      };
    }),

  /**
   * Run conflict detection for a country's map features.
   * Returns issues like duplicate names, coordinate mismatches, missing wiki links.
   */
  getCountryConflicts: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, name: true, landArea: true },
      });
      if (!country) return { conflicts: [], countryName: "Unknown" };

      const [cities, pois, subdivisions] = await Promise.all([
        ctx.db.city.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: {
            id: true,
            name: true,
            coordinates: true,
            population: true,
            wikiPageTitle: true,
          },
        }),
        ctx.db.pointOfInterest.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: { id: true, name: true, coordinates: true, wikiPageTitle: true },
        }),
        ctx.db.subdivision.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: { id: true, name: true, areaSqKm: true },
        }),
      ]);

      const features: FeatureData[] = [
        ...cities.map((c) => ({
          id: c.id,
          name: c.name,
          type: "city" as const,
          coordinates: (Array.isArray(c.coordinates) ? c.coordinates : null) as
            | [number, number]
            | null,
          wikiPageTitle: c.wikiPageTitle,
          population: c.population,
        })),
        ...pois.map((p) => ({
          id: p.id,
          name: p.name,
          type: "poi" as const,
          coordinates: (Array.isArray(p.coordinates) ? p.coordinates : null) as
            | [number, number]
            | null,
          wikiPageTitle: p.wikiPageTitle,
        })),
        ...subdivisions.map((s) => ({
          id: s.id,
          name: s.name,
          type: "subdivision" as const,
          areaSqKm: s.areaSqKm,
        })),
      ];

      const conflicts = detectConflicts({
        countryId: input.countryId,
        countryName: country.name,
        totalAreaKm2: country.landArea ?? undefined,
        features,
      });

      return { conflicts, countryName: country.name };
    }),

  /** Get linkage status for a single country (used by map editor, detail sheets) */
  getCountryLinkage: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", countryId: input.countryId, isActive: true },
        select: {
          featureId: true,
          displayName: true,
          areaSqKm: true,
          centroid: true,
          boundingBox: true,
        },
      });

      return {
        isLinked: !!mapLayer,
        featureId: mapLayer?.featureId ?? null,
        featureName: mapLayer?.displayName ?? null,
        areaSqKm: mapLayer?.areaSqKm ?? null,
      };
    }),

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
          svgMetadata: metadata as unknown as Record<string, unknown>,
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
            geojsonData: result.featureCollection as unknown as Record<string, unknown>,
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
          const autoMatches = matchFeaturesToCountries(newFeatures, countries);
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
              props.zoneId = zone.id;
              props.zoneName = zone.name;
              props.elevationMin = zone.minElevation;
              props.elevationMax = zone.maxElevation;
              props.elevationLabel = zone.label;
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
              geometry: r.geometry as unknown as Record<string, unknown>,
              properties: (r.properties ?? {}) as Record<string, unknown>,
              countryId: r.countryId,
              displayName: r.displayName,
              centroid: r.centroid as unknown as Record<string, unknown>,
              boundingBox: r.bbox as unknown as Record<string, unknown>,
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
                geometry: r.geometry as unknown as Record<string, unknown>,
                centroid: r.centroid as unknown as Record<string, unknown>,
                boundingBox: r.bbox as unknown as Record<string, unknown>,
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
      layerCache.delete(upload.layerType);
      await invalidateCache([
        "geo.getWorldMap",
        "geo.getLayerGeoJSON",
        "geo.getMapStats",
        "geo.getAllMapFeatures",
        "geo.listCountries",
      ]);
      broadcastMapUpdate("bulk", upload.countryId ?? undefined);

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
              geometry: feature.geometry as unknown as Record<string, unknown>,
              properties: (feature.properties ?? {}) as Record<string, unknown>,
              centroid: centroid as unknown as Record<string, unknown>,
              boundingBox: bbox as unknown as Record<string, unknown>,
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

      layerCache.delete(targetUpload.layerType);
      await invalidateCache([
        "geo.getWorldMap",
        "geo.getLayerGeoJSON",
        "geo.getMapStats",
        "geo.getAllMapFeatures",
        "geo.listCountries",
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
          flagCode: true,
          region: true,
          subregion: true,
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
          flagCode: c.flagCode,
          region: c.region,
          subregion: c.subregion,
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
          createdBy: ctx.auth!.userId,
          metadata: {
            featureCounts,
            totalFeatures: allLayers.length,
            totalCountries: countries.length,
            layerTypes: Object.keys(layerMap),
            exportedAt: new Date().toISOString(),
          },
          layers: layerMap as unknown as Record<string, unknown>,
          countries: countries.map((c) => ({
            name: c.name,
            slug: c.slug,
            flagCode: c.flagCode,
            region: c.region,
            subregion: c.subregion,
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
            geometry: f.geometry as Record<string, unknown>,
            properties: props,
            displayName: (props.displayName as string) || null,
            areaSqKm: (props.areaSqKm as number) || null,
            centroid: (props.centroid as Record<string, unknown>) || null,
            boundingBox: (props.boundingBox as unknown[]) || null,
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
        where,
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

  /** Generate a procedural world from seed and parameters */
  generateProceduralWorld: adminProcedure
    .input(
      z.object({
        seed: z.number().int(),
        continentCount: z.number().int().min(1).max(8).default(4),
        countryCountRange: z
          .tuple([z.number().int().min(1), z.number().int().max(200)])
          .default([20, 60]),
        oceanPercentage: z.number().min(0.2).max(0.95).default(0.65),
        terrainRoughness: z.number().min(0).max(1).default(0.5),
        hasIcecaps: z.boolean().default(true),
        hasRivers: z.boolean().default(true),
        hasLakes: z.boolean().default(true),
        gridResolution: z.number().int().min(128).max(512).default(512),
        similarity: z.number().min(0).max(1).default(0.5),
        profileName: z.string().default("IxWorld"),
        erosionIntensity: z.number().min(0).max(1).default(0.8),
        climateDetail: z.enum(["simple", "full"]).default("full"),
        useTectonicElevation: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Dynamic import to avoid loading heavy generation code on every request
      const { generateWorld } = await import("~/lib/worldgen/engine");

      const result = generateWorld(input);

      // Save to database
      const world = await ctx.db.proceduralWorld.create({
        data: {
          seed: input.seed,
          parameters: input as unknown as Record<string, unknown>,
          status: "completed",
          generatedData: result.layers as unknown as Record<string, unknown>,
          metadata: result.stats as unknown as Record<string, unknown>,
          createdBy: ctx.auth!.userId,
        },
      });

      return {
        worldId: world.id,
        seed: result.seed,
        stats: result.stats,
      };
    }),

  /** Get preview data for a generated world */
  getProceduralWorldPreview: adminProcedure
    .input(z.object({ worldId: z.string() }))
    .query(async ({ ctx, input }) => {
      const world = await ctx.db.proceduralWorld.findUnique({
        where: { id: input.worldId },
      });
      if (!world) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        seed: world.seed,
        parameters: world.parameters,
        layers: world.generatedData,
        stats: world.metadata,
        status: world.status,
      };
    }),

  /** Commit a procedural world to the map layers table */
  commitProceduralWorld: adminProcedure
    .input(
      z.object({
        worldId: z.string(),
        saveAsTemplate: z.boolean().default(false),
        templateName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const world = await ctx.db.proceduralWorld.findUnique({
        where: { id: input.worldId },
      });
      if (!world) throw new TRPCError({ code: "NOT_FOUND" });

      const layers = world.generatedData as Record<
        string,
        {
          features?: Array<{
            id?: string;
            geometry: unknown;
            properties?: Record<string, unknown>;
          }>;
        }
      >;
      if (!layers) throw new TRPCError({ code: "BAD_REQUEST", message: "No generated data" });

      // Deactivate all existing features
      await ctx.db.mapLayer.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      let totalImported = 0;
      const log: string[] = [];

      for (const [layerType, fc] of Object.entries(layers)) {
        if (!fc.features || !Array.isArray(fc.features)) continue;

        const records = fc.features.map((f) => {
          const props = (f.properties || {}) as Record<string, unknown>;
          return {
            layerType,
            featureId:
              (props.featureId as string) ||
              (f.id as string) ||
              `proc-${Math.random().toString(36).slice(2, 10)}`,
            geometry: f.geometry as Record<string, unknown>,
            properties: props,
            displayName: (props.displayName as string) || null,
            areaSqKm: (props.areaKm2 as number) || null,
            isActive: true,
            worldId: `proc-${world.seed}`,
          };
        });

        const created = await ctx.db.mapLayer.createMany({
          data: records,
          skipDuplicates: true,
        });
        log.push(`${layerType}: ${created.count} features`);
        totalImported += created.count;
      }

      // Optionally save as template
      let templateId: string | null = null;
      if (input.saveAsTemplate) {
        const template = await ctx.db.worldTemplate.create({
          data: {
            name: input.templateName || `Procedural World (seed: ${world.seed})`,
            description: `Auto-generated world with seed ${world.seed}`,
            createdBy: ctx.auth!.userId,
            metadata: world.metadata,
            layers: world.generatedData as Record<string, unknown>,
            isPublic: false,
          },
        });
        templateId = template.id;

        await ctx.db.proceduralWorld.update({
          where: { id: world.id },
          data: { templateId },
        });
      }

      return { totalImported, log, templateId };
    }),

  /** Regenerate a single layer of a procedural world */
  regenerateLayer: adminProcedure
    .input(
      z.object({
        worldId: z.string(),
        layerType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const world = await ctx.db.proceduralWorld.findUnique({
        where: { id: input.worldId },
      });
      if (!world) throw new TRPCError({ code: "NOT_FOUND" });

      const params = world.parameters as Record<string, unknown>;
      const { generateWorld } = await import("~/lib/worldgen/engine");

      // Regenerate with a shifted seed for the target layer
      const newSeed = (params.seed as number) + input.layerType.length * 1000;
      const newParams = { ...params, seed: newSeed } as Parameters<typeof generateWorld>[0];
      const result = generateWorld(newParams);

      // Replace only the target layer
      const existingLayers = (world.generatedData || {}) as Record<string, unknown>;
      const layerKey = input.layerType;
      if (layerKey in result.layers) {
        existingLayers[layerKey] = result.layers[layerKey as keyof typeof result.layers];
      }

      await ctx.db.proceduralWorld.update({
        where: { id: world.id },
        data: {
          generatedData: existingLayers,
          metadata: {
            ...(world.metadata as Record<string, unknown>),
            lastRegenerated: input.layerType,
          },
        },
      });

      return {
        layerType: input.layerType,
        featureCount: result.layers[layerKey as keyof typeof result.layers]?.features.length ?? 0,
      };
    }),

  /** List procedural world generation history */
  listProceduralWorlds: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.proceduralWorld.findMany({
      where: { createdBy: ctx.auth!.userId },
      select: {
        id: true,
        seed: true,
        parameters: true,
        status: true,
        metadata: true,
        templateId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

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
      const { runMapPipeline, validatePipelineResult } = await import("~/lib/map-pipeline");

      const result = await runMapPipeline({
        source: input.source,
        svgContent: input.svgContent,
        worldGenParams: input.worldGenParams as
          | import("~/lib/worldgen/types").WorldGenParams
          | undefined,
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
        worldId: z.string().default("default"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const layers = input.layers as Record<string, import("geojson").FeatureCollection>;
      let imported = 0;

      await ctx.db.$transaction(async (tx) => {
        if (input.mode === "replace") {
          // Deactivate existing layers for this world
          await tx.mapLayer.updateMany({
            where: { worldId: input.worldId, isActive: true },
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
                layerType_featureId: { layerType, featureId },
              },
              update: {
                geometry: feature.geometry as unknown as Record<string, unknown>,
                properties: (feature.properties ?? {}) as Record<string, unknown>,
                isActive: true,
                worldId: input.worldId,
              },
              create: {
                layerType,
                featureId,
                geometry: feature.geometry as unknown as Record<string, unknown>,
                properties: (feature.properties ?? {}) as Record<string, unknown>,
                isActive: true,
                worldId: input.worldId,
              },
            });
            imported++;
          }
        }
      });

      // Build shared vertex index for political features
      if (layers.political) {
        try {
          const { buildSharedVertexIndex } = await import("~/lib/shared-vertex-builder");
          const politicalFeatures = layers.political.features
            .filter((f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon")
            .map((f) => ({
              featureId: (f.properties?.featureId as string) ?? (f.id as string) ?? "",
              geometry: f.geometry as import("geojson").Polygon | import("geojson").MultiPolygon,
            }));

          const sharedVertices = buildSharedVertexIndex(politicalFeatures);

          // Clear existing shared vertices for this world
          await ctx.db.sharedVertex.deleteMany({
            where: { worldId: input.worldId },
          });

          // Insert new shared vertices
          if (sharedVertices.length > 0) {
            await ctx.db.sharedVertex.createMany({
              data: sharedVertices.map((sv) => ({
                lng: sv.lng,
                lat: sv.lat,
                featureRefs: sv.featureRefs as unknown as Record<string, unknown>,
                worldId: input.worldId,
              })),
            });
          }
        } catch {
          // Shared vertex build failed — non-blocking
        }
      }

      // Invalidate layer cache
      invalidateCache("geo.getWorldMap");

      return { imported, mode: input.mode };
    }),

  /**
   * Get shared vertices for a specific feature (used by border editor).
   */
  getSharedVertices: rateLimitedPublicProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const vertices = await ctx.db.sharedVertex.findMany({
        where: { worldId: "default" },
      });

      // Filter to those referencing this feature
      return vertices
        .filter((v) => {
          const refs = v.featureRefs as Array<{ featureId: string }>;
          return Array.isArray(refs) && refs.some((r) => r.featureId === input.featureId);
        })
        .map((v) => ({
          id: v.id,
          lng: v.lng,
          lat: v.lat,
          featureRefs: v.featureRefs as Array<{
            featureId: string;
            ringIndex: number;
            vertexIndex: number;
          }>,
          snapTarget: v.snapTarget,
        }));
    }),

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
      const country = ctx.country;
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
      const country = ctx.country;
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
   * Delete all subdivisions for a country. Admin forge operation.
   */
  deleteAllSubdivisions: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete regions for your own country",
        });
      }
      const result = await ctx.db.subdivision.deleteMany({
        where: { countryId: input.countryId },
      });
      return { deleted: result.count };
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
      const country = ctx.country;
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
          await checkNameUniqueness(ctx.db, input.countryId, province.name, "subdivision");
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
              geometry: province.geometry,
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
      const country = ctx.country;
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

  /**
   * Get a comprehensive geographic profile for a country.
   *
   * Analyzes the country's geometry against climate and altitude map layers
   * to produce climate distribution, elevation profile, derived stats
   * (arable land, landlocked/island), economic modifiers, and NPC trait modifiers.
   *
   * Uses PostGIS ST_Intersection for spatial analysis when available,
   * falls back to property-based estimation from MapLayer data.
   */
  getCountryGeoProfile: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 1. Get country geometry and basic info
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          id: true,
          name: true,
          geometry: true,
          centroid: true,
          boundingBox: true,
          coastlineKm: true,
          landArea: true,
          areaSqMi: true,
        },
      });

      if (!country) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      const countryGeo = country.geometry as import("geojson").Geometry | null;
      const centroid = country.centroid as [number, number] | null;
      const bbox = country.boundingBox as [number, number, number, number] | null;

      if (!countryGeo || !centroid) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Country has no map geometry. Link it to a map feature first.",
        });
      }

      // 2. Get intersecting map layers for climate and altitude analysis
      const [climateLayers, altitudeLayers, riverLayers, lakeLayers] = await Promise.all([
        ctx.db.mapLayer.findMany({
          where: { layerType: "climate", isActive: true },
          select: {
            featureId: true,
            geometry: true,
            properties: true,
            areaSqKm: true,
            displayName: true,
          },
        }),
        ctx.db.mapLayer.findMany({
          where: { layerType: "altitudes", isActive: true },
          select: {
            featureId: true,
            geometry: true,
            properties: true,
            areaSqKm: true,
            displayName: true,
          },
        }),
        ctx.db.mapLayer.findMany({
          where: { layerType: "rivers", isActive: true },
          select: {
            featureId: true,
            properties: true,
            areaSqKm: true,
          },
        }),
        ctx.db.mapLayer.findMany({
          where: { layerType: "lakes", isActive: true },
          select: {
            featureId: true,
            areaSqKm: true,
          },
        }),
      ]);

      // 3. Compute area (use stored value or estimate from geometry)
      const areaKm2 = country.landArea ?? (country.areaSqMi ? country.areaSqMi / 0.386102 : 0);

      // 4. Build climate distribution
      // Strategy: match climate features by checking if they overlap the country's bbox
      // (client-side approximation; PostGIS ST_Intersection would be more precise)
      const climateDistribution: ClimateZoneEntry[] = [];
      const countryMinLng = bbox?.[0] ?? -180;
      const countryMinLat = bbox?.[1] ?? -90;
      const countryMaxLng = bbox?.[2] ?? 180;
      const countryMaxLat = bbox?.[3] ?? 90;

      for (const cl of climateLayers) {
        const props = cl.properties as Record<string, unknown> | null;
        if (!props) continue;

        // Check rough bbox overlap
        const clGeo = cl.geometry as import("geojson").Geometry | null;
        if (!clGeo) continue;

        // Resolve climate type from fill color (SVG paths have no text names)
        const fill = (props["fill"] as string) ?? "";
        const climateName = resolveClimateFromColor(fill);
        if (!climateName) continue;

        // Simple bbox overlap test using the climate feature's centroid or first coord
        const clArea = cl.areaSqKm ?? 0;
        if (clArea <= 0) continue;

        // For now, use a proportional estimation based on the feature's total area
        // and the country's relative size. This will be replaced with PostGIS
        // ST_Intersection once the endpoint is validated.
        // We estimate overlap fraction from bbox coverage
        const overlapFraction = estimateBboxOverlap(
          clGeo,
          countryMinLng,
          countryMinLat,
          countryMaxLng,
          countryMaxLat
        );
        if (overlapFraction <= 0) continue;

        const overlapArea = clArea * overlapFraction;
        const agFactor = getAgricultureFactor(climateName);

        // Aggregate same climate types (multiple SVG polygons per zone)
        const existing = climateDistribution.find((e) => e.type === climateName);
        if (existing) {
          existing.areaSqKm += overlapArea;
        } else {
          climateDistribution.push({
            type: climateName,
            percentArea: 0, // computed below
            areaSqKm: overlapArea,
            agricultureFactor: agFactor,
          });
        }
      }

      // Normalize climate percentages
      const totalClimateArea = climateDistribution.reduce((s, z) => s + z.areaSqKm, 0);
      for (const z of climateDistribution) {
        z.percentArea =
          totalClimateArea > 0 ? Math.round((z.areaSqKm / totalClimateArea) * 100 * 10) / 10 : 0;
      }
      // Sort by area descending
      climateDistribution.sort((a, b) => b.areaSqKm - a.areaSqKm);

      // 5. Build elevation profile
      const elevationProfile: ElevationZoneEntry[] = [];
      for (const al of altitudeLayers) {
        const props = al.properties as Record<string, unknown> | null;
        if (!props) continue;

        const alGeo = al.geometry as import("geojson").Geometry | null;
        if (!alGeo) continue;

        const alArea = al.areaSqKm ?? 0;
        if (alArea <= 0) continue;

        const overlapFraction = estimateBboxOverlap(
          alGeo,
          countryMinLng,
          countryMinLat,
          countryMaxLng,
          countryMaxLat
        );
        if (overlapFraction <= 0) continue;

        const overlapArea = alArea * overlapFraction;

        // Match to elevation zone by color or name
        const fill = (props["fill"] as string) ?? "";
        const zoneMatch = ELEVATION_ZONES.find(
          (ez) => ez.color.toLowerCase() === fill.toLowerCase()
        );

        if (zoneMatch) {
          // Aggregate into existing zone or create new entry
          const existing = elevationProfile.find((e) => e.zone === zoneMatch.zoneId);
          if (existing) {
            existing.areaSqKm += overlapArea;
          } else {
            elevationProfile.push({
              zone: zoneMatch.zoneId,
              name: zoneMatch.zoneName,
              percentArea: 0, // computed below
              areaSqKm: overlapArea,
              minElev: zoneMatch.elevationMin,
              maxElev: zoneMatch.elevationMax,
            });
          }
        }
      }

      // Normalize elevation percentages
      const totalElevArea = elevationProfile.reduce((s, z) => s + z.areaSqKm, 0);
      for (const z of elevationProfile) {
        z.percentArea =
          totalElevArea > 0 ? Math.round((z.areaSqKm / totalElevArea) * 100 * 10) / 10 : 0;
      }
      elevationProfile.sort((a, b) => a.minElev - b.minElev);

      // 6. Estimate hydrography (rough: count features in bbox)
      const riverCount = riverLayers.length;
      const totalRiverLengthKm = riverLayers.reduce((s, r) => {
        const p = r.properties as Record<string, unknown> | null;
        return s + ((p?.["lengthKm"] as number) ?? r.areaSqKm ?? 0);
      }, 0);
      const lakeCount = lakeLayers.length;
      const totalLakeAreaSqKm = lakeLayers.reduce((s, l) => s + (l.areaSqKm ?? 0), 0);

      // 7. Find neighbors + coastline via PostGIS spatial queries
      // Uses ST_Intersects on JSONB geometry cast to PostGIS geometry for pixel-perfect
      // neighbor detection and accurate coastline/shared-border computation.
      interface PostGISNeighborRow {
        id: string;
        name: string;
        slug: string | null;
        shared_border_km: number;
      }

      let neighborCountries: Array<{
        id: string;
        name: string;
        slug: string | null;
        sharedBorderKm: number;
      }> = [];
      let perimeterKm = 0;
      let coastlineKm = 0;

      try {
        // Query 1: Find all neighboring countries and their shared border lengths
        const neighborRows = await ctx.db.$queryRawUnsafe<PostGISNeighborRow[]>(
          `
          WITH country AS (
            SELECT id, name,
              ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)) as geom
            FROM "Country"
            WHERE id = $1
            LIMIT 1
          )
          SELECT DISTINCT ON (c2.id)
            c2.id, c2.name, c2.slug,
            ST_Length(
              ST_Intersection(
                ST_Boundary(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326))),
                ST_Boundary(c.geom)
              )::geography
            ) / 1000 as shared_border_km
          FROM country c
          JOIN map_layers ml ON ml."layerType" = 'political'
            AND ml."isActive" = true
            AND ml."countryId" IS NOT NULL
            AND ml."countryId" != c.id
          JOIN "Country" c2 ON c2.id = ml."countryId"
          WHERE ST_Intersects(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326)),
            c.geom
          )
          ORDER BY c2.id, shared_border_km DESC
        `,
          input.countryId
        );

        neighborCountries = neighborRows
          .filter((r) => Number(r.shared_border_km) > 0)
          .map((r) => ({
            id: r.id,
            name: r.name,
            slug: r.slug,
            sharedBorderKm: Math.round(Number(r.shared_border_km)),
          }))
          .sort((a, b) => b.sharedBorderKm - a.sharedBorderKm);

        // Query 2: Get country perimeter for coastline calculation
        const perimResult = await ctx.db.$queryRawUnsafe<Array<{ perimeter_km: number }>>(
          `
          SELECT ST_Perimeter(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326))::geography
          ) / 1000 as perimeter_km
          FROM "Country"
          WHERE id = $1
        `,
          input.countryId
        );

        perimeterKm = Math.round(Number(perimResult[0]?.perimeter_km ?? 0));
        const totalSharedBorderKm = neighborCountries.reduce((s, n) => s + n.sharedBorderKm, 0);
        coastlineKm = Math.max(0, perimeterKm - totalSharedBorderKm);
      } catch {
        // PostGIS unavailable or geometry invalid — fall back to bbox estimation
        const latMid = (countryMinLat + countryMaxLat) / 2;
        const degToKm = 111.32;
        const cosLat = Math.cos((latMid * Math.PI) / 180);
        perimeterKm = Math.round(
          2 *
            ((countryMaxLat - countryMinLat) * degToKm +
              (countryMaxLng - countryMinLng) * degToKm * cosLat) *
            1.3
        );
        coastlineKm = country.coastlineKm ?? perimeterKm;
      }

      const neighborCount = neighborCountries.length;
      const profile = buildGeoProfile({
        climateDistribution,
        elevationProfile,
        coastlineKm,
        neighborCount,
        totalRiverLengthKm,
        totalLakeAreaSqKm: totalLakeAreaSqKm,
        areaKm2,
      });

      // 9. Compute gameplay modifiers
      const economicModifiers = computeEconomicGeoModifiers(profile);
      const npcModifiers = computeNPCGeoModifiers(profile);
      const crisisRisk = computeCrisisRiskFactors(profile);

      // 10. Temperature and precipitation estimates
      const centroidLat = centroid[1] ?? 0;
      const temp = estimateTemperature(centroidLat, profile.meanElevation, climateDistribution);
      const precipMm = estimatePrecipitation(climateDistribution, profile.meanElevation);

      // 11. Area metrics (perimeterKm already computed by PostGIS above)
      const nsSpanKm = bbox ? Math.abs(bbox[3] - bbox[1]) * 111.32 : 0;
      const ewSpanKm = bbox
        ? Math.abs(bbox[2] - bbox[0]) * 111.32 * Math.cos((centroidLat * Math.PI) / 180)
        : 0;

      return {
        countryId: country.id,
        countryName: country.name,
        area: {
          areaKm2: Math.round(areaKm2),
          perimeterKm: Math.round(perimeterKm),
          nsSpanKm: Math.round(nsSpanKm),
          ewSpanKm: Math.round(ewSpanKm),
          centroid,
        },
        climate: {
          zones: climateDistribution,
          dominant: profile.dominantClimate,
          diversityIndex: profile.climateDiversity,
          estMeanTempC: temp.meanTempC,
          estAnnualPrecipMm: precipMm,
          estSummerHighC: temp.summerHighC,
          estWinterLowC: temp.winterLowC,
        },
        elevation: {
          zones: elevationProfile,
          dominant: profile.dominantElevation,
          meanElev: profile.meanElevation,
          terrainRoughness: profile.terrainRoughness,
        },
        hydro: {
          riverCount,
          totalRiverLengthKm: Math.round(totalRiverLengthKm),
          lakeCount,
          totalLakeAreaSqKm: Math.round(totalLakeAreaSqKm),
          drainageDensity: profile.drainageDensity,
        },
        derived: {
          arableLandPercent: profile.arableLandPercent,
          isLandlocked: profile.isLandlocked,
          isIsland: profile.isIsland,
          coastlineKm: profile.coastlineKm,
          neighborCount: profile.neighborCount,
        },
        neighbors: neighborCountries.map((n) => ({
          id: n.id,
          name: n.name,
          slug: n.slug,
          sharedBorderKm: n.sharedBorderKm,
        })),
        economic: economicModifiers,
        npcModifiers,
        crisisRisk,
      };
    }),

  /**
   * Admin endpoint: Recalculate and persist geographic profiles for all countries
   * (or a single country). Stores results in CountryGeoProfile table for use
   * by the economic engine and NPC personality drift.
   */
  recalculateGeoProfiles: adminProcedure
    .input(z.object({ countryId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      // Get countries to process
      const countries = await ctx.db.country.findMany({
        where: input?.countryId ? { id: input.countryId } : { geometry: { not: null } },
        select: { id: true, name: true },
      });

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const country of countries) {
        try {
          // Call the profile computation endpoint internally (reuse logic)
          // We directly compute here to avoid circular calls
          const profileResult = await ctx.db.country.findUnique({
            where: { id: country.id },
            select: {
              coastlineKm: true,
              landArea: true,
              areaSqMi: true,
              geometry: true,
              centroid: true,
              boundingBox: true,
            },
          });

          if (!profileResult?.geometry) {
            errors.push(`${country.name}: no geometry`);
            failed++;
            continue;
          }

          const coastlineKm = profileResult.coastlineKm ?? 0;
          const areaKm2 =
            profileResult.landArea ??
            (profileResult.areaSqMi ? profileResult.areaSqMi / 0.386102 : 0);
          const bbox = profileResult.boundingBox as [number, number, number, number] | null;

          // Get climate/altitude layers for this country's bbox
          const [climateLayers, altitudeLayers] = await Promise.all([
            ctx.db.mapLayer.findMany({
              where: { layerType: "climate", isActive: true },
              select: {
                featureId: true,
                geometry: true,
                properties: true,
                areaSqKm: true,
                displayName: true,
              },
            }),
            ctx.db.mapLayer.findMany({
              where: { layerType: "altitudes", isActive: true },
              select: { featureId: true, geometry: true, properties: true, areaSqKm: true },
            }),
          ]);

          const countryMinLng = bbox?.[0] ?? -180;
          const countryMinLat = bbox?.[1] ?? -90;
          const countryMaxLng = bbox?.[2] ?? 180;
          const countryMaxLat = bbox?.[3] ?? 90;

          // Build climate distribution
          const climateDistribution: ClimateZoneEntry[] = [];
          for (const cl of climateLayers) {
            const props = cl.properties as Record<string, unknown> | null;
            if (!props) continue;
            const clGeo = cl.geometry as import("geojson").Geometry | null;
            if (!clGeo || !cl.areaSqKm || cl.areaSqKm <= 0) continue;

            const clFill = (props["fill"] as string) ?? "";
            const climateName = resolveClimateFromColor(clFill);
            if (!climateName) continue;

            const overlapFraction = estimateBboxOverlap(
              clGeo,
              countryMinLng,
              countryMinLat,
              countryMaxLng,
              countryMaxLat
            );
            if (overlapFraction <= 0) continue;

            climateDistribution.push({
              type: climateName,
              percentArea: 0,
              areaSqKm: cl.areaSqKm * overlapFraction,
              agricultureFactor: getAgricultureFactor(climateName),
            });
          }
          const totalClimateArea = climateDistribution.reduce((s, z) => s + z.areaSqKm, 0);
          for (const z of climateDistribution) {
            z.percentArea =
              totalClimateArea > 0
                ? Math.round((z.areaSqKm / totalClimateArea) * 100 * 10) / 10
                : 0;
          }

          // Build elevation profile
          const elevationProfile: ElevationZoneEntry[] = [];
          for (const al of altitudeLayers) {
            const props = al.properties as Record<string, unknown> | null;
            if (!props) continue;
            const alGeo = al.geometry as import("geojson").Geometry | null;
            if (!alGeo || !al.areaSqKm || al.areaSqKm <= 0) continue;

            const overlapFraction = estimateBboxOverlap(
              alGeo,
              countryMinLng,
              countryMinLat,
              countryMaxLng,
              countryMaxLat
            );
            if (overlapFraction <= 0) continue;

            const fill = (props["fill"] as string) ?? "";
            const zoneMatch = ELEVATION_ZONES.find(
              (ez) => ez.color.toLowerCase() === fill.toLowerCase()
            );
            if (!zoneMatch) continue;

            const existing = elevationProfile.find((e) => e.zone === zoneMatch.zoneId);
            if (existing) {
              existing.areaSqKm += al.areaSqKm * overlapFraction;
            } else {
              elevationProfile.push({
                zone: zoneMatch.zoneId,
                name: zoneMatch.zoneName,
                percentArea: 0,
                areaSqKm: al.areaSqKm * overlapFraction,
                minElev: zoneMatch.elevationMin,
                maxElev: zoneMatch.elevationMax,
              });
            }
          }
          const totalElevArea = elevationProfile.reduce((s, z) => s + z.areaSqKm, 0);
          for (const z of elevationProfile) {
            z.percentArea =
              totalElevArea > 0 ? Math.round((z.areaSqKm / totalElevArea) * 100 * 10) / 10 : 0;
          }

          const profile = buildGeoProfile({
            climateDistribution,
            elevationProfile,
            coastlineKm,
            neighborCount: 0,
            totalRiverLengthKm: 0,
            totalLakeAreaSqKm: 0,
            areaKm2,
          });
          const econ = computeEconomicGeoModifiers(profile);

          // Upsert the profile
          await ctx.db.countryGeoProfile.upsert({
            where: { countryId: country.id },
            create: {
              countryId: country.id,
              climateDistribution:
                climateDistribution as unknown as import("@prisma/client").Prisma.JsonValue,
              elevationProfile:
                elevationProfile as unknown as import("@prisma/client").Prisma.JsonValue,
              arableLandPercent: profile.arableLandPercent,
              coastlineKm,
              isLandlocked: profile.isLandlocked,
              isIsland: profile.isIsland,
              riverKm: 0,
              lakeAreaSqKm: 0,
              neighborCount: profile.neighborCount,
              dominantClimate: profile.dominantClimate,
              dominantElevation: profile.dominantElevation,
              meanElevation: profile.meanElevation,
              terrainRoughness: profile.terrainRoughness,
              gdpModifier: econ.gdpModifier,
              tradeModifier: econ.tradeModifier,
              infraCostModifier: econ.infraCostModifier,
              lastCalculatedAt: new Date(),
            },
            update: {
              climateDistribution:
                climateDistribution as unknown as import("@prisma/client").Prisma.JsonValue,
              elevationProfile:
                elevationProfile as unknown as import("@prisma/client").Prisma.JsonValue,
              arableLandPercent: profile.arableLandPercent,
              coastlineKm,
              isLandlocked: profile.isLandlocked,
              isIsland: profile.isIsland,
              dominantClimate: profile.dominantClimate,
              dominantElevation: profile.dominantElevation,
              meanElevation: profile.meanElevation,
              terrainRoughness: profile.terrainRoughness,
              gdpModifier: econ.gdpModifier,
              tradeModifier: econ.tradeModifier,
              infraCostModifier: econ.infraCostModifier,
              lastCalculatedAt: new Date(),
            },
          });

          processed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${country.name}: ${msg}`);
          failed++;
        }
      }

      return { processed, failed, total: countries.length, errors: errors.slice(0, 20) };
    }),

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────

  /**
   * 4.5 — Choropleth: Return per-country metric values with geometries
   * for data-driven fill coloring on the map.
   */
  getRegionalChoropleth: cachedPublicProcedure
    .input(
      z.object({
        metric: z.enum(["gdpPerCapita", "population", "vitality", "health", "tradeBalance"]),
        groupBy: z.enum(["country", "region", "continent"]).default("country"),
      })
    )
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: { geometry: { not: null } },
        select: {
          id: true,
          name: true,
          slug: true,
          geometry: true,
          centroid: true,
          continent: true,
          region: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          economicVitality: true,
          overallNationalHealth: true,
          tradeBalance: true,
          landArea: true,
        },
      });

      const getMetricValue = (c: (typeof countries)[number]): number => {
        switch (input.metric) {
          case "gdpPerCapita":
            return c.currentGdpPerCapita ?? 0;
          case "population": {
            // Population density (per km²) is more useful than raw population
            const area = c.landArea ?? 1;
            return area > 0 ? (c.currentPopulation ?? 0) / area : 0;
          }
          case "vitality":
            return c.economicVitality ?? 0;
          case "health":
            return c.overallNationalHealth ?? 0;
          case "tradeBalance":
            return c.tradeBalance ?? 0;
          default:
            return 0;
        }
      };

      if (input.groupBy === "country") {
        // Compute percentile rank (0–1) for each country so colors distribute evenly.
        // Raw values go in rawValue for tooltips. `value` is the normalized rank.
        const rawValues = countries.map((c) => ({ c, raw: getMetricValue(c) }));
        const sorted = [...rawValues].sort((a, b) => a.raw - b.raw);
        const rankMap = new Map<string, number>();
        for (let i = 0; i < sorted.length; i++) {
          rankMap.set(sorted[i]!.c.id, sorted.length > 1 ? i / (sorted.length - 1) : 0.5);
        }

        return {
          type: "FeatureCollection" as const,
          features: countries.map((c) => ({
            type: "Feature" as const,
            geometry: c.geometry as unknown as import("geojson").Geometry,
            properties: {
              id: c.id,
              name: c.name,
              slug: c.slug,
              value: rankMap.get(c.id) ?? 0, // 0–1 percentile rank
              rawValue: getMetricValue(c),
              metric: input.metric,
              continent: c.continent,
              region: c.region,
            },
          })),
          metadata: {
            metric: input.metric,
            groupBy: input.groupBy,
            minVal: 0,
            maxVal: 1,
            count: countries.length,
          },
        };
      }

      // Region/continent aggregation
      const groups = new Map<string, { values: number[]; countryIds: string[]; names: string[] }>();
      for (const c of countries) {
        const key =
          input.groupBy === "region" ? (c.region ?? "Unknown") : (c.continent ?? "Unknown");
        if (!groups.has(key)) groups.set(key, { values: [], countryIds: [], names: [] });
        const g = groups.get(key)!;
        g.values.push(getMetricValue(c));
        g.countryIds.push(c.id);
        g.names.push(c.name);
      }

      // Aggregate per group, then rank groups by percentile
      const groupAgg = new Map<string, number>();
      for (const [key, g] of groups) {
        const avg = g.values.reduce((s, v) => s + v, 0) / g.values.length;
        groupAgg.set(
          key,
          input.metric === "population" ? g.values.reduce((s, v) => s + v, 0) : avg
        );
      }

      // Rank groups by percentile (0–1)
      const sortedGroups = Array.from(groupAgg.entries()).sort((a, b) => a[1] - b[1]);
      const groupRank = new Map<string, number>();
      for (let i = 0; i < sortedGroups.length; i++) {
        groupRank.set(
          sortedGroups[i]![0],
          sortedGroups.length > 1 ? i / (sortedGroups.length - 1) : 0.5
        );
      }

      return {
        type: "FeatureCollection" as const,
        features: countries.map((c) => {
          const key =
            input.groupBy === "region" ? (c.region ?? "Unknown") : (c.continent ?? "Unknown");
          return {
            type: "Feature" as const,
            geometry: c.geometry as unknown as import("geojson").Geometry,
            properties: {
              id: c.id,
              name: c.name,
              slug: c.slug,
              value: groupRank.get(key) ?? 0,
              rawValue: groupAgg.get(key) ?? 0,
              metric: input.metric,
              groupName: key,
              groupBy: input.groupBy,
            },
          };
        }),
        metadata: {
          metric: input.metric,
          groupBy: input.groupBy,
          minVal: 0,
          maxVal: 1,
          count: groups.size,
        },
      };
    }),

  /**
   * 4.3 — Crisis Risk Map: Return per-country risk scores as a GeoJSON
   * FeatureCollection for heatmap coloring, plus active crisis events.
   */
  getCrisisRiskMap: cachedPublicProcedure
    .input(
      z
        .object({
          riskType: z
            .enum(["hurricane", "earthquake", "drought", "flood", "wildfire", "pandemic", "famine"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Get pre-computed geo profiles with crisis risk data
      const profiles = await ctx.db.countryGeoProfile.findMany({
        select: {
          countryId: true,
          country: {
            select: { name: true, slug: true, geometry: true },
          },
        },
      });

      // Also get active crisis events for point markers
      const activeCrises = await ctx.db.crisisEvent.findMany({
        where: { status: { not: "resolved" } },
        select: {
          id: true,
          title: true,
          type: true,
          severity: true,
          location: true,
          affectedCountries: true,
        },
        take: 50,
      });

      // For each country, compute risk from their geo profile
      const riskFeatures = [];
      for (const p of profiles) {
        if (!p.country.geometry) continue;

        // Re-compute risk factors from the stored profile data
        const geoProfile = await ctx.db.countryGeoProfile.findUnique({
          where: { countryId: p.countryId },
          select: {
            climateDistribution: true,
            elevationProfile: true,
            arableLandPercent: true,
            coastlineKm: true,
            isLandlocked: true,
            neighborCount: true,
            terrainRoughness: true,
            meanElevation: true,
          },
        });

        if (!geoProfile) continue;

        const risk = computeCrisisRiskFactors({
          coastlineKm: geoProfile.coastlineKm ?? 0,
          isLandlocked: geoProfile.isLandlocked ?? false,
          isIsland: false,
          arableLandPercent: geoProfile.arableLandPercent ?? 50,
          climateDiversity: 0.5,
          terrainRoughness: geoProfile.terrainRoughness ?? 0,
          meanElevation: geoProfile.meanElevation ?? 200,
          neighborCount: geoProfile.neighborCount ?? 0,
          dominantClimate: "",
          dominantElevation: "",
          drainageDensity: 0,
        });

        const riskType = input?.riskType;
        const riskScore = riskType ? (risk[riskType] ?? 0) : Math.max(...Object.values(risk));

        riskFeatures.push({
          type: "Feature" as const,
          geometry: p.country.geometry as unknown as import("geojson").Geometry,
          properties: {
            id: p.countryId,
            name: p.country.name,
            slug: p.country.slug,
            riskScore,
            riskType: riskType ?? "max",
            ...risk,
          },
        });
      }

      // Crisis event points (using affected country centroids as fallback locations)
      const crisisPoints = [];
      for (const ce of activeCrises) {
        const affected = ce.affectedCountries as string[] | null;
        if (affected && affected.length > 0) {
          const country = await ctx.db.country.findFirst({
            where: { name: { in: affected } },
            select: { centroid: true, name: true },
          });
          if (country?.centroid) {
            const coords = (country.centroid as { coordinates: [number, number] }).coordinates;
            crisisPoints.push({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: coords },
              properties: {
                id: ce.id,
                title: ce.title,
                type: ce.type,
                severity: ce.severity,
                countryName: country.name,
              },
            });
          }
        }
      }

      return {
        riskMap: { type: "FeatureCollection" as const, features: riskFeatures },
        crisisEvents: { type: "FeatureCollection" as const, features: crisisPoints },
      };
    }),

  /**
   * 4.2 — Trade Routes: Return bilateral trade data as GeoJSON LineStrings
   * connecting country centroids, styled by volume and balance.
   */
  getTradeRouteGeoJSON: cachedPublicProcedure
    .input(
      z
        .object({
          minVolume: z.number().optional(),
          limit: z.number().min(1).max(200).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const trades = await ctx.db.bilateralTrade.findMany({
        where: input?.minVolume ? { tradeVolume: { gte: input.minVolume } } : undefined,
        orderBy: { tradeVolume: "desc" },
        take: input?.limit ?? 50,
        select: {
          id: true,
          tradeVolume: true,
          exportsFrom1: true,
          exportsFrom2: true,
          tradeBalance1: true,
          commodities: true,
          country1: { select: { id: true, name: true, slug: true, centroid: true } },
          country2: { select: { id: true, name: true, slug: true, centroid: true } },
        },
      });

      const features = [];
      for (const t of trades) {
        const c1 = t.country1.centroid as { coordinates: [number, number] } | null;
        const c2 = t.country2.centroid as { coordinates: [number, number] } | null;
        if (!c1 || !c2) continue;

        const balance = t.tradeBalance1 ?? 0;
        features.push({
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: [c1.coordinates, c2.coordinates],
          },
          properties: {
            id: t.id,
            volume: t.tradeVolume ?? 0,
            balance,
            // Color hint: positive = country1 surplus (green), negative = deficit (red), near zero = balanced (blue)
            balanceColor: Math.abs(balance) < 1e6 ? "#3b82f6" : balance > 0 ? "#22c55e" : "#ef4444",
            commodities: t.commodities,
            country1Name: t.country1.name,
            country2Name: t.country2.name,
            country1Slug: t.country1.slug,
            country2Slug: t.country2.slug,
          },
        });
      }

      const volumes = features.map((f) => f.properties.volume);
      return {
        type: "FeatureCollection" as const,
        features,
        metadata: {
          count: features.length,
          maxVolume: Math.max(0, ...volumes),
          minVolume: Math.min(Infinity, ...volumes),
        },
      };
    }),

  /**
   * 4.4 — Geopolitical Overlay: Alliance groups, diplomatic relations, and conflicts
   * as GeoJSON for network-style map visualization.
   */
  getGeopoliticalOverlay: cachedPublicProcedure.query(async ({ ctx }) => {
    // 1. Alliance groups
    const alliances = await ctx.db.alliance.findMany({
      where: { visibility: "public" },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        members: {
          select: {
            countryId: true,
            role: true,
          },
        },
      },
    });

    const allianceGroups = alliances.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      color: a.color ?? "#888888",
      memberCountryIds: a.members.map((m) => m.countryId),
    }));

    // 2. Diplomatic relations as lines between country centroids
    const relations = await ctx.db.diplomaticRelation.findMany({
      where: {
        strength: { gt: 0 },
      },
      select: {
        country1Id: true,
        country2Id: true,
        relationship: true,
        strength: true,
        country1: { select: { name: true, centroid: true } },
        country2: { select: { name: true, centroid: true } },
      },
      take: 100,
      orderBy: { strength: "desc" },
    });

    const relationFeatures = [];
    for (const r of relations) {
      const c1 = r.country1.centroid as { coordinates: [number, number] } | null;
      const c2 = r.country2.centroid as { coordinates: [number, number] } | null;
      if (!c1 || !c2) continue;

      const relType = (r.relationship ?? "neutral").toLowerCase();
      const color =
        relType.includes("friend") || relType.includes("ally")
          ? "#22c55e"
          : relType.includes("hostil") || relType.includes("rival")
            ? "#ef4444"
            : "#f59e0b";

      relationFeatures.push({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: [c1.coordinates, c2.coordinates] },
        properties: {
          country1Name: r.country1.name,
          country2Name: r.country2.name,
          relationship: r.relationship,
          strength: r.strength,
          color,
        },
      });
    }

    // 3. Active military conflicts as point markers
    const conflicts = await ctx.db.militaryConflict.findMany({
      where: { status: { in: ["active", "proposed", "accepted"] } },
      select: {
        id: true,
        type: true,
        status: true,
        initiator: { select: { name: true, centroid: true } },
        defender: { select: { name: true, centroid: true } },
      },
      take: 20,
    });

    const conflictFeatures = [];
    for (const c of conflicts) {
      const c1 = c.initiator.centroid as { coordinates: [number, number] } | null;
      const c2 = c.defender.centroid as { coordinates: [number, number] } | null;
      if (!c1 || !c2) continue;

      // Place marker at midpoint
      const midLng = (c1.coordinates[0] + c2.coordinates[0]) / 2;
      const midLat = (c1.coordinates[1] + c2.coordinates[1]) / 2;

      conflictFeatures.push({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [midLng, midLat] as [number, number] },
        properties: {
          id: c.id,
          type: c.type,
          status: c.status,
          initiatorName: c.initiator.name,
          defenderName: c.defender.name,
        },
      });
    }

    return {
      allianceGroups,
      relations: { type: "FeatureCollection" as const, features: relationFeatures },
      conflicts: { type: "FeatureCollection" as const, features: conflictFeatures },
    };
  }),
});

/**
 * Estimate the fractional overlap between a GeoJSON geometry and a bounding box.
 * Returns 0–1 representing approximate area overlap.
 * This is a rough heuristic; PostGIS ST_Intersection would be precise.
 */
function estimateBboxOverlap(
  geometry: import("geojson").Geometry,
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number
): number {
  // Extract coordinates to compute feature bbox
  const coords = extractCoords(geometry);
  if (coords.length === 0) return 0;

  let fMinLng = Infinity,
    fMinLat = Infinity,
    fMaxLng = -Infinity,
    fMaxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < fMinLng) fMinLng = lng;
    if (lng > fMaxLng) fMaxLng = lng;
    if (lat < fMinLat) fMinLat = lat;
    if (lat > fMaxLat) fMaxLat = lat;
  }

  // Compute intersection of the two bboxes
  const iMinLng = Math.max(minLng, fMinLng);
  const iMinLat = Math.max(minLat, fMinLat);
  const iMaxLng = Math.min(maxLng, fMaxLng);
  const iMaxLat = Math.min(maxLat, fMaxLat);

  if (iMinLng >= iMaxLng || iMinLat >= iMaxLat) return 0;

  const iArea = (iMaxLng - iMinLng) * (iMaxLat - iMinLat);
  const fArea = (fMaxLng - fMinLng) * (fMaxLat - fMinLat);

  if (fArea <= 0) return 0;
  return Math.min(1, iArea / fArea);
}

/** Extract all coordinate pairs from a GeoJSON geometry (first 200 for performance). */
function extractCoords(geometry: import("geojson").Geometry): [number, number][] {
  const result: [number, number][] = [];
  const limit = 200;

  function walk(coords: unknown): void {
    if (result.length >= limit) return;
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      result.push([coords[0] as number, coords[1] as number]);
    } else {
      for (const c of coords) walk(c);
    }
  }

  if ("coordinates" in geometry) walk(geometry.coordinates);
  return result;
}
