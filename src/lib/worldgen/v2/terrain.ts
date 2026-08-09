/**
 * UPG v2 — Terrain Elevation Generation
 *
 * Generates continuous float elevation (in meters) combining:
 * 1. Base elevation from plate type (continental vs oceanic)
 * 2. Tectonic boundary effects (convergent mountain uplift, rift valley depression, subduction arcs)
 * 3. Multi-octave fractal noise overlay (seed-driven, non-axis-aligned)
 * 4. Continental shelf transition
 * 5. Target ocean percentage normalization
 * 6. Assignment of elevation zones (0-8) and isLand boolean
 */

import type { WorldGraph, WorldGenParams } from "./types";
import { TECTONIC_CONSTANTS, getElevationZone } from "./config";
import { makeRng } from "./helpers/rng";
import { buildNoiseConfig, fractalNoise, ridgedNoise } from "./helpers/noise";
import { cellLng, cellLat } from "./mesh";
import { classifyCellBoundary } from "./tectonics";

/**
 * Generate elevation in meters for every cell based on tectonics and noise.
 * Mutates graph.cells.h, graph.cells.isLand, graph.cells.elevZone, and graph.cells.isMountainRidge in-place.
 */
export function generateTerrain(graph: WorldGraph, params: WorldGenParams): void {
  const rng = makeRng(params.seed + 20);
  const { cells, plates } = graph;
  const n = cells.n;

  // Float array for raw unnormalized elevation accumulation
  const rawH = new Float64Array(n);

  // Build 4-octave noise configs for continental shape, tectonic detail, hills, and micro-relief
  const noiseMacro = buildNoiseConfig(params.seed + 21, 3, 0.015, 2.0, 0.5);
  const noiseRidge = buildNoiseConfig(params.seed + 22, 4, 0.03, 2.2, 0.55);
  const noiseHills = buildNoiseConfig(params.seed + 23, 4, 0.08, 2.0, 0.45);

  const roughness = params.terrainRoughness ?? 0.5;

  // Step 1: Base elevation per cell from plate type + multi-octave noise
  for (let i = 0; i < n; i++) {
    const pId = cells.plate[i]!;
    const plate = plates[pId - 1];
    const isContinental = plate ? plate.type === "continental" : false;

    const baseElev = isContinental
      ? TECTONIC_CONSTANTS.continentalBaseElevation
      : TECTONIC_CONSTANTS.oceanicBaseElevation;

    const lng = cellLng(graph, i);
    const lat = cellLat(graph, i);
    const absLat = Math.abs(lat);

    // Polar soft dampening: smooths high-latitude noise to prevent polar projection distortion
    let polarFactor = 1.0;
    if (absLat > 70) {
      polarFactor = Math.max(0, Math.cos(((absLat - 70) / 18) * (Math.PI / 2)));
    }

    // Continental shape noise scaled by polarFactor
    const macroVal = fractalNoise(lng, lat, noiseMacro);
    const hillsVal = fractalNoise(lng, lat, noiseHills) * roughness;

    // Oceanic vs continental noise scaling
    const noiseBonus = isContinental
      ? (macroVal * 600 + hillsVal * 400) * polarFactor
      : (macroVal * 800 + hillsVal * 300) * polarFactor;

    let elev = baseElev + noiseBonus;

    // South Pole Soft Clamp (Antarctica polar plateau: stable +800m landmass)
    if (lat < -74) {
      const southWeight = Math.min(1.0, (-74 - lat) / 14);
      elev = elev * (1 - southWeight) + 800 * southWeight;
    }

    // North Pole Soft Clamp (Arctic Ocean Basin: stable -1500m sea basin)
    if (lat > 76) {
      const northWeight = Math.min(1.0, (lat - 76) / 12);
      elev = elev * (1 - northWeight) + -1500 * northWeight;
    }

    rawH[i] = elev;
  }

  // Step 2: Tectonic boundary uplift and depression
  cells.isMountainRidge.fill(0);

  // Identify all boundary cells and compute local boundary uplift
  for (let i = 0; i < n; i++) {
    const distToBoundary = cells.plateDist[i]!;
    // Only apply boundary effects within tectonic belt width
    if (distToBoundary > TECTONIC_CONSTANTS.convergentBeltWidth) continue;

    // Find nearest neighbor across plate boundary to classify boundary type
    let boundaryType: "convergent" | "divergent" | "transform" | null = null;
    let closestNb = -1;
    for (const nb of cells.neighbors[i]!) {
      if (cells.plate[nb]! !== cells.plate[i]!) {
        const bType = classifyCellBoundary(graph, i, nb);
        if (bType === "convergent" || !boundaryType) {
          boundaryType = bType;
          closestNb = nb;
        }
      }
    }

    if (!boundaryType) continue;

    const lng = cellLng(graph, i);
    const lat = cellLat(graph, i);
    const distFactor = 1 - distToBoundary / TECTONIC_CONSTANTS.convergentBeltWidth;

    if (boundaryType === "convergent") {
      // Convergent: mountain ridge uplift with ridged noise
      const ridgeDetail = ridgedNoise(lng, lat, noiseRidge);
      const uplift =
        TECTONIC_CONSTANTS.convergentUpliftMax * distFactor * (0.6 + 0.4 * ridgeDetail);

      rawH[i] += uplift;

      // Mark cell as mountain ridge if uplift is high
      if (distToBoundary <= 3 && uplift > 1500) {
        cells.isMountainRidge[i] = 1;
      }
    } else if (boundaryType === "divergent") {
      // Divergent: rift valley on land, mid-ocean ridge in ocean
      const isLandBase = rawH[i]! > 0;
      if (isLandBase) {
        rawH[i] += TECTONIC_CONSTANTS.divergentDepressionDepth * distFactor;
      } else {
        rawH[i] += TECTONIC_CONSTANTS.midOceanRidgeHeight * distFactor;
      }
    } else if (boundaryType === "transform") {
      // Transform: moderate localized hills/fault line
      const faultVal = ridgedNoise(lng * 2, lat * 2, noiseRidge) * 300;
      rawH[i] += faultVal * distFactor;
    }
  }

  // Step 3: Subduction arc islands (oceanic plate near continental plate)
  for (let i = 0; i < n; i++) {
    const pId = cells.plate[i]!;
    const plate = plates[pId - 1];
    if (!plate || plate.type !== "oceanic") continue;

    // Check if cell is 3-6 steps away from a continental plate boundary
    const dist = cells.plateDist[i]!;
    if (dist >= 3 && dist <= TECTONIC_CONSTANTS.subductionArcOffset + 2) {
      let nearContinental = false;
      for (const nb of cells.neighbors[i]!) {
        const nbPlate = plates[cells.plate[nb]! - 1];
        if (nbPlate && nbPlate.type === "continental") {
          nearContinental = true;
          break;
        }
      }
      if (nearContinental) {
        // Create island arc chain boost
        const lng = cellLng(graph, i);
        const lat = cellLat(graph, i);
        const arcNoise = ridgedNoise(lng * 3, lat * 3, noiseRidge);
        if (arcNoise > 0.55) {
          rawH[i] += 2500 * arcNoise;
        }
      }
    }
  }

  // Step 3.5: Spatial Heightmap Laplacian Smoothing
  // Diffuses sharp 1-cell peak spikes into continuous, realistic mountain ranges
  for (let pass = 0; pass < 2; pass++) {
    const smoothed = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const nbs = cells.neighbors[i]!;
      if (nbs.length === 0) {
        smoothed[i] = rawH[i]!;
        continue;
      }
      let sum = 0;
      for (const nb of nbs) {
        sum += rawH[nb]!;
      }
      const avg = sum / nbs.length;
      smoothed[i] = rawH[i]! * 0.5 + avg * 0.5;
    }
    rawH.set(smoothed);
  }

  // Step 4: Normalize elevation distribution to match target oceanPercentage
  const targetOceanFrac = params.oceanPercentage ?? 0.65;
  normalizeElevationToOceanTarget(graph, rawH, targetOceanFrac, rng);

  // Step 5: Assign elevation zones and isLand
  for (let i = 0; i < n; i++) {
    const hMeters = cells.h[i]!;
    const isLand = hMeters >= 0;
    cells.isLand[i] = isLand ? 1 : 0;
    cells.elevZone[i] = isLand ? getElevationZone(hMeters) : 0;
  }
}

/**
 * Normalize heightmap values so the land/ocean boundary sits at 0m,
 * with land values scaled realistically (0..8000m) and ocean (-6000..0m).
 */
function normalizeElevationToOceanTarget(
  graph: WorldGraph,
  rawH: Float64Array,
  oceanFraction: number,
  _rng: () => number
): void {
  const { cells } = graph;
  const n = cells.n;

  // Sort values to find the ocean/land cutoff percentile
  const sorted = Array.from(rawH).sort((a, b) => a - b);
  const cutoffIndex = Math.min(n - 1, Math.max(0, Math.floor(n * oceanFraction)));
  const seaLevelCutoff = sorted[cutoffIndex] ?? 0;

  // Find max land value and min ocean value for scaling
  const maxRawLand = sorted[n - 1] ?? seaLevelCutoff + 1000;
  const minRawOcean = sorted[0] ?? seaLevelCutoff - 3000;

  const landRange = Math.max(1, maxRawLand - seaLevelCutoff);
  const oceanRange = Math.max(1, seaLevelCutoff - minRawOcean);

  for (let i = 0; i < n; i++) {
    const raw = rawH[i]!;
    if (raw < seaLevelCutoff) {
      // Ocean cell: map to [-6000m, -1m] with smooth shelf gradient
      const normOceanFrac = (seaLevelCutoff - raw) / oceanRange; // 0..1 (0 = shallow, 1 = deep)
      // Quadratic curve favoring shallow coastal shelf then dropping into deep basin
      const depthMeters = -1 - Math.pow(normOceanFrac, 1.2) * 5999;
      cells.h[i] = depthMeters;
    } else {
      // Land cell: map to [0m, 8500m] with realistic hypsometric curve
      const normLandFrac = (raw - seaLevelCutoff) / landRange; // 0..1 (0 = coast, 1 = highest peak)
      // Curved power function: 75% of land is lowlands/hills (<1000m), peaks reach 6000m+
      const heightMeters = Math.pow(normLandFrac, 1.4) * 8500;
      cells.h[i] = heightMeters;
    }
  }
}
