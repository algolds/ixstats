"use client";

import { useRef, useCallback, useState, forwardRef, useImperativeHandle, memo } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Polygon, MultiPolygon, FeatureCollection } from "geojson";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import type { MapTheme } from "~/lib/map-styles/registry";

import { useMapLayers } from "./hooks/useMapLayers";
import { useSubdivisionDraw } from "./hooks/useSubdivisionDraw";
import { useSubdivisionVertexEdit } from "./hooks/useSubdivisionVertexEdit";
import { useRouteEdit } from "./hooks/useRouteEdit";
import { usePointDrag } from "./hooks/usePointDrag";
import { useSpacebarPan } from "./hooks/useSpacebarPan";
import { useDragGesture } from "./hooks/useDragGesture";
import { useZoomBucket } from "./hooks/useZoomBucket";
import { useEditorMapSurface } from "./hooks/useEditorMapSurface";
import { useEditorMapSelection } from "./hooks/useEditorMapSelection";
import { useEditorInsertClicks } from "./hooks/useEditorInsertClicks";
import { useMarqueeSelection } from "./hooks/useMarqueeSelection";
import { useSelectionHighlight } from "./hooks/useSelectionHighlight";

import { useMapEditorContext } from "~/components/maps/editor/plugins/context";
import { getPlugins } from "~/components/maps/editor/plugins/registry";

import { DrawingToolbar } from "./toolbars/DrawingToolbar";
import { VertexEditingToolbar } from "./toolbars/VertexEditingToolbar";
import { RouteEditingToolbar } from "./toolbars/RouteEditingToolbar";
import { MapHintPill } from "./toolbars/MapHintPill";
import { EditorRulers } from "./components/EditorRulers";

export interface EditorMapRef {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  getMap: () => MapLibreMap | null;
}

interface EditorMapProps {
  countryGeometry: Polygon | MultiPolygon | null;
  countryCentroid: { lng: number; lat: number } | null;
  countryBbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  countryColor?: string;
  features: EditorFeature[];
  mode: EditorMode;
  pendingCoordinates: [number, number] | null;
  onMapClick: (lng: number, lat: number) => void;
  onDrawComplete: (geometry: object) => void;
  selectedFeature: EditorFeature | null;
  onFeatureSelect?: (feature: EditorFeature | null) => void;
  /** Called when user saves edited polygon vertices (with any topology-cascaded neighbours) */
  onGeometryUpdate?: (
    featureId: string,
    geometry: object,
    cascaded?: Array<{ id: string; geometry: object }>
  ) => void;
  /** Reports unsaved vertex edits so the editor can warn before leaving */
  onVertexEditDirtyChange?: (dirty: boolean) => void;
  worldMapLayers?: MapLayerData[];
  editorVisibleLayers?: Set<string>;
  showGrid?: boolean;
  onZoomChange?: (zoom: number) => void;
  routeWaypoints?: [number, number][];
  /** Route type picked for the in-progress route (live travel estimate) */
  drawRouteType?: string;
  /** Layer visibility state — controls which feature types are rendered */
  layerVisibility?: Record<string, boolean>;
  /** Layer opacity state — controls opacity of lines, labels, etc. */
  layerOpacity?: Record<string, number>;
  editingRouteId?: string | null;
  editingRouteVertices?: [number, number][];
  onRouteVerticesUpdate?: (vertices: [number, number][]) => void;
  onRouteEditCommit?: () => void;
  onRouteEditCancel?: () => void;
  theme?: MapTheme;
  updatePointCoordinates?: (
    featureId: string,
    featureType: "city" | "poi" | "storyPin" | "mapLabel" | "peak",
    coordinates: [number, number]
  ) => Promise<void>;
  isPickingLocation?: boolean;
  onFeatureContextMenu?: (feature: EditorFeature, screenPos: { x: number; y: number }) => void;
  gapFeatures?: FeatureCollection | null;
  showGaps?: boolean;
  emptyRegionsFeatures?: FeatureCollection | null;
  showEmptyRegions?: boolean;
  rulerPoints?: [number, number][];
  lassoGeometry?: Polygon | MultiPolygon | null;
  setLassoGeometry?: (geom: Polygon | MultiPolygon | null) => void;
  onAddRulerPoint?: (coords: [number, number]) => void;
  onApplyLassoSelection?: (
    coords: [number, number][],
    mode?: "replace" | "add" | "subtract"
  ) => void;
  onApplyRectSelection?: (
    bounds: { west: number; south: number; east: number; north: number },
    mode?: "replace" | "add" | "subtract"
  ) => void;
  /** Locked feature-layer keys (from LayerPanel). Locked layers are not selectable. */
  lockedLayers?: Record<string, boolean>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  lassoTool?: "freehand" | "rect";
  guides?: { id: string; type: "h" | "v"; value: number }[];
  setGuides?: React.Dispatch<
    React.SetStateAction<{ id: string; type: "h" | "v"; value: number }[]>
  >;
  showGuides?: boolean;
  snapEnabled?: boolean;
  snapTolerance?: number;
  onMapReady?: (map: MapLibreMap | null) => void;
}

const EditorMap = memo(
  forwardRef<EditorMapRef, EditorMapProps>(function EditorMap(
    {
      countryGeometry,
      countryCentroid,
      countryBbox,
      countryColor,
      features,
      mode,
      pendingCoordinates,
      onMapClick,
      onDrawComplete,
      selectedFeature,
      onFeatureSelect,
      onGeometryUpdate,
      onVertexEditDirtyChange,
      worldMapLayers,
      editorVisibleLayers,
      showGrid,
      onZoomChange,
      routeWaypoints,
      drawRouteType,
      layerVisibility,
      layerOpacity,
      editingRouteVertices,
      onRouteVerticesUpdate,
      onRouteEditCommit,
      onRouteEditCancel,
      theme = "standard",
      updatePointCoordinates,
      isPickingLocation = false,
      onFeatureContextMenu,
      gapFeatures,
      showGaps,
      emptyRegionsFeatures,
      showEmptyRegions,
      rulerPoints,
      lassoGeometry,
      setLassoGeometry,
      onAddRulerPoint,
      onApplyLassoSelection,
      onApplyRectSelection,
      lockedLayers,
      selectedIds,
      onToggleSelect,
      lassoTool = "freehand",
      guides = [],
      setGuides,
      showGuides = true,
      snapEnabled = true,
      snapTolerance = 10,
      onMapReady,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const context = useMapEditorContext();

    const snapPoint = useCallback(
      (coords: [number, number]) => {
        let snapped = coords;
        for (const plugin of getPlugins()) {
          if (plugin.snapPoint && (snapEnabled ?? context.state.snapEnabled)) {
            snapped = plugin.snapPoint(snapped, context);
          }
        }
        return snapped;
      },
      [context, snapEnabled]
    );

    const spacebarPanRef = useSpacebarPan(mapRef, isLoaded);
    const wasDragRef = useDragGesture(mapRef, isLoaded);

    useImperativeHandle(ref, () => ({
      flyTo: (lng: number, lat: number, zoom = 6) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1000 });
      },
      getMap: () => mapRef.current,
    }));

    const gridZoomBucket = useZoomBucket(mapRef, isLoaded, onZoomChange);

    useMapLayers({
      map: mapRef.current,
      isLoaded,
      countryGeometry,
      countryBbox,
      countryColor,
      features,
      layerVisibility,
      layerOpacity,
      pendingCoordinates,
      worldMapLayers,
      showGrid,
      gridZoomBucket,
      routeWaypoints,
      theme,
      gapFeatures,
      showGaps,
      emptyRegionsFeatures,
      showEmptyRegions,
      lassoGeometry,
      rulerPoints,
    });

    const draw = useSubdivisionDraw({
      map: mapRef.current,
      isLoaded,
      mode,
      features,
      countryGeometry,
      onDrawComplete,
      worldMapLayers,
      editorVisibleLayers,
      guides,
      snapEnabled,
      snapTolerance,
      snapPoint,
    });

    const vertexEdit = useSubdivisionVertexEdit({
      map: mapRef.current,
      isLoaded,
      mode,
      selectedFeature,
      features,
      countryGeometry,
      onGeometryUpdate,
      onDirtyChange: onVertexEditDirtyChange,
      worldMapLayers,
      editorVisibleLayers,
      snapEnabled,
      snapTolerance,
      snapPoint,
    });

    useRouteEdit({
      map: mapRef.current,
      isLoaded,
      mode,
      editingRouteVertices,
      onRouteVerticesUpdate,
    });

    usePointDrag({
      map: mapRef.current,
      isLoaded,
      mode,
      features,
      selectedFeature,
      onFeatureSelect,
      updatePointCoordinates,
    });

    useEditorMapSurface({
      containerRef,
      mapRef,
      isLoaded,
      setIsLoaded,
      theme,
      countryBbox,
      countryCentroid,
      setPluginMap: context.setMap,
      onMapReady,
    });

    useEditorMapSelection({
      mapRef,
      isLoaded,
      isVertexEditing: vertexEdit.isVertexEditing,
      mode,
      features,
      isPickingLocation,
      lockedLayers,
      spacebarPanRef,
      wasDragRef,
      onFeatureSelect,
      onToggleSelect,
      onFeatureContextMenu,
    });

    useEditorInsertClicks({
      mapRef,
      isLoaded,
      isVertexEditing: vertexEdit.isVertexEditing,
      mode,
      snapPoint,
      spacebarPanRef,
      wasDragRef,
      onMapClick,
      onAddRulerPoint,
    });

    useMarqueeSelection({
      mapRef,
      isLoaded,
      mode,
      lassoTool,
      spacebarPanRef,
      setLassoGeometry,
      onApplyLassoSelection,
      onApplyRectSelection,
    });

    useSelectionHighlight(mapRef, isLoaded, selectedFeature, selectedIds);

    return (
      <div className="relative h-full w-full select-none" style={{ minHeight: 400 }}>
        <style>{`
          .maplibregl-ctrl-top-right {
            top: 28px !important;
          }
        `}</style>

        <div
          ref={containerRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />

        {!isLoaded && (
          <div className="bg-fill-3 absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="border-separator border-t-green h-8 w-8 animate-spin rounded-full border-4" />
              <p className="text-label-secondary text-body">Loading map editor...</p>
            </div>
          </div>
        )}

        <EditorRulers
          map={mapRef.current}
          isLoaded={isLoaded}
          containerRef={containerRef}
          guides={guides}
          setGuides={setGuides}
          showGuides={showGuides}
        />

        <DrawingToolbar {...draw} />

        <VertexEditingToolbar {...vertexEdit} />

        <RouteEditingToolbar
          mode={mode}
          onRouteEditCommit={onRouteEditCommit}
          onRouteEditCancel={onRouteEditCancel}
          routeWaypoints={routeWaypoints}
          drawRouteType={drawRouteType}
          editingRouteVertices={editingRouteVertices}
          editingRoute={selectedFeature?.type === "route" ? selectedFeature : null}
        />

        <MapHintPill
          isVertexEditing={vertexEdit.isVertexEditing}
          mode={mode}
          drawVerticesCount={draw.drawVertices.length}
          polylineCount={routeWaypoints?.length ?? 0}
        />
      </div>
    );
  })
);

export default EditorMap;
