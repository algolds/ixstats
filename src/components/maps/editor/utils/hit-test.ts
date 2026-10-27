/**
 * Deterministic hit-testing for the map editor: whatever is rendered under the cursor wins
 * (a point dot beats a polygon fill); only over empty space does the nearest point within a
 * per-layer tolerance get picked, so clicking a region never grabs a nearby point by accident.
 */

import type { Map as MapLibreMap, PointLike, MapGeoJSONFeature } from "maplibre-gl";

type HitLayerKind = "point" | "label" | "polygon" | "gap";

interface HitResult {
  layerId: string;
  featureId: string | undefined;
  kind: HitLayerKind;
  /** Pixel distance from the cursor to the feature's anchor (points/labels), or 0 for containment. */
  distance: number;
  feature: MapGeoJSONFeature;
}

interface HitTestOptions {
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

interface HitTestResult {
  /** Best selectable hit (never on an excluded layer), or null. */
  hit: HitResult | null;
  /** True when the cursor is over an excluded (locked) layer feature. */
  locked: boolean;
}

const POINT_LAYERS = [
  "editor-points-capital",
  "editor-points-city",
  "editor-points-poi",
  "editor-points-peak",
  "editor-points-story-pin",
  "editor-points-map-label",
];

const LABEL_LAYERS = ["editor-points-labels", "editor-map-labels"];

// Line features (named rivers) sit above region fills, so list them first.
const POLYGON_LAYERS = ["editor-lines", "editor-subdivisions-fill"];

const GAP_LAYERS = ["editor-gaps-fill"];

const POINT_PRIORITY: Record<string, number> = {
  "editor-points-capital": 0,
  "editor-points-city": 1,
  "editor-points-poi": 2,
  "editor-points-peak": 2,
  "editor-points-story-pin": 3,
  "editor-points-map-label": 4,
  "editor-points-labels": 5,
  "editor-map-labels": 6,
};

function layerKind(layerId: string): HitLayerKind {
  if (layerId.startsWith("editor-points-")) return "point";
  if (layerId === "editor-map-labels") return "label";
  if (layerId === "editor-subdivisions-fill" || layerId === "editor-lines") return "polygon";
  if (layerId === "editor-gaps-fill") return "gap";
  return "point";
}

function getAnchorCoords(feature: MapGeoJSONFeature): [number, number] | null {
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
  feature: MapGeoJSONFeature
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

const compareHits = (a: HitResult, b: HitResult) =>
  a.distance - b.distance || (POINT_PRIORITY[a.layerId] ?? 99) - (POINT_PRIORITY[b.layerId] ?? 99);

const isPointOrLabel = (hit: HitResult) => hit.kind === "point" || hit.kind === "label";

export function hitTestFeatures(
  map: MapLibreMap,
  point: PointLike,
  opts: HitTestOptions = {}
): HitTestResult {
  const {
    pointTolerance = 8,
    labelTolerance = 6,
    polygonTolerance = 2,
    gapTolerance = 2,
    excludeLayers = [],
  } = opts;

  const restrict = opts.layers ? new Set(opts.layers) : null;
  const include = (id: string) => !restrict || restrict.has(id);
  const selectable = (id: string) => !excludeLayers.includes(id);

  const pointLayers = POINT_LAYERS.filter(include);
  const labelLayers = LABEL_LAYERS.filter(include);
  const allLayers = [
    ...pointLayers,
    ...labelLayers,
    ...POLYGON_LAYERS.filter(include),
    ...GAP_LAYERS.filter(include),
  ];
  if (allLayers.length === 0) return { hit: null, locked: false };

  const p = Array.isArray(point) ? { x: point[0], y: point[1] } : point;

  const toHit = (feature: MapGeoJSONFeature, layerId: string, kind: HitLayerKind): HitResult => ({
    layerId,
    featureId: feature.properties?.id as string | undefined,
    kind,
    distance: kind === "point" || kind === "label" ? pixelDistance(map, p, feature) : 0,
    feature,
  });

  // Exact query: what is rendered under the cursor. Polygon/gap layers get a small bbox so a
  // near-edge cursor still resolves the fill; points and labels rely on grab-assist below.
  const polyQuery =
    polygonTolerance > 0 || gapTolerance > 0
      ? makeBbox(p, Math.max(polygonTolerance, gapTolerance))
      : point;
  const exactHits = map
    .queryRenderedFeatures(polyQuery, { layers: allLayers })
    .map((f) => toHit(f, f.layer.id, layerKind(f.layer.id)));
  const locked = exactHits.some((h) => !selectable(h.layerId));

  const exactPoints = exactHits.filter(isPointOrLabel).sort(compareHits);
  // Thin lines win over the region fill they cross (render order would put the fill first).
  const exactPolys = exactHits
    .filter((h) => !isPointOrLabel(h))
    .sort((a, b) => POLYGON_LAYERS.indexOf(a.layerId) - POLYGON_LAYERS.indexOf(b.layerId));
  const exact = [...exactPoints, ...exactPolys].find((h) => selectable(h.layerId));
  if (exact) return { hit: exact, locked };

  // Grab-assist: nearest point within tolerance (empty space only).
  const grabHits = (layerIds: string[], kind: HitLayerKind, tolerance: number) =>
    layerIds
      .filter(selectable)
      .flatMap((layerId) =>
        map
          .queryRenderedFeatures(makeBbox(p, tolerance), { layers: [layerId] })
          .map((f) => toHit(f, layerId, kind))
      );
  const best = [
    ...grabHits(pointLayers, "point", pointTolerance),
    ...grabHits(labelLayers, "label", labelTolerance),
  ].sort(compareHits)[0];

  return { hit: best ?? null, locked };
}
