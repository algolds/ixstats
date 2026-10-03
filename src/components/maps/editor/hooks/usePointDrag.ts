import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import type { EditorFeature, EditorMode } from "~/hooks/useMapEditor";
import {
  buildPointFeatures,
  collection,
  getGeoJSONSource,
  pointFeature,
} from "../utils/map-helpers";
import {
  exceedsHysteresis,
  axisLock,
  nextLockedAxis,
  NUDGE_SMALL,
  NUDGE_LARGE,
  type DragAxis,
  type ScreenPoint,
} from "./drag-utils";
import { createListeners, queryNear } from "./map-interaction";

const POINT_TYPES = ["city", "poi", "storyPin", "mapLabel", "peak"] as const;
type PointType = (typeof POINT_TYPES)[number];
const isPointType = (type: string): type is PointType =>
  (POINT_TYPES as readonly string[]).includes(type);

interface UsePointDragProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  mode: EditorMode;
  features: EditorFeature[];
  selectedFeature?: EditorFeature | null;
  onFeatureSelect?: (feature: EditorFeature | null) => void;
  updatePointCoordinates?: (
    featureId: string,
    featureType: PointType,
    coordinates: [number, number]
  ) => Promise<void>;
}

interface DragState {
  featureId: string;
  featureType: PointType;
  originalCoords: [number, number];
  currentCoords: [number, number];
  startScreenPoint: ScreenPoint;
  committed: boolean;
  lockedAxis: DragAxis | null;
}

const DRAGGABLE_LAYERS = [
  "editor-points-capital",
  "editor-points-city",
  "editor-points-poi",
  "editor-points-peak",
  "editor-points-story-pin",
  "editor-points-map-label",
  "editor-points-labels",
  "editor-map-labels",
];

const ARROW_DIRECTIONS: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

/** Tools that use the map for placing/drawing, where points must not be dragged. */
const isPlacementMode = (mode: string) =>
  /^(add-|import-)|route/.test(mode) ||
  mode === "split-subdivision" ||
  mode === "lasso-select" ||
  mode === "ruler";

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
  /** Snapshot of all point features, so a 60fps drag only swaps one entry. */
  const cachedPointFeaturesRef = useRef<ReturnType<typeof buildPointFeatures> | null>(null);
  const activeFeatureIndexRef = useRef<number>(-1);

  // Latest props for the stable event callbacks.
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

    const listeners = createListeners(map);
    const canvas = map.getCanvas();

    const syncPointsSource = (activeId: string | null, activeCoords: [number, number] | null) => {
      const source = map.getSource("editor-points") as GeoJSONSource | undefined;
      if (!source) return;

      const cache = cachedPointFeaturesRef.current;
      const index = activeFeatureIndexRef.current;
      if (activeId && activeCoords && cache && index !== -1) {
        cache[index] = { ...cache[index]!, geometry: { type: "Point", coordinates: activeCoords } };
        source.setData({ type: "FeatureCollection", features: cache });
        return;
      }

      const override =
        activeId && activeCoords ? { id: activeId, coordinates: activeCoords } : undefined;
      source.setData(collection(buildPointFeatures(featuresRef.current, override)));
    };

    const setGhost = (coords: [number, number] | null) => {
      getGeoJSONSource(map, "editor-points-ghost")?.setData(
        collection(coords ? [pointFeature(coords)] : [])
      );
    };

    const clearDragState = () => {
      dragRef.current = null;
      cachedPointFeaturesRef.current = null;
      activeFeatureIndexRef.current = -1;
    };

    const onMouseDown = (e: MapLayerMouseEvent) => {
      if (isPlacementMode(modeRef.current)) return;

      const id = queryNear(map, e.point, 8, DRAGGABLE_LAYERS)[0]?.properties?.id;
      if (!id) return;

      // Drag by id so the canonical feature (not the rendered copy) is the source of truth.
      const feature = featuresRef.current.find((f) => f.id === id);
      if (!feature?.coordinates || feature.type === "peak" || !isPointType(feature.type)) return;

      // Prevent default map behaviors (like box zoom / canvas text selection)
      e.preventDefault();

      dragRef.current = {
        featureId: id,
        featureType: feature.type,
        originalCoords: [...feature.coordinates],
        currentCoords: [...feature.coordinates],
        startScreenPoint: { x: e.point.x, y: e.point.y },
        committed: false,
        lockedAxis: null,
      };

      const allPointFeatures = buildPointFeatures(featuresRef.current);
      cachedPointFeaturesRef.current = allPointFeatures;
      activeFeatureIndexRef.current = allPointFeatures.findIndex((f) => f.properties.id === id);

      onFeatureSelectRef.current?.(feature);
    };

    const onMouseMove = (e: MapLayerMouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const currentScreen: ScreenPoint = { x: e.point.x, y: e.point.y };

      // 4px dead zone before a click becomes a drag.
      if (!drag.committed) {
        if (!exceedsHysteresis(drag.startScreenPoint, currentScreen)) return;
        drag.committed = true;
        map.dragPan.disable();
        setGhost(drag.originalCoords);
      }

      drag.lockedAxis = nextLockedAxis(
        drag.lockedAxis,
        e.originalEvent.shiftKey,
        drag.startScreenPoint,
        currentScreen
      );
      drag.currentCoords = axisLock(
        drag.originalCoords,
        [e.lngLat.lng, e.lngLat.lat],
        drag.lockedAxis
      );

      // Straight to the map source for 60fps responsiveness.
      syncPointsSource(drag.featureId, drag.currentCoords);
      canvas.style.cursor = "grabbing";
    };

    const finishDrag = () => {
      map.dragPan.enable();
      canvas.style.cursor = "";
      setGhost(null);
    };

    const onMouseUp = async () => {
      const drag = dragRef.current;
      if (!drag) return;
      clearDragState();
      if (!drag.committed) return;

      finishDrag();
      const { featureId, featureType, originalCoords, currentCoords } = drag;
      if (originalCoords[0] !== currentCoords[0] || originalCoords[1] !== currentCoords[1]) {
        await updatePointCoordinatesRef.current?.(featureId, featureType, currentCoords);
      }
    };

    let nudgeTimer: ReturnType<typeof setTimeout> | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current) {
        e.preventDefault();
        const wasCommitted = dragRef.current.committed;
        clearDragState();
        if (wasCommitted) {
          syncPointsSource(null, null);
          finishDrag();
        }
        return;
      }

      // Arrow-key precision nudging for the selected point feature
      const direction = ARROW_DIRECTIONS[e.key];
      if (!direction) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }
      const sel = selectedFeatureRef.current;
      if (!sel?.coordinates || !isPointType(sel.type)) return;

      e.preventDefault();
      const delta = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
      const newCoords: [number, number] = [
        sel.coordinates[0] + direction[0] * delta,
        sel.coordinates[1] + direction[1] * delta,
      ];
      syncPointsSource(sel.id, newCoords);

      // Updated in place so repeated nudges accumulate before the save lands.
      sel.coordinates = newCoords;

      // Commit once the arrow keys go quiet: a burst of nudges is one save and one undo step.
      if (nudgeTimer) clearTimeout(nudgeTimer);
      const nudgeType = sel.type;
      const nudgeId = sel.id;
      nudgeTimer = setTimeout(() => {
        nudgeTimer = null;
        void updatePointCoordinatesRef.current?.(nudgeId, nudgeType, newCoords);
      }, 400);
    };

    for (const layerId of DRAGGABLE_LAYERS) listeners.onLayer("mousedown", layerId, onMouseDown);
    listeners.onMap("mousemove", onMouseMove);
    // Window-scoped so a release or Escape outside the canvas still cleans up.
    listeners.onDom(window, "mouseup", onMouseUp);
    listeners.onDom(window, "keydown", onKeyDown);

    return () => {
      listeners.dispose();
      if (nudgeTimer) clearTimeout(nudgeTimer);
    };
  }, [map, isLoaded]);
}
