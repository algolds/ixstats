import { useState, useRef, useEffect, useCallback } from "react";
import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type { Polygon, MultiPolygon, Position, Geometry, FeatureCollection } from "geojson";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import {
  getVertices,
  moveVertex,
  addVertex,
  removeVertex,
  simplifyGeometry,
  snapToNeighborBorders,
  sanitizeRegionShape,
} from "~/lib/maps/border-editor";
import type { VertexRef } from "~/lib/maps/border-editor";
import {
  findNearestBorderRing,
  snapGeometryToBorder,
} from "~/lib/maps/province-importer/alignment";
import { clipGeometryToBorder } from "~/lib/maps/province-importer/topology";
import {
  buildTopologyIndex,
  cascadeMoveVertex,
  vkey,
  type TopologyIndex,
} from "~/lib/maps/topology-engine";
import {
  getGeoJSONSource,
  updateSnapGuide,
  calculateOverlapGeoJson,
  EMPTY_FC,
  getFeatureCoords,
  snapGeometryToBackgroundLayers,
} from "../utils/map-helpers";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { getSnapEnabled, getSnapTolerance } from "~/lib/maps/editor-prefs";
import {
  exceedsHysteresis,
  detectAxis,
  axisLock,
  type DragAxis,
  type ScreenPoint,
} from "./drag-utils";
import {
  calculateSnapTarget,
  buildNeighborGeometries,
  buildMidpointFeatures,
} from "./vertex-edit-geometry";

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
  snapEnabled?: boolean;
  snapTolerance?: number;
  snapPoint?: (coords: [number, number]) => [number, number];
}

interface DragVertexState extends VertexRef {
  originalCoord: Position;
  initialGeometry: Polygon | MultiPolygon;
  startScreenPoint: ScreenPoint;
  committed: boolean;
  lockedAxis: DragAxis | null;
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
  snapEnabled,
  snapTolerance,
  snapPoint,
}: UseSubdivisionVertexEditProps) {
  const [isVertexEditing, setIsVertexEditing] = useState(false);
  const vertexEditRef = useRef<{
    featureId: string;
    currentGeometry: Polygon | MultiPolygon;
  } | null>(null);

  const draggingRef = useRef<DragVertexState | null>(null);
  const hoveredVertexRef = useRef<VertexRef | null>(null);
  const lastMousePointRef = useRef<{ x: number; y: number } | null>(null);

  // Topology engine: spatial-hash index + neighbor geometry cache for cascade editing
  const topologyIndexRef = useRef<TopologyIndex | null>(null);
  const neighborGeometriesRef = useRef<Map<string, Polygon | MultiPolygon>>(new Map());

  const throttledUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef(0);

  // Keep latest refs of parameters to avoid stale closure in event callbacks
  const featuresRef = useRef(features);
  // oxlint-disable-next-line
  featuresRef.current = features;
  const countryGeometryRef = useRef(countryGeometry);
  // oxlint-disable-next-line
  countryGeometryRef.current = countryGeometry;
  const onGeometryUpdateRef = useRef(onGeometryUpdate);
  // oxlint-disable-next-line
  onGeometryUpdateRef.current = onGeometryUpdate;

  const updateVertexEditVis = useCallback(
    (fastOnly = false) => {
      const state = vertexEditRef.current;
      if (!map || !state) return;

      const geo = state.currentGeometry;

      // Polygon fill + stroke
      getGeoJSONSource(map, "editor-vedit-polygon")?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: geo, properties: {} }],
      });

      // Vertices
      const verts = getVertices(geo);
      getGeoJSONSource(map, "editor-vedit-vertices")?.setData({
        type: "FeatureCollection",
        features: verts.map((v) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: v.coord },
          properties: { ringIndex: v.ringIndex, vertexIndex: v.vertexIndex },
        })),
      });

      if (fastOnly) return;

      // Midpoints (for adding new vertices)
      getGeoJSONSource(map, "editor-vedit-midpoints")?.setData({
        type: "FeatureCollection",
        features: buildMidpointFeatures(geo),
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

    const neighborGeometries = buildNeighborGeometries(featuresRef.current, state.featureId);
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

      const neighborGeometries = buildNeighborGeometries(featuresRef.current, state.featureId);
      if (neighborGeometries.length > 0) {
        finalGeo = snapToNeighborBorders(finalGeo, neighborGeometries, border, 0.015);
      }

      state.currentGeometry = finalGeo as Polygon | MultiPolygon;
      updateVertexEditVis();
    }
    onGeometryUpdateRef.current(state.featureId, finalGeo);

    // Save cascaded neighbor geometries
    for (const [fid, geom] of neighborGeometriesRef.current) {
      if (onGeometryUpdateRef.current) {
        onGeometryUpdateRef.current(fid, geom);
      }
    }
  }, [updateVertexEditVis]);

  const cancelVertexEdit = useCallback(() => {
    vertexEditRef.current = null;
    topologyIndexRef.current = null;
    neighborGeometriesRef.current = new Map();
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

  // 1. Enter/exit vertex editing effect
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

      // Build topology index from all subdivision features for cascade editing
      const subdivisionFeatures: { id: string; geometry: Polygon | MultiPolygon }[] = [];
      for (const feat of featuresRef.current) {
        if (feat.type === "subdivision" && feat.geometry) {
          subdivisionFeatures.push({
            id: feat.id,
            geometry: (feat.id === selectedFeature.id ? geo : feat.geometry) as
              Polygon | MultiPolygon,
          });
        }
      }
      topologyIndexRef.current = buildTopologyIndex(subdivisionFeatures);
      neighborGeometriesRef.current = new Map(
        subdivisionFeatures
          .filter((f) => f.id !== selectedFeature.id)
          .map((f) => [f.id, JSON.parse(JSON.stringify(f.geometry))])
      );

      // oxlint-disable-next-line
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

  // 2. Vertex drag/click event listeners on MapLibre & Window
  useEffect(() => {
    if (!map || !isLoaded) return;

    const canvas = map.getCanvas();

    const onVertexMouseDown = (e: MapLayerMouseEvent) => {
      if (!vertexEditRef.current) return;
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;

      const ri = f.properties.ringIndex as number;
      const vi = f.properties.vertexIndex as number;
      const coord = getFeatureCoords(f.geometry) as Position;

      draggingRef.current = {
        ringIndex: ri,
        vertexIndex: vi,
        coord,
        originalCoord: [...coord] as Position,
        initialGeometry: JSON.parse(JSON.stringify(vertexEditRef.current.currentGeometry)) as
          | Polygon
          | MultiPolygon,
        startScreenPoint: { x: e.point.x, y: e.point.y },
        committed: false,
        lockedAxis: null,
      };
    };

    const onMidpointClick = (e: MapLayerMouseEvent) => {
      if (!vertexEditRef.current) return;
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;

      const ri = f.properties.ringIndex as number;
      const si = f.properties.startIndex as number;
      const midCoord = getFeatureCoords(f.geometry) as Position;

      const newGeo = addVertex(
        vertexEditRef.current.currentGeometry,
        { ringIndex: ri, startIndex: si, endIndex: si + 1, midpoint: midCoord },
        midCoord
      );
      vertexEditRef.current.currentGeometry = newGeo as Polygon | MultiPolygon;
      updateVertexEditVis();
    };

    const onMouseMove = (e: MapLayerMouseEvent) => {
      lastMousePointRef.current = { x: e.point.x, y: e.point.y };

      const drag = draggingRef.current;
      if (!drag || !vertexEditRef.current) return;

      const currentScreen: ScreenPoint = { x: e.point.x, y: e.point.y };

      // Hysteresis check (4px dead zone)
      if (!drag.committed) {
        if (!exceedsHysteresis(drag.startScreenPoint, currentScreen)) {
          return;
        }
        drag.committed = true;
        map.dragPan.disable();
        map.getCanvas().style.cursor = "grabbing";

        if (e.originalEvent.shiftKey) {
          const dx = currentScreen.x - drag.startScreenPoint.x;
          const dy = currentScreen.y - drag.startScreenPoint.y;
          drag.lockedAxis = detectAxis(dx, dy);
        }
      }

      // Shift axis locking
      if (e.originalEvent.shiftKey) {
        if (!drag.lockedAxis) {
          const dx = currentScreen.x - drag.startScreenPoint.x;
          const dy = currentScreen.y - drag.startScreenPoint.y;
          drag.lockedAxis = detectAxis(dx, dy);
        }
      } else {
        drag.lockedAxis = null;
      }

      const rawCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const lockedCoords = axisLock(
        drag.originalCoord as [number, number],
        rawCoords,
        drag.lockedAxis
      );

      const snapOn = snapEnabled ?? getSnapEnabled();
      const snapTol = snapTolerance ?? getSnapTolerance();

      const { target, didSnap, origTarget } = calculateSnapTarget({
        coords: lockedCoords,
        snapEnabled: snapOn,
        snapTolerance: snapTol,
        worldMapLayers,
        editorVisibleLayers,
        border: countryGeometryRef.current,
        features: featuresRef.current,
        editingFeatureId: vertexEditRef.current.featureId,
        snapPointGuide: snapPoint,
      });

      updateSnapGuide(map, didSnap ? origTarget : null, didSnap ? target : null);

      const oldCoord = drag.coord;
      const newGeo = moveVertex(vertexEditRef.current.currentGeometry, drag, target);
      vertexEditRef.current.currentGeometry = newGeo as Polygon | MultiPolygon;

      // Cascade move to neighbors sharing this vertex via topology index
      if (topologyIndexRef.current && oldCoord) {
        const oldKey = vkey(oldCoord);
        const allGeoms = new Map(neighborGeometriesRef.current);
        allGeoms.set(vertexEditRef.current.featureId, newGeo);

        const cascaded = cascadeMoveVertex(topologyIndexRef.current, allGeoms, oldKey, target);

        // Update neighbor geometries in tracking map + visual source
        for (const [fid, updatedGeom] of cascaded) {
          if (fid !== vertexEditRef.current.featureId) {
            neighborGeometriesRef.current.set(fid, updatedGeom);
            try {
              const src = map?.getSource("editor-subdivisions") as {
                _data?: { features?: Array<{ properties?: { id?: string }; geometry?: Geometry | Polygon | MultiPolygon }> };
                _options?: { data?: { features?: Array<{ properties?: { id?: string }; geometry?: Geometry | Polygon | MultiPolygon }> } };
                serialize?: () => object;
                setData?: (data: FeatureCollection) => void;
              } | undefined;
              if (src && typeof src.serialize === "function" && typeof src.setData === "function") {
                const data = src._data || src._options?.data;
                if (data?.features) {
                  const idx = data.features.findIndex((f) => f.properties?.id === fid);
                  if (idx >= 0 && data.features[idx]) {
                    data.features[idx]!.geometry = updatedGeom;
                    src.setData(data as FeatureCollection);
                  }
                }
              }
            } catch (_e) {
              // Visual-only feedback
            }
          }
        }
        draggingRef.current = { ...drag, coord: target };
      }

      updateVertexEditVis(true);
      // oxlint-disable-next-line
      scheduleThrottledUpdate();
    };

    const onMouseUp = () => {
      const drag = draggingRef.current;
      if (!drag) return;
      draggingRef.current = null;

      if (drag.committed) {
        map.dragPan.enable();
        map.getCanvas().style.cursor = "";
        updateSnapGuide(map, null, null);
        if (throttledUpdateRef.current) {
          clearTimeout(throttledUpdateRef.current);
        }
        updateVertexEditVis(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && draggingRef.current && vertexEditRef.current) {
        e.preventDefault();
        const drag = draggingRef.current;
        draggingRef.current = null;

        if (drag.committed) {
          vertexEditRef.current.currentGeometry = drag.initialGeometry;
          updateVertexEditVis(false);
          map.dragPan.enable();
          map.getCanvas().style.cursor = "";
          updateSnapGuide(map, null, null);
        }
      }
    };

    const onVertexEnter = (e: MapLayerMouseEvent) => {
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

        draggingRef.current = {
          ringIndex: ri,
          vertexIndex: vi,
          coord,
          originalCoord: [...coord] as Position,
          initialGeometry: JSON.parse(JSON.stringify(vertexEditRef.current.currentGeometry)) as
            | Polygon
            | MultiPolygon,
          startScreenPoint: { x, y },
          committed: true, // Touch commits immediately upon hit
          lockedAxis: null,
        };
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

      const snapOn = snapEnabled ?? getSnapEnabled();
      const snapTol = snapTolerance ?? getSnapTolerance();

      const { target } = calculateSnapTarget({
        coords: [lngLat.lng, lngLat.lat],
        snapEnabled: snapOn,
        snapTolerance: snapTol,
        worldMapLayers,
        editorVisibleLayers,
        border: countryGeometryRef.current,
        features: featuresRef.current,
        editingFeatureId: vertexEditRef.current.featureId,
        snapPointGuide: snapPoint,
      });

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
    canvas.addEventListener("contextmenu", onCanvasContextMenu);
    map.on("mouseenter", "editor-vedit-vertices-layer", onVertexEnter);
    map.on("mouseleave", "editor-vedit-vertices-layer", onVertexLeave);
    map.on("mouseenter", "editor-vedit-midpoints-layer", onMidpointEnter);
    map.on("mouseleave", "editor-vedit-midpoints-layer", onMidpointLeave);

    // Window listeners for reliable drag completion and cancellation
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      if (longPressTimer) clearTimeout(longPressTimer);
      map.off("mousedown", "editor-vedit-vertices-layer", onVertexMouseDown);
      map.off("click", "editor-vedit-midpoints-layer", onMidpointClick);
      map.off("mousemove", onMouseMove);
      canvas.removeEventListener("contextmenu", onCanvasContextMenu);
      map.off("mouseenter", "editor-vedit-vertices-layer", onVertexEnter);
      map.off("mouseleave", "editor-vedit-vertices-layer", onVertexLeave);
      map.off("mouseenter", "editor-vedit-midpoints-layer", onMidpointEnter);
      map.off("mouseleave", "editor-vedit-midpoints-layer", onMidpointLeave);

      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);

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
