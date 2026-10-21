/**
 * Tests for border-trace.ts — traceAlongLayer pure function.
 *
 * Pure-function unit tests; no React or database dependencies.
 */

import { traceAlongLayer } from "~/lib/maps/border-trace";
import type { TraceFeature } from "~/lib/maps/border-trace";

/**
 * Build a simple 5-point river feature as a LineString running left-to-right:
 *   (0,0) → (1,0) → (2,0) → (3,0) → (4,0)
 * Segment indices: 0=(0→1), 1=(1→2), 2=(2→3), 3=(3→4)
 */
function makeRiver(): TraceFeature {
  return {
    geometry: {
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
      ],
    },
  };
}

describe("traceAlongLayer", () => {
  describe("basic forward trace", () => {
    test("returns intermediate vertices between point 1 and point 4 on a 5-point river", () => {
      // start snaps near (1,0) — midpoint of segment 0-1, just past vertex 1
      // end   snaps near (3,0) — midpoint of segment 2-3, just past vertex 3
      // Intermediate vertices on the forward path are (2,0) and (3,0)
      const river = makeRiver();
      const start: [number, number] = [1.1, 0.01]; // near vertex 1, on seg 1
      const end: [number, number] = [3.1, 0.01]; // near vertex 3, on seg 3

      const result = traceAlongLayer(start, end, [river], 0.1);

      // Should include the vertices between seg 1 and seg 3: vertex at index 2 = (2,0) and index 3 = (3,0)
      expect(result.length).toBeGreaterThan(0);
      // All returned vertices should be actual river coordinates
      result.forEach((v) => {
        expect(v[1]).toBeCloseTo(0, 5); // lat stays 0
        expect(v[0]).toBeGreaterThan(0);
        expect(v[0]).toBeLessThan(5);
      });
    });
  });

  describe("backward / reverse trace", () => {
    test("reversed start/end gives same vertices in opposite order", () => {
      const river = makeRiver();
      const a: [number, number] = [0.5, 0.0];
      const b: [number, number] = [3.5, 0.0];

      const forward = traceAlongLayer(a, b, [river], 0.1);
      const backward = traceAlongLayer(b, a, [river], 0.1);

      expect(forward.length).toBe(backward.length);
      for (let i = 0; i < forward.length; i++) {
        expect(forward[i]![0]).toBeCloseTo(backward[backward.length - 1 - i]![0], 5);
      }
    });
  });

  describe("edge cases", () => {
    test("returns [] when start point is out of tolerance", () => {
      const river = makeRiver();
      const result = traceAlongLayer([0, 99], [3.5, 0], [river], 0.1);
      expect(result).toEqual([]);
    });
    test("returns [] when points snap to different features", () => {
      const river1: TraceFeature = {
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 0],
            [2, 0],
          ],
        },
      };
      const river2: TraceFeature = {
        geometry: {
          type: "LineString",
          coordinates: [
            [10, 0],
            [11, 0],
            [12, 0],
          ],
        },
      };
      // start near river1, end near river2
      const result = traceAlongLayer([0.5, 0.01], [10.5, 0.01], [river1, river2], 0.1);
      expect(result).toEqual([]);
    });
  });

  describe("MultiLineString support", () => {
    test("traces within one polyline of a MultiLineString feature", () => {
      const feature: TraceFeature = {
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [2, 0],
              [3, 0],
            ], // line 0
            [
              [0, 5],
              [1, 5],
              [2, 5],
            ], // line 1
          ],
        },
      };
      // Both points on line 0
      const result = traceAlongLayer([0.5, 0.01], [2.5, 0.01], [feature], 0.1);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((v) => expect(v[1]).toBeCloseTo(0, 3));
    });
  });
});
