/**
 * Tests for border-shaping pure functions: smoothGeometry (Chaikin) and
 * naturalizeGeometry (subdivide + seeded noise).
 *
 * Pure-function characterization tests; no React or database dependencies.
 */

import type { Polygon, Position } from "geojson";
import {
  smoothGeometry,
  naturalizeGeometry,
  getAllRings,
  validateGeometry,
} from "~/lib/maps/border-editor";

/** Build a closed square ring (lng, lat) → [lng, lat] ring with closing duplicate. */
function square(minLng: number, minLat: number, maxLng: number, maxLat: number): Polygon {
  const ring: Position[] = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ];
  return { type: "Polygon", coordinates: [ring] };
}

describe("smoothGeometry", () => {
  test("produces more vertices than the input (Chaikin doubles per iteration)", () => {
    const sq = square(0, 0, 1, 1);
    const result = smoothGeometry(sq, 1);
    const inRings = getAllRings(sq);
    const outRings = getAllRings(result);
    const inCount = inRings[0]!.length - 1; // exclude closing duplicate
    const outCount = outRings[0]!.length - 1;
    expect(outCount).toBeGreaterThan(inCount);
    // Chaikin doubles: 4 open → 8 open
    expect(outCount).toBe(inCount * 2);
  });

  test("preserves ring closure (first === last) after smoothing", () => {
    const sq = square(0, 0, 1, 1);
    const result = smoothGeometry(sq, 2);
    const ring = getAllRings(result)[0]!;
    expect(ring[0]![0]).toBeCloseTo(ring[ring.length - 1]![0]!, 10);
    expect(ring[0]![1]).toBeCloseTo(ring[ring.length - 1]![1]!, 10);
  });

  test("zero iterations is a no-op (same vertex count)", () => {
    const sq = square(0, 0, 1, 1);
    const result = smoothGeometry(sq, 0);
    const inRings = getAllRings(sq);
    const outRings = getAllRings(result);
    expect(outRings[0]!.length).toBe(inRings[0]!.length);
  });
});

describe("naturalizeGeometry", () => {
  test("is deterministic given the same seed", () => {
    const sq = square(0, 0, 1, 1);
    const a = naturalizeGeometry(sq, 0.01, 42);
    const b = naturalizeGeometry(sq, 0.01, 42);
    const ringA = getAllRings(a)[0]!;
    const ringB = getAllRings(b)[0]!;
    expect(ringA.length).toBe(ringB.length);
    for (let i = 0; i < ringA.length; i++) {
      expect(ringA[i]![0]).toBeCloseTo(ringB[i]![0]!, 12);
      expect(ringA[i]![1]).toBeCloseTo(ringB[i]![1]!, 12);
    }
  });

  test("preserves ring closure and produces valid geometry", () => {
    const sq = square(0, 0, 1, 1);
    const result = naturalizeGeometry(sq, 0.01, 42);
    const ring = getAllRings(result)[0]!;
    expect(ring[0]![0]).toBeCloseTo(ring[ring.length - 1]![0]!, 10);
    expect(ring[0]![1]).toBeCloseTo(ring[ring.length - 1]![1]!, 10);
    const validation = validateGeometry(result);
    expect(validation.valid).toBe(true);
  });

  test("subdivides each edge — produces more vertices than the input", () => {
    const sq = square(0, 0, 1, 1);
    const result = naturalizeGeometry(sq, 0.01, 42);
    const inRings = getAllRings(sq);
    const outRings = getAllRings(result);
    const inCount = inRings[0]!.length - 1; // open length
    const outCount = outRings[0]!.length - 1;
    // Each edge gains one midpoint, so output is 2x input
    expect(outCount).toBe(inCount * 2);
  });
});
