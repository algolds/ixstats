/**
 * UPG v2 — Cell Polygon Merge
 *
 * Merges adjacent Voronoi cells with the same attribute into
 * (Multi)Polygon GeoJSON features. Core utility for the export layer.
 */

import type { WorldGraph } from "../types";
import type { Position, Polygon, MultiPolygon } from "geojson";

/**
 * Find spatially contiguous groups within a set of cell IDs.
 * Returns an array of connected components.
 */
export function findContiguousGroups(
  graph: WorldGraph,
  cellIds: number[]
): number[][] {
  if (cellIds.length === 0) return [];

  const cellSet = new Set(cellIds);
  const visited = new Set<number>();
  const groups: number[][] = [];

  for (const cell of cellIds) {
    if (visited.has(cell)) continue;

    const group: number[] = [];
    const queue = [cell];
    visited.add(cell);

    while (queue.length > 0) {
      const c = queue.pop()!;
      group.push(c);

      for (const nb of graph.cells.neighbors[c]!) {
        if (!visited.has(nb) && cellSet.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Merge a contiguous group of Voronoi cells into a single Polygon.
 *
 * Algorithm: collect all edges (vertex pairs) from cell polygons.
 * Edges shared between two cells in the group are interior → remove them.
 * Remaining edges form the exterior boundary.
 * Chain edges into a closed ring.
 */
export function mergeCellsToPolygon(
  graph: WorldGraph,
  cellIds: number[]
): Position[][] | null {
  if (cellIds.length === 0) return null;

  if (cellIds.length === 1) {
    const verts = graph.cells.vertices[cellIds[0]!]!;
    if (verts.length < 4) return null;
    return [verts.map(([x, y]) => [x, y] as Position)];
  }

  const cellSet = new Set(cellIds);

  // Collect boundary edges: edges NOT shared between two cells in the group
  // Edge key: sorted vertex pair string
  const edgeCounts = new Map<string, { p1: Position; p2: Position; count: number }>();

  for (const cellId of cellIds) {
    const verts = graph.cells.vertices[cellId]!;
    if (verts.length < 3) continue;

    for (let i = 0; i < verts.length - 1; i++) {
      const [x0, y0] = verts[i]!;
      const [x1, y1] = verts[i + 1]!;

      // Create a canonical key for this edge
      const key =
        x0 < x1 || (x0 === x1 && y0 < y1)
          ? `${x0.toFixed(6)},${y0.toFixed(6)}-${x1.toFixed(6)},${y1.toFixed(6)}`
          : `${x1.toFixed(6)},${y1.toFixed(6)}-${x0.toFixed(6)},${y0.toFixed(6)}`;

      const existing = edgeCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        edgeCounts.set(key, {
          p1: [x0, y0],
          p2: [x1, y1],
          count: 1,
        });
      }
    }
  }

  // Keep only boundary edges (count === 1 = not shared)
  const boundaryEdges: { p1: Position; p2: Position }[] = [];
  for (const edge of edgeCounts.values()) {
    if (edge.count === 1) {
      boundaryEdges.push({ p1: edge.p1, p2: edge.p2 });
    }
  }

  if (boundaryEdges.length === 0) return null;

  // Chain boundary edges into closed rings
  const rings = chainEdges(boundaryEdges);
  if (rings.length === 0) return null;

  // The largest ring is the exterior, rest are holes
  rings.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));

  return rings;
}

/**
 * Merge a set of cells into MultiPolygon coordinates.
 * Handles disconnected groups by creating one polygon per contiguous group.
 */
export function mergeCellsToMultiPolygon(
  graph: WorldGraph,
  cellIds: number[]
): (Polygon | MultiPolygon) | null {
  const groups = findContiguousGroups(graph, cellIds);
  if (groups.length === 0) return null;

  const polygons: Position[][][] = [];

  for (const group of groups) {
    const rings = mergeCellsToPolygon(graph, group);
    if (rings && rings.length > 0) {
      polygons.push(rings);
    }
  }

  if (polygons.length === 0) return null;

  if (polygons.length === 1) {
    return {
      type: "Polygon",
      coordinates: polygons[0]!,
    };
  }

  return {
    type: "MultiPolygon",
    coordinates: polygons,
  };
}

// ──────────────────────────────────────────────
// Internal: Edge Chaining
// ──────────────────────────────────────────────

/**
 * Chain directed edges into closed rings.
 * Uses a vertex adjacency map to walk edges in order.
 */
function chainEdges(edges: { p1: Position; p2: Position }[]): Position[][] {
  // Build adjacency: vertex → list of edges starting there
  const adj = new Map<string, { target: Position; used: boolean }[]>();

  const key = (p: Position) => `${p[0]!.toFixed(6)},${p[1]!.toFixed(6)}`;

  for (const edge of edges) {
    const k = key(edge.p1);
    if (!adj.has(k)) adj.set(k, []);
    adj.get(k)!.push({ target: edge.p2, used: false });
  }

  const rings: Position[][] = [];

  for (const edge of edges) {
    const startKey = key(edge.p1);
    const startEntries = adj.get(startKey);
    if (!startEntries) continue;

    // Find an unused edge starting from this vertex
    const startEntry = startEntries.find(
      (e) => !e.used && Math.abs(e.target[0]! - edge.p2[0]!) < 1e-6 && Math.abs(e.target[1]! - edge.p2[1]!) < 1e-6
    );
    if (!startEntry) continue;

    // Walk the ring
    const ring: Position[] = [edge.p1];
    startEntry.used = true;
    let current = edge.p2;
    let safety = edges.length + 10;

    while (safety-- > 0) {
      ring.push(current);
      const currentKey = key(current);

      if (currentKey === startKey && ring.length > 2) {
        // Ring is closed
        rings.push(ring);
        break;
      }

      const nextEntries = adj.get(currentKey);
      if (!nextEntries) break;

      const next = nextEntries.find((e) => !e.used);
      if (!next) break;

      next.used = true;
      current = next.target;
    }
  }

  return rings;
}

/**
 * Compute the signed area of a ring (for determining exterior vs hole).
 * Positive = counter-clockwise (exterior in GeoJSON), negative = clockwise (hole).
 */
function signedArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[i + 1]!;
    area += (x1! - x0!) * (y1! + y0!);
  }
  return area / 2;
}
