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

export const geoEditorRouter = createTRPCRouter({
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
            geometry: null as any,
            centroid: null as any,
            boundingBox: null as any,
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
              geometry: feature.geometry as any,
              centroid: feature.centroid as any,
              boundingBox: feature.boundingBox as any,
              landArea: feature.areaSqKm ?? undefined,
              areaSqMi: feature.areaSqKm ? feature.areaSqKm * 0.386102 : undefined,
              economicTier: "developing",
              isDemo: false,
              wikiPageTitle,
              wikiSource: wikiPageTitle ? "ixwiki" : undefined,
            } as any,
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
            country: { select: { id: true, name: true, flag: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        ctx.db.mapEditRequest.count({ where: { status } }),
      ]);

      return {
        edits: (edits as any).map((e: any) => ({
          id: e.id,
          countryId: e.countryId,
          countryName: e.country.name,
          countryFlag: e.country?.flag ?? null,
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
        })),
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
                  changedBy: ctx.auth!.userId ?? "system",
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
              geometry: proposed.geometry as any,
              status: "approved",
              submittedBy: edit.userId ?? "system",
            },
          });
        } else if (edit.operation === "update" && edit.targetId) {
          await ctx.db.subdivision.update({
            where: { id: edit.targetId },
            data: {
              name: proposed.name as string | undefined,
              type: proposed.type as string | undefined,
              geometry: proposed.geometry as any,
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
              type: (proposed.cityType as string) ?? "city",
              coordinates: proposed.coordinates as any,
              population: proposed.population as number | undefined,
              isNationalCapital: proposed.isNationalCapital as boolean | undefined,
              status: "approved",
              submittedBy: edit.userId ?? "system",
            },
          });
        } else if (edit.operation === "update" && edit.targetId) {
          await ctx.db.city.update({
            where: { id: edit.targetId },
            data: {
              name: proposed.name as string | undefined,
              coordinates: proposed.coordinates as any,
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
              coordinates: proposed.coordinates as any,
              description: proposed.description as string | undefined,
              status: "approved",
              submittedBy: edit.userId ?? "system",
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
              coordinates: proposed.coordinates as any,
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
        where: { id: `${ctx.auth!.userId ?? "system"}_${input.featureId}` },
        create: {
          id: `${ctx.auth!.userId ?? "system"}_${input.featureId}`,
          userId: ctx.auth!.userId ?? "system",
          featureId: input.featureId,
          sessionData: { undoStack: [], mode: "select" } as any,
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
          sessionData: input.sessionData as any,
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
            geometry: input.proposedGeometry as any,
            centroid,
            boundingBox: bbox,
            areaSqKm: area,
          },
        });

        // Clear cache
        layerCache.delete("political");

        // Clean up session
        await ctx.db.mapEditorSession.deleteMany({
          where: { userId: ctx.auth!.userId ?? "system", featureId: input.featureId },
        });

        return { applied: true, editRequestId: null };
      }

      // Create edit request for review
      const editRequest = await ctx.db.mapEditRequest.create({
        data: {
          countryId: feature.countryId ?? "unknown",
          userId: ctx.auth!.userId ?? "system",
          editType: "border_adjust",
          editSubtype: input.editSubtype,
          operation: "update",
          proposedData: input.proposedGeometry as any,
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
      const country = ctx.country as any;
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

  // ──────────────────────────────────────────────
  // SVG Upload & Processing Pipeline
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────
  // World Template / Clone System (Phase 3)
  // ──────────────────────────────────────────────────────────────

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
          parameters: input as any,
          status: "completed",
          generatedData: result.layers as any,
          metadata: result.stats as any,
          createdBy: ctx.auth!.userId ?? "system",
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
            geometry: f.geometry as any,
            properties: props as any,
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
            createdBy: ctx.auth!.userId ?? "system",
            metadata: world.metadata as any,
            layers: world.generatedData as any,
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
          generatedData: existingLayers as any,
          metadata: {
            ...(world.metadata as Record<string, unknown>),
            lastRegenerated: input.layerType,
          } as any,
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
      where: { createdBy: ctx.auth!.userId ?? "system" },
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
                geometry: feature.geometry as any,
                properties: (feature.properties ?? {}) as any,
                isActive: true,
                worldId: input.worldId,
              },
              create: {
                layerType,
                featureId,
                geometry: feature.geometry as any,
                properties: (feature.properties ?? {}) as any,
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
                featureRefs: sv.featureRefs as any,
                worldId: input.worldId,
              })),
            });
          }
        } catch {
          // Shared vertex build failed — non-blocking
        }
      }

      // Invalidate layer cache
      invalidateCache(["geo.getWorldMap"]);

      return { imported, mode: input.mode };
    }),

  // ──────────────────────────────────────────────
  // Province Import Endpoints
  // ──────────────────────────────────────────────

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────
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

  function walk(coords: any): void {
    if (result.length >= limit) return;
    if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      result.push([coords[0] as number, coords[1] as number]);
    } else {
      for (const c of coords) walk(c);
    }
  }

  if ("coordinates" in geometry) walk(geometry.coordinates);
  return result;
}
