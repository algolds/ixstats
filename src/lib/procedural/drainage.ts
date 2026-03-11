/**
 * Drainage Network — Extracts river paths from a pit-resolved heightmap.
 *
 * Pipeline:
 *   1. Compute steepest-descent drainage direction for every land cell
 *   2. Topological-sort flow accumulation
 *   3. Extract river paths where flow exceeds threshold
 *   4. Strahler stream ordering for width classification
 *   5. Confluence detection and tributary merging
 */

import type { Position } from "geojson";
import { getNeighbors4 } from "./plate-simulation";

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
}

export interface DrainageResult {
  /** Drainage target per cell (-1 = no target) */
  drainTarget: Int32Array;
  /** Flow accumulation per cell */
  flow: Float32Array;
  /** Extracted river paths */
  rivers: RiverPath[];
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

  // Step 1: Build drainage direction (steepest descent)
  const drainTarget = new Int32Array(N).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isOcean[idx]) continue;

      const h = elevation[idx]!;
      const neighbors = getNeighbors4(x, y, width, height);
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

  // Step 4: Auto-determine flow threshold if not specified
  if (flowThreshold === undefined) {
    // Use a percentile-based threshold: rivers at top ~2% of flow values
    const landFlows = landCells.map(r => flow[r]!).filter(f => f > 1).sort((a, b) => a - b);
    if (landFlows.length > 0) {
      const pctIdx = Math.floor(landFlows.length * 0.98);
      flowThreshold = landFlows[pctIdx]!;
    } else {
      flowThreshold = 50;
    }
    flowThreshold = Math.max(10, flowThreshold);
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

    // Trace the main stem upstream (following highest flow at each junction)
    const path: number[] = [];
    let cur = mouth.idx;

    while (cur >= 0 && !visited[cur] && !isOcean[cur]) {
      path.push(cur);
      visited[cur] = 1;

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
    const coordinates: Position[] = path.map(idx => {
      const x = idx % width;
      const y = (idx - x) / width;
      return [(x / width) * 360 - 180, 90 - (y / height) * 180];
    });

    // Compute Strahler order (simplified: based on flow magnitude)
    const maxFlowInPath = Math.max(...path.map(r => flow[r]!));
    const strahlerOrder = Math.min(6, 1 + Math.floor(Math.log2(maxFlowInPath / flowThreshold)));

    rivers.push({
      cells: path,
      coordinates,
      strahlerOrder: Math.max(1, strahlerOrder),
      maxFlow: maxFlowInPath,
    });
  }

  return { drainTarget, flow, rivers };
}
