/**
 * UPG v2 — Coastline Refinement & Geographic Feature Classification
 *
 * Refines coastline geometry to produce organic, detailed landmasses:
 * 1. Peninsula generation (probabilistic coastal extensions)
 * 2. Fjord carving (high-latitude glacial coastal inlets)
 * 3. Archipelago scattering (island clusters near subduction zones)
 * 4. Bay formation (coastal erosion concavities)
 * 5. Minimum landmass filter (sinks tiny <5 cell noise slivers)
 * 6. Geographic feature classification (ocean, continent, lake, island)
 * 7. Coastal distance update
 */

import type { WorldGraph, WorldGenParams, GeographicFeature } from "./types";
import { makeRng } from "./helpers/rng";
import { cellLat, cellLng, cellAreaKm2 } from "./mesh";
import { buildNoiseConfig, fractalNoise } from "./helpers/noise";
import { computeCoastalDistance } from "./helpers/flood-fill";
import { getElevationZone } from "./config";

/**
 * Refine coastline features and classify all cells into geographic features.
 * Mutates graph.cells and populates graph.features in-place.
 */
export function refineCoastlines(graph: WorldGraph, params: WorldGenParams): void {
  const rng = makeRng(params.seed + 30);
  const { cells } = graph;
  const n = cells.n;
  const complexity = params.coastlineComplexity ?? 0.6;

  // Refresh coastal distance for initial landmass
  computeCoastalDistance(graph);

  const noiseCoast = buildNoiseConfig(params.seed + 31, 3, 0.05, 2.0, 0.5);

  // Step 1: Fjords at high latitudes (|lat| > 50°) near mountain ridges
  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) continue;

    const lat = Math.abs(cellLat(graph, i));
    if (lat < 48) continue; // Fjords are high-latitude

    // Check if cell is coastal (coastDist <= 2) and near mountain ridge
    if (cells.coastDist[i]! <= 2 && cells.isMountainRidge[i]) {
      const lng = cellLng(graph, i);
      const val = fractalNoise(lng * 4, lat * 4, noiseCoast);

      // Carve fjord inlet by dropping elevation below sea level
      if (val > 0.45 * (1 - complexity * 0.3)) {
        cells.h[i] = -50;
        cells.isLand[i] = 0;
        cells.elevZone[i] = 0;
        cells.isMountainRidge[i] = 0;
      }
    }
  }

  // Step 2: Peninsulas & Bays — coastal noise perturbation
  for (let i = 0; i < n; i++) {
    const dist = cells.coastDist[i]!;
    const lng = cellLng(graph, i);
    const lat = cellLat(graph, i);

    const val = fractalNoise(lng * 2.5, lat * 2.5, noiseCoast);

    if (cells.isLand[i] && dist === 0) {
      // Coastal land cell: potential bay carving
      if (val < -0.6 * (1 - complexity * 0.4)) {
        cells.h[i] = -20;
        cells.isLand[i] = 0;
        cells.elevZone[i] = 0;
      }
    } else if (!cells.isLand[i]) {
      // Check if shallow ocean neighbor to land (potential peninsula extension)
      let adjacentLandCount = 0;
      for (const nb of cells.neighbors[i]!) {
        if (cells.isLand[nb]) adjacentLandCount++;
      }
      if (adjacentLandCount >= 2 && cells.h[i]! > -300) {
        if (val > 0.65 * (1 - complexity * 0.3)) {
          cells.h[i] = 40; // low coastal lowland
          cells.isLand[i] = 1;
          cells.elevZone[i] = getElevationZone(40);
        }
      }
    }
  }

  // Step 3: Re-compute coastal distance after peninsula/fjord edits
  computeCoastalDistance(graph);

  // Step 4: Geographic feature classification via flood-fill connected components
  classifyGeographicFeatures(graph);

  // Step 5: Minimum landmass filter (sink tiny < 5 cell islands)
  filterTinyLandmasses(graph);

  // Step 6: Smooth exponential coastal hypsometric slope damping (coastDist <= 8)
  // Prevents abrupt elevation step cutoffs near shorelines and eliminates single-cell mountain ribbons
  for (let i = 0; i < n; i++) {
    if (cells.isLand[i] && cells.coastDist[i]! <= 8) {
      const dist = cells.coastDist[i]!;
      const dampFactor = 1.0 - 0.85 * Math.exp(-0.35 * dist);
      cells.h[i] = cells.h[i]! * dampFactor;
      cells.elevZone[i] = getElevationZone(cells.h[i]!);
    }
  }

  // Step 6: Final feature classification & coastal distance update
  classifyGeographicFeatures(graph);
  computeCoastalDistance(graph);
}

/**
 * Classify connected components of water and land cells into features:
 * - Ocean basins (water touching boundary or area > 100 cells)
 * - Lakes (interior water body surrounded by land)
 * - Continents (landmass area >= 1000 cells)
 * - Islands (landmass area < 1000 cells)
 */
function classifyGeographicFeatures(graph: WorldGraph): void {
  const { cells } = graph;
  const n = cells.n;

  graph.features = [];
  cells.feature.fill(0);

  const visited = new Uint8Array(n);
  let featureId = 1; // 1-indexed

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;

    const isWater = !cells.isLand[i];
    const component: number[] = [];
    const queue: number[] = [i];
    visited[i] = 1;

    let touchesBoundary = false;

    while (queue.length > 0) {
      const cell = queue.pop()!;
      component.push(cell);

      if (cells.boundary[cell]) touchesBoundary = true;

      for (const nb of cells.neighbors[cell]!) {
        if (visited[nb]) continue;
        if (!cells.isLand[nb] !== isWater) continue; // must match water/land type

        visited[nb] = 1;
        queue.push(nb);
      }
    }

    // Determine feature type
    let type: GeographicFeature["type"];

    if (isWater) {
      // Water body: all non-land cells belong to ocean features (inland lakes generated on land in hydro pass)
      type = "ocean";
    } else {
      // Landmass: continent if >= 1000 cells (or >= 15% of total cells if low count), else island
      const continentThreshold = Math.min(1000, Math.floor(n * 0.05));
      type = component.length >= continentThreshold ? "continent" : "island";
    }

    // Compute total area in km²
    let areaKm2 = 0;
    for (const c of component) {
      areaKm2 += cellAreaKm2(graph, c);
    }

    const feature: GeographicFeature = {
      id: featureId,
      type,
      cellCount: component.length,
      areaKm2: Math.round(areaKm2),
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${featureId}`,
      border: touchesBoundary,
    };

    graph.features.push(feature);

    for (const c of component) {
      cells.feature[c] = featureId;
    }

    featureId++;
  }
}

/**
 * Filter out tiny disconnected land slivers (< 5 cells) by converting them to water.
 */
function filterTinyLandmasses(graph: WorldGraph): void {
  const { cells, features } = graph;
  const n = cells.n;

  const tinyFeatureIds = new Set<number>();
  for (const f of features) {
    if (f.type === "island" && f.cellCount < 5) {
      tinyFeatureIds.add(f.id);
    }
  }

  if (tinyFeatureIds.size === 0) return;

  for (let i = 0; i < n; i++) {
    if (tinyFeatureIds.has(cells.feature[i]!)) {
      cells.h[i] = -20;
      cells.isLand[i] = 0;
      cells.elevZone[i] = 0;
      cells.isMountainRidge[i] = 0;
    }
  }
}
