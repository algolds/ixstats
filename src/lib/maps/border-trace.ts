/**
 * Smart border following: trace along a river or coastline between two clicked points.
 *
 * Given two points and an array of GeoJSON features (rivers, coastlines — any LineString or
 * MultiLineString), finds the single feature whose polyline is nearest to BOTH points, then
 * returns the ordered run of that feature's vertices that lies between the two projection
 * positions (shorter direction along the line).
 *
 * Returns [] when:
 *  - no feature is within tolerance of either point
 *  - the two closest segments belong to different features or different polylines
 *  - there are no intermediate vertices to insert
 */

import { distanceDeg, projectPointToSegment } from "./border-editor";

export interface TraceFeature {
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  };
}

/**
 * Collect all coordinate arrays (each a flat polyline) from a feature.
 * Returns [] for non-linear geometry types.
 */
function extractPolylines(feature: TraceFeature): number[][][] {
  const { type, coordinates } = feature.geometry;
  if (type === "LineString") {
    return [coordinates as number[][]];
  }
  if (type === "MultiLineString") {
    return coordinates as number[][][];
  }
  return [];
}

interface SegmentMatch {
  featureIndex: number;
  lineIndex: number;
  segmentIndex: number;
  dist: number;
}

/**
 * Find the nearest segment (across all features / polylines) for a given point.
 * Returns null if nothing is within tolerance.
 */
function findNearestSegment(
  point: [number, number],
  features: TraceFeature[],
  tolerance: number
): SegmentMatch | null {
  let best: SegmentMatch | null = null;

  for (let fi = 0; fi < features.length; fi++) {
    const polylines = extractPolylines(features[fi]!);
    for (let li = 0; li < polylines.length; li++) {
      const line = polylines[li]!;
      for (let si = 0; si < line.length - 1; si++) {
        const proj = projectPointToSegment(
          point,
          line[si] as [number, number],
          line[si + 1] as [number, number]
        );
        const d = distanceDeg(point, proj);
        if (d <= tolerance && (!best || d < best.dist)) {
          best = { featureIndex: fi, lineIndex: li, segmentIndex: si, dist: d };
        }
      }
    }
  }

  return best;
}

/**
 * Collect the vertices between two segment indices on an open polyline.
 * Unlike a closed ring, an open polyline has only one meaningful path between
 * two segment positions — the direct interior route. Returns vertices ordered
 * from the start side to the end side.
 */
function walkPolyline(line: number[][], startSeg: number, endSeg: number): [number, number][] {
  if (line.length < 2 || startSeg === endSeg) return [];

  const lo = Math.min(startSeg, endSeg);
  const hi = Math.max(startSeg, endSeg);

  // Interior vertices between the two segments: indices lo+1 … hi (inclusive).
  // These are the shared vertices between adjacent segments.
  const vertices: [number, number][] = [];
  for (let i = lo + 1; i <= hi; i++) {
    vertices.push(line[i] as [number, number]);
  }

  // Return in order from startSeg toward endSeg
  return startSeg <= endSeg ? vertices : [...vertices].reverse();
}

/**
 * Trace along the nearest river/coast feature between two clicked points.
 *
 * @param start     First clicked coordinate [lng, lat]
 * @param end       Second clicked coordinate [lng, lat]
 * @param features  GeoJSON features to trace along (LineString / MultiLineString)
 * @param tolerance Max snap distance in degrees (default 0.05°)
 * @returns Ordered intermediate vertex run between the two snap positions, or [].
 */
export function traceAlongLayer(
  start: [number, number],
  end: [number, number],
  features: TraceFeature[],
  tolerance = 0.05
): [number, number][] {
  if (features.length === 0) return [];

  const startMatch = findNearestSegment(start, features, tolerance);
  const endMatch = findNearestSegment(end, features, tolerance);

  if (!startMatch || !endMatch) return [];

  // Both points must snap to the same feature and the same polyline within it
  if (
    startMatch.featureIndex !== endMatch.featureIndex ||
    startMatch.lineIndex !== endMatch.lineIndex
  ) {
    return [];
  }

  const feature = features[startMatch.featureIndex]!;
  const polylines = extractPolylines(feature);
  const line = polylines[startMatch.lineIndex]!;

  return walkPolyline(line, startMatch.segmentIndex, endMatch.segmentIndex);
}
