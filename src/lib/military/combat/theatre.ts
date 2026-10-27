/**
 * The theatre of an attack (owner decision: map-derived with a fallback). Terrain comes from the defender's altitude
 * and climate layers in the sector the attack crosses, front width from the shared border (force-to-space), and
 * reach from the distance between the two territories. When the map has no data, the defender's declared terrain
 * profile stands in, and failing that the typical mix.
 */
import {
  CAMPAIGN_WEIGHTS,
  CLIMATE_TERRAIN_BONUS,
  DEFAULT_DISTANCE_KM,
  DEFAULT_TERRAIN,
  ELEVATION_ZONE_TERRAIN,
  MAX_TERRAIN_FACTOR,
  MAX_URBAN_WEIGHT,
  MIN_FRONT_KM,
  OVERSEAS_FRONT_KM,
  REACH_KM,
  RIVER_LINE_BONUS,
  RIVER_LINE_SHARE,
  TERRAIN_CLASSES,
  TERRAIN_FACTOR,
  URBAN_DENSITY_REFERENCE,
  type Campaign,
  type TerrainClass,
} from "./constants";
import type { Doctrine } from "~/lib/military/model/constants";

export type TheatreSource = "map" | "declared" | "default";

/** What the map measured for an attacker → defender pair (km and km² already on the realm's planet). */
export interface MapTheatreFacts {
  /** Whether the two territories touch. */
  neighbours: boolean;
  /** Shared border length. */
  borderKm: number;
  /** Shortest distance between the territories (0 for neighbours). */
  distanceKm: number;
  /** Area of the sector per elevation zone index (0 = coastal lowlands … 8 = extreme alpine). */
  elevationAreas: readonly number[];
  /** Area of the sector per climate code (Trewartha `code` or Köppen group letter). */
  climateAreas: Readonly<Record<string, number>>;
  /** River length inside the border band. */
  riverKm: number;
  /** The defender's population per km² (urban terrain). */
  populationDensity: number;
}

/** The defender's declared terrain profile (an optional field on its defense policy). */
export interface DeclaredTerrain {
  terrain: TerrainClass;
  riverLine: boolean;
}

export interface Theatre {
  source: TheatreSource;
  neighbours: boolean;
  campaign: Campaign;
  borderKm: number;
  distanceKm: number;
  /** Front width the defender has to hold. */
  frontKm: number;
  /** The defender's terrain factor (river line included). */
  terrain: number;
  /** The nearest terrain class, for display. */
  terrainClass: TerrainClass;
  riverLine: boolean;
}

const sum = (values: readonly number[]) => values.reduce((total, v) => total + v, 0);

/** The terrain class whose factor is nearest a factor (river line removed). */
export function nearestTerrainClass(factor: number): TerrainClass {
  return TERRAIN_CLASSES.reduce((best, c) =>
    Math.abs(TERRAIN_FACTOR[c] - factor) < Math.abs(TERRAIN_FACTOR[best] - factor) ? c : best
  );
}

/** A climate area's terrain bonus: its Trewartha code, else its Köppen group letter. */
function climateBonus(code: string): number {
  return CLIMATE_TERRAIN_BONUS[code] ?? CLIMATE_TERRAIN_BONUS[code.charAt(0)] ?? 0;
}

/**
 * Terrain from the sector's layers: the area-weighted elevation factor, plus climate cover, blended toward urban by
 * population density, plus a river line. Null when the sector has no elevation data.
 */
export function mapTerrain(facts: MapTheatreFacts): { terrain: number; riverLine: boolean } | null {
  const total = sum(facts.elevationAreas);
  if (!(total > 0)) return null;
  const elevation =
    facts.elevationAreas.reduce(
      (acc, area, zone) => acc + area * (ELEVATION_ZONE_TERRAIN[zone] ?? ELEVATION_ZONE_TERRAIN.at(-1)!),
      0
    ) / total;
  const climateEntries = Object.entries(facts.climateAreas);
  const climateTotal = sum(climateEntries.map(([, area]) => area));
  const cover =
    climateTotal > 0
      ? climateEntries.reduce((acc, [code, area]) => acc + climateBonus(code) * area, 0) / climateTotal
      : 0;
  const urbanWeight = Math.min(
    MAX_URBAN_WEIGHT,
    Math.max(0, facts.populationDensity) / URBAN_DENSITY_REFERENCE
  );
  const ground = (elevation + cover) * (1 - urbanWeight) + TERRAIN_FACTOR.urban * urbanWeight;
  const riverLine =
    facts.neighbours && facts.borderKm > 0 && facts.riverKm >= RIVER_LINE_SHARE * facts.borderKm;
  return {
    terrain: Math.min(MAX_TERRAIN_FACTOR, ground + (riverLine ? RIVER_LINE_BONUS : 0)),
    riverLine,
  };
}

function frontKm(neighbours: boolean, borderKm: number) {
  return neighbours ? Math.max(MIN_FRONT_KM, borderKm) : OVERSEAS_FRONT_KM;
}

function shape(
  source: TheatreSource,
  geometry: { neighbours: boolean; borderKm: number; distanceKm: number },
  terrain: number,
  riverLine: boolean
): Theatre {
  return {
    source,
    neighbours: geometry.neighbours,
    campaign: geometry.neighbours ? "land" : "overseas",
    borderKm: geometry.borderKm,
    distanceKm: geometry.neighbours ? 0 : geometry.distanceKm,
    frontKm: frontKm(geometry.neighbours, geometry.borderKm),
    terrain,
    terrainClass: nearestTerrainClass(terrain - (riverLine ? RIVER_LINE_BONUS : 0)),
    riverLine,
  };
}

/**
 * The theatre for a pair: terrain from the map when it measured the sector, else the defender's declared profile,
 * else the typical mix. Geometry (neighbours, border, distance) comes from the map when it has the territories.
 */
export function resolveTheatre(input: {
  map: MapTheatreFacts | null;
  declared: DeclaredTerrain | null;
}): Theatre {
  const geometry = input.map ?? {
    neighbours: false,
    borderKm: 0,
    distanceKm: DEFAULT_DISTANCE_KM,
  };
  const measured = input.map ? mapTerrain(input.map) : null;
  if (measured) return shape("map", geometry, measured.terrain, measured.riverLine);
  if (input.declared) {
    const { terrain, riverLine } = input.declared;
    return shape(
      "declared",
      geometry,
      TERRAIN_FACTOR[terrain] + (riverLine ? RIVER_LINE_BONUS : 0),
      riverLine
    );
  }
  return shape("default", geometry, TERRAIN_FACTOR[DEFAULT_TERRAIN], false);
}

/** Power projection over distance: reach = exp(−d / D_reach), 1 for neighbours. */
export function reachFactor(distanceKm: number, doctrine: Doctrine): number {
  return Math.exp(-Math.max(0, distanceKm) / REACH_KM[doctrine]);
}

/** The theatre weight of each domain for the campaign. */
export const campaignWeights = (campaign: Campaign) => CAMPAIGN_WEIGHTS[campaign];

/** Parse a stored terrain profile ("rugged", "rugged+river"); null when absent or unknown. */
export function parseDeclaredTerrain(value: string | null | undefined): DeclaredTerrain | null {
  if (!value) return null;
  const [terrain, river] = value.split("+");
  const match = TERRAIN_CLASSES.find((c) => c === terrain);
  return match ? { terrain: match, riverLine: river === "river" } : null;
}

/** The stored form of a declared terrain profile. */
export const formatDeclaredTerrain = (declared: DeclaredTerrain) =>
  declared.riverLine ? `${declared.terrain}+river` : declared.terrain;
