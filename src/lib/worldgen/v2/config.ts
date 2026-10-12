/**
 * UPG v2 — Configuration & Constants
 *
 * Default parameters, elevation zone definitions, Trewartha biome constants,
 * and quality gate thresholds.
 */

import type { WorldGenParams } from "./types";

// Default Generation Parameters

/** Earth's land hypsometry over the 9 zones (share of land, %). */
const EARTH_HYPSOMETRY = [18, 22, 12, 22, 15, 6, 3, 1.5, 0.5];

export const DEFAULT_PARAMS: WorldGenParams = {
  seed: 42,
  cellCount: 100000,
  plateCount: 10,
  continentCount: 6,
  continentLatitudeRange: [-50, 60],
  continentSizeVariance: 0.5,
  islandShare: 0.06,
  polarLand: { north: false, south: true },
  countryCountRange: [60, 200],
  oceanPercentage: 0.7,
  terrainRoughness: 0.5,
  coastlineComplexity: 0.6,
  hypsometry: EARTH_HYPSOMETRY,
  temperatureOffset: 0,
  precipitationScale: 1,
  riverDensity: 1,
  lakeCoverage: 0.012,
  hasIcecaps: true,
  hasRivers: true,
  hasLakes: true,
  useMarkovNaming: true,
  lloydIterations: 5,
};

/**
 * Presets reproducing the shape statistics of the two hand-drawn realm maps. Targets were measured
 * on 2026-10-11 by sampling each realm's active map_layers on a 0.5° grid (area-weighted):
 *
 * - Ixnay (IxEarth): 22.9% land in ~6 mid-latitude continents plus ~240 islands, no polar land,
 *   flat (49% of land below 100 m), warm and wet (Ar 28%, Cf+Cs 25%, B 16%, D 18%, E/F/H 4%),
 *   ~350 lakes covering ~1.1% of land, ~1000 river segments.
 * - Eurth: 22.9% land in two large continents, two medium ones and a south-polar continent (13% of
 *   land), rugged (zones 3+ hold 32% of land), continental climate (Dc 23%, E 9%, B 23%, Fi 10%),
 *   ~60 lakes (1.1% of land), ~400 river segments.
 */
export const WORLD_PRESETS = {
  earthlike: {},
  ixnay: {
    oceanPercentage: 0.771,
    continentCount: 6,
    continentLatitudeRange: [-40, 60],
    continentSizeVariance: 0.45,
    islandShare: 0.07,
    polarLand: { north: false, south: false },
    hypsometry: [48.8, 24.7, 15.3, 8.5, 1.9, 0.7, 0.2, 0.1, 0],
    temperatureOffset: 1.5,
    precipitationScale: 1.6,
    riverDensity: 1.4,
    lakeCoverage: 0.011,
  },
  eurth: {
    oceanPercentage: 0.771,
    continentCount: 5,
    continentLatitudeRange: [18, 60],
    continentSizeVariance: 0.75,
    islandShare: 0.06,
    polarLand: { north: false, south: true },
    hypsometry: [39.6, 19, 9.3, 16, 8.1, 4.5, 1.8, 1.5, 0.1],
    temperatureOffset: 3,
    precipitationScale: 1,
    riverDensity: 0.8,
    lakeCoverage: 0.011,
  },
} satisfies Record<string, Partial<WorldGenParams>>;

export type WorldPreset = keyof typeof WORLD_PRESETS;

// Elevation Zones (meters)

interface ElevationZone {
  id: number;
  zoneId: string;
  name: string;
  minMeters: number;
  maxMeters: number;
  color: string;
}

/**
 * The canonical 9-zone elevation system matching the IxWiki topographic legend.
 * Heights in meters. Zone 0 = lowest, zone 8 = highest.
 */
export const ELEVATION_ZONES: ElevationZone[] = [
  {
    id: 0,
    zoneId: "zone_0",
    name: "Coastal Lowlands",
    minMeters: 0,
    maxMeters: 99,
    color: "#a8c995ff",
  },
  {
    id: 1,
    zoneId: "zone_1",
    name: "Low Hills",
    minMeters: 100,
    maxMeters: 349,
    color: "#c3d3a1ff",
  },
  {
    id: 2,
    zoneId: "zone_2",
    name: "Rolling Hills",
    minMeters: 350,
    maxMeters: 499,
    color: "#dcdcacff",
  },
  { id: 3, zoneId: "zone_3", name: "Uplands", minMeters: 500, maxMeters: 999, color: "#f7e6b8ff" },
  {
    id: 4,
    zoneId: "zone_4",
    name: "Low Mountains",
    minMeters: 1000,
    maxMeters: 1999,
    color: "#dac497ff",
  },
  {
    id: 5,
    zoneId: "zone_5",
    name: "Mid Mountains",
    minMeters: 2000,
    maxMeters: 2999,
    color: "#bea276ff",
  },
  {
    id: 6,
    zoneId: "zone_6",
    name: "High Mountains",
    minMeters: 3000,
    maxMeters: 3999,
    color: "#9c7b50ff",
  },
  { id: 7, zoneId: "zone_7", name: "Alpine", minMeters: 4000, maxMeters: 4999, color: "#7a5c34ff" },
  {
    id: 8,
    zoneId: "zone_8",
    name: "Glacial Peaks",
    minMeters: 5000,
    maxMeters: 9000,
    color: "#f0f0f0ff",
  },
];

/**
 * Get the elevation zone for a given height in meters.
 */
export function getElevationZone(meters: number): number {
  for (let z = ELEVATION_ZONES.length - 1; z >= 0; z--) {
    if (meters >= ELEVATION_ZONES[z]!.minMeters) return z;
  }
  return 0;
}

// Trewartha Biome Classification

interface TrewarthaBiome {
  id: number;
  code: string;
  name: string;
  color: string;
}

export const TREWARTHA_BIOMES: TrewarthaBiome[] = [
  { id: 0, code: "Ar", name: "Tropical Wet", color: "#960000" },
  { id: 1, code: "Aw", name: "Tropical Dry", color: "#ff0000" },
  { id: 2, code: "Bs", name: "Steppe", color: "#f5a500" },
  { id: 3, code: "Bw", name: "Desert", color: "#ffff00" },
  { id: 4, code: "Cf", name: "Subtropical Humid", color: "#96ff00" },
  { id: 5, code: "Cs", name: "Subtropical Dry Summer", color: "#00c800" },
  { id: 6, code: "Do", name: "Temperate Oceanic", color: "#00ff6e" },
  { id: 7, code: "Dc", name: "Temperate Continental", color: "#37c8ff" },
  { id: 8, code: "E", name: "Boreal", color: "#007d7d" },
  { id: 9, code: "Ft", name: "Tundra", color: "#b2b2b2" },
  { id: 10, code: "Fi", name: "Ice Cap", color: "#ffffff" },
  { id: 11, code: "H", name: "Highland", color: "#966496" },
];

// Quality Gate Thresholds

export const QUALITY_THRESHOLDS = {
  /** Minimum composite quality score to pass (0-100) */
  compositeMinimum: 85,

  // Check 3: Mountain placement
  mountainBoundaryCorrelation: 0.8,
  mountainBoundaryMaxDist: 10,

  // Check 8: Land/ocean ratio
  landOceanTolerancePercent: 8,

  // Natural border strengths (politics)
  riverBorderStrength: 0.8,
  mountainBorderStrength: 1.0,
  coastBorderStrength: 1.0,
  flatlandBorderStrength: 0.1,
} as const;

// Tectonic Constants

export const TECTONIC_CONSTANTS = {
  /** Relative closing speed above which a boundary is convergent (or divergent) */
  boundaryVelocityThreshold: 0.3,
  /** Continental plate speed range [min, max] in relative units */
  continentalSpeedRange: [0.3, 1.2] as [number, number],
  /** Oceanic plate speed range [min, max] in relative units */
  oceanicSpeedRange: [1.0, 3.0] as [number, number],
} as const;

// Climate Constants

export const CLIMATE_CONSTANTS = {
  /** Annual-mean sea-level temperature at the equator in °C */
  equatorialTemp: 28,
  /** Zonal cooling T = equatorialTemp − k·lat² (fits Earth: 13 °C at 45°, 2 °C at 60°, −30 °C at 90°) */
  latitudeTempCurvature: 0.0072,
  /** Altitude lapse rate: °C per 1000m */
  lapseRatePerKm: 6.5,
  /** Annual-mean cooling of deep continental interiors at mid/high latitudes in °C */
  continentalCooling: 3,
  /** Warm ocean current temperature boost in °C */
  warmCurrentBoost: 3,
  /** Cold ocean current temperature reduction in °C */
  coldCurrentReduction: -3,
  /** Share of land cells carrying a river at riverDensity = 1 */
  riverCellShare: 0.08,
  /** Ocean colder than this (annual mean °C) is drawn as sea ice */
  seaIceTemp: -13,
  /** Land colder than this (annual mean °C) holds a permanent ice sheet */
  iceSheetTemp: -14,
  /** Land within this many km of the windward ocean counts as maritime (Do, Cs) */
  maritimeKm: 700,
} as const;
