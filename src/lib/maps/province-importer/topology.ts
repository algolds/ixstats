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
import { boxDistanceSq, distanceDeg } from "../planar";
import { toPolygonal } from "../polygonal-geometry";

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

/**
 * Detect gaps between provinces and the country border.
 * A gap is an area within the country that is not covered by any province.
 */
function detectGaps(
  provinces: ProvinceFeature[],
  countryBorder: Polygon | MultiPolygon
): GapReport[] {
  const gaps: GapReport[] = [];

  try {
    // Union all provinces
    const provincePolygons = provinces
      .filter((p) => p.included)
      .map((p) => makeFeature(p.geometry));

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
    const countryFeature = makeFeature(countryBorder);

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

/**
 * Detect overlaps between pairs of provinces.
 * Pre-filters by bounding box for performance.
 */
function detectOverlaps(provinces: ProvinceFeature[]): OverlapReport[] {
  const overlaps: OverlapReport[] = [];
  const included = provinces.filter((p) => p.included);

  for (let i = 0; i < included.length; i++) {
    for (let j = i + 1; j < included.length; j++) {
      const a = included[i]!;
      const b = included[j]!;

      // Quick bbox check — skip if no overlap
      if (!bboxOverlap(a.bbox, b.bbox)) continue;

      try {
        const intersection = intersect(
          featureCollection([makeFeature(a.geometry), makeFeature(b.geometry)])
        );
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
    const gapCentroid = centroid(makeFeature(gap.geometry));
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
        const merged = union(
          featureCollection([makeFeature(province.geometry), makeFeature(gap.geometry)])
        );
        if (merged?.geometry) {
          result[nearestIdx] = { ...province, geometry: merged.geometry as Polygon | MultiPolygon };
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
      const diff = difference(
        featureCollection([makeFeature(result[loserIdx]!.geometry), makeFeature(overlap.geometry)])
      );
      if (diff?.geometry) {
        result[loserIdx] = {
          ...result[loserIdx]!,
          geometry: diff.geometry as Polygon | MultiPolygon,
        };
      }
    } catch {
      // Skip if difference fails
    }
  }

  return result;
}

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
    const simplified = result.features[simplifiedIdx++];
    return simplified?.geometry ? { ...p, geometry: simplified.geometry } : p;
  });
}

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
    // oxlint-disable-next-line eslint/no-shadow -- shadowed 'area' is intentional in this scope
    const area = computeAreaSqKm(p.geometry);
    if (area < 0.1) {
      featureIssues.push(`Very small area (${area.toFixed(2)} sq km)`);
    }

    // Check self-intersection (basic check via turf)
    try {
      const kinkCount = kinks(makeFeature(p.geometry)).features.length;
      if (kinkCount > 0) {
        featureIssues.push(`Self-intersecting geometry (${kinkCount} kinks)`);
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

/** Build a GeoJSON Feature wrapper — avoids reliance on turf.feature which can be tree-shaken away. */
function makeFeature<G extends Polygon | MultiPolygon>(geometry: G): Feature<G> {
  return { type: "Feature", properties: {}, geometry };
}

function computeAreaSqKm(geometry: Polygon | MultiPolygon): number {
  try {
    return area(makeFeature(geometry)) / 1_000_000; // m² to km²
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
      // Check if they share any boundary (buffered check)
      const buffered = buffer(makeFeature(gapGeom), 0.001, { units: "degrees" });
      if (buffered && intersect(featureCollection([buffered, makeFeature(p.geometry)]))) {
        adjacent.push(p.name);
      }
    } catch {
      // Skip
    }
  }

  return adjacent;
}

export interface ConformanceResult {
  provinces: ProvinceFeature[];
  /** Indices of provinces whose geometry was clipped or excluded */
  clippedIndices: number[];
  /** Names of provinces that were clipped or excluded */
  clippedNames: string[];
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

      const cleaned = toPolygonal(clipped.geometry);
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

    const cleaned = toPolygonal(clipped.geometry);
    if (!cleaned) return { geometry, wasClipped: true };

    const origArea = area(feat);
    const clipArea = area(makeFeature(cleaned));
    const wasClipped = origArea > 0 && Math.abs(origArea - clipArea) / origArea > 0.001;

    return { geometry: cleaned, wasClipped };
  } catch {
    return { geometry, wasClipped: false };
  }
}

const polygonsOf = (polygon: Polygon | MultiPolygon): Position[][][] =>
  polygon.type === "Polygon" ? [polygon.coordinates] : polygon.coordinates;

const isValidPoint = (p: ArrayLike<number> | null | undefined): p is ArrayLike<number> =>
  !!p && !isNaN(p[0]!) && !isNaN(p[1]!);

/** Ray-casting test of a point against one ring; ring vertices with NaN coordinates are skipped. */
function ringContains(ring: Position[], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i];
    const pj = ring[j];
    if (!isValidPoint(pi) || !isValidPoint(pj)) continue;
    const [xi, yi] = pi as [number, number];
    const [xj, yj] = pj as [number, number];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Ray-casting point-in-polygon algorithm. Handles Polygons, MultiPolygons, and holes. */
function isPointInPolygon(point: [number, number], polygon: Polygon | MultiPolygon): boolean {
  if (!isValidPoint(point)) return false;
  const [lng, lat] = point;
  return polygonsOf(polygon).some(([outer, ...holes]) => {
    return (
      !!outer && ringContains(outer, lng, lat) && !holes.some((h) => ringContains(h, lng, lat))
    );
  });
}

function closestPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): [number, number] {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abLen2 = abx * abx + aby * aby;
  if (abLen2 === 0 || isNaN(abLen2)) return a;

  const t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / abLen2;
  if (isNaN(t)) return a;
  const clamped = Math.max(0, Math.min(1, t));

  return [a[0] + clamped * abx, a[1] + clamped * aby];
}

export function findClosestPointOnBoundary(
  point: [number, number],
  polygon: Polygon | MultiPolygon
): [number, number] {
  let closestPoint: [number, number] = point;
  let minDistance2 = Infinity;
  const [px, py] = point;

  for (const [ring] of polygonsOf(polygon)) {
    if (!ring || ring.length < 2) continue;

    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      if (!isValidPoint(a) || !isValidPoint(b)) continue;

      // Skip segments whose bounding box is already farther than the best so far
      if (boxDistanceSq(px, py, a, b) >= minDistance2) continue;

      const cp = closestPointOnSegment(point, a as [number, number], b as [number, number]);
      if (!isValidPoint(cp)) continue;

      const d2 = (px - cp[0]) ** 2 + (py - cp[1]) ** 2;
      if (!isNaN(d2) && d2 < minDistance2) {
        minDistance2 = d2;
        closestPoint = cp;
      }
    }
  }

  return closestPoint;
}

/** Mean of the outer-ring vertices of every polygon. */
function getCentroid(polygon: Polygon | MultiPolygon): [number, number] {
  const pts = polygonsOf(polygon).flatMap(([ring]) => (ring ?? []).filter(isValidPoint));
  if (pts.length === 0) return [0, 0];
  return [
    pts.reduce((sum, pt) => sum + pt[0]!, 0) / pts.length,
    pts.reduce((sum, pt) => sum + pt[1]!, 0) / pts.length,
  ];
}

const NUDGE_STEPS_DEG = [0.0001, 0.0002, 0.0005, 0.001];

/**
 * Snap a point into the country polygon: points already inside stay put; others move to the
 * closest boundary point, nudged inward toward the nearest included province centroid.
 */
export function snapPointToCountryBorderJS(
  point: [number, number],
  polygon: Polygon | MultiPolygon,
  provinces: ProvinceFeature[],
  maxDistanceMeters = 10000
): [number, number] {
  if (!isValidPoint(point) || isPointInPolygon(point, polygon)) return point;

  const closestPoint = findClosestPointOnBoundary(point, polygon);
  if (!isValidPoint(closestPoint)) return point;

  const distanceMeters =
    Math.hypot(point[0] - closestPoint[0], point[1] - closestPoint[1]) * 111000;
  if (distanceMeters > maxDistanceMeters) return closestPoint;

  let targetCentroid: [number, number] | undefined;
  let minCentroidDist = Infinity;
  for (const p of provinces) {
    if (!p.included || !isValidPoint(p.centroid)) continue;
    const dist = Math.hypot(closestPoint[0] - p.centroid[0], closestPoint[1] - p.centroid[1]);
    if (dist < minCentroidDist) {
      minCentroidDist = dist;
      targetCentroid = p.centroid;
    }
  }
  const target = targetCentroid ?? getCentroid(polygon);
  if (!isValidPoint(target)) return closestPoint;

  const vx = target[0] - closestPoint[0];
  const vy = target[1] - closestPoint[1];
  const len = Math.hypot(vx, vy);

  if (len > 0 && !isNaN(len)) {
    for (const nudgeAmount of NUDGE_STEPS_DEG) {
      const candidate: [number, number] = [
        closestPoint[0] + (vx / len) * nudgeAmount,
        closestPoint[1] + (vy / len) * nudgeAmount,
      ];
      if (isPointInPolygon(candidate, polygon)) return candidate;
    }
  }

  return closestPoint;
}
