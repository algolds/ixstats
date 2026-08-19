import { useState, useEffect, useCallback, useRef } from "react";
import type { IxWorldMapRef } from "../IxWorldMap";
import { distanceKm as haversineKm } from "~/lib/maps/geo-math";
import {
  sphericalMidpoint,
  segmentCount,
  interpolateGreatCircle,
  buildMeasureLineGeometry,
  formatDistance,
  MEASURE_CURSOR,
} from "../utils/measure-helpers";

const SOURCE_ID = "measure-source";
const LINE_LAYER_ID = "measure-line";
const POINT_LAYER_ID = "measure-points";
const LABEL_LAYER_ID = "measure-labels";

export interface UseMeasureToolStateOptions {
  mapRef: React.RefObject<IxWorldMapRef | null>;
  onActiveChange?: (active: boolean) => void;
}

export function useMeasureToolState({ mapRef, onActiveChange }: UseMeasureToolStateOptions) {
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
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              10,
              6,
              7,
            ] as unknown as number,
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

  return {
    active,
    points,
    totalDistance,
    clearPoints,
    handleToggle,
  };
}
