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
  collection,
  lineFeature,
  pointFeature,
  snapToLayerFeatures,
} from "../utils/map-helpers";
import { traceTerrainPath } from "../utils/terrain-trace";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { isKeyboardInputTarget } from "./drag-utils";

/** A click counts as "on" a river/coastline when within this fraction of the snap tolerance. */
const TRACE_TOLERANCE_RATIO = 0.1;

const closedPolygon = (vertices: [number, number][]): Polygon => ({
  type: "Polygon",
  coordinates: [[...vertices, vertices[0]!]],
});

const isDrawMode = (mode: EditorMode) => mode === "add-subdivision" || mode === "add-lake";

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
  snapEnabled,
  snapTolerance,
  snapPoint,
}: UseSubdivisionDrawProps) {
  const drawVerticesRef = useRef<[number, number][]>([]);
  /** Vertices added per click (1, plus any traced terrain vertices) so undo removes a click. */
  const clickSizesRef = useRef<number[]>([]);
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);

  const updateDrawVisualization = useCallback(() => {
    if (!map) return;

    const vertices = drawVerticesRef.current;
    const polygon = vertices.length >= 3 ? closedPolygon(vertices) : null;
    const polyData = polygon
      ? collection([{ type: "Feature", geometry: polygon, properties: {} }])
      : vertices.length >= 2
        ? collection([lineFeature(vertices)])
        : EMPTY_FC;

    getGeoJSONSource(map, "editor-draw-vertices")?.setData(
      collection(vertices.map((v) => pointFeature(v)))
    );
    getGeoJSONSource(map, "editor-draw-polygon")?.setData(polyData);
    getGeoJSONSource(map, "editor-overlap-highlight")?.setData(
      polygon ? calculateOverlapGeoJson(polygon, features) : EMPTY_FC
    );
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
    if (drawVerticesRef.current.length < 3) return;
    const polygon = closedPolygon(drawVerticesRef.current);
    onDrawComplete(
      countryGeometry ? clipGeometryToBorder(polygon, countryGeometry).geometry : polygon
    );
    clearDraw();
  }, [countryGeometry, onDrawComplete, clearDraw]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const onClick = (e: MapLayerMouseEvent & { routeClicked?: boolean }) => {
      if (e.routeClicked || e.defaultPrevented) return;
      if (!isDrawMode(mode)) return;

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
      if (!isDrawMode(mode)) return;
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
      if (!isDrawMode(mode)) return;
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

  useEffect(() => {
    if (!isDrawMode(mode)) {
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
