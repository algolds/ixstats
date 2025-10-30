/**
 * IxEarth MapLibre GL JS - Example Usage
 *
 * This file demonstrates how to use the IxEarth constants with MapLibre GL JS
 * for rendering the IxEarth map with correct scaling and configuration.
 *
 * Import this in your map components to ensure consistent IxEarth rendering.
 */

import {
  IXEARTH_PLANETARY_METRICS,
  IXEARTH_SCALE_SYSTEM,
  MAPLIBRE_CONFIG,
  IXEARTH_TO_EARTH_RATIOS,
  type IxEarthLayer,
  type IxEarthProjection,
} from "./ixearth-constants";

// =============================================================================
// MAPLIBRE MAP INITIALIZATION
// =============================================================================

/**
 * Example: Initialize MapLibre map with IxEarth configuration
 */
export function createIxEarthMap(container: string | HTMLElement) {
  // This is a conceptual example - actual MapLibre initialization
  // would happen in your React component using useMap hook

  const mapConfig = {
    container,
    center: MAPLIBRE_CONFIG.defaultCenter,
    zoom: MAPLIBRE_CONFIG.defaultZoom,
    minZoom: MAPLIBRE_CONFIG.minZoom,
    maxZoom: MAPLIBRE_CONFIG.maxZoom,
    projection: MAPLIBRE_CONFIG.defaultProjection,

    // Vector tile source configuration
    sources: {
      "ixearth-tiles": {
        type: "vector",
        tiles: [
          `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/tiles/{layer}/{z}/{x}/{y}?v=v12-roster-integration`,
        ],
        minzoom: MAPLIBRE_CONFIG.minZoom,
        maxzoom: MAPLIBRE_CONFIG.maxZoom,
      },
    },
  };

  console.log("[IxEarth] Map initialized with configuration:", mapConfig);
  console.log("[IxEarth] Planetary metrics:", IXEARTH_PLANETARY_METRICS);
  console.log("[IxEarth] Scale factor:", IXEARTH_SCALE_SYSTEM.ixearthScaleFactor);

  return mapConfig;
}

// =============================================================================
// AREA CALCULATIONS
// =============================================================================

/**
 * Convert PostGIS Earth-scale area measurement to IxEarth canonical area
 *
 * @param earthScaleAreaSqMi - Area in square miles from PostGIS geography calculation
 * @returns IxEarth canonical area in square miles
 *
 * @example
 * // PostGIS calculates a country as 1,000,000 sq mi using Earth's ellipsoid
 * const earthScale = 1000000;
 * const ixearthCanonical = convertToIxEarthArea(earthScale);
 * // Result: 1,477,700 sq mi (IxEarth canonical)
 */
export function convertToIxEarthArea(earthScaleAreaSqMi: number): number {
  return IXEARTH_SCALE_SYSTEM.earthScaleToCanonical(earthScaleAreaSqMi);
}

/**
 * Convert IxEarth canonical area to Earth-scale measurement
 *
 * @param canonicalAreaSqMi - IxEarth canonical area in square miles
 * @returns Earth-scale area in square miles
 *
 * @example
 * // A country's canonical area from World Roster
 * const canonical = 1477700;
 * const earthScale = convertToEarthScaleArea(canonical);
 * // Result: 1,000,000 sq mi (Earth-scale)
 */
export function convertToEarthScaleArea(canonicalAreaSqMi: number): number {
  return IXEARTH_SCALE_SYSTEM.canonicalToEarthScale(canonicalAreaSqMi);
}

// =============================================================================
// LAYER MANAGEMENT
// =============================================================================

/**
 * Get vector tile URL for a specific layer
 *
 * @param layer - IxEarth layer name
 * @param version - Cache-busting version (default: 'v12-roster-integration')
 * @returns Complete vector tile URL template
 */
export function getVectorTileUrl(
  layer: IxEarthLayer,
  version: string = "v12-roster-integration"
): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${baseUrl}${basePath}/api/tiles/${layer}/{z}/{x}/{y}?v=${version}`;
}

/**
 * Get all available layers with their tile URLs
 */
export function getAllLayerUrls(
  version: string = "v12-roster-integration"
): Record<IxEarthLayer, string> {
  const layers = {} as Record<IxEarthLayer, string>;

  for (const layer of MAPLIBRE_CONFIG.availableLayers) {
    layers[layer] = getVectorTileUrl(layer, version);
  }

  return layers;
}

// =============================================================================
// INFORMATION DISPLAY
// =============================================================================

/**
 * Get formatted planetary statistics for display
 */
export function getIxEarthStats() {
  return {
    totalLand: `${IXEARTH_PLANETARY_METRICS.totalLandAreaSqMi.toLocaleString()} sq mi`,
    totalWater: `${IXEARTH_PLANETARY_METRICS.totalWaterAreaSqMi.toLocaleString()} sq mi`,
    totalSurface: `${IXEARTH_PLANETARY_METRICS.totalSurfaceAreaSqMi.toLocaleString()} sq mi`,
    landPercentage: `${IXEARTH_PLANETARY_METRICS.landPercentage}%`,
    waterPercentage: `${IXEARTH_PLANETARY_METRICS.waterPercentage}%`,
    vsEarthLand: `${IXEARTH_TO_EARTH_RATIOS.landAreaRatio}x`,
    vsEarthWater: `${IXEARTH_TO_EARTH_RATIOS.waterAreaRatio}x`,
    vsEarthTotal: `${IXEARTH_TO_EARTH_RATIOS.totalSurfaceRatio}x`,
  };
}

/**
 * Get country display information with proper area calculations
 *
 * @param country - Country data from database
 * @returns Formatted country information
 */
export function getCountryDisplayInfo(country: {
  name: string;
  areaSqMi: number;
  currentPopulation: number;
  currentTotalGdp: number;
}) {
  const density = country.currentPopulation / country.areaSqMi;
  const gdpPerCapita = country.currentTotalGdp / country.currentPopulation;

  return {
    name: country.name,
    area: `${country.areaSqMi.toLocaleString()} sq mi`,
    population: country.currentPopulation.toLocaleString(),
    populationDensity: `${density.toFixed(1)} people/sq mi`,
    totalGdp: formatGdp(country.currentTotalGdp),
    gdpPerCapita: `$${gdpPerCapita.toLocaleString()}`,
  };
}

/**
 * Format GDP values for display
 */
function formatGdp(amount: number): string {
  if (amount >= 1000000000000) {
    return `$${(amount / 1000000000000).toFixed(2)} trillion`;
  } else if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(2)} billion`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)} million`;
  }
  return `$${amount.toLocaleString()}`;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that a layer name is valid
 */
export function isValidLayer(layer: string): layer is IxEarthLayer {
  return MAPLIBRE_CONFIG.availableLayers.includes(layer as IxEarthLayer);
}

/**
 * Validate that a projection name is valid
 */
export function isValidProjection(projection: string): projection is IxEarthProjection {
  return MAPLIBRE_CONFIG.availableProjections.includes(projection as IxEarthProjection);
}

// =============================================================================
// CONSTANTS EXPORT (for convenience)
// =============================================================================

/**
 * Re-export commonly used constants for easy access
 */
export {
  IXEARTH_PLANETARY_METRICS,
  IXEARTH_SCALE_SYSTEM,
  MAPLIBRE_CONFIG,
  IXEARTH_TO_EARTH_RATIOS,
} from "./ixearth-constants";

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/**
 * Example 1: Display IxEarth vs Earth comparison
 */
export function example1_DisplayComparison() {
  const stats = getIxEarthStats();

  console.log("=== IxEarth vs Earth ===");
  console.log(`Land Area: ${stats.totalLand} (${stats.vsEarthLand} larger than Earth)`);
  console.log(`Water Area: ${stats.totalWater} (${stats.vsEarthWater} larger than Earth)`);
  console.log(`Total Surface: ${stats.totalSurface} (${stats.vsEarthTotal} larger than Earth)`);
  console.log(`Land: ${stats.landPercentage}, Water: ${stats.waterPercentage}`);
}

/**
 * Example 2: Convert PostGIS area to IxEarth canonical
 */
export function example2_ConvertArea() {
  // Country boundary measured by PostGIS (Earth-scale)
  const earthScaleArea = 1000000; // sq mi

  // Convert to IxEarth canonical area
  const ixearthArea = convertToIxEarthArea(earthScaleArea);

  console.log(`PostGIS (Earth-scale): ${earthScaleArea.toLocaleString()} sq mi`);
  console.log(`IxEarth (canonical): ${ixearthArea.toLocaleString()} sq mi`);
  console.log(`Scale factor: ${IXEARTH_SCALE_SYSTEM.ixearthScaleFactor}x`);
}

/**
 * Example 3: Display country information
 */
export function example3_CountryInfo() {
  // Example country data
  const country = {
    name: "Caphiria",
    areaSqMi: 2335110,
    currentPopulation: 619435970,
    currentTotalGdp: 39810000000000,
  };

  const info = getCountryDisplayInfo(country);

  console.log("=== Country Information ===");
  console.log(`Name: ${info.name}`);
  console.log(`Area: ${info.area}`);
  console.log(`Population: ${info.population}`);
  console.log(`Density: ${info.populationDensity}`);
  console.log(`GDP: ${info.totalGdp}`);
  console.log(`GDP per capita: ${info.gdpPerCapita}`);
}
