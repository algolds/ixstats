/**
 * Population Generator — Habitability-based population distribution
 *
 * Scores each land cell for habitability based on temperature, precipitation,
 * elevation, and proximity to rivers/coast. Places cities at local maxima
 * and distributes population proportional to habitability.
 *
 * Output: population density grid, city positions, per-country population
 */

import type { HeightmapResult } from "./landmass-generator";
import type { Feature, FeatureCollection, Point } from "geojson";
import { makeRng } from "./rng";
import { type BiomeGrid, BIOME_TYPES, BIOME_HABITABILITY } from "./biomes";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type SettlementTier = "capital" | "major_city" | "town" | "village";

export interface City {
  id: string;
  name: string;
  x: number;
  y: number;
  lng: number;
  lat: number;
  population: number;
  isCapital: boolean;
  tier: SettlementTier;
  isPort: boolean;
  countryIdx: number;
}

export interface PopulationGrid {
  /** Habitability score per cell [0-1] */
  habitability: Float32Array;
  /** Population density per cell (people per cell) */
  density: Float32Array;
  width: number;
  height: number;
}

export interface PopulationResult {
  grid: PopulationGrid;
  cities: City[];
  /** Per-country total population: countryIdx -> population */
  countryPopulations: Map<number, number>;
  /** Per-country capital index */
  countryCapitals: Map<number, number>;
  featureCollection: FeatureCollection;
}

export interface PopulationGenParams {
  seed: number;
  heightmap: HeightmapResult;
  /** Temperature grid in °C */
  tempGrid?: Float32Array;
  /** Precipitation grid normalized [0-1] */
  precipGrid?: Float32Array;
  /** Country assignment per cell (-1 = unassigned/ocean) */
  countryGrid?: Int32Array;
  countryCount?: number;
  /** Total world population (default: auto from country count) */
  totalPopulation?: number;
  /** Max cities per country (default: 5) */
  maxCitiesPerCountry?: number;
  /** City name generator function */
  cityNameGen?: (countryIdx: number, isCapital: boolean) => string;
  /** River cell indices for actual river distance computation */
  riverCells?: Set<number>;
  /** Biome grid for biome-aware habitability scoring */
  biomeGrid?: BiomeGrid;
}

// ──────────────────────────────────────────────
// Habitability
// ──────────────────────────────────────────────

/**
 * Compute habitability score for a single cell.
 * Score in [0, 1] where 1 = ideal for human settlement.
 */
function cellHabitability(
  elevNorm: number,
  tempC: number,
  precipNorm: number,
  coastDist: number,
  riverDist: number
): number {
  // Temperature factor: peaks at 15-20°C, drops at extremes
  let tempScore: number;
  if (tempC < -10) tempScore = 0;
  else if (tempC < 0) tempScore = 0.1 + (tempC + 10) * 0.04;
  else if (tempC < 15) tempScore = 0.5 + (tempC / 15) * 0.5;
  else if (tempC <= 25) tempScore = 1.0;
  else if (tempC <= 35) tempScore = 1.0 - (tempC - 25) * 0.05;
  else tempScore = 0.3;

  // Precipitation factor: moderate is best
  let precipScore: number;
  if (precipNorm < 0.05)
    precipScore = 0.1; // desert
  else if (precipNorm < 0.2) precipScore = 0.3 + precipNorm * 3;
  else if (precipNorm <= 0.6) precipScore = 1.0;
  else precipScore = 1.0 - (precipNorm - 0.6) * 0.5; // too wet

  // Elevation factor: lowlands are preferred
  let elevScore: number;
  if (elevNorm < 0.1) elevScore = 1.0;
  else if (elevNorm < 0.3) elevScore = 0.8;
  else if (elevNorm < 0.5) elevScore = 0.5;
  else elevScore = 0.2;

  // River proximity bonus
  const riverBonus = riverDist < 3 ? 0.3 : riverDist < 8 ? 0.15 : 0;

  // Coastal bonus (trade access)
  const coastBonus = coastDist < 5 ? 0.2 : coastDist < 15 ? 0.1 : 0;

  return Math.min(
    1,
    tempScore * 0.3 + precipScore * 0.25 + elevScore * 0.25 + riverBonus + coastBonus
  );
}

// ──────────────────────────────────────────────
// Generation
// ──────────────────────────────────────────────

export function generatePopulation(params: PopulationGenParams): PopulationResult {
  const { seed, heightmap } = params;
  const rng = makeRng(seed);
  const { width, height, data: elevData, seaLevel } = heightmap;
  const cellCount = width * height;

  // Default grids: mid-temperature, mid-precipitation if not provided
  const tempGrid = params.tempGrid ?? new Float32Array(cellCount).fill(15);
  const precipGrid = params.precipGrid ?? new Float32Array(cellCount).fill(0.4);

  // Compute coastal distance
  const coastDist = computeBfsDistance(elevData, seaLevel, width, height, true);

  // Compute actual river distance if river cells provided, else fallback to coast distance
  let riverDist: Float32Array;
  if (params.riverCells && params.riverCells.size > 0) {
    riverDist = new Float32Array(cellCount).fill(999);
    const rQueue: number[] = [];
    for (const rc of params.riverCells) {
      if (rc < cellCount && elevData[rc]! > seaLevel) {
        riverDist[rc] = 0;
        rQueue.push(rc);
      }
    }
    let rHead = 0;
    while (rHead < rQueue.length) {
      const ri = rQueue[rHead++]!;
      const rx = ri % width;
      const ry = Math.floor(ri / width);
      const rd = riverDist[ri]!;
      for (const [ddx, ddy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const rnx = rx + ddx;
        const rny = ry + ddy;
        if (rnx < 0 || rnx >= width || rny < 0 || rny >= height) continue;
        const rnidx = rny * width + rnx;
        if (elevData[rnidx]! <= seaLevel) continue;
        if (riverDist[rnidx]! <= rd + 1) continue;
        riverDist[rnidx] = rd + 1;
        rQueue.push(rnidx);
      }
    }
  } else {
    riverDist = coastDist; // Fallback
  }

  // Step 1: Compute habitability grid
  const habitability = new Float32Array(cellCount);
  let totalHab = 0;

  for (let i = 0; i < cellCount; i++) {
    const elev = elevData[i]!;
    if (elev <= seaLevel) {
      habitability[i] = 0;
      continue;
    }
    const elevNorm = (elev - seaLevel) / (1 - seaLevel);
    // Use biome habitability if available, otherwise fall back to piecewise formula
    let h: number;
    if (params.biomeGrid && params.biomeGrid.data[i] !== 255) {
      const biomeIdx = params.biomeGrid.data[i]!;
      const biomeType = BIOME_TYPES[biomeIdx];
      const biomeHab = biomeType ? BIOME_HABITABILITY[biomeType] / 100 : 0.5;
      // Blend biome habitability with river/coast bonuses
      const riverBonus = riverDist[i]! < 3 ? 0.25 : riverDist[i]! < 8 ? 0.12 : 0;
      const coastBonus = coastDist[i]! < 5 ? 0.15 : coastDist[i]! < 15 ? 0.08 : 0;
      h = Math.min(1, biomeHab + riverBonus + coastBonus);
    } else {
      h = cellHabitability(elevNorm, tempGrid[i]!, precipGrid[i]!, coastDist[i]!, riverDist[i]!);
    }
    habitability[i] = h;
    totalHab += h;
  }

  // Step 2: Distribute population
  const totalPop =
    params.totalPopulation ?? Math.max(1_000_000, (params.countryCount ?? 30) * 5_000_000);

  const density = new Float32Array(cellCount);
  if (totalHab > 0) {
    const popPerHab = totalPop / totalHab;
    for (let i = 0; i < cellCount; i++) {
      density[i] = habitability[i]! * popPerHab;
    }
  }

  // Step 3: Place cities at local habitability maxima
  const cities: City[] = [];
  const maxCitiesPerCountry = params.maxCitiesPerCountry ?? 5;
  const countryPopulations = new Map<number, number>();
  const countryCapitals = new Map<number, number>();
  const countryCityCount = new Map<number, number>();

  // Aggregate per-country population first
  if (params.countryGrid) {
    for (let i = 0; i < cellCount; i++) {
      const cid = params.countryGrid[i]!;
      if (cid < 0) continue;
      countryPopulations.set(cid, (countryPopulations.get(cid) ?? 0) + density[i]!);
    }
  }

  // Find local maxima for city placement (scan with a window)
  const windowSize = Math.max(4, Math.floor(width / 40));
  const candidates: Array<{ idx: number; hab: number; x: number; y: number }> = [];

  for (let y = windowSize; y < height - windowSize; y += windowSize) {
    for (let x = windowSize; x < width - windowSize; x += windowSize) {
      // Find the max habitability cell in this window
      let bestIdx = -1;
      let bestHab = 0;
      for (let dy = 0; dy < windowSize; dy++) {
        for (let dx = 0; dx < windowSize; dx++) {
          const idx = (y + dy) * width + (x + dx);
          if (habitability[idx]! > bestHab) {
            bestHab = habitability[idx]!;
            bestIdx = idx;
          }
        }
      }
      if (bestIdx >= 0 && bestHab > 0.3) {
        candidates.push({
          idx: bestIdx,
          hab: bestHab,
          x: bestIdx % width,
          y: Math.floor(bestIdx / width),
        });
      }
    }
  }

  // Sort by habitability descending
  candidates.sort((a, b) => b.hab - a.hab);

  // Minimum distance between cities
  const minCityDist = Math.max(6, Math.floor(width / 30));

  for (const cand of candidates) {
    // Check country assignment
    const countryIdx = params.countryGrid ? params.countryGrid[cand.idx]! : -1;
    if (countryIdx < 0) continue;

    // Check city limit per country
    const currentCount = countryCityCount.get(countryIdx) ?? 0;
    if (currentCount >= maxCitiesPerCountry) continue;

    // Check minimum distance from existing cities
    let tooClose = false;
    for (const city of cities) {
      const dx = cand.x - city.x;
      const dy = cand.y - city.y;
      if (dx * dx + dy * dy < minCityDist * minCityDist) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const isCapital = !countryCapitals.has(countryIdx);
    let lng = -180 + (cand.x / width) * 360;
    let lat = -90 + (cand.y / height) * 180;

    // Settlement tier based on position in country
    const tier: SettlementTier = isCapital
      ? "capital"
      : currentCount < 2
        ? "major_city"
        : currentCount < 4
          ? "town"
          : "village";

    // Population scaling by tier (Azgaar-inspired)
    const tierMultiplier =
      tier === "capital" ? 100 : tier === "major_city" ? 50 : tier === "town" ? 20 : 5;
    const cityPop = Math.round(density[cand.idx]! * tierMultiplier * (0.8 + rng() * 0.4));

    // Port detection (Azgaar pattern: safe harbor = exactly 1 adjacent water cell)
    let isPort = false;
    let waterCount = 0;
    let waterCellIdx = -1;
    for (const [ddx, ddy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const wnx = cand.x + ddx;
      const wny = cand.y + ddy;
      if (wnx >= 0 && wnx < width && wny >= 0 && wny < height) {
        if (elevData[wny * width + wnx]! <= seaLevel) {
          waterCount++;
          waterCellIdx = wny * width + wnx;
        }
      }
    }
    if (waterCount === 1 && waterCellIdx >= 0) {
      isPort = true;
      // Shift port coordinates 95% toward water edge
      const wx = waterCellIdx % width;
      const wy = Math.floor(waterCellIdx / width);
      const wLng = -180 + (wx / width) * 360;
      const wLat = -90 + (wy / height) * 180;
      lng = lng + (wLng - lng) * 0.95;
      lat = lat + (wLat - lat) * 0.95;
    }

    const name = params.cityNameGen
      ? params.cityNameGen(countryIdx, isCapital)
      : isCapital
        ? `Capital ${countryIdx}`
        : `City ${cities.length}`;

    cities.push({
      id: `city-${cities.length}`,
      name,
      x: cand.x,
      y: cand.y,
      lng,
      lat,
      population: Math.max(1000, cityPop),
      isCapital,
      tier,
      isPort,
      countryIdx,
    });

    if (isCapital) countryCapitals.set(countryIdx, cities.length - 1);
    countryCityCount.set(countryIdx, currentCount + 1);
  }

  // Build GeoJSON for cities
  const features: Feature[] = cities.map((city) => ({
    type: "Feature" as const,
    id: city.id,
    geometry: {
      type: "Point" as const,
      coordinates: [city.lng, city.lat],
    } as Point,
    properties: {
      featureId: city.id,
      name: city.name,
      population: city.population,
      isCapital: city.isCapital,
      countryIdx: city.countryIdx,
      type: city.isCapital ? "capital" : "city",
    },
  }));

  return {
    grid: { habitability, density, width, height },
    cities,
    countryPopulations,
    countryCapitals,
    featureCollection: { type: "FeatureCollection", features },
  };
}

// ──────────────────────────────────────────────
// BFS Distance
// ──────────────────────────────────────────────

function computeBfsDistance(
  elevData: Float32Array,
  seaLevel: number,
  width: number,
  height: number,
  fromOcean: boolean
): Float32Array {
  const dist = new Float32Array(width * height).fill(999);
  const queue: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const isOcean = elevData[idx]! <= seaLevel;

      if (fromOcean && isOcean) {
        // Check if adjacent to land
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (elevData[ny * width + nx]! > seaLevel) {
              dist[idx] = 0;
              queue.push(idx);
              break;
            }
          }
        }
      }
    }
  }

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
      if (dist[nidx]! <= d + 1) continue;
      if (elevData[nidx]! <= seaLevel) continue;
      dist[nidx] = d + 1;
      queue.push(nidx);
    }
  }

  return dist;
}
