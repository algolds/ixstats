/**
 * measureWorld: one pure grid sampler that measures a world's layers, the same way for a world the browser worker
 * just generated and for a realm's stored map on the server. World Studio's Calibration tab sets the two side by
 * side.
 *
 * Land share, hypsometry and the climate mix are read off a 0.5° grid (the method the presets were tuned with),
 * weighted by the cosine of latitude so a pixel at 70°N counts for what it covers, not as much as one at the
 * equator. Nation sizes come from the polygons themselves (spherical area), and the coastline from their rings.
 * No DOM, no node APIs.
 */

import type { Feature, Geometry, Position } from "geojson";
import { climateZoneOf } from "~/lib/maps/climate-zones";
import { normalizeHexColor } from "~/lib/maps/import/colour";
import { resolveClimateFromColor, trewarthaCodeOf } from "~/lib/maps/geo-analytics";
import { EARTH_RADIUS_KM, haversineKm, sphericalRingAreaSqKm } from "~/lib/maps/planet";
import type { ClimateKey } from "~/lib/maps/realm-map-settings";
import {
  NO_VALUE,
  rasterizeLandMask,
  rasterizeValues,
  type LandMask,
  type LayerFeatures,
} from "./land-mask";
import { ELEVATION_ZONES, TREWARTHA_BIOMES } from "./v2/config";

export const TREWARTHA_GROUPS = ["A", "B", "C", "D", "E", "F", "H"] as const;
export type TrewarthaGroup = (typeof TREWARTHA_GROUPS)[number];

export const CLIMATE_GROUP_NAMES: Record<TrewarthaGroup, string> = {
  A: "Tropical",
  B: "Dry",
  C: "Subtropical",
  D: "Temperate",
  E: "Boreal",
  F: "Polar",
  H: "Highland",
};

/** The layers the sampler reads; the others (rivers, lakes, icecaps) do not enter any measure. */
export type MeasureLayers = {
  background?: LayerFeatures;
  political?: LayerFeatures;
  altitudes?: LayerFeatures;
  climate?: LayerFeatures;
};

export interface MeasureOptions {
  /** The planet's radius in km, which scales areas and distances (default: Earth's). */
  radiusKm?: number;
  /** The realm's own climate key, for features that carry a zone code of its system (`climateId`) or only a colour. */
  climateKey?: ClimateKey;
}

export interface WorldMeasures {
  /** Share of the globe that is land (0-1), land being the background and political polygons, weighted by area. */
  landShare: number;
  /** Share of the land (0-1, area-weighted) in each of the nine elevation zones, lowest first; land without a band counts as the lowest. */
  hypsometry: number[];
  /** Share (0-1, area-weighted) of the classified land per Trewartha group; all zero when no land is classified. */
  climate: Record<TrewarthaGroup, number>;
  nations: {
    /** Political features with a polygon */
    count: number;
    /** Median nation area in km2 on the planet's radius */
    medianKm2: number;
    /** 90th percentile nation area in km2 on the planet's radius */
    p90Km2: number;
  };
  /** Share of the land (0-1, area-weighted) with no climate group: no climate feature there, or one the sampler cannot place (a Koppen zone code the realm's climate key does not describe). `climate` is normalised without it. */
  unclassifiedShare: number;
  /** Length in km of the land polygons' rings (great-circle edges), less the borders polygons share. */
  coastlineKm: number;
}

/** 0.5° cells: 720 wide and 360 high. */
const GRID_WIDTH = 720;
const ZONE_COUNT = ELEVATION_ZONES.length;

/** Edge ends are matched to this many steps per degree (0.005°, about 500 m). */
const EDGE_STEPS_PER_DEGREE = 200;
const EDGE_STEPS_PER_TURN = 360 * EDGE_STEPS_PER_DEGREE;

type Ring = Position[];

export function measureWorld(layers: MeasureLayers, options: MeasureOptions = {}): WorldMeasures {
  const radiusKm = options.radiusKm ?? EARTH_RADIUS_KM;
  const mask = rasterizeLandMask(layers, GRID_WIDTH);
  const climateGrid = rasterizeValues(layers.climate, GRID_WIDTH, (feature) =>
    climateGroupIndex(feature.properties, options.climateKey)
  );
  return {
    ...sampleGrid(mask, climateGrid),
    nations: measureNations(layers.political, radiusKm),
    coastlineKm: measureCoastline([layers.background, layers.political], radiusKm),
  };
}

function sampleGrid(
  mask: LandMask,
  climateGrid: Uint8Array
): Pick<WorldMeasures, "landShare" | "hypsometry" | "climate" | "unclassifiedShare"> {
  const zones = new Array<number>(ZONE_COUNT).fill(0);
  const groups = new Array<number>(TREWARTHA_GROUPS.length).fill(0);
  let total = 0;
  let land = 0;
  let classified = 0;
  for (let y = 0; y < mask.height; y++) {
    const weight = Math.cos(((90 - (y + 0.5) * (180 / mask.height)) * Math.PI) / 180);
    total += weight * mask.width;
    for (let x = y * mask.width; x < (y + 1) * mask.width; x++) {
      if (mask.land[x] !== 1) continue;
      land += weight;
      zones[mask.zone?.[x] ?? 0]! += weight;
      const group = climateGrid[x]!;
      if (group === NO_VALUE) continue;
      groups[group]! += weight;
      classified += weight;
    }
  }
  const climate = Object.fromEntries(
    TREWARTHA_GROUPS.map((group, i) => [group, classified > 0 ? groups[i]! / classified : 0])
  ) as Record<TrewarthaGroup, number>;
  return {
    landShare: total > 0 ? land / total : 0,
    hypsometry: zones.map((weight) => (land > 0 ? weight / land : 0)),
    climate,
    unclassifiedShare: land > 0 ? Math.max(0, land - classified) / land : 0,
  };
}

/** Index in `TREWARTHA_GROUPS` of the climate a feature is, or null when it cannot be told. */
function climateGroupIndex(
  properties: Feature["properties"],
  key: ClimateKey | undefined
): number | null {
  const group = trewarthaCodeOfClimate(properties, key)?.charAt(0);
  const index = TREWARTHA_GROUPS.findIndex((candidate) => candidate === group);
  return index < 0 ? null : index;
}

/**
 * The Trewartha code of a climate feature. A generated world names its type (`code`, else `biomeId`); a realm that
 * classifies in its own system carries a zone code (`climateId`) its climate key describes; Ixnay stores only a
 * fill colour. The nearest-colour match comes last: it is wrong for some types of a generated world.
 */
function trewarthaCodeOfClimate(
  properties: Feature["properties"],
  key: ClimateKey | undefined
): string | null {
  if (!properties) return null;
  if (typeof properties.code === "string") {
    const code = trewarthaCodeOf(properties.code);
    if (code) return code;
  }
  if (typeof properties.biomeId === "number") {
    const biome = TREWARTHA_BIOMES[properties.biomeId];
    if (biome) return biome.code;
  }
  const zone = key ? climateZoneOf(key, properties) : null;
  if (zone) return trewarthaCodeOf(zone.code);
  if (typeof properties.climateId === "string") return trewarthaCodeOf(properties.climateId);
  const fill = typeof properties.fill === "string" ? properties.fill : null;
  const named = fill ? resolveClimateFromColor(normalizeHexColor(fill).slice(0, 7)) : null;
  return named ? (/\((\w+)\)$/.exec(named)?.[1] ?? null) : null;
}

function polygonsOf(geometry: Geometry | null | undefined): Ring[][] {
  if (geometry?.type === "Polygon") return [geometry.coordinates];
  if (geometry?.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function measureNations(
  political: LayerFeatures | undefined,
  radiusKm: number
): WorldMeasures["nations"] {
  const areas = (political?.features ?? [])
    .filter((feature) => feature.properties?.isActive !== false)
    .map((feature) => featureAreaKm2(feature.geometry, radiusKm))
    .filter((area) => area > 0)
    .sort((a, b) => a - b);
  return { count: areas.length, medianKm2: percentile(areas, 0.5), p90Km2: percentile(areas, 0.9) };
}

/** Area of a feature's polygons: each outer ring less its holes. */
function featureAreaKm2(geometry: Geometry | null | undefined, radiusKm: number): number {
  let area = 0;
  for (const [outer, ...holes] of polygonsOf(geometry)) {
    if (!outer) continue;
    let polygon = sphericalRingAreaSqKm(outer, radiusKm);
    for (const hole of holes) polygon -= sphericalRingAreaSqKm(hole, radiusKm);
    area += Math.max(0, polygon);
  }
  return area;
}

/** The value a fraction of the way up a sorted list, between neighbours. */
function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const at = (sorted.length - 1) * fraction;
  const below = Math.floor(at);
  const above = Math.min(sorted.length - 1, below + 1);
  return sorted[below]! + (sorted[above]! - sorted[below]!) * (at - below);
}

/**
 * Length of the land polygons' rings with the borders polygons share left out: within a layer an edge two rings
 * both draw lies between two polygons, not on a coast. A layer is measured on its own and an edge two layers draw
 * (a generated world draws its land in both) counts once. A ring too short to enclose anything is not land.
 */
function measureCoastline(layers: (LayerFeatures | undefined)[], radiusKm: number): number {
  const coast = new Map<string, number>();
  for (const layer of layers) {
    const drawn = new Map<string, { km: number; times: number }>();
    for (const feature of layer?.features ?? []) {
      for (const polygon of polygonsOf(feature.geometry)) {
        for (const ring of polygon) addRingEdges(drawn, ring, radiusKm);
      }
    }
    for (const [edge, { km, times }] of drawn) if (times === 1) coast.set(edge, km);
  }
  let total = 0;
  for (const km of coast.values()) total += km;
  return total;
}

function addRingEdges(
  drawn: Map<string, { km: number; times: number }>,
  ring: Ring,
  radiusKm: number
): void {
  if (ring.length < 4) return;
  for (let i = 0; i < ring.length - 1; i++) {
    const from = ring[i]!;
    const to = ring[i + 1]!;
    const edge = edgeKey(from, to);
    const seen = drawn.get(edge);
    if (seen) seen.times++;
    else drawn.set(edge, { km: haversineKm(from, to, radiusKm), times: 1 });
  }
}

/** The same key for an edge in either direction, and for a longitude of 180 and -180. */
function edgeKey(a: Position, b: Position): string {
  const [from, to] = [pointKey(a), pointKey(b)].sort();
  return `${from}|${to}`;
}

function pointKey(point: Position): string {
  const lng = (((point[0]! % 360) + 360) % 360) * EDGE_STEPS_PER_DEGREE;
  return `${Math.round(lng) % EDGE_STEPS_PER_TURN},${Math.round(point[1]! * EDGE_STEPS_PER_DEGREE)}`;
}
