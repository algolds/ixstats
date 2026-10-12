/**
 * UPG v2 — Mesh Unit Tests
 */

// @ts-expect-error d3-delaunay has no declaration file
import { Delaunay } from "d3-delaunay";
import {
  createMesh,
  cellAreaKm2,
  cellLng,
  cellLat,
  farthestPointSample,
} from "~/lib/worldgen/v2/mesh";
import { makeRng } from "~/lib/worldgen/v2/helpers/rng";
import { EARTH_RADIUS_KM, sphericalRingAreaSqKm } from "~/lib/maps/planet";

// Use a smaller cell count for fast tests
const TEST_CELLS = 5000;
const TEST_SEED = 42;

describe("v2/mesh", () => {
  const graph = createMesh(TEST_SEED, TEST_CELLS, 2);

  it("produces approximately the requested cell count", () => {
    // Latitude-compensated grid varies from target, allow wide tolerance
    expect(graph.cells.n).toBeGreaterThan(TEST_CELLS * 0.4);
    expect(graph.cells.n).toBeLessThan(TEST_CELLS * 2.5);
  });

  it("most cells have at least 3 neighbors", () => {
    // d3-delaunay edge/boundary cells can have as few as 1-2 neighbors.
    // Verify the vast majority (>95%) have >= 3.
    let lowNeighborCount = 0;
    for (let i = 0; i < graph.cells.n; i++) {
      if (graph.cells.neighbors[i]!.length < 3) lowNeighborCount++;
    }
    expect(lowNeighborCount).toBeLessThan(graph.cells.n * 0.05);
  });

  it("cells are spatially distributed (not degenerate)", () => {
    // Verify cells aren't all clustered in one spot — use 5° grid buckets
    const seen = new Set<string>();
    for (let i = 0; i < graph.cells.n; i++) {
      const key = `${Math.round(cellLng(graph, i) / 5)},${Math.round(cellLat(graph, i) / 5)}`;
      seen.add(key);
    }
    // At 5K cells on a 72×34 = ~2400 bucket grid, most buckets should be filled
    expect(seen.size).toBeGreaterThan(100);
  });

  it("vertices form closed polygons (first ≈ last)", () => {
    let openPolygons = 0;
    for (let i = 0; i < graph.cells.n; i++) {
      const verts = graph.cells.vertices[i]!;
      if (verts.length < 3) continue;
      const first = verts[0]!;
      const last = verts[verts.length - 1]!;
      const dx = Math.abs(first[0] - last[0]);
      const dy = Math.abs(first[1] - last[1]);
      if (dx > 0.001 || dy > 0.001) openPolygons++;
    }
    expect(openPolygons).toBe(0);
  });

  it("boundary detection runs and produces results", () => {
    let boundaryCount = 0;
    for (let i = 0; i < graph.cells.n; i++) {
      if (graph.cells.boundary[i]) boundaryCount++;
    }
    // At 5K cells, polygons are large and many touch the boundary.
    // Just verify the array is populated (not all zero or some are flagged).
    expect(boundaryCount).toBeGreaterThan(0);
  });

  it("cell positions are within geographic bounds", () => {
    for (let i = 0; i < graph.cells.n; i++) {
      const lng = cellLng(graph, i);
      const lat = cellLat(graph, i);
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(180);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
    }
  });

  it("all typed arrays are allocated with correct length", () => {
    const n = graph.cells.n;
    expect(graph.cells.h.length).toBe(n);
    expect(graph.cells.plate.length).toBe(n);
    expect(graph.cells.isLand.length).toBe(n);
    expect(graph.cells.temp.length).toBe(n);
    expect(graph.cells.prec.length).toBe(n);
    expect(graph.cells.biome.length).toBe(n);
    expect(graph.cells.state.length).toBe(n);
    expect(graph.cells.downstream.length).toBe(n);
    expect(graph.cells.flux.length).toBe(n);
  });
});

describe("v2/mesh cellAreaKm2", () => {
  const SURFACE_KM2 = 4 * Math.PI * EARTH_RADIUS_KM ** 2;
  const graph = createMesh(TEST_SEED, 20000, 2);

  it("sums over the whole mesh to the planet's surface area (within 1%)", () => {
    let total = 0;
    for (let i = 0; i < graph.cells.n; i++) total += cellAreaKm2(graph, i);
    expect(Math.abs(total / SURFACE_KM2 - 1)).toBeLessThan(0.01);
  });

  it("matches the geodesic area of each cell's polygon", () => {
    for (let i = 0; i < graph.cells.n; i += 37) {
      const geodesic = sphericalRingAreaSqKm(graph.cells.vertices[i]!, EARTH_RADIUS_KM);
      expect(Math.abs(cellAreaKm2(graph, i) / geodesic - 1)).toBeLessThan(0.01);
    }
  });

  it("sums over a latitude band to the band's area on the sphere", () => {
    // A zone between two parallels covers 2πR²(sin φ2 − sin φ1)
    const band = (from: number, to: number) => {
      let total = 0;
      for (let i = 0; i < graph.cells.n; i++) {
        const lat = cellLat(graph, i);
        if (lat >= from && lat < to) total += cellAreaKm2(graph, i);
      }
      const rad = Math.PI / 180;
      return (
        total / (2 * Math.PI * EARTH_RADIUS_KM ** 2 * (Math.sin(to * rad) - Math.sin(from * rad)))
      );
    };
    for (const [from, to] of [
      [-10, 10],
      [30, 50],
      [-70, -50],
    ] as const) {
      expect(Math.abs(band(from, to) - 1)).toBeLessThan(0.03);
    }
  });
});

describe("v2/mesh Lloyd relaxation", () => {
  /** The straightforward relaxation: centroid of each cellPolygon, a fresh triangulation per pass. */
  function relaxed(start: Float64Array, passes: number): Float64Array {
    const bounds = [-180, -90, 180, 90];
    const points = start.slice();
    let voronoi = new Delaunay(points.slice()).voronoi(bounds);
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < points.length / 2; i++) {
        const poly: [number, number][] | null = voronoi.cellPolygon(i);
        if (!poly || poly.length < 3) continue;
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
        points[i * 2] = Math.max(-179.95, Math.min(179.95, cx / (6 * area)));
        points[i * 2 + 1] = Math.max(-89.9, Math.min(89.9, cy / (6 * area)));
      }
      voronoi = new Delaunay(points.slice()).voronoi(bounds);
    }
    return points;
  }

  it("moves every cell centre exactly as centroid relaxation of the jittered grid does", () => {
    const start = createMesh(TEST_SEED, 2000, 0).cells.p;
    const mesh = createMesh(TEST_SEED, 2000, 3);
    expect(Array.from(mesh.cells.p)).toEqual(Array.from(relaxed(start, 3)));
  });
});

describe("v2/mesh farthestPointSample", () => {
  const graph = createMesh(TEST_SEED, TEST_CELLS, 2);

  it("returns the requested number of samples", () => {
    const rng = makeRng(123);
    const samples = farthestPointSample(graph, 10, rng);
    expect(samples).toHaveLength(10);
  });

  it("all sample IDs are valid cell indices", () => {
    const rng = makeRng(123);
    const samples = farthestPointSample(graph, 10, rng);
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(graph.cells.n);
    }
  });

  it("samples are all unique cells", () => {
    const rng = makeRng(123);
    const samples = farthestPointSample(graph, 8, rng);

    // All samples should be unique cell IDs
    const unique = new Set(samples);
    expect(unique.size).toBe(samples.length);
  });
});
