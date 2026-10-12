/**
 * UPG v2 — Unified Hydrology & Climate Pass
 *
 * Executes the cross-referencing sub-passes that compute hydrology and climate together:
 * 1. Coriolis wind belts & mountain wind shadows
 * 2. Upwind trace: distance over land from the windward ocean and the highest barrier crossed
 * 3. Temperature: zonal curve, lapse rate, continentality (cold interiors at mid/high latitudes)
 * 4. Ocean current gyres (warm east coasts, cold west coasts in the subtropics)
 * 5. Precipitation: smooth zonal bands (ITCZ, subtropical highs, westerlies) × continentality,
 *    orographic lift and rain shadows; aridity
 * 6. Priority-flood depression filling & downstream flow routing
 * 7. Flux accumulation, river networks with tributaries, watersheds
 * 8. Lakes in the deepest filled depressions, up to `lakeCoverage` of land
 * 9. Trewartha biome classification (12 biomes) from month counts of a seasonal temperature curve
 */

import type { WorldGraph, WorldGenParams, RiverNetwork } from "./types";
import { CLIMATE_CONSTANTS, getElevationZone } from "./config";
import { MinHeap } from "./helpers/heap";
import { cellLat, cellLng, cellAreaKm2, lngDelta } from "./mesh";

/** Steps (cells, ~100 km each at default resolution) traced upwind. */
const UPWIND_STEPS = 40;

interface UpwindTrace {
  /** km travelled over land before reaching the windward ocean (capped) */
  landKm: Float32Array;
  /** rain-shadow strength: height of upwind ground above this cell (m), fading with distance */
  barrier: Float32Array;
  /** elevation of the immediate upwind neighbour (m) */
  upwindH: Float32Array;
}

/**
 * Main entry point for the unified hydrology and climate pass.
 * Mutates graph.cells attributes and populates graph.rivers and graph.watersheds in-place.
 */
export function computeHydroClimate(graph: WorldGraph, params: WorldGenParams): void {
  const { cells } = graph;
  const n = cells.n;

  computeWindPatterns(graph);
  const upwind = traceUpwind(graph);
  computeTemperature(graph, params, upwind);
  computeOceanCurrents(graph);
  computePrecipitation(graph, params, upwind);

  const depressionDepths = fillDepressionsAndRouteFlow(graph);

  // Recalibrate elevation zones to match the filled heightmap
  for (let i = 0; i < n; i++) {
    const isLand = cells.h[i]! >= 0;
    cells.isLand[i] = isLand ? 1 : 0;
    cells.elevZone[i] = isLand ? getElevationZone(cells.h[i]!) : 0;
  }

  accumulateFlux(graph);
  graph.rivers = [];
  graph.watersheds = [];
  cells.river.fill(0);
  cells.watershed.fill(0);
  if (params.hasRivers) generateRiverNetworks(graph, params);
  cells.lake.fill(0);
  if (params.hasLakes) generateLakes(graph, params, depressionDepths);

  classifyBiomes(graph, upwind);
}

/** Planar east/north offset in degrees from cell a to cell b, longitude scaled by cos(lat) and seam-wrapped. */
function offset(graph: WorldGraph, a: number, b: number): [number, number] {
  const lat = cellLat(graph, a);
  return [
    lngDelta(cellLng(graph, a), cellLng(graph, b)) * Math.cos((lat * Math.PI) / 180),
    cellLat(graph, b) - lat,
  ];
}

// Pass 1: Wind Patterns (Coriolis)

function computeWindPatterns(graph: WorldGraph): void {
  const { cells } = graph;
  const n = cells.n;

  for (let i = 0; i < n; i++) {
    const lat = cellLat(graph, i);
    const absLat = Math.abs(lat);

    // Direction the air moves toward: 0 = East, π/2 = North, π = West
    let windAngleRad: number;
    if (absLat < 30) {
      // Trade winds blow toward the west and the equator
      windAngleRad = lat > 0 ? Math.PI * 1.1 : Math.PI * 0.9;
    } else if (absLat < 60) {
      // Westerlies blow toward the east and the pole
      windAngleRad = lat > 0 ? Math.PI * 0.1 : Math.PI * 1.9;
    } else {
      // Polar easterlies
      windAngleRad = Math.PI * 0.95;
    }

    cells.windDir[i] = windAngleRad;
    cells.windSpeed[i] = 1.0;
  }

  // Wind speed reduction behind mountain ridges (wind shadow)
  for (let i = 0; i < n; i++) {
    if (!cells.isMountainRidge[i] && cells.h[i]! <= 2000) continue;
    const wx = Math.cos(cells.windDir[i]!);
    const wy = Math.sin(cells.windDir[i]!);
    for (const nb of cells.neighbors[i]!) {
      const [dx, dy] = offset(graph, i, nb);
      if (dx * wx + dy * wy > 0) cells.windSpeed[nb] = Math.min(cells.windSpeed[nb]!, 0.35);
    }
  }
}

// Pass 2: Upwind trace

/** Walk each land cell against the wind until the ocean, recording land distance and barriers. */
function traceUpwind(graph: WorldGraph): UpwindTrace {
  const { cells } = graph;
  const n = cells.n;
  const landKm = new Float32Array(n);
  const barrier = new Float32Array(n);
  const upwindH = new Float32Array(n);
  const cosLat = new Float64Array(n);
  for (let i = 0; i < n; i++) cosLat[i] = Math.cos((cellLat(graph, i) * Math.PI) / 180);

  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) continue;
    const ux = -Math.cos(cells.windDir[i]!);
    const uy = -Math.sin(cells.windDir[i]!);
    let cur = i;
    let km = 0;
    let top = 0;
    for (let step = 0; step < UPWIND_STEPS; step++) {
      let best = -1;
      let bestDot = 0;
      let bestLen = 0;
      const curLng = cellLng(graph, cur);
      const curLat = cellLat(graph, cur);
      const cosCur = cosLat[cur]!;
      for (const nb of cells.neighbors[cur]!) {
        const dx = lngDelta(curLng, cellLng(graph, nb)) * cosCur;
        const dy = cellLat(graph, nb) - curLat;
        // Only a neighbour with a positive component along the upwind direction can beat bestDot
        const along = dx * ux + dy * uy;
        if (!(along > 0)) continue;
        const len = Math.hypot(dx, dy);
        const dot = len > 0 ? along / len : 0;
        if (dot > bestDot) {
          bestDot = dot;
          best = nb;
          bestLen = len;
        }
      }
      if (best < 0) break;
      if (step === 0) upwindH[i] = Math.max(0, cells.h[best]!);
      if (!cells.isLand[best]) break;
      km += bestLen * 111;
      // Air re-moistens downwind of a range, so a barrier's shadow fades over ~1500 km
      top = Math.max(top, (cells.h[best]! - cells.h[i]!) * Math.exp(-km / 1500));
      cur = best;
    }
    landKm[i] = km;
    barrier[i] = top;
  }
  return { landKm, barrier, upwindH };
}

// Pass 3: Temperature

/** Annual-mean sea-level temperature by latitude (°C): ~28 at the equator, ~13 at 45°, ~-30 at the poles. */
function zonalTemperature(absLat: number): number {
  return (
    CLIMATE_CONSTANTS.equatorialTemp - CLIMATE_CONSTANTS.latitudeTempCurvature * absLat * absLat
  );
}

function computeTemperature(graph: WorldGraph, params: WorldGenParams, upwind: UpwindTrace): void {
  const { cells } = graph;
  for (let i = 0; i < cells.n; i++) {
    const absLat = Math.abs(cellLat(graph, i));
    const lapse = (Math.max(0, cells.h[i]!) / 1000) * CLIMATE_CONSTANTS.lapseRatePerKm;
    // Continental interiors at mid/high latitudes have cold winters, pulling the annual mean down
    const continentality =
      Math.min(1, upwind.landKm[i]! / 3000) * Math.max(0, Math.min(1, (absLat - 30) / 30));
    cells.temp[i] =
      zonalTemperature(absLat) +
      params.temperatureOffset -
      lapse -
      CLIMATE_CONSTANTS.continentalCooling * continentality;
  }
}

// Pass 4: Ocean Currents

function computeOceanCurrents(graph: WorldGraph): void {
  const { cells } = graph;
  const n = cells.n;
  cells.oceanCurrentInfluence.fill(0);

  // Western boundary currents warm east coasts; eastern boundary currents cool west coasts
  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i] || cells.coastDist[i]! > 3) continue;
    const lng = cellLng(graph, i);
    const absLat = Math.abs(cellLat(graph, i));
    if (absLat < 15 || absLat > 55) continue;

    let oceanEast = false;
    let oceanWest = false;
    for (const nb of cells.neighbors[i]!) {
      if (cells.isLand[nb]) continue;
      const d = lngDelta(lng, cellLng(graph, nb));
      if (d > 0) oceanEast = true;
      if (d < 0) oceanWest = true;
    }

    if (oceanEast && !oceanWest) {
      cells.oceanCurrentInfluence[i] = CLIMATE_CONSTANTS.warmCurrentBoost;
    } else if (oceanWest && !oceanEast) {
      cells.oceanCurrentInfluence[i] = CLIMATE_CONSTANTS.coldCurrentReduction;
    }
    cells.temp[i] += cells.oceanCurrentInfluence[i]!;
  }
}

// Pass 5: Precipitation & Rain Shadows

/** Zonal mean precipitation (mm/yr): ITCZ peak, subtropical dry belt, mid-latitude storm track, dry poles. */
function zonalPrecipitation(absLat: number): number {
  return (
    250 + 1800 * Math.exp(-((absLat / 16) ** 2)) + 800 * Math.exp(-(((absLat - 48) / 15) ** 2))
  );
}

/** Köppen dry threshold (mm/yr, evenly spread rain): below it, evaporation outpaces rainfall. */
function dryThreshold(temp: number): number {
  return 20 * Math.max(0, temp) + 140;
}

function computePrecipitation(
  graph: WorldGraph,
  params: WorldGenParams,
  upwind: UpwindTrace
): void {
  const { cells } = graph;
  for (let i = 0; i < cells.n; i++) {
    const absLat = Math.abs(cellLat(graph, i));
    let p = zonalPrecipitation(absLat);

    if (cells.isLand[i]) {
      const h = Math.max(0, cells.h[i]!);
      // Onshore winds wet the windward coast (east coasts in the trades, west coasts in the
      // westerlies); moisture is then rained out inland, slowly under the ITCZ and monsoons
      const decayKm = 5000 + 5000 * Math.exp(-((absLat / 18) ** 2));
      p *= (1 + 1.2 * Math.exp(-upwind.landKm[i]! / 600)) * Math.exp(-upwind.landKm[i]! / decayKm);
      // Rain shadow behind higher ground, orographic lift on windward slopes
      p *= Math.exp(-Math.max(0, upwind.barrier[i]! - 300) / 1500);
      const lift = h - upwind.upwindH[i]!;
      if (lift > 150) p *= 1 + Math.min(1.2, lift / 1500);
      // Warm currents feed coastal rain; cold currents stabilise the air (coastal deserts)
      const current = cells.oceanCurrentInfluence[i]!;
      if (current > 0) p *= 1.3;
      else if (current < 0) p *= 0.6;
    }

    p = Math.max(30, Math.min(5000, p * params.precipitationScale));
    cells.prec[i] = p;
    // Aridity 0..1: 0.5 sits on the dry threshold
    cells.aridity[i] = Math.max(0, Math.min(1, 1 - p / (2 * dryThreshold(cells.temp[i]!))));
  }
}

// Pass 6: Depression Filling & Flow Routing

/**
 * Priority-flood from the ocean: every land cell gets a monotone path to the sea.
 * Returns how far each land cell was raised (the depth of the depression it sits in).
 */
function fillDepressionsAndRouteFlow(graph: WorldGraph): Float32Array {
  const { cells } = graph;
  const n = cells.n;

  cells.downstream.fill(-1);
  const filledH = new Float64Array(cells.h);
  const depressionDepths = new Float32Array(n);
  const visited = new Uint8Array(n);
  const heap = new MinHeap();

  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) {
      visited[i] = 1;
      heap.push(filledH[i]!, i);
    }
  }

  while (heap.size > 0) {
    const elev = heap.peekKey()!;
    const cell = heap.pop();
    for (const nb of cells.neighbors[cell]!) {
      if (visited[nb]) continue;
      visited[nb] = 1;
      // Raise a cell sitting below its spill point, with a tiny gradient so water keeps moving
      if (filledH[nb]! <= elev) filledH[nb] = elev + 0.01;
      heap.push(filledH[nb]!, nb);
    }
  }

  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) continue;
    depressionDepths[i] = Math.max(0, filledH[i]! - cells.h[i]!);
    cells.h[i] = filledH[i]!;
  }

  // Steepest descent on the filled surface
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

// Pass 7: Rivers, Tributaries & Watersheds

/** Land cells ordered from highest to lowest (sources before mouths). */
function landByHeightDesc(graph: WorldGraph): number[] {
  const land: number[] = [];
  for (let i = 0; i < graph.cells.n; i++) if (graph.cells.isLand[i]) land.push(i);
  return land.sort((a, b) => graph.cells.h[b]! - graph.cells.h[a]!);
}

function accumulateFlux(graph: WorldGraph): void {
  const { cells } = graph;
  cells.flux.fill(0);
  const land = landByHeightDesc(graph);
  for (const c of land) cells.flux[c] = Math.max(1, cells.prec[c]! * 0.05);
  for (const c of land) {
    const ds = cells.downstream[c]!;
    if (ds >= 0 && cells.isLand[ds]) cells.flux[ds] += cells.flux[c]!;
  }
}

function riverLengthKm(graph: WorldGraph, path: number[]): number {
  let km = 0;
  for (let j = 0; j < path.length - 1; j++) {
    const [dx, dy] = offset(graph, path[j]!, path[j + 1]!);
    km += Math.hypot(dx, dy) * 111;
  }
  return Math.round(km);
}

function generateRiverNetworks(graph: WorldGraph, params: WorldGenParams): void {
  const { cells } = graph;
  const land = landByHeightDesc(graph);
  if (land.length === 0) return;

  // Rivers occupy roughly the top `share` of land cells by accumulated flux
  const share = Math.min(0.3, CLIMATE_CONSTANTS.riverCellShare * params.riverDensity);
  const fluxSorted = land.map((c) => cells.flux[c]!).sort((a, b) => b - a);
  const fluxCutoff = fluxSorted[Math.min(fluxSorted.length - 1, Math.floor(land.length * share))]!;

  const byId = new Map<number, RiverNetwork>();
  let riverId = 1;
  for (const c of land) {
    if (cells.flux[c]! < fluxCutoff || cells.river[c] !== 0) continue;

    // Trace downstream to the sea, or to the river this one joins as a tributary
    const path: number[] = [];
    let joins = 0;
    let curr = c;
    while (curr >= 0 && cells.isLand[curr]) {
      if (cells.river[curr] !== 0) {
        joins = cells.river[curr]!;
        path.push(curr); // the confluence cell, so the lines meet
        break;
      }
      path.push(curr);
      curr = cells.downstream[curr]!;
    }

    const ownCells = joins ? path.slice(0, -1) : path;
    if (path.length < 3 || ownCells.length === 0) continue;
    for (const pc of ownCells) cells.river[pc] = riverId;

    const mouth = path[path.length - 1]!;
    const river: RiverNetwork = {
      id: riverId,
      name: `River ${riverId}`,
      cells: path,
      source: path[0]!,
      mouth,
      flux: cells.flux[mouth]!,
      lengthKm: Math.max(1, riverLengthKm(graph, path)),
      tributaries: [],
    };
    graph.rivers.push(river);
    byId.set(riverId, river);
    byId.get(joins)?.tributaries.push(riverId);
    riverId++;
  }

  // Watersheds: each land cell belongs to the first river its flow path reaches
  for (let k = land.length - 1; k >= 0; k--) {
    const c = land[k]!;
    const ds = cells.downstream[c]!;
    cells.watershed[c] =
      cells.river[c]! > 0
        ? cells.river[c]!
        : ds >= 0 && cells.isLand[ds]
          ? cells.watershed[ds]!
          : 0;
  }
  const area = new Map<number, number>();
  const members = new Map<number, number[]>();
  for (const c of land) {
    const ws = cells.watershed[c]!;
    if (!ws) continue;
    area.set(ws, (area.get(ws) ?? 0) + cellAreaKm2(graph, c));
    if (!members.has(ws)) members.set(ws, []);
    members.get(ws)!.push(c);
  }
  for (const river of graph.rivers) {
    graph.watersheds.push({
      id: river.id,
      cells: members.get(river.id) ?? [],
      river: river.id,
      areaKm2: Math.round(area.get(river.id) ?? 0),
      isEndorheic: false,
    });
  }
}

// Pass 8: Lakes (filled depressions)

/**
 * Lakes are the deepest filled depressions (by water volume), added until their surface reaches
 * `lakeCoverage` of land. Basins over a sixth of that surface are skipped (salt flats, marsh).
 */
function generateLakes(graph: WorldGraph, params: WorldGenParams, depths: Float32Array): void {
  const { cells, features } = graph;
  const n = cells.n;
  let landCount = 0;
  for (let i = 0; i < n; i++) landCount += cells.isLand[i]!;
  let budget = Math.round(landCount * params.lakeCoverage);
  if (budget <= 0) return;
  // Spread the surface over many lakes: no single lake takes more than a sixth of it
  const maxLake = Math.max(1, Math.round(budget / 6));

  const seen = new Uint8Array(n);
  const basins: { cells: number[]; volume: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (seen[i] || !cells.isLand[i] || depths[i]! <= 1) continue;
    const basin: number[] = [];
    let volume = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const c = stack.pop()!;
      basin.push(c);
      volume += depths[c]!;
      for (const nb of cells.neighbors[c]!) {
        if (!seen[nb] && cells.isLand[nb] && depths[nb]! > 1) {
          seen[nb] = 1;
          stack.push(nb);
        }
      }
    }
    basins.push({ cells: basin, volume });
  }
  basins.sort((a, b) => b.volume - a.volume);

  let nextLakeId = features.reduce((m, f) => Math.max(m, f.id), 0) + 1;
  for (const basin of basins) {
    if (budget <= 0) break;
    if (basin.cells.length > maxLake) continue;
    const lakeId = nextLakeId++;
    let areaKm2 = 0;
    for (const c of basin.cells) {
      cells.lake[c] = lakeId;
      areaKm2 += cellAreaKm2(graph, c);
    }
    budget -= basin.cells.length;
    features.push({
      id: lakeId,
      type: "lake",
      cellCount: basin.cells.length,
      areaKm2: Math.round(areaKm2),
      name: `Lake ${lakeId}`,
      border: false,
    });
  }
}

// Pass 9: Biomes (Trewartha)

/**
 * Half the annual temperature range (°C): ~1.5 at the equator, growing poleward, and up to
 * 2.5× larger deep inside continents than on windward coasts.
 */
function seasonalAmplitude(absLat: number, landKm: number): number {
  const continentality = Math.min(1, landKm / 2000);
  return 1.5 + 0.25 * absLat * (0.4 + 0.6 * continentality);
}

/** Months (0-12) with a mean above `threshold`, for a sinusoidal year of the given mean and amplitude. */
function monthsAbove(threshold: number, mean: number, amplitude: number): number {
  const x = (threshold - mean) / amplitude;
  return x <= -1 ? 12 : x >= 1 ? 0 : (12 * Math.acos(x)) / Math.PI;
}

/** Trewartha group from mean temperature, seasonal amplitude and precipitation; ids index TREWARTHA_BIOMES. */
function classifyLandBiome(
  temp: number,
  amplitude: number,
  prec: number,
  h: number,
  absLat: number,
  maritime: boolean
): number {
  const warmest = temp + amplitude;
  const coldest = temp - amplitude;
  // Fi: ice cap — no month above freezing, or cold enough for a self-sustaining ice sheet
  if (warmest <= 0 || temp < CLIMATE_CONSTANTS.iceSheetTemp) return 10;
  if (h >= 2300) return 11; // H: highland
  if (warmest < 10) return 9; // Ft: tundra, no month above 10 °C
  const warmMonths = monthsAbove(10, temp, amplitude);
  if (warmMonths < 4) return 8; // E: boreal, 1-3 months above 10 °C
  const dry = dryThreshold(temp);
  if (prec < dry) return prec < dry / 2 ? 3 : 2; // Bw desert / Bs steppe
  if (coldest >= 18) return prec >= 1700 ? 0 : 1; // Ar / Aw: every month above 18 °C
  if (warmMonths >= 8) {
    // Cs: dry-summer windward (west) coasts under the poleward edge of the subtropical high
    return absLat >= 28 && absLat <= 46 && maritime && prec < 1600 ? 5 : 4;
  }
  return coldest > 0 ? 6 : 7; // Do oceanic (mild winters) / Dc continental (freezing winters)
}

function classifyBiomes(graph: WorldGraph, upwind: UpwindTrace): void {
  const { cells } = graph;
  for (let i = 0; i < cells.n; i++) {
    const temp = cells.temp[i]!;
    if (!cells.isLand[i]) {
      // Sea ice where the water stays frozen most of the year
      cells.biome[i] = temp < CLIMATE_CONSTANTS.seaIceTemp ? 10 : 6;
      continue;
    }
    const absLat = Math.abs(cellLat(graph, i));
    const landKm = upwind.landKm[i]!;
    cells.biome[i] = classifyLandBiome(
      temp,
      seasonalAmplitude(absLat, landKm),
      cells.prec[i]!,
      cells.h[i]!,
      absLat,
      landKm < CLIMATE_CONSTANTS.maritimeKm
    );
  }
}
