/**
 * Tests for normalizeTerrainDifficulty and samplePolylinePoints.
 *
 * These are pure helpers exported from geo-math.ts that back the
 * terrain-difficulty field computed in routeMutations.ts on route
 * create/update.
 *
 * Structure mirrors src/lib/__tests__/transport-costs.test.ts.
 */

import { normalizeTerrainDifficulty, samplePolylinePoints } from "~/lib/maps/geo-math";

// ── normalizeTerrainDifficulty ────────────────────────────────────────────────

describe("normalizeTerrainDifficulty", () => {
  it("normalizes 5 000 m cumulative gain to exactly 1.0", () => {
    // Two-step ascent: 0 → 2 500 → 5 000.  Gain = 5 000 m.
    expect(normalizeTerrainDifficulty([0, 2500, 5000])).toBe(1);
  });

  it("clamps values above 5 000 m gain to 1.0", () => {
    // 10 000 m gain → still capped at 1.
    expect(normalizeTerrainDifficulty([0, 5000, 10000])).toBe(1);
  });
  it("only counts ascending segments (ignores descents)", () => {
    // Ascent 500 m, then descent 500 m, then ascent 500 m again.
    // Total ascent = 1 000 m → 0.2 difficulty.
    expect(normalizeTerrainDifficulty([0, 500, 0, 500])).toBeCloseTo(0.2, 5);
  });
});

// ── samplePolylinePoints ──────────────────────────────────────────────────────

describe("samplePolylinePoints", () => {
  it("always includes start and end when n >= 2", () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
      [7, 7],
      [8, 8],
      [9, 9],
    ];
    const result = samplePolylinePoints(pts, 4);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual([0, 0]);
    expect(result[result.length - 1]).toEqual([9, 9]);
  });

  it("returns n points for a long polyline", () => {
    const pts: [number, number][] = Array.from({ length: 100 }, (_, i) => [i, 0]);
    const result = samplePolylinePoints(pts, 20);
    expect(result).toHaveLength(20);
    expect(result[0]).toEqual([0, 0]);
    expect(result[19]).toEqual([99, 0]);
  });
});
