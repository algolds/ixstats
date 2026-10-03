import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import type { IxWorldMapRef } from "../IxWorldMap";
import {
  MEASURE_SOURCE_ID,
  addMeasureLayers,
  bindMeasureInteractions,
  buildMeasureFeatures,
  measureTotalKm,
  removeMeasureLayers,
} from "../utils/measure-helpers";

type Coord = [number, number];

interface UseMeasureToolStateOptions {
  mapRef: React.RefObject<IxWorldMapRef | null>;
  onActiveChange?: (active: boolean) => void;
}

export function useMeasureToolState({ mapRef, onActiveChange }: UseMeasureToolStateOptions) {
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState<Coord[]>([]);
  const totalDistance = useMemo(() => measureTotalKm(points), [points]);
  const draggingIndexRef = useRef<number | null>(null);
  const pointsRef = useRef<Coord[]>([]);
  const activeRef = useRef(false);

  // oxlint-disable-next-line
  pointsRef.current = points;
  // oxlint-disable-next-line
  activeRef.current = active;

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  const updateMapLayers = useCallback(
    (pts: Coord[]) => {
      const source = mapRef.current?.getMap()?.getSource(MEASURE_SOURCE_ID) as
        GeoJSONSource | undefined;
      source?.setData({ type: "FeatureCollection", features: buildMeasureFeatures(pts) });
    },
    [mapRef]
  );

  const clearPoints = useCallback(() => {
    setPoints([]);
    pointsRef.current = [];
    draggingIndexRef.current = null;
    updateMapLayers([]);
  }, [updateMapLayers]);

  const removeLayers = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map?.getStyle()) removeMeasureLayers(map);
  }, [mapRef]);

  const deactivate = useCallback(() => {
    clearPoints();
    removeLayers();
    setActive(false);
  }, [clearPoints, removeLayers]);

  // Set up map sources/layers when activated
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (active) addMeasureLayers(map);

    return () => {
      if (map.getStyle() && !active) removeLayers();
    };
  }, [active, mapRef, removeLayers]);

  // Click + drag handlers
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !active) return;

    // Dragging a vertex fires mousemove/touchmove faster than the screen refreshes; apply the
    // latest points once per animation frame (one state update + one setData) instead of per event.
    let frame = 0;
    const flush = () => {
      frame = 0;
      setPoints(pointsRef.current);
      updateMapLayers(pointsRef.current);
    };
    const applyUpdate = (pts: Coord[]) => {
      pointsRef.current = pts;
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const unbind = bindMeasureInteractions(map, { pointsRef, draggingIndexRef, applyUpdate });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      unbind();
    };
  }, [active, mapRef, updateMapLayers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Leave browser/OS shortcuts (Ctrl/Cmd+M minimises on macOS) alone.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        if (activeRef.current) deactivate();
        else setActive(true);
      }

      if (e.key === "Escape" && activeRef.current) {
        e.preventDefault();
        // First Esc clears the points; a second one (nothing left to clear) deactivates.
        if (pointsRef.current.length > 0) clearPoints();
        else deactivate();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deactivate, clearPoints]);

  const handleToggle = useCallback(() => {
    if (active) deactivate();
    else setActive(true);
  }, [active, deactivate]);

  return { active, points, totalDistance, clearPoints, handleToggle };
}
