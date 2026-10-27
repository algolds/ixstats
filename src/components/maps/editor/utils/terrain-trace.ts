/**
 * Terrain path tracing for the subdivision draw tool.
 *
 * When two consecutive draw clicks land on the same river, lake shore or coastline, the
 * polygon edge between them should follow that feature instead of cutting straight across.
 * `traceBetween` returns the feature's vertices between the two points (shorter direction),
 * capped so a long river or continent coastline cannot flood the polygon.
 */

import type { Geometry, Position } from "geojson";
import { lineString } from "@turf/helpers";
import { simplify } from "@turf/simplify";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { distanceDeg, projectPointToSegment } from "~/lib/maps/border-editor";
import { getGenericBBox, type BoundingBox } from "./map-helpers";

/** Layers whose lines/rings can be traced. "background" is the landmass, i.e. the coastline. */
const TRACE_LAYER_TYPES = ["rivers", "lakes", "background"] as const;

/** Most vertices one trace may insert; longer runs are simplified down to this. */
const MAX_TRACE_VERTICES = 500;

/** A traceable polyline. `size` excludes a closed ring's repeated closing vertex. */
interface TracePath {
  coords: Position[];
  size: number;
  closed: boolean;
}

function samePoint(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function toPath(coords: Position[], closed: boolean): TracePath {
  const last = coords[coords.length - 1];
  const repeatsFirst = closed && coords.length > 1 && !!last && samePoint(coords[0]!, last);
  return { coords, size: repeatsFirst ? coords.length - 1 : coords.length, closed };
}

/** Split any line or polygon geometry into traceable paths (polygon rings are closed paths). */
export function geometryToTracePaths(geom: Geometry): TracePath[] {
  let paths: TracePath[] = [];
  if (geom.type === "LineString") paths = [toPath(geom.coordinates, false)];
  else if (geom.type === "MultiLineString") paths = geom.coordinates.map((l) => toPath(l, false));
  else if (geom.type === "Polygon") paths = geom.coordinates.map((r) => toPath(r, true));
  else if (geom.type === "MultiPolygon") {
    paths = geom.coordinates.flat().map((r) => toPath(r, true));
  }
  return paths.filter((p) => p.size >= (p.closed ? 3 : 2));
}

interface SegmentHit {
  segment: number;
  dist: number;
}

/** Nearest segment of `path` to `point` within `tolerance`, or null. */
function nearestSegment(point: Position, path: TracePath, tolerance: number): SegmentHit | null {
  const segmentCount = path.closed ? path.size : path.size - 1;
  let best: SegmentHit | null = null;
  for (let i = 0; i < segmentCount; i++) {
    const a = path.coords[i]!;
    const b = path.coords[(i + 1) % path.size]!;
    const dist = distanceDeg(point, projectPointToSegment(point, a, b));
    if (dist <= tolerance && (!best || dist < best.dist)) best = { segment: i, dist };
  }
  return best;
}

/** `count` vertices walking forward (after `from`) or backward (from `from` itself). */
function walk(path: TracePath, from: number, count: number, forward: boolean): Position[] {
  const run: Position[] = [];
  for (let k = 1; k <= count; k++) {
    const index = forward ? from + k : from - k + 1;
    run.push(path.coords[(index + path.size) % path.size]!);
  }
  return run;
}

function runLength(start: Position, run: Position[], end: Position): number {
  let length = 0;
  let prev = start;
  for (const p of run) {
    length += distanceDeg(prev, p);
    prev = p;
  }
  return length + distanceDeg(prev, end);
}

/** Vertices strictly between two segments, ordered start → end, shorter way round a ring. */
function runBetween(
  path: TracePath,
  start: Position,
  end: Position,
  from: number,
  to: number
): Position[] {
  if (!path.closed) {
    return from <= to ? walk(path, from, to - from, true) : walk(path, from, from - to, false);
  }
  const forward = walk(path, from, (to - from + path.size) % path.size, true);
  const backward = walk(path, from, (from - to + path.size) % path.size, false);
  return runLength(start, forward, end) <= runLength(start, backward, end) ? forward : backward;
}

/** Simplify a run until it has at most `maxVertices` points (endpoints are always kept). */
export function capRun(run: Position[], maxVertices: number): Position[] {
  let capped = run;
  let tolerance = 0.0005;
  while (capped.length > Math.max(maxVertices, 2)) {
    capped = simplify(lineString(run), { tolerance, highQuality: false }).geometry.coordinates;
    tolerance *= 2;
  }
  return capped;
}

/**
 * Vertices of the shared path between `start` and `end`, excluding the two points themselves.
 * Both points must lie within `tolerance` of the same path; otherwise returns [].
 */
export function traceBetween(
  start: Position,
  end: Position,
  paths: TracePath[],
  tolerance: number,
  maxVertices: number = MAX_TRACE_VERTICES
): Position[] {
  let best: { path: TracePath; from: number; to: number; score: number } | null = null;
  for (const path of paths) {
    const a = nearestSegment(start, path, tolerance);
    const b = a && nearestSegment(end, path, tolerance);
    if (!a || !b) continue;
    const score = a.dist + b.dist;
    if (!best || score < best.score) best = { path, from: a.segment, to: b.segment, score };
  }
  if (!best) return [];

  const run = runBetween(best.path, start, end, best.from, best.to).filter(
    (p) => !samePoint(p, start) && !samePoint(p, end)
  );
  return capRun(run, maxVertices);
}

function bboxNear(bbox: BoundingBox, p: Position, tolerance: number): boolean {
  return (
    p[0]! >= bbox.minLng - tolerance &&
    p[0]! <= bbox.maxLng + tolerance &&
    p[1]! >= bbox.minLat - tolerance &&
    p[1]! <= bbox.maxLat + tolerance
  );
}

/**
 * Trace between two draw points along the rivers / lake shores / coastline in `layerTypes`.
 * Only features whose bounding box is near both points are considered.
 */
export function traceTerrainPath(
  start: Position,
  end: Position,
  worldMapLayers: MapLayerData[],
  layerTypes: ReadonlySet<string>,
  tolerance: number
): Position[] {
  const traceTypes: ReadonlySet<string> = new Set(TRACE_LAYER_TYPES);
  const paths: TracePath[] = [];
  for (const layer of worldMapLayers) {
    if (!traceTypes.has(layer.type) || !layerTypes.has(layer.type)) continue;
    for (const feature of layer.data?.features ?? []) {
      if (!feature.geometry) continue;
      const bbox = getGenericBBox(feature.geometry);
      if (!bboxNear(bbox, start, tolerance) || !bboxNear(bbox, end, tolerance)) continue;
      paths.push(...geometryToTracePaths(feature.geometry));
    }
  }
  return traceBetween(start, end, paths, tolerance);
}
