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

import { useMapEditorContext } from "~/components/maps/editor/plugins/context";
import { getPlugins } from "~/components/maps/editor/plugins/registry";

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
  emptyRegionsFeatures?: any | null;
  showEmptyRegions?: boolean;
  rulerPoints?: [number, number][];
  lassoGeometry?: any;
  setLassoGeometry?: (geom: any) => void;
  onAddRulerPoint?: (coords: [number, number]) => void;
  onApplyLassoSelection?: (coords: [number, number][]) => void;
  onApplyPaintFill?: (subdivisionId: string) => void;
  onApplyEyedropper?: (feature: any) => void;
  onApplyMagicWand?: (feature: any, isShift: boolean, isAlt: boolean) => void;
  guides?: { id: string; type: "h" | "v"; value: number }[];
  setGuides?: React.Dispatch<
    React.SetStateAction<{ id: string; type: "h" | "v"; value: number }[]>
  >;
  showGuides?: boolean;
  snapEnabled?: boolean;
  snapTolerance?: number;
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
      emptyRegionsFeatures,
      showEmptyRegions,
      rulerPoints,
      lassoGeometry,
      setLassoGeometry,
      onAddRulerPoint,
      onApplyLassoSelection,
      onApplyPaintFill,
      onApplyEyedropper,
      onApplyMagicWand,
      guides = [],
      setGuides,
      showGuides = true,
      snapEnabled = true,
      snapTolerance = 10,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [mapStateRev, setMapStateRev] = useState(0);
    const [activeDragGuide, setActiveDragGuide] = useState<{
      type: "h" | "v";
      currentVal: number;
      screenPos: number;
    } | null>(null);

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
      (eventName: string, e: any) => {
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

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const onMapChange = () => {
        setMapStateRev((prev) => prev + 1);
      };
      map.on("zoom", onMapChange);
      map.on("move", onMapChange);
      map.on("resize", onMapChange);
      return () => {
        map.off("zoom", onMapChange);
        map.off("move", onMapChange);
        map.off("resize", onMapChange);
      };
    }, [isLoaded]);

    useEffect(() => {
      if (!activeDragGuide) return;

      const handleMouseMove = (e: MouseEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || !mapRef.current) return;

        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

        if (activeDragGuide.type === "h") {
          const lat = mapRef.current.unproject([x, y]).lat;
          setActiveDragGuide({
            type: "h",
            currentVal: lat,
            screenPos: y,
          });
        } else {
          const lng = mapRef.current.unproject([x, y]).lng;
          setActiveDragGuide({
            type: "v",
            currentVal: lng,
            screenPos: x,
          });
        }
      };

      const handleMouseUp = () => {
        if (setGuides) {
          const newGuide = {
            id: `guide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: activeDragGuide.type,
            value: activeDragGuide.currentVal,
          };
          setGuides((prev) => [...prev, newGuide]);
        }
        setActiveDragGuide(null);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }, [activeDragGuide, setGuides]);

    const handleTopRulerMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !mapRef.current) return;
      const y = e.clientY - rect.top;
      const lat = mapRef.current.unproject([e.clientX - rect.left, y]).lat;
      setActiveDragGuide({
        type: "h",
        currentVal: lat,
        screenPos: y,
      });
    };

    const handleLeftRulerMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !mapRef.current) return;
      const x = e.clientX - rect.left;
      const lng = mapRef.current.unproject([x, e.clientY - rect.top]).lng;
      setActiveDragGuide({
        type: "v",
        currentVal: lng,
        screenPos: x,
      });
    };

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
    const onApplyEyedropperRef = useRef(onApplyEyedropper);
    onApplyEyedropperRef.current = onApplyEyedropper;
    const onApplyMagicWandRef = useRef(onApplyMagicWand);
    onApplyMagicWandRef.current = onApplyMagicWand;

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
      worldMapLayers,
      editorVisibleLayers,
      guides,
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
          context.setMap(map);
        });
      }

      initMap();

      return () => {
        cancelled = true;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
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
        routePluginEvent("onMouseMove", e);
        if (e.defaultPrevented) return;

        if (modeRef.current === "pan") {
          map.getCanvas().style.cursor = "grab";
          return;
        }
        if (spacebarPanActiveRef.current) {
          map.getCanvas().style.cursor = "grab";
          return;
        }
        if (isPickingLocationRef.current) {
          map.getCanvas().style.cursor = "crosshair";
          return;
        }
        if (isVertexEditing) return;

        const hoverBbox = [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ] as [import("maplibre-gl").PointLike, import("maplibre-gl").PointLike];
        const hits = map.queryRenderedFeatures(hoverBbox, { layers: interactiveLayers });

        const sortedHits = [...hits].sort((a, b) => {
          const aId = a.layer.id;
          const bId = b.layer.id;
          const isPointA = aId.startsWith("editor-points-") || aId === "editor-map-labels";
          const isPointB = bId.startsWith("editor-points-") || bId === "editor-map-labels";
          if (isPointA && !isPointB) return -1;
          if (!isPointA && isPointB) return 1;
          return 0;
        });

        if (sortedHits.length > 0) {
          const firstHit = sortedHits[0]!;
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
        if (isVertexEditing) return;
        map.getCanvas().style.cursor = "";
        if (map.getLayer("editor-subdivisions-hover")) {
          map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], ""]);
        }
      };

      const onClickFeature = (e: any) => {
        routePluginEvent("onClick", e);
        if (e.defaultPrevented) return;

        if (spacebarPanActiveRef.current) return;
        if (isPickingLocationRef.current) return;
        if (e.routeClicked) return;
        if (isVertexEditing) return;

        const currentMode = modeRef.current;

        const clickBbox = [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ] as [import("maplibre-gl").PointLike, import("maplibre-gl").PointLike];
        const hits = map.queryRenderedFeatures(clickBbox, { layers: interactiveLayers });

        const sortedHits = [...hits].sort((a, b) => {
          const aId = a.layer.id;
          const bId = b.layer.id;
          const isPointA = aId.startsWith("editor-points-") || aId === "editor-map-labels";
          const isPointB = bId.startsWith("editor-points-") || bId === "editor-map-labels";
          if (isPointA && !isPointB) return -1;
          if (!isPointA && isPointB) return 1;
          return 0;
        });

        if (sortedHits.length > 0) {
          const hitId = sortedHits[0]!.properties?.id as string | undefined;
          if (hitId) {
            const match = featuresRef.current.find((f) => f.id === hitId);
            if (match) {
              e.preventDefault?.();
              if (e.originalEvent) {
                e.originalEvent.preventDefault();
              }
              if (currentMode === "eyedropper") {
                if (onApplyEyedropperRef.current) {
                  onApplyEyedropperRef.current(match);
                }
                return;
              }
              if (currentMode === "magic-wand") {
                if (onApplyMagicWandRef.current) {
                  const isShift = !!e.originalEvent?.shiftKey;
                  const isAlt = !!e.originalEvent?.altKey;
                  onApplyMagicWandRef.current(match, isShift, isAlt);
                }
                return;
              }
              if (onFeatureSelectRef.current) {
                onFeatureSelectRef.current(match);
              }
            }
          }
        } else {
          // Clicked empty space on canvas, deselect current selection only if in select/edit modes
          const isSelectMode = currentMode === "view" || currentMode.startsWith("edit-");
          if (isSelectMode && onFeatureSelectRef.current) {
            onFeatureSelectRef.current(null);
          }
        }
      };

      const onContextMenuFeature = (e: any) => {
        routePluginEvent("onContextMenu", e);
        if (e.defaultPrevented) return;

        if (isPickingLocationRef.current) return;
        if (e.routeClicked) return;
        if (isVertexEditing) return;

        const contextBbox = [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ] as [import("maplibre-gl").PointLike, import("maplibre-gl").PointLike];
        const hits = map.queryRenderedFeatures(contextBbox, { layers: interactiveLayers });

        const sortedHits = [...hits].sort((a, b) => {
          const aId = a.layer.id;
          const bId = b.layer.id;
          const isPointA = aId.startsWith("editor-points-") || aId === "editor-map-labels";
          const isPointB = bId.startsWith("editor-points-") || bId === "editor-map-labels";
          if (isPointA && !isPointB) return -1;
          if (!isPointA && isPointB) return 1;
          return 0;
        });

        if (sortedHits.length > 0) {
          const firstHit = sortedHits[0]!;
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

      const onMouseDown = (e: any) => {
        routePluginEvent("onMouseDown", e);
      };

      const onMouseUp = (e: any) => {
        routePluginEvent("onMouseUp", e);
      };

      const onDoubleClick = (e: any) => {
        routePluginEvent("onDoubleClick", e);
      };

      map.on("mousemove", onMouseMove);
      map.on("mouseleave", "editor-subdivisions-fill", onMouseLeave);
      map.on("click", onClickFeature);
      map.on("contextmenu", onContextMenuFeature);
      map.on("mousedown", onMouseDown);
      map.on("mouseup", onMouseUp);
      map.on("dblclick", onDoubleClick);

      return () => {
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

      const onClick = (e: any) => {
        routePluginEvent("onClick", e);
        if (e.defaultPrevented) return;

        if (spacebarPanActiveRef.current) return;
        if (e.routeClicked) return;
        if (isVertexEditing) return;

        const currentMode = modeRef.current;

        if (
          isPickingLocationRef.current ||
          currentMode === "add-city" ||
          currentMode === "add-poi" ||
          currentMode === "add-story-pin" ||
          currentMode === "add-label" ||
          currentMode === "split-subdivision"
        ) {
          const snapped = snapPoint([e.lngLat.lng, e.lngLat.lat]);
          onMapClickRef.current(snapped[0], snapped[1]);
        } else if (currentMode === "ruler") {
          if (onAddRulerPoint) {
            const snapped = snapPoint([e.lngLat.lng, e.lngLat.lat]);
            onAddRulerPoint(snapped);
          }
        } else if (currentMode === "paint-fill") {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: ["editor-subdivisions-fill"],
          });
          if (hits.length > 0) {
            const hitId = hits[0]!.properties?.id as string | undefined;
            if (hitId && onApplyPaintFill) {
              onApplyPaintFill(hitId);
            }
          }
        } else if (currentMode === "add-route") {
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
    }, [isLoaded, isVertexEditing, onAddRulerPoint, onApplyPaintFill, snapPoint, routePluginEvent]);

    // Handle Lasso click-and-drag selection
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      let isDrawing = false;
      let pts: [number, number][] = [];

      const onMouseDown = (e: any) => {
        if (spacebarPanActiveRef.current) return;
        if (modeRef.current !== "lasso-select") return;

        // Prevent map panning
        e.preventDefault();
        map.dragPan.disable();

        isDrawing = true;
        pts = [[e.lngLat.lng, e.lngLat.lat]];

        setLassoGeometry({
          type: "Polygon" as const,
          coordinates: [[...pts, pts[0]]],
        });
      };

      const onMouseMove = (e: any) => {
        if (!isDrawing) return;

        pts.push([e.lngLat.lng, e.lngLat.lat]);

        setLassoGeometry({
          type: "Polygon" as const,
          coordinates: [[...pts, pts[0]]],
        });
      };

      const onMouseUp = () => {
        if (!isDrawing) return;
        isDrawing = false;
        map.dragPan.enable();

        if (pts.length >= 3 && onApplyLassoSelection) {
          onApplyLassoSelection(pts);
        }
        setLassoGeometry(null);
      };

      map.on("mousedown", onMouseDown);
      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);

      return () => {
        map.off("mousedown", onMouseDown);
        map.off("mousemove", onMouseMove);
        map.off("mouseup", onMouseUp);
      };
    }, [isLoaded, onApplyLassoSelection, setLassoGeometry]);

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

    const rect = containerRef.current?.getBoundingClientRect();
    const rulerWidth = rect ? rect.width - 24 : 0;
    const rulerHeight = rect ? rect.height - 24 : 0;

    const ticks: { x: number; isMajor: boolean; label?: string }[] = [];
    const yTicks: { y: number; isMajor: boolean; label?: string }[] = [];

    const map = mapRef.current;
    if (map && rect && isLoaded) {
      // Top Ruler calculations (horizontal, longitude)
      const west = map.unproject([24, 0]).lng;
      const east = map.unproject([rect.width, 0]).lng;
      const diffLng = east - west;

      let step = 10;
      if (diffLng < 0.1) step = 0.01;
      else if (diffLng < 0.2) step = 0.02;
      else if (diffLng < 0.5) step = 0.05;
      else if (diffLng < 1) step = 0.1;
      else if (diffLng < 2) step = 0.2;
      else if (diffLng < 5) step = 0.5;
      else if (diffLng < 10) step = 1;
      else if (diffLng < 25) step = 2;
      else if (diffLng < 50) step = 5;
      else if (diffLng < 100) step = 10;
      else step = 20;

      const minorStep = step / 5;
      const startLng = Math.ceil(west / minorStep) * minorStep;
      const endLng = Math.floor(east / minorStep) * minorStep;

      for (let lng = startLng; lng <= endLng + minorStep / 2; lng += minorStep) {
        const proj = map.project([lng, map.getCenter().lat]);
        const x = proj.x - 24;
        if (x >= 0 && x <= rulerWidth) {
          const isMajor = Math.abs(Math.round(lng / minorStep) % 5) === 0;
          ticks.push({
            x,
            isMajor,
            label: isMajor ? lng.toFixed(Math.max(0, -Math.floor(Math.log10(step)))) : undefined,
          });
        }
      }

      // Left Ruler calculations (vertical, latitude)
      const north = map.unproject([0, 24]).lat;
      const south = map.unproject([0, rect.height]).lat;
      const diffLat = north - south;

      let stepLat = 10;
      if (diffLat < 0.1) stepLat = 0.01;
      else if (diffLat < 0.2) stepLat = 0.02;
      else if (diffLat < 0.5) stepLat = 0.05;
      else if (diffLat < 1) stepLat = 0.1;
      else if (diffLat < 2) stepLat = 0.2;
      else if (diffLat < 5) stepLat = 0.5;
      else if (diffLat < 10) stepLat = 1;
      else if (diffLat < 25) stepLat = 2;
      else if (diffLat < 50) stepLat = 5;
      else if (diffLat < 100) stepLat = 10;
      else stepLat = 20;

      const minorStepLat = stepLat / 5;
      const startLat = Math.ceil(south / minorStepLat) * minorStepLat;
      const endLat = Math.floor(north / minorStepLat) * minorStepLat;

      for (let lat = startLat; lat <= endLat + minorStepLat / 2; lat += minorStepLat) {
        const proj = map.project([map.getCenter().lng, lat]);
        const y = proj.y - 24;
        if (y >= 0 && y <= rulerHeight) {
          const isMajor = Math.abs(Math.round(lat / minorStepLat) % 5) === 0;
          yTicks.push({
            y,
            isMajor,
            label: isMajor ? lat.toFixed(Math.max(0, -Math.floor(Math.log10(stepLat)))) : undefined,
          });
        }
      }
    }

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

        {isLoaded && rect && map && (
          <>
            {/* Top Ruler */}
            <svg
              className="pointer-events-auto absolute top-0 right-0 left-[24px] z-20 h-6 cursor-ns-resize border-b border-neutral-300 bg-neutral-100/90 select-none dark:border-neutral-800 dark:bg-neutral-900/90"
              style={{ width: rulerWidth }}
              onMouseDown={handleTopRulerMouseDown}
            >
              {ticks.map((t, idx) => (
                <g key={idx}>
                  <line
                    x1={t.x}
                    y1={t.isMajor ? 12 : 18}
                    x2={t.x}
                    y2={24}
                    className="stroke-neutral-400 dark:stroke-neutral-600"
                    strokeWidth={1}
                  />
                  {t.label && (
                    <text
                      x={t.x}
                      y={10}
                      className="fill-neutral-500 font-mono text-[8px] dark:fill-neutral-400"
                      textAnchor="middle"
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>

            {/* Left Ruler */}
            <svg
              className="pointer-events-auto absolute top-[24px] bottom-0 left-0 z-20 w-6 cursor-ew-resize border-r border-neutral-300 bg-neutral-100/90 select-none dark:border-neutral-800 dark:bg-neutral-900/90"
              style={{ height: rulerHeight }}
              onMouseDown={handleLeftRulerMouseDown}
            >
              {yTicks.map((t, idx) => (
                <g key={idx}>
                  <line
                    x1={t.isMajor ? 12 : 18}
                    y1={t.y}
                    x2={24}
                    y2={t.y}
                    className="stroke-neutral-400 dark:stroke-neutral-600"
                    strokeWidth={1}
                  />
                  {t.label && (
                    <text
                      x={10}
                      y={t.y + 3}
                      className="fill-neutral-500 font-mono text-[8px] dark:fill-neutral-400"
                      textAnchor="end"
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>

            {/* Corner box */}
            <div className="pointer-events-none absolute top-0 left-0 z-30 flex h-6 w-6 items-center justify-center border-r border-b border-neutral-300 bg-neutral-200 dark:border-neutral-800 dark:bg-neutral-950">
              <span className="font-mono text-[9px] font-bold text-neutral-400 dark:text-neutral-500">
                °
              </span>
            </div>

            {/* Guides SVG Overlay */}
            <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
              {showGuides &&
                guides.map((guide) => {
                  if (guide.type === "v") {
                    const proj = map.project([guide.value, map.getCenter().lat]);
                    const x = proj.x;
                    if (x < 24 || x > rect.width) return null;
                    return (
                      <line
                        key={guide.id}
                        x1={x}
                        y1={24}
                        x2={x}
                        y2={rect.height}
                        className="pointer-events-auto cursor-col-resize stroke-cyan-500/80 dark:stroke-cyan-400/80"
                        strokeWidth={1.5}
                        strokeDasharray="4,4"
                        title="Double-click to delete guide"
                        onDoubleClick={() => {
                          if (setGuides) {
                            setGuides((prev) => prev.filter((g) => g.id !== guide.id));
                          }
                        }}
                      />
                    );
                  } else {
                    const proj = map.project([map.getCenter().lng, guide.value]);
                    const y = proj.y;
                    if (y < 24 || y > rect.height) return null;
                    return (
                      <line
                        key={guide.id}
                        x1={24}
                        y1={y}
                        x2={rect.width}
                        y2={y}
                        className="pointer-events-auto cursor-row-resize stroke-cyan-500/80 dark:stroke-cyan-400/80"
                        strokeWidth={1.5}
                        strokeDasharray="4,4"
                        title="Double-click to delete guide"
                        onDoubleClick={() => {
                          if (setGuides) {
                            setGuides((prev) => prev.filter((g) => g.id !== guide.id));
                          }
                        }}
                      />
                    );
                  }
                })}

              {/* Active Drag Guide line */}
              {activeDragGuide &&
                (activeDragGuide.type === "v" ? (
                  <line
                    x1={activeDragGuide.screenPos}
                    y1={24}
                    x2={activeDragGuide.screenPos}
                    y2={rect.height}
                    className="stroke-amber-500/80 dark:stroke-amber-400/80"
                    strokeWidth={1.5}
                    strokeDasharray="2,2"
                  />
                ) : (
                  <line
                    x1={24}
                    y1={activeDragGuide.screenPos}
                    x2={rect.width}
                    y2={activeDragGuide.screenPos}
                    className="stroke-amber-500/80 dark:stroke-amber-400/80"
                    strokeWidth={1.5}
                    strokeDasharray="2,2"
                  />
                ))}
            </svg>
          </>
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
