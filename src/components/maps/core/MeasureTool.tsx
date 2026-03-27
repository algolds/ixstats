"use client";

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { Trash2 } from "lucide-react";
import type { IxWorldMapRef } from "./IxWorldMap";

export interface MeasureToolRef {
  toggle: () => void;
}

interface MeasureToolProps {
  mapRef: React.RefObject<IxWorldMapRef | null>;
  onActiveChange?: (active: boolean) => void;
  /** When true, hides the inline button (button rendered elsewhere via ref.toggle) */
  headless?: boolean;
}

const SOURCE_ID = "measure-source";
const LINE_LAYER_ID = "measure-line";
const POINT_LAYER_ID = "measure-points";
const LABEL_LAYER_ID = "measure-labels";

/** Custom SVG cursor: blue crosshair with center dot */
const MEASURE_CURSOR = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><line x1="12" y1="2" x2="12" y2="9" stroke="%233b82f6" stroke-width="2"/><line x1="12" y1="15" x2="12" y2="22" stroke="%233b82f6" stroke-width="2"/><line x1="2" y1="12" x2="9" y2="12" stroke="%233b82f6" stroke-width="2"/><line x1="15" y1="12" x2="22" y2="12" stroke="%233b82f6" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="%233b82f6"/></svg>`;
  return `url("data:image/svg+xml,${svg}") 12 12, crosshair`;
})();

// ─── Geo math (unified, IxEarth-scaled) ─────────────────────────
import { distanceKm as haversineKm } from "~/lib/geo-math";

const DEG2RAD = Math.PI / 180;

/** Spherical midpoint — correct even across the antimeridian */
function sphericalMidpoint(
  a: [number, number],
  b: [number, number]
): [number, number] {
  const lat1 = a[1] * DEG2RAD, lng1 = a[0] * DEG2RAD;
  const lat2 = b[1] * DEG2RAD, lng2 = b[0] * DEG2RAD;
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

  const lat1 = a[1] * DEG2RAD, lng1 = a[0] * DEG2RAD;
  const lat2 = b[1] * DEG2RAD, lng2 = b[0] * DEG2RAD;

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
function buildMeasureLineGeometry(
  points: [number, number][]
): LineGeometry {
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

// ─── Formatting ──────────────────────────────────────────────────

function formatDistance(km: number): string {
  const mi = km * 0.621371;
  if (km < 1)
    return `${Math.round(km * 1000)} m (${Math.round(mi * 5280)} ft)`;
  return `${km.toFixed(1)} km (${mi.toFixed(1)} mi)`;
}

// ─── Component ───────────────────────────────────────────────────

export const MeasureTool = forwardRef<MeasureToolRef, MeasureToolProps>(function MeasureTool({ mapRef, onActiveChange, headless = false }, ref) {
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const draggingIndexRef = useRef<number | null>(null);
  const pointsRef = useRef<[number, number][]>([]);
  const activeRef = useRef(false);

  pointsRef.current = points;
  activeRef.current = active;

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  const computeDistances = useCallback((pts: [number, number][]) => {
    let total = 0;
    const segments: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      const d = haversineKm(pts[i - 1]!, pts[i]!);
      segments.push(d);
      total += d;
    }
    return { segments, total };
  }, []);

  const updateMapLayers = useCallback(
    (pts: [number, number][]) => {
      const map = mapRef.current?.getMap();
      if (!map) return;
      const source = map.getSource(SOURCE_ID) as any;
      if (!source) return;

      const { segments } = computeDistances(pts);
      const features: any[] = [];

      // Build great-circle interpolated line with antimeridian handling
      if (pts.length >= 2) {
        const allInterpolated: [number, number][] = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
          const n = segmentCount(pts[i - 1]!, pts[i]!);
          const segPts = interpolateGreatCircle(pts[i - 1]!, pts[i]!, n);
          for (let j = 1; j < segPts.length; j++) {
            allInterpolated.push(segPts[j]);
          }
        }

        features.push({
          type: "Feature",
          properties: { kind: "line" },
          geometry: buildMeasureLineGeometry(allInterpolated),
        });
      }

      pts.forEach((pt, i) => {
        features.push({
          type: "Feature",
          properties: { kind: "point", idx: i },
          geometry: { type: "Point", coordinates: pt },
        });
      });

      for (let i = 1; i < pts.length; i++) {
        const mid = sphericalMidpoint(pts[i - 1]!, pts[i]!);
        features.push({
          type: "Feature",
          properties: { kind: "label", text: formatDistance(segments[i - 1]!) },
          geometry: { type: "Point", coordinates: mid },
        });
      }

      source.setData({ type: "FeatureCollection", features });
    },
    [mapRef, computeDistances]
  );

  // ─── Cleanup helpers ─────────────────────────────────────────
  const clearPoints = useCallback(() => {
    setPoints([]);
    pointsRef.current = [];
    setTotalDistance(0);
    draggingIndexRef.current = null;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as any;
    if (source) source.setData({ type: "FeatureCollection", features: [] });
  }, [mapRef]);

  const removeLayers = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getStyle()) return;
    [LABEL_LAYER_ID, POINT_LAYER_ID, LINE_LAYER_ID].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    map.getCanvas().style.cursor = "";
  }, [mapRef]);

  const deactivate = useCallback(() => {
    clearPoints();
    removeLayers();
    setActive(false);
  }, [clearPoints, removeLayers]);

  // ─── Set up map sources/layers when activated ─────────────────
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (active) {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      if (!map.getLayer(LINE_LAYER_ID)) {
        map.addLayer({
          id: LINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          filter: ["==", ["get", "kind"], "line"],
          paint: {
            "line-color": "#3b82f6",
            "line-width": 2.5,
            "line-dasharray": [3, 2],
          },
        });
      }

      if (!map.getLayer(POINT_LAYER_ID)) {
        map.addLayer({
          id: POINT_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: ["==", ["get", "kind"], "point"],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 10, 6, 7] as unknown as number,
            "circle-color": "#3b82f6",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
      }

      if (!map.getLayer(LABEL_LAYER_ID)) {
        map.addLayer({
          id: LABEL_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["==", ["get", "kind"], "label"],
          layout: {
            "text-field": ["get", "text"],
            "text-size": 12,
            "text-offset": [0, -1.2],
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": "#1e40af",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          },
        });
      }

      map.getCanvas().style.cursor = MEASURE_CURSOR;
    }

    return () => {
      if (!map || !map.getStyle()) return;
      if (!active) {
        removeLayers();
      }
    };
  }, [active, mapRef, removeLayers]);

  // ─── Click + drag handlers ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !active) return;

    const canvas = map.getCanvas();

    const hitTestPoint = (e: any): number | null => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [POINT_LAYER_ID],
      });
      if (features.length > 0) {
        const idx = features[0].properties?.idx;
        return typeof idx === "number" ? idx : null;
      }
      return null;
    };

    const applyUpdate = (pts: [number, number][]) => {
      pointsRef.current = pts;
      setPoints(pts);
      const { total } = computeDistances(pts);
      setTotalDistance(total);
      requestAnimationFrame(() => updateMapLayers(pts));
    };

    const onClick = (e: any) => {
      if (draggingIndexRef.current !== null) return;
      if (hitTestPoint(e) !== null) return;
      const { lng, lat } = e.lngLat;
      applyUpdate([...pointsRef.current, [lng, lat]]);
    };

    const onMouseDown = (e: any) => {
      const idx = hitTestPoint(e);
      if (idx === null) return;
      e.preventDefault();
      draggingIndexRef.current = idx;
      map.dragPan.disable();
      canvas.style.cursor = "grabbing";
    };

    const onMouseMove = (e: any) => {
      if (draggingIndexRef.current === null) {
        const hit = hitTestPoint(e);
        canvas.style.cursor = hit !== null ? "grab" : MEASURE_CURSOR;
        return;
      }
      const idx = draggingIndexRef.current;
      const { lng, lat } = e.lngLat;
      const next = [...pointsRef.current];
      next[idx] = [lng, lat];
      applyUpdate(next);
    };

    const onMouseUp = () => {
      if (draggingIndexRef.current === null) return;
      draggingIndexRef.current = null;
      map.dragPan.enable();
      canvas.style.cursor = MEASURE_CURSOR;
    };

    // Touch equivalents for point dragging on mobile
    const onTouchStart = (e: any) => {
      if (e.points?.length !== 1) return;
      const idx = hitTestPoint(e);
      if (idx === null) return;
      e.preventDefault();
      draggingIndexRef.current = idx;
      map.dragPan.disable();
    };

    const onTouchMove = (e: any) => {
      if (draggingIndexRef.current === null) return;
      const { lng, lat } = e.lngLat;
      const next = [...pointsRef.current];
      next[draggingIndexRef.current] = [lng, lat];
      applyUpdate(next);
    };

    const onTouchEnd = () => {
      if (draggingIndexRef.current === null) return;
      draggingIndexRef.current = null;
      map.dragPan.enable();
    };

    map.on("click", onClick);
    map.on("mousedown", POINT_LAYER_ID, onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    map.on("touchstart", POINT_LAYER_ID, onTouchStart);
    map.on("touchmove", onTouchMove);
    map.on("touchend", onTouchEnd);

    return () => {
      map.off("click", onClick);
      map.off("mousedown", POINT_LAYER_ID, onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      map.off("touchstart", POINT_LAYER_ID, onTouchStart);
      map.off("touchmove", onTouchMove);
      map.off("touchend", onTouchEnd);
      map.dragPan.enable();
    };
  }, [active, mapRef, updateMapLayers, computeDistances]);

  // ─── Keyboard shortcuts ───────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        if (activeRef.current) {
          deactivate();
        } else {
          setActive(true);
        }
      }

      if (e.key === "Escape" && activeRef.current) {
        e.preventDefault();
        if (pointsRef.current.length > 0) {
          // First Esc: clear points
          clearPoints();
        } else {
          // Second Esc (no points): deactivate
          deactivate();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deactivate, clearPoints]);

  const handleToggle = useCallback(() => {
    if (active) {
      deactivate();
    } else {
      setActive(true);
    }
  }, [active, deactivate]);

  // Expose toggle via ref for external control (headless mode)
  useImperativeHandle(ref, () => ({ toggle: handleToggle }), [handleToggle]);

  return (
    <>
      {/* Inline measure button — hidden in headless mode (button rendered by MapControls) */}
      {!headless && (
        <button
          onClick={handleToggle}
          className={`flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-md transition-colors sm:min-h-0 sm:min-w-0 ${
            active
              ? "bg-blue-500 text-white"
              : "bg-card text-foreground hover:bg-accent"
          }`}
          title="Measure distance (M)"
        >
          <Trash2 className="h-4 w-4" />
          Measure
        </button>
      )}

      {/* Distance readout (fixed to map, below toolbar) */}
      {active && points.length >= 2 && (
        <div className="fixed left-6 top-36 z-30 flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm shadow-lg ring-1 ring-border sm:absolute sm:left-3 sm:top-14">
          <span className="font-semibold text-foreground">
            {formatDistance(totalDistance)}
          </span>
          <span className="text-muted-foreground">
            ({points.length} pts)
          </span>
          <button
            onClick={clearPoints}
            className="ml-1 rounded p-0.5 text-muted-foreground hover:text-red-500"
            title="Clear measurement (Esc)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
});
