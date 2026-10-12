/**
 * UPG v2 — High-Resolution Voronoi Mesh Generation
 *
 * Creates the foundational 50K+ cell spatial mesh that ALL world attributes
 * reference. Uses jittered grid → Delaunay triangulation → Voronoi
 * tessellation → Lloyd relaxation.
 *
 * Every cell receives exactly ONE of each attribute (elevation, biome,
 * country, etc.), guaranteeing no layer intersections.
 */

// @ts-expect-error d3-delaunay has no declaration file
import { Delaunay } from "d3-delaunay";
import { makeRng } from "./helpers/rng";
import { createEmptyWorldGraph, type WorldGraph } from "./types";
import { toXYZ } from "./helpers/noise";
import { kmPerDegreeLat, kmPerDegreeLng } from "~/lib/maps/planet";

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

  // Step 2: Delaunay + Voronoi over the whole globe (cells at ±180 are stitched in Step 7)
  const bounds: [number, number, number, number] = [-180, -90, 180, 90];
  let delaunay = Delaunay.from(
    Array.from({ length: n }, (_, i) => [points[i * 2]!, points[i * 2 + 1]!])
  );
  let voronoi = delaunay.voronoi(bounds);

  // Step 3: Lloyd relaxation for uniform cell size
  for (let iter = 0; iter < lloydIterations; iter++) {
    for (let i = 0; i < n; i++) {
      const poly = voronoi.cellPolygon(i);
      if (!poly || poly.length < 3) continue;

      // Compute centroid of Voronoi polygon
      let cx = 0,
        cy = 0,
        area = 0;
      for (let j = 0; j < poly.length - 1; j++) {
        const [x0, y0] = poly[j]!;
        const [x1, y1] = poly[j + 1]!;
        const cross = x0 * y1 - x1 * y0;
        cx += (x0 + x1) * cross;
        cy += (y0 + y1) * cross;
        area += cross;
      }
      area /= 2;
      if (Math.abs(area) < 1e-10) continue;
      cx /= 6 * area;
      cy /= 6 * area;

      // Clamp to bounds
      cx = Math.max(-179.95, Math.min(179.95, cx));
      cy = Math.max(-89.9, Math.min(89.9, cy));

      points[i * 2] = cx;
      points[i * 2 + 1] = cy;
    }

    // Re-triangulate with relaxed points
    delaunay = Delaunay.from(
      Array.from({ length: n }, (_, i) => [points[i * 2]!, points[i * 2 + 1]!])
    );
    voronoi = delaunay.voronoi(bounds);
  }

  // Step 4: Build the WorldGraph skeleton
  const graph = createEmptyWorldGraph(n);
  const { cells } = graph;

  // Copy cell center positions
  for (let i = 0; i < n * 2; i++) {
    cells.p[i] = points[i]!;
  }

  // Step 5: Extract adjacency from Delaunay edges
  for (let i = 0; i < n; i++) {
    const nbs: number[] = [];
    for (const j of delaunay.neighbors(i)) {
      if (!nbs.includes(j)) nbs.push(j);
    }
    cells.neighbors[i] = nbs;
  }

  // Step 6: Extract cell polygon vertices
  for (let i = 0; i < n; i++) {
    const poly = voronoi.cellPolygon(i);
    if (poly) {
      cells.vertices[i] = poly.map(([x, y]: [number, number]) => [x, y] as [number, number]);
    } else {
      cells.vertices[i] = [[0, 0]];
    }
  }

  // Step 7: Wrap the antimeridian — cells whose edges lie on x = -180 and x = +180 at
  // overlapping latitudes become neighbours, so continents, rivers and borders cross it
  stitchAntimeridian(graph);

  // Step 8: Boundary cells are the polar edge rows (the globe has no east/west edge)
  for (let i = 0; i < n; i++) {
    if (cells.vertices[i]!.some(([, y]) => Math.abs(Math.abs(y) - 90) < 1e-9))
      cells.boundary[i] = 1;
  }

  return graph;
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

/** Unit-sphere coordinates of cell i. */
export function cellXYZ(graph: WorldGraph, i: number): [number, number, number] {
  return toXYZ(graph.cells.p[i * 2]!, graph.cells.p[i * 2 + 1]!);
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

/** Approximate area of cell i in km² using the Haversine-based polygon area. */
export function cellAreaKm2(graph: WorldGraph, i: number): number {
  const verts = graph.cells.vertices[i]!;
  if (verts.length < 4) return 0;

  // Simplified: treat each cell as a flat polygon at its latitude
  const lat = cellLat(graph, i);
  const kmPerDegLng = kmPerDegreeLng(lat);
  const kmPerDegLat = kmPerDegreeLat();

  let area = 0;
  for (let j = 0; j < verts.length - 1; j++) {
    const [x0, y0] = verts[j]!;
    const [x1, y1] = verts[j + 1]!;
    area += (x1 - x0) * kmPerDegLng * ((y0 + y1) / 2) * kmPerDegLat;
  }

  // Shoelace area is signed — take absolute value
  return Math.abs(area / 2);
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

    // Latitude density compensation: at high latitudes, cells cover
    // less actual area, so we space them closer in longitude
    const densityFactor = Math.max(0.3, Math.cos(latRad));
    const effectiveCols = Math.max(3, Math.round(cols * densityFactor));
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
  const firstCenter = Math.floor(rng() * n);
  const centers: number[] = [firstCenter];
  const dist = new Float64Array(n).fill(Infinity);
  const chosen = new Uint8Array(n);
  chosen[firstCenter] = 1;

  for (let k = 1; k < count; k++) {
    const [cx, cy, cz] = cellXYZ(graph, centers[k - 1]!);

    // Squared chord distance on the unit sphere (monotonic in great-circle distance)
    for (let i = 0; i < n; i++) {
      const [x, y, z] = cellXYZ(graph, i);
      const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
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
