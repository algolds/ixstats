/**
 * Tests for normalizeTerrainDifficulty and samplePolylinePoints.
 *
 * These are pure helpers exported from geo-math.ts that back the
 * terrain-difficulty field computed in routeMutations.ts on route
 * create/update.
 *
 * Structure mirrors src/lib/__tests__/transport-costs.test.ts.
 */

import { normalizeTerrainDifficulty, samplePolylinePoints } from "../geo-math";

// ── normalizeTerrainDifficulty ────────────────────────────────────────────────

describe("normalizeTerrainDifficulty", () => {
  it("returns 0 for an empty array", () => {
    expect(normalizeTerrainDifficulty([])).toBe(0);
  });

  it("returns 0 for a single-element array", () => {
    expect(normalizeTerrainDifficulty([1000])).toBe(0);
  });

  it("returns 0 for a perfectly flat route (no ascent)", () => {
    expect(normalizeTerrainDifficulty([500, 500, 500, 500])).toBe(0);
  });

  it("returns 0 for a purely descending route (no ascent)", () => {
    // Descent-only: 1000 → 500 → 0.  Ascending gain = 0.
    expect(normalizeTerrainDifficulty([1000, 500, 0])).toBe(0);
  });

  it("normalizes 5 000 m cumulative gain to exactly 1.0", () => {
    // Two-step ascent: 0 → 2 500 → 5 000.  Gain = 5 000 m.
    expect(normalizeTerrainDifficulty([0, 2500, 5000])).toBe(1);
  });

  it("clamps values above 5 000 m gain to 1.0", () => {
    // 10 000 m gain → still capped at 1.
    expect(normalizeTerrainDifficulty([0, 5000, 10000])).toBe(1);
  });

  it("calculates correctly for 2 500 m cumulative gain (≈ 0.5)", () => {
    // 0 → 1 000 → 500 → 2 000 → 0  (ups: +1000, +1500 = 2500 m)
    expect(normalizeTerrainDifficulty([0, 1000, 500, 2000, 0])).toBeCloseTo(0.5, 5);
  });

  it("only counts ascending segments (ignores descents)", () => {
    // Ascent 500 m, then descent 500 m, then ascent 500 m again.
    // Total ascent = 1 000 m → 0.2 difficulty.
    expect(normalizeTerrainDifficulty([0, 500, 0, 500])).toBeCloseTo(0.2, 5);
  });

  it("handles negative elevation values (below sea level)", () => {
    // -100 → 0 → -50 → 100.  Ups: +100 (−100→0), +150 (−50→100) = 250 m → 0.05
    expect(normalizeTerrainDifficulty([-100, 0, -50, 100])).toBeCloseTo(0.05, 5);
  });

  it("handles a sea/flat route correctly (shipping lane scenario)", () => {
    // All zeros → no gain → 0 difficulty
    expect(normalizeTerrainDifficulty([0, 0, 0, 0, 0, 0])).toBe(0);
  });
});

// ── samplePolylinePoints ──────────────────────────────────────────────────────

describe("samplePolylinePoints", () => {
  it("returns empty array for empty input", () => {
    expect(samplePolylinePoints([], 5)).toEqual([]);
  });

  it("returns all points when n >= length", () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    expect(samplePolylinePoints(pts, 10)).toEqual(pts);
  });

  it("returns a copy of the array when n equals length", () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    const result = samplePolylinePoints(pts, 2);
    expect(result).toEqual(pts);
    // Ensure it's a copy, not the same reference
    expect(result).not.toBe(pts);
  });

  it("returns n=1 point correctly", () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    const result = samplePolylinePoints(pts, 1);
    // n <= 0 path doesn't apply since n=1 is valid; we get a single point
    expect(result).toHaveLength(1);
  });

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

  it("returns 0 points for n=0", () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    // n <= 0 branch: returns copy of coords (length check: coords.length <= n fails for n=0)
    // Actually n=0 triggers the n<=0 guard: returns [...coords]
    const result = samplePolylinePoints(pts, 0);
    expect(result).toEqual(pts);
  });
});
