// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Polygon, MultiPolygon, Position } from "geojson";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import {
  getVertices,
  getAllRings,
  moveVertex,
  addVertex,
  removeVertex,
  clampToGeometry,
  simplifyGeometry,
  snapToBorderEdge,
  snapPointToGeometries,
  snapToNeighborBorders,
  sanitizeRegionShape,
} from "~/lib/border-editor";
import type { VertexRef } from "~/lib/border-editor";
import { findNearestBorderRing, snapGeometryToBorder } from "~/lib/province-importer/alignment";
import { clipGeometryToBorder } from "~/lib/province-importer/topology";
import {
  getGeoJSONSource,
  updateSnapGuide,
  calculateOverlapGeoJson,
  EMPTY_FC,
  getFeatureCoords,
  snapToLayerFeatures,
  snapGeometryToBackgroundLayers,
} from "../utils/map-helpers";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { getSnapEnabled, getSnapTolerance } from "~/lib/editor-prefs";

interface UseSubdivisionVertexEditProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  mode: EditorMode;
  selectedFeature: EditorFeature | null;
  features: EditorFeature[];
  countryGeometry: Polygon | MultiPolygon | null;
  onGeometryUpdate?: (featureId: string, geometry: object) => void;
  worldMapLayers?: MapLayerData[];
  editorVisibleLayers?: Set<string>;
  guides?: { id: string; type: "h" | "v"; value: number }[];
  snapEnabled?: boolean;
  snapTolerance?: number;
  snapPoint?: (coords: [number, number]) => [number, number];
}

export function useSubdivisionVertexEdit({
  map,
  isLoaded,
  mode,
  selectedFeature,
  features,
  countryGeometry,
  onGeometryUpdate,
  worldMapLayers,
  editorVisibleLayers,
  guides,
  snapEnabled,
  snapTolerance,
  snapPoint,
}: UseSubdivisionVertexEditProps) {
  const [isVertexEditing, setIsVertexEditing] = useState(false);
  const vertexEditRef = useRef<{
    featureId: string;
    currentGeometry: Polygon | MultiPolygon;
  } | null>(null);

  const draggingRef = useRef<VertexRef | null>(null);
  const hoveredVertexRef = useRef<VertexRef | null>(null);
  const lastMousePointRef = useRef<{ x: number; y: number } | null>(null);

  const throttledUpdateRef = useRef<any>(null);
  const lastUpdateRef = useRef(0);

  // Keep latest refs of parameters to avoid stale closure in event callbacks
  const featuresRef = useRef(features);
  featuresRef.current = features;
  const countryGeometryRef = useRef(countryGeometry);
  countryGeometryRef.current = countryGeometry;
  const onGeometryUpdateRef = useRef(onGeometryUpdate);
  onGeometryUpdateRef.current = onGeometryUpdate;

  const updateVertexEditVis = useCallback(
    (fastOnly = false) => {
      const state = vertexEditRef.current;
      if (!map || !state) return;

      const geo = state.currentGeometry;

      // Polygon fill + stroke
      const polyFc = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            geometry: geo,
            properties: {},
          },
        ],
      };
      getGeoJSONSource(map, "editor-vedit-polygon")?.setData(polyFc);

      // Vertices
      const verts = getVertices(geo);
      const vertFc = {
        type: "FeatureCollection" as const,
        features: verts.map((v) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: v.coord },
          properties: { ringIndex: v.ringIndex, vertexIndex: v.vertexIndex },
        })),
      };
      getGeoJSONSource(map, "editor-vedit-vertices")?.setData(vertFc);

      if (fastOnly) {
        return;
      }

      // Midpoints (for adding new vertices)
      const rings = getAllRings(geo);
      const midFeatures: any[] = [];
      for (let ri = 0; ri < rings.length; ri++) {
        const ring = rings[ri]!;
        const len = ring.length;
        for (let i = 0; i < len - 1; i++) {
          const a = ring[i]!;
          const b = ring[i + 1]!;
          midFeatures.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
            },
            properties: { ringIndex: ri, startIndex: i },
          });
        }
      }
      getGeoJSONSource(map, "editor-vedit-midpoints")?.setData({
        type: "FeatureCollection",
        features: midFeatures,
      });

      // Update overlap highlights
      const overlapGeoJson = calculateOverlapGeoJson(geo, featuresRef.current, state.featureId);
      getGeoJSONSource(map, "editor-overlap-highlight")?.setData(overlapGeoJson);
    },
    [map]
  );

  const scheduleThrottledUpdate = useCallback(() => {
    if (throttledUpdateRef.current) {
      clearTimeout(throttledUpdateRef.current);
    }
    const now = Date.now();
    const timeSinceLast = now - lastUpdateRef.current;
    if (timeSinceLast >= 100) {
      updateVertexEditVis(false);
      lastUpdateRef.current = now;
    } else {
      throttledUpdateRef.current = setTimeout(() => {
        updateVertexEditVis(false);
        lastUpdateRef.current = Date.now();
      }, 100 - timeSinceLast);
    }
  }, [updateVertexEditVis]);

  useEffect(() => {
    return () => {
      if (throttledUpdateRef.current) {
        clearTimeout(throttledUpdateRef.current);
      }
    };
  }, []);

  const clearVertexEditVis = useCallback(() => {
    if (!map) return;
    getGeoJSONSource(map, "editor-vedit-polygon")?.setData(EMPTY_FC);
    getGeoJSONSource(map, "editor-vedit-vertices")?.setData(EMPTY_FC);
    getGeoJSONSource(map, "editor-vedit-midpoints")?.setData(EMPTY_FC);
    getGeoJSONSource(map, "editor-overlap-highlight")?.setData(EMPTY_FC);
  }, [map]);

  const finishVertexEdit = useCallback(() => {
    const state = vertexEditRef.current;
    if (state && onGeometryUpdateRef.current) {
      let finalGeo = state.currentGeometry;
      const border = countryGeometryRef.current;
      if (border) {
        const { geometry } = clipGeometryToBorder(finalGeo, border);
        finalGeo = geometry as Polygon | MultiPolygon;
      }
      onGeometryUpdateRef.current(state.featureId, finalGeo);
    }
    vertexEditRef.current = null;
    setIsVertexEditing(false);
    clearVertexEditVis();

    // Reset subdivision filters
    if (map) {
      for (const lid of [
        "editor-subdivisions-fill",
        "editor-subdivisions-stroke",
        "editor-subdivisions-labels",
        "editor-subdivisions-hover",
      ]) {
        if (map.getLayer(lid)) map.setFilter(lid, null);
      }
    }
  }, [map, clearVertexEditVis]);

  const handleSimplifyAndSave = useCallback(() => {
    const state = vertexEditRef.current;
    const border = countryGeometryRef.current;
    if (!state || !border) return;

    let geo = simplifyGeometry(state.currentGeometry, 0.002);
    const { geometry: sanitized } = sanitizeRegionShape(geo, border);
    geo = sanitized;

    // Snap to visible background layers first
    if (worldMapLayers && editorVisibleLayers) {
      geo = snapGeometryToBackgroundLayers(
        geo as Polygon | MultiPolygon,
        worldMapLayers,
        editorVisibleLayers,
        0.015
      );
    }

    const { geometry: clipped } = clipGeometryToBorder(geo, border);
    geo = clipped as Polygon | MultiPolygon;

    const neighborGeometries: Array<{ id: string; geometry: Polygon | MultiPolygon }> = [];
    for (const feat of featuresRef.current) {
      if (feat.type === "subdivision" && feat.id !== state.featureId && feat.geometry) {
        neighborGeometries.push({
          id: feat.id,
          geometry: feat.geometry as Polygon | MultiPolygon,
        });
      }
    }
    if (neighborGeometries.length > 0) {
      geo = snapToNeighborBorders(geo, neighborGeometries, border, 0.015);
    }

    const nearestRing = findNearestBorderRing(geo, border);
    const borderEdges: Array<[Position, Position]> = [];
    for (let i = 0; i < nearestRing.length - 1; i++) {
      borderEdges.push([nearestRing[i]!, nearestRing[i + 1]!]);
    }

    const snapped = snapGeometryToBorder(geo, borderEdges, nearestRing, 0.015);
    state.currentGeometry = snapped as Polygon | MultiPolygon;
    updateVertexEditVis();

    if (onGeometryUpdateRef.current) {
      onGeometryUpdateRef.current(state.featureId, state.currentGeometry);
    }
  }, [updateVertexEditVis, worldMapLayers, editorVisibleLayers]);

  const handleSave = useCallback(() => {
    const state = vertexEditRef.current;
    if (!state || !onGeometryUpdateRef.current) return;
    let finalGeo = state.currentGeometry;
    const border = countryGeometryRef.current;
    if (border) {
      const { geometry } = clipGeometryToBorder(finalGeo, border);
      finalGeo = geometry as Polygon | MultiPolygon;

      const neighborGeometries: Array<{ id: string; geometry: Polygon | MultiPolygon }> = [];
      for (const feat of featuresRef.current) {
        if (feat.type === "subdivision" && feat.id !== state.featureId && feat.geometry) {
          neighborGeometries.push({
            id: feat.id,
            geometry: feat.geometry as Polygon | MultiPolygon,
          });
        }
      }
      if (neighborGeometries.length > 0) {
        finalGeo = snapToNeighborBorders(finalGeo, neighborGeometries, border, 0.015);
      }

      state.currentGeometry = finalGeo as Polygon | MultiPolygon;
      updateVertexEditVis();
    }
    onGeometryUpdateRef.current(state.featureId, finalGeo);
  }, [updateVertexEditVis]);

  const cancelVertexEdit = useCallback(() => {
    vertexEditRef.current = null;
    setIsVertexEditing(false);
    clearVertexEditVis();
    if (map) {
      for (const lid of [
        "editor-subdivisions-fill",
        "editor-subdivisions-stroke",
        "editor-subdivisions-labels",
        "editor-subdivisions-hover",
      ]) {
        if (map.getLayer(lid)) map.setFilter(lid, null);
      }
    }
  }, [map, clearVertexEditVis]);

  // 1. enter/exit vertex editing effect
  useEffect(() => {
    if (!map || !isLoaded) return;

    if (mode === "edit-subdivision" && selectedFeature?.geometry) {
      let geo = JSON.parse(JSON.stringify(selectedFeature.geometry)) as Polygon | MultiPolygon;

      const border = countryGeometryRef.current;
      if (border) {
        const { geometry: clipped, wasClipped } = clipGeometryToBorder(geo, border);
        if (wasClipped) {
          geo = clipped as Polygon | MultiPolygon;
        }
        const nearestRing = findNearestBorderRing(geo, border);
        const edges: Array<[Position, Position]> = [];
        for (let i = 0; i < nearestRing.length - 1; i++) {
          edges.push([nearestRing[i]!, nearestRing[i + 1]!]);
        }
        geo = snapGeometryToBorder(geo, edges, nearestRing, 0.015) as Polygon | MultiPolygon;
      }

      vertexEditRef.current = {
        featureId: selectedFeature.id,
        currentGeometry: geo,
      };
      setIsVertexEditing(true);
      updateVertexEditVis();

      for (const lid of [
        "editor-subdivisions-fill",
        "editor-subdivisions-stroke",
        "editor-subdivisions-labels",
        "editor-subdivisions-hover",
      ]) {
        if (map.getLayer(lid)) map.setFilter(lid, ["!=", ["get", "id"], selectedFeature.id]);
      }
    } else if (vertexEditRef.current) {
      cancelVertexEdit();
    }
  }, [map, isLoaded, mode, selectedFeature, updateVertexEditVis, cancelVertexEdit]);

  // 2. Vertex drag/click event listeners on MapLibre
  useEffect(() => {
    if (!map || !isLoaded) return;

    const canvas = map.getCanvas();

    const onVertexMouseDown = (e: any) => {
      if (!vertexEditRef.current) return;
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;

      const ri = f.properties.ringIndex as number;
      const vi = f.properties.vertexIndex as number;
      const coord = getFeatureCoords(f.geometry) as Position;
      draggingRef.current = { ringIndex: ri, vertexIndex: vi, coord };
      map.dragPan.disable();
      map.getCanvas().style.cursor = "grabbing";
    };

    const onMidpointClick = (e: any) => {
      if (!vertexEditRef.current) return;
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;

      const ri = f.properties.ringIndex as number;
      const si = f.properties.startIndex as number;
      const midCoord = getFeatureCoords(f.geometry) as Position;

      const rings = getAllRings(vertexEditRef.current.currentGeometry);
      const ring = rings[ri];
      if (!ring) return;
      const ei = (si + 1) % ring.length;

      const newGeo = addVertex(
        vertexEditRef.current.currentGeometry,
        { ringIndex: ri, startIndex: si, endIndex: ei, midpoint: midCoord },
        midCoord
      );
      vertexEditRef.current.currentGeometry = newGeo as Polygon | MultiPolygon;
      updateVertexEditVis();
    };

    const onMouseMove = (e: any) => {
      lastMousePointRef.current = { x: e.point.x, y: e.point.y };

      if (!draggingRef.current || !vertexEditRef.current) return;
      const lngLat = e.lngLat;
      let target: Position = [lngLat.lng, lngLat.lat];

      // Snap to visible background layers first
      const snapOn = snapEnabled ?? getSnapEnabled();
      const snapTol = snapTolerance ?? getSnapTolerance();
      if (snapOn && worldMapLayers && editorVisibleLayers) {
        target = snapToLayerFeatures(
          target as [number, number],
          worldMapLayers,
          editorVisibleLayers,
          snapTol
        );
      }

      const border = countryGeometryRef.current;
      if (border) {
        target = clampToGeometry(target, border);
      }
      if (snapOn) {
        const snapGeoms: (Polygon | MultiPolygon)[] = [];
        if (border) {
          snapGeoms.push(border);
        }
        const editingId = vertexEditRef.current.featureId;
        for (const feat of featuresRef.current) {
          if (feat.type === "subdivision" && feat.id !== editingId && feat.geometry) {
            snapGeoms.push(feat.geometry as Polygon | MultiPolygon);
          }
        }
        target = snapPointToGeometries(target, snapGeoms, snapTol);
      }

      // Snap to guides if enabled and guides are present
      if (snapOn && snapPoint) {
        target = snapPoint(target as [number, number]);
      }

      const origTarget: Position = [lngLat.lng, lngLat.lat];
      const didSnap = target[0] !== origTarget[0] || target[1] !== origTarget[1];
      updateSnapGuide(map, didSnap ? origTarget : null, didSnap ? target : null);

      const newGeo = moveVertex(vertexEditRef.current.currentGeometry, draggingRef.current, target);
      vertexEditRef.current.currentGeometry = newGeo as Polygon | MultiPolygon;
      updateVertexEditVis(true);
      scheduleThrottledUpdate();
    };

    const onMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      updateSnapGuide(map, null, null);
      if (throttledUpdateRef.current) {
        clearTimeout(throttledUpdateRef.current);
      }
      updateVertexEditVis(false);
    };

    const onVertexEnter = (e: any) => {
      if (vertexEditRef.current && !draggingRef.current) {
        map.getCanvas().style.cursor = "grab";
        const f = e.features?.[0];
        if (f) {
          hoveredVertexRef.current = {
            ringIndex: f.properties.ringIndex as number,
            vertexIndex: f.properties.vertexIndex as number,
            coord: getFeatureCoords(f.geometry) as Position,
          };
        }
      }
    };

    const onVertexLeave = () => {
      if (vertexEditRef.current && !draggingRef.current) {
        map.getCanvas().style.cursor = "";
        hoveredVertexRef.current = null;
      }
    };

    const onMidpointEnter = () => {
      if (vertexEditRef.current) {
        map.getCanvas().style.cursor = "copy";
      }
    };

    const onMidpointLeave = () => {
      if (vertexEditRef.current && !draggingRef.current) {
        map.getCanvas().style.cursor = "";
      }
    };

    const onCanvasContextMenu = (ev: MouseEvent) => {
      if (!vertexEditRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const bbox: [[number, number], [number, number]] = [
        [x - 12, y - 12],
        [x + 12, y + 12],
      ];
      const hits = map.queryRenderedFeatures(bbox, { layers: ["editor-vedit-vertices-layer"] });
      if (hits.length === 0) return;

      ev.preventDefault();
      ev.stopPropagation();
      const f = hits[0]!;
      const ri = f.properties!.ringIndex as number;
      const vi = f.properties!.vertexIndex as number;
      const coord = getFeatureCoords(f.geometry) as Position;

      const result = removeVertex(vertexEditRef.current.currentGeometry, {
        ringIndex: ri,
        vertexIndex: vi,
        coord,
      });
      if (result) {
        vertexEditRef.current.currentGeometry = result as Polygon | MultiPolygon;
        hoveredVertexRef.current = null;
        updateVertexEditVis();
      }
    };

    // Mobile touches
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let touchStartPoint: { x: number; y: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (!vertexEditRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      touchStartPoint = { x, y };

      const bbox: [[number, number], [number, number]] = [
        [x - 20, y - 20],
        [x + 20, y + 20],
      ];
      const hits = map.queryRenderedFeatures(bbox, {
        layers: ["editor-vedit-vertices-layer"],
      });

      if (hits.length > 0) {
        const f = hits[0]!;
        const ri = f.properties!.ringIndex as number;
        const vi = f.properties!.vertexIndex as number;
        const coord = getFeatureCoords(f.geometry) as Position;
        draggingRef.current = { ringIndex: ri, vertexIndex: vi, coord };
        map.dragPan.disable();

        longPressTimer = setTimeout(() => {
          if (!vertexEditRef.current) return;
          draggingRef.current = null;
          map.dragPan.enable();
          const result = removeVertex(vertexEditRef.current.currentGeometry, {
            ringIndex: ri,
            vertexIndex: vi,
            coord,
          });
          if (result) {
            vertexEditRef.current.currentGeometry = result as Polygon | MultiPolygon;
            hoveredVertexRef.current = null;
            updateVertexEditVis();
          }
        }, 500);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current || !vertexEditRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      if (longPressTimer && touchStartPoint) {
        const rect = canvas.getBoundingClientRect();
        const dx = touch.clientX - rect.left - touchStartPoint.x;
        const dy = touch.clientY - rect.top - touchStartPoint.y;
        if (Math.sqrt(dx * dx + dy * dy) > 8) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }

      const lngLat = map.unproject([
        touch.clientX - canvas.getBoundingClientRect().left,
        touch.clientY - canvas.getBoundingClientRect().top,
      ]);
      let target: Position = [lngLat.lng, lngLat.lat];

      // Snap to visible background layers first
      const snapOn = snapEnabled ?? getSnapEnabled();
      const snapTol = snapTolerance ?? getSnapTolerance();
      if (snapOn && worldMapLayers && editorVisibleLayers) {
        target = snapToLayerFeatures(
          target as [number, number],
          worldMapLayers,
          editorVisibleLayers,
          snapTol
        );
      }

      const border = countryGeometryRef.current;
      if (border) {
        target = clampToGeometry(target, border);
      }
      if (snapOn) {
        const snapGeoms: (Polygon | MultiPolygon)[] = [];
        if (border) {
          snapGeoms.push(border);
        }
        const editingId = vertexEditRef.current.featureId;
        for (const feat of featuresRef.current) {
          if (feat.type === "subdivision" && feat.id !== editingId && feat.geometry) {
            snapGeoms.push(feat.geometry as Polygon | MultiPolygon);
          }
        }
        target = snapPointToGeometries(target, snapGeoms, snapTol);
      }

      // Snap to guides if enabled and guides are present
      if (snapOn && snapPoint) {
        target = snapPoint(target as [number, number]);
      }

      const newGeo = moveVertex(vertexEditRef.current.currentGeometry, draggingRef.current, target);
      vertexEditRef.current.currentGeometry = newGeo as Polygon | MultiPolygon;
      updateVertexEditVis(true);
      scheduleThrottledUpdate();
      e.preventDefault();
    };

    const onTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      touchStartPoint = null;
      if (draggingRef.current) {
        draggingRef.current = null;
        map.dragPan.enable();
        if (throttledUpdateRef.current) {
          clearTimeout(throttledUpdateRef.current);
        }
        updateVertexEditVis(false);
      }
    };

    map.on("mousedown", "editor-vedit-vertices-layer", onVertexMouseDown);
    map.on("click", "editor-vedit-midpoints-layer", onMidpointClick);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    canvas.addEventListener("contextmenu", onCanvasContextMenu);
    map.on("mouseenter", "editor-vedit-vertices-layer", onVertexEnter);
    map.on("mouseleave", "editor-vedit-vertices-layer", onVertexLeave);
    map.on("mouseenter", "editor-vedit-midpoints-layer", onMidpointEnter);
    map.on("mouseleave", "editor-vedit-midpoints-layer", onMidpointLeave);

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      if (longPressTimer) clearTimeout(longPressTimer);
      map.off("mousedown", "editor-vedit-vertices-layer", onVertexMouseDown);
      map.off("click", "editor-vedit-midpoints-layer", onMidpointClick);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      canvas.removeEventListener("contextmenu", onCanvasContextMenu);
      map.off("mouseenter", "editor-vedit-vertices-layer", onVertexEnter);
      map.off("mouseleave", "editor-vedit-vertices-layer", onVertexLeave);
      map.off("mouseenter", "editor-vedit-midpoints-layer", onMidpointEnter);
      map.off("mouseleave", "editor-vedit-midpoints-layer", onMidpointLeave);

      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [
    map,
    isLoaded,
    updateVertexEditVis,
    worldMapLayers,
    editorVisibleLayers,
    snapEnabled,
    snapTolerance,
    snapPoint,
  ]);

  // 3. Keyboard delete listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!vertexEditRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        let target = hoveredVertexRef.current;
        if (!target && lastMousePointRef.current && map) {
          const pt = lastMousePointRef.current;
          const bbox: [[number, number], [number, number]] = [
            [pt.x - 12, pt.y - 12],
            [pt.x + 12, pt.y + 12],
          ];
          const hits = map.queryRenderedFeatures(bbox, {
            layers: ["editor-vedit-vertices-layer"],
          });
          if (hits.length > 0) {
            const f = hits[0]!;
            target = {
              ringIndex: f.properties!.ringIndex as number,
              vertexIndex: f.properties!.vertexIndex as number,
              coord: getFeatureCoords(f.geometry) as Position,
            };
          }
        }
        if (!target) return;
        const result = removeVertex(vertexEditRef.current.currentGeometry, target);
        if (result) {
          vertexEditRef.current.currentGeometry = result as Polygon | MultiPolygon;
          hoveredVertexRef.current = null;
          updateVertexEditVis();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map, updateVertexEditVis]);

  return {
    isVertexEditing,
    handleSimplifyAndSave,
    handleSave,
    finishVertexEdit,
    cancelVertexEdit,
  };
}
