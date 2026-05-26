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
      layerCache.delete(upload.layerType);
      await invalidateCache([
        "geo.getWorldMap",
        "geo.getLayerGeoJSON",
        "geo.getMapStats",
        "geo.getAllMapFeatures",
        "geo.listCountries",
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
