import { useState, useRef, useEffect, useCallback } from "react";
import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type { Polygon, MultiPolygon } from "geojson";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import { snapPointToGeometries } from "~/lib/maps/border-editor";
import {
  getSnapEnabled,
  getSnapTolerance,
  withoutDisabledSnapLayers,
} from "~/lib/maps/editor-prefs";
import { clipGeometryToBorder } from "~/lib/maps/province-importer/topology";
import {
  getGeoJSONSource,
  calculateOverlapGeoJson,
  EMPTY_FC,
  snapToLayerFeatures,
} from "../utils/map-helpers";
import { traceTerrainPath } from "../utils/terrain-trace";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { isKeyboardInputTarget } from "./drag-utils";

/** A click counts as "on" a river/coastline when within this fraction of the snap tolerance. */
const TRACE_TOLERANCE_RATIO = 0.1;

/** Country border plus every non-empty subdivision, for vertex/edge snapping. */
function collectSnapGeometries(
  countryGeometry: Polygon | MultiPolygon | null,
  features: EditorFeature[]
): (Polygon | MultiPolygon)[] {
  const snapGeoms: (Polygon | MultiPolygon)[] = countryGeometry ? [countryGeometry] : [];
  for (const feat of features) {
    const geo = feat.geometry as Polygon | MultiPolygon | null;
    if (feat.type === "subdivision" && geo && "coordinates" in geo && geo.coordinates.length > 0) {
      snapGeoms.push(geo);
    }
  }
  return snapGeoms;
}

/** River/lake shore/coastline vertices between the last drawn vertex and a new click. */
function traceFromLastVertex(
  vertices: [number, number][],
  clickPoint: [number, number],
  worldMapLayers: MapLayerData[] | undefined,
  snapLayers: Set<string> | null,
  snapTol: number
): [number, number][] {
  const prev = vertices[vertices.length - 1];
  if (!prev || !worldMapLayers || !snapLayers) return [];
  const traced = traceTerrainPath(
    prev,
    clickPoint,
    worldMapLayers,
    snapLayers,
    snapTol * TRACE_TOLERANCE_RATIO
  );
  return traced.map((p): [number, number] => [p[0]!, p[1]!]);
}

interface UseSubdivisionDrawProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  mode: EditorMode;
  features: EditorFeature[];
  countryGeometry: Polygon | MultiPolygon | null;
  onDrawComplete: (geometry: object) => void;
  worldMapLayers?: MapLayerData[];
  editorVisibleLayers?: Set<string>;
  guides?: { id: string; type: "h" | "v"; value: number }[];
  snapEnabled?: boolean;
  snapTolerance?: number;
  snapPoint?: (coords: [number, number]) => [number, number];
}

export function useSubdivisionDraw({
  map,
  isLoaded,
  mode,
  features,
  countryGeometry,
  onDrawComplete,
  worldMapLayers,
  editorVisibleLayers,
  // oxlint-disable-next-line eslint/no-unused-vars
  guides,
  snapEnabled,
  snapTolerance,
  snapPoint,
}: UseSubdivisionDrawProps) {
  const drawVerticesRef = useRef<[number, number][]>([]);
  /** Vertices added per click (1, plus any traced terrain vertices) so undo removes a click. */
  const clickSizesRef = useRef<number[]>([]);
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);

  // Update draw polygon visualization
  const updateDrawVisualization = useCallback(() => {
    if (!map) return;

    const vertices = drawVerticesRef.current;

    const verticesGeoJson = {
      type: "FeatureCollection" as const,
      features: vertices.map((v) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: v },
        properties: {},
      })),
    };
    getGeoJSONSource(map, "editor-draw-vertices")?.setData(verticesGeoJson);

    if (vertices.length >= 3) {
      const polyGeoJson = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            geometry: {
              type: "Polygon" as const,
              coordinates: [[...vertices, vertices[0]]],
            },
            properties: {},
          },
        ],
      };
      getGeoJSONSource(map, "editor-draw-polygon")?.setData(polyGeoJson);
      const drawnGeom = {
        type: "Polygon" as const,
        coordinates: [[...vertices, vertices[0]]],
      };
      const overlapGeoJson = calculateOverlapGeoJson(drawnGeom, features);
      getGeoJSONSource(map, "editor-overlap-highlight")?.setData(overlapGeoJson);
    } else if (vertices.length >= 2) {
      const lineGeoJson = {
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
      getGeoJSONSource(map, "editor-draw-polygon")?.setData(lineGeoJson);
      getGeoJSONSource(map, "editor-overlap-highlight")?.setData(EMPTY_FC);
    } else {
      getGeoJSONSource(map, "editor-draw-polygon")?.setData(EMPTY_FC);
      getGeoJSONSource(map, "editor-overlap-highlight")?.setData(EMPTY_FC);
    }
  }, [map, features]);

  const undoLastVertex = useCallback(() => {
    if (drawVerticesRef.current.length > 0) {
      const count = clickSizesRef.current.pop() ?? 1;
      drawVerticesRef.current.splice(-count, count);
      updateDrawVisualization();
      setDrawVertices([...drawVerticesRef.current]);
    }
  }, [updateDrawVisualization]);

  const clearDraw = useCallback(() => {
    drawVerticesRef.current = [];
    clickSizesRef.current = [];
    updateDrawVisualization();
    setDrawVertices([]);
  }, [updateDrawVisualization]);

  const saveDraw = useCallback(() => {
    if (drawVerticesRef.current.length >= 3) {
      const vertices = drawVerticesRef.current;
      let geometry: Polygon | MultiPolygon = {
        type: "Polygon" as const,
        coordinates: [[...vertices, vertices[0]]],
      };
      const border = countryGeometry;
      if (border) {
        const { geometry: clipped } = clipGeometryToBorder(geometry, border);
        geometry = clipped as Polygon | MultiPolygon;
      }
      onDrawComplete(geometry);
      clearDraw();
    }
  }, [countryGeometry, onDrawComplete, clearDraw]);

  // Bind mouse/touch map clicks for subdivision drawing
  useEffect(() => {
    if (!map || !isLoaded) return;

    const onClick = (e: MapLayerMouseEvent & { routeClicked?: boolean }) => {
      if (e.routeClicked || e.defaultPrevented) return;
      if (mode !== "add-subdivision" && mode !== "add-lake") return;

      let clickPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      // Snap to visible background layers first (minus layers switched off in the toolbar)
      const snapOn = snapEnabled ?? getSnapEnabled();
      const snapTol = snapTolerance ?? getSnapTolerance();
      const snapLayers =
        snapOn && editorVisibleLayers ? withoutDisabledSnapLayers(editorVisibleLayers) : null;
      if (snapLayers && worldMapLayers) {
        clickPoint = snapToLayerFeatures(clickPoint, worldMapLayers, snapLayers, snapTol);
      }

      if (snapOn) {
        const snapGeoms = collectSnapGeometries(countryGeometry, features);
        clickPoint = snapPointToGeometries(clickPoint, snapGeoms, snapTol) as [number, number];
      }

      // Snap to guides if enabled and guides are present
      if (snapOn && snapPoint) {
        clickPoint = snapPoint(clickPoint);
      }

      // Follow a river/lake shore/coastline when this and the previous click both sit on it
      const traced = traceFromLastVertex(
        drawVerticesRef.current,
        clickPoint,
        worldMapLayers,
        snapLayers,
        snapTol
      );
      drawVerticesRef.current.push(...traced, clickPoint);
      clickSizesRef.current.push(traced.length + 1);
      updateDrawVisualization();
      setDrawVertices([...drawVerticesRef.current]);
    };

    const onDblClick = (e: MapLayerMouseEvent) => {
      if (mode !== "add-subdivision" && mode !== "add-lake") return;
      if (drawVerticesRef.current.length >= 3) {
        e.preventDefault();
        saveDraw();
      }
    };

    map.on("click", onClick);
    map.on("dblclick", onDblClick);

    return () => {
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
    };
  }, [
    map,
    isLoaded,
    mode,
    features,
    countryGeometry,
    saveDraw,
    updateDrawVisualization,
    worldMapLayers,
    editorVisibleLayers,
    snapEnabled,
    snapTolerance,
    snapPoint,
  ]);

  // Keyboard undo & cancel listener (Backspace/Delete/Ctrl+Z to undo vertex, Escape to cancel drawing)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (mode !== "add-subdivision" && mode !== "add-lake") return;
      if (isKeyboardInputTarget(e.target) || isKeyboardInputTarget(document.activeElement)) return;

      if (e.key === "Escape" && drawVerticesRef.current.length > 0) {
        e.preventDefault();
        clearDraw();
        return;
      }

      const isUndo =
        e.key === "Backspace" || e.key === "Delete" || (e.key === "z" && (e.ctrlKey || e.metaKey));

      if (isUndo && drawVerticesRef.current.length > 0) {
        e.preventDefault();
        undoLastVertex();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, undoLastVertex, clearDraw]);

  // Clear draw state when mode changes away from add-subdivision
  useEffect(() => {
    if (mode !== "add-subdivision" && mode !== "add-lake") {
      // oxlint-disable-next-line
      clearDraw();
    }
  }, [mode, clearDraw]);

  return {
    drawVertices,
    undoLastVertex,
    clearDraw,
    saveDraw,
    canSaveDraw: drawVertices.length >= 3,
  };
}
