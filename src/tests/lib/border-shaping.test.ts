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
  test("preserves ring closure (first === last) after smoothing", () => {
    const sq = square(0, 0, 1, 1);
    const result = smoothGeometry(sq, 2);
    const ring = getAllRings(result)[0]!;
    expect(ring[0]![0]).toBeCloseTo(ring[ring.length - 1]![0]!, 10);
    expect(ring[0]![1]).toBeCloseTo(ring[ring.length - 1]![1]!, 10);
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
});
