/**
 * UPG v2 — Natural-Border Political Overlay Generator
 *
 * Runs AFTER physical geography is finalized. Reads physical data, never mutates it.
 * 1. Cultures: seeds culture centers in habitable lowlands, expands via terrain-cost BFS
 * 2. Settlements: scores cell habitability (coasts, rivers, temperate climate), places capitals
 * 3. Natural borders: pre-computes border resistance field (rivers=0.8, mountains=1.0, coast=1.0)
 * 4. State expansion: Dijkstra expansion from capitals where edge cost is inversely proportional to border resistance
 * 5. Connectivity repair: reassigns disconnected exclaves to eliminate border gore
 * 6. Markov naming: names states and cultures using language families
 */

import type {
  WorldGraph,
  WorldGenParams,
  PoliticalState,
  CulturalRegion,
  Settlement,
} from "./types";
import { QUALITY_THRESHOLDS } from "./config";
import { makeRng, hslToHex } from "./helpers/rng";
import { cellLat, cellLng, cellAreaKm2 } from "./mesh";
import { dijkstraMultiSource } from "./helpers/flood-fill";
import { MarkovNameGenerator } from "~/lib/onoma/markov-naming";
import { getLanguageFamilies } from "~/lib/onoma/language-families";

/**
 * Generate cultures, settlements, and political states with natural borders.
 * Mutates graph.cells.culture, graph.cells.state, and populates entity arrays in-place.
 */
export function generatePolitics(graph: WorldGraph, params: WorldGenParams): void {
  const rng = makeRng(params.seed + 50);
  const { cells } = graph;
  const n = cells.n;

  cells.culture.fill(0);
  cells.state.fill(0);
  graph.cultures = [];
  graph.settlements = [];
  graph.states = [];

  const landCells: number[] = [];
  for (let i = 0; i < n; i++) {
    if (cells.isLand[i]) landCells.push(i);
  }

  if (landCells.length === 0) return;

  // ── Step 1: Culture Seeding & Terrain-Cost Expansion ──
  generateCultures(graph, params, landCells, rng);

  // ── Step 2: Settlement Placement & Habitability Scoring ──
  generateSettlements(graph, params, landCells, rng);

  // ── Step 3: Natural Border Resistance Field ──
  // Base resistance field: higher value = stronger natural boundary
  const borderResistance = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) {
      borderResistance[i] = QUALITY_THRESHOLDS.coastBorderStrength; // Coast/water
    } else if (cells.isMountainRidge[i] || cells.elevZone[i]! >= 5) {
      borderResistance[i] = QUALITY_THRESHOLDS.mountainBorderStrength; // Mountain ridge
    } else if (cells.river[i]! > 0) {
      borderResistance[i] = QUALITY_THRESHOLDS.riverBorderStrength; // River
    } else {
      borderResistance[i] = QUALITY_THRESHOLDS.flatlandBorderStrength; // Flat lowland
    }
  }

  // ── Step 4: State Expansion via Natural-Border Dijkstra ──
  const targetCount = Math.round(
    ((params.countryCountRange?.[0] ?? 60) + (params.countryCountRange?.[1] ?? 200)) / 2
  );

  // Select state capitals from top-scoring settlements distributed across continents
  const capitalBurgs = graph.settlements.filter((s) => s.isCapital);
  if (capitalBurgs.length === 0) return;

  const actualStateCount = Math.min(targetCount, capitalBurgs.length);
  const chosenCapitals = capitalBurgs.slice(0, actualStateCount);

  // Prepare multi-source Dijkstra from capital locations
  const sources = chosenCapitals.map((b, idx) => ({
    cell: b.cell,
    id: idx + 1, // 1-indexed state ID
  }));

  // Edge cost is inversely proportional to border resistance:
  // Expanding across a river/mountain costs much more than expanding across flat land!
  const edgeCostFn = (_fromCell: number, toCell: number) => {
    const resistance = borderResistance[toCell]!;
    return 1.0 + resistance * 8.0; // flatland cost ~ 1.8, river ~ 7.4, mountain ~ 9.0
  };

  const { sourceId } = dijkstraMultiSource(
    graph,
    sources,
    edgeCostFn,
    (c) => cells.isLand[c] === 1
  );

  for (let i = 0; i < n; i++) {
    if (cells.isLand[i]) {
      cells.state[i] = sourceId[i]!;
    }
  }

  // Fill any remaining unclaimed land cells (e.g. islands without capitals) via BFS spread from neighbors
  fillUnclaimedLandCells(graph, sources);

  // ── Step 5: Exclave Reassignment & Connectivity Repair ──
  repairStateConnectivity(graph, actualStateCount);

  // ── Step 6: Build State Entities & Markov Naming ──
  buildStateEntities(graph, params, chosenCapitals, rng);
}

// ──────────────────────────────────────────────
// Helpers: Cultures
// ──────────────────────────────────────────────

function generateCultures(
  graph: WorldGraph,
  params: WorldGenParams,
  landCells: number[],
  rng: () => number
): void {
  const { cells } = graph;
  const targetCultures = Math.min(25, Math.max(6, Math.floor(landCells.length / 300)));

  // Find candidate seeds: temperate lowlands near water
  const candidates = landCells.filter((c) => {
    const elev = cells.h[c]!;
    const temp = cells.temp[c]!;
    return elev < 1000 && temp > 5 && temp < 30 && cells.coastDist[c]! <= 5;
  });

  const seeds: number[] = [];
  const pool = candidates.length >= targetCultures ? candidates : landCells;

  for (let k = 0; k < targetCultures; k++) {
    const idx = Math.floor(rng() * pool.length);
    seeds.push(pool[idx] ?? landCells[0]!);
  }

  const families = getLanguageFamilies();

  for (let i = 0; i < seeds.length; i++) {
    const cultureId = i + 1;
    const center = seeds[i]!;
    const fam = families[i % families.length];

    graph.cultures.push({
      id: cultureId,
      name: `Culture ${cultureId}`,
      familyId: fam?.id ?? "latin",
      center,
      cellCount: 0,
    });
  }

  // Spread cultures to nearest seed
  const sources = seeds.map((cell, idx) => ({ cell, id: idx + 1 }));
  const edgeCost = (from: number, to: number) => {
    const elevDiff = Math.abs(cells.h[to]! - cells.h[from]!);
    return 1.0 + elevDiff * 0.002;
  };

  const { sourceId } = dijkstraMultiSource(graph, sources, edgeCost, (c) => cells.isLand[c] === 1);
  for (let i = 0; i < cells.n; i++) {
    if (cells.isLand[i]) {
      cells.culture[i] = sourceId[i]!;
    }
  }

  for (let i = 0; i < cells.n; i++) {
    const cId = cells.culture[i]!;
    if (cId > 0 && cId <= graph.cultures.length) {
      graph.cultures[cId - 1]!.cellCount++;
    }
  }
}

// ──────────────────────────────────────────────
// Helpers: Settlements
// ──────────────────────────────────────────────

function generateSettlements(
  graph: WorldGraph,
  params: WorldGenParams,
  landCells: number[],
  rng: () => number
): void {
  const { cells } = graph;

  // Habitability score per land cell (0-1)
  const scores = landCells.map((c) => {
    let score = 0.5;

    // Coastal bonus
    if (cells.coastDist[c]! === 0) score += 0.25;
    // River bonus
    if (cells.river[c]! > 0) score += 0.2;
    // Temperate climate bonus
    const temp = cells.temp[c]!;
    if (temp >= 12 && temp <= 25) score += 0.15;
    // Lowland bonus
    if (cells.elevZone[c]! <= 2) score += 0.1;
    // Aridity penalty
    if (cells.aridity[c]! > 0.6) score -= 0.25;

    return { cell: c, score: Math.max(0.01, Math.min(1.0, score)) };
  });

  scores.sort((a, b) => b.score - a.score);

  const targetCount = Math.min(150, Math.max(40, Math.floor(landCells.length / 50)));
  const chosen = scores.slice(0, targetCount);

  const families = getLanguageFamilies();
  const generators = families.map((f, idx) => new MarkovNameGenerator(f, params.seed + 700 + idx));

  let burgId = 1;
  for (let i = 0; i < chosen.length; i++) {
    const { cell, score } = chosen[i]!;
    const cultureId = cells.culture[cell]!;
    let name = `City ${burgId}`;

    if (params.useMarkovNaming ?? true) {
      const famIdx = cultureId % generators.length;
      if (generators[famIdx]) {
        name = generators[famIdx]!.generate();
      }
    }

    const isCapital = i < 80; // Top 80 are capital candidates
    const isPort = cells.coastDist[cell]! === 0;
    const population = Math.round(10000 + score * 500000 + rng() * 50000);

    graph.settlements.push({
      id: burgId,
      name,
      cell,
      state: 0, // assigned in step 6
      population,
      isCapital,
      isPort,
      lng: cellLng(graph, cell),
      lat: cellLat(graph, cell),
      score,
    });

    burgId++;
  }
}

// ──────────────────────────────────────────────
// Helpers: Unclaimed Land Filling
// ──────────────────────────────────────────────

function fillUnclaimedLandCells(
  graph: WorldGraph,
  sources: Array<{ cell: number; id: number }>
): void {
  const { cells } = graph;
  const n = cells.n;

  // Collect seeds from assigned land cells
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (cells.isLand[i] && cells.state[i]! > 0) {
      queue.push(i);
    }
  }

  // BFS spread across land
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++]!;
    const currState = cells.state[curr]!;

    for (const nb of cells.neighbors[curr]!) {
      if (cells.isLand[nb] && cells.state[nb] === 0) {
        cells.state[nb] = currState;
        queue.push(nb);
      }
    }
  }

  // Fallback for isolated island landmasses with 0 capitals: assign to nearest capital source
  const unassigned: number[] = [];
  for (let i = 0; i < n; i++) {
    if (cells.isLand[i] && cells.state[i] === 0) {
      unassigned.push(i);
    }
  }

  if (unassigned.length > 0 && sources.length > 0) {
    for (const cellId of unassigned) {
      const cLng = cellLng(graph, cellId);
      const cLat = cellLat(graph, cellId);
      let closestState = sources[0]!.id;
      let minDistance = Infinity;

      for (const src of sources) {
        const capLng = cellLng(graph, src.cell);
        const capLat = cellLat(graph, src.cell);
        const dLng = cLng - capLng;
        const dLat = cLat - capLat;
        const distSq = dLng * dLng + dLat * dLat;
        if (distSq < minDistance) {
          minDistance = distSq;
          closestState = src.id;
        }
      }

      cells.state[cellId] = closestState;
    }
  }
}

function repairStateConnectivity(graph: WorldGraph, stateCount: number): void {
  const { cells } = graph;

  for (let sid = 1; sid <= stateCount; sid++) {
    const sCells: number[] = [];
    for (let i = 0; i < cells.n; i++) {
      if (cells.state[i] === sid) sCells.push(i);
    }
    if (sCells.length < 2) continue;

    // BFS connected components
    const visited = new Set<number>();
    const components: number[][] = [];

    for (const c of sCells) {
      if (visited.has(c)) continue;
      const comp: number[] = [];
      const q = [c];
      visited.add(c);

      while (q.length > 0) {
        const curr = q.pop()!;
        comp.push(curr);
        for (const nb of cells.neighbors[curr]!) {
          if (!visited.has(nb) && cells.state[nb] === sid) {
            visited.add(nb);
            q.push(nb);
          }
        }
      }
      components.push(comp);
    }

    if (components.length <= 1) continue;

    // Keep largest component, reassign orphans to neighboring state
    components.sort((a, b) => b.length - a.length);
    for (let ci = 1; ci < components.length; ci++) {
      const orphans = components[ci]!;
      const neighborCounts = new Map<number, number>();

      for (const oCell of orphans) {
        for (const nb of cells.neighbors[oCell]!) {
          const nbState = cells.state[nb]!;
          if (nbState > 0 && nbState !== sid) {
            neighborCounts.set(nbState, (neighborCounts.get(nbState) ?? 0) + 1);
          }
        }
      }

      let bestState = sid;
      let maxCount = 0;
      for (const [nState, cnt] of neighborCounts) {
        if (cnt > maxCount) {
          maxCount = cnt;
          bestState = nState;
        }
      }

      for (const oCell of orphans) {
        cells.state[oCell] = bestState;
      }
    }
  }
}

// ──────────────────────────────────────────────
// Helpers: State Entity Construction
// ──────────────────────────────────────────────

function buildStateEntities(
  graph: WorldGraph,
  params: WorldGenParams,
  capitals: Settlement[],
  rng: () => number
): void {
  const { cells, features } = graph;

  const families = getLanguageFamilies();
  const generators = families.map((f, idx) => new MarkovNameGenerator(f, params.seed + 800 + idx));

  for (let s = 0; s < capitals.length; s++) {
    const stateId = s + 1;
    const capitalBurg = capitals[s]!;
    capitalBurg.state = stateId;

    const cultureId = cells.culture[capitalBurg.cell]!;
    let name = `State ${stateId}`;

    if (params.useMarkovNaming ?? true) {
      const famIdx = cultureId % generators.length;
      if (generators[famIdx]) {
        name = generators[famIdx]!.generate();
      }
    }

    // Color via golden ratio hue spacing
    const hue = (stateId * 137.508) % 360;
    const sat = 45 + rng() * 20;
    const lit = 55 + rng() * 15;
    const color = hslToHex(hue, sat, lit);

    // Continent name from capital cell feature
    const featId = cells.feature[capitalBurg.cell]!;
    const feature = features.find((f) => f.id === featId);
    const continent = feature?.name ?? "Unknown";

    let cellCount = 0;
    let areaKm2 = 0;
    const neighborSet = new Set<number>();

    for (let i = 0; i < cells.n; i++) {
      if (cells.state[i] === stateId) {
        cellCount++;
        areaKm2 += cellAreaKm2(graph, i);
        for (const nb of cells.neighbors[i]!) {
          const nbState = cells.state[nb]!;
          if (nbState > 0 && nbState !== stateId) {
            neighborSet.add(nbState);
          }
        }
      }
    }

    const stateObj: PoliticalState = {
      id: stateId,
      name,
      color,
      capital: capitalBurg.id,
      cellCount,
      areaKm2: Math.round(areaKm2),
      neighbors: Array.from(neighborSet),
      culture: cultureId,
      continent,
    };

    graph.states.push(stateObj);
  }
}
