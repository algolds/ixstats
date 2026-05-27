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

export const geoFeaturesRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Border Editor
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // User map editor endpoints (country owners)
  // ──────────────────────────────────────────────

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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Validate containment + collision + name uniqueness
      await validatePointContainment(
        ctx.db as any,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "City"
      );
      await checkPointCollision(
        ctx.db as any,
        "city",
        input.countryId,
        input.coordinates[0],
        input.coordinates[1]
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "city");

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
      const country = ctx.country as any;
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
          ctx.db as any,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "City"
        );
        await checkPointCollision(
          ctx.db as any,
          "city",
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          input.cityId
        );
      }
      if (input.name) {
        await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "city", input.cityId);
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
      const country = ctx.country as any;
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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Validate containment + name uniqueness
      await validatePolygonContainment(
        ctx.db as any,
        input.countryId,
        input.geometry,
        "Subdivision"
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "subdivision");

      const subdivision = await ctx.db.subdivision.create({
        data: {
          name: input.name,
          countryId: input.countryId,
          type: input.type,
          level: input.level,
          geometry: input.geometry as any,
          capital: input.capital,
          population: input.population,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });

      // Get terrain breakdown for the subdivision (informational)
      let terrainInfo: Awaited<ReturnType<typeof getTerrainForArea>> | null = null;
      try {
        terrainInfo = await getTerrainForArea(
          ctx.db as any,
          input.geometry as unknown as import("geojson").Geometry
        );
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
      const country = ctx.country as any;
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
        await validatePolygonContainment(
          ctx.db as any,
          input.countryId,
          input.geometry,
          "Subdivision"
        );
      }
      if (input.name) {
        await checkNameUniqueness(
          ctx.db as any,
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
          ...(input.geometry && { geometry: input.geometry as any }),
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
      const country = ctx.country as any;
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
      const country = ctx.country as any;
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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Validate containment + collision + name uniqueness
      await validatePointContainment(
        ctx.db as any,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "Point of interest"
      );
      await checkPointCollision(
        ctx.db as any,
        "pointOfInterest",
        input.countryId,
        input.coordinates[0],
        input.coordinates[1]
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "poi");

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
      const country = ctx.country as any;
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
          ctx.db as any,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "Point of interest"
        );
        await checkPointCollision(
          ctx.db as any,
          "pointOfInterest",
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          input.poiId
        );
      }
      if (input.name) {
        await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "poi", input.poiId);
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
      const country = ctx.country as any;
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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      await validatePointContainment(
        ctx.db as any,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "Story pin"
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.title, "storyPin");

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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const pin = await ctx.db.storyPin.findFirst({
        where: { id: input.pinId, countryId: input.countryId },
      });
      if (!pin) throw new TRPCError({ code: "NOT_FOUND", message: "Story pin not found" });

      if (input.coordinates) {
        await validatePointContainment(
          ctx.db as any,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "Story pin"
        );
      }
      if (input.title) {
        await checkNameUniqueness(
          ctx.db as any,
          input.countryId,
          input.title,
          "storyPin",
          input.pinId
        );
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
      const country = ctx.country as any;
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
      const country = ctx.country as any;
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
      const country = ctx.country as any;
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
      const country = ctx.country as any;
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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      await validatePointContainment(
        ctx.db as any,
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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const label = await ctx.db.mapLabel.findFirst({
        where: { id: input.labelId, countryId: input.countryId },
      });
      if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Map label not found" });

      if (input.coordinates) {
        await validatePointContainment(
          ctx.db as any,
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
      const country = ctx.country as any;
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

  // ──────────────────────────────────────────────
  // Sovereignty / dependency management
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Linkage validation & repair
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // SVG Upload & Processing Pipeline
  // ──────────────────────────────────────────────

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

  /**
   * Delete all subdivisions for a country. Admin forge operation.
   */
  deleteAllSubdivisions: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
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
