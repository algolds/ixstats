/**
 * State Generation — Capital Selection + Dijkstra Expansion + Connectivity
 *
 * The most critical stage: produces clean political borders with NO border gore.
 * Capitals are selected from top-scoring burgs distributed across continents,
 * then Dijkstra expansion claims every land cell. A connectivity pass reassigns
 * any disconnected exclaves to neighboring states.
 */

import type { PackedGraph, WorldGenParams, State, Burg } from "./types";
import { makeRng } from "./rng";
import { isLand, cellLat, cellLng, cellAreaKm2 } from "./voronoi-mesh";
import { MarkovNameGenerator } from "../procedural-archive/markov-naming";
import { getLanguageFamilies } from "../procedural-archive/language-families";

// ──────────────────────────────────────────────
// Main Entry Point
// ──────────────────────────────────────────────

export function generateStates(graph: PackedGraph, params: WorldGenParams): void {
  const { cells } = graph;
  const n = cells.n;
  const rng = makeRng(params.seed + 600);

  const targetCount = Math.round(
    (params.countryCountRange[0] + params.countryCountRange[1]) / 2
  );

  if (graph.burgs.length === 0) return;

  // ── Step 1: Capital Selection ──────────────
  const capitals = selectCapitals(graph, params, targetCount, rng);
  if (capitals.length === 0) return;

  // ── Step 2: Dijkstra Expansion ─────────────
  dijkstraExpand(graph, capitals);

  // ── Step 3: Build State entities ───────────
  const families = getLanguageFamilies();
  const generators: MarkovNameGenerator[] = families.map(
    (f, idx) => new MarkovNameGenerator(f, params.seed + 700 + idx)
  );

  const states: State[] = [];
  for (let s = 0; s < capitals.length; s++) {
    const burg = capitals[s]!;
    const stateId = s + 1;
    const cultureId = cells.culture[burg.cell]!;

    // Name from culture's language family
    let name = `State${stateId}`;
    if (params.useMarkovNaming && cultureId > 0) {
      const culture = graph.cultures[cultureId - 1];
      if (culture) {
        const famIdx = families.findIndex((f) => f.id === culture.familyId);
        if (famIdx >= 0 && generators[famIdx]) {
          name = generators[famIdx]!.generate();
        }
      }
    }

    // Color: golden-ratio hue spacing
    const hue = (stateId * 137.508) % 360;
    const sat = 40 + (rng() * 20); // 40-60%
    const lit = 60 + (rng() * 15); // 60-75%
    const color = hslToHex(hue, sat, lit);

    // Continent name from the capital's landmass feature
    const featureId = cells.f[burg.cell]!;
    const feature = graph.features[featureId];
    const continent = feature && feature.type === "land"
      ? (feature.name || `Continent ${featureId}`)
      : "Unknown";

    // Mark burg as capital
    burg.isCapital = true;
    burg.state = stateId;

    states.push({
      id: stateId,
      name,
      color,
      capital: burg.id,
      cellCount: 0,
      area: 0,
      neighbors: [],
      culture: cultureId,
      continent,
    });
  }

  // ── Step 4: Count cells & area ─────────────
  for (let i = 0; i < n; i++) {
    const sid = cells.state[i]!;
    if (sid > 0 && sid <= states.length) {
      states[sid - 1]!.cellCount++;
      states[sid - 1]!.area += cellAreaKm2(graph, i);
    }
  }

  // Round areas
  for (const st of states) {
    st.area = Math.round(st.area);
  }

  // ── Step 5: Neighbor detection ─────────────
  const neighborSets: Set<number>[] = states.map(() => new Set<number>());
  for (let i = 0; i < n; i++) {
    const sid = cells.state[i]!;
    if (sid === 0) continue;
    for (const nb of cells.neighbors[i]!) {
      const nSid = cells.state[nb]!;
      if (nSid !== 0 && nSid !== sid) {
        neighborSets[sid - 1]!.add(nSid);
      }
    }
  }
  for (let s = 0; s < states.length; s++) {
    states[s]!.neighbors = Array.from(neighborSets[s]!);
  }

  // ── Step 6: Connectivity check ─────────────
  fixDisconnectedRegions(graph, states);

  // ── Step 7: Assign burgs to states ─────────
  for (const burg of graph.burgs) {
    burg.state = cells.state[burg.cell]!;
  }

  graph.states = states;
}

// ──────────────────────────────────────────────
// Capital Selection
// ──────────────────────────────────────────────

/**
 * Select capitals from burgs: highest-scored with minimum spacing,
 * distributed proportionally across continents.
 */
function selectCapitals(
  graph: PackedGraph,
  params: WorldGenParams,
  targetCount: number,
  rng: () => number
): Burg[] {
  const { cells } = graph;
  const burgs = graph.burgs;

  // Group burgs by continent (feature ID of land type)
  const continentBurgs = new Map<number, Burg[]>();
  for (const burg of burgs) {
    const fId = cells.f[burg.cell]!;
    const feature = graph.features[fId];
    if (!feature || feature.type !== "land") continue;
    if (!continentBurgs.has(fId)) continentBurgs.set(fId, []);
    continentBurgs.get(fId)!.push(burg);
  }

  // Compute continent areas and allocate proportional capitals
  let totalLandArea = 0;
  const continentAreas = new Map<number, number>();
  for (const [fId] of continentBurgs) {
    const feature = graph.features[fId];
    const area = feature ? feature.area : 0;
    continentAreas.set(fId, area);
    totalLandArea += area;
  }

  const capitals: Burg[] = [];
  const capitalCells = new Set<number>();

  for (const [fId, cBurgs] of continentBurgs) {
    const area = continentAreas.get(fId) || 0;
    // Proportional allocation (at least 1 per continent)
    let alloc = Math.max(1, Math.round((area / Math.max(1, totalLandArea)) * targetCount));
    alloc = Math.min(alloc, cBurgs.length);

    // Sort burgs on this continent by desirability (port + river + low elev)
    const sorted = [...cBurgs].sort((a, b) => {
      const sa = burgScore(a);
      const sb = burgScore(b);
      return sb - sa;
    });

    let placed = 0;
    for (const burg of sorted) {
      if (placed >= alloc) break;
      if (capitals.length >= targetCount) break;

      // Minimum spacing: no two capitals within 5 hops
      if (isTooClose(graph, burg.cell, capitalCells, 5)) continue;

      capitals.push(burg);
      capitalCells.add(burg.cell);
      placed++;
    }
  }

  return capitals;
}

function burgScore(burg: Burg): number {
  let s = 0;
  if (burg.isPort) s += 3;
  s += 1; // base score (all burgs already passed habitability)
  return s;
}

/**
 * BFS check: return true if `cell` is within `maxHops` of any cell in `targets`.
 */
function isTooClose(
  graph: PackedGraph,
  cell: number,
  targets: Set<number>,
  maxHops: number
): boolean {
  const { cells } = graph;
  const queue: number[] = [cell];
  const visited = new Uint8Array(cells.n);
  const depth = new Uint16Array(cells.n);
  visited[cell] = 1;

  let head = 0;
  while (head < queue.length) {
    const c = queue[head++]!;
    if (c !== cell && targets.has(c)) return true;
    if (depth[c]! >= maxHops) continue;

    for (const nb of cells.neighbors[c]!) {
      if (visited[nb]) continue;
      visited[nb] = 1;
      depth[nb] = depth[c]! + 1;
      queue.push(nb);
    }
  }
  return false;
}

// ──────────────────────────────────────────────
// Dijkstra Expansion
// ──────────────────────────────────────────────

function dijkstraExpand(graph: PackedGraph, capitals: Burg[]): void {
  const { cells } = graph;
  const n = cells.n;

  // Min-heap: [cost, cellId, stateId]
  const heap: [number, number, number][] = [];
  const assigned = new Uint8Array(n);

  function push(cost: number, cell: number, state: number) {
    heap.push([cost, cell, state]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]![0] <= heap[i]![0]) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  }

  function pop(): [number, number, number] | undefined {
    if (heap.length === 0) return undefined;
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let s = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < heap.length && heap[l]![0] < heap[s]![0]) s = l;
        if (r < heap.length && heap[r]![0] < heap[s]![0]) s = r;
        if (s === i) break;
        [heap[i], heap[s]] = [heap[s]!, heap[i]!];
        i = s;
      }
    }
    return top;
  }

  // Initialize: each capital gets its state ID
  for (let s = 0; s < capitals.length; s++) {
    const cell = capitals[s]!.cell;
    const stateId = s + 1;
    cells.state[cell] = stateId;
    assigned[cell] = 1;
    push(0, cell, stateId);
  }

  // Expand
  while (heap.length > 0) {
    const [cost, cell, stateId] = pop()!;
    if (assigned[cell] && cells.state[cell] !== stateId) continue;

    for (const nb of cells.neighbors[cell]!) {
      if (assigned[nb] || !isLand(graph, nb)) continue;

      // Edge cost
      let edgeCost = 1;
      // Mountain penalty
      if (cells.elevZone[nb]! > 4) edgeCost += 3;
      // Culture mismatch penalty
      if (cells.culture[nb] !== cells.culture[cell]) edgeCost += 2;

      cells.state[nb] = stateId;
      assigned[nb] = 1;
      push(cost + edgeCost, nb, stateId);
    }
  }
}

// ──────────────────────────────────────────────
// Connectivity Fix
// ──────────────────────────────────────────────

/**
 * For each state, verify all cells form a single connected component.
 * Reassign disconnected pieces to the largest adjacent state.
 */
function fixDisconnectedRegions(graph: PackedGraph, states: State[]): void {
  const { cells } = graph;
  const n = cells.n;
  const visited = new Uint8Array(n);

  for (const state of states) {
    const sid = state.id;
    // Find all cells of this state
    const stateCells: number[] = [];
    for (let i = 0; i < n; i++) {
      if (cells.state[i] === sid) stateCells.push(i);
    }
    if (stateCells.length === 0) continue;

    // BFS from capital cell to find main component
    const capitalBurg = graph.burgs.find((b) => b.id === state.capital);
    const startCell = capitalBurg ? capitalBurg.cell : stateCells[0]!;

    visited.fill(0);
    const mainComponent = new Set<number>();
    const queue: number[] = [startCell];
    visited[startCell] = 1;
    let head = 0;

    while (head < queue.length) {
      const c = queue[head++]!;
      mainComponent.add(c);
      for (const nb of cells.neighbors[c]!) {
        if (!visited[nb] && cells.state[nb] === sid) {
          visited[nb] = 1;
          queue.push(nb);
        }
      }
    }

    // Reassign cells not in main component
    for (const c of stateCells) {
      if (mainComponent.has(c)) continue;

      // Find the most common adjacent state (other than current)
      const adjCounts = new Map<number, number>();
      for (const nb of cells.neighbors[c]!) {
        const nSid = cells.state[nb]!;
        if (nSid !== 0 && nSid !== sid) {
          adjCounts.set(nSid, (adjCounts.get(nSid) || 0) + 1);
        }
      }

      // Pick the adjacent state with most shared edges
      let bestState = 0;
      let bestCount = 0;
      for (const [adjSid, count] of adjCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestState = adjSid;
        }
      }

      if (bestState > 0) {
        cells.state[c] = bestState;
        // Update counts
        state.cellCount--;
        if (bestState <= states.length) {
          states[bestState - 1]!.cellCount++;
        }
      }
    }
  }
}

// ──────────────────────────────────────────────
// Color Utility
// ──────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
