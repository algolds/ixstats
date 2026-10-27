import type {
  Map as MapLibreMap,
  MapMouseEvent,
  MapTouchEvent,
  LayerSpecification,
} from "maplibre-gl";
import type { Feature } from "geojson";
import { distanceKm as haversineKm } from "~/lib/maps/geo-math";
import {
  EARTH_RADIUS_KM,
  haversineKm as planetHaversineKm,
  sphericalRingAreaSqKm,
} from "~/lib/maps/planet";

const DEG2RAD = Math.PI / 180;

/** Spherical midpoint — correct even across the antimeridian */
function sphericalMidpoint(a: [number, number], b: [number, number]): [number, number] {
  const lat1 = a[1] * DEG2RAD;
  const lng1 = a[0] * DEG2RAD;
  const lat2 = b[1] * DEG2RAD;
  const lng2 = b[0] * DEG2RAD;
  const dLng = lng2 - lng1;
  const bx = Math.cos(lat2) * Math.cos(dLng);
  const by = Math.cos(lat2) * Math.sin(dLng);
  const midLat = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2)
  );
  const midLng = lng1 + Math.atan2(by, Math.cos(lat1) + bx);
  return [midLng / DEG2RAD, midLat / DEG2RAD];
}

/** Adaptive interpolation density based on segment distance */
function segmentCount(a: [number, number], b: [number, number]): number {
  const km = haversineKm(a, b);
  if (km < 100) return 1;
  if (km < 500) return 8;
  if (km < 2000) return 16;
  if (km < 5000) return 32;
  return 64;
}

/** Spherical linear interpolation (SLERP) along the great-circle arc */
function interpolateGreatCircle(
  a: [number, number],
  b: [number, number],
  numSegments: number
): [number, number][] {
  if (numSegments <= 1) return [a, b];

  const lat1 = a[1] * DEG2RAD;
  const lng1 = a[0] * DEG2RAD;
  const lat2 = b[1] * DEG2RAD;
  const lng2 = b[0] * DEG2RAD;

  // 3D unit vectors
  const ax = Math.cos(lat1) * Math.cos(lng1);
  const ay = Math.cos(lat1) * Math.sin(lng1);
  const az = Math.sin(lat1);
  const bx = Math.cos(lat2) * Math.cos(lng2);
  const by = Math.cos(lat2) * Math.sin(lng2);
  const bz = Math.sin(lat2);

  // Angular distance
  const dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz));
  const d = Math.acos(dot);

  // Coincident points
  if (d < 1e-10) return [a, b];

  const sinD = Math.sin(d);
  const points: [number, number][] = [];

  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const A = Math.sin((1 - t) * d) / sinD;
    const B = Math.sin(t * d) / sinD;
    const x = A * ax + B * bx;
    const y = A * ay + B * by;
    const z = A * az + B * bz;
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG2RAD;
    const lng = Math.atan2(y, x) / DEG2RAD;
    points.push([lng, lat]);
  }

  return points;
}

type LineGeometry =
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "MultiLineString"; coordinates: [number, number][][] };

/** Build a LineString/MultiLineString that splits at the antimeridian */
function buildMeasureLineGeometry(points: [number, number][]): LineGeometry {
  if (points.length < 2) {
    return { type: "LineString", coordinates: points };
  }

  const segments: [number, number][][] = [];
  let current: [number, number][] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dLng = curr[0] - prev[0];

    if (Math.abs(dLng) > 180) {
      // Antimeridian crossing — unwrap to find the true interpolated crossing
      const unwrappedLng = dLng > 0 ? curr[0] - 360 : curr[0] + 360;
      const boundaryLng = prev[0] >= 0 ? 180 : -180;
      const t = (boundaryLng - prev[0]) / (unwrappedLng - prev[0]);
      const crossLat = prev[1] + t * (curr[1] - prev[1]);

      current.push([boundaryLng, crossLat]);
      segments.push(current);
      current = [[-boundaryLng, crossLat], curr];
    } else {
      current.push(curr);
    }
  }
  segments.push(current);

  const valid = segments.filter((s) => s.length >= 2);
  if (valid.length === 1) {
    return { type: "LineString", coordinates: valid[0] };
  }
  return { type: "MultiLineString", coordinates: valid };
}

export function formatDistance(km: number): string {
  const mi = km * 0.621371;
  if (km < 1) return `${Math.round(km * 1000)} m (${Math.round(mi * 5280)} ft)`;
  return `${km.toFixed(1)} km (${mi.toFixed(1)} mi)`;
}

const SQ_MI_PER_SQ_KM = 0.386102;
const SQ_FT_PER_SQ_KM = 10_763_910.4;

/** Whole numbers with thousands separators from 100 up, one decimal below. */
const formatAreaNumber = (n: number) =>
  n >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(1);

export function formatArea(sqKm: number): string {
  if (sqKm < 1) {
    const sqM = Math.round(sqKm * 1e6).toLocaleString("en-US");
    return `${sqM} m² (${Math.round(sqKm * SQ_FT_PER_SQ_KM).toLocaleString("en-US")} ft²)`;
  }
  return `${formatAreaNumber(sqKm)} km² (${formatAreaNumber(sqKm * SQ_MI_PER_SQ_KM)} mi²)`;
}

/** Custom SVG cursor: blue crosshair with center dot */
const MEASURE_CURSOR = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><line x1="12" y1="2" x2="12" y2="9" stroke="%233b82f6" stroke-width="2"/><line x1="12" y1="15" x2="12" y2="22" stroke="%233b82f6" stroke-width="2"/><line x1="2" y1="12" x2="9" y2="12" stroke="%233b82f6" stroke-width="2"/><line x1="15" y1="12" x2="22" y2="12" stroke="%233b82f6" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="%233b82f6"/></svg>`;
  return `url("data:image/svg+xml,${svg}") 12 12, crosshair`;
})();

type Coord = [number, number];

/** Lengths (km) of each leg between consecutive points, on a planet of `radiusKm` (the realm's). */
const legLengthsKm = (pts: Coord[], radiusKm: number) =>
  pts.slice(1).map((p, i) => planetHaversineKm(pts[i]!, p, radiusKm));

export const measureTotalKm = (pts: Coord[], radiusKm: number = EARTH_RADIUS_KM) =>
  legLengthsKm(pts, radiusKm).reduce((sum, d) => sum + d, 0);

/** Perimeter (km) of the polygon the points outline, closed back to the first point. */
export const measurePerimeterKm = (pts: Coord[], radiusKm: number = EARTH_RADIUS_KM) =>
  measureTotalKm([...pts, ...pts.slice(0, 1)], radiusKm);

/** Distance measures a path; area measures the polygon the points outline (closed implicitly). */
export type MeasureMode = "distance" | "area";

/** Great-circle path through the points, densified per leg; `closed` adds the leg back to the first. */
function greatCirclePath(pts: Coord[], closed: boolean): Coord[] {
  const ring = closed ? [...pts, pts[0]!] : pts;
  const path: Coord[] = [ring[0]!];
  for (let i = 1; i < ring.length; i++) {
    const leg = interpolateGreatCircle(
      ring[i - 1]!,
      ring[i]!,
      segmentCount(ring[i - 1]!, ring[i]!)
    );
    path.push(...leg.slice(1));
  }
  return path;
}

/** The path with each longitude shifted by whole turns to stay within 180° of the one before. */
function unwrapLongitudes(path: Coord[]): Coord[] {
  const out: Coord[] = [];
  for (const [lng, lat] of path) {
    const prev = out[out.length - 1];
    out.push([prev ? lng + Math.round((prev[0] - lng) / 360) * 360 : lng, lat]);
  }
  return out;
}

/**
 * Fill ring of the polygon: its great-circle outline with continuous longitudes, so a polygon across the
 * antimeridian stays one shape (MapLibre wraps longitudes past ±180°). An outline that winds all the way round in
 * longitude encloses a pole; it is closed along the pole on its side.
 */
function areaFillRing(pts: Coord[]): Coord[] {
  const outline = unwrapLongitudes(greatCirclePath(pts, true));
  const first = outline[0]!;
  const last = outline[outline.length - 1]!;
  if (Math.abs(last[0] - first[0]) < 180) return outline;
  const meanLat = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
  const poleLat = meanLat >= 0 ? 90 : -90;
  return [...outline, [last[0], poleLat], [first[0], poleLat], first];
}

/** Mean direction of the points on the sphere, as `[lng, lat]`. */
function sphericalCentroid(pts: Coord[]): Coord {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lng, lat] of pts) {
    x += Math.cos(lat * DEG2RAD) * Math.cos(lng * DEG2RAD);
    y += Math.cos(lat * DEG2RAD) * Math.sin(lng * DEG2RAD);
    z += Math.sin(lat * DEG2RAD);
  }
  return [Math.atan2(y, x) / DEG2RAD, Math.atan2(z, Math.hypot(x, y)) / DEG2RAD];
}

const labelFeature = (text: string, at: Coord): Feature => ({
  type: "Feature",
  properties: { kind: "label", text },
  geometry: { type: "Point", coordinates: at },
});

/** Distance mode labels each leg with its length; area mode labels the polygon with its area. */
function measureLabels(pts: Coord[], radiusKm: number, mode: MeasureMode): Feature[] {
  if (mode === "distance") {
    return legLengthsKm(pts, radiusKm).map((km, i) =>
      labelFeature(formatDistance(km), sphericalMidpoint(pts[i]!, pts[i + 1]!))
    );
  }
  if (pts.length < 3) return [];
  return [labelFeature(formatArea(sphericalRingAreaSqKm(pts, radiusKm)), sphericalCentroid(pts))];
}

/**
 * Great-circle path (split at the antimeridian), vertex markers and labels, measured on a planet of `radiusKm`
 * (the realm's; Earth's by default). Distance mode labels each leg; area mode closes the path, fills the polygon
 * from three points on and labels its spherical area.
 */
export function buildMeasureFeatures(
  pts: Coord[],
  radiusKm: number = EARTH_RADIUS_KM,
  mode: MeasureMode = "distance"
): Feature[] {
  const polygon = mode === "area" && pts.length >= 3;
  const features: Feature[] = [];

  if (polygon) {
    features.push({
      type: "Feature",
      properties: { kind: "area" },
      geometry: { type: "Polygon", coordinates: [areaFillRing(pts)] },
    });
  }

  if (pts.length >= 2) {
    features.push({
      type: "Feature",
      properties: { kind: "line" },
      geometry: buildMeasureLineGeometry(greatCirclePath(pts, polygon)),
    });
  }

  pts.forEach((pt, idx) => {
    features.push({
      type: "Feature",
      properties: { kind: "point", idx },
      geometry: { type: "Point", coordinates: pt },
    });
  });

  features.push(...measureLabels(pts, radiusKm, mode));
  return features;
}

export const MEASURE_SOURCE_ID = "measure-source";
const MEASURE_POINT_LAYER_ID = "measure-points";

const ofKind = (kind: string) => ["==", ["get", "kind"], kind];

const MEASURE_LAYERS = [
  {
    id: "measure-fill",
    type: "fill",
    filter: ofKind("area"),
    paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 },
  },
  {
    id: "measure-line",
    type: "line",
    filter: ofKind("line"),
    paint: { "line-color": "#3b82f6", "line-width": 2.5, "line-dasharray": [3, 2] },
  },
  {
    id: MEASURE_POINT_LAYER_ID,
    type: "circle",
    filter: ofKind("point"),
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 10, 6, 7],
      "circle-color": "#3b82f6",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  },
  {
    id: "measure-labels",
    type: "symbol",
    filter: ofKind("label"),
    layout: {
      "text-field": ["get", "text"],
      "text-size": 12,
      "text-offset": [0, -1.2],
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#1e40af", "text-halo-color": "#ffffff", "text-halo-width": 2 },
  },
] as unknown as Omit<LayerSpecification, "source">[];

export function addMeasureLayers(map: MapLibreMap) {
  if (!map.getSource(MEASURE_SOURCE_ID)) {
    map.addSource(MEASURE_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  for (const layer of MEASURE_LAYERS) {
    if (!map.getLayer(layer.id)) {
      map.addLayer({ ...layer, source: MEASURE_SOURCE_ID } as LayerSpecification);
    }
  }
  map.getCanvas().style.cursor = MEASURE_CURSOR;
}

export function removeMeasureLayers(map: MapLibreMap) {
  for (const layer of [...MEASURE_LAYERS].reverse()) {
    if (map.getLayer(layer.id)) map.removeLayer(layer.id);
  }
  if (map.getSource(MEASURE_SOURCE_ID)) map.removeSource(MEASURE_SOURCE_ID);
  map.getCanvas().style.cursor = "";
}

interface MeasureInteractionOptions {
  /** Latest points, updated synchronously on every edit. */
  pointsRef: { current: Coord[] };
  /** Index of the vertex being dragged, or null. */
  draggingIndexRef: { current: number | null };
  /** Called with the edited point list; the owner batches state/map updates. */
  applyUpdate: (pts: Coord[]) => void;
}

/** Click-to-add, drag-to-move vertex handlers (mouse and touch). Returns the unbind function. */
export function bindMeasureInteractions(
  map: MapLibreMap,
  { pointsRef, draggingIndexRef, applyUpdate }: MeasureInteractionOptions
) {
  const canvas = map.getCanvas();

  const hitTestPoint = (e: MapMouseEvent | MapTouchEvent): number | null => {
    const idx = map.queryRenderedFeatures(e.point, { layers: [MEASURE_POINT_LAYER_ID] })[0]
      ?.properties?.idx;
    return typeof idx === "number" ? idx : null;
  };

  const startDrag = (e: MapMouseEvent | MapTouchEvent, cursor?: string) => {
    const idx = hitTestPoint(e);
    if (idx === null) return;
    e.preventDefault();
    draggingIndexRef.current = idx;
    map.dragPan.disable();
    if (cursor) canvas.style.cursor = cursor;
  };

  const dragTo = (e: MapMouseEvent | MapTouchEvent) => {
    const idx = draggingIndexRef.current;
    if (idx === null) return;
    const next = [...pointsRef.current];
    next[idx] = [e.lngLat.lng, e.lngLat.lat];
    applyUpdate(next);
  };

  const endDrag = (cursor?: string) => {
    if (draggingIndexRef.current === null) return;
    draggingIndexRef.current = null;
    map.dragPan.enable();
    if (cursor) canvas.style.cursor = cursor;
  };

  const onClick = (e: MapMouseEvent) => {
    if (draggingIndexRef.current !== null || hitTestPoint(e) !== null) return;
    applyUpdate([...pointsRef.current, [e.lngLat.lng, e.lngLat.lat]]);
  };
  const onMouseDown = (e: MapMouseEvent) => startDrag(e, "grabbing");
  const onMouseMove = (e: MapMouseEvent) => {
    if (draggingIndexRef.current === null) {
      canvas.style.cursor = hitTestPoint(e) !== null ? "grab" : MEASURE_CURSOR;
    } else {
      dragTo(e);
    }
  };
  const onMouseUp = () => endDrag(MEASURE_CURSOR);
  const onTouchStart = (e: MapTouchEvent) => {
    if (e.points?.length === 1) startDrag(e);
  };
  const onTouchEnd = () => endDrag();

  map.on("click", onClick);
  map.on("mousedown", MEASURE_POINT_LAYER_ID, onMouseDown);
  map.on("mousemove", onMouseMove);
  map.on("mouseup", onMouseUp);
  map.on("touchstart", MEASURE_POINT_LAYER_ID, onTouchStart);
  map.on("touchmove", dragTo);
  map.on("touchend", onTouchEnd);

  return () => {
    map.off("click", onClick);
    map.off("mousedown", MEASURE_POINT_LAYER_ID, onMouseDown);
    map.off("mousemove", onMouseMove);
    map.off("mouseup", onMouseUp);
    map.off("touchstart", MEASURE_POINT_LAYER_ID, onTouchStart);
    map.off("touchmove", dragTo);
    map.off("touchend", onTouchEnd);
    map.dragPan.enable();
  };
}
