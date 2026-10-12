/**
 * UPG v2 — Landmass & Terrain Elevation Generation
 *
 * 1. Landmasses: `continentCount` continents grown from centres inside `continentLatitudeRange`
 *    over a noisy cost field (irregular, seed-unique silhouettes), sized by `continentSizeVariance`
 *    and kept apart by an ocean gap; optional polar caps; islands and arcs from the leftover budget.
 *    The land budget is exact: land cells = (1 − oceanPercentage) × cells.
 * 2. Plate types follow the landmasses (a plate is continental when most of it is land).
 * 3. Mountains: convergent plate boundaries uplift a belt a few cells wide.
 * 4. Elevation: land cells are ranked by a relief score (coast distance + mountains + noise) and
 *    mapped onto the target hypsometric curve, so the share of land per elevation zone matches
 *    `hypsometry` exactly while mountains still sit on the tectonic belts. Ocean depth grows
 *    with distance from land.
 */

import type { WorldGraph, WorldGenParams } from "./types";
import { ELEVATION_ZONES, TECTONIC_CONSTANTS, getElevationZone } from "./config";
import { makeRng } from "./helpers/rng";
import { buildNoiseConfig, fractalNoise, ridgedNoise } from "./helpers/noise";
import { MinHeap } from "./helpers/heap";
import { computeCoastalDistance } from "./helpers/flood-fill";
import { cellLat, cellLng, cellXYZ, lngDelta } from "./mesh";

/** Cells of ocean kept between two different continents (and between a continent and a polar cap). */
const CONTINENT_GAP_HOPS = 2;
/** Latitude (±noise) beyond which a polar cap is land, when enabled. */
const POLAR_CAP_LAT = 72;
/** Without polar caps, continents stay equatorward of this latitude. */
const MAX_CONTINENT_LAT = 80;
/** Width in cells of the convergent mountain belt. */
const MOUNTAIN_BELT_HOPS = 6;

/**
 * Generate landmasses and elevation in meters for every cell.
 * Mutates graph.cells.h, isLand, elevZone, isMountainRidge, coastDist and plate types in-place.
 */
export function generateTerrain(graph: WorldGraph, params: WorldGenParams): void {
  const { cells } = graph;
  const n = cells.n;

  const mountain = convergentMountainField(graph, params.seed);
  const owner = growLandmasses(graph, params, mountain);

  for (let i = 0; i < n; i++) cells.isLand[i] = owner[i]! > 0 ? 1 : 0;
  assignPlateTypes(graph);
  computeCoastalDistance(graph);
  shapeElevation(graph, params, mountain);

  for (let i = 0; i < n; i++) {
    const isLand = cells.h[i]! >= 0;
    cells.isLand[i] = isLand ? 1 : 0;
    cells.elevZone[i] = isLand ? getElevationZone(cells.h[i]!) : 0;
    cells.isMountainRidge[i] = isLand && cells.h[i]! >= 2000 && mountain[i]! > 0.3 ? 1 : 0;
  }
}

// Landmasses

/** Rough standard-normal sample (sum of three uniforms). */
function gaussian(rng: () => number): number {
  return (rng() + rng() + rng() - 1.5) * 2;
}

/**
 * Assign every cell an owner: 0 = ocean, 1..K = continent, K+1 = polar cap, K+2 = island.
 *
 * Continents: a size-weighted multi-source Dijkstra over a noisy cost field splits the free globe
 * into one region per continent (bigger continents get bigger regions). Each continent then takes
 * the `target` cells of its region with the lowest normalised cost minus coast noise, which gives
 * fractal coasts, peninsulas, bays and offshore islets. Region border cells stay ocean, so
 * continents never merge.
 */
function growLandmasses(
  graph: WorldGraph,
  params: WorldGenParams,
  mountain: Float32Array
): Uint16Array {
  const rng = makeRng(params.seed + 20);
  const { cells } = graph;
  const n = cells.n;
  const owner = new Uint16Array(n);
  const K = Math.max(1, Math.round(params.continentCount));
  const POLAR = K + 1;
  const ISLAND = K + 2;
  const shape = buildNoiseConfig(params.seed + 21, 4, 2.2, 2.2, 0.55);
  const coast = buildNoiseConfig(params.seed + 26, 5, 6, 2.1, 0.6);
  // Without a cap, a hemisphere's continents stay equatorward of MAX_CONTINENT_LAT
  const latOk = (lat: number) =>
    lat > 0
      ? params.polarLand.north || lat <= MAX_CONTINENT_LAT
      : params.polarLand.south || lat >= -MAX_CONTINENT_LAT;

  let budget = Math.round(n * (1 - params.oceanPercentage));

  // Polar caps
  for (let i = 0; i < n; i++) {
    const lat = cellLat(graph, i);
    const edge = POLAR_CAP_LAT + 4 * fractalNoise(cellXYZ(graph, i), shape);
    if ((params.polarLand.south && lat < -edge) || (params.polarLand.north && lat > edge)) {
      owner[i] = POLAR;
      budget--;
    }
  }

  // Cells continents may use: off the caps, within maxLat, and a gap away from the caps
  const free = new Uint8Array(n);
  for (let i = 0; i < n; i++) free[i] = owner[i] === 0 && latOk(cellLat(graph, i)) ? 1 : 0;
  const nearCap = hopsFrom(graph, (i) => owner[i] === POLAR, CONTINENT_GAP_HOPS);
  for (let i = 0; i < n; i++) if (nearCap[i]! < CONTINENT_GAP_HOPS + 1) free[i] = 0;

  // Continent sizes and centres
  let islandBudget = Math.round(Math.max(0, budget) * params.islandShare);
  const continentBudget = Math.max(0, budget - islandBudget);
  const weights = Array.from({ length: K }, () =>
    Math.exp(params.continentSizeVariance * gaussian(rng))
  );
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const targets = weights.map((w) => Math.round((continentBudget * w) / weightSum));
  const centers = pickContinentCenters(graph, params, K, free, rng);

  // Size-weighted regions over the noisy cost field; growth slows outside the latitude band
  const [bandSouth, bandNorth] = params.continentLatitudeRange;
  const bandPenalty = (lat: number) =>
    1 + (Math.max(0, bandSouth - lat, lat - bandNorth) / 15) ** 2;
  const region = new Uint16Array(n);
  const cost = new Float64Array(n).fill(Infinity);
  const heap = new MinHeap();
  centers.forEach((c, k) => {
    cost[c] = 0;
    region[c] = k + 1;
    heap.push(0, c);
  });
  while (heap.size > 0) {
    const key = heap.peekKey()!;
    const cell = heap.pop();
    if (key > cost[cell]!) continue;
    const k = region[cell]!;
    const speed = 1 / Math.sqrt(Math.max(1, targets[k - 1]!));
    for (const nb of cells.neighbors[cell]!) {
      if (!free[nb]) continue;
      const step = Math.exp(2.2 * fractalNoise(cellXYZ(graph, nb), shape));
      const c = key + step * speed * bandPenalty(cellLat(graph, nb));
      if (c < cost[nb]!) {
        cost[nb] = c;
        region[nb] = k;
        heap.push(c, nb);
      }
    }
  }

  // Region border cells (and a hop beyond) stay ocean
  const nearBorder = hopsFrom(
    graph,
    (i) =>
      region[i]! > 0 &&
      cells.neighbors[i]!.some((nb) => region[nb]! > 0 && region[nb] !== region[i]),
    CONTINENT_GAP_HOPS
  );

  // Each continent takes its `target` best cells: low normalised cost u, scaled by coast noise
  // (∝ u, so the core stays solid and only the coastline frays)
  const roughness = 0.15 + 0.6 * params.coastlineComplexity;
  const score = new Float64Array(n);
  const members: number[][] = Array.from({ length: K + 1 }, () => []);
  for (let i = 0; i < n; i++) {
    if (region[i]! > 0 && nearBorder[i]! >= CONTINENT_GAP_HOPS) members[region[i]!]!.push(i);
  }
  for (let k = 1; k <= K; k++) {
    const list = members[k]!.sort((a, b) => cost[a]! - cost[b]!);
    const take = Math.min(targets[k - 1]!, list.length);
    islandBudget += targets[k - 1]! - take;
    if (take === 0) continue;
    const scale = Math.max(1e-9, cost[list[take - 1]!]!);
    for (const c of list) {
      score[c] = (cost[c]! / scale) * (1 - roughness * fractalNoise(cellXYZ(graph, c), coast));
    }
    list.sort((a, b) => score[a]! - score[b]!);
    for (let j = 0; j < take; j++) owner[list[j]!] = k;
  }

  // Pinholes filled inside a continent are paid back from its raggedest coast cells
  const filled = fillEnclosedWater(graph, owner);
  for (const [k, extra] of filled) {
    if (k > K) continue;
    const shore = members[k]!.filter(
      (c) => owner[c] === k && cells.neighbors[c]!.some((nb) => owner[nb] === 0)
    );
    shore.sort((a, b) => score[b]! - score[a]!);
    for (let j = 0; j < Math.min(extra, shore.length); j++) owner[shore[j]!] = 0;
  }

  placeIslands(graph, params, owner, mountain, islandBudget, ISLAND, latOk, rng);
  return owner;
}

/**
 * Coast noise leaves pinholes of water inside continents; any water body under 0.2% of the
 * globe that touches only one landmass becomes that landmass. Returns cells filled per owner.
 */
function fillEnclosedWater(graph: WorldGraph, owner: Uint16Array): Map<number, number> {
  const { cells } = graph;
  const seen = new Uint8Array(cells.n);
  const maxCells = cells.n * 0.002;
  const filled = new Map<number, number>();
  for (let i = 0; i < cells.n; i++) {
    if (seen[i] || owner[i]) continue;
    const body: number[] = [];
    const shores = new Set<number>();
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0 && body.length <= maxCells) {
      const c = stack.pop()!;
      body.push(c);
      for (const nb of cells.neighbors[c]!) {
        if (owner[nb]) shores.add(owner[nb]!);
        else if (!seen[nb]) {
          seen[nb] = 1;
          stack.push(nb);
        }
      }
    }
    if (body.length > maxCells || shores.size !== 1) continue;
    const id = [...shores][0]!;
    for (const c of body) owner[c] = id;
    filled.set(id, (filled.get(id) ?? 0) + body.length);
  }
  return filled;
}

/** Hop distance (capped at maxHops + 1) from the cells matching `isSource`. */
function hopsFrom(
  graph: WorldGraph,
  isSource: (i: number) => boolean,
  maxHops: number
): Uint8Array {
  const { cells } = graph;
  const dist = new Uint8Array(cells.n).fill(maxHops + 1);
  let frontier: number[] = [];
  for (let i = 0; i < cells.n; i++) {
    if (isSource(i)) {
      dist[i] = 0;
      frontier.push(i);
    }
  }
  for (let hop = 1; hop <= maxHops; hop++) {
    const next: number[] = [];
    for (const c of frontier) {
      for (const nb of cells.neighbors[c]!) {
        if (dist[nb]! > hop) {
          dist[nb] = hop;
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

/** Spread continent centres over the latitude band: random first, then farthest-from-chosen among a random pool. */
function pickContinentCenters(
  graph: WorldGraph,
  params: WorldGenParams,
  K: number,
  free: Uint8Array,
  rng: () => number
): number[] {
  const [latMin, latMax] = params.continentLatitudeRange;
  let pool: number[] = [];
  for (let i = 0; i < graph.cells.n; i++) {
    const lat = cellLat(graph, i);
    if (free[i] && lat >= latMin && lat <= latMax) pool.push(i);
  }
  if (pool.length === 0) pool = Array.from({ length: graph.cells.n }, (_, i) => i);

  const centers = [pool[Math.floor(rng() * pool.length)]!];
  while (centers.length < K) {
    let best = pool[0]!;
    let bestDist = -1;
    // ponytail: 600-cell random pool keeps placement seed-varied; exact farthest-point would be a regular lattice
    for (let s = 0; s < 600; s++) {
      const c = pool[Math.floor(rng() * pool.length)]!;
      const [x, y, z] = cellXYZ(graph, c);
      let d = Infinity;
      for (const o of centers) {
        const [ox, oy, oz] = cellXYZ(graph, o);
        d = Math.min(d, (x - ox) ** 2 + (y - oy) ** 2 + (z - oz) ** 2);
      }
      if (d > bestDist) {
        bestDist = d;
        best = c;
      }
    }
    centers.push(best);
  }
  return centers;
}

/**
 * Islands: clusters seeded at the best-scoring open-ocean cells (shelf seas near coasts for
 * archipelagos, convergent boundaries for volcanic arcs), each grown to a log-uniform size of
 * 1-40 cells, until the island budget is spent. Islands never touch a continent or each other.
 */
function placeIslands(
  graph: WorldGraph,
  params: WorldGenParams,
  owner: Uint16Array,
  mountain: Float32Array,
  budget: number,
  islandId: number,
  latOk: (lat: number) => boolean,
  rng: () => number
): void {
  if (budget <= 0) return;
  const { cells } = graph;
  const n = cells.n;
  const noise = buildNoiseConfig(params.seed + 22, 3, 14, 2.0, 0.5);
  const landDist = hopsFrom(graph, (i) => owner[i]! > 0, 12);
  const cluster = new Int32Array(n);

  const open = (c: number, id: number) =>
    owner[c] === 0 &&
    landDist[c]! >= 2 &&
    latOk(cellLat(graph, c)) &&
    cells.neighbors[c]!.every((nb) => cluster[nb] === 0 || cluster[nb] === id);

  const seeds: { cell: number; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!open(i, -1)) continue;
    const score =
      fractalNoise(cellXYZ(graph, i), noise) +
      1.2 * Math.exp(-landDist[i]! / 4) +
      0.8 * mountain[i]!;
    seeds.push({ cell: i, score });
  }
  seeds.sort((a, b) => b.score - a.score);

  let id = 0;
  for (const { cell } of seeds) {
    if (budget <= 0) break;
    id++;
    if (!open(cell, id)) continue;
    const size = Math.min(budget, Math.round(Math.exp(rng() * Math.log(40))));
    const frontier = [cell];
    let grown = 0;
    while (grown < size && frontier.length > 0) {
      const c = frontier.splice(Math.floor(rng() * frontier.length), 1)[0]!;
      if (!open(c, id)) continue;
      owner[c] = islandId;
      cluster[c] = id;
      grown++;
      for (const nb of cells.neighbors[c]!) if (owner[nb] === 0) frontier.push(nb);
    }
    budget -= grown;
  }
}

/** A plate is continental when most of its cells are land. */
function assignPlateTypes(graph: WorldGraph): void {
  const land = new Array(graph.plates.length + 1).fill(0);
  for (let i = 0; i < graph.cells.n; i++) if (graph.cells.isLand[i]) land[graph.cells.plate[i]!]++;
  for (const plate of graph.plates) {
    plate.type = land[plate.id] > plate.cellCount / 2 ? "continental" : "oceanic";
  }
}

// Mountains

/**
 * Mountain belt strength 0..1 per cell: convergence speed at the nearest convergent boundary,
 * decaying over MOUNTAIN_BELT_HOPS cells, with ridged noise for crests and passes.
 */
function convergentMountainField(graph: WorldGraph, seed: number): Float32Array {
  const { cells, plates } = graph;
  const n = cells.n;
  const strength = new Float32Array(n);
  const dist = new Uint16Array(n).fill(65535);
  const queue: number[] = [];
  const maxRel = TECTONIC_CONSTANTS.oceanicSpeedRange[1] * 2;

  for (let i = 0; i < n; i++) {
    const a = plates[cells.plate[i]! - 1];
    if (!a) continue;
    const lat = cellLat(graph, i);
    for (const nb of cells.neighbors[i]!) {
      const b = plates[cells.plate[nb]! - 1];
      if (!b || b === a) continue;
      const dx = lngDelta(cellLng(graph, i), cellLng(graph, nb)) * Math.cos((lat * Math.PI) / 180);
      const dy = cellLat(graph, nb) - lat;
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) continue;
      // Closing speed along the boundary normal (positive = plates colliding)
      const closing =
        -((b.velocity[0] - a.velocity[0]) * dx + (b.velocity[1] - a.velocity[1]) * dy) / len;
      if (closing > TECTONIC_CONSTANTS.boundaryVelocityThreshold) {
        strength[i] = Math.max(strength[i]!, Math.min(1, closing / maxRel + 0.35));
      }
    }
    if (strength[i]! > 0) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    if (dist[c]! >= MOUNTAIN_BELT_HOPS) continue;
    for (const nb of cells.neighbors[c]!) {
      if (dist[nb]! > dist[c]! + 1) {
        dist[nb] = dist[c]! + 1;
        strength[nb] = strength[c]!;
        queue.push(nb);
      }
    }
  }

  const ridges = buildNoiseConfig(seed + 23, 4, 9, 2.2, 0.55);
  const field = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (dist[i] === 65535) continue;
    const crest = 0.55 + 0.45 * ridgedNoise(cellXYZ(graph, i), ridges);
    field[i] = strength[i]! * Math.exp(-dist[i]! / 2.5) * crest;
  }
  return field;
}

// Elevation

/** Top of each zone's meter range used when spreading ranks (zone 8 capped at 7000 m). */
const ZONE_TOP = ELEVATION_ZONES.map((_, i) => ELEVATION_ZONES[i + 1]?.minMeters ?? 7000);

/** Meters for a land rank r ∈ [0, 1) under the cumulative hypsometric curve. */
function hypsometricHeight(r: number, cumulative: number[]): number {
  let z = 0;
  while (z < cumulative.length - 1 && r >= cumulative[z]!) z++;
  const lo = z === 0 ? 0 : cumulative[z - 1]!;
  const span = Math.max(1e-9, cumulative[z]! - lo);
  const t = Math.min(1, (r - lo) / span);
  const min = ELEVATION_ZONES[z]!.minMeters;
  return min + t * (ZONE_TOP[z]! - min);
}

function shapeElevation(graph: WorldGraph, params: WorldGenParams, mountain: Float32Array): void {
  const { cells } = graph;
  const n = cells.n;
  const hills = buildNoiseConfig(params.seed + 24, 4, 10, 2.1, 0.5);
  const macro = buildNoiseConfig(params.seed + 25, 3, 3, 2.0, 0.5);
  const roughness = params.terrainRoughness;

  // Relief score: inland and mountainous cells rank higher; noise breaks up the plains
  const land: { cell: number; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) continue;
    const p = cellXYZ(graph, i);
    const score =
      0.5 * Math.min(1, cells.coastDist[i]! / 10) +
      3 * mountain[i]! +
      0.35 * fractalNoise(p, macro) +
      0.45 * roughness * fractalNoise(p, hills);
    land.push({ cell: i, score });
  }
  land.sort((a, b) => a.score - b.score);

  const total = params.hypsometry.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  let acc = 0;
  const cumulative = ELEVATION_ZONES.map(
    (_, z) => (acc += Math.max(0, params.hypsometry[z] ?? 0) / total)
  );
  land.forEach(({ cell }, rank) => {
    cells.h[cell] = hypsometricHeight(rank / land.length, cumulative);
  });

  // Ocean: shelf near the coast, abyssal plain offshore
  const dist = new Uint16Array(n).fill(65535);
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (cells.isLand[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    for (const nb of cells.neighbors[c]!) {
      if (dist[nb]! > dist[c]! + 1) {
        dist[nb] = dist[c]! + 1;
        queue.push(nb);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (cells.isLand[i]) continue;
    const d = dist[i] === 65535 ? 20 : dist[i]!;
    const depth =
      60 + 4800 * (1 - Math.exp(-(d - 1) / 4)) + 350 * fractalNoise(cellXYZ(graph, i), macro);
    cells.h[i] = -Math.max(1, depth);
  }
}
