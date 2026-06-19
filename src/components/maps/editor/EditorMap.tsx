// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * EditorMap - MapLibre map component for the country map editor.
 *
 * Renders the user's country focused with:
 * - Country boundary highlight
 * - Existing cities/POIs as markers
 * - Existing subdivisions as filled polygons
 * - Click handler for placing points (city/POI modes)
 * - Polygon draw mode for subdivisions
 * - Vertex editing mode for existing subdivision polygons
 */

import {
  useRef,
  useEffect,
  // eslint-disable-next-line unused-imports/no-unused-imports
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  memo,
} from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import { MAP_DEFAULTS, buildBaseStyle } from "~/lib/map-config";
import type { MapTheme } from "~/lib/map-styles/registry";

// Hooks & Sub-components
import { useMapLayers } from "./hooks/useMapLayers";
import { useSubdivisionDraw } from "./hooks/useSubdivisionDraw";
import { useSubdivisionVertexEdit } from "./hooks/useSubdivisionVertexEdit";
import { useRouteEdit } from "./hooks/useRouteEdit";
import { usePointDrag } from "./hooks/usePointDrag";

import { DrawingToolbar } from "./toolbars/DrawingToolbar";
import { VertexEditingToolbar } from "./toolbars/VertexEditingToolbar";
import { RouteEditingToolbar } from "./toolbars/RouteEditingToolbar";
import { MapHintPill } from "./toolbars/MapHintPill";

import { getFeatureCoords } from "./utils/map-helpers";

type MapLibreMap = import("maplibre-gl").Map;

export interface EditorMapRef {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  getMap: () => MapLibreMap | null;
}

interface EditorMapProps {
  /** Country boundary GeoJSON geometry */
  countryGeometry: object | null;
  /** Country centroid for initial view */
  countryCentroid: { lng: number; lat: number } | null;
  /** Country bounding box */
  countryBbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  /** Country fill color */
  countryColor?: string;
  /** Existing features to render */
  features: EditorFeature[];
  /** Currently active editing mode */
  mode: EditorMode;
  /** Pending click coordinate (shown as marker preview) */
  pendingCoordinates: [number, number] | null;
  /** Called when user clicks on the map */
  onMapClick: (lng: number, lat: number) => void;
  /** Called when user finishes drawing a polygon */
  onDrawComplete: (geometry: object) => void;
  /** Selected feature to highlight */
  selectedFeature: EditorFeature | null;
  /** Called when user hovers/clicks a feature on the map */
  onFeatureSelect?: (feature: EditorFeature | null) => void;
  /** Called when user finishes editing polygon vertices */
  onGeometryUpdate?: (featureId: string, geometry: object) => void;
  /** Background map layers (world map context) */
  worldMapLayers?: import("~/components/maps/core/IxWorldMap").MapLayerData[];
  /** Visible layer types in the editor context */
  editorVisibleLayers?: Set<string>;
  /** Show coordinate grid lines */
  showGrid?: boolean;
  /** Called when map zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** In-progress route waypoints for visual rendering */
  routeWaypoints?: [number, number][];
  /** Layer visibility state — controls which feature types are rendered */
  layerVisibility?: Record<string, boolean>;
  /** Layer opacity state — controls opacity of lines, labels, etc. */
  layerOpacity?: Record<string, number>;
  /** Route editing details */
  editingRouteId?: string | null;
  /** Route editing vertices */
  editingRouteVertices?: [number, number][];
  onRouteVerticesUpdate?: (vertices: [number, number][]) => void;
  onRouteEditCommit?: () => void;
  onRouteEditCancel?: () => void;
  /** Theme for the map styling */
  theme?: MapTheme;
  updatePointCoordinates?: (
    featureId: string,
    featureType: "city" | "poi" | "storyPin" | "mapLabel",
    coordinates: [number, number]
  ) => Promise<void>;
  isPickingLocation?: boolean;
  onFeatureContextMenu?: (feature: EditorFeature, screenPos: { x: number; y: number }) => void;
  gapFeatures?: any | null;
  showGaps?: boolean;
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
      worldMapLayers,
      editorVisibleLayers,
      showGrid,
      onZoomChange,
      routeWaypoints,
      layerVisibility,
      layerOpacity,
      editingRouteId,
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
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const modeRef = useRef(mode);
    modeRef.current = mode;
    const featuresRef = useRef(features);
    featuresRef.current = features;
    const onFeatureSelectRef = useRef(onFeatureSelect);
    onFeatureSelectRef.current = onFeatureSelect;
    const onFeatureContextMenuRef = useRef(onFeatureContextMenu);
    onFeatureContextMenuRef.current = onFeatureContextMenu;
    const onMapClickRef = useRef(onMapClick);
    onMapClickRef.current = onMapClick;
    const isPickingLocationRef = useRef(isPickingLocation);
    isPickingLocationRef.current = isPickingLocation;

    useImperativeHandle(ref, () => ({
      flyTo: (lng: number, lat: number, zoom = 6) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1000 });
      },
      getMap: () => mapRef.current,
    }));

    // Track zoom for grid spacing updates
    const [gridZoomBucket, setGridZoomBucket] = useState(0);

    // ── 1. Hook: Manage Map Layers & Grids ──
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
    });

    // ── 2. Hook: Manage Subdivision Drawing ──
    const { drawVertices, undoLastVertex, clearDraw, saveDraw, canSaveDraw } = useSubdivisionDraw({
      map: mapRef.current,
      isLoaded,
      mode,
      features,
      countryGeometry,
      onDrawComplete,
      worldMapLayers,
      editorVisibleLayers,
    });

    // ── 3. Hook: Manage Subdivision Vertex Editing ──
    const {
      isVertexEditing,
      handleSimplifyAndSave,
      handleSave,
      finishVertexEdit,
      cancelVertexEdit,
    } = useSubdivisionVertexEdit({
      map: mapRef.current,
      isLoaded,
      mode,
      selectedFeature,
      features,
      countryGeometry,
      onGeometryUpdate,
      worldMapLayers,
      editorVisibleLayers,
    });

    // ── 4. Hook: Manage Route Path Editing & Snapping ──
    useRouteEdit({
      map: mapRef.current,
      isLoaded,
      mode,
      routeWaypoints,
      editingRouteId,
      editingRouteVertices,
      onRouteVerticesUpdate,
      onRouteEditCommit,
      onRouteEditCancel,
    });

    // ── 5. Hook: Manage Point Click-and-Drag ──
    usePointDrag({
      map: mapRef.current,
      isLoaded,
      mode,
      features,
      onFeatureSelect,
      updatePointCoordinates,
    });

    // Handle theme changes
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;
      const newStyle = buildBaseStyle(theme);

      setIsLoaded(false);
      map.setStyle(newStyle as any, { diff: true });

      const onStyleLoad = () => {
        setIsLoaded(true);
      };

      map.once("style.load", onStyleLoad);

      return () => {
        map.off("style.load", onStyleLoad);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme]);

    // Ensure map is locked to flat projection on load and style changes
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;
      if ("setProjection" in map) {
        (map as any).setProjection({ type: "mercator" });
      }
    }, [isLoaded, theme]);

    // ── Initialize map ──
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;
      let cancelled = false;

      async function initMap() {
        const mod = await import("maplibre-gl");
        const maplibregl = (
          "Map" in mod ? mod : (mod as Record<string, unknown>).default
        ) as typeof mod;

        if (cancelled || !containerRef.current) return;

        const center: [number, number] = countryCentroid
          ? [countryCentroid.lng, countryCentroid.lat]
          : MAP_DEFAULTS.center;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: buildBaseStyle(theme) as maplibregl.StyleSpecification,
          center,
          zoom: 4,
          minZoom: 1,
          maxZoom: 14,
          attributionControl: false,
          projection: { type: "mercator" } as any,
        });

        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
          "top-right"
        );

        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;
          setIsLoaded(true);
        });
      }

      initMap();

      return () => {
        cancelled = true;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fit to country bounds when loaded
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      if (countryBbox) {
        map.fitBounds(
          [
            [countryBbox.minLng, countryBbox.minLat],
            [countryBbox.maxLng, countryBbox.maxLat],
          ],
          { padding: 60, duration: 1000 }
        );
      } else if (countryCentroid) {
        map.flyTo({ center: [countryCentroid.lng, countryCentroid.lat], zoom: 5, duration: 1000 });
      }
    }, [isLoaded, countryBbox, countryCentroid]);

    // Zoom end listeners for grid bucket updates and reporting
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const updateBucket = () => {
        const z = map.getZoom();
        setGridZoomBucket(z < 4 ? 0 : z < 6 ? 1 : z < 8 ? 2 : 3);
      };
      updateBucket();
      map.on("zoomend", updateBucket);

      if (onZoomChange) {
        const reportZoom = () => onZoomChange(map.getZoom());
        map.on("zoomend", reportZoom);
        return () => {
          map.off("zoomend", updateBucket);
          map.off("zoomend", reportZoom);
        };
      }
      return () => {
        map.off("zoomend", updateBucket);
      };
    }, [isLoaded, onZoomChange]);

    // Map Cursor Mode styling
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      if (isPickingLocation) {
        map.getCanvas().style.cursor = "crosshair";
      } else if (
        mode === "view" ||
        mode === "import-provinces" ||
        mode === "edit-subdivision" ||
        mode === "edit-route"
      ) {
        map.getCanvas().style.cursor = "";
      } else {
        map.getCanvas().style.cursor = "crosshair";
      }
    }, [mode, isLoaded, isPickingLocation]);

    // Selection hover/clicks in view/paint modes
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const interactiveLayers = [
        "editor-subdivisions-fill",
        "editor-points-capital",
        "editor-points-city",
        "editor-points-poi",
        "editor-points-story-pin",
        "editor-points-map-label",
        "editor-points-labels",
        "editor-map-labels",
        "editor-gaps-fill",
      ];

      const onMouseMove = (e: any) => {
        if (isPickingLocationRef.current) {
          map.getCanvas().style.cursor = "crosshair";
          return;
        }
        const isSelectMode = modeRef.current === "view" || modeRef.current.startsWith("edit-");
        if (!isSelectMode || isVertexEditing) return;

        const hits = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
        if (hits.length > 0) {
          const firstHit = hits[0]!;
          const hitLayer = firstHit.layer.id;

          if (hitLayer.startsWith("editor-points") || hitLayer === "editor-map-labels") {
            map.getCanvas().style.cursor = "grab";
          } else if (hitLayer === "editor-gaps-fill") {
            map.getCanvas().style.cursor = "help";
          } else {
            map.getCanvas().style.cursor = "pointer";
          }

          const hitId = firstHit.properties?.id as string | undefined;
          if (map.getLayer("editor-subdivisions-hover") && hitId) {
            map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], hitId]);
          }
        } else {
          map.getCanvas().style.cursor = "";
          if (map.getLayer("editor-subdivisions-hover")) {
            map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], ""]);
          }
        }
      };

      const onMouseLeave = () => {
        if (isPickingLocationRef.current) {
          map.getCanvas().style.cursor = "crosshair";
          return;
        }
        const isSelectMode = modeRef.current === "view" || modeRef.current.startsWith("edit-");
        if (!isSelectMode || isVertexEditing) return;
        map.getCanvas().style.cursor = "";
        if (map.getLayer("editor-subdivisions-hover")) {
          map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], ""]);
        }
      };

      const onClickFeature = (e: any) => {
        if (isPickingLocationRef.current) return;
        if (e.routeClicked || e.defaultPrevented) return;
        const isSelectMode = modeRef.current === "view" || modeRef.current.startsWith("edit-");
        if (!isSelectMode || isVertexEditing) return;

        const hits = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
        if (hits.length > 0) {
          const hitId = hits[0]!.properties?.id as string | undefined;
          if (hitId && onFeatureSelectRef.current) {
            const match = featuresRef.current.find((f) => f.id === hitId);
            if (match) {
              onFeatureSelectRef.current(match);
              e.preventDefault?.();
            }
          }
        } else {
          // Clicked empty space on canvas, deselect current selection
          if (onFeatureSelectRef.current) {
            onFeatureSelectRef.current(null);
          }
        }
      };

      const onContextMenuFeature = (e: any) => {
        if (isPickingLocationRef.current) return;
        if (e.routeClicked || e.defaultPrevented) return;
        const isSelectMode = modeRef.current === "view" || modeRef.current.startsWith("edit-");
        if (!isSelectMode || isVertexEditing) return;

        const hits = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
        if (hits.length > 0) {
          const firstHit = hits[0]!;
          const hitLayer = firstHit.layer.id;

          if (hitLayer === "editor-gaps-fill") {
            if (onFeatureContextMenuRef.current) {
              e.preventDefault?.();
              if (e.originalEvent) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
              }
              const canvasRect = map.getCanvas().getBoundingClientRect();
              const virtualFeature: EditorFeature = {
                id: "gap",
                type: "gap",
                name: "Negative Space",
                coordinates: [e.lngLat.lng, e.lngLat.lat],
                geometry: firstHit.geometry,
                properties: {},
              };
              onFeatureContextMenuRef.current(virtualFeature, {
                x: canvasRect.left + e.point.x,
                y: canvasRect.top + e.point.y,
              });
            }
            return;
          }

          const hitId = firstHit.properties?.id as string | undefined;
          if (hitId && onFeatureContextMenuRef.current) {
            const match = featuresRef.current.find((f) => f.id === hitId);
            if (match) {
              e.preventDefault?.();
              if (e.originalEvent) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
              }
              const canvasRect = map.getCanvas().getBoundingClientRect();
              onFeatureContextMenuRef.current(match, {
                x: canvasRect.left + e.point.x,
                y: canvasRect.top + e.point.y,
              });
            }
          }
        }
      };

      map.on("mousemove", onMouseMove);
      map.on("mouseleave", "editor-subdivisions-fill", onMouseLeave);
      map.on("click", onClickFeature);
      map.on("contextmenu", onContextMenuFeature);

      return () => {
        map.off("mousemove", onMouseMove);
        map.off("mouseleave", "editor-subdivisions-fill", onMouseLeave);
        map.off("click", onClickFeature);
        map.off("contextmenu", onContextMenuFeature);
      };
    }, [isLoaded, isVertexEditing, theme]);

    // Handle map clicks for insertion (city, POI, story pin, labels, routes)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const onClick = (e: any) => {
        if (e.routeClicked || e.defaultPrevented) return;
        if (isVertexEditing) return;

        const currentMode = modeRef.current;

        if (
          isPickingLocationRef.current ||
          currentMode === "add-city" ||
          currentMode === "add-poi" ||
          currentMode === "add-story-pin" ||
          currentMode === "add-label"
        ) {
          onMapClickRef.current(e.lngLat.lng, e.lngLat.lat);
        } else if (currentMode === "add-route") {
          let clickPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];

          const snapLayers = ["editor-points-capital", "editor-points-city", "editor-points-poi"];
          const bbox: [[number, number], [number, number]] = [
            [e.point.x - 15, e.point.y - 15],
            [e.point.x + 15, e.point.y + 15],
          ];
          const hits = map.queryRenderedFeatures(bbox, { layers: snapLayers });
          if (hits.length > 0) {
            const coords = getFeatureCoords(hits[0]!.geometry);
            if (coords) {
              clickPoint = [coords[0], coords[1]];
            }
          }
          onMapClickRef.current(clickPoint[0], clickPoint[1]);
        }
      };

      map.on("click", onClick);

      return () => {
        map.off("click", onClick);
      };
    }, [isLoaded, isVertexEditing]);

    // Highlight selected feature
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      if (map.getLayer("editor-subdivisions-hover")) {
        if (selectedFeature && selectedFeature.geometry) {
          map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], selectedFeature.id]);
        } else if (!selectedFeature) {
          map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], ""]);
        }
      }
    }, [isLoaded, selectedFeature]);

    return (
      <div className="relative h-full w-full" style={{ minHeight: 400 }}>
        <div
          ref={containerRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {!isLoaded && (
          <div className="bg-muted absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500" />
              <p className="text-muted-foreground text-sm">Loading map editor...</p>
            </div>
          </div>
        )}

        {/* Floating subdivision drawing toolbar */}
        <DrawingToolbar
          drawVertices={drawVertices}
          undoLastVertex={undoLastVertex}
          clearDraw={clearDraw}
          saveDraw={saveDraw}
          canSaveDraw={canSaveDraw}
        />

        {/* Subdivision vertex editing controls */}
        <VertexEditingToolbar
          isVertexEditing={isVertexEditing}
          handleSimplifyAndSave={handleSimplifyAndSave}
          handleSave={handleSave}
          finishVertexEdit={finishVertexEdit}
          cancelVertexEdit={cancelVertexEdit}
        />

        {/* Route path editing controls */}
        <RouteEditingToolbar
          mode={mode}
          onRouteEditCommit={onRouteEditCommit}
          onRouteEditCancel={onRouteEditCancel}
        />

        {/* Floating mode hint pill */}
        <MapHintPill
          isVertexEditing={isVertexEditing}
          mode={mode}
          drawVerticesCount={drawVertices.length}
        />
      </div>
    );
  })
);

export default EditorMap;
