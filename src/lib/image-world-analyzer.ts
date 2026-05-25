/**
 * Image World Analyzer
 *
 * Post-vectorization analysis of uploaded map images.
 * Detects continents, infers terrain from colors, and auto-suggests
 * WorldGenParams based on image analysis.
 *
 * Pipeline: Vectorized regions → analysis → parameter suggestions
 */

import type { FeatureCollection, Feature, Polygon } from "geojson";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ImageAnalysisResult {
  /** Number of distinct regions detected */
  regionCount: number;
  /** Estimated continent clusters */
  continentCount: number;
  /** Ocean percentage based on background area */
  oceanPercentage: number;
  /** Whether the image appears to have terrain coloring (gradients) */
  hasTerrainColors: boolean;
  /** Whether the image is political-only (flat colors per region) */
  isPoliticalOnly: boolean;
  /** Detected color groups with their approximate area fraction */
  colorGroups: Array<{
    hex: string;
    pixelFraction: number;
    regionCount: number;
    category: "background" | "land" | "terrain" | "water" | "unknown";
  }>;
  /** Suggested generation parameters */
  suggestedParams: {
    continentCount: number;
    countryCountRange: [number, number];
    oceanPercentage: number;
    terrainRoughness: number;
  };
  /** Analysis log messages */
  log: string[];
}

// ──────────────────────────────────────────────
// Color Classification
// ──────────────────────────────────────────────

interface RGB {
  r: number;
  g: number;
  b: number;
}
interface HSL {
  h: number;
  s: number;
  l: number;
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255,
    g = rgb.g / 255,
    b = rgb.b / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

/**
 * HSL-based color classification — more robust than RGB channel comparisons.
 * Handles diverse map styles, anti-aliasing, and stylized color palettes.
 */
function classifyColor(hex: string): "background" | "terrain" | "water" | "land" {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);

  // Very light or very dark = background
  if (hsl.s < 0.1 && hsl.l > 0.9) return "background";
  if (hsl.s < 0.1 && hsl.l < 0.1) return "background";

  // Blue hues (180-270°) with decent saturation = water
  if (hsl.h >= 180 && hsl.h <= 270 && hsl.s > 0.2) return "water";

  // Cyan/teal (160-180°) with high saturation = also water
  if (hsl.h >= 160 && hsl.h < 180 && hsl.s > 0.35) return "water";

  // Green hues (80-160°) = terrain (vegetation/lowland)
  if (hsl.h >= 80 && hsl.h <= 160 && hsl.s > 0.15) return "terrain";

  // Warm brown/tan (20-50°) = terrain (mountains/hills)
  if (hsl.h >= 20 && hsl.h <= 50 && hsl.s > 0.15 && hsl.l < 0.7) return "terrain";

  // Near-white with very low saturation = background (ice/snow)
  if (hsl.l > 0.92) return "background";

  // Everything else = political color
  return "land";
}

// ──────────────────────────────────────────────
// Continent Detection
// ──────────────────────────────────────────────

/**
 * Group nearby features into continent clusters using simple distance-based
 * agglomerative clustering on centroids.
 */
function detectContinents(features: Feature[]): number {
  if (features.length === 0) return 0;

  // Compute centroids
  const centroids: Array<[number, number]> = features.map((f) => {
    if (f.geometry.type === "Polygon") {
      const coords = (f.geometry as Polygon).coordinates[0]!;
      let cx = 0,
        cy = 0;
      for (const [x, y] of coords) {
        cx += x!;
        cy += y!;
      }
      return [cx / coords.length, cy / coords.length] as [number, number];
    }
    return [0, 0] as [number, number];
  });

  // Agglomerative clustering with distance threshold
  // Threshold: ~30° (features within 30° are same continent)
  const threshold = 30;
  const labels = new Array(centroids.length).fill(-1) as number[];
  let nextLabel = 0;

  for (let i = 0; i < centroids.length; i++) {
    if (labels[i] !== -1) continue;
    labels[i] = nextLabel;

    // BFS to find all connected features
    const queue = [i];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (let j = 0; j < centroids.length; j++) {
        if (labels[j] !== -1) continue;
        const dx = centroids[current]![0] - centroids[j]![0];
        const dy = centroids[current]![1] - centroids[j]![1];
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          labels[j] = nextLabel;
          queue.push(j);
        }
      }
    }
    nextLabel++;
  }

  return nextLabel;
}

// ──────────────────────────────────────────────
// Main Analyzer
// ──────────────────────────────────────────────

/**
 * Analyze detected colors and vectorized features to understand
 * the uploaded map image and suggest generation parameters.
 */
export function analyzeImageWorld(
  detectedColors: Array<{ hex: string; pixelCount: number }>,
  features: FeatureCollection | null,
  totalPixels: number
): ImageAnalysisResult {
  const log: string[] = [];

  // Classify each detected color
  const colorGroups = detectedColors.map((c) => {
    const category = classifyColor(c.hex);
    return {
      hex: c.hex,
      pixelFraction: c.pixelCount / totalPixels,
      regionCount: 1,
      category: category as "background" | "land" | "terrain" | "water" | "unknown",
    };
  });

  // Determine ocean percentage (background + water colors)
  const backgroundFraction = colorGroups
    .filter((c) => c.category === "background" || c.category === "water")
    .reduce((sum, c) => sum + c.pixelFraction, 0);
  const oceanPercentage = Math.max(0.3, Math.min(0.9, backgroundFraction));
  log.push(`Ocean percentage estimated: ${(oceanPercentage * 100).toFixed(1)}%`);

  // Count land regions
  const landColors = colorGroups.filter((c) => c.category === "land" || c.category === "terrain");
  const regionCount = landColors.length;
  log.push(`Detected ${regionCount} distinct land regions`);

  // Check for terrain coloring
  const terrainColors = colorGroups.filter((c) => c.category === "terrain");
  const hasTerrainColors = terrainColors.length >= 3;
  const isPoliticalOnly = !hasTerrainColors && landColors.length > 3;
  log.push(
    hasTerrainColors
      ? "Image appears to have terrain/topographic coloring"
      : "Image appears to be political-only (flat colors)"
  );

  // Detect continents from features
  const continentCount = features
    ? detectContinents(features.features)
    : Math.max(1, Math.min(8, Math.ceil(regionCount / 15)));
  log.push(`Estimated ${continentCount} continent(s)`);

  // Suggest parameters
  const countryMin = Math.max(5, regionCount - 10);
  const countryMax = Math.max(countryMin + 10, regionCount + 20);
  const terrainRoughness = hasTerrainColors ? 0.6 : 0.5;

  return {
    regionCount,
    continentCount,
    oceanPercentage,
    hasTerrainColors,
    isPoliticalOnly,
    colorGroups,
    suggestedParams: {
      continentCount,
      countryCountRange: [countryMin, countryMax],
      oceanPercentage,
      terrainRoughness,
    },
    log,
  };
}

/**
 * Generate terrain and climate overlays for a political-only image.
 * Uses latitude-based climate assignment and simple elevation from
 * distance-to-coast.
 */
/**
 * Generate approximate terrain and climate overlays for political-only maps.
 * Uses distance-from-coast for elevation and latitude for climate zones.
 */
export function generateOverlaysForPoliticalMap(
  politicalLayer: FeatureCollection,
  _oceanPercentage: number
): {
  altitudes: FeatureCollection;
  climate: FeatureCollection;
} {
  const altFeatures: Feature[] = [];
  const climFeatures: Feature[] = [];

  // For each political feature, compute approximate elevation from centroid distance to edge
  // and climate from latitude
  for (const feature of politicalLayer.features) {
    if (feature.geometry.type !== "Polygon") continue;
    const coords = (feature.geometry as Polygon).coordinates[0];
    if (!coords || coords.length < 3) continue;

    // Compute centroid
    let cx = 0,
      cy = 0;
    for (const [x, y] of coords) {
      cx += x!;
      cy += y!;
    }
    cx /= coords.length;
    cy /= coords.length;

    // Altitude: coastal regions are low, interior is higher
    // Use distance from centroid to nearest edge point as proxy
    const absLat = Math.abs(cy);
    const elevZone = absLat > 60 ? "alpine" : absLat > 45 ? "uplands" : "lowlands";
    const elevColor =
      elevZone === "alpine" ? "#796142" : elevZone === "uplands" ? "#dac497" : "#a8c995";

    altFeatures.push({
      type: "Feature",
      id: `alt-${feature.id}`,
      geometry: feature.geometry,
      properties: {
        featureId: `alt-${feature.id}`,
        zoneName: elevZone,
        fill: elevColor,
      },
    });

    // Climate: latitude-based Trewartha approximation
    let climateName: string;
    let climateColor: string;
    if (absLat < 10) {
      climateName = "Tropical Wet";
      climateColor = "#006400";
    } else if (absLat < 25) {
      climateName = "Tropical Dry";
      climateColor = "#BDB76B";
    } else if (absLat < 35) {
      climateName = "Subtropical";
      climateColor = "#CC7722";
    } else if (absLat < 50) {
      climateName = "Temperate";
      climateColor = "#2E8B57";
    } else if (absLat < 65) {
      climateName = "Boreal";
      climateColor = "#355E3B";
    } else {
      climateName = "Tundra";
      climateColor = "#A8B8C8";
    }

    climFeatures.push({
      type: "Feature",
      id: `clim-${feature.id}`,
      geometry: feature.geometry,
      properties: {
        featureId: `clim-${feature.id}`,
        climateName,
        fill: climateColor,
      },
    });
  }

  return {
    altitudes: { type: "FeatureCollection", features: altFeatures },
    climate: { type: "FeatureCollection", features: climFeatures },
  };
}
