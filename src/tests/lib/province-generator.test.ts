/**
 * Tests for province-generator.ts — pure geometry, no server / React deps.
 *
 * Pattern: border-shaping.test.ts (inline helpers, describe/test blocks).
 * Run: bun run test -- src/lib/__tests__/province-generator.test.ts
 */

import type { Polygon, MultiPolygon, Position } from "geojson";
import { generateProvinces, totalProvinceArea } from "~/lib/maps/province-generator";

// ──────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────

/** Simple axis-aligned square: [0,0] → [10,10] in GeoJSON lon/lat space */
function squarePolygon(minLng: number, minLat: number, maxLng: number, maxLat: number): Polygon {
  const ring: Position[] = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ];
  return { type: "Polygon", coordinates: [ring] };
}

/** L-shaped concave polygon (lon/lat) to test non-convex country borders */
function lShapePolygon(): Polygon {
  const ring: Position[] = [
    [0, 0],
    [10, 0],
    [10, 5],
    [5, 5],
    [5, 10],
    [0, 10],
    [0, 0],
  ];
  return { type: "Polygon", coordinates: [ring] };
}

/**
 * A simple MultiPolygon — two non-touching squares simulating island nations.
 * West island: [0,0]→[4,4]; East island: [6,0]→[10,4]
 */
function twoIslandMultiPolygon(): MultiPolygon {
  const westRing: Position[] = [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
    [0, 0],
  ];
  const eastRing: Position[] = [
    [6, 0],
    [10, 0],
    [10, 4],
    [6, 4],
    [6, 0],
  ];
  return {
    type: "MultiPolygon",
    coordinates: [[westRing], [eastRing]],
  };
}

// ──────────────────────────────────────────────────────────────
// Approximate turf area of a square country (lon/lat degrees)
// Used only for ratio assertions; exact value comes from turf.
// ──────────────────────────────────────────────────────────────

// We compute the expected area from totalProvinceArea on the country itself:
// wrap the single Polygon in an array so it uses the same code path.

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe("generateProvinces", () => {
  describe("basic coverage — square country, 4 seeds", () => {
    const country = squarePolygon(0, 0, 10, 10);
    const provinces = generateProvinces(country, 4, { seed: 1 });

    test("returns ≥2 non-empty cells", () => {
      expect(provinces.length).toBeGreaterThanOrEqual(2);
    });

    test("all results are Polygon or MultiPolygon", () => {
      for (const p of provinces) {
        expect(["Polygon", "MultiPolygon"]).toContain(p.type);
      }
    });

    test("summed area ≈ country area (within 5%)", () => {
      const countryArea = totalProvinceArea([country]);
      const provinceSum = totalProvinceArea(provinces);
      const ratio = provinceSum / countryArea;
      // Allow ≤5% gap due to floating-point clipping
      expect(ratio).toBeGreaterThan(0.95);
      expect(ratio).toBeLessThanOrEqual(1.01); // tiny overlaps can push it slightly over
    });
  });

  describe("determinism", () => {
    const country = squarePolygon(0, 0, 10, 10);

    test("same seed → identical output (count=6)", () => {
      const a = generateProvinces(country, 6, { seed: 99 });
      const b = generateProvinces(country, 6, { seed: 99 });
      expect(a.length).toBe(b.length);
      // Compare coordinates of first province
      expect(JSON.stringify(a[0])).toBe(JSON.stringify(b[0]));
      expect(JSON.stringify(a[a.length - 1])).toBe(JSON.stringify(b[b.length - 1]));
    });

    test("different seeds → different output", () => {
      const a = generateProvinces(country, 4, { seed: 1 });
      const b = generateProvinces(country, 4, { seed: 7 });
      // Seed change should alter at least first cell coordinates
      expect(JSON.stringify(a[0])).not.toBe(JSON.stringify(b[0]));
    });

    test("omitting seed uses default (same as seed=42)", () => {
      const withDefault = generateProvinces(country, 4);
      const withExplicit = generateProvinces(country, 4, { seed: 42 });
      expect(JSON.stringify(withDefault)).toBe(JSON.stringify(withExplicit));
    });
  });

  describe("edge cases", () => {
    const country = squarePolygon(0, 0, 10, 10);

    test("count=1 returns exactly 1 province covering the whole country", () => {
      const provinces = generateProvinces(country, 1, { seed: 1 });
      expect(provinces.length).toBe(1);
      const countryArea = totalProvinceArea([country]);
      const provinceArea = totalProvinceArea(provinces);
      expect(provinceArea / countryArea).toBeGreaterThan(0.99);
    });

    test("count=0 returns empty array", () => {
      expect(generateProvinces(country, 0)).toEqual([]);
    });

    test("count=10 returns ≥8 provinces for a square", () => {
      const provinces = generateProvinces(country, 10, { seed: 3 });
      // All seeds land inside a convex square, so expect near-full yield
      expect(provinces.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("non-convex (concave) country — L-shape", () => {
    const country = lShapePolygon();

    test("returns ≥2 provinces", () => {
      const provinces = generateProvinces(country, 4, { seed: 5 });
      expect(provinces.length).toBeGreaterThanOrEqual(2);
    });

    test("summed area ≈ L-shape area (within 5%)", () => {
      const provinces = generateProvinces(country, 4, { seed: 5 });
      const countryArea = totalProvinceArea([country]);
      const provinceSum = totalProvinceArea(provinces);
      const ratio = provinceSum / countryArea;
      expect(ratio).toBeGreaterThan(0.95);
      expect(ratio).toBeLessThanOrEqual(1.01);
    });
  });

  describe("MultiPolygon — two-island nation", () => {
    const country = twoIslandMultiPolygon();

    test("returns at least 1 province", () => {
      const provinces = generateProvinces(country, 6, { seed: 10 });
      expect(provinces.length).toBeGreaterThanOrEqual(1);
    });

    test("summed area ≤ total country area (clipped correctly)", () => {
      const provinces = generateProvinces(country, 6, { seed: 10 });
      const countryArea = totalProvinceArea([country]);
      const provinceSum = totalProvinceArea(provinces);
      // Cannot exceed country area
      expect(provinceSum).toBeLessThanOrEqual(countryArea * 1.01);
    });
  });
});

describe("totalProvinceArea", () => {
  test("returns 0 for empty array", () => {
    expect(totalProvinceArea([])).toBe(0);
  });

  test("returns positive area for a square polygon", () => {
    const sq = squarePolygon(0, 0, 10, 10);
    expect(totalProvinceArea([sq])).toBeGreaterThan(0);
  });

  test("sums areas of multiple polygons", () => {
    const a = squarePolygon(0, 0, 5, 5);
    const b = squarePolygon(5, 5, 10, 10);
    const combined = totalProvinceArea([a, b]);
    const aOnly = totalProvinceArea([a]);
    const bOnly = totalProvinceArea([b]);
    expect(combined).toBeCloseTo(aOnly + bOnly, 0);
  });
});
