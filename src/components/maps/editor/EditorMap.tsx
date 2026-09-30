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
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  memo,
} from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import type { Polygon, MultiPolygon, Geometry, FeatureCollection } from "geojson";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import type { MapEditorEvent } from "~/components/maps/editor/plugins/types";
import { MAP_DEFAULTS, buildBaseStyle } from "~/lib/maps/map-config";
import type { MapTheme } from "~/lib/map-styles/registry";
import { acquireSurface } from "~/lib/maps/map-engine";

// Hooks & Sub-components
import { useMapLayers } from "./hooks/useMapLayers";
import { useSubdivisionDraw } from "./hooks/useSubdivisionDraw";
import { useSubdivisionVertexEdit } from "./hooks/useSubdivisionVertexEdit";
import { useRouteEdit } from "./hooks/useRouteEdit";
import { usePointDrag } from "./hooks/usePointDrag";

import { useMapEditorContext } from "~/components/maps/editor/plugins/context";
import { getPlugins } from "~/components/maps/editor/plugins/registry";

import { DrawingToolbar } from "./toolbars/DrawingToolbar";
import { VertexEditingToolbar } from "./toolbars/VertexEditingToolbar";
import { RouteEditingToolbar } from "./toolbars/RouteEditingToolbar";
import { MapHintPill } from "./toolbars/MapHintPill";

import { getFeatureCoords } from "./utils/map-helpers";
import { transientMapStore } from "./utils/transientStore";
import { hitTestFeatures } from "./utils/hit-test";
import { EditorRulers } from "./components/EditorRulers";

type EditorMouseEvent = MapLayerMouseEvent & { routeClicked?: boolean };
type MapFilterSpec = Parameters<MapLibreMap["setFilter"]>[1];

export interface EditorMapRef {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  getMap: () => MapLibreMap | null;
}

const INTERACTIVE_LAYERS = [
  "editor-subdivisions-fill",
  "editor-lines",
  "editor-points-capital",
  "editor-points-city",
  "editor-points-poi",
  "editor-points-peak",
  "editor-points-story-pin",
  "editor-points-map-label",
  "editor-points-labels",
  "editor-map-labels",
  "editor-gaps-fill",
] as const;

interface EditorMapProps {
  /** Country boundary GeoJSON geometry */
  countryGeometry: Polygon | MultiPolygon | null;
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
  /** Called when user saves edited polygon vertices (with any topology-cascaded neighbours) */
  onGeometryUpdate?: (
    featureId: string,
    geometry: object,
    cascaded?: Array<{ id: string; geometry: object }>
  ) => void;
  /** Reports unsaved vertex edits so the editor can warn before leaving */
  onVertexEditDirtyChange?: (dirty: boolean) => void;
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
  /** Route type picked for the in-progress route (live travel estimate) */
  drawRouteType?: string;
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
  /** Rectangular marquee selection from screen-space bounds (Plan 120 P3). */
  onApplyRectSelection?: (
    bounds: { west: number; south: number; east: number; north: number },
    mode?: "replace" | "add" | "subtract"
  ) => void;
  /** Locked feature-layer keys (from LayerPanel). Locked layers are not selectable. */
  lockedLayers?: Record<string, boolean>;
  /** Multi-select set for Shift/Alt click handling. */
  selectedIds?: Set<string>;
  /** Toggle a feature in/out of the multi-select (Shift+click). */
  onToggleSelect?: (id: string) => void;
  /** Lasso tool style: freehand loop vs rectangular marquee (Plan 120 P3). */
  lassoTool?: "freehand" | "rect";
  guides?: { id: string; type: "h" | "v"; value: number }[];
  setGuides?: React.Dispatch<
    React.SetStateAction<{ id: string; type: "h" | "v"; value: number }[]>
  >;
  showGuides?: boolean;
  snapEnabled?: boolean;
  snapTolerance?: number;
  /** Called when the underlying MapLibre instance is ready or destroyed */
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
        const plugins = getPlugins();
        for (const plugin of plugins) {
          if (plugin.snapPoint && (snapEnabled ?? context.state.snapEnabled)) {
            snapped = plugin.snapPoint(snapped, context);
          }
        }
        return snapped;
      },
      [context, snapEnabled]
    );

    const routePluginEvent = useCallback(
      (eventName: string, e: MapEditorEvent) => {
        const activeMode = modeRef.current;
        const plugins = getPlugins();
        for (const plugin of plugins) {
          const isTargetMode = plugin.global || (plugin.modes && plugin.modes.includes(activeMode));
          if (isTargetMode && plugin.mapEvents?.[eventName]) {
            plugin.mapEvents[eventName](e, context);
          }
        }
      },
      [context]
    );

    const [spacebarPanActive, setSpacebarPanActive] = useState(false);
    const spacebarPanActiveRef = useRef(false);
    spacebarPanActiveRef.current = spacebarPanActive;

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === "Space" || e.key === " ") {
          const activeEl = document.activeElement;
          const inInput =
            activeEl &&
            (activeEl.tagName === "INPUT" ||
              activeEl.tagName === "TEXTAREA" ||
              activeEl.tagName === "SELECT" ||
              activeEl.getAttribute("contenteditable") === "true");
          if (!inInput) {
            e.preventDefault();
            if (!spacebarPanActiveRef.current) {
              setSpacebarPanActive(true);
              const map = mapRef.current;
              if (map) {
                map.getCanvas().style.cursor = "grab";
              }
            }
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === "Space" || e.key === " ") {
          if (spacebarPanActiveRef.current) {
            setSpacebarPanActive(false);
            const map = mapRef.current;
            if (map) {
              map.getCanvas().style.cursor = "";
            }
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const handleDragStart = () => {
        if (spacebarPanActiveRef.current) {
          map.getCanvas().style.cursor = "grabbing";
        }
      };

      const handleDragEnd = () => {
        if (spacebarPanActiveRef.current) {
          map.getCanvas().style.cursor = "grab";
        }
      };

      map.on("dragstart", handleDragStart);
      map.on("dragend", handleDragEnd);
      return () => {
        map.off("dragstart", handleDragStart);
        map.off("dragend", handleDragEnd);
      };
    }, [isLoaded]);

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
    const onToggleSelectRef = useRef(onToggleSelect);
    onToggleSelectRef.current = onToggleSelect;
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;
    const lockedLayersRef = useRef(lockedLayers);
    lockedLayersRef.current = lockedLayers;
    /** Pointer-down position for click-vs-drag discrimination (Plan 120 P2). */
    const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
    /** True when the last gesture was a drag (>4px) — used to suppress post-drag clicks. */
    const wasDragRef = useRef(false);
    /** Last hovered feature id, to avoid redundant setFilter/setFeatureState (Plan 120 P7). */
    const lastHoveredIdRef = useRef<string | null>(null);
    /** Cached interactive-layer list excluding locked layers (Plan 120 P1/P5). */
    const interactiveLayersRef = useRef<string[]>([...INTERACTIVE_LAYERS]);
    interactiveLayersRef.current = [...INTERACTIVE_LAYERS];
    const lassoToolRef = useRef(lassoTool);
    lassoToolRef.current = lassoTool;

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
      emptyRegionsFeatures,
      showEmptyRegions,
      lassoGeometry,
      rulerPoints,
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
      guides,
      snapEnabled,
      snapTolerance,
      snapPoint,
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
      onDirtyChange: onVertexEditDirtyChange,
      worldMapLayers,
      editorVisibleLayers,
      snapEnabled,
      snapTolerance,
      snapPoint,
    });

    // ── 4. Hook: Manage Route Path Editing & Snapping ──
    useRouteEdit({
      map: mapRef.current,
      isLoaded,
      mode,
      routeWaypoints,
      editingRouteVertices,
      onRouteVerticesUpdate,
    });

    // ── 5. Hook: Manage Point Click-and-Drag ──
    usePointDrag({
      map: mapRef.current,
      isLoaded,
      mode,
      features,
      selectedFeature,
      onFeatureSelect,
      updatePointCoordinates,
    });

    // Handle theme changes
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;
      const newStyle = buildBaseStyle(theme);

      setIsLoaded(false);
      map.setStyle(newStyle as StyleSpecification, { diff: true });

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
      const mapWithProj = map as MapLibreMap & {
        setProjection?: (spec: { type: string }) => void;
      };
      if ("setProjection" in map && mapWithProj.setProjection) {
        mapWithProj.setProjection({ type: "mercator" });
      }
    }, [isLoaded, theme]);

    // ── Borrow the persistent "editor" instance (kept warm across navigation) ──
    useEffect(() => {
      if (!containerRef.current) return;

      const center: [number, number] = countryCentroid
        ? [countryCentroid.lng, countryCentroid.lat]
        : MAP_DEFAULTS.center;

      const handle = acquireSurface("editor", {
        container: containerRef.current,
        initialCenter: center,
        initialZoom: 4,
        theme,
        projectionMode: "mercator",
        interactive: true,
        onCreate: (map, maplibregl) => {
          map.addControl(
            new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
            "top-right"
          );
        },
        onReady: (map) => {
          mapRef.current = map;
          // Style is loaded here (engine resolves ready post style.load), so this is safe.
          const mapWithProj = map as MapLibreMap & {
            setProjection?: (spec: { type: string }) => void;
          };
          if ("setProjection" in map && mapWithProj.setProjection) {
            mapWithProj.setProjection({ type: "mercator" });
          }
          setIsLoaded(true);
          context.setMap(map);
          onMapReady?.(map);
        },
      });

      handle.ready.catch((err) => {
        console.error("[EditorMap] init error:", err);
      });

      return () => {
        onMapReady?.(null);
        handle.release();
        mapRef.current = null;
        context.setMap(null);
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

    // Clear subdivision hover highlight when entering tool modes
    useEffect(() => {
      if (mode !== "view" && mode !== "paint") {
        const map = mapRef.current;
        if (map && map.getLayer("editor-subdivisions-hover")) {
          map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], ""]);
        }
        lastHoveredIdRef.current = null;
        transientMapStore.setHoveredFeatureId(null);
      }
    }, [mode]);

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

      const getExcludedLayers = () => {
        const locked = lockedLayersRef.current ?? {};
        const out: string[] = [];
        const addIf = (key: string, layers: string[]) => {
          if (locked[key]) out.push(...layers);
        };
        addIf("regions", ["editor-subdivisions-fill", "editor-gaps-fill"]);
        addIf("geography", ["editor-points-peak", "editor-lines"]);
        addIf("cities", ["editor-points-capital", "editor-points-city"]);
        addIf("pois", ["editor-points-poi"]);
        addIf("stories", ["editor-points-story-pin"]);
        addIf("labels", ["editor-points-map-label", "editor-map-labels"]);
        return out;
      };

      // Hover hit-testing (queryRenderedFeatures) runs at most once per animation frame.
      let hoverFrame: number | null = null;
      let lastMove: MapLayerMouseEvent | null = null;

      const processHover = () => {
        hoverFrame = null;
        const e = lastMove;
        if (!e) return;

        if (spacebarPanActiveRef.current) {
          map.getCanvas().style.cursor = "grab";
          return;
        }
        if (isPickingLocationRef.current) {
          map.getCanvas().style.cursor = "crosshair";
          return;
        }
        if (isVertexEditing) return;

        // Suppress region hit-testing and hover highlight when tool modes are active
        const currentMode = modeRef.current;
        if (currentMode !== "view" && currentMode !== "paint") {
          if (lastHoveredIdRef.current !== null) {
            lastHoveredIdRef.current = null;
            if (map.getLayer("editor-subdivisions-hover")) {
              map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], ""]);
            }
          }
          transientMapStore.setHoveredFeatureId(null);
          return;
        }

        const { hit, locked } = hitTestFeatures(map, e.point, {
          layers: interactiveLayersRef.current,
          excludeLayers: getExcludedLayers(),
        });

        const hitId = hit?.featureId ?? null;

        if (hitId !== lastHoveredIdRef.current) {
          lastHoveredIdRef.current = hitId;
          if (map.getLayer("editor-subdivisions-hover")) {
            map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], hitId ?? ""]);
          }
        }

        if (locked) {
          map.getCanvas().style.cursor = "not-allowed";
        } else if (hit) {
          const layerId = hit.layerId;
          if (layerId.startsWith("editor-points") || layerId === "editor-map-labels") {
            map.getCanvas().style.cursor = "grab";
          } else if (layerId === "editor-gaps-fill") {
            map.getCanvas().style.cursor = "help";
          } else {
            map.getCanvas().style.cursor = "pointer";
          }
        } else {
          map.getCanvas().style.cursor = "";
        }

        transientMapStore.setHoveredFeatureId(hitId);
      };

      const onMouseMove = (e: MapLayerMouseEvent) => {
        routePluginEvent("onMouseMove", e);
        if (e.defaultPrevented) return;
        // Cheap: the store batches listener notifications per frame.
        transientMapStore.setCursorCoords([e.lngLat.lng, e.lngLat.lat], {
          x: e.point.x,
          y: e.point.y,
        });
        lastMove = e;
        if (hoverFrame === null) hoverFrame = requestAnimationFrame(processHover);
      };

      const onMouseLeave = () => {
        transientMapStore.setHoveredFeatureId(null);
        transientMapStore.setCursorCoords(null);
        lastHoveredIdRef.current = null;
        if (isPickingLocationRef.current) {
          map.getCanvas().style.cursor = "crosshair";
          return;
        }
        if (isVertexEditing) return;
        map.getCanvas().style.cursor = "";
        if (map.getLayer("editor-subdivisions-hover")) {
          map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], ""]);
        }
      };

      const onClickFeature = (e: EditorMouseEvent) => {
        routePluginEvent("onClick", e);
        if (e.defaultPrevented) return;

        if (spacebarPanActiveRef.current) return;
        if (isPickingLocationRef.current) return;
        if (
          e.routeClicked ||
          (e.originalEvent as MouseEvent & { routeClicked?: boolean })?.routeClicked
        )
          return;
        // Post-drag clicks (map pan / feature drag) must not select (Plan 120 P2).
        if (wasDragRef.current) return;

        const currentMode = modeRef.current;

        // Skip selection in all drawing and placement modes
        if (
          currentMode === "add-city" ||
          currentMode === "add-poi" ||
          currentMode === "add-peak" ||
          currentMode === "add-river" ||
          currentMode === "add-lake" ||
          currentMode === "add-subdivision" ||
          currentMode === "add-route" ||
          currentMode === "split-subdivision"
        ) {
          return;
        }

        const { hit, locked } = hitTestFeatures(map, e.point, {
          layers: interactiveLayersRef.current,
          excludeLayers: getExcludedLayers(),
        });

        if (hit && !locked) {
          const hitId = hit.featureId;
          if (hitId) {
            const match = featuresRef.current.find((f) => f.id === hitId);
            if (match) {
              e.preventDefault?.();
              if (e.originalEvent) {
                e.originalEvent.preventDefault();
              }
              // Shift/Alt click multi-select (Plan 120 P7)
              const isShift = !!e.originalEvent?.shiftKey;
              const isAlt = !!e.originalEvent?.altKey;
              if (isShift || isAlt) {
                if (onToggleSelectRef.current) {
                  onToggleSelectRef.current(match.id);
                }
                return;
              }
              if (onFeatureSelectRef.current) {
                onFeatureSelectRef.current(match);
              }
            }
          }
        } else {
          // Clicked empty space on canvas (or locked feature), deselect only if in select/edit modes
          const isSelectMode = currentMode === "view" || currentMode.startsWith("edit-");
          if (isSelectMode && onFeatureSelectRef.current) {
            onFeatureSelectRef.current(null);
          }
        }
      };

      const onContextMenuFeature = (e: EditorMouseEvent) => {
        routePluginEvent("onContextMenu", e);
        if (e.defaultPrevented) return;

        if (isPickingLocationRef.current) return;
        if (
          e.routeClicked ||
          (e.originalEvent as MouseEvent & { routeClicked?: boolean })?.routeClicked
        )
          return;
        if (isVertexEditing) return;
        if (wasDragRef.current) return;

        const currentMode = modeRef.current;

        // Skip selection/context menus in all drawing and placement modes
        if (
          currentMode === "add-city" ||
          currentMode === "add-poi" ||
          currentMode === "add-peak" ||
          currentMode === "add-river" ||
          currentMode === "add-lake" ||
          currentMode === "add-subdivision" ||
          currentMode === "add-route" ||
          currentMode === "split-subdivision"
        ) {
          return;
        }

        const { hit, locked } = hitTestFeatures(map, e.point, {
          layers: interactiveLayersRef.current,
          excludeLayers: getExcludedLayers(),
        });

        if (hit && !locked) {
          const hitLayer = hit.layerId;

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
                geometry: hit.feature.geometry,
                properties: {},
              };
              onFeatureContextMenuRef.current(virtualFeature, {
                x: canvasRect.left + e.point.x,
                y: canvasRect.top + e.point.y,
              });
            }
            return;
          }

          const hitId = hit.featureId;
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

      const onMouseDown = (e: MapLayerMouseEvent) => {
        pointerDownPosRef.current = { x: e.point.x, y: e.point.y };
        wasDragRef.current = false;
        routePluginEvent("onMouseDown", e);
      };

      const onMouseUp = (e: MapLayerMouseEvent) => {
        const down = pointerDownPosRef.current;
        if (down && e.point) {
          const dist = Math.hypot(e.point.x - down.x, e.point.y - down.y);
          wasDragRef.current = dist > 4;
        }
        routePluginEvent("onMouseUp", e);
      };

      const onDoubleClick = (e: MapLayerMouseEvent) => {
        routePluginEvent("onDoubleClick", e);
      };

      map.on("mousemove", onMouseMove);
      map.on("mouseleave", "editor-subdivisions-fill", onMouseLeave);
      map.on("click", onClickFeature);
      map.on("contextmenu", onContextMenuFeature);
      map.on("mousedown", onMouseDown);
      map.on("mouseup", onMouseUp);
      map.on("dblclick", onDoubleClick);

      const onCanvasLeave = () => {
        lastMove = null;
        transientMapStore.setCursorCoords(null);
        transientMapStore.setHoveredFeatureId(null);
      };
      map.getCanvasContainer().addEventListener("mouseleave", onCanvasLeave);

      return () => {
        if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
        map.getCanvasContainer().removeEventListener("mouseleave", onCanvasLeave);
        map.off("mousemove", onMouseMove);
        map.off("mouseleave", "editor-subdivisions-fill", onMouseLeave);
        map.off("click", onClickFeature);
        map.off("contextmenu", onContextMenuFeature);
        map.off("mousedown", onMouseDown);
        map.off("mouseup", onMouseUp);
        map.off("dblclick", onDoubleClick);
      };
    }, [isLoaded, isVertexEditing, theme, routePluginEvent]);

    // Handle map clicks for insertion (city, POI, story pin, labels, routes)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const onClick = (e: EditorMouseEvent) => {
        routePluginEvent("onClick", e);
        if (e.defaultPrevented) return;

        if (spacebarPanActiveRef.current) return;
        if (
          e.routeClicked ||
          (e.originalEvent as MouseEvent & { routeClicked?: boolean })?.routeClicked
        )
          return;
        if (isVertexEditing) return;
        // Post-drag clicks (map pan) must not place/insert anything (Plan 120 P2).
        if (wasDragRef.current) return;

        const currentMode = modeRef.current;

        if (
          currentMode === "add-city" ||
          currentMode === "add-poi" ||
          currentMode === "add-peak" ||
          currentMode === "split-subdivision"
        ) {
          const snapped = snapPoint([e.lngLat.lng, e.lngLat.lat]);
          onMapClickRef.current(snapped[0], snapped[1]);
        } else if (currentMode === "ruler") {
          if (onAddRulerPoint) {
            const snapped = snapPoint([e.lngLat.lng, e.lngLat.lat]);
            onAddRulerPoint(snapped);
          }
        } else if (currentMode === "add-route" || currentMode === "add-river") {
          let clickPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];

          const snapLayers = ["editor-points-capital", "editor-points-city", "editor-points-poi"];
          const bbox: [[number, number], [number, number]] = [
            [e.point.x - 15, e.point.y - 15],
            [e.point.x + 15, e.point.y + 15],
          ];
          const hits = map.queryRenderedFeatures(bbox, { layers: snapLayers });
          let didGeometrySnap = false;
          if (hits.length > 0) {
            const coords = getFeatureCoords(hits[0]!.geometry);
            if (coords) {
              clickPoint = [coords[0], coords[1]];
              didGeometrySnap = true;
            }
          }
          if (!didGeometrySnap) {
            clickPoint = snapPoint(clickPoint);
          }
          onMapClickRef.current(clickPoint[0], clickPoint[1]);
        }
      };

      map.on("click", onClick);

      return () => {
        map.off("click", onClick);
      };
    }, [isLoaded, isVertexEditing, onAddRulerPoint, snapPoint, routePluginEvent]);

    // Handle Lasso / Rect marquee click-and-drag selection (Plan 120 P3)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      let isDrawing = false;
      let isRect = false;
      let startLngLat: [number, number] | null = null;
      let startPoint: { x: number; y: number } | null = null;
      let mode: "replace" | "add" | "subtract" = "replace";
      let pts: [number, number][] = [];

      const onMouseDown = (e: MapLayerMouseEvent) => {
        if (spacebarPanActiveRef.current) return;
        const currentMode = modeRef.current;
        const isShift = !!e.originalEvent?.shiftKey;
        const isAlt = !!e.originalEvent?.altKey;

        // Rect marquee: Shift+drag in view mode, or rect tool in lasso-select
        if (currentMode === "view") {
          if (!isShift) return;
          isRect = true;
          mode = isAlt ? "subtract" : "add";
        } else if (currentMode === "lasso-select") {
          isRect = lassoToolRef.current === "rect";
          mode = isShift ? "add" : isAlt ? "subtract" : "replace";
        } else {
          return;
        }

        // Prevent map panning
        e.preventDefault();
        map.dragPan.disable();

        isDrawing = true;
        startLngLat = [e.lngLat.lng, e.lngLat.lat];
        startPoint = { x: e.point.x, y: e.point.y };
        pts = [];
      };

      const buildRectGeometry = (curLngLat: [number, number]): Polygon | null => {
        if (!startLngLat) return null;
        const [slng, slat] = startLngLat;
        const [clng, clat] = curLngLat;
        return {
          type: "Polygon",
          coordinates: [
            [
              [slng, slat],
              [clng, slat],
              [clng, clat],
              [slng, clat],
              [slng, slat],
            ],
          ],
        };
      };

      // The marquee is drawn straight into its GeoJSON source once per frame —
      // no React state per pointer move.
      let lassoFrame: number | null = null;
      let pendingLasso: Polygon | null = null;
      const drawLasso = () => {
        lassoFrame = null;
        const src = map.getSource("editor-lasso") as { setData?: (d: unknown) => void } | undefined;
        src?.setData?.(
          pendingLasso
            ? { type: "Feature", geometry: pendingLasso, properties: {} }
            : { type: "FeatureCollection", features: [] }
        );
      };
      const scheduleLasso = (geom: Polygon | null) => {
        pendingLasso = geom;
        if (lassoFrame === null) lassoFrame = requestAnimationFrame(drawLasso);
      };

      const onMouseMove = (e: MapLayerMouseEvent) => {
        if (!isDrawing) return;

        if (isRect) {
          scheduleLasso(buildRectGeometry([e.lngLat.lng, e.lngLat.lat]));
          return;
        }

        const last = pts[pts.length - 1];
        // Skip sub-pixel jitter so long freehand loops stay light.
        if (
          last &&
          Math.abs(last[0] - e.lngLat.lng) < 1e-6 &&
          Math.abs(last[1] - e.lngLat.lat) < 1e-6
        ) {
          return;
        }
        pts.push([e.lngLat.lng, e.lngLat.lat]);
        if (pts.length >= 2) {
          scheduleLasso({ type: "Polygon", coordinates: [[...pts, pts[0]!]] });
        }
      };

      const onMouseUp = (e: MapLayerMouseEvent) => {
        if (!isDrawing) return;
        isDrawing = false;
        map.dragPan.enable();

        const endPoint = e.point ? { x: e.point.x, y: e.point.y } : null;
        const dragged =
          startPoint && endPoint
            ? Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y) > 4
            : false;

        if (isRect) {
          if (dragged && startLngLat) {
            const endLngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
            const bounds = {
              west: Math.min(startLngLat[0], endLngLat[0]),
              south: Math.min(startLngLat[1], endLngLat[1]),
              east: Math.max(startLngLat[0], endLngLat[0]),
              north: Math.max(startLngLat[1], endLngLat[1]),
            };
            onApplyRectSelection?.(bounds, mode);
          }
        } else if (pts.length >= 3 && onApplyLassoSelection) {
          onApplyLassoSelection(pts, mode);
        }
        scheduleLasso(null);
        setLassoGeometry?.(null);
      };

      map.on("mousedown", onMouseDown);
      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);

      return () => {
        if (lassoFrame !== null) cancelAnimationFrame(lassoFrame);
        map.off("mousedown", onMouseDown);
        map.off("mousemove", onMouseMove);
        map.off("mouseup", onMouseUp);
      };
    }, [isLoaded, onApplyLassoSelection, onApplyRectSelection, setLassoGeometry]);

    // Highlight selected features (subdivisions + points) — Plan 120 P6
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const ids = selectedIdsRef.current;
      const idList = ids && ids.size > 0 ? Array.from(ids) : [];
      const noneFilter = ["==", ["get", "id"], ""];

      // Single subdivision selection (existing hover-highlight style)
      if (map.getLayer("editor-subdivisions-hover")) {
        const single = selectedFeature && selectedFeature.geometry ? selectedFeature.id : "";
        map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], single]);
      }

      // Multi-selection subdivisions outline
      if (map.getLayer("editor-subdivisions-selected")) {
        map.setFilter(
          "editor-subdivisions-selected",
          idList.length > 0
            ? (["in", ["get", "id"], ["literal", idList]] as MapFilterSpec)
            : (noneFilter as MapFilterSpec)
        );
      }

      // Multi-selection point halo
      if (map.getLayer("editor-points-selected")) {
        map.setFilter(
          "editor-points-selected",
          idList.length > 0
            ? (["in", ["get", "id"], ["literal", idList]] as MapFilterSpec)
            : (noneFilter as MapFilterSpec)
        );
      }
    }, [isLoaded, selectedFeature, selectedIds]);

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
          <div className="bg-muted absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500" />
              <p className="text-muted-foreground text-sm">Loading map editor...</p>
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
          routeWaypoints={routeWaypoints}
          drawRouteType={drawRouteType}
          editingRouteVertices={editingRouteVertices}
          editingRoute={selectedFeature?.type === "route" ? selectedFeature : null}
        />

        {/* Floating mode hint pill */}
        <MapHintPill
          isVertexEditing={isVertexEditing}
          mode={mode}
          drawVerticesCount={drawVertices.length}
          polylineCount={routeWaypoints?.length ?? 0}
        />
      </div>
    );
  })
);

export default EditorMap;
