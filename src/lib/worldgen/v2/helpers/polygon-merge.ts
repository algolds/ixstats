/**
 * UPG v2 — Cell Polygon Merge
 *
 * Merges adjacent Voronoi cells with the same attribute into polygons (a shell and the holes inside
 * it). Core utility for the export layer.
 *
 * Vertices are matched by quantised integer keys (1e-6°, the precision the string keys had): every
 * ring vertex of a mesh is interned to a vertex id once, and merging then works on typed arrays.
 */

import type { WorldGraph } from "../types";
import type { Position } from "geojson";
import { EDGE_INSET, MAX_LATITUDE } from "./chaikin";

/** A closed ring of a merged polygon. */
export interface MergedRing {
  /** Vertices; the last repeats the first. Shells run counter-clockwise, holes clockwise. */
  coordinates: Position[];
  /**
   * Indices into `coordinates` of the vertices where the region across the ring's edge changes: a third
   * region (or the edge of the map) meets this ring there, or the vertex is one of the `coastCorners` the
   * caller passed. Rings that share a border share exactly the chains between their corners, so smoothing
   * chain by chain keeps shared borders identical.
   */
  corners: number[];
  /**
   * Mesh vertex id of each vertex but the closing one, when the ring came from `mergeCells`. Equal ids are
   * equal points, so a chain's ids name its points exactly (see SmoothingCache).
   */
  vertices?: number[];
}

/** A shell followed by the holes inside it. */
export type MergedPolygon = MergedRing[];

/** Labels of what lies beyond each straight edge of the map; cell labels are never negative. */
const WEST_EDGE = -1;
const EAST_EDGE = -2;
const SOUTH_EDGE = -3;
const NORTH_EDGE = -4;

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
  /** Per ring slot k, the edge ids[k] → ids[k + 1]: the cell on the other side of that edge, -1 at the map's edge */
  twin: Int32Array;
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
  /** Ring slot of each directed edge */
  slot: Int32Array;
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

type Point = [number, number];

/**
 * Rings are cut at this latitude, EDGE_INSET short of the one perturbRing holds points to: the perturbation
 * moves a point by up to 0.005°, and a ring pressed against that limit would flatten into overlapping edges.
 */
export const RING_LATITUDE = MAX_LATITUDE - EDGE_INSET;

/**
 * Keep the part of a convex ring on the side of the parallel `limit` where sign * lat <= limit. The point
 * where an edge crosses the parallel is worked out from the edge's end points in a fixed order, so the two
 * cells sharing the edge get the very same point.
 */
function clipToParallel(ring: Point[], sign: 1 | -1, limit: number): Point[] {
  const kept: Point[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const aInside = sign * a[1] <= limit;
    if (aInside) kept.push(a);
    if (aInside === sign * b[1] <= limit) continue;
    const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? [a, b] : [b, a];
    const y = sign * limit;
    kept.push([p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]), y]);
  }
  return kept;
}

/**
 * The part of a cell ring within the latitudes the export holds its rings to (RING_LATITUDE), or an empty
 * ring when none of it is. Exported rings never reach the poles, so the cells there are cut where the
 * export would otherwise have to squash them.
 */
function withinLatitudes(ring: Point[]): Point[] {
  if (ring.every(([, y]) => Math.abs(y) <= RING_LATITUDE)) return ring;
  const open = clipToParallel(
    clipToParallel(ring.slice(0, -1), 1, RING_LATITUDE),
    -1,
    RING_LATITUDE
  );
  return open.length < 3 ? [] : [...open, open[0]!];
}

function buildVertexIndex(cellRings: Point[][]): VertexIndex {
  const vertices = cellRings.map(withinLatitudes);
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
    twin: buildTwins(offsets, ids, count),
    head: new Int32Array(count),
    headEpoch: new Int32Array(count),
    epoch: 0,
    mark: new Int32Array(n),
    markStamp: 0,
    from: new Int32Array(0),
    to: new Int32Array(0),
    next: new Int32Array(0),
    state: new Uint8Array(0),
    slot: new Int32Array(0),
  };
}

/** The cell across each cell edge: the cell whose ring runs the same two vertices the other way. */
function buildTwins(offsets: Int32Array, ids: Int32Array, vertexCount: number): Int32Array {
  const n = offsets.length - 1;
  const twin = new Int32Array(ids.length).fill(-1);
  const owner = new Int32Array(ids.length);
  const next = new Int32Array(ids.length);
  // Per vertex, the slots of the edges leaving it
  const head = new Int32Array(vertexCount).fill(-1);
  for (let c = 0; c < n; c++) {
    for (let k = offsets[c]!; k < offsets[c + 1]! - 1; k++) {
      owner[k] = c;
      next[k] = head[ids[k]!]!;
      head[ids[k]!] = k;
    }
  }
  for (let c = 0; c < n; c++) {
    for (let k = offsets[c]!; k < offsets[c + 1]! - 1; k++) {
      for (let j = head[ids[k + 1]!]!; j >= 0; j = next[j]!) {
        if (ids[j + 1] === ids[k]) {
          twin[k] = owner[j]!;
          break;
        }
      }
    }
  }
  return twin;
}

/** Edge buffers big enough for `edges` directed edges. */
function reserveEdges(index: VertexIndex, edges: number): void {
  if (index.from.length >= edges) return;
  const capacity = Math.max(edges, index.from.length * 2);
  index.from = new Int32Array(capacity);
  index.to = new Int32Array(capacity);
  index.next = new Int32Array(capacity);
  index.state = new Uint8Array(capacity);
  index.slot = new Int32Array(capacity);
}

/** Each cell's neighbours in mesh order, without the antimeridian links: cell c's are links[offsets[c] .. offsets[c + 1]). */
interface Adjacency {
  offsets: Int32Array;
  links: Int32Array;
}

/** Keyed by the mesh's `neighbors` array, which graphs built from a cached mesh share. */
const adjacencies = new WeakMap<object, Adjacency>();

function adjacency(graph: WorldGraph): Adjacency {
  const { neighbors, p, n } = graph.cells;
  let adjacent = adjacencies.get(neighbors);
  if (adjacent && adjacent.offsets.length === n + 1) return adjacent;
  const offsets = new Int32Array(n + 1);
  const links: number[] = [];
  for (let c = 0; c < n; c++) {
    for (const nb of neighbors[c]!) {
      // Antimeridian links share no Voronoi edge: each side becomes its own polygon
      if (Math.abs(p[nb * 2]! - p[c * 2]!) <= 180) links.push(nb);
    }
    offsets[c + 1] = links.length;
  }
  adjacent = { offsets, links: Int32Array.from(links) };
  adjacencies.set(neighbors, adjacent);
  return adjacent;
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
  const { offsets, links } = adjacency(graph);
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

      for (let k = offsets[c]!; k < offsets[c + 1]!; k++) {
        const nb = links[k]!;
        if (mark[nb] === inSet) {
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
  const { offsets, ids, from, to, next, state, slot, head, headEpoch } = index;
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
      slot[count] = k;
      state[count] = reverse >= 0 ? PAIRED : BOUNDARY;
      next[count] = headEpoch[a] === epoch ? head[a]! : -1;
      head[a] = count;
      headEpoch[a] = epoch;
      count++;
    }
  }
  return count;
}

/** Labels the region across each boundary edge of a group, by ring slot. */
type EdgeLabel = (slot: number) => number;

/**
 * Which straight edge of the map a cell edge with no cell across it lies on. The edges meet at the map's
 * corners, so a ring along them changes label there and is cut into straight chains.
 */
function mapEdgeOf(index: VertexIndex, slot: number): number {
  const { ids, xs, ys } = index;
  const [a, b] = [ids[slot]!, ids[slot + 1]!];
  if (xs[a] === xs[b]) return xs[a]! < 0 ? WEST_EDGE : EAST_EDGE;
  return ys[a]! < 0 ? SOUTH_EDGE : NORTH_EDGE;
}

/**
 * Merge a contiguous group of Voronoi cells into polygons.
 *
 * Algorithm: collect all edges (vertex pairs) from cell polygons.
 * Edges shared between two cells in the group are interior → remove them.
 * Remaining edges form closed rings, which are then sorted into shells and holes.
 */
function mergeGroup(
  index: VertexIndex,
  cellIds: number[],
  edgeLabel: EdgeLabel,
  corners?: Uint8Array
): MergedPolygon[] {
  let capacity = 0;
  for (const cell of cellIds) capacity += index.offsets[cell + 1]! - index.offsets[cell]!;
  reserveEdges(index, capacity);

  const edgeCount = recordEdges(index, cellIds);
  const boundary: number[] = [];
  for (let e = 0; e < edgeCount; e++) if (index.state[e] === BOUNDARY) boundary.push(e);
  if (boundary.length === 0) return [];

  return groupRings(chainBoundary(index, boundary, edgeLabel, corners));
}

/**
 * Merge a set of cells into polygons: one per shell, each with the holes inside it. Cells are grouped by
 * contiguity; the cells of one group can still form several shells (the group's cells meet only through the
 * clipped edge of the map at a pole or the antimeridian), and those become polygons of their own.
 *
 * `labelOf` names the region a cell outside the set belongs to (labels are never negative; the default puts
 * all of them in one region). Rings record as corners where that region changes along them, and at the
 * vertices flagged in `corners` (see coastCorners), which every layer is given alike.
 */
export function mergeCells(
  graph: WorldGraph,
  cellIds: number[],
  labelOf: (cell: number) => number = () => 0,
  corners?: Uint8Array
): MergedPolygon[] {
  if (cellIds.length === 0) return [];

  const index = vertexIndex(graph);
  const edgeLabel: EdgeLabel = (slot) => {
    const twin = index.twin[slot]!;
    return twin < 0 ? mapEdgeOf(index, slot) : labelOf(twin);
  };
  const polygons: MergedPolygon[] = [];
  for (const group of findContiguousGroups(graph, index, cellIds)) {
    polygons.push(...mergeGroup(index, group, edgeLabel, corners));
  }
  return polygons;
}

/**
 * The vertices where a coast changes what it borders: a vertex that touches water and at least two different
 * regions (or a region and an edge of the map). `regionOf` names every cell's region, 0 for water.
 *
 * Rings are smoothed chain by chain between their corners, and a ring only knows what lies across its own
 * edge, so a coast has different chains in the political, climate and background layers: the state border
 * that ends the political chain does not end the background one, and the curves differ near the junction.
 * Flag these vertices as corners in every layer and the chains of a shared coast are the same in all of them.
 */
export function coastCorners(graph: WorldGraph, regionOf: (cell: number) => number): Uint8Array {
  const { offsets, ids, xs, ys } = vertexIndex(graph);
  const count = xs.length;
  // The first two different regions seen at each vertex, and how many there are (3 stands for 3 or more)
  const first = new Int32Array(count);
  const second = new Int32Array(count);
  const distinct = new Uint8Array(count);
  const wet = new Uint8Array(count);
  const see = (v: number, region: number) => {
    if (distinct[v] === 0) first[v] = region;
    else if (region === first[v] || (distinct[v]! > 1 && region === second[v])) return;
    else if (distinct[v] === 1) second[v] = region;
    distinct[v] = Math.min(3, distinct[v]! + 1);
  };

  for (let c = 0; c < offsets.length - 1; c++) {
    const region = regionOf(c);
    for (let k = offsets[c]!; k < offsets[c + 1]! - 1; k++) {
      const v = ids[k]!;
      if (region === 0) wet[v] = 1;
      see(v, region);
    }
  }
  const flags = new Uint8Array(count);
  for (let v = 0; v < count; v++) {
    if (xs[v] === -180) see(v, WEST_EDGE);
    if (xs[v] === 180) see(v, EAST_EDGE);
    if (ys[v] === -RING_LATITUDE) see(v, SOUTH_EDGE);
    if (ys[v] === RING_LATITUDE) see(v, NORTH_EDGE);
    flags[v] = wet[v]! & (distinct[v]! >= 3 ? 1 : 0);
  }
  return flags;
}

// Internal: Directed Edge Chaining

/**
 * Chain directed boundary edges into closed rings.
 * Walks the edges leaving each vertex in boundary order, so the rings come out in the same
 * counter-clockwise perimeter order whatever the vertex ids are.
 */
function chainBoundary(
  index: VertexIndex,
  boundary: number[],
  edgeLabel: EdgeLabel,
  flagged?: Uint8Array
): MergedRing[] {
  const { from, to, next, state, slot, head, headEpoch, xs, ys } = index;

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

  const rings: MergedRing[] = [];

  for (const edge of boundary) {
    const startVertex = from[edge]!;
    const startEdge = firstUnused(startVertex);
    if (startEdge < 0) continue;

    const coordinates: Position[] = [[xs[startVertex]!, ys[startVertex]!]];
    const vertices = [startVertex];
    const labels = [edgeLabel(slot[startEdge]!)];
    state[startEdge] = USED;
    let current = to[startEdge]!;
    let safety = boundary.length + 10;

    while (safety-- > 0) {
      coordinates.push([xs[current]!, ys[current]!]);

      if (current === startVertex && coordinates.length > 2) {
        rings.push({ coordinates, corners: cornersOf(labels, vertices, flagged), vertices });
        break;
      }

      const nextEdge = firstUnused(current);
      if (nextEdge < 0) break;

      state[nextEdge] = USED;
      labels.push(edgeLabel(slot[nextEdge]!));
      vertices.push(current);
      current = to[nextEdge]!;
    }
  }

  return rings;
}

/**
 * Vertex i starts edge i: it is a corner where the label across the edge before it differs from the next,
 * or where the vertex is flagged.
 */
function cornersOf(labels: number[], vertices: number[], flagged?: Uint8Array): number[] {
  const corners: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    const changes = labels[i] !== labels[(i + labels.length - 1) % labels.length];
    if (changes || flagged?.[vertices[i]!] === 1) corners.push(i);
  }
  return corners;
}

// Internal: Shells and Holes

/**
 * Area of a ring: positive when it runs counter-clockwise (a shell, as the cell rings do), negative when
 * clockwise (a hole).
 */
export function ringArea(ring: readonly Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[i + 1]!;
    area += (x0! - x1!) * (y1! + y0!);
  }
  return area / 2;
}

/** Even-odd ray cast. */
function contains(ring: Position[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi! > y !== yj! > y && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}

/**
 * Sort rings into polygons by orientation: every counter-clockwise ring is the shell of its own polygon
 * (the disjoint pieces of a group are shells, not holes of the largest piece), every clockwise ring is a
 * hole of the smallest shell that contains it. A hole that no shell contains cannot happen in a sound
 * mesh; it is left out, never attached to a shell it is not inside.
 */
export function groupRings(rings: MergedRing[]): MergedPolygon[] {
  const areas = rings.map((ring) => ringArea(ring.coordinates));
  const order = rings.map((_, i) => i).sort((a, b) => Math.abs(areas[b]!) - Math.abs(areas[a]!));
  const polygons: MergedPolygon[] = [];
  const shellAreas: number[] = [];
  const holes: number[] = [];
  for (const i of order) {
    if (areas[i]! > 0) {
      polygons.push([rings[i]!]);
      shellAreas.push(areas[i]!);
    } else {
      holes.push(i);
    }
  }

  for (const i of holes) {
    const [a, b] = rings[i]!.coordinates;
    const x = (a![0]! + b![0]!) / 2;
    const y = (a![1]! + b![1]!) / 2;
    // Smallest shell first; a shell no bigger than the hole cannot hold it
    for (let p = polygons.length - 1; p >= 0; p--) {
      if (shellAreas[p]! <= -areas[i]!) continue;
      if (contains(polygons[p]![0]!.coordinates, x, y)) {
        polygons[p]!.push(rings[i]!);
        break;
      }
    }
  }
  return polygons;
}
