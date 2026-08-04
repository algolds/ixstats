/**
 * UPG v2 — Unified Hydrology & Climate Pass
 *
 * Executes the 8 cross-referencing sub-passes that compute hydrology and climate together:
 * 1. Base Temperature & Lapse Rate
 * 2. Coriolis Wind Patterns & Mountain Wind Shadows
 * 3. Ocean Current Gyres & Thermal Influence
 * 4. Precipitation, Orographic Rain Shadows & Aridity
 * 5. Priority-Queue Depression Filling & Downstream Flow Routing
 * 6. Water Flux Accumulation, River Network Detection & Tributary Tracing
 * 7. Topographic, Rift & Endorheic Lake Formation
 * 8. Trewartha Biome Classification (12 Biomes)
 */

import type { WorldGraph, WorldGenParams, RiverNetwork, Watershed } from "./types";
import { CLIMATE_CONSTANTS, TREWARTHA_BIOMES, getElevationZone } from "./config";
import { makeRng } from "./helpers/rng";
import { cellLat, cellLng, cellAreaKm2 } from "./mesh";

/**
 * Main entry point for the unified hydrology and climate pass.
 * Mutates graph.cells attributes and populates graph.rivers and graph.watersheds in-place.
 */
export function computeHydroClimate(
  graph: WorldGraph,
  params: WorldGenParams
): void {
  const rng = makeRng(params.seed + 40);
  const { cells } = graph;
  const n = cells.n;

  // ── Pass 1: Base Temperature & Altitude Lapse Rate ──
  computeTemperature(graph);

  // ── Pass 2: Wind Patterns (Coriolis) & Wind Shadows ──
  computeWindPatterns(graph);

  // ── Pass 3: Ocean Currents & Thermal Influence ──
  computeOceanCurrents(graph);

  // ── Pass 4: Precipitation, Orographic Rain Shadows & Aridity ──
  computePrecipitationAndRainShadows(graph);

  // ── Pass 5: Depression Filling & Downstream Routing ──
  const depressionDepths = fillDepressionsAndRouteFlow(graph);

  // Recalibrate elevation zones to match post-hydraulic filled heightmap
  for (let i = 0; i < n; i++) {
    const hMeters = cells.h[i]!;
    const isLand = hMeters >= 0;
    cells.isLand[i] = isLand ? 1 : 0;
    cells.elevZone[i] = isLand ? getElevationZone(hMeters) : 0;
  }

  // ── Pass 6: Flux Accumulation & River Network Detection ──
  if (params.hasRivers ?? true) {
    generateRiverNetworks(graph, params, rng);
  }

  // ── Pass 7: Lake Formation (Land Depressions & River Sinks) ──
  if (params.hasLakes ?? true) {
    generateLakes(graph, depressionDepths);
  }

  // ── Pass 8: Trewartha Biome Classification ──
  classifyBiomes(graph);
}

// ──────────────────────────────────────────────
// Pass 1: Temperature
// ──────────────────────────────────────────────

function computeTemperature(graph: WorldGraph): void {
  const { cells } = graph;
  const n = cells.n;

  for (let i = 0; i < n; i++) {
    const lat = Math.abs(cellLat(graph, i));
    const elevMeters = Math.max(0, cells.h[i]!);

    // Base temperature curve from equator (30°C) to pole (-30°C)
    const baseTemp =
      CLIMATE_CONSTANTS.equatorialTemp -
      CLIMATE_CONSTANTS.latitudeTempGradient * lat;

    // Thermodynamic lapse rate: -6.5°C per 1000m elevation
    const lapse = (elevMeters / 1000) * CLIMATE_CONSTANTS.lapseRatePerKm;

    cells.temp[i] = baseTemp - lapse;
  }

  // Ocean moderation: land cells near ocean have moderated temperature extremes
  const coastRange = CLIMATE_CONSTANTS.coastModerationRange;
  for (let i = 0; i < n; i++) {
    if (cells.isLand[i] && cells.coastDist[i]! <= coastRange) {
      const distFrac = cells.coastDist[i]! / coastRange;
      const modFactor = (1 - distFrac) * 0.4; // up to 40% moderation near coast
      // Pull toward 15°C mild maritime average
      cells.temp[i] = cells.temp[i]! * (1 - modFactor) + 15 * modFactor;
    }
  }
}

// ──────────────────────────────────────────────
// Pass 2: Wind Patterns (Coriolis)
// ──────────────────────────────────────────────

function computeWindPatterns(graph: WorldGraph): void {
  const { cells } = graph;
  const n = cells.n;

  for (let i = 0; i < n; i++) {
    const lat = cellLat(graph, i);
    const absLat = Math.abs(lat);

    let windAngleRad = 0; // 0 = East, π/2 = North, π = West, 3π/2 = South

    if (absLat < 30) {
      // Trade winds: East → West (angle ~ π)
      windAngleRad = Math.PI * 0.9 + (lat > 0 ? -0.1 : 0.1);
    } else if (absLat < 60) {
      // Westerlies: West → East (angle ~ 0)
      windAngleRad = Math.PI * 0.1 + (lat > 0 ? 0.1 : -0.1);
    } else {
      // Polar easterlies: East → West (angle ~ π)
      windAngleRad = Math.PI * 0.95;
    }

    cells.windDir[i] = windAngleRad;
    cells.windSpeed[i] = 1.0;
  }

  // Wind speed reduction behind mountain ridges (wind shadow)
  for (let i = 0; i < n; i++) {
    if (cells.isMountainRidge[i] || cells.h[i]! > 2000) {
      const windAngle = cells.windDir[i]!;
      // Find leeward downwind neighbor
      const windDx = Math.cos(windAngle);
      const windDy = Math.sin(windAngle);

      const lngI = cellLng(graph, i);
      const latI = cellLat(graph, i);

      for (const nb of cells.neighbors[i]!) {
        const dx = cellLng(graph, nb) - lngI;
        const dy = cellLat(graph, nb) - latI;
        // Dot product with wind direction vector
        const dot = dx * windDx + dy * windDy;
        if (dot > 0) {
          // Neighbor is downwind of mountain: reduce wind speed
          cells.windSpeed[nb] = Math.min(cells.windSpeed[nb]!, 0.35);
        }
      }
    }
  }
}

// ──────────────────────────────────────────────
// Pass 3: Ocean Currents
// ──────────────────────────────────────────────

function computeOceanCurrents(graph: WorldGraph): void {
  const { cells } = graph;
  const n = cells.n;
  cells.oceanCurrentInfluence.fill(0);

  // Western boundary of ocean basins (eastern coasts of continents) get warm currents (+5°C)
  // Eastern boundary of ocean basins (western coasts of continents) get cold currents (-3°C)
  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) continue;
    if (cells.coastDist[i]! > 3) continue;

    const lng = cellLng(graph, i);
    const lat = cellLat(graph, i);
    const absLat = Math.abs(lat);

    // Check if ocean is to the East or West of this coastal cell
    let oceanEast = false;
    let oceanWest = false;

    for (const nb of cells.neighbors[i]!) {
      if (!cells.isLand[nb]) {
        const nbLng = cellLng(graph, nb);
        if (nbLng > lng) oceanEast = true;
        if (nbLng < lng) oceanWest = true;
      }
    }

    if (absLat >= 15 && absLat <= 55) {
      if (oceanEast) {
        // Ocean to East = East coast of continent = Warm Western Boundary Current (e.g. Gulf Stream)
        cells.oceanCurrentInfluence[i] = CLIMATE_CONSTANTS.warmCurrentBoost;
        cells.temp[i] += CLIMATE_CONSTANTS.warmCurrentBoost;
      } else if (oceanWest) {
        // Ocean to West = West coast of continent = Cold Eastern Boundary Current (e.g. California Current)
        cells.oceanCurrentInfluence[i] = CLIMATE_CONSTANTS.coldCurrentReduction;
        cells.temp[i] += CLIMATE_CONSTANTS.coldCurrentReduction;
      }
    }
  }
}

// ──────────────────────────────────────────────
// Pass 4: Precipitation & Rain Shadows
// ──────────────────────────────────────────────

function computePrecipitationAndRainShadows(graph: WorldGraph): void {
  const { cells } = graph;
  const n = cells.n;

  for (let i = 0; i < n; i++) {
    const lat = Math.abs(cellLat(graph, i));

    // Base precipitation curve (mm/yr): high near equator (2000mm), low at poles (200mm), dip at subtropics 20-30° (500mm)
    let basePrec = 1000;
    if (lat < 15) basePrec = 2200;
    else if (lat < 35) basePrec = 500; // Subtropical dry belt
    else if (lat < 60) basePrec = 1200; // Temperate wet belt
    else basePrec = 250; // Polar dry belt

    // Continental interior drying (precipitation decreases inland)
    if (cells.isLand[i]) {
      const dist = cells.coastDist[i]!;
      const continentDrying = Math.max(0.2, 1.0 - dist * 0.04);
      basePrec *= continentDrying;
    }

    // Coastal moisture boost
    if (cells.isLand[i] && cells.coastDist[i]! <= 2) {
      basePrec *= 1.3;
    }

    // Warm current precipitation boost
    if (cells.oceanCurrentInfluence[i]! > 0) {
      basePrec *= 1.4;
    }

    cells.prec[i] = basePrec;
  }

  // Orographic lift & Rain shadow effect
  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) continue;

    const windAngle = cells.windDir[i]!;
    const windDx = Math.cos(windAngle);
    const windDy = Math.sin(windAngle);

    const lngI = cellLng(graph, i);
    const latI = cellLat(graph, i);

    // Check neighbors upwind vs downwind
    let maxUpwindElevDiff = 0;
    let maxDownwindElevDiff = 0;

    for (const nb of cells.neighbors[i]!) {
      if (!cells.isLand[nb]) continue;
      const dx = cellLng(graph, nb) - lngI;
      const dy = cellLat(graph, nb) - latI;
      const dot = dx * windDx + dy * windDy;

      const elevDiff = cells.h[i]! - cells.h[nb]!;

      if (dot < 0 && elevDiff > 500) {
        // nb is UPWIND and LOWER than cell i → windward slope → Orographic Lift
        maxUpwindElevDiff = Math.max(maxUpwindElevDiff, elevDiff);
      } else if (dot > 0 && elevDiff < -500) {
        // nb is DOWNWIND of higher cell → leeward side → Rain Shadow
        maxDownwindElevDiff = Math.max(maxDownwindElevDiff, Math.abs(elevDiff));
      }
    }

    if (maxUpwindElevDiff > 0) {
      // Windward lift: multiply precipitation
      cells.prec[i] = Math.min(
        4000,
        cells.prec[i]! * CLIMATE_CONSTANTS.orographicLiftMultiplier
      );
    } else if (maxDownwindElevDiff > 0) {
      // Leeward rain shadow: reduce precipitation
      cells.prec[i] = Math.max(
        50,
        cells.prec[i]! * CLIMATE_CONSTANTS.rainShadowMultiplier
      );
    }

    // Compute aridity index (0 = wet, 1 = dry)
    // High temp + low prec = high aridity
    const potentialEvap = Math.max(100, (cells.temp[i]! + 10) * 60);
    const aridityVal = Math.max(
      0,
      Math.min(1.0, 1.0 - cells.prec[i]! / potentialEvap)
    );
    cells.aridity[i] = aridityVal;
  }
}

// ──────────────────────────────────────────────
// Pass 5: Depression Filling & Flow Routing
// ──────────────────────────────────────────────

function fillDepressionsAndRouteFlow(graph: WorldGraph): Float32Array {
  const { cells } = graph;
  const n = cells.n;

  cells.downstream.fill(-1);

  // Priority-queue-based depression filling algorithm
  // Start from ocean/boundary cells and flood inward to ensure every cell has a downhill path
  const filledH = new Float64Array(cells.h);
  const depressionDepths = new Float32Array(n);

  // Collect water & boundary cells as seeds
  const queue: { cell: number; elev: number }[] = [];
  const visited = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i] || cells.boundary[i]) {
      visited[i] = 1;
      queue.push({ cell: i, elev: filledH[i]! });
    }
  }

  // Sort initial seeds ascending by elevation
  queue.sort((a, b) => a.elev - b.elev);

  while (queue.length > 0) {
    const { cell, elev } = queue.shift()!;

    for (const nb of cells.neighbors[cell]!) {
      if (visited[nb]) continue;
      visited[nb] = 1;

      // Raise neighbor elevation if it sits in a depression below current cell
      if (filledH[nb]! < elev) {
        filledH[nb] = elev + 0.01; // tiny offset to ensure monotonic gradient
      }

      // Priority insert into queue (maintain sorted order)
      const nbElev = filledH[nb]!;
      let lo = 0,
        hi = queue.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (queue[mid]!.elev < nbElev) lo = mid + 1;
        else hi = mid;
      }
      queue.splice(lo, 0, { cell: nb, elev: nbElev });
    }
  }

  // Track depression depths before updating cells.h
  for (let i = 0; i < n; i++) {
    if (cells.isLand[i]) {
      depressionDepths[i] = Math.max(0, filledH[i]! - cells.h[i]!);
      cells.h[i] = filledH[i]!;
    }
  }

  // Compute downstream neighbor: for each land cell, choose neighbor with steepest descent in filledH
  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) continue;

    let lowestNb = -1;
    let lowestElev = cells.h[i]!;

    for (const nb of cells.neighbors[i]!) {
      if (cells.h[nb]! < lowestElev) {
        lowestElev = cells.h[nb]!;
        lowestNb = nb;
      }
    }

    cells.downstream[i] = lowestNb;
  }

  return depressionDepths;
}

// ──────────────────────────────────────────────
// Pass 6: Rivers & Flux Accumulation
// ──────────────────────────────────────────────

function generateRiverNetworks(
  graph: WorldGraph,
  params: WorldGenParams,
  rng: () => number
): void {
  const { cells } = graph;
  const n = cells.n;

  graph.rivers = [];
  graph.watersheds = [];
  cells.flux.fill(0);
  cells.river.fill(0);
  cells.watershed.fill(0);

  // Sort land cells by elevation descending (highest cells accumulate first)
  const landCells: number[] = [];
  for (let i = 0; i < n; i++) {
    if (cells.isLand[i]) landCells.push(i);
  }

  landCells.sort((a, b) => cells.h[b]! - cells.h[a]!);

  // Initialize per-cell water input from precipitation
  for (const c of landCells) {
    cells.flux[c] = Math.max(1, cells.prec[c]! * 0.05);
  }

  // Accumulate flux downhill
  for (const c of landCells) {
    const ds = cells.downstream[c]!;
    if (ds >= 0 && cells.isLand[ds]) {
      cells.flux[ds] += cells.flux[c]!;
    }
  }

  // Adaptive threshold for river detection
  const fluxValues = Array.from(cells.flux).sort((a, b) => b - a);
  const targetCount = Math.min(
    1200,
    Math.max(300, Math.floor(landCells.length * 0.08))
  );
  const fluxCutoff = fluxValues[targetCount] ?? 50;

  // Trace rivers from high-flux coastal mouth cells upstream
  let riverId = 1;

  for (const c of landCells) {
    if (cells.flux[c]! >= fluxCutoff && cells.river[c] === 0) {
      // Start tracing a river from this headwater cell downhill to mouth
      const riverPath: number[] = [];
      let curr = c;

      while (curr >= 0 && cells.isLand[curr]) {
        // Prevent river from crossing mountain ridges
        if (cells.isMountainRidge[curr] && riverPath.length > 0) {
          break; // Stop river before crossing mountain peak
        }

        riverPath.push(curr);
        cells.river[curr] = riverId;

        const next = cells.downstream[curr]!;
        // Stop tracing if next cell is out of bounds, ocean water, or forms a cycle
        if (next < 0 || !cells.isLand[next] || riverPath.includes(next)) {
          break;
        }
        curr = next;
      }

      if (riverPath.length >= 3) {
        const source = riverPath[0]!;
        const mouth = riverPath[riverPath.length - 1]!;
        const flux = cells.flux[mouth]!;

        // Estimate length in km
        let lengthKm = 0;
        for (let j = 0; j < riverPath.length - 1; j++) {
          const dx = cellLng(graph, riverPath[j]!) - cellLng(graph, riverPath[j + 1]!);
          const dy = cellLat(graph, riverPath[j]!) - cellLat(graph, riverPath[j + 1]!);
          lengthKm += Math.sqrt(dx * dx + dy * dy) * 111;
        }

        graph.rivers.push({
          id: riverId,
          name: `River ${riverId}`,
          cells: riverPath,
          source,
          mouth,
          flux,
          lengthKm: Math.round(lengthKm),
          tributaries: [],
        });

        riverId++;
      }
    }
  }

  // Trace watershed basins for each river
  let watershedId = 1;
  for (const river of graph.rivers) {
    const wsCells: number[] = [];
    for (const c of river.cells) {
      wsCells.push(c);
      cells.watershed[c] = watershedId;
    }

    let areaKm2 = 0;
    for (const c of wsCells) {
      areaKm2 += cellAreaKm2(graph, c);
    }

    graph.watersheds.push({
      id: watershedId,
      cells: wsCells,
      river: river.id,
      areaKm2: Math.round(areaKm2),
      isEndorheic: false,
    });

    watershedId++;
  }
}

// ──────────────────────────────────────────────
// Pass 7: Lakes (Land Depressions & Sinks)
// ──────────────────────────────────────────────

function generateLakes(graph: WorldGraph, depressionDepths: Float32Array): void {
  const { cells, features } = graph;
  const n = cells.n;

  cells.lake.fill(0);

  // Identify candidate land cells (isLand === 1) sitting in depressions or endorheic sinks
  const candidateCells: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) continue;

    const depth = depressionDepths[i] ?? 0;
    const flux = cells.flux[i] ?? 0;
    const isSink = cells.downstream[i] === -1;

    // Land cell forms a lake if it has a hydraulic depression > 1.5m with flux > 20,
    // or if it's an endorheic sink receiving river flux > 80
    if ((depth > 1.5 && flux > 20) || (isSink && flux > 80)) {
      candidateCells.push(i);
    }
  }

  if (candidateCells.length === 0) return;

  const candidateSet = new Set(candidateCells);
  const visited = new Set<number>();
  let nextLakeId = features.length > 0 ? Math.max(...features.map((f) => f.id)) + 1 : 1;

  for (const c of candidateCells) {
    if (visited.has(c)) continue;

    const lakeComponent: number[] = [];
    const queue = [c];
    visited.add(c);

    while (queue.length > 0) {
      const curr = queue.pop()!;
      lakeComponent.push(curr);

      for (const nb of cells.neighbors[curr]!) {
        if (cells.isLand[nb] && candidateSet.has(nb) && !visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }

    if (lakeComponent.length === 0) continue;

    const lakeId = nextLakeId++;
    let totalAreaKm2 = 0;
    for (const lc of lakeComponent) {
      cells.lake[lc] = lakeId;
      totalAreaKm2 += cellAreaKm2(graph, lc);
    }

    features.push({
      id: lakeId,
      type: "lake",
      cellCount: lakeComponent.length,
      areaKm2: Math.round(totalAreaKm2),
      name: `Lake ${lakeId}`,
      border: false,
    });
  }
}

// ──────────────────────────────────────────────
// Pass 8: Biomes (Trewartha)
// ──────────────────────────────────────────────

function classifyBiomes(graph: WorldGraph): void {
  const { cells } = graph;
  const n = cells.n;

  for (let i = 0; i < n; i++) {
    const temp = cells.temp[i]!;
    const prec = cells.prec[i]!;
    const aridity = cells.aridity[i]!;
    const elev = cells.h[i]!;
    const lat = Math.abs(cellLat(graph, i));

    if (!cells.isLand[i]) {
      // Water cell: Fi Ice Cap only if polar or freezing, else Temperate Oceanic
      cells.biome[i] = temp <= 0 || lat > 70 ? 10 : 6;
      continue;
    }

    let biomeId = 7; // Default: Temperate Continental (Dc)

    if (temp <= -10 || (lat > 70 && temp < 0) || elev > 5000) {
      // 10: Fi (Ice Cap)
      biomeId = 10;
    } else if (elev > 3000 || (elev > 2500 && temp < 5)) {
      // 11: H (Highland)
      biomeId = 11;
    } else if (temp < 0 || (lat > 60 && temp < 8)) {
      // 9: Ft (Tundra)
      biomeId = 9;
    } else if (temp < 10) {
      // 8: E (Boreal)
      biomeId = 8;
    } else if (aridity > 0.75 || prec < 250) {
      // 3: Bw (Desert)
      biomeId = 3;
    } else if (aridity > 0.50 || prec < 500) {
      // 2: Bs (Steppe)
      biomeId = 2;
    } else if (temp > 20 && lat < 25) {
      if (prec > 1600) {
        // 0: Ar (Tropical Wet)
        biomeId = 0;
      } else {
        // 1: Aw (Tropical Dry)
        biomeId = 1;
      }
    } else if (temp > 15) {
      if (prec < 800 && aridity > 0.35) {
        // 5: Cs (Subtropical Dry Summer / Mediterranean)
        biomeId = 5;
      } else {
        // 4: Cf (Subtropical Humid)
        biomeId = 4;
      }
    } else {
      if (prec > 1000) {
        // 6: Do (Temperate Oceanic)
        biomeId = 6;
      } else {
        // 7: Dc (Temperate Continental)
        biomeId = 7;
      }
    }

    cells.biome[i] = biomeId;
  }
}
