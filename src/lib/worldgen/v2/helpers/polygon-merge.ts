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
export function findContiguousGroups(graph: WorldGraph, cellIds: number[]): number[][] {
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
export function mergeCellsToPolygon(graph: WorldGraph, cellIds: number[]): Position[][] | null {
  if (cellIds.length === 0) return null;

  if (cellIds.length === 1) {
    const verts = graph.cells.vertices[cellIds[0]!]!;
    if (verts.length < 4) return null;
    return [verts.map(([x, y]) => [x, y] as Position)];
  }

  // Directed edge map: "x0,y0->x1,y1" => { p1, p2 }
  const directedEdges = new Map<string, { p1: Position; p2: Position }>();

  for (const cellId of cellIds) {
    const verts = graph.cells.vertices[cellId]!;
    if (verts.length < 3) continue;

    for (let i = 0; i < verts.length - 1; i++) {
      const [x0, y0] = verts[i]!;
      const [x1, y1] = verts[i + 1]!;

      const key = `${x0.toFixed(6)},${y0.toFixed(6)}->${x1.toFixed(6)},${y1.toFixed(6)}`;
      directedEdges.set(key, { p1: [x0, y0], p2: [x1, y1] });
    }
  }

  // Keep only boundary directed edges (where reverse edge is NOT present in cell group)
  const boundaryEdges: { p1: Position; p2: Position }[] = [];
  for (const [key, edge] of directedEdges) {
    const [startStr, endStr] = key.split("->");
    const revKey = `${endStr}->${startStr}`;
    if (!directedEdges.has(revKey)) {
      boundaryEdges.push(edge);
    }
  }

  if (boundaryEdges.length === 0) return null;

  // Chain directed boundary edges into closed rings
  const rings = chainDirectedEdges(boundaryEdges);
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
// Internal: Directed Edge Chaining
// ──────────────────────────────────────────────

/**
 * Chain directed boundary edges into closed rings.
 * Uses a vertex adjacency map to walk edges in exact counter-clockwise perimeter order.
 */
function chainDirectedEdges(edges: { p1: Position; p2: Position }[]): Position[][] {
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

    const unusedEntry = startEntries.find((e) => !e.used);
    if (!unusedEntry) continue;

    const ring: Position[] = [edge.p1];
    unusedEntry.used = true;
    let current = unusedEntry.target;
    let safety = edges.length + 10;

    while (safety-- > 0) {
      ring.push(current);
      const currKey = key(current);

      if (currKey === startKey && ring.length > 2) {
        rings.push(ring);
        break;
      }

      const nextEntries = adj.get(currKey);
      if (!nextEntries) break;

      const nextEntry = nextEntries.find((e) => !e.used);
      if (!nextEntry) break;

      nextEntry.used = true;
      current = nextEntry.target;
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
