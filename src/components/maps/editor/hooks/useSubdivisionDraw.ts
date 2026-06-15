// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Polygon, MultiPolygon } from "geojson";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import { snapToBorderEdge } from "~/lib/border-editor";
import { getSnapEnabled, getSnapTolerance } from "~/lib/editor-prefs";
import { clipGeometryToBorder } from "~/lib/province-importer/topology";
import {
  getGeoJSONSource,
  calculateOverlapGeoJson,
  EMPTY_FC,
  snapToLayerFeatures,
} from "../utils/map-helpers";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";

interface UseSubdivisionDrawProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  mode: EditorMode;
  features: EditorFeature[];
  countryGeometry: Polygon | MultiPolygon | null;
  onDrawComplete: (geometry: object) => void;
  worldMapLayers?: MapLayerData[];
  editorVisibleLayers?: Set<string>;
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
}: UseSubdivisionDrawProps) {
  const drawVerticesRef = useRef<[number, number][]>([]);
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
      drawVerticesRef.current.pop();
      updateDrawVisualization();
      setDrawVertices([...drawVerticesRef.current]);
    }
  }, [updateDrawVisualization]);

  const clearDraw = useCallback(() => {
    drawVerticesRef.current = [];
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

    const onClick = (e: any) => {
      if (e.routeClicked || e.defaultPrevented) return;
      if (mode !== "add-subdivision") return;

      let clickPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      // Snap to visible background layers first
      const snapOn = getSnapEnabled();
      const snapTol = getSnapTolerance();
      if (snapOn && worldMapLayers && editorVisibleLayers) {
        clickPoint = snapToLayerFeatures(clickPoint, worldMapLayers, editorVisibleLayers, snapTol);
      }

      const border = countryGeometry;
      if (snapOn && border) {
        clickPoint = snapToBorderEdge(clickPoint, border, snapTol);
      }
      if (snapOn) {
        for (const feat of features) {
          if (
            feat.type === "subdivision" &&
            feat.geometry &&
            (feat.geometry as any).coordinates &&
            (feat.geometry as any).coordinates.length > 0
          ) {
            const snapped = snapToBorderEdge(
              clickPoint,
              feat.geometry as Polygon | MultiPolygon,
              snapTol
            );
            if (snapped !== clickPoint) {
              clickPoint = snapped;
            }
          }
        }
      }
      drawVerticesRef.current.push(clickPoint);
      updateDrawVisualization();
      setDrawVertices([...drawVerticesRef.current]);
    };

    const onDblClick = (e: any) => {
      if (mode !== "add-subdivision") return;
      if (drawVerticesRef.current.length >= 3) {
        e.preventDefault();
        saveDraw();
      }
    };

    map.on("click", onClick);
    map.on("dblclick", onDblClick);

    return () => {
      map.on("click", onClick);
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
  ]);

  // Keyboard undo listener (Backspace/Delete/Ctrl+Z)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (mode !== "add-subdivision") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const isUndo =
        e.key === "Backspace" || e.key === "Delete" || (e.key === "z" && (e.ctrlKey || e.metaKey));

      if (isUndo && drawVerticesRef.current.length > 0) {
        e.preventDefault();
        undoLastVertex();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, undoLastVertex]);

  // Clear draw state when mode changes away from add-subdivision
  useEffect(() => {
    if (mode !== "add-subdivision") {
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
