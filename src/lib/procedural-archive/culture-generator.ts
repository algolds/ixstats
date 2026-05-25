/**
 * Culture Generator — Procedural cultural regions
 *
 * Creates cultural regions that spread organically across the map,
 * crossing country boundaries. Each culture has a language family,
 * geographic traits, and social characteristics.
 *
 * Pipeline:
 *   1. Poisson disk sampling → culture seed points on land
 *   2. Assign traits based on local geography
 *   3. Weighted BFS expansion from seeds
 *   4. Per-country cultural composition calculation
 */

import type { HeightmapResult } from "./landmass-generator";
import { makeRng } from "./rng";
import type { LanguageFamily } from "./markov-naming";
import { type BiomeGrid, BIOME_TYPES, BIOME_MOVEMENT_COST } from "./biomes";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export const CULTURE_TRAITS = {
  orientation: ["maritime", "continental", "riverine"] as const,
  lifestyle: ["nomadic", "settled", "semi-nomadic"] as const,
  social: ["hierarchical", "egalitarian", "meritocratic"] as const,
  economy: ["agrarian", "mercantile", "pastoral", "industrial"] as const,
  temperament: ["warlike", "peaceful", "isolationist", "expansionist"] as const,
};

export type CultureOrientation = (typeof CULTURE_TRAITS.orientation)[number];
export type CultureLifestyle = (typeof CULTURE_TRAITS.lifestyle)[number];
export type CultureSocial = (typeof CULTURE_TRAITS.social)[number];
export type CultureEconomy = (typeof CULTURE_TRAITS.economy)[number];
export type CultureTemperament = (typeof CULTURE_TRAITS.temperament)[number];

/** Culture type determines expansion behavior (from Azgaar's FMG) */
export type CultureType =
  | "Naval"
  | "Highland"
  | "Lake"
  | "River"
  | "Hunting"
  | "Nomadic"
  | "Generic";

const EXPANSION_MULTIPLIER: Record<CultureType, number> = {
  Naval: 1.5,
  Nomadic: 1.5,
  River: 1.1,
  Generic: 1.0,
  Lake: 0.9,
  Highland: 0.8,
  Hunting: 0.7,
};

const BIOME_CHANGE_PENALTY = 20;

export interface CultureTraits {
  orientation: CultureOrientation;
  lifestyle: CultureLifestyle;
  social: CultureSocial;
  economy: CultureEconomy;
  temperament: CultureTemperament;
}

export interface Culture {
  id: number;
  name: string;
  familyId: string;
  cultureType: CultureType;
  traits: CultureTraits;
  seedX: number;
  seedY: number;
  /** Approximate cell count */
  size: number;
  color: string;
}

export interface CultureGrid {
  /** Culture index per cell (-1 = ocean/unassigned) */
  data: Int16Array;
  width: number;
  height: number;
}

export interface CultureResult {
  cultures: Culture[];
  grid: CultureGrid;
  /** Per-country cultural composition: countryIdx -> { cultureId -> fraction } */
  countryComposition: Map<number, Map<number, number>>;
}

export interface CultureGenParams {
  seed: number;
  /** Number of cultures to generate (default: auto from country count) */
  cultureCount?: number;
  heightmap: HeightmapResult;
  /** Available language families */
  families: LanguageFamily[];
  /** Country assignment grid for composition calculation (optional) */
  countryGrid?: Int32Array;
  countryCount?: number;
  /** Biome grid for biome-aware expansion (optional) */
  biomeGrid?: BiomeGrid;
  /** River cell indices for River culture type detection (optional) */
  riverCells?: Set<number>;
}

// ──────────────────────────────────────────────
// Culture colors (distinct for each culture)
// ──────────────────────────────────────────────

const CULTURE_COLORS = [
  "#e6194B",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
  "#fabed4",
  "#469990",
  "#dcbeff",
  "#9A6324",
  "#fffac8",
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#a9a9a9",
];

// ──────────────────────────────────────────────
// Generation
// ──────────────────────────────────────────────

export function generateCultures(params: CultureGenParams): CultureResult {
  const { seed, heightmap, families } = params;
  const rng = makeRng(seed);
  const { width, height, data: elevData, seaLevel } = heightmap;

  // Determine culture count
  const cultureCount =
    params.cultureCount ?? Math.max(4, Math.min(20, Math.floor((params.countryCount ?? 30) / 4)));

  // Step 1: Place culture seeds on land via Poisson disk sampling
  const seeds: Array<{ x: number; y: number; idx: number }> = [];
  const minDist = Math.max(8, Math.floor(Math.sqrt((width * height) / (cultureCount * 3))));
  const maxAttempts = cultureCount * 50;

  for (let attempt = 0; attempt < maxAttempts && seeds.length < cultureCount; attempt++) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    const idx = y * width + x;

    // Must be land
    if (elevData[idx]! <= seaLevel) continue;

    // Check minimum distance from existing seeds
    let tooClose = false;
    for (const s of seeds) {
      const dx = x - s.x;
      const dy = y - s.y;
      if (dx * dx + dy * dy < minDist * minDist) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    seeds.push({ x, y, idx });
  }

  // Step 2: Classify culture type and assign traits (Azgaar pattern)
  const cultures: Culture[] = seeds.map((s, i) => {
    const elev = elevData[s.idx]!;
    const elevNorm = (elev - seaLevel) / (1 - seaLevel);

    // Count adjacent water cells for coastal/naval detection
    let waterNeighbors = 0;
    let coastal = false;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = s.x + dx;
        const ny = s.y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (elevData[ny * width + nx]! <= seaLevel) {
            waterNeighbors++;
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) coastal = true;
          }
        }
      }
    }

    // Classify culture type (Azgaar pattern)
    const onRiver = params.riverCells?.has(s.idx) ?? false;
    const biomeIdx = params.biomeGrid ? params.biomeGrid.data[s.idx] : undefined;
    const biomeCost =
      biomeIdx !== undefined && biomeIdx < BIOME_TYPES.length
        ? (BIOME_MOVEMENT_COST[BIOME_TYPES[biomeIdx]!] ?? 50)
        : 50;

    let cultureType: CultureType;
    if (coastal && waterNeighbors > 3) cultureType = "Naval";
    else if (onRiver) cultureType = "River";
    else if (elevNorm > 0.5) cultureType = "Highland";
    else if (biomeCost > 150) cultureType = "Hunting";
    else if (elevNorm < 0.2 && biomeCost >= 100) cultureType = "Nomadic";
    else cultureType = "Generic";

    // Geography-influenced trait selection
    const orientation: CultureOrientation = coastal
      ? "maritime"
      : elevNorm > 0.3
        ? "continental"
        : "riverine";
    const lifestyle: CultureLifestyle =
      cultureType === "Nomadic"
        ? "nomadic"
        : elevNorm > 0.5
          ? "semi-nomadic"
          : rng() < 0.7
            ? "settled"
            : "semi-nomadic";
    const social: CultureSocial = ["hierarchical", "egalitarian", "meritocratic"][
      Math.floor(rng() * 3)
    ] as CultureSocial;
    const economy: CultureEconomy =
      cultureType === "Naval"
        ? "mercantile"
        : cultureType === "Highland" || cultureType === "Nomadic"
          ? "pastoral"
          : rng() < 0.6
            ? "agrarian"
            : "industrial";
    const temperament: CultureTemperament = ["warlike", "peaceful", "isolationist", "expansionist"][
      Math.floor(rng() * 4)
    ] as CultureTemperament;

    const familyId = families[i % families.length]!.id;

    return {
      id: i,
      name: `Culture ${i}`,
      familyId,
      cultureType,
      traits: { orientation, lifestyle, social, economy, temperament },
      seedX: s.x,
      seedY: s.y,
      size: 0,
      color: CULTURE_COLORS[i % CULTURE_COLORS.length]!,
    };
  });

  // Step 3: Priority-queue BFS expansion (Azgaar pattern)
  const grid = new Int16Array(width * height).fill(-1);
  const costGrid = new Float32Array(width * height).fill(Infinity);
  const maxExpansionCost = (200 * Math.sqrt(width * height)) / 400;

  // Binary min-heap for priority queue
  const heap: Array<{ idx: number; cultureId: number; cost: number }> = [];
  const heapPush = (item: { idx: number; cultureId: number; cost: number }) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]!.cost <= heap[i]!.cost) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const heapPop = (): { idx: number; cultureId: number; cost: number } | undefined => {
    if (heap.length === 0) return undefined;
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1,
          r = 2 * i + 2;
        if (l < heap.length && heap[l]!.cost < heap[smallest]!.cost) smallest = l;
        if (r < heap.length && heap[r]!.cost < heap[smallest]!.cost) smallest = r;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest]!, heap[i]!];
        i = smallest;
      }
    }
    return top;
  };

  // Initialize seeds
  for (const culture of cultures) {
    const s = seeds[culture.id]!;
    const idx = s.y * width + s.x;
    grid[idx] = culture.id;
    costGrid[idx] = 0;
    heapPush({ idx, cultureId: culture.id, cost: 0 });
  }

  // Priority-queue expansion
  while (heap.length > 0) {
    const entry = heapPop()!;
    const { idx, cultureId, cost } = entry;

    // Skip if this cell was already claimed at lower cost
    if (grid[idx] !== cultureId && grid[idx] !== -1) continue;
    if (cost > costGrid[idx]!) continue;

    const x = idx % width;
    const y = Math.floor(idx / width);
    const culture = cultures[cultureId]!;
    const expansionism = EXPANSION_MULTIPLIER[culture.cultureType];

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
      const elev = elevData[nidx]!;
      if (elev <= seaLevel) continue; // ocean blocks

      // Terrain cost: elevation-based
      const elevNorm = (elev - seaLevel) / (1 - seaLevel);
      let terrainCost = 1 + elevNorm * 3;

      // Biome-change penalty (Azgaar: +20 when crossing biome boundary)
      if (params.biomeGrid) {
        const curBiome = params.biomeGrid.data[idx];
        const nbBiome = params.biomeGrid.data[nidx];
        if (
          curBiome !== undefined &&
          nbBiome !== undefined &&
          curBiome !== nbBiome &&
          curBiome !== 255 &&
          nbBiome !== 255
        ) {
          terrainCost += BIOME_CHANGE_PENALTY;
        }
      }

      const newCost = cost + terrainCost / expansionism;
      if (newCost > maxExpansionCost) continue;
      if (newCost >= costGrid[nidx]!) continue;

      grid[nidx] = cultureId;
      costGrid[nidx] = newCost;
      heapPush({ idx: nidx, cultureId, cost: newCost });
    }
  }

  // Count sizes
  for (let i = 0; i < grid.length; i++) {
    const cid = grid[i]!;
    if (cid >= 0 && cid < cultures.length) {
      cultures[cid]!.size++;
    }
  }

  // Step 4: Calculate per-country cultural composition
  const countryComposition = new Map<number, Map<number, number>>();

  if (params.countryGrid) {
    const countryGrid = params.countryGrid;
    const countryCultureCounts = new Map<number, Map<number, number>>();
    const countryTotals = new Map<number, number>();

    for (let i = 0; i < Math.min(grid.length, countryGrid.length); i++) {
      const countryId = countryGrid[i]!;
      const cultureId = grid[i]!;
      if (countryId < 0 || cultureId < 0) continue;

      if (!countryCultureCounts.has(countryId)) {
        countryCultureCounts.set(countryId, new Map());
      }
      const ccMap = countryCultureCounts.get(countryId)!;
      ccMap.set(cultureId, (ccMap.get(cultureId) ?? 0) + 1);
      countryTotals.set(countryId, (countryTotals.get(countryId) ?? 0) + 1);
    }

    for (const [countryId, ccMap] of countryCultureCounts) {
      const total = countryTotals.get(countryId)!;
      const fractions = new Map<number, number>();
      for (const [cultureId, count] of ccMap) {
        fractions.set(cultureId, count / total);
      }
      countryComposition.set(countryId, fractions);
    }
  }

  return {
    cultures,
    grid: { data: grid, width, height },
    countryComposition,
  };
}
