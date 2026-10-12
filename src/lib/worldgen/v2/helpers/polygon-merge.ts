/**
 * UPG v2 — Cell Polygon Merge
 *
 * Merges adjacent Voronoi cells with the same attribute into
 * (Multi)Polygon GeoJSON features. Core utility for the export layer.
 *
 * Vertices are matched by quantised integer keys (1e-6°, the precision the string keys had): every
 * ring vertex of a mesh is interned to a vertex id once, and merging then works on typed arrays.
 */

import type { WorldGraph } from "../types";
import type { Position, Polygon, MultiPolygon } from "geojson";

/** Degrees are quantised to 1/QUANTUM; (lng + 180, lat + 90) × QUANTUM stays inside int32. */
const QUANTUM = 1e6;

/** Edge state while merging a group. */
const PAIRED = 0;
const BOUNDARY = 1;
const USED = 2;

/** Vertex ids of a mesh's cell rings, plus scratch buffers reused by every merge on that mesh. */
interface VertexIndex {
  /** Ring of cell c occupies ids[offsets[c] .. offsets[c + 1]) */
  offsets: Int32Array;
  ids: Int32Array;
  /** Coordinates by vertex id */
  xs: Float64Array;
  ys: Float64Array;
  /** Per vertex: the head of its edge list, valid when headEpoch matches the merge's epoch */
  head: Int32Array;
  headEpoch: Int32Array;
  epoch: number;
  /** Contiguous-group search marks, valid when equal to the search's stamp */
  mark: Int32Array;
  markStamp: number;
  /** Directed edges of the group being merged */
  from: Int32Array;
  to: Int32Array;
  next: Int32Array;
  state: Uint8Array;
}

/** Keyed by the mesh's `vertices` array, which graphs built from a cached mesh share. */
const indexes = new WeakMap<object, VertexIndex>();

function vertexIndex(graph: WorldGraph): VertexIndex {
  const { vertices } = graph.cells;
  let index = indexes.get(vertices);
  if (!index || index.offsets.length !== vertices.length + 1) {
    index = buildVertexIndex(vertices);
    indexes.set(vertices, index);
  }
  return index;
}

function buildVertexIndex(vertices: [number, number][][]): VertexIndex {
  const n = vertices.length;
  const offsets = new Int32Array(n + 1);
  for (let c = 0; c < n; c++) offsets[c + 1] = offsets[c]! + vertices[c]!.length;
  const total = offsets[n]!;
  const ids = new Int32Array(total);
  const xs = new Float64Array(total);
  const ys = new Float64Array(total);

  // Open-addressing table over the quantised (x, y) pairs
  let size = 2;
  while (size < total * 2) size *= 2;
  const slotX = new Int32Array(size);
  const slotY = new Int32Array(size);
  const slotId = new Int32Array(size).fill(-1);
  let count = 0;

  for (let c = 0; c < n; c++) {
    const ring = vertices[c]!;
    for (let k = 0; k < ring.length; k++) {
      const [x, y] = ring[k]!;
      const qx = Math.round((x + 180) * QUANTUM);
      const qy = Math.round((y + 90) * QUANTUM);
      let h = Math.imul(qx, 0x9e3779b1) ^ Math.imul(qy, 0x85ebca6b);
      h ^= h >>> 15;
      let slot = h & (size - 1);
      while (slotId[slot]! >= 0 && (slotX[slot] !== qx || slotY[slot] !== qy)) {
        slot = (slot + 1) & (size - 1);
      }
      if (slotId[slot]! < 0) {
        slotX[slot] = qx;
        slotY[slot] = qy;
        slotId[slot] = count;
        xs[count] = x;
        ys[count] = y;
        count++;
      }
      ids[offsets[c]! + k] = slotId[slot]!;
    }
  }

  return {
    offsets,
    ids,
    xs: xs.slice(0, count),
    ys: ys.slice(0, count),
    head: new Int32Array(count),
    headEpoch: new Int32Array(count),
    epoch: 0,
    mark: new Int32Array(n),
    markStamp: 0,
    from: new Int32Array(0),
    to: new Int32Array(0),
    next: new Int32Array(0),
    state: new Uint8Array(0),
  };
}

/** Edge buffers big enough for `edges` directed edges. */
function reserveEdges(index: VertexIndex, edges: number): void {
  if (index.from.length >= edges) return;
  const capacity = Math.max(edges, index.from.length * 2);
  index.from = new Int32Array(capacity);
  index.to = new Int32Array(capacity);
  index.next = new Int32Array(capacity);
  index.state = new Uint8Array(capacity);
}

/**
 * Find spatially contiguous groups within a set of cell IDs.
 * Returns an array of connected components.
 */
function findContiguousGroups(
  graph: WorldGraph,
  index: VertexIndex,
  cellIds: number[]
): number[][] {
  if (cellIds.length === 0) return [];

  // A cell is in the set when marked `inSet`, visited when marked `visited`
  const { mark } = index;
  const inSet = (index.markStamp += 2);
  const visited = inSet + 1;
  for (const cell of cellIds) mark[cell] = inSet;
  const groups: number[][] = [];

  for (const cell of cellIds) {
    if (mark[cell] === visited) continue;

    const group: number[] = [];
    const queue = [cell];
    mark[cell] = visited;

    while (queue.length > 0) {
      const c = queue.pop()!;
      group.push(c);

      for (const nb of graph.cells.neighbors[c]!) {
        // Antimeridian links share no Voronoi edge: each side becomes its own polygon
        const wraps = Math.abs(graph.cells.p[nb * 2]! - graph.cells.p[c * 2]!) > 180;
        if (!wraps && mark[nb] === inSet) {
          mark[nb] = visited;
          queue.push(nb);
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Record the directed edges of the group's cells. An edge whose reverse is also present is
 * interior (both are paired off); the rest are the boundary. Returns the number of edges recorded.
 *
 * Each vertex keeps a linked list of the edges leaving it, so finding an edge or its reverse
 * scans the (at most a few) edges at one vertex.
 */
function recordEdges(index: VertexIndex, cellIds: number[]): number {
  const { offsets, ids, from, to, next, state, head, headEpoch } = index;
  const epoch = ++index.epoch;
  const find = (a: number, b: number): number => {
    for (let e = headEpoch[a] === epoch ? head[a]! : -1; e >= 0; e = next[e]!) {
      if (to[e] === b) return e;
    }
    return -1;
  };

  let count = 0;
  for (const cell of cellIds) {
    const start = offsets[cell]!;
    const end = offsets[cell + 1]!;
    if (end - start < 3) continue;
    for (let k = start; k < end - 1; k++) {
      const a = ids[k]!;
      const b = ids[k + 1]!;
      if (a === b || find(a, b) >= 0) continue;
      const reverse = find(b, a);
      if (reverse >= 0) state[reverse] = PAIRED;
      from[count] = a;
      to[count] = b;
      state[count] = reverse >= 0 ? PAIRED : BOUNDARY;
      next[count] = headEpoch[a] === epoch ? head[a]! : -1;
      head[a] = count;
      headEpoch[a] = epoch;
      count++;
    }
  }
  return count;
}

/**
 * Merge a contiguous group of Voronoi cells into a single Polygon.
 *
 * Algorithm: collect all edges (vertex pairs) from cell polygons.
 * Edges shared between two cells in the group are interior → remove them.
 * Remaining edges form the exterior boundary.
 * Chain edges into a closed ring.
 */
function mergeCellsToPolygon(
  graph: WorldGraph,
  index: VertexIndex,
  cellIds: number[]
): Position[][] | null {
  if (cellIds.length === 0) return null;

  if (cellIds.length === 1) {
    const verts = graph.cells.vertices[cellIds[0]!]!;
    if (verts.length < 4) return null;
    return [verts.map(([x, y]) => [x, y] as Position)];
  }

  let capacity = 0;
  for (const cell of cellIds) capacity += index.offsets[cell + 1]! - index.offsets[cell]!;
  reserveEdges(index, capacity);

  const edgeCount = recordEdges(index, cellIds);
  const boundary: number[] = [];
  for (let e = 0; e < edgeCount; e++) if (index.state[e] === BOUNDARY) boundary.push(e);
  if (boundary.length === 0) return null;

  // Chain directed boundary edges into closed rings
  const rings = chainBoundary(index, boundary);
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
  if (cellIds.length === 0) return null;

  const index = vertexIndex(graph);
  const groups = findContiguousGroups(graph, index, cellIds);
  const polygons: Position[][][] = [];

  for (const group of groups) {
    const rings = mergeCellsToPolygon(graph, index, group);
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

// Internal: Directed Edge Chaining

/**
 * Chain directed boundary edges into closed rings.
 * Walks the edges leaving each vertex in boundary order, so the rings come out in the same
 * counter-clockwise perimeter order whatever the vertex ids are.
 */
function chainBoundary(index: VertexIndex, boundary: number[]): Position[][] {
  const { from, to, next, state, head, headEpoch, xs, ys } = index;

  // Relink the boundary edges per start vertex, first boundary edge first
  const epoch = ++index.epoch;
  for (let i = boundary.length - 1; i >= 0; i--) {
    const e = boundary[i]!;
    const v = from[e]!;
    next[e] = headEpoch[v] === epoch ? head[v]! : -1;
    head[v] = e;
    headEpoch[v] = epoch;
  }
  const firstUnused = (v: number): number => {
    let e = headEpoch[v] === epoch ? head[v]! : -1;
    while (e >= 0 && state[e] === USED) e = next[e]!;
    return e;
  };

  const rings: Position[][] = [];

  for (const edge of boundary) {
    const startVertex = from[edge]!;
    const startEdge = firstUnused(startVertex);
    if (startEdge < 0) continue;

    const ring: Position[] = [[xs[startVertex]!, ys[startVertex]!]];
    state[startEdge] = USED;
    let current = to[startEdge]!;
    let safety = boundary.length + 10;

    while (safety-- > 0) {
      ring.push([xs[current]!, ys[current]!]);

      if (current === startVertex && ring.length > 2) {
        rings.push(ring);
        break;
      }

      const nextEdge = firstUnused(current);
      if (nextEdge < 0) break;

      state[nextEdge] = USED;
      current = to[nextEdge]!;
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
