/**
 * UPG v2 — Configuration & Constants
 *
 * Default parameters, elevation zone definitions, Trewartha biome constants,
 * and quality gate thresholds.
 */

import type { WorldGenParams } from "./types";

// ──────────────────────────────────────────────
// Default Generation Parameters
// ──────────────────────────────────────────────

export const DEFAULT_PARAMS: WorldGenParams = {
  seed: 42,
  cellCount: 100000,
  plateCount: 10,
  continentCount: 6,
  countryCountRange: [60, 200],
  oceanPercentage: 0.65,
  terrainRoughness: 0.5,
  coastlineComplexity: 0.6,
  climateFidelity: 1.0,
  hasIcecaps: true,
  hasRivers: true,
  hasLakes: true,
  useIxWorldTemplate: false,
  templateStrength: 0.6,
  useMarkovNaming: true,
  languageFamilies: [],
  lloydIterations: 5,
};

// ──────────────────────────────────────────────
// Elevation Zones (meters)
// ──────────────────────────────────────────────

export interface ElevationZone {
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

// ──────────────────────────────────────────────
// Trewartha Biome Classification
// ──────────────────────────────────────────────

export interface TrewarthaBiome {
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

// ──────────────────────────────────────────────
// Quality Gate Thresholds
// ──────────────────────────────────────────────

export const QUALITY_THRESHOLDS = {
  /** Minimum composite quality score to pass (0-100) */
  compositeMinimum: 85,

  // Check 1: Continent count
  minContinents: 3,
  maxContinents: 10,
  minContinentCells: 1000,

  // Check 2: Continent shape diversity
  maxConvexity: 0.85,
  aspectRatioSimilarityThreshold: 0.2,

  // Check 3: Mountain placement
  mountainBoundaryCorrelation: 0.8,
  mountainBoundaryMaxDist: 10,

  // Check 4: River drainage quality
  riverDownhillFlowMin: 1.0,
  riverMountainCrossingMax: 0.0,
  riverReachesWaterMin: 0.9,

  // Check 5: Climate coherence
  rainShadowPresence: 0.7,
  equatorialTropicalMin: 0.6,
  polarTundraMin: 0.6,

  // Check 6: Lake placement
  lakesInDepressionMin: 0.8,

  // Check 7: Coastline complexity
  coastlineFractalDimMin: 1.15,
  minPeninsulasPerContinent: 1,
  minBaysPerContinent: 1,

  // Check 8: Land/ocean ratio
  landOceanTolerancePercent: 8,

  // Check 9: Elevation zone coverage
  minZonesPerLargeContinent: 5,

  // Natural border thresholds (politics)
  naturalBorderMin: 0.6,
  riverBorderStrength: 0.8,
  mountainBorderStrength: 1.0,
  coastBorderStrength: 1.0,
  flatlandBorderStrength: 0.1,
} as const;

// ──────────────────────────────────────────────
// Tectonic Constants
// ──────────────────────────────────────────────

export const TECTONIC_CONSTANTS = {
  /** Continental plate base elevation in meters */
  continentalBaseElevation: 300,
  /** Oceanic plate base elevation in meters */
  oceanicBaseElevation: -3000,
  /** Peak mountain uplift at convergent boundaries in meters */
  convergentUpliftMax: 5500,
  /** Width of mountain belt in cells from boundary */
  convergentBeltWidth: 12,
  /** Rift valley depression depth in meters */
  divergentDepressionDepth: -400,
  /** Mid-ocean ridge height above ocean floor in meters */
  midOceanRidgeHeight: 1200,
  /** Subduction arc offset from boundary in cells */
  subductionArcOffset: 5,
  /** Continental shelf width in cells */
  continentalShelfWidth: 4,
  /** Velocity threshold for boundary classification */
  boundaryVelocityThreshold: 0.3,
  /** Continental plate speed range [min, max] in relative units */
  continentalSpeedRange: [0.3, 1.2] as [number, number],
  /** Oceanic plate speed range [min, max] in relative units */
  oceanicSpeedRange: [1.0, 3.0] as [number, number],
} as const;

// ──────────────────────────────────────────────
// Climate Constants
// ──────────────────────────────────────────────

export const CLIMATE_CONSTANTS = {
  /** Baseline equatorial temperature in °C */
  equatorialTemp: 30,
  /** Temperature drop per degree of latitude */
  latitudeTempGradient: 0.667,
  /** Altitude lapse rate: °C per 1000m */
  lapseRatePerKm: 6.5,
  /** Coastal temperature moderation range in BFS hops */
  coastModerationRange: 5,
  /** Warm ocean current temperature boost in °C */
  warmCurrentBoost: 5,
  /** Cold ocean current temperature reduction in °C */
  coldCurrentReduction: -3,
  /** Orographic precipitation multiplier for windward slopes */
  orographicLiftMultiplier: 2.5,
  /** Rain shadow precipitation multiplier for leeward slopes */
  rainShadowMultiplier: 0.3,
  /** Target river count range [min, max] */
  targetRiverRange: [500, 1500] as [number, number],
  /** Minimum flux threshold scaling factor */
  fluxThresholdFactor: 0.001,
} as const;
