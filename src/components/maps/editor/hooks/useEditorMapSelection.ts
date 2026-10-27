import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, PointLike } from "maplibre-gl";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import { transientMapStore } from "../utils/transientStore";
import { hitTestFeatures } from "../utils/hit-test";
import { createListeners, isRouteClick, type EditorMouseEvent } from "./map-interaction";
import { useLatest } from "./useLatest";

const HOVER_LAYER = "editor-subdivisions-hover";

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
];

/** Layer groups the Layers panel can lock (locked layers are not selectable). */
const LOCKABLE_LAYERS: Record<string, string[]> = {
  regions: ["editor-subdivisions-fill", "editor-gaps-fill"],
  geography: ["editor-points-peak", "editor-lines"],
  cities: ["editor-points-capital", "editor-points-city"],
  pois: ["editor-points-poi"],
  stories: ["editor-points-story-pin"],
  labels: ["editor-points-map-label", "editor-map-labels"],
};

/** Tools that use clicks for placing or drawing, so clicks never select or open menus. */
const PLACEMENT_MODES = new Set<string>([
  "add-city",
  "add-poi",
  "add-peak",
  "add-river",
  "add-lake",
  "add-subdivision",
  "add-route",
  "split-subdivision",
]);

type MapFilter = Parameters<MapLibreMap["setFilter"]>[1];

const hoverFilter = (id: string): MapFilter => ["==", ["get", "id"], id];

function cursorForLayer(layerId: string) {
  if (layerId.startsWith("editor-points") || layerId === "editor-map-labels") return "grab";
  return layerId === "editor-gaps-fill" ? "help" : "pointer";
}

interface UseEditorMapSelectionProps {
  mapRef: { readonly current: MapLibreMap | null };
  isLoaded: boolean;
  isVertexEditing: boolean;
  mode: EditorMode;
  features: EditorFeature[];
  isPickingLocation: boolean;
  lockedLayers?: Record<string, boolean>;
  spacebarPanRef: { readonly current: boolean };
  wasDragRef: { readonly current: boolean };
  onFeatureSelect?: (feature: EditorFeature | null) => void;
  onToggleSelect?: (id: string) => void;
  onFeatureContextMenu?: (feature: EditorFeature, screenPos: { x: number; y: number }) => void;
}

/** Hover highlight, click-to-select (Shift/Alt toggles multi-select) and the feature context menu. */
export function useEditorMapSelection({
  mapRef,
  isLoaded,
  isVertexEditing,
  mode,
  features,
  isPickingLocation,
  lockedLayers,
  spacebarPanRef,
  wasDragRef,
  onFeatureSelect,
  onToggleSelect,
  onFeatureContextMenu,
}: UseEditorMapSelectionProps) {
  const latest = useLatest({
    mode,
    features,
    isPickingLocation,
    lockedLayers,
    onFeatureSelect,
    onToggleSelect,
    onFeatureContextMenu,
  });
  /** Last hovered feature id, to avoid redundant setFilter calls. */
  const lastHoveredIdRef = useRef<string | null>(null);

  // Entering a tool mode clears the hover highlight.
  useEffect(() => {
    if (mode === "view" || mode === "paint") return;
    const map = mapRef.current;
    if (map?.getLayer(HOVER_LAYER)) map.setFilter(HOVER_LAYER, hoverFilter(""));
    lastHoveredIdRef.current = null;
    transientMapStore.setHoveredFeatureId(null);
  }, [mode, mapRef]);

  // Crosshair while placing, default otherwise.
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas || !isLoaded) return;
    const defaultCursor =
      mode === "view" ||
      mode === "import-provinces" ||
      mode === "edit-subdivision" ||
      mode === "edit-route";
    canvas.style.cursor = isPickingLocation || !defaultCursor ? "crosshair" : "";
  }, [mapRef, mode, isLoaded, isPickingLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    const canvas = map.getCanvas();
    const listeners = createListeners(map);

    const setHoverHighlight = (id: string) => {
      if (map.getLayer(HOVER_LAYER)) map.setFilter(HOVER_LAYER, hoverFilter(id));
    };
    const hitTest = (point: PointLike) => {
      const locked = latest.current.lockedLayers ?? {};
      return hitTestFeatures(map, point, {
        layers: INTERACTIVE_LAYERS,
        excludeLayers: Object.entries(LOCKABLE_LAYERS).flatMap(([key, ids]) =>
          locked[key] ? ids : []
        ),
      });
    };
    const findFeature = (id: string | undefined) =>
      id ? latest.current.features.find((f) => f.id === id) : undefined;

    // Hover hit-testing (queryRenderedFeatures) runs at most once per animation frame.
    let hoverFrame: number | null = null;
    let lastMove: EditorMouseEvent | null = null;

    const processHover = () => {
      hoverFrame = null;
      const move = lastMove;
      if (!move) return;

      if (spacebarPanRef.current) {
        canvas.style.cursor = "grab";
        return;
      }
      if (latest.current.isPickingLocation) {
        canvas.style.cursor = "crosshair";
        return;
      }
      if (isVertexEditing) return;

      // Tool modes suppress region hit-testing and the hover highlight.
      const currentMode = latest.current.mode;
      if (currentMode !== "view" && currentMode !== "paint") {
        if (lastHoveredIdRef.current !== null) {
          lastHoveredIdRef.current = null;
          setHoverHighlight("");
        }
        transientMapStore.setHoveredFeatureId(null);
        return;
      }

      const { hit, locked } = hitTest(move.point);
      const hitId = hit?.featureId ?? null;
      if (hitId !== lastHoveredIdRef.current) {
        lastHoveredIdRef.current = hitId;
        setHoverHighlight(hitId ?? "");
      }
      canvas.style.cursor = locked ? "not-allowed" : hit ? cursorForLayer(hit.layerId) : "";
      transientMapStore.setHoveredFeatureId(hitId);
    };

    const onMouseMove = (e: EditorMouseEvent) => {
      if (e.defaultPrevented) return;
      // Cheap: the store batches listener notifications per frame.
      transientMapStore.setCursorCoords([e.lngLat.lng, e.lngLat.lat], {
        x: e.point.x,
        y: e.point.y,
      });
      lastMove = e;
      hoverFrame ??= requestAnimationFrame(processHover);
    };

    const onMouseLeave = () => {
      transientMapStore.setHoveredFeatureId(null);
      transientMapStore.setCursorCoords(null);
      lastHoveredIdRef.current = null;
      if (latest.current.isPickingLocation) {
        canvas.style.cursor = "crosshair";
        return;
      }
      if (isVertexEditing) return;
      canvas.style.cursor = "";
      setHoverHighlight("");
    };

    const onClick = (e: EditorMouseEvent) => {
      if (e.defaultPrevented || spacebarPanRef.current || latest.current.isPickingLocation) return;
      // Post-drag clicks (map pan / feature drag) must not select.
      if (isRouteClick(e) || wasDragRef.current) return;

      const { mode: currentMode, onFeatureSelect: select, onToggleSelect: toggle } = latest.current;
      if (PLACEMENT_MODES.has(currentMode)) return;

      const { hit, locked } = hitTest(e.point);
      if (hit && !locked) {
        const match = findFeature(hit.featureId);
        if (!match) return;
        e.preventDefault?.();
        e.originalEvent?.preventDefault();
        // Shift/Alt click toggles multi-select.
        if (e.originalEvent?.shiftKey || e.originalEvent?.altKey) toggle?.(match.id);
        else select?.(match);
      } else if (currentMode === "view" || currentMode.startsWith("edit-")) {
        // Empty space (or a locked feature) deselects, in select/edit modes only.
        select?.(null);
      }
    };

    const onContextMenu = (e: EditorMouseEvent) => {
      const { mode: currentMode, onFeatureContextMenu: openMenu } = latest.current;
      if (e.defaultPrevented || latest.current.isPickingLocation || isRouteClick(e)) return;
      if (isVertexEditing || wasDragRef.current || PLACEMENT_MODES.has(currentMode)) return;

      const { hit, locked } = hitTest(e.point);
      if (!hit || locked || !openMenu) return;

      const feature: EditorFeature | undefined =
        hit.layerId === "editor-gaps-fill"
          ? {
              id: "gap",
              type: "gap",
              name: "Negative Space",
              coordinates: [e.lngLat.lng, e.lngLat.lat],
              geometry: hit.feature.geometry,
              properties: {},
            }
          : findFeature(hit.featureId);
      if (!feature) return;

      e.preventDefault?.();
      e.originalEvent?.preventDefault();
      e.originalEvent?.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      openMenu(feature, { x: rect.left + e.point.x, y: rect.top + e.point.y });
    };

    const onCanvasLeave = () => {
      lastMove = null;
      transientMapStore.setCursorCoords(null);
      transientMapStore.setHoveredFeatureId(null);
    };

    listeners.onMap("mousemove", onMouseMove);
    listeners.onLayer("mouseleave", "editor-subdivisions-fill", onMouseLeave);
    listeners.onMap("click", onClick);
    listeners.onMap("contextmenu", onContextMenu);
    listeners.onDom(map.getCanvasContainer(), "mouseleave", onCanvasLeave);

    return () => {
      if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
      listeners.dispose();
    };
  }, [mapRef, isLoaded, isVertexEditing, latest, spacebarPanRef, wasDragRef]);
}
