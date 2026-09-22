import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import type { EditorFeature, EditorMode } from "~/hooks/useMapEditor";
import {
  exceedsHysteresis,
  detectAxis,
  axisLock,
  NUDGE_SMALL,
  NUDGE_LARGE,
  type DragAxis,
  type ScreenPoint,
} from "./drag-utils";

interface UsePointDragProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  mode: EditorMode;
  features: EditorFeature[];
  selectedFeature?: EditorFeature | null;
  onFeatureSelect?: (feature: EditorFeature | null) => void;
  updatePointCoordinates?: (
    featureId: string,
    featureType: "city" | "poi" | "storyPin" | "mapLabel",
    coordinates: [number, number]
  ) => Promise<void>;
}

interface DragState {
  featureId: string;
  featureType: "city" | "poi" | "storyPin" | "mapLabel";
  originalCoords: [number, number];
  currentCoords: [number, number];
  startScreenPoint: ScreenPoint;
  committed: boolean;
  lockedAxis: DragAxis | null;
}

export function usePointDrag({
  map,
  isLoaded,
  mode,
  features,
  selectedFeature,
  onFeatureSelect,
  updatePointCoordinates,
}: UsePointDragProps) {
  const dragRef = useRef<DragState | null>(null);
  const cachedPointFeaturesRef = useRef<Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Record<string, unknown>;
  }> | null>(null);
  const activeFeatureIndexRef = useRef<number>(-1);

  const featuresRef = useRef(features);
  // oxlint-disable-next-line
  featuresRef.current = features;

  const selectedFeatureRef = useRef(selectedFeature);
  // oxlint-disable-next-line
  selectedFeatureRef.current = selectedFeature;

  const modeRef = useRef(mode);
  // oxlint-disable-next-line
  modeRef.current = mode;

  const onFeatureSelectRef = useRef(onFeatureSelect);
  // oxlint-disable-next-line
  onFeatureSelectRef.current = onFeatureSelect;

  const updatePointCoordinatesRef = useRef(updatePointCoordinates);
  // oxlint-disable-next-line
  updatePointCoordinatesRef.current = updatePointCoordinates;

  useEffect(() => {
    if (!map || !isLoaded) return;

    const draggableLayers = [
      "editor-points-capital",
      "editor-points-city",
      "editor-points-poi",
      "editor-points-story-pin",
      "editor-points-map-label",
      "editor-points-labels",
      "editor-map-labels",
    ];

    const syncPointsSource = (activeId: string | null, activeCoords: [number, number] | null) => {
      const source = map.getSource("editor-points") as GeoJSONSource;
      if (!source) return;

      if (
        activeId &&
        activeCoords &&
        cachedPointFeaturesRef.current &&
        activeFeatureIndexRef.current !== -1
      ) {
        cachedPointFeaturesRef.current[activeFeatureIndexRef.current] = {
          ...cachedPointFeaturesRef.current[activeFeatureIndexRef.current]!,
          geometry: {
            type: "Point",
            coordinates: activeCoords,
          },
        };
        source.setData({
          type: "FeatureCollection",
          features: cachedPointFeaturesRef.current,
        });
        return;
      }

      const pointFeatures = featuresRef.current
        .filter((f) => f.coordinates)
        .map((f) => {
          const coords =
            activeId && activeCoords && f.id === activeId ? activeCoords : f.coordinates!;
          return {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: coords,
            },
            properties: {
              id: f.id,
              name: f.name,
              featureType: f.type,
              isCapital: f.properties.isNationalCapital ?? false,
              rotation: Number(f.properties.rotation) || 0,
              opacity: f.properties.opacity !== undefined ? Number(f.properties.opacity) : 1,
              color: f.properties.color || "#374151",
              fontSize: Number(f.properties.fontSize) || 11,
              fontWeight: f.properties.fontWeight || "normal",
              letterSpacing: Number(f.properties.letterSpacing) || 0,
            },
          };
        });

      source.setData({
        type: "FeatureCollection",
        features: pointFeatures,
      });
    };

    const onMouseDown = (e: MapLayerMouseEvent) => {
      const activeMode = modeRef.current;
      const isAddMode =
        activeMode.startsWith("add-") ||
        activeMode.startsWith("import-") ||
        activeMode.includes("route") ||
        activeMode === "split-subdivision" ||
        activeMode === "lasso-select" ||
        activeMode === "ruler";
      if (isAddMode) return;

      const dragBbox = [
        [e.point.x - 8, e.point.y - 8],
        [e.point.x + 8, e.point.y + 8],
      ] as [import("maplibre-gl").PointLike, import("maplibre-gl").PointLike];
      const hits = map.queryRenderedFeatures(dragBbox, { layers: draggableLayers });
      if (hits.length === 0) return;

      const hit = hits[0]!;
      const id = hit.properties?.id;

      // Look up feature to make sure we drag by ID and get its canonical properties
      if (!id) return;
      const feature = featuresRef.current.find((f) => f.id === id);
      if (!feature || !feature.coordinates) return;
      if (
        feature.type !== "city" &&
        feature.type !== "poi" &&
        feature.type !== "storyPin" &&
        feature.type !== "mapLabel"
      ) {
        return;
      }

      // Prevent default map behaviors (like box zoom / canvas text selection)
      e.preventDefault();

      dragRef.current = {
        featureId: id,
        featureType: feature.type,
        originalCoords: [...feature.coordinates] as [number, number],
        currentCoords: [...feature.coordinates] as [number, number],
        startScreenPoint: { x: e.point.x, y: e.point.y },
        committed: false,
        lockedAxis: null,
      };

      // Snapshot point features for O(1) updates during 60fps drag
      const allPointFeatures = featuresRef.current
        .filter((f) => f.coordinates)
        .map((f) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [...f.coordinates!] as [number, number],
          },
          properties: {
            id: f.id,
            name: f.name,
            featureType: f.type,
            isCapital: f.properties.isNationalCapital ?? false,
            rotation: Number(f.properties.rotation) || 0,
            opacity: f.properties.opacity !== undefined ? Number(f.properties.opacity) : 1,
            color: f.properties.color || "#374151",
            fontSize: Number(f.properties.fontSize) || 11,
            fontWeight: f.properties.fontWeight || "normal",
            letterSpacing: Number(f.properties.letterSpacing) || 0,
          },
        }));

      cachedPointFeaturesRef.current = allPointFeatures;
      activeFeatureIndexRef.current = allPointFeatures.findIndex(
        (f) => f.properties.id === id
      );

      // Select feature in editor immediately
      if (onFeatureSelectRef.current) {
        onFeatureSelectRef.current(feature);
      }
    };

    const onMouseMove = (e: MapLayerMouseEvent) => {
      if (!dragRef.current) return;

      const currentScreen: ScreenPoint = { x: e.point.x, y: e.point.y };

      // Hysteresis threshold check (4px dead zone)
      if (!dragRef.current.committed) {
        if (!exceedsHysteresis(dragRef.current.startScreenPoint, currentScreen)) {
          return;
        }

        // Commit drag once hysteresis is broken
        dragRef.current.committed = true;
        map.dragPan.disable();
        map.getCanvas().style.cursor = "grabbing";

        // Initial axis lock if shift is held at initiation
        if (e.originalEvent.shiftKey) {
          const dx = currentScreen.x - dragRef.current.startScreenPoint.x;
          const dy = currentScreen.y - dragRef.current.startScreenPoint.y;
          dragRef.current.lockedAxis = detectAxis(dx, dy);
        }

        // Populate ghost source at starting coordinates
        const ghostSource = map.getSource("editor-points-ghost") as GeoJSONSource;
        if (ghostSource) {
          ghostSource.setData({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: dragRef.current.originalCoords,
                },
                properties: {},
              },
            ],
          });
        }
      }

      // Shift axis locking handling mid-drag
      if (e.originalEvent.shiftKey) {
        if (!dragRef.current.lockedAxis) {
          const dx = currentScreen.x - dragRef.current.startScreenPoint.x;
          const dy = currentScreen.y - dragRef.current.startScreenPoint.y;
          dragRef.current.lockedAxis = detectAxis(dx, dy);
        }
      } else {
        dragRef.current.lockedAxis = null;
      }

      const rawCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const newCoords = axisLock(
        dragRef.current.originalCoords,
        rawCoords,
        dragRef.current.lockedAxis
      );
      dragRef.current.currentCoords = newCoords;

      // Directly update the coordinates of the dragged feature on the map source for 60fps responsiveness
      syncPointsSource(dragRef.current.featureId, newCoords);
      map.getCanvas().style.cursor = "grabbing";
    };

    const onMouseUp = async () => {
      if (!dragRef.current) return;

      const { featureId, featureType, originalCoords, currentCoords, committed } = dragRef.current;
      dragRef.current = null;
      cachedPointFeaturesRef.current = null;
      activeFeatureIndexRef.current = -1;

      if (!committed) {
        return;
      }

      map.dragPan.enable();
      map.getCanvas().style.cursor = "";

      // Hide ghost marker
      const ghostSource = map.getSource("editor-points-ghost") as GeoJSONSource;
      if (ghostSource) {
        ghostSource.setData({ type: "FeatureCollection", features: [] });
      }

      // If position changed, update in DB
      if (originalCoords[0] !== currentCoords[0] || originalCoords[1] !== currentCoords[1]) {
        if (updatePointCoordinatesRef.current) {
          await updatePointCoordinatesRef.current(featureId, featureType, currentCoords);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Escape cancellation mid-drag
      if (e.key === "Escape" && dragRef.current) {
        e.preventDefault();
        const wasCommitted = dragRef.current.committed;
        dragRef.current = null;
        cachedPointFeaturesRef.current = null;
        activeFeatureIndexRef.current = -1;

        if (wasCommitted) {
          // Snap back visual source to canonical positions
          syncPointsSource(null, null);

          // Hide ghost marker
          const ghostSource = map.getSource("editor-points-ghost") as GeoJSONSource;
          if (ghostSource) {
            ghostSource.setData({ type: "FeatureCollection", features: [] });
          }

          map.dragPan.enable();
          map.getCanvas().style.cursor = "";
        }
        return;
      }

      // Arrow-key precision nudging for selected point features (Photoshop/Illustrator precision)
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable)
        ) {
          return;
        }

        const sel = selectedFeatureRef.current;
        if (
          !sel ||
          !sel.coordinates ||
          (sel.type !== "city" &&
            sel.type !== "poi" &&
            sel.type !== "storyPin" &&
            sel.type !== "mapLabel")
        ) {
          return;
        }

        e.preventDefault();
        const delta = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
        const [currLng, currLat] = sel.coordinates;
        let newLng = currLng;
        let newLat = currLat;

        if (e.key === "ArrowLeft") newLng -= delta;
        else if (e.key === "ArrowRight") newLng += delta;
        else if (e.key === "ArrowUp") newLat += delta;
        else if (e.key === "ArrowDown") newLat -= delta;

        const newCoords: [number, number] = [newLng, newLat];
        syncPointsSource(sel.id, newCoords);

        // Update coordinates reference in-memory for seamless repeated nudging
        sel.coordinates = newCoords;

        if (updatePointCoordinatesRef.current) {
          void updatePointCoordinatesRef.current(sel.id, sel.type, newCoords);
        }
      }
    };

    // Wire up events
    draggableLayers.forEach((layerId) => {
      map.on("mousedown", layerId, onMouseDown);
    });

    map.on("mousemove", onMouseMove);
    // Window-scoped listeners ensure release or escape outside canvas still cleans up
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      draggableLayers.forEach((layerId) => {
        if (map.getStyle()) {
          map.off("mousedown", layerId, onMouseDown);
        }
      });
      map.off("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [map, isLoaded]);
}
