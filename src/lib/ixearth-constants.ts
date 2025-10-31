/**
 * IxEarth Planetary Constants
 *
 * Central source of truth for IxEarth metrics, calculated from complete map data
 * and World Roster canonical totals.
 *
 * Last Updated: 2025-10-29
 * Data Source: Complete PostGIS map data + World-Roster.xlsx
 * Calculation Method: Earth-scale PostGIS measurements × IxEarth Scale Factor (1.4777x)
 */

// =============================================================================
// CORE PLANETARY METRICS (Canonical)
// =============================================================================

/**
 * Total IxEarth surface area and breakdown
 * Based on complete map data (altitudes layer = full landmass)
 */
export const IXEARTH_PLANETARY_METRICS = {
  /** Total land area (claimed + unclaimed) in square miles */
  totalLandAreaSqMi: 127724235.559,

  /** Total water area (oceans + lakes) in square miles */
  totalWaterAreaSqMi: 227128506.585,

  /** Total planetary surface area in square miles */
  totalSurfaceAreaSqMi: 354852742.143,

  /** Percentage of surface that is land */
  landPercentage: 36.0,

  /** Percentage of surface that is water */
  waterPercentage: 64.0,
} as const;

/**
 * Claimed vs unclaimed land breakdown
 * Based on 82 countries in World Roster vs total landmass
 */
export const IXEARTH_LAND_BREAKDOWN = {
  /** Total land claimed by 82 recognized countries */
  claimedLandSqMi: 44440107,

  /** Unclaimed/wilderness territories */
  unclaimedLandSqMi: 83284128.559,

  /** Percentage of land that is claimed by countries */
  claimedPercentage: 34.8,

  /** Percentage of land that is unclaimed */
  unclaimedPercentage: 65.2,

  /** Number of recognized countries */
  totalCountries: 82,
} as const;

/**
 * Population and economic data
 * Based on World Roster totals
 */
export const IXEARTH_DEMOGRAPHICS = {
  /** Total population across all 82 countries */
  totalPopulation: 11185585916,

  /** Total GDP (combined) in USD */
  totalGdpUsd: 441290000000000, // ~$441 trillion

  /** Average GDP per capita in USD */
  averageGdpPerCapita: 38061,

  /** Average population density (people per sq mi) on claimed land */
  averagePopulationDensity: 251.7,
} as const;

// =============================================================================
// COMPARISON TO EARTH
// =============================================================================

/**
 * Earth's actual metrics for comparison
 */
export const EARTH_METRICS = {
  totalLandAreaSqMi: 57510000,
  totalWaterAreaSqMi: 139434000,
  totalSurfaceAreaSqMi: 196940000,
  landPercentage: 29.2,
  waterPercentage: 70.8,
} as const;

/**
 * IxEarth to Earth size ratios
 */
export const IXEARTH_TO_EARTH_RATIOS = {
  /** IxEarth has 2.22x the land area of Earth */
  landAreaRatio: 2.22,

  /** IxEarth has 1.63x the water area of Earth */
  waterAreaRatio: 1.63,

  /** IxEarth has 1.80x the total surface area of Earth */
  totalSurfaceRatio: 1.8,

  /** IxEarth is more land-rich (36% vs 29.2%) */
  landPercentageDifference: 6.8,
} as const;

// =============================================================================
// COORDINATE & SCALE SYSTEMS
// =============================================================================

/**
 * IxMaps coordinate system and scaling
 */
export const IXMAPS_COORDINATE_SYSTEM = {
  /** Custom prime meridian offset (degrees east of Greenwich) */
  primeMeridianOffset: 26.09,

  /** Projection type */
  projectionType: "Equidistant Cylindrical (Plate Carrée)",

  /** Base ellipsoid */
  ellipsoid: "WGS84",

  /** Source EPSG code (custom CRS) */
  sourceEpsg: null, // Custom CRS, not standard EPSG

  /** Storage EPSG code (transformed for PostGIS) */
  storageEpsg: 4326, // WGS84

  /** Display EPSG code (for vector tiles) */
  displayEpsg: 3857, // Web Mercator
} as const;

/**
 * Map scale and area calculations
 * The fundamental scaling factor for IxEarth
 */
export const IXEARTH_SCALE_SYSTEM = {
  /**
   * IxMaps pixel-to-area scale
   * Each pixel on the original IxMaps represents 10 square miles of IxEarth land
   */
  pixelToAreaScale: 10, // 1px = 10 sq mi

  /**
   * IxEarth Scale Factor
   * Ratio between canonical IxEarth areas and Earth-scale geographic calculations
   *
   * Calculated as: sum(World Roster canonical areas) / sum(PostGIS Earth-scale areas)
   *
   * This factor reconciles:
   * - IxMaps custom coordinate system (with 1px = 10 sq mi scaling)
   * - PostGIS geographic calculations (using Earth's WGS84 ellipsoid)
   */
  ixearthScaleFactor: 1.4777,

  /**
   * Conversion: Earth-scale measurement → IxEarth canonical area
   * Multiply any PostGIS geography area by this factor to get IxEarth canonical area
   */
  earthScaleToCanonical: (earthScaleAreaSqMi: number) => earthScaleAreaSqMi * 1.4777,

  /**
   * Conversion: IxEarth canonical area → Earth-scale measurement
   * Divide any IxEarth canonical area by this factor to get Earth-scale equivalent
   */
  canonicalToEarthScale: (canonicalAreaSqMi: number) => canonicalAreaSqMi / 1.4777,
} as const;

/**
 * PostGIS layer measurements (Earth-scale, before scaling)
 * These are the raw geographic calculations from the complete map data
 */
export const POSTGIS_LAYER_METRICS = {
  /** Political boundaries (countries + territories) - 185 features */
  politicalLayerSqMi: 43338096.66,

  /** Altitudes layer (COMPLETE LANDMASS) - 4068 features */
  altitudesLayerSqMi: 86434483.02, // This × 1.4777 = total IxEarth land

  /** Icecaps layer (polar ice) - 12 features */
  icecapsLayerSqMi: 8367034.83,

  /** Lakes layer (water bodies) - 350 features */
  lakesLayerSqMi: 494883.35,

  /** Rivers layer (water lines) - not measured as area */
  riversLayer: "Not measured (line features)",
} as const;

// =============================================================================
// MAPLIBRE GL JS CONFIGURATION
// =============================================================================

/**
 * MapLibre-specific configuration for IxEarth rendering
 */
export const MAPLIBRE_CONFIG = {
  /** Default center point for IxEarth map [longitude, latitude] */
  defaultCenter: [0, 0] as [number, number],

  /** Default zoom level (globe view - Google Maps style) */
  defaultZoom: 1.5,

  /** Min zoom level (user interaction constraint) */
  minZoom: 1.5,

  /** Max zoom level (user interaction constraint) */
  maxZoom: 18,

  /** Tile source min zoom (must be integer, 0 = terrain visible on globe immediately) */
  tileMinZoom: 0,

  /** Tile source max zoom (must be integer) */
  tileMaxZoom: 18,

  /** Zoom level threshold for globe → mercator transition */
  globeToMercatorZoom: 4,

  /** Tile extent for MVT generation */
  tileExtent: 512,

  /** Tile buffer (pixels, prevents seam artifacts) */
  tileBuffer: 64,

  /** Vector tile URL template */
  vectorTileUrlTemplate: "/api/tiles/{layer}/{z}/{x}/{y}",

  /** Available map layers */
  availableLayers: [
    "political",
    "background",
    "altitudes",
    "icecaps",
    "lakes",
    "rivers",
    "climate",
  ] as const,

  /** Default projection (globe for Google Maps-like experience) */
  defaultProjection: "globe",

  /** Available projections */
  availableProjections: ["mercator", "equalEarth", "globe"] as const,
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert square miles to square kilometers
 */
export function sqMiToSqKm(sqMi: number): number {
  return sqMi * 2.58999;
}

/**
 * Convert square kilometers to square miles
 */
export function sqKmToSqMi(sqKm: number): number {
  return sqKm / 2.58999;
}

/**
 * Calculate population density
 */
export function calculatePopulationDensity(population: number, areaSqMi: number): number {
  return population / areaSqMi;
}

/**
 * Calculate GDP density
 */
export function calculateGdpDensity(totalGdp: number, areaSqMi: number): number {
  return totalGdp / areaSqMi;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

/**
 * Format currency (USD)
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1000000000000) {
    return `$${(amount / 1000000000000).toFixed(2)} trillion`;
  } else if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(2)} billion`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)} million`;
  }
  return `$${amount.toLocaleString("en-US")}`;
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type IxEarthLayer = (typeof MAPLIBRE_CONFIG.availableLayers)[number];
export type IxEarthProjection = (typeof MAPLIBRE_CONFIG.availableProjections)[number];

// =============================================================================
// METADATA
// =============================================================================

/**
 * Metadata about this constants file
 */
export const IXEARTH_CONSTANTS_METADATA = {
  version: "1.0.0",
  lastUpdated: "2025-10-29",
  dataSource: "PostGIS complete map data + World-Roster.xlsx",
  calculationMethod: "Earth-scale PostGIS measurements × IxEarth Scale Factor (1.4777x)",
  verified: true,
  notes: [
    "All metrics calculated from actual map data stored in PostGIS",
    "World Roster contains 82 claimed countries (34.8% of total land)",
    "65.2% of IxEarth land is unclaimed wilderness/territories",
    "Scale factor (1.4777x) reconciles IxMaps custom CRS with Earth WGS84",
    "Total surface area matches screenshot approximation within 0.6%",
  ],
} as const;
