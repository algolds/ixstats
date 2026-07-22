/**
 * Voronoi Mesh Generation
 *
 * Creates the foundational spatial mesh that ALL world attributes reference.
 * Uses jittered grid → Delaunay triangulation → Voronoi tessellation → Lloyd relaxation.
 *
 * Every cell in the mesh will later receive exactly ONE elevation, ONE biome,
 * ONE country — guaranteeing no layer intersections.
 */

// @ts-expect-error d3-delaunay has no declaration file
import { Delaunay } from "d3-delaunay";
import { makeRng } from "./rng";
import { type PackedGraph, type CellData } from "./types";

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Create a Voronoi mesh spanning the full WGS84 extent [-180,180]×[-90,90].
 *
 * @param seed Deterministic seed
 * @param cellCount Target number of cells (10,000-50,000)
 * @param lloydIterations Lloyd relaxation iterations (default 2)
 * @returns Skeleton PackedGraph with geometry populated, all attribute arrays zeroed
 */
export function createVoronoiMesh(
  seed: number,
  cellCount: number,
  lloydIterations: number = 2
): PackedGraph {
  const rng = makeRng(seed);

  // Step 1: Generate jittered grid points with latitude-aware density
  const points = generateJitteredGrid(cellCount, rng);
  const n = points.length / 2;

  // Step 2: Delaunay triangulation + Voronoi bounded within safe geographic limits
  const bounds: [number, number, number, number] = [-179.9, -84, 179.9, 84];
  let delaunay = Delaunay.from(
    Array.from({ length: n }, (_, i) => [points[i * 2]!, points[i * 2 + 1]!])
  );
  let voronoi = delaunay.voronoi(bounds);

  // Step 3: Lloyd relaxation
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

  // Step 4: Extract adjacency (neighbors) from Delaunay edges
  const neighbors: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (const j of delaunay.neighbors(i)) {
      if (!neighbors[i]!.includes(j)) {
        neighbors[i]!.push(j);
      }
    }
  }

  // Step 5: Extract cell polygon vertices
  const vertices: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const poly = voronoi.cellPolygon(i);
    if (poly) {
      // d3-delaunay returns closed polygon (last === first), keep it for GeoJSON
      vertices.push(poly.map(([x, y]: [number, number]) => [x, y] as [number, number]));
    } else {
      vertices.push([[0, 0]]);
    }
  }

  // Step 6: Detect boundary cells (touching grid edge)
  const boundary = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const verts = vertices[i]!;
    for (const [x, y] of verts) {
      if (
        Math.abs(x - -180) < 0.5 ||
        Math.abs(x - 180) < 0.5 ||
        Math.abs(y - -90) < 0.5 ||
        Math.abs(y - 90) < 0.5
      ) {
        boundary[i] = 1;
        break;
      }
    }
  }

  // Step 7: Build flat coordinate array
  const p = new Float64Array(n * 2);
  for (let i = 0; i < n * 2; i++) {
    p[i] = points[i]!;
  }

  // Step 8: Allocate all attribute arrays (zeroed)
  const cells: CellData = {
    n,
    p,
    neighbors,
    vertices,
    h: new Uint8Array(n),
    f: new Uint16Array(n),
    b: new Uint8Array(n),
    culture: new Uint16Array(n),
    state: new Uint16Array(n),
    river: new Uint16Array(n),
    flux: new Float32Array(n),
    temp: new Int8Array(n),
    prec: new Uint8Array(n),
    elevZone: new Uint8Array(n),
    coastDist: new Uint16Array(n).fill(65535),
    boundary,
  };

  return {
    cells,
    features: [],
    rivers: [],
    states: [],
    cultures: [],
    burgs: [],
  };
}

// ──────────────────────────────────────────────
// Internal: Jittered Grid
// ──────────────────────────────────────────────

/**
 * Generate a jittered grid of points with latitude-aware density.
 * Points are denser near the poles to compensate for Mercator distortion
 * (so cells cover roughly equal geographic area).
 */
function generateJitteredGrid(targetCount: number, rng: () => number): Float64Array {
  // Calculate grid dimensions for roughly equal-area cells
  // Width spans 360°, height spans 180°
  const aspect = 2; // 360/180
  const rows = Math.round(Math.sqrt(targetCount / aspect));
  const cols = Math.round(rows * aspect);
  const actualCount = rows * cols;

  const dx = 360 / cols;
  const dy = 180 / rows;
  const jitter = 0.45; // jitter fraction of cell size (0.45 = 90% of half-spacing)

  const points = new Float64Array(actualCount * 2);
  let idx = 0;

  for (let r = 0; r < rows; r++) {
    const lat = -90 + (r + 0.5) * dy;
    // Latitude density factor: cells at equator are wider in degrees,
    // so we can space them more; cells at poles need to be tighter
    const latFactor = Math.max(0.3, Math.cos((lat * Math.PI) / 180));

    for (let c = 0; c < cols; c++) {
      const lng = -180 + (c + 0.5) * dx;

      // Skip some cells at high latitudes to maintain roughly equal area
      if (rng() > latFactor + 0.2) continue;

      // Jitter
      const jx = (rng() - 0.5) * dx * jitter * 2;
      const jy = (rng() - 0.5) * dy * jitter * 2;

      const finalLng = Math.max(-179.9, Math.min(179.9, lng + jx));
      const finalLat = Math.max(-89.9, Math.min(89.9, lat + jy));

      if (idx < actualCount * 2) {
        points[idx++] = finalLng;
        points[idx++] = finalLat;
      }
    }
  }

  // Trim to actual count (some cells skipped at poles)
  return points.slice(0, idx);
}

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────

/** Get cell center coordinates */
export function cellCenter(graph: PackedGraph, i: number): [number, number] {
  return [graph.cells.p[i * 2]!, graph.cells.p[i * 2 + 1]!];
}

/** Get cell latitude */
export function cellLat(graph: PackedGraph, i: number): number {
  return graph.cells.p[i * 2 + 1]!;
}

/** Get cell longitude */
export function cellLng(graph: PackedGraph, i: number): number {
  return graph.cells.p[i * 2]!;
}

/** Check if cell is land */
export function isLand(graph: PackedGraph, i: number): boolean {
  return graph.cells.h[i]! >= 51;
}

/** Check if cell is water */
export function isWater(graph: PackedGraph, i: number): boolean {
  return graph.cells.h[i]! < 51;
}

/**
 * Approximate area of a cell in km² using the haversine-based polygon area.
 * For performance, uses a simplified latitude-scaled rectangle approximation.
 */
export function cellAreaKm2(graph: PackedGraph, i: number): number {
  const lat = cellLat(graph, i);
  const latRad = (lat * Math.PI) / 180;
  // Average cell size based on total cells and globe surface area
  const totalArea = 510_000_000; // Earth surface km²
  const avgArea = totalArea / graph.cells.n;
  // Latitude correction: cells at equator cover more area in degree space
  return avgArea * Math.cos(latRad);
}
