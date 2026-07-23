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

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

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

  // Step 2: Delaunay + Voronoi within safe geographic bounds
  // Slightly inside [-180,180]×[-90,90] to avoid edge-case degeneracies
  const bounds: [number, number, number, number] = [-179.9, -84, 179.9, 84];
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
      cx = Math.max(-179.9, Math.min(179.9, cx));
      cy = Math.max(-83.9, Math.min(83.9, cy));

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
      cells.vertices[i] = poly.map(
        ([x, y]: [number, number]) => [x, y] as [number, number]
      );
    } else {
      cells.vertices[i] = [[0, 0]];
    }
  }

  // Step 7: Detect boundary cells
  for (let i = 0; i < n; i++) {
    const verts = cells.vertices[i]!;
    for (const [x, y] of verts) {
      if (
        Math.abs(x - -180) < 0.5 ||
        Math.abs(x - 180) < 0.5 ||
        Math.abs(y - -84) < 1.0 ||
        Math.abs(y - 84) < 1.0
      ) {
        cells.boundary[i] = 1;
        break;
      }
    }
  }

  return graph;
}

// ──────────────────────────────────────────────
// Utility: Cell Accessors
// ──────────────────────────────────────────────

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
  const latRad = (lat * Math.PI) / 180;
  const kmPerDegLng = 111.32 * Math.cos(latRad);
  const kmPerDegLat = 110.574;

  let area = 0;
  for (let j = 0; j < verts.length - 1; j++) {
    const [x0, y0] = verts[j]!;
    const [x1, y1] = verts[j + 1]!;
    area += (x1 - x0) * kmPerDegLng * ((y0 + y1) / 2) * kmPerDegLat;
  }

  // Shoelace area is signed — take absolute value
  return Math.abs(area / 2);
}

/**
 * Haversine distance between two cells in km.
 */
export function cellDistanceKm(graph: WorldGraph, a: number, b: number): number {
  const R = 6371; // Earth radius in km
  const lat1 = (cellLat(graph, a) * Math.PI) / 180;
  const lat2 = (cellLat(graph, b) * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((cellLng(graph, b) - cellLng(graph, a)) * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ──────────────────────────────────────────────
// Internal: Jittered Grid Generation
// ──────────────────────────────────────────────

/**
 * Generate jittered grid points with latitude-aware density.
 * More points per unit area near the poles to counteract Mercator distortion
 * and ensure uniform cell density on a sphere.
 *
 * @returns Flat array [lng0,lat0, lng1,lat1, ...]
 */
function generateJitteredGrid(
  targetCount: number,
  rng: () => number
): Float64Array {
  // Calculate grid dimensions for approximately targetCount cells
  // Aspect ratio: longitude span (360°) is 2× latitude span (168° usable)
  const aspectRatio = 360 / 168;
  const cols = Math.round(Math.sqrt(targetCount * aspectRatio));
  const rows = Math.round(targetCount / cols);

  const cellW = 360 / cols;
  const cellH = 168 / rows; // from -84 to 84

  const points: number[] = [];

  for (let row = 0; row < rows; row++) {
    const lat = -84 + (row + 0.5) * cellH;
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

      const finalLng = Math.max(-179.9, Math.min(179.9, lng + jx));
      const finalLat = Math.max(-83.9, Math.min(83.9, lat + jy));

      points.push(finalLng, finalLat);
    }
  }

  return Float64Array.from(points);
}

/**
 * Farthest-point sampling: select N well-distributed cells from the mesh.
 * Used for tectonic plate seeds and continent centers.
 */
export function farthestPointSample(
  graph: WorldGraph,
  count: number,
  rng: () => number
): number[] {
  const { cells } = graph;
  const n = cells.n;
  const firstCenter = Math.floor(rng() * n);
  const centers: number[] = [firstCenter];
  const dist = new Float64Array(n).fill(Infinity);
  const chosen = new Uint8Array(n);
  chosen[firstCenter] = 1;

  for (let k = 1; k < count; k++) {
    const lastCenter = centers[k - 1]!;
    const cx = cells.p[lastCenter * 2]!;
    const cy = cells.p[lastCenter * 2 + 1]!;

    for (let i = 0; i < n; i++) {
      const dx = cells.p[i * 2]! - cx;
      const dy = cells.p[i * 2 + 1]! - cy;
      const d2 = dx * dx + dy * dy;
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
