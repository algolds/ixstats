/**
 * UPG v2 — Mesh Unit Tests
 */

import { createMesh, cellLng, cellLat, farthestPointSample } from "../mesh";
import { makeRng } from "../helpers/rng";

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
