import { useRef, useEffect, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Position } from "geojson";
import type { EditorMode } from "~/hooks/useMapEditor";
import {
  getGeoJSONSource,
  updateSnapGuide,
  // eslint-disable-next-line unused-imports/no-unused-imports
  haversineDistance,
  getFeatureCoords,
  EMPTY_FC,
} from "../utils/map-helpers";

interface UseRouteEditProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  mode: EditorMode;
  routeWaypoints?: [number, number][];
  editingRouteId: string | null;
  editingRouteVertices?: [number, number][];
  onRouteVerticesUpdate?: (vertices: [number, number][]) => void;
  onRouteEditCommit?: () => void;
  onRouteEditCancel?: () => void;
}

export function useRouteEdit({
  map,
  isLoaded,
  mode,
  routeWaypoints,
  editingRouteId,
  editingRouteVertices,
  onRouteVerticesUpdate,
  onRouteEditCommit,
  onRouteEditCancel,
}: UseRouteEditProps) {
  const routeDraggingRef = useRef<number | null>(null);
  const lastMousePointRef = useRef<{ x: number; y: number } | null>(null);

  // Keep latest refs of parameters to avoid stale closure in event callbacks
  const routeWaypointsRef = useRef(routeWaypoints);
  routeWaypointsRef.current = routeWaypoints;
  const editingRouteVerticesRef = useRef(editingRouteVertices);
  editingRouteVerticesRef.current = editingRouteVertices;
  const onRouteVerticesUpdateRef = useRef(onRouteVerticesUpdate);
  onRouteVerticesUpdateRef.current = onRouteVerticesUpdate;

  const updateRouteEditVis = useCallback(() => {
    const vertices = editingRouteVerticesRef.current;
    if (!map || !vertices || vertices.length === 0) return;

    const lineFc = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: vertices,
          },
          properties: {},
        },
      ],
    };
    getGeoJSONSource(map, "editor-route-edit-line")?.setData(lineFc);

    const vertFc = {
      type: "FeatureCollection" as const,
      features: vertices.map((coord, idx) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: coord },
        properties: { vertexIndex: idx },
      })),
    };
    getGeoJSONSource(map, "editor-route-edit-vertices")?.setData(vertFc);

    const midFeatures: any[] = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      const a = vertices[i]!;
      const b = vertices[i + 1]!;
      midFeatures.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        },
        properties: { startIndex: i },
      });
    }
    getGeoJSONSource(map, "editor-route-edit-midpoints")?.setData({
      type: "FeatureCollection",
      features: midFeatures,
    });
  }, [map]);

  const clearRouteEditVis = useCallback(() => {
    if (!map) return;
    getGeoJSONSource(map, "editor-route-edit-line")?.setData(EMPTY_FC);
    getGeoJSONSource(map, "editor-route-edit-vertices")?.setData(EMPTY_FC);
    getGeoJSONSource(map, "editor-route-edit-midpoints")?.setData(EMPTY_FC);
  }, [map]);

  useEffect(() => {
    updateRouteEditVis();
  }, [editingRouteVertices, updateRouteEditVis]);

  useEffect(() => {
    if (mode !== "edit-route") {
      clearRouteEditVis();
    }
  }, [mode, clearRouteEditVis]);

  // Clear snap preview when leaving add-route mode
  useEffect(() => {
    if (mode !== "add-route") {
      if (map && isLoaded) {
        getGeoJSONSource(map, "editor-route-snap-preview")?.setData(EMPTY_FC);
        getGeoJSONSource(map, "editor-route-preview-segment")?.setData(EMPTY_FC);
      }
    }
  }, [map, isLoaded, mode]);

  // Handle route drag and mouse interactions
  useEffect(() => {
    if (!map || !isLoaded) return;

    const canvas = map.getCanvas();

    const onRouteVertexMouseDown = (e: any) => {
      if (mode !== "edit-route") return;
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;

      const idx = f.properties.vertexIndex as number;
      routeDraggingRef.current = idx;
      map.dragPan.disable();
      map.getCanvas().style.cursor = "grabbing";
    };

    const onRouteMidpointClick = (e: any) => {
      if (mode !== "edit-route") return;
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;

      const startIndex = f.properties.startIndex as number;
      const midCoord = getFeatureCoords(f.geometry) as [number, number];

      const vertices = editingRouteVerticesRef.current;
      if (onRouteVerticesUpdateRef.current && vertices) {
        const nextVertices = [...vertices];
        nextVertices.splice(startIndex + 1, 0, midCoord);
        onRouteVerticesUpdateRef.current(nextVertices);
      }
    };

    const onRouteMouseMove = (e: any) => {
      lastMousePointRef.current = { x: e.point.x, y: e.point.y };

      if (mode !== "edit-route" || routeDraggingRef.current === null) return;
      const idx = routeDraggingRef.current;
      const lngLat = e.lngLat;
      let target: [number, number] = [lngLat.lng, lngLat.lat];

      const snapLayers = ["editor-points-capital", "editor-points-city", "editor-points-poi"];
      const bbox: [[number, number], [number, number]] = [
        [e.point.x - 15, e.point.y - 15],
        [e.point.x + 15, e.point.y + 15],
      ];
      const hits = map.queryRenderedFeatures(bbox, { layers: snapLayers });
      if (hits.length > 0) {
        const coords = getFeatureCoords(hits[0]!.geometry);
        if (coords) {
          target = [coords[0], coords[1]];
        }
      }

      const origTarget: Position = [lngLat.lng, lngLat.lat];
      const didSnap = target[0] !== origTarget[0] || target[1] !== origTarget[1];
      updateSnapGuide(map, didSnap ? origTarget : null, didSnap ? target : null);

      const vertices = editingRouteVerticesRef.current;
      if (onRouteVerticesUpdateRef.current && vertices) {
        const nextVertices = [...vertices];
        nextVertices[idx] = target;
        onRouteVerticesUpdateRef.current(nextVertices);
      }
    };

    const onRouteMouseUp = () => {
      if (routeDraggingRef.current === null) return;
      routeDraggingRef.current = null;
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      updateSnapGuide(map, null, null);
    };

    const onRouteContextMenu = (e: any) => {
      if (mode !== "edit-route") return;
      const bbox: [[number, number], [number, number]] = [
        [e.point.x - 10, e.point.y - 10],
        [e.point.x + 10, e.point.y + 10],
      ];
      const hits = map.queryRenderedFeatures(bbox, {
        layers: ["editor-route-edit-vertices-layer"],
      });
      if (hits.length === 0) return;

      e.preventDefault();
      if (e.originalEvent) e.originalEvent.preventDefault();
      const idx = hits[0]!.properties.vertexIndex as number;

      const vertices = editingRouteVerticesRef.current;
      if (vertices && vertices.length > 2) {
        const nextVertices = [...vertices];
        nextVertices.splice(idx, 1);
        if (onRouteVerticesUpdateRef.current) {
          onRouteVerticesUpdateRef.current(nextVertices);
        }
      }
    };

    const onRouteVertexEnter = () => {
      if (mode === "edit-route" && routeDraggingRef.current === null) {
        map.getCanvas().style.cursor = "grab";
      }
    };

    const onRouteVertexLeave = () => {
      if (mode === "edit-route" && routeDraggingRef.current === null) {
        map.getCanvas().style.cursor = "";
      }
    };

    const onRouteMidpointEnter = () => {
      if (mode === "edit-route") {
        map.getCanvas().style.cursor = "copy";
      }
    };

    const onRouteMidpointLeave = () => {
      if (mode === "edit-route" && routeDraggingRef.current === null) {
        map.getCanvas().style.cursor = "";
      }
    };

    const onRouteCanvasContextMenu = (ev: MouseEvent) => {
      if (mode !== "edit-route") return;
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const bbox: [[number, number], [number, number]] = [
        [x - 12, y - 12],
        [x + 12, y + 12],
      ];
      const hits = map.queryRenderedFeatures(bbox, {
        layers: ["editor-route-edit-vertices-layer"],
      });
      if (hits.length === 0) return;

      ev.preventDefault();
      ev.stopPropagation();
      const idx = hits[0]!.properties.vertexIndex as number;

      const vertices = editingRouteVerticesRef.current;
      if (vertices && vertices.length > 2) {
        const nextVertices = [...vertices];
        nextVertices.splice(idx, 1);
        if (onRouteVerticesUpdateRef.current) {
          onRouteVerticesUpdateRef.current(nextVertices);
        }
      }
    };

    // Touch support for routes
    let routeLongPressTimer: ReturnType<typeof setTimeout> | null = null;
    let routeTouchStartPoint: { x: number; y: number } | null = null;

    const onRouteTouchStart = (e: TouchEvent) => {
      if (mode !== "edit-route") return;
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      routeTouchStartPoint = { x, y };

      const bbox: [[number, number], [number, number]] = [
        [x - 20, y - 20],
        [x + 20, y + 20],
      ];
      const hits = map.queryRenderedFeatures(bbox, {
        layers: ["editor-route-edit-vertices-layer"],
      });

      if (hits.length > 0) {
        const idx = hits[0]!.properties.vertexIndex as number;
        routeDraggingRef.current = idx;
        map.dragPan.disable();

        routeLongPressTimer = setTimeout(() => {
          if (mode !== "edit-route") return;
          routeDraggingRef.current = null;
          map.dragPan.enable();
          const vertices = editingRouteVerticesRef.current;
          if (vertices && vertices.length > 2) {
            const nextVertices = [...vertices];
            nextVertices.splice(idx, 1);
            if (onRouteVerticesUpdateRef.current) {
              onRouteVerticesUpdateRef.current(nextVertices);
            }
          }
        }, 500);
      }
    };

    const onRouteTouchMove = (e: TouchEvent) => {
      if (routeDraggingRef.current === null || mode !== "edit-route") return;
      const touch = e.touches[0];
      if (!touch) return;

      if (routeLongPressTimer && routeTouchStartPoint) {
        const rect = canvas.getBoundingClientRect();
        const dx = touch.clientX - rect.left - routeTouchStartPoint.x;
        const dy = touch.clientY - rect.top - routeTouchStartPoint.y;
        if (Math.sqrt(dx * dx + dy * dy) > 8) {
          clearTimeout(routeLongPressTimer);
          routeLongPressTimer = null;
        }
      }

      const lngLat = map.unproject([
        touch.clientX - canvas.getBoundingClientRect().left,
        touch.clientY - canvas.getBoundingClientRect().top,
      ]);
      let target: [number, number] = [lngLat.lng, lngLat.lat];

      const snapLayers = ["editor-points-capital", "editor-points-city", "editor-points-poi"];
      const bbox: [[number, number], [number, number]] = [
        [
          touch.clientX - canvas.getBoundingClientRect().left - 15,
          touch.clientY - canvas.getBoundingClientRect().top - 15,
        ],
        [
          touch.clientX - canvas.getBoundingClientRect().left + 15,
          touch.clientY - canvas.getBoundingClientRect().top + 15,
        ],
      ];
      const hits = map.queryRenderedFeatures(bbox, { layers: snapLayers });
      if (hits.length > 0) {
        const coords = getFeatureCoords(hits[0]!.geometry);
        if (coords) {
          target = [coords[0], coords[1]];
        }
      }

      const vertices = editingRouteVerticesRef.current;
      if (onRouteVerticesUpdateRef.current && vertices) {
        const nextVertices = [...vertices];
        nextVertices[routeDraggingRef.current] = target;
        onRouteVerticesUpdateRef.current(nextVertices);
      }
      e.preventDefault();
    };

    const onRouteTouchEnd = () => {
      if (routeLongPressTimer) {
        clearTimeout(routeLongPressTimer);
        routeLongPressTimer = null;
      }
      routeTouchStartPoint = null;
      if (routeDraggingRef.current !== null) {
        routeDraggingRef.current = null;
        map.dragPan.enable();
      }
    };

    map.on("mousedown", "editor-route-edit-vertices-layer", onRouteVertexMouseDown);
    map.on("click", "editor-route-edit-midpoints-layer", onRouteMidpointClick);
    map.on("mousemove", onRouteMouseMove);
    map.on("mouseup", onRouteMouseUp);
    map.on("contextmenu", onRouteContextMenu);
    canvas.addEventListener("contextmenu", onRouteCanvasContextMenu);
    map.on("mouseenter", "editor-route-edit-vertices-layer", onRouteVertexEnter);
    map.on("mouseleave", "editor-route-edit-vertices-layer", onRouteVertexLeave);
    map.on("mouseenter", "editor-route-edit-midpoints-layer", onRouteMidpointEnter);
    map.on("mouseleave", "editor-route-edit-midpoints-layer", onRouteMidpointLeave);

    canvas.addEventListener("touchstart", onRouteTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onRouteTouchMove, { passive: false });
    canvas.addEventListener("touchend", onRouteTouchEnd);

    return () => {
      if (routeLongPressTimer) clearTimeout(routeLongPressTimer);
      map.off("mousedown", "editor-route-edit-vertices-layer", onRouteVertexMouseDown);
      map.off("click", "editor-route-edit-midpoints-layer", onRouteMidpointClick);
      map.off("mousemove", onRouteMouseMove);
      map.off("mouseup", onRouteMouseUp);
      map.off("contextmenu", onRouteContextMenu);
      canvas.removeEventListener("contextmenu", onRouteCanvasContextMenu);
      map.off("mouseenter", "editor-route-edit-vertices-layer", onRouteVertexEnter);
      map.off("mouseleave", "editor-route-edit-vertices-layer", onRouteVertexLeave);
      map.off("mouseenter", "editor-route-edit-midpoints-layer", onRouteMidpointEnter);
      map.off("mouseleave", "editor-route-edit-midpoints-layer", onRouteMidpointLeave);
      canvas.removeEventListener("touchstart", onRouteTouchStart);
      canvas.removeEventListener("touchmove", onRouteTouchMove);
      canvas.removeEventListener("touchend", onRouteTouchEnd);
    };
  }, [map, isLoaded, mode]);
}
