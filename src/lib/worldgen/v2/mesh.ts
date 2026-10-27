/**
 * UPG v2 — High-Resolution Voronoi Mesh Generation
 *
 * Creates the foundational 50K+ cell spatial mesh that ALL world attributes
 * reference. Uses jittered grid → Delaunay triangulation → Voronoi
 * tessellation → Lloyd relaxation.
 *
 * Every cell receives exactly ONE of each attribute (elevation, biome,
 * country, etc.), guaranteeing no layer intersections.
 *
 * The triangulation and the relaxation run in Mercator coordinates (x = longitude, y = Mercator northing in
 * degrees), which keep shapes true at every latitude: a cell near a pole is as square on the globe as one at the
 * equator, where a mesh built in longitude and latitude makes polar cells thin north-south slivers. The grid's
 * density keeps every cell's true area about the same, and the cells come back in longitude and latitude.
 */

// @ts-expect-error d3-delaunay has no declaration file
import { Delaunay } from "d3-delaunay";
import { makeRng } from "./helpers/rng";
import { createEmptyWorldGraph, type MeshGeometry, type WorldGraph } from "./types";
import { toXYZ } from "./helpers/noise";
import { sphericalRingAreaSqKm } from "~/lib/maps/planet";

// Public API

/**
 * Create a high-resolution Voronoi mesh spanning WGS84 [-180,180]×[-90,90].
 *
 * @param seed Deterministic seed
 * @param cellCount Target number of cells (20,000-100,000+)
 * @param lloydIterations Lloyd relaxation passes (default 3)
 * @returns Skeleton WorldGraph with geometry populated, all attribute arrays zeroed
 */
export function createMesh(
  seed: number,
  cellCount: number,
  lloydIterations: number = 3
): WorldGraph {
  const rng = makeRng(seed);

  // Step 1: Generate jittered grid with latitude-compensated density
  const points = generateJitteredGrid(cellCount, rng);
  const n = points.length / 2;

  // Step 2: Delaunay + Voronoi over the whole globe in Mercator coordinates (cells at ±180 are stitched in Step 6;
  // the top and bottom of the bounds are the poles)
  for (let i = 0; i < n; i++) points[i * 2 + 1] = mercatorY(points[i * 2 + 1]!);
  const bounds: [number, number, number, number] = [-180, -POLE_Y, 180, POLE_Y];
  // The triangulation owns a copy of the points: relaxation writes `points` while it reads them
  const delaunay = new Delaunay(points.slice());
  const voronoi = delaunay.voronoi(bounds);

  // Step 3: Lloyd relaxation for uniform cell size
  const centroid = new CentroidSink();
  for (let iter = 0; iter < lloydIterations; iter++) {
    for (let i = 0; i < n; i++) {
      // Centroid of the cell's Voronoi polygon, accumulated while d3 walks its vertices
      centroid.reset();
      voronoi.renderCell(i, centroid);
      if (centroid.vertices < 2) continue;
      const area = centroid.area / 2;
      if (Math.abs(area) < 1e-10) continue;

      // Clamp to bounds
      const cx = Math.max(-179.95, Math.min(179.95, centroid.cx / (6 * area)));
      const cy = Math.max(-SITE_Y, Math.min(SITE_Y, centroid.cy / (6 * area)));

      points[i * 2] = cx;
      points[i * 2 + 1] = cy;
    }

    // Re-triangulate with relaxed points (in place: the buffers are reused)
    delaunay.points.set(points);
    voronoi.update();
  }

  // Step 4: Extract adjacency from Delaunay edges
  const neighbors: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const nbs: number[] = [];
    for (const j of delaunay.neighbors(i)) {
      if (!nbs.includes(j)) nbs.push(j);
    }
    neighbors[i] = nbs;
  }

  // Step 5: Extract cell polygon vertices (d3 hands out fresh rings) and bring them and the sites back to latitude
  const vertices: [number, number][][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ring: [number, number][] | null = voronoi.cellPolygon(i);
    vertices[i] = ring ? ring.map(([x, y]) => [x, latitudeOf(y)]) : [[0, 0]];
    points[i * 2 + 1] = latitudeOf(points[i * 2 + 1]!);
  }

  const graph = createEmptyWorldGraph(n, {
    p: points,
    neighbors,
    vertices,
    boundary: new Uint8Array(n),
  });
  const { cells } = graph;

  // Step 6: Wrap the antimeridian — cells whose edges lie on x = -180 and x = +180 at
  // overlapping latitudes become neighbours, so continents, rivers and borders cross it
  stitchAntimeridian(graph);

  // Step 7: Boundary cells are the polar edge rows (the globe has no east/west edge)
  for (let i = 0; i < n; i++) {
    if (cells.vertices[i]!.some(([, y]) => Math.abs(Math.abs(y) - 90) < 1e-9))
      cells.boundary[i] = 1;
  }

  return graph;
}

const DEGREES = 180 / Math.PI;

/** Mercator northing of a latitude, in degrees (equal to the latitude near the equator). */
export function mercatorY(lat: number): number {
  return DEGREES * Math.log(Math.tan(Math.PI / 4 + lat / (2 * DEGREES)));
}

/** The mesh's poles: the bounds' top and bottom edges stand for latitude ±90. */
const POLE_Y = mercatorY(89.95);
/** Sites stay within the latitudes the grid uses. */
const SITE_Y = mercatorY(89.9);

/** Latitude of a Mercator northing; the bounds' edges are the poles. */
function latitudeOf(y: number): number {
  if (Math.abs(y) >= POLE_Y - 1e-9) return Math.sign(y) * 90;
  return DEGREES * (2 * Math.atan(Math.exp(y / DEGREES)) - Math.PI / 2);
}

/**
 * A drawing context for `Voronoi.renderCell` that sums the polygon centroid terms
 * (Σ (x0+x1)·cross, Σ (y0+y1)·cross, Σ cross) instead of building the polygon.
 */
class CentroidSink {
  cx = 0;
  cy = 0;
  area = 0;
  /** Vertices drawn so far (the closing one excluded) */
  vertices = 0;
  private firstX = 0;
  private firstY = 0;
  private lastX = 0;
  private lastY = 0;

  reset(): void {
    this.cx = 0;
    this.cy = 0;
    this.area = 0;
    this.vertices = 0;
  }

  moveTo(x: number, y: number): void {
    this.firstX = this.lastX = x;
    this.firstY = this.lastY = y;
    this.vertices = 1;
  }

  lineTo(x: number, y: number): void {
    this.edgeTo(x, y);
    this.vertices++;
  }

  closePath(): void {
    this.edgeTo(this.firstX, this.firstY);
  }

  private edgeTo(x1: number, y1: number): void {
    const x0 = this.lastX;
    const y0 = this.lastY;
    const cross = x0 * y1 - x1 * y0;
    this.cx += (x0 + x1) * cross;
    this.cy += (y0 + y1) * cross;
    this.area += cross;
    this.lastX = x1;
    this.lastY = y1;
  }
}

/** Meshes the cache keeps: the current world and the one before it. */
const MESH_CACHE_SIZE = 2;

/**
 * Remembers recent meshes by (seed, cellCount, lloydIterations) so a slider change, which keeps all
 * three, skips the mesh build. Only the geometry is kept: every call returns a fresh graph that
 * shares it, because the generation stages write the attribute arrays and never the geometry.
 */
export class MeshCache {
  private readonly entries = new Map<string, MeshGeometry>();

  constructor(private readonly build: typeof createMesh = createMesh) {}

  get(seed: number, cellCount: number, lloydIterations: number): WorldGraph {
    const key = `${seed}:${cellCount}:${lloydIterations}`;
    const geometry =
      this.entries.get(key) ?? geometryOf(this.build(seed, cellCount, lloydIterations));
    // Re-insert so the map stays ordered oldest first
    this.entries.delete(key);
    this.entries.set(key, geometry);
    if (this.entries.size > MESH_CACHE_SIZE) {
      this.entries.delete(this.entries.keys().next().value!);
    }
    return createEmptyWorldGraph(geometry.p.length / 2, geometry);
  }
}

function geometryOf({ cells }: WorldGraph): MeshGeometry {
  return {
    p: cells.p,
    neighbors: cells.neighbors,
    vertices: cells.vertices,
    boundary: cells.boundary,
  };
}

/** Latitude span of the cell's edge lying on the meridian x (null when it has none). */
function seamSpan(verts: [number, number][], x: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const [vx, vy] of verts) {
    if (Math.abs(vx - x) > 1e-9) continue;
    lo = Math.min(lo, vy);
    hi = Math.max(hi, vy);
  }
  return hi > lo ? [lo, hi] : null;
}

function stitchAntimeridian(graph: WorldGraph): void {
  const { cells } = graph;
  const west: { cell: number; span: [number, number] }[] = [];
  const east: { cell: number; span: [number, number] }[] = [];
  for (let i = 0; i < cells.n; i++) {
    const w = seamSpan(cells.vertices[i]!, -180);
    if (w) west.push({ cell: i, span: w });
    const e = seamSpan(cells.vertices[i]!, 180);
    if (e) east.push({ cell: i, span: e });
  }
  west.sort((a, b) => a.span[0] - b.span[0]);
  east.sort((a, b) => a.span[0] - b.span[0]);
  // Two-pointer sweep over the two sorted lists of latitude intervals
  let j = 0;
  for (const w of west) {
    while (j < east.length && east[j]!.span[1] <= w.span[0]) j++;
    for (let k = j; k < east.length && east[k]!.span[0] < w.span[1]; k++) {
      const e = east[k]!.cell;
      if (!cells.neighbors[w.cell]!.includes(e)) {
        cells.neighbors[w.cell]!.push(e);
        cells.neighbors[e]!.push(w.cell);
      }
    }
  }
}

/** Signed longitude difference b − a wrapped into [-180, 180]. */
export function lngDelta(a: number, b: number): number {
  let d = b - a;
  if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  return d;
}

const unitVectors = new WeakMap<Float64Array, Float64Array>();

/**
 * Unit-sphere coordinates of every cell, packed [x0,y0,z0, x1,y1,z1, ...]. Computed once per mesh
 * (graphs sharing a cached mesh share it too).
 */
export function cellVectors(graph: WorldGraph): Float64Array {
  const { p, n } = graph.cells;
  let vectors = unitVectors.get(p);
  if (!vectors || vectors.length !== n * 3) {
    vectors = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = toXYZ(p[i * 2]!, p[i * 2 + 1]!);
      vectors[i * 3] = x;
      vectors[i * 3 + 1] = y;
      vectors[i * 3 + 2] = z;
    }
    unitVectors.set(p, vectors);
  }
  return vectors;
}

/** Squared chord distance between cells a and b on the unit sphere (monotonic in great-circle distance). */
export function chord2(sphere: Float64Array, a: number, b: number): number {
  return (
    (sphere[a * 3]! - sphere[b * 3]!) ** 2 +
    (sphere[a * 3 + 1]! - sphere[b * 3 + 1]!) ** 2 +
    (sphere[a * 3 + 2]! - sphere[b * 3 + 2]!) ** 2
  );
}

// Utility: Cell Accessors

/** Get the longitude of cell i. */
export function cellLng(graph: WorldGraph, i: number): number {
  return graph.cells.p[i * 2]!;
}

/** Get the latitude of cell i. */
export function cellLat(graph: WorldGraph, i: number): number {
  return graph.cells.p[i * 2 + 1]!;
}

const cellAreas = new WeakMap<object, Float64Array>();

/**
 * Area of cell i in km²: the geodesic area of its polygon on Earth's sphere, the measure PostGIS geography gives the
 * exported polygons. The cells tile the globe, so they sum to the planet's surface (510.07 million km²).
 */
export function cellAreaKm2(graph: WorldGraph, i: number): number {
  // Computed for every cell on first use and shared by the graphs of one (cached) mesh
  let areas = cellAreas.get(graph.cells.vertices);
  if (!areas || areas.length !== graph.cells.n) {
    areas = new Float64Array(graph.cells.n);
    for (let c = 0; c < areas.length; c++)
      areas[c] = sphericalRingAreaSqKm(graph.cells.vertices[c]!);
    cellAreas.set(graph.cells.vertices, areas);
  }
  return areas[i]!;
}

// Internal: Jittered Grid Generation

/**
 * Generate jittered grid points with latitude-aware density.
 * More points per unit area near the poles to counteract Mercator distortion
 * and ensure uniform cell density on a sphere.
 *
 * @returns Flat array [lng0,lat0, lng1,lat1, ...]
 */
function generateJitteredGrid(targetCount: number, rng: () => number): Float64Array {
  // Calculate grid dimensions for approximately targetCount cells
  // Aspect ratio: longitude span (360°) is 2× latitude span (180°)
  const aspectRatio = 360 / 180;
  const cols = Math.round(Math.sqrt(targetCount * aspectRatio));
  const rows = Math.round(targetCount / cols);
  const cellH = 180 / rows;

  const points: number[] = [];

  for (let row = 0; row < rows; row++) {
    const lat = -90 + (row + 0.5) * cellH;
    const latRad = (Math.abs(lat) * Math.PI) / 180;

    // Latitude density compensation: a degree of longitude shrinks with cos(latitude), so a row has that
    // many fewer cells and every cell covers about the same true area, up to the poles
    const effectiveCols = Math.max(3, Math.round(cols * Math.cos(latRad)));
    const effectiveCellW = 360 / effectiveCols;

    for (let col = 0; col < effectiveCols; col++) {
      const lng = -180 + (col + 0.5) * effectiveCellW;

      // Jitter: ±40% of cell size
      const jx = (rng() - 0.5) * effectiveCellW * 0.8;
      const jy = (rng() - 0.5) * cellH * 0.8;

      const finalLng = Math.max(-179.95, Math.min(179.95, lng + jx));
      const finalLat = Math.max(-89.9, Math.min(89.9, lat + jy));

      points.push(finalLng, finalLat);
    }
  }

  return Float64Array.from(points);
}

/**
 * Farthest-point sampling: select N well-distributed cells from the mesh.
 * Used for tectonic plate seeds and continent centers.
 */
export function farthestPointSample(graph: WorldGraph, count: number, rng: () => number): number[] {
  const { cells } = graph;
  const n = cells.n;
  const sphere = cellVectors(graph);
  const firstCenter = Math.floor(rng() * n);
  const centers: number[] = [firstCenter];
  const dist = new Float64Array(n).fill(Infinity);
  const chosen = new Uint8Array(n);
  chosen[firstCenter] = 1;

  for (let k = 1; k < count; k++) {
    const last = centers[k - 1]!;

    for (let i = 0; i < n; i++) {
      const d2 = chord2(sphere, i, last);
      if (d2 < dist[i]!) dist[i] = d2;
    }

    // Find the cell farthest from all existing centers (skip already chosen)
    let best = -1;
    let bestDist = -1;
    for (let i = 0; i < n; i++) {
      if (chosen[i]) continue;
      if (dist[i]! > bestDist) {
        bestDist = dist[i]!;
        best = i;
      }
    }
    if (best < 0) break; // no more cells available
    chosen[best] = 1;
    centers.push(best);
  }

  return centers;
}
