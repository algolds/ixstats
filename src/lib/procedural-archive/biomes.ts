/**
 * Biome Classification — Whittaker Diagram
 *
 * Classifies each land cell into one of 15 biome types based on
 * mean annual temperature and annual precipitation, using piecewise-linear
 * boundary functions inspired by the Whittaker biome diagram.
 *
 * Input: temperature grid (°C) + precipitation grid (normalized 0-1)
 * Output: biome index per cell + GeoJSON biome layer
 */

import type { FeatureCollection, Feature, Polygon, Position } from "geojson";
import type { HeightmapResult } from "./landmass-generator";

// ──────────────────────────────────────────────
// Biome Types
// ──────────────────────────────────────────────

export const BIOME_TYPES = [
  "tropical_rainforest",
  "tropical_seasonal_forest",
  "tropical_savanna",
  "subtropical_desert",
  "temperate_grassland",
  "temperate_deciduous_forest",
  "temperate_rainforest",
  "mediterranean",
  "boreal_forest",
  "tundra",
  "alpine",
  "mangrove",
  "wetland",
  "steppe",
  "ice_sheet",
] as const;

export type BiomeType = (typeof BIOME_TYPES)[number];

export interface BiomeConfig {
  id: BiomeType;
  name: string;
  color: string;
  description: string;
}

export const BIOME_CONFIGS: Record<BiomeType, BiomeConfig> = {
  tropical_rainforest: {
    id: "tropical_rainforest",
    name: "Tropical Rainforest",
    color: "#006400",
    description: "Hot, wet year-round",
  },
  tropical_seasonal_forest: {
    id: "tropical_seasonal_forest",
    name: "Tropical Seasonal Forest",
    color: "#228B22",
    description: "Hot, wet/dry seasons",
  },
  tropical_savanna: {
    id: "tropical_savanna",
    name: "Tropical Savanna",
    color: "#BDB76B",
    description: "Hot, dry grassland with scattered trees",
  },
  subtropical_desert: {
    id: "subtropical_desert",
    name: "Subtropical Desert",
    color: "#EDC9AF",
    description: "Hot, very dry",
  },
  temperate_grassland: {
    id: "temperate_grassland",
    name: "Temperate Grassland",
    color: "#9ACD32",
    description: "Moderate temp, moderate precipitation",
  },
  temperate_deciduous_forest: {
    id: "temperate_deciduous_forest",
    name: "Temperate Deciduous Forest",
    color: "#2E8B57",
    description: "Moderate, seasonal leaf drop",
  },
  temperate_rainforest: {
    id: "temperate_rainforest",
    name: "Temperate Rainforest",
    color: "#006B3C",
    description: "Cool, very wet",
  },
  mediterranean: {
    id: "mediterranean",
    name: "Mediterranean",
    color: "#CC7722",
    description: "Hot dry summer, mild wet winter",
  },
  boreal_forest: {
    id: "boreal_forest",
    name: "Boreal Forest (Taiga)",
    color: "#355E3B",
    description: "Cold, moderate precipitation",
  },
  tundra: {
    id: "tundra",
    name: "Tundra",
    color: "#A8B8C8",
    description: "Very cold, low precipitation",
  },
  alpine: { id: "alpine", name: "Alpine", color: "#8B7D6B", description: "High elevation, cold" },
  mangrove: {
    id: "mangrove",
    name: "Mangrove",
    color: "#4A7C59",
    description: "Tropical coastal wetland",
  },
  wetland: { id: "wetland", name: "Wetland", color: "#4682B4", description: "Saturated lowland" },
  steppe: { id: "steppe", name: "Steppe", color: "#C2B280", description: "Semi-arid grassland" },
  ice_sheet: {
    id: "ice_sheet",
    name: "Ice Sheet",
    color: "#F0F8FF",
    description: "Permanent ice cover",
  },
};

// ──────────────────────────────────────────────
// Biome Metadata (from Azgaar's Fantasy Map Generator)
// ──────────────────────────────────────────────

/** Habitability score per biome (0-100). Higher = more suitable for settlement. */
export const BIOME_HABITABILITY: Record<BiomeType, number> = {
  tropical_rainforest: 80,
  tropical_seasonal_forest: 50,
  tropical_savanna: 22,
  subtropical_desert: 4,
  temperate_grassland: 30,
  temperate_deciduous_forest: 100,
  temperate_rainforest: 90,
  mediterranean: 60,
  boreal_forest: 12,
  tundra: 4,
  alpine: 2,
  mangrove: 8,
  wetland: 12,
  steppe: 15,
  ice_sheet: 0,
};

/** Movement cost per biome for trade route pathfinding. Lower = easier to traverse. */
export const BIOME_MOVEMENT_COST: Record<BiomeType, number> = {
  tropical_rainforest: 90,
  tropical_seasonal_forest: 70,
  tropical_savanna: 60,
  subtropical_desert: 200,
  temperate_grassland: 50,
  temperate_deciduous_forest: 70,
  temperate_rainforest: 80,
  mediterranean: 60,
  boreal_forest: 200,
  tundra: 1000,
  alpine: 5000,
  mangrove: 150,
  wetland: 150,
  steppe: 50,
  ice_sheet: 5000,
};

// ──────────────────────────────────────────────
// Classification
// ──────────────────────────────────────────────

/**
 * Classify a single cell into a biome based on temperature (°C),
 * precipitation (cm/year, normalized 0-1), and elevation (normalized 0-1).
 *
 * Uses piecewise boundaries inspired by the Whittaker diagram.
 */
export function classifyBiome(
  tempC: number,
  precipNorm: number,
  elevNorm: number,
  coastalDistance: number = 1 // 0 = at coast, 1 = deep inland
): BiomeType {
  // Convert normalized precipitation to approximate cm/year (0-450 range)
  const precipCm = precipNorm * 450;

  // High elevation override
  if (elevNorm > 0.65) return "alpine";

  // Ice sheet: very cold
  if (tempC < -10) return "ice_sheet";

  // Tundra: cold
  if (tempC < -2) return "tundra";

  // Boreal: cold with some precipitation
  if (tempC < 5) {
    return precipCm > 50 ? "boreal_forest" : "tundra";
  }

  // Temperate zone (5-18°C)
  if (tempC < 18) {
    // Very wet temperate coast
    if (precipCm > 250 && coastalDistance < 0.4) return "temperate_rainforest";

    // Mediterranean: moderate temp, dry (low precip)
    if (precipCm < 80 && tempC > 12) return "mediterranean";

    // Steppe: semi-arid
    if (precipCm < 50) return "steppe";

    // Temperate grassland: moderate precip
    if (precipCm < 120) return "temperate_grassland";

    // Deciduous forest: good precip
    return "temperate_deciduous_forest";
  }

  // Subtropical/Tropical zone (>18°C)
  // Desert: very dry
  if (precipCm < 25) return "subtropical_desert";

  // Steppe transition
  if (precipCm < 50) return "steppe";

  // Savanna: moderate precipitation in tropics
  if (precipCm < 130) return "tropical_savanna";

  // Mangrove: tropical coastal + wet
  if (coastalDistance < 0.15 && tempC > 22 && precipCm > 150) return "mangrove";

  // Wetland: low elevation, very wet
  if (elevNorm < 0.05 && precipCm > 200) return "wetland";

  // Seasonal forest: moderate-high precip
  if (precipCm < 250) return "tropical_seasonal_forest";

  // Rainforest: very wet tropics
  return "tropical_rainforest";
}

// ──────────────────────────────────────────────
// Grid Classification
// ──────────────────────────────────────────────

export interface BiomeGrid {
  /** Biome index per cell (index into BIOME_TYPES) */
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * Classify an entire grid of cells into biomes.
 */
export function classifyBiomeGrid(
  tempGrid: Float32Array,
  precipGrid: Float32Array,
  heightmap: HeightmapResult,
  width: number,
  height: number
): BiomeGrid {
  const data = new Uint8Array(width * height);
  const seaLevel = heightmap.seaLevel;

  // Precompute coastal distance via BFS from ocean cells
  const coastDist = computeCoastalDistance(heightmap.data, seaLevel, width, height);

  for (let i = 0; i < width * height; i++) {
    const elev = heightmap.data[i]!;

    // Skip ocean cells
    if (elev <= seaLevel) {
      data[i] = 255; // ocean marker
      continue;
    }

    const elevNorm = Math.max(0, (elev - seaLevel) / (1 - seaLevel));
    const biome = classifyBiome(
      tempGrid[i]!,
      precipGrid[i]!,
      elevNorm,
      coastDist[i]! / 50 // Normalize: 50 cells ≈ "deep inland"
    );

    data[i] = BIOME_TYPES.indexOf(biome);
  }

  return { data, width, height };
}

/**
 * BFS to compute distance from coast (ocean/land boundary) for each land cell.
 * Exported for reuse by population-generator, culture-generator, etc.
 */
export function computeCoastalDistance(
  heightData: Float32Array,
  seaLevel: number,
  width: number,
  height: number
): Float32Array {
  const dist = new Float32Array(width * height).fill(Infinity);
  const queue: number[] = [];

  // Seed: land cells adjacent to ocean
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (heightData[idx]! <= seaLevel) continue; // ocean

      // Check neighbors for ocean
      let coastal = false;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (heightData[ny * width + nx]! <= seaLevel) {
          coastal = true;
          break;
        }
      }

      if (coastal) {
        dist[idx] = 0;
        queue.push(idx);
      }
    }
  }

  // BFS expansion
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++]!;
    const x = idx % width;
    const y = Math.floor(idx / width);
    const d = dist[idx]!;

    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nidx = ny * width + nx;
      if (heightData[nidx]! <= seaLevel) continue; // ocean
      if (dist[nidx]! <= d + 1) continue; // already closer
      dist[nidx] = d + 1;
      queue.push(nidx);
    }
  }

  return dist;
}

// ──────────────────────────────────────────────
// GeoJSON Extraction
// ──────────────────────────────────────────────

/**
 * Extract biome zones as GeoJSON polygons using sector-based sampling.
 * Groups adjacent cells of the same biome into rectangular blocks.
 */
export function extractBiomeFeatures(
  biomeGrid: BiomeGrid,
  heightmap: HeightmapResult,
  maxFeatures: number = 2000
): FeatureCollection {
  const { data, width, height } = biomeGrid;
  const features: Feature[] = [];

  // Sector-based extraction: divide grid into sectors and emit one feature per biome per sector
  const sectorsX = Math.ceil(width / 16);
  const sectorsY = Math.ceil(height / 16);

  for (let sy = 0; sy < sectorsY; sy++) {
    for (let sx = 0; sx < sectorsX; sx++) {
      const xMin = sx * 16;
      const yMin = sy * 16;
      const xMax = Math.min(xMin + 16, width);
      const yMax = Math.min(yMin + 16, height);

      // Count biomes in this sector
      const biomeCounts = new Map<number, number>();
      for (let y = yMin; y < yMax; y++) {
        for (let x = xMin; x < xMax; x++) {
          const b = data[y * width + x]!;
          if (b === 255) continue; // ocean
          biomeCounts.set(b, (biomeCounts.get(b) ?? 0) + 1);
        }
      }

      // Emit the dominant biome as a polygon covering the sector
      if (biomeCounts.size === 0) continue;

      let dominant = 0;
      let maxCount = 0;
      for (const [biome, count] of biomeCounts) {
        if (count > maxCount) {
          dominant = biome;
          maxCount = count;
        }
      }

      const biomeType = BIOME_TYPES[dominant];
      if (!biomeType) continue;
      const config = BIOME_CONFIGS[biomeType];

      // Convert sector bounds to WGS84
      const lngMin = -180 + (xMin / width) * 360;
      const lngMax = -180 + (xMax / width) * 360;
      const latMin = -90 + (yMin / height) * 180;
      const latMax = -90 + (yMax / height) * 180;

      const ring: Position[] = [
        [lngMin, latMin],
        [lngMax, latMin],
        [lngMax, latMax],
        [lngMin, latMax],
        [lngMin, latMin],
      ];

      features.push({
        type: "Feature",
        id: `biome-${sx}-${sy}`,
        geometry: { type: "Polygon", coordinates: [ring] } as Polygon,
        properties: {
          featureId: `biome-${sx}-${sy}`,
          biomeType: biomeType,
          biomeName: config.name,
          fill: config.color,
          description: config.description,
        },
      });

      if (features.length >= maxFeatures) break;
    }
    if (features.length >= maxFeatures) break;
  }

  return { type: "FeatureCollection", features };
}
