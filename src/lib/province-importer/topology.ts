/**
 * Province Topology Validation
 *
 * Detects gaps, overlaps, and coverage issues between imported provinces
 * and the country border. Uses @turf/turf for geometric operations.
 *
 * Client-side compatible (no server dependencies).
 */

import { area } from "@turf/area";
import { bbox } from "@turf/bbox";
import { buffer } from "@turf/buffer";
import { centroid } from "@turf/centroid";
import { difference } from "@turf/difference";
import { featureCollection } from "@turf/helpers";
import { intersect } from "@turf/intersect";
import { kinks } from "@turf/kinks";
import { union } from "@turf/union";
import type { Feature, Polygon, MultiPolygon, Position } from "geojson";
import type { ProvinceFeature, TopologyReport, GapReport, OverlapReport } from "./types";

// ──────────────────────────────────────────────
// Main Validation Entry Point
// ──────────────────────────────────────────────

/**
 * Validate the topology of imported provinces against a country border.
 * Checks for gaps, overlaps, and individual feature issues.
 */
export function validateTopology(
  provinces: ProvinceFeature[],
  countryBorder: Polygon | MultiPolygon
): TopologyReport {
  const included = provinces.filter((p) => p.included);
  if (included.length === 0) {
    return {
      valid: false,
      gaps: [],
      overlaps: [],
      coveragePercent: 0,
      totalProvincesArea: 0,
      countryArea: 0,
      featureIssues: [
        { provinceIndex: -1, provinceName: "(none)", issues: ["No provinces included"] },
      ],
    };
  }

  // Individual feature validation
  const featureIssues = validateIndividualFeatures(included);

  // Area calculations
  const countryArea = computeAreaSqKm(countryBorder);
  const totalProvincesArea = included.reduce((sum, p) => sum + computeAreaSqKm(p.geometry), 0);

  // Gap detection
  const gaps = detectGaps(included, countryBorder);

  // Overlap detection
  const overlaps = detectOverlaps(included);

  // Coverage
  const coveragePercent =
    countryArea > 0 ? Math.min(100, (totalProvincesArea / countryArea) * 100) : 0;

  const valid =
    featureIssues.length === 0 &&
    gaps.length === 0 &&
    overlaps.length === 0 &&
    coveragePercent > 95;

  return {
    valid,
    gaps,
    overlaps,
    coveragePercent: Math.round(coveragePercent * 10) / 10,
    totalProvincesArea: Math.round(totalProvincesArea),
    countryArea: Math.round(countryArea),
    featureIssues,
  };
}

// ──────────────────────────────────────────────
// Gap Detection
// ──────────────────────────────────────────────

/**
 * Detect gaps between provinces and the country border.
 * A gap is an area within the country that is not covered by any province.
 */
export function detectGaps(
  provinces: ProvinceFeature[],
  countryBorder: Polygon | MultiPolygon
): GapReport[] {
  const gaps: GapReport[] = [];

  try {
    // Union all provinces
    const provincePolygons = provinces
      .filter((p) => p.included)
      .map((p) => toTurfFeature(p.geometry))
      .filter((f): f is Feature<Polygon | MultiPolygon> => f !== null);

    if (provincePolygons.length === 0) return [];

    let unionGeom: Feature<Polygon | MultiPolygon> | null = provincePolygons[0]!;
    for (let i = 1; i < provincePolygons.length; i++) {
      try {
        const result = union(featureCollection([unionGeom!, provincePolygons[i]!]));
        if (result) unionGeom = result as Feature<Polygon | MultiPolygon>;
      } catch {
        // Skip invalid geometry in union
      }
    }

    if (!unionGeom) return [];

    // Difference: country border minus province union = gaps
    const countryFeature = toTurfFeature(countryBorder);
    if (!countryFeature) return [];

    const diff = difference(featureCollection([countryFeature, unionGeom]));

    if (!diff || !diff.geometry) return [];

    // Extract individual gap polygons
    const gapPolygons = extractPolygons(diff.geometry as Polygon | MultiPolygon);
    for (const gapGeom of gapPolygons) {
      const areaSqKm = computeAreaSqKm(gapGeom);
      if (areaSqKm < 0.01) continue; // Skip negligible gaps

      // Find adjacent provinces
      const adjacent = findAdjacentProvinces(gapGeom, provinces);
      const countryArea = computeAreaSqKm(countryBorder);
      const areaPercent = countryArea > 0 ? areaSqKm / countryArea : 0;

      gaps.push({
        geometry: gapGeom,
        areaSqKm: Math.round(areaSqKm * 100) / 100,
        adjacentProvinces: adjacent,
        autoFixable: areaPercent < 0.01, // < 1% of country area
      });
    }
  } catch {
    // Turf operations can fail on invalid geometries
  }

  return gaps;
}

// ──────────────────────────────────────────────
// Overlap Detection
// ──────────────────────────────────────────────

/**
 * Detect overlaps between pairs of provinces.
 * Pre-filters by bounding box for performance.
 */
export function detectOverlaps(provinces: ProvinceFeature[]): OverlapReport[] {
  const overlaps: OverlapReport[] = [];
  const included = provinces.filter((p) => p.included);

  for (let i = 0; i < included.length; i++) {
    for (let j = i + 1; j < included.length; j++) {
      const a = included[i]!;
      const b = included[j]!;

      // Quick bbox check — skip if no overlap
      if (!bboxOverlap(a.bbox, b.bbox)) continue;

      try {
        const featA = toTurfFeature(a.geometry);
        const featB = toTurfFeature(b.geometry);
        if (!featA || !featB) continue;

        const intersection = intersect(featureCollection([featA, featB]));
        if (!intersection || !intersection.geometry) continue;

        const areaSqKm = computeAreaSqKm(intersection.geometry as Polygon | MultiPolygon);
        if (areaSqKm < 0.01) continue; // Skip negligible overlaps

        const overlapPolygons = extractPolygons(intersection.geometry as Polygon | MultiPolygon);
        for (const geom of overlapPolygons) {
          const polyArea = computeAreaSqKm(geom);
          if (polyArea < 0.01) continue;

          overlaps.push({
            geometry: geom,
            areaSqKm: Math.round(polyArea * 100) / 100,
            provinces: [a.name, b.name],
          });
        }
      } catch {
        // Skip invalid intersection computation
      }
    }
  }

  return overlaps;
}

// ──────────────────────────────────────────────
// Coverage Calculation
// ──────────────────────────────────────────────

/**
 * Calculate the percentage of country area covered by provinces.
 */
export function computeCoverage(
  provinces: ProvinceFeature[],
  countryBorder: Polygon | MultiPolygon
): number {
  const countryArea = computeAreaSqKm(countryBorder);
  if (countryArea === 0) return 0;

  const totalArea = provinces
    .filter((p) => p.included)
    .reduce((sum, p) => sum + computeAreaSqKm(p.geometry), 0);

  return Math.min(100, (totalArea / countryArea) * 100);
}

// ──────────────────────────────────────────────
// Auto-Fix Operations
// ──────────────────────────────────────────────

/**
 * Auto-fill small gaps by expanding the nearest province.
 * Only fills gaps below `maxGapAreaPercent` of the country area.
 */
export function autoFillGaps(
  provinces: ProvinceFeature[],
  gaps: GapReport[],
  countryBorder: Polygon | MultiPolygon
): ProvinceFeature[] {
  const countryArea = computeAreaSqKm(countryBorder);
  const result = provinces.map((p) => ({
    ...p,
    geometry: { ...p.geometry } as Polygon | MultiPolygon,
  }));

  for (const gap of gaps) {
    if (!gap.autoFixable) continue;
    const areaPercent = countryArea > 0 ? gap.areaSqKm / countryArea : 0;
    if (areaPercent >= 0.01) continue; // Skip gaps > 1% of country

    // Find nearest included province
    const gapCentroid = centroid(toTurfFeature(gap.geometry)!);
    const gapCenter = gapCentroid.geometry.coordinates as Position;

    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < result.length; i++) {
      if (!result[i]!.included) continue;
      const dist = distanceDeg(gapCenter, result[i]!.centroid);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    if (nearestIdx >= 0) {
      try {
        const province = result[nearestIdx]!;
        const provFeat = toTurfFeature(province.geometry);
        const gapFeat = toTurfFeature(gap.geometry);
        if (provFeat && gapFeat) {
          const merged = union(featureCollection([provFeat, gapFeat]));
          if (merged && merged.geometry) {
            result[nearestIdx] = {
              ...province,
              geometry: merged.geometry as Polygon | MultiPolygon,
            };
          }
        }
      } catch {
        // Skip if merge fails
      }
    }
  }

  return result;
}

/**
 * Resolve overlaps between provinces using the "larger-wins" strategy.
 * The overlap area is removed from the smaller province.
 */
export function resolveOverlaps(
  provinces: ProvinceFeature[],
  overlaps: OverlapReport[]
): ProvinceFeature[] {
  const result = provinces.map((p) => ({
    ...p,
    geometry: { ...p.geometry } as Polygon | MultiPolygon,
  }));

  for (const overlap of overlaps) {
    // Find the two provinces
    const idxA = result.findIndex((p) => p.name === overlap.provinces[0]);
    const idxB = result.findIndex((p) => p.name === overlap.provinces[1]);
    if (idxA < 0 || idxB < 0) continue;

    // Smaller province loses the overlap area
    const areaA = computeAreaSqKm(result[idxA]!.geometry);
    const areaB = computeAreaSqKm(result[idxB]!.geometry);
    const loserIdx = areaA <= areaB ? idxA : idxB;

    try {
      const loserFeat = toTurfFeature(result[loserIdx]!.geometry);
      const overlapFeat = toTurfFeature(overlap.geometry);
      if (loserFeat && overlapFeat) {
        const diff = difference(featureCollection([loserFeat, overlapFeat]));
        if (diff && diff.geometry) {
          result[loserIdx] = {
            ...result[loserIdx]!,
            geometry: diff.geometry as Polygon | MultiPolygon,
          };
        }
      }
    } catch {
      // Skip if difference fails
    }
  }

  return result;
}

// ──────────────────────────────────────────────
// Simplification
// ──────────────────────────────────────────────

/**
 * Simplify province geometries using topology-preserving batch simplification.
 * Delegates to topo-simplify which uses TopoJSON to ensure shared borders
 * are simplified identically, preventing gaps between provinces.
 *
 * @param tolerance - Legacy parameter, ignored when options.targetVertices is set.
 * @param options - Optional config: { targetVertices?: number }
 */
export function simplifyProvinces(
  provinces: ProvinceFeature[],
  tolerance: number,
  options?: { targetVertices?: number }
): ProvinceFeature[] {
  const { simplifyProvinceBatch } = require("./topo-simplify") as typeof import("./topo-simplify");

  const included = provinces.filter((p) => p.included && p.geometry);
  if (included.length === 0) return provinces;

  // Build Feature array from included provinces
  const features = included.map((p) => ({
    type: "Feature" as const,
    properties: { name: p.name, sourceId: p.sourceId },
    geometry: p.geometry as Polygon | MultiPolygon,
  }));

  const result = simplifyProvinceBatch(features, {
    targetVerticesPerProvince: options?.targetVertices ?? 100,
  });

  // Map simplified geometries back onto provinces by index
  let simplifiedIdx = 0;
  return provinces.map((p) => {
    if (!p.included || !p.geometry) return p;
    const simplified = result.features[simplifiedIdx];
    simplifiedIdx++;
    if (simplified?.geometry) {
      return { ...p, geometry: simplified.geometry as Polygon | MultiPolygon };
    }
    return p;
  });
}

// ──────────────────────────────────────────────
// Individual Feature Validation
// ──────────────────────────────────────────────

function validateIndividualFeatures(provinces: ProvinceFeature[]): TopologyReport["featureIssues"] {
  const issues: TopologyReport["featureIssues"] = [];

  for (let i = 0; i < provinces.length; i++) {
    const p = provinces[i]!;
    if (!p.included) continue;

    const featureIssues: string[] = [];

    // Check geometry validity
    const rings =
      p.geometry.type === "Polygon" ? p.geometry.coordinates : p.geometry.coordinates.flat();

    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri]!;
      if (ring.length < 4) {
        featureIssues.push(`Ring ${ri} has < 4 coordinates`);
      }

      // Check ring closure
      if (ring.length >= 2) {
        const first = ring[0]!;
        const last = ring[ring.length - 1]!;
        if (Math.abs(first[0]! - last[0]!) > 1e-8 || Math.abs(first[1]! - last[1]!) > 1e-8) {
          featureIssues.push(`Ring ${ri} is not closed`);
        }
      }
    }

    // Check minimum area
    const area = computeAreaSqKm(p.geometry);
    if (area < 0.1) {
      featureIssues.push(`Very small area (${area.toFixed(2)} sq km)`);
    }

    // Check self-intersection (basic check via turf)
    try {
      const feature = toTurfFeature(p.geometry);
      if (feature) {
        const kinkResult = kinks(feature);
        if (kinkResult.features.length > 0) {
          featureIssues.push(`Self-intersecting geometry (${kinkResult.features.length} kinks)`);
        }
      }
    } catch {
      // Skip kinks check if it fails
    }

    if (featureIssues.length > 0) {
      issues.push({
        provinceIndex: i,
        provinceName: p.name,
        issues: featureIssues,
      });
    }
  }

  return issues;
}

// ──────────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────────

/** Build a GeoJSON Feature wrapper — avoids reliance on turf.feature which can be tree-shaken away. */
function makeFeature<G extends Polygon | MultiPolygon>(geometry: G): Feature<G> {
  return { type: "Feature", properties: {}, geometry };
}

function toTurfFeature(geometry: Polygon | MultiPolygon): Feature<Polygon | MultiPolygon> | null {
  try {
    return makeFeature(geometry);
  } catch {
    return null;
  }
}

function computeAreaSqKm(geometry: Polygon | MultiPolygon): number {
  try {
    const feat = toTurfFeature(geometry);
    if (!feat) return 0;
    return area(feat) / 1_000_000; // m² to km²
  } catch {
    return 0;
  }
}

function extractPolygons(geometry: Polygon | MultiPolygon): Polygon[] {
  if (geometry.type === "Polygon") return [geometry];
  return geometry.coordinates.map((coords) => ({
    type: "Polygon" as const,
    coordinates: coords,
  }));
}

function bboxOverlap(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}

function findAdjacentProvinces(gapGeom: Polygon, provinces: ProvinceFeature[]): string[] {
  const adjacent: string[] = [];
  const gapBbox = bbox(makeFeature(gapGeom)) as [number, number, number, number];

  for (const p of provinces) {
    if (!p.included) continue;
    if (!bboxOverlap(gapBbox, p.bbox)) continue;

    try {
      const gapFeat = makeFeature(gapGeom);
      const provFeat = toTurfFeature(p.geometry);
      if (!provFeat) continue;

      // Check if they share any boundary (buffered check)
      const buffered = buffer(gapFeat, 0.001, { units: "degrees" });
      if (buffered) {
        const intersection = intersect(featureCollection([buffered, provFeat]));
        if (intersection) adjacent.push(p.name);
      }
    } catch {
      // Skip
    }
  }

  return adjacent;
}

function distanceDeg(a: Position, b: Position): number {
  const dx = a[0]! - b[0]!;
  const dy = a[1]! - b[1]!;
  return Math.sqrt(dx * dx + dy * dy);
}

// ──────────────────────────────────────────────
// Border Conformance / Clipping
// ──────────────────────────────────────────────

export interface ConformanceResult {
  provinces: ProvinceFeature[];
  /** Indices of provinces whose geometry was clipped or excluded */
  clippedIndices: number[];
  /** Names of provinces that were clipped or excluded */
  clippedNames: string[];
}

/**
 * Extract Polygons from Geometry/GeometryCollection, keeping only
 * Polygon/MultiPolygon components. Returns a clean Polygon or MultiPolygon,
 * or null if no polygon component exists.
 */
export function cleanToPolygonOrMultiPolygon(geometry: any): Polygon | MultiPolygon | null {
  if (!geometry) return null;

  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    return geometry as Polygon | MultiPolygon;
  }

  if (geometry.type === "GeometryCollection") {
    const polygons: any[] = [];
    for (const g of geometry.geometries || []) {
      if (g.type === "Polygon") {
        polygons.push(g.coordinates);
      } else if (g.type === "MultiPolygon") {
        polygons.push(...g.coordinates);
      }
    }
    if (polygons.length === 0) return null;
    if (polygons.length === 1) {
      return {
        type: "Polygon",
        coordinates: polygons[0],
      };
    }
    return {
      type: "MultiPolygon",
      coordinates: polygons,
    };
  }

  return null;
}

/**
 * Clip all included province geometries to fit within the country border.
 * Uses turf.intersect to produce the intersection of each province with the country.
 */
export function clipProvincesToBorder(
  provinces: ProvinceFeature[],
  countryBorder: Polygon | MultiPolygon
): ConformanceResult {
  const clippedIndices: number[] = [];
  const clippedNames: string[] = [];
  const countryFeat = makeFeature(countryBorder);

  const result = provinces.map((p, i) => {
    if (!p.included) return p;

    try {
      const provFeat = makeFeature(p.geometry);
      const clipped = intersect(
        featureCollection([
          provFeat as Feature<Polygon | MultiPolygon>,
          countryFeat as Feature<Polygon | MultiPolygon>,
        ])
      );

      if (!clipped) {
        // Entirely outside country — exclude
        clippedIndices.push(i);
        clippedNames.push(p.name);
        return { ...p, included: false };
      }

      const cleaned = cleanToPolygonOrMultiPolygon(clipped.geometry);
      if (!cleaned) {
        clippedIndices.push(i);
        clippedNames.push(p.name);
        return { ...p, included: false };
      }

      // Check if geometry was actually modified
      const originalArea = area(provFeat);
      const clippedArea = area(makeFeature(cleaned));
      if (originalArea > 0 && Math.abs(originalArea - clippedArea) / originalArea > 0.001) {
        clippedIndices.push(i);
        clippedNames.push(p.name);
      }

      return {
        ...p,
        geometry: cleaned,
      };
    } catch {
      // If intersection fails, keep original
      return p;
    }
  });

  return { provinces: result, clippedIndices, clippedNames };
}

/**
 * Clip a single geometry to the country border.
 * Returns the clipped geometry and whether it was modified.
 */
export function clipGeometryToBorder(
  geometry: Polygon | MultiPolygon,
  countryBorder: Polygon | MultiPolygon
): { geometry: Polygon | MultiPolygon; wasClipped: boolean } {
  try {
    const feat = makeFeature(geometry);
    const borderFeat = makeFeature(countryBorder);
    const clipped = intersect(
      featureCollection([
        feat as Feature<Polygon | MultiPolygon>,
        borderFeat as Feature<Polygon | MultiPolygon>,
      ])
    );

    if (!clipped) return { geometry, wasClipped: true };

    const cleaned = cleanToPolygonOrMultiPolygon(clipped.geometry);
    if (!cleaned) return { geometry, wasClipped: true };

    const origArea = area(feat);
    const clipArea = area(makeFeature(cleaned));
    const wasClipped = origArea > 0 && Math.abs(origArea - clipArea) / origArea > 0.001;

    return { geometry: cleaned, wasClipped };
  } catch {
    return { geometry, wasClipped: false };
  }
}

// ──────────────────────────────────────────────
// Point Snapping & Boundary Constraints
// ──────────────────────────────────────────────

/** Ray-casting point-in-polygon algorithm. Handles Polygons, MultiPolygons, and holes. */
export function isPointInPolygon(
  point: [number, number],
  polygon: Polygon | MultiPolygon
): boolean {
  if (!point || isNaN(point[0]) || isNaN(point[1])) return false;
  const [lng, lat] = point;
  const polys = polygon.type === "Polygon" ? [polygon.coordinates] : polygon.coordinates;

  let inside = false;
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring) continue;

    let ringInside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const pi = ring[i];
      const pj = ring[j];
      if (!pi || !pj || isNaN(pi[0]) || isNaN(pi[1]) || isNaN(pj[0]) || isNaN(pj[1])) continue;

      const xi = pi[0],
        yi = pi[1];
      const xj = pj[0],
        yj = pj[1];

      const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) ringInside = !ringInside;
    }

    if (ringInside) {
      let insideHole = false;
      for (let h = 1; h < poly.length; h++) {
        const hole = poly[h];
        if (!hole) continue;
        let holeInside = false;
        for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
          const pi = hole[i];
          const pj = hole[j];
          if (!pi || !pj || isNaN(pi[0]) || isNaN(pi[1]) || isNaN(pj[0]) || isNaN(pj[1])) continue;

          const xi = pi[0],
            yi = pi[1];
          const xj = pj[0],
            yj = pj[1];

          const intersect =
            yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
          if (intersect) holeInside = !holeInside;
        }
        if (holeInside) {
          insideHole = true;
          break;
        }
      }
      if (!insideHole) {
        inside = true;
      }
    }
  }
  return inside;
}

function closestPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): [number, number] {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const abLen2 = abx * abx + aby * aby;
  if (abLen2 === 0 || isNaN(abLen2)) return a;

  let t = (apx * abx + apy * aby) / abLen2;
  if (isNaN(t)) return a;
  t = Math.max(0, Math.min(1, t));

  return [ax + t * abx, ay + t * aby];
}

export function findClosestPointOnBoundary(
  point: [number, number],
  polygon: Polygon | MultiPolygon
): [number, number] {
  const polys = polygon.type === "Polygon" ? [polygon.coordinates] : polygon.coordinates;

  let closestPoint: [number, number] = point;
  let minDistance2 = Infinity;

  for (const poly of polys) {
    const ring = poly[0];
    if (!ring || ring.length < 2) continue;

    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      if (!a || !b || isNaN(a[0]) || isNaN(a[1]) || isNaN(b[0]) || isNaN(b[1])) continue;

      const cp = closestPointOnSegment(point, a as [number, number], b as [number, number]);
      if (!cp || isNaN(cp[0]) || isNaN(cp[1])) continue;

      const dx = point[0] - cp[0];
      const dy = point[1] - cp[1];
      const d2 = dx * dx + dy * dy;

      if (!isNaN(d2) && d2 < minDistance2) {
        minDistance2 = d2;
        closestPoint = cp;
      }
    }
  }

  return closestPoint;
}

function getCentroid(polygon: Polygon | MultiPolygon): [number, number] {
  const polys = polygon.type === "Polygon" ? [polygon.coordinates] : polygon.coordinates;
  let sumX = 0,
    sumY = 0,
    count = 0;
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring) continue;
    for (const pt of ring) {
      if (!pt || isNaN(pt[0]) || isNaN(pt[1])) continue;
      sumX += pt[0]!;
      sumY += pt[1]!;
      count++;
    }
  }
  return count > 0 ? [sumX / count, sumY / count] : [0, 0];
}

export function snapPointToCountryBorderJS(
  point: [number, number],
  polygon: Polygon | MultiPolygon,
  provinces: ProvinceFeature[],
  maxDistanceMeters = 10000
): [number, number] {
  if (!point || isNaN(point[0]) || isNaN(point[1])) {
    return point;
  }

  if (isPointInPolygon(point, polygon)) {
    return point;
  }

  const closestPoint = findClosestPointOnBoundary(point, polygon);
  if (!closestPoint || isNaN(closestPoint[0]) || isNaN(closestPoint[1])) {
    return point;
  }

  const dx = point[0] - closestPoint[0];
  const dy = point[1] - closestPoint[1];
  const distanceDegrees = Math.hypot(dx, dy);
  const distanceMeters = distanceDegrees * 111000;

  if (distanceMeters > maxDistanceMeters) {
    return closestPoint;
  }

  let targetCentroid: [number, number] = closestPoint;
  let minCentroidDist = Infinity;
  for (const p of provinces) {
    if (!p.included || !p.centroid || isNaN(p.centroid[0]) || isNaN(p.centroid[1])) continue;
    const dist = Math.hypot(closestPoint[0] - p.centroid[0], closestPoint[1] - p.centroid[1]);
    if (dist < minCentroidDist) {
      minCentroidDist = dist;
      targetCentroid = p.centroid;
    }
  }

  if (minCentroidDist === Infinity) {
    targetCentroid = getCentroid(polygon);
  }

  if (!targetCentroid || isNaN(targetCentroid[0]) || isNaN(targetCentroid[1])) {
    return closestPoint;
  }

  const vx = targetCentroid[0] - closestPoint[0];
  const vy = targetCentroid[1] - closestPoint[1];
  const len = Math.hypot(vx, vy);

  if (len > 0 && !isNaN(len)) {
    for (const nudgeAmount of [0.0001, 0.0002, 0.0005, 0.001]) {
      const nx = closestPoint[0] + (vx / len) * nudgeAmount;
      const ny = closestPoint[1] + (vy / len) * nudgeAmount;
      const candidate: [number, number] = [nx, ny];
      if (isPointInPolygon(candidate, polygon)) {
        return candidate;
      }
    }
  }

  return closestPoint;
}
