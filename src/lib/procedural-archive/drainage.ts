/**
 * Drainage Network — Extracts river paths from a pit-resolved heightmap.
 *
 * Pipeline:
 *   1. Compute steepest-descent drainage direction for every land cell (8-connected)
 *   2. Topological-sort flow accumulation
 *   3. River downcutting — reduce elevation along high-flow cells
 *   4. Extract river paths where flow exceeds threshold
 *   5. Proper Strahler stream ordering via upstream traversal
 *   6. Confluence detection and tributary merging
 */

import type { Position } from "geojson";
import { getNeighbors8 } from "./plate-simulation";

// ─── Constants ───────────────────────────────────────────────

/** Minimum flow accumulation to qualify as a river cell */
const MIN_FLUX = 30;

// ─── Types ───────────────────────────────────────────────────

export interface RiverPath {
  /** Pixel coordinates of the river path */
  cells: number[];
  /** GeoJSON coordinates (lng, lat) */
  coordinates: Position[];
  /** Strahler stream order (1 = headwater, higher = larger) */
  strahlerOrder: number;
  /** Maximum flow accumulation along the path */
  maxFlow: number;
  /** ID of the parent river this tributary merged into (confluence) */
  parentRiverId?: number;
  /** Width at the river source (flux-based) */
  sourceWidth?: number;
  /** Maximum width at the river mouth (flux-based) */
  maxWidth?: number;
}

export interface Confluence {
  /** Cell index where two rivers meet */
  cellIdx: number;
  /** River ID that won (higher flux) */
  winnerRiverId: number;
  /** River ID that lost (lower flux, becomes tributary) */
  loserRiverId: number;
  /** Flow accumulation at the confluence point */
  flowAtConfluence: number;
}

export interface DrainageResult {
  /** Drainage target per cell (-1 = no target) */
  drainTarget: Int32Array;
  /** Flow accumulation per cell */
  flow: Float32Array;
  /** Extracted river paths */
  rivers: RiverPath[];
  /** Confluence points where rivers merge */
  confluences?: Confluence[];
}

// ─── Main Entry ──────────────────────────────────────────────

/**
 * Build drainage network and extract rivers from a heightmap.
 *
 * @param elevation Post-erosion heightmap (pit-resolved)
 * @param isOcean Ocean mask
 * @param width Grid width
 * @param height Grid height
 * @param flowThreshold Minimum flow for river extraction (default: auto)
 * @param maxRivers Maximum number of rivers to extract
 */
export function extractDrainageNetwork(
  elevation: Float32Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  flowThreshold?: number,
  maxRivers: number = 1200
): DrainageResult {
  const N = width * height;

  // Step 1: Build drainage direction (steepest descent, 8-connected)
  const drainTarget = new Int32Array(N).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isOcean[idx]) continue;

      const h = elevation[idx]!;
      const neighbors = getNeighbors8(x, y, width, height);
      let bestNb = -1;
      let bestDrop = 0;

      for (const nb of neighbors) {
        const drop = h - elevation[nb]!;
        if (drop > bestDrop) {
          bestDrop = drop;
          bestNb = nb;
        }
      }

      drainTarget[idx] = bestNb;
    }
  }

  // Step 2: Sort land cells by descending elevation
  const landCells: number[] = [];
  for (let i = 0; i < N; i++) {
    if (!isOcean[i]) landCells.push(i);
  }
  landCells.sort((a, b) => elevation[b]! - elevation[a]!);

  // Step 3: Flow accumulation (topological order = descending elevation)
  const flow = new Float32Array(N);
  for (const r of landCells) flow[r] = 1; // Each cell contributes 1

  for (const r of landCells) {
    const target = drainTarget[r]!;
    if (target >= 0) {
      flow[target] += flow[r]!;
    }
  }

  // Step 3b: River downcutting — reduce elevation along high-flow cells.
  // The elevation array is modified in-place for downstream consumers.
  for (const r of landCells) {
    if (flow[r]! > 1) {
      elevation[r] -= Math.min(5, flow[r]! * 0.001);
    }
  }

  // Step 4: Auto-determine flow threshold
  // Prefer MIN_FLUX as default; fall back to percentile if it produces
  // too many rivers (> maxRivers * 2) or too few (< 10).
  if (flowThreshold === undefined) {
    flowThreshold = MIN_FLUX;

    // Count how many mouths MIN_FLUX would produce
    let mouthCount = 0;
    for (const r of landCells) {
      if (flow[r]! < flowThreshold) continue;
      const target = drainTarget[r]!;
      if (target >= 0 && isOcean[target]) mouthCount++;
    }

    // Fall back to percentile logic if MIN_FLUX gives bad results
    if (mouthCount > maxRivers * 2 || mouthCount < 10) {
      const landFlows = landCells
        .map((r) => flow[r]!)
        .filter((f) => f > 1)
        .sort((a, b) => a - b);
      if (landFlows.length > 0) {
        const pctIdx = Math.floor(landFlows.length * 0.98);
        flowThreshold = landFlows[pctIdx]!;
      } else {
        flowThreshold = 50;
      }
      flowThreshold = Math.max(10, flowThreshold);
    }
  }

  // Step 5: Extract river paths
  // Find river mouths: high-flow cells that drain into ocean
  const mouths: Array<{ idx: number; flow: number }> = [];
  for (const r of landCells) {
    if (flow[r]! < flowThreshold) continue;
    const target = drainTarget[r]!;
    if (target >= 0 && isOcean[target]) {
      mouths.push({ idx: r, flow: flow[r]! });
    }
  }

  // Sort mouths by flow (largest rivers first)
  mouths.sort((a, b) => b.flow - a.flow);

  // Trace each river upstream from its mouth
  const visited = new Uint8Array(N);
  const rivers: RiverPath[] = [];
  const confluences: Confluence[] = [];

  // Track which river owns each cell (for confluence detection)
  const cellOwner = new Int32Array(N).fill(-1);

  // Build upstream graph: for each cell, which cells drain INTO it?
  const upstreamOf = new Array<number[]>(N);
  for (let i = 0; i < N; i++) upstreamOf[i] = [];
  for (const r of landCells) {
    const target = drainTarget[r]!;
    if (target >= 0 && !isOcean[target]) {
      upstreamOf[target]!.push(r);
    }
  }

  for (const mouth of mouths) {
    if (rivers.length >= maxRivers) break;
    if (visited[mouth.idx]) continue;

    const riverId = rivers.length;

    // Trace the main stem upstream (following highest flow at each junction)
    const path: number[] = [];
    let cur = mouth.idx;
    let parentRiverId: number | undefined;

    while (cur >= 0 && !isOcean[cur]) {
      // Confluence merging: if another river already owns this cell,
      // the higher-flux one wins.
      if (visited[cur]) {
        const existingOwner = cellOwner[cur]!;
        if (existingOwner >= 0 && existingOwner !== riverId) {
          const existingRiver = rivers[existingOwner];
          if (existingRiver) {
            if (mouth.flow > existingRiver.maxFlow) {
              // Current river wins — the existing river becomes a tributary
              existingRiver.parentRiverId = riverId;
              confluences.push({
                cellIdx: cur,
                winnerRiverId: riverId,
                loserRiverId: existingOwner,
                flowAtConfluence: flow[cur]!,
              });
            } else {
              // Existing river wins — current river becomes a tributary
              parentRiverId = existingOwner;
              confluences.push({
                cellIdx: cur,
                winnerRiverId: existingOwner,
                loserRiverId: riverId,
                flowAtConfluence: flow[cur]!,
              });
            }
          }
        }
        break;
      }

      path.push(cur);
      visited[cur] = 1;
      cellOwner[cur] = riverId;

      // Find highest-flow upstream neighbor
      const upstream = upstreamOf[cur]!;
      if (upstream.length === 0) break;

      let bestUp = -1;
      let bestFlow = flowThreshold * 0.5; // Minimum to continue
      for (const up of upstream) {
        if (!visited[up] && flow[up]! > bestFlow) {
          bestFlow = flow[up]!;
          bestUp = up;
        }
      }
      cur = bestUp;
    }

    if (path.length < 3) continue; // Skip tiny streams

    // Reverse so path goes downstream (source to mouth)
    path.reverse();

    // Convert to GeoJSON coordinates
    const coordinates: Position[] = path.map((idx) => {
      const x = idx % width;
      const y = (idx - x) / width;
      return [(x / width) * 360 - 180, 90 - (y / height) * 180];
    });

    const maxFlowInPath = Math.max(...path.map((r) => flow[r]!));

    // Flux-based width
    const sourceWidth = Math.pow(maxFlowInPath, 0.9) / 500;
    const maxWidth = Math.pow(maxFlowInPath / 1.5, 1.8) / 500;

    rivers.push({
      cells: path,
      coordinates,
      strahlerOrder: 1, // Placeholder — computed properly below
      maxFlow: maxFlowInPath,
      parentRiverId,
      sourceWidth,
      maxWidth,
    });
  }

  // Step 6: Proper Strahler stream ordering
  // Compute Strahler order bottom-up through the upstream graph.
  // strahlerAt[cell] = the Strahler order at that cell.
  const strahlerAt = new Uint8Array(N);

  // Process cells from highest elevation (headwaters) to lowest.
  // landCells is already sorted by descending elevation.
  for (const cell of landCells) {
    const upstream = upstreamOf[cell]!;

    if (upstream.length === 0) {
      // Headwater cell
      strahlerAt[cell] = 1;
      continue;
    }

    // Collect Strahler orders of upstream tributaries that are part of rivers
    let maxOrder = 0;
    let maxOrderCount = 0;

    for (const up of upstream) {
      const upOrder = strahlerAt[up]!;
      if (upOrder > maxOrder) {
        maxOrder = upOrder;
        maxOrderCount = 1;
      } else if (upOrder === maxOrder && upOrder > 0) {
        maxOrderCount++;
      }
    }

    if (maxOrder === 0) {
      strahlerAt[cell] = 1;
    } else if (maxOrderCount >= 2) {
      // Two or more tributaries of the same highest order → increment
      strahlerAt[cell] = maxOrder + 1;
    } else {
      // Different orders → take the max
      strahlerAt[cell] = maxOrder;
    }
  }

  // Assign the maximum Strahler order along each river path
  for (const river of rivers) {
    let maxOrder = 1;
    for (const cell of river.cells) {
      if (strahlerAt[cell]! > maxOrder) maxOrder = strahlerAt[cell]!;
    }
    river.strahlerOrder = Math.max(1, Math.min(6, maxOrder));
  }

  return { drainTarget, flow, rivers, confluences };
}
