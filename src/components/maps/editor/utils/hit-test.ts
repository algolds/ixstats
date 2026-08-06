/**
 * Deterministic distance-based hit-testing for the map editor (Plan 120 P1).
 *
 * Replaces the previous fixed ±6px bbox + "points-first" stable sort with a
 * predictable, Photoshop-like model:
 *
 *  1. Exact-point query first: whatever is actually rendered under the cursor
 *     wins (a point dot beats a polygon fill; a polygon beats nothing).
 *  2. If nothing is under the cursor, fall back to the nearest point within a
 *     per-layer tolerance (grab-assist for small dots).
 *
 * Points render 4–7px, so an exact-point query already covers "aimed at the
 * dot"; the tolerance fallback only kicks in over empty space, which prevents
 * accidental point selection when clicking a region.
 */

import type { Map as MapLibreMap, PointLike } from "maplibre-gl";

export type HitLayerKind = "point" | "label" | "polygon" | "gap";

export interface HitResult {
  layerId: string;
  featureId: string | undefined;
  kind: HitLayerKind;
  /** Pixel distance from the cursor to the feature's anchor (points/labels), or 0 for containment. */
  distance: number;
  feature: any;
}

export interface HitTestOptions {
  /** Grab tolerance for point layers (px). Default 8. */
  pointTolerance?: number;
  /** Grab tolerance for label layers (px). Default 6. */
  labelTolerance?: number;
  /** Exact-query tolerance for polygon layers (px). Default 2. */
  polygonTolerance?: number;
  /** Exact-query tolerance for gap layers (px). Default 2. */
  gapTolerance?: number;
  /** Restrict candidates to these layer ids. Defaults to all interactive layers. */
  layers?: string[];
  /** Layers to exclude from SELECTION (still detected, e.g. for a "not-allowed" cursor). */
  excludeLayers?: string[];
}

export interface HitTestResult {
  /** Best selectable hit (never on an excluded layer), or null. */
  hit: HitResult | null;
  /** True when the cursor is over an excluded (locked) layer feature. */
  locked: boolean;
}

const POINT_LAYERS = [
  "editor-points-capital",
  "editor-points-city",
  "editor-points-poi",
  "editor-points-story-pin",
  "editor-points-map-label",
];

const LABEL_LAYERS = ["editor-points-labels", "editor-map-labels"];

const POLYGON_LAYERS = ["editor-subdivisions-fill"];

const GAP_LAYERS = ["editor-gaps-fill"];

const POINT_PRIORITY: Record<string, number> = {
  "editor-points-capital": 0,
  "editor-points-city": 1,
  "editor-points-poi": 2,
  "editor-points-story-pin": 3,
  "editor-points-map-label": 4,
  "editor-points-labels": 5,
  "editor-map-labels": 6,
};

function layerKind(layerId: string): HitLayerKind {
  if (layerId.startsWith("editor-points-")) return "point";
  if (layerId === "editor-map-labels") return "label";
  if (layerId === "editor-subdivisions-fill") return "polygon";
  if (layerId === "editor-gaps-fill") return "gap";
  return "point";
}

function getAnchorCoords(feature: any): [number, number] | null {
  const geom = feature?.geometry;
  if (!geom) return null;
  if (geom.type === "Point" && Array.isArray(geom.coordinates)) {
    return [geom.coordinates[0], geom.coordinates[1]];
  }
  if (geom.type === "MultiPoint" && Array.isArray(geom.coordinates?.[0])) {
    return [geom.coordinates[0][0], geom.coordinates[0][1]];
  }
  return null;
}

function pixelDistance(
  map: MapLibreMap,
  point: { x: number; y: number },
  feature: any
): number {
  const coords = getAnchorCoords(feature);
  if (!coords) return Number.POSITIVE_INFINITY;
  try {
    const proj = map.project([coords[0], coords[1]]);
    return Math.hypot(proj.x - point.x, proj.y - point.y);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function makeBbox(point: { x: number; y: number }, tol: number): [PointLike, PointLike] {
  return [
    [point.x - tol, point.y - tol],
    [point.x + tol, point.y + tol],
  ];
}

export function hitTestFeatures(
  map: MapLibreMap,
  point: PointLike,
  opts: HitTestOptions = {}
): HitTestResult {
  const pointTolerance = opts.pointTolerance ?? 8;
  const labelTolerance = opts.labelTolerance ?? 6;
  const polygonTolerance = opts.polygonTolerance ?? 2;
  const gapTolerance = opts.gapTolerance ?? 2;

  const restrict = opts.layers ? new Set(opts.layers) : null;
  const include = (id: string) => !restrict || restrict.has(id);

  const pointLayers = POINT_LAYERS.filter(include);
  const labelLayers = LABEL_LAYERS.filter(include);
  const polyLayers = POLYGON_LAYERS.filter(include);
  const gapLayers = GAP_LAYERS.filter(include);
  const allLayers = [...pointLayers, ...labelLayers, ...polyLayers, ...gapLayers];
  if (allLayers.length === 0) return { hit: null, locked: false };

  const p = Array.isArray(point) ? { x: point[0], y: point[1] } : point;

  // ── Phase 1: exact-point query (what is rendered under the cursor) ──
  // Small bbox tolerance for polygon/gap layers so a near-edge cursor still
  // resolves the fill; point/label layers query the exact pixel and rely on
  // Phase 2 grab-assist for near misses.
  const polyQuery =
    polygonTolerance > 0 || gapTolerance > 0
      ? makeBbox(p, Math.max(polygonTolerance, gapTolerance))
      : point;
  const exactHits = map.queryRenderedFeatures(polyQuery, { layers: allLayers });

  const exactPoints: HitResult[] = [];
  const exactPolys: HitResult[] = [];
  let lockedHit: HitResult | null = null;

  for (const feature of exactHits) {
    const layerId = feature.layer.id;
    const kind = layerKind(layerId);
    const result: HitResult = {
      layerId,
      featureId: feature.properties?.id as string | undefined,
      kind,
      distance: kind === "point" || kind === "label" ? pixelDistance(map, p, feature) : 0,
      feature,
    };
    if (kind === "point" || kind === "label") exactPoints.push(result);
    else exactPolys.push(result);

    if (opts.excludeLayers?.includes(layerId) && !lockedHit) {
      lockedHit = result;
    }
  }

  exactPoints.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return (POINT_PRIORITY[a.layerId] ?? 99) - (POINT_PRIORITY[b.layerId] ?? 99);
  });

  const bestExactPoint = exactPoints.find((h) => !opts.excludeLayers?.includes(h.layerId));
  if (bestExactPoint) {
    return { hit: bestExactPoint, locked: !!lockedHit };
  }

  const bestExactPoly = exactPolys.find(
    (h) => !opts.excludeLayers?.includes(h.layerId)
  );
  if (bestExactPoly) {
    return { hit: bestExactPoly, locked: !!lockedHit };
  }

  // ── Phase 2: grab-assist — nearest point within tolerance (empty space only) ──
  const grabLayers = pointLayers.filter((id) => !opts.excludeLayers?.includes(id));
  const grabHits: HitResult[] = [];
  for (const layerId of grabLayers) {
    const tol = pointLayers.includes(layerId) ? pointTolerance : labelTolerance;
    const hits = map.queryRenderedFeatures(makeBbox(p, tol), { layers: [layerId] });
    for (const feature of hits) {
      grabHits.push({
        layerId,
        featureId: feature.properties?.id as string | undefined,
        kind: "point",
        distance: pixelDistance(map, p, feature),
        feature,
      });
    }
  }
  for (const layerId of labelLayers.filter((id) => !opts.excludeLayers?.includes(id))) {
    const hits = map.queryRenderedFeatures(makeBbox(p, labelTolerance), { layers: [layerId] });
    for (const feature of hits) {
      grabHits.push({
        layerId,
        featureId: feature.properties?.id as string | undefined,
        kind: "label",
        distance: pixelDistance(map, p, feature),
        feature,
      });
    }
  }

  grabHits.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return (POINT_PRIORITY[a.layerId] ?? 99) - (POINT_PRIORITY[b.layerId] ?? 99);
  });

  const best = grabHits[0] ?? null;
  return { hit: best, locked: !!lockedHit };
}
