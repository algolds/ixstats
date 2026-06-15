/**
 * Province Generator — pure client-side geometry
 *
 * Auto-subdivides a country polygon into N provinces using a
 * Voronoi diagram approach:
 *   1. Scatter `count` seed points inside the country bbox
 *      (deterministic given `opts.seed`).
 *   2. Compute a Voronoi diagram bounded by the country bbox.
 *   3. Clip each Voronoi cell to the country outline via turf `intersect`.
 *   4. Drop empty / null intersections (e.g. seeds that fell outside).
 *
 * Turf submodule imports are used throughout (not `@turf/turf`) because
 * the repo hits a Turbopack umbrella bug with the top-level package.
 *
 * No server / DB / React dependencies — fully testable.
 */

import { bbox } from "@turf/bbox";
import { area } from "@turf/area";
import { voronoi } from "@turf/voronoi";
import { intersect } from "@turf/intersect";
import {
  point,
  featureCollection,
  polygon as turfPolygon,
  multiPolygon as turfMultiPolygon,
} from "@turf/helpers";
import type {
  Feature,
  FeatureCollection,
  Point,
  Polygon,
  MultiPolygon,
  BBox,
} from "geojson";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ProvinceGeneratorOpts {
  /**
   * Integer seed for reproducible point placement.
   * Same seed + same country + same count → identical output.
   */
  seed?: number;
}

// ──────────────────────────────────────────────────────────────
// Tiny seeded pseudo-random (mulberry32 — no external dep)
// ──────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/**
 * Scatter `count` points inside `bounds` using the given PRNG.
 */
function scatterPoints(
  count: number,
  bounds: BBox,
  rand: () => number
): FeatureCollection<Point> {
  const [minX, minY, maxX, maxY] = bounds;
  const features = Array.from({ length: count }, () =>
    point([minX + rand() * (maxX - minX), minY + rand() * (maxY - minY)])
  );
  return featureCollection(features);
}

/**
 * Lift a raw GeoJSON Polygon/MultiPolygon to a turf Feature so turf
 * `intersect` can accept it (it needs `Feature<Polygon|MultiPolygon>`).
 */
function toFeature(
  geom: Polygon | MultiPolygon
): Feature<Polygon> | Feature<MultiPolygon> {
  if (geom.type === "Polygon") {
    return turfPolygon(geom.coordinates) as Feature<Polygon>;
  }
  return turfMultiPolygon(geom.coordinates) as Feature<MultiPolygon>;
}

// ──────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────

/**
 * Generate `count` province polygons by subdividing `country`.
 *
 * @param country  - The country outline (Polygon or MultiPolygon).
 * @param count    - Number of seed points / target provinces (≥1).
 * @param opts     - Optional: `seed` for deterministic output.
 * @returns        Array of province polygons clipped to the country border.
 *                 Length ≤ `count` (some seeds may fall outside islands).
 */
export function generateProvinces(
  country: Polygon | MultiPolygon,
  count: number,
  opts?: ProvinceGeneratorOpts
): (Polygon | MultiPolygon)[] {
  if (count < 1) return [];

  const seed = opts?.seed ?? 42;
  const rand = mulberry32(seed);

  // 1. Country bbox → seed points inside it
  const countryFeature = toFeature(country);
  const bounds = bbox(countryFeature) as BBox;
  const seedPoints = scatterPoints(count, bounds, rand);

  // 2. Voronoi diagram over the bbox
  const cells = voronoi(seedPoints, { bbox: bounds });
  if (!cells?.features?.length) return [];

  // 3. Clip each cell to the country outline; drop empty
  const results: (Polygon | MultiPolygon)[] = [];

  for (const cell of cells.features) {
    if (!cell?.geometry) continue;

    try {
      // Cast to the FeatureCollection<Polygon | MultiPolygon> that intersect expects.
      // cell is Feature<Polygon> (voronoi output); countryFeature may be either type.
      // We widen the element type explicitly so TS doesn't narrow to Feature<Polygon>.
      const members: Array<Feature<Polygon | MultiPolygon>> = [
        cell as Feature<Polygon | MultiPolygon>,
        countryFeature as Feature<Polygon | MultiPolygon>,
      ];
      const fc = featureCollection(members) as FeatureCollection<Polygon | MultiPolygon>;
      const clipped = intersect(fc);
      if (!clipped?.geometry) continue;

      const geomType = clipped.geometry.type;
      if (geomType === "Polygon" || geomType === "MultiPolygon") {
        results.push(clipped.geometry as Polygon | MultiPolygon);
      }
    } catch {
      // Robustness: degenerate cell geometry — skip
    }
  }

  return results;
}

// ──────────────────────────────────────────────────────────────
// Utilities exported for the prototype UI
// ──────────────────────────────────────────────────────────────

/**
 * Compute total area (m²) across an array of province geometries.
 * Useful for coverage validation in the UI.
 */
export function totalProvinceArea(provinces: (Polygon | MultiPolygon)[]): number {
  return provinces.reduce((sum, g) => {
    try {
      const f =
        g.type === "Polygon"
          ? turfPolygon(g.coordinates)
          : turfMultiPolygon(g.coordinates);
      return sum + area(f);
    } catch {
      return sum;
    }
  }, 0);
}
