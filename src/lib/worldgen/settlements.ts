/**
 * Settlement Placement — Habitability Scoring + Minimum-Spacing Placement
 *
 * Scores every land cell by habitability (coastal, river, climate, terrain),
 * then places burgs with minimum spacing using BFS proximity checks.
 * Names burgs using the Markov naming system when available.
 */

import type { PackedGraph, WorldGenParams, Burg } from "./types";
import { makeRng } from "./rng";
import { isLand, isWater, cellLat, cellLng } from "./voronoi-mesh";
import { MarkovNameGenerator } from "../procedural-archive/markov-naming";
import { getLanguageFamilies } from "../procedural-archive/language-families";

// ──────────────────────────────────────────────
// Main Entry Point
// ──────────────────────────────────────────────

export function placeSettlements(graph: PackedGraph, params: WorldGenParams): void {
  const { cells } = graph;
  const n = cells.n;
  const rng = makeRng(params.seed + 400);

  // ── Score all land cells ───────────────────
  const scores: { cell: number; score: number }[] = [];

  for (let i = 0; i < n; i++) {
    if (!isLand(graph, i)) continue;

    let score = 0;

    // Coastal bonus
    if (cells.coastDist[i] === 0) score += 3;

    // River bonus
    if (cells.river[i]! > 0) score += 2;

    // Low elevation bonus (below mountains)
    if (cells.elevZone[i]! < 4) score += 1;

    // Climate bonuses/penalties
    const biome = cells.b[i]!;
    if (biome === 4 || biome === 5 || biome === 6 || biome === 7) {
      // Temperate / Subtropical
      score += 2;
    } else if (biome === 0 || biome === 1) {
      // Tropical
      score += 1;
    } else if (biome === 9 || biome === 10) {
      // Tundra / Ice Cap
      score -= 1;
    }

    // Isolation penalty: fewer than 3 land neighbors
    let landNbrs = 0;
    for (const nb of cells.neighbors[i]!) {
      if (isLand(graph, nb)) landNbrs++;
    }
    if (landNbrs < 3) score -= 2;

    scores.push({ cell: i, score });
  }

  // Sort descending by score
  scores.sort((a, b) => b.score - a.score);

  // ── Place burgs with minimum spacing ───────
  const targetBurgs = Math.max(200, params.countryCountRange[1] * 2);
  const placed = new Uint8Array(n); // 1 = burg placed in this cell
  const burgs: Burg[] = [];

  // Prepare Markov generators per language family
  const families = getLanguageFamilies();
  const generators: MarkovNameGenerator[] = families.map(
    (f, idx) => new MarkovNameGenerator(f, params.seed + 500 + idx)
  );

  for (const { cell } of scores) {
    if (burgs.length >= targetBurgs) break;

    // BFS proximity check: skip if any existing burg within 3 hops
    if (hasBurgWithin(graph, cell, 3, placed)) continue;

    placed[cell] = 1;

    // Detect port: exactly 1 water neighbor = safe harbor
    let waterNbrCount = 0;
    for (const nb of cells.neighbors[cell]!) {
      if (isWater(graph, nb)) waterNbrCount++;
    }
    const isPort = waterNbrCount === 1;

    // Generate name from culture's language family
    const cultureId = cells.culture[cell]!;
    let name = `City${burgs.length + 1}`;
    if (params.useMarkovNaming && cultureId > 0) {
      const culture = graph.cultures[cultureId - 1];
      if (culture) {
        const famIdx = families.findIndex((f) => f && f.id === culture.familyId);
        if (famIdx >= 0 && generators[famIdx]) {
          name = generators[famIdx]!.generate();
        }
      }
    }

    const burg: Burg = {
      id: burgs.length + 1,
      name,
      cell,
      state: 0, // assigned later by states stage
      population: 0, // assigned later
      isCapital: false, // assigned later
      isPort,
      lng: cellLng(graph, cell),
      lat: cellLat(graph, cell),
    };
    burgs.push(burg);
  }

  graph.burgs = burgs;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * BFS check: return true if any cell within `maxHops` of `start` has
 * the `placed` flag set (indicating an existing burg).
 */
function hasBurgWithin(
  graph: PackedGraph,
  start: number,
  maxHops: number,
  placed: Uint8Array
): boolean {
  const { cells } = graph;
  const queue: number[] = [start];
  const visited = new Uint8Array(cells.n);
  const depth = new Uint8Array(cells.n);
  visited[start] = 1;

  let head = 0;
  while (head < queue.length) {
    const cell = queue[head++]!;
    const d = depth[cell]!;

    if (cell !== start && placed[cell]) return true;
    if (d >= maxHops) continue;

    for (const nb of cells.neighbors[cell]!) {
      if (visited[nb]) continue;
      visited[nb] = 1;
      depth[nb] = d + 1;
      queue.push(nb);
    }
  }
  return false;
}
