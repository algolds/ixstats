import { useEffect, useCallback, useRef } from "react";
import type { ExpressionSpecification, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { SelectedCountry, SelectedFeature, HoveredCountry, MapLayerData } from "../IxWorldMap";
import { COUNTRY_LABEL_OPACITY } from "../utils/map-core-helpers";
import { computeCountryLabelFade } from "../utils/label-fade";
import {
  SELECTED_COUNTRY_LAYERS,
  clearAllHover,
  isPointOnGlobeOrMap,
  pickCountry,
  pickOverlayFeature,
  updateHover,
  type HoverState,
} from "../utils/world-map-hit-testing";

interface UseWorldMapInteractionsProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  layers: MapLayerData[];
  geographyFilter?: { type: "continent" | "region"; value: string } | null;
  topCountryNames?: Set<string>;
  selectedCountryId?: string | null;
  isMeasuring?: boolean;
  onCountryClick?: (country: SelectedCountry | null) => void;
  onCountryHover?: (country: HoveredCountry | null) => void;
  onMapClick?: (lng: number, lat: number) => void;
  onFeatureClick?: (feature: SelectedFeature | null) => void;
  onZoomChange?: (zoom: number) => void;
  labelFeaturesRef: React.MutableRefObject<FeatureCollection | null>;
  tooltipPopupRef: React.MutableRefObject<any>;
}

const POINTER_LIKE_EVENTS = ["mousedown", "pointerdown", "dblclick", "wheel", "contextmenu"];
const CAPTURE_OPTS: AddEventListenerOptions = { capture: true, passive: false };

/**
 * Mouse/pointer/wheel/dblclick/contextmenu that start off the globe disc never reach MapLibre;
 * touches pass through as long as any finger is on the globe (pinch from the edge).
 */
function attachGlobeGuards(map: MapLibreMap) {
  const container = map.getCanvasContainer();
  const canvas = map.getCanvas();
  const toCanvasPoint = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const isOnGlobe = (clientX: number, clientY: number) =>
    isPointOnGlobeOrMap(map, toCanvasPoint(clientX, clientY));
  const stopOffGlobe = (e: Event) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
  };
  const onCanvas = (e: Event) => e.target === canvas || e.target === container;

  const onPointerLike = (e: Event) => {
    const { clientX, clientY } = e as MouseEvent;
    if (onCanvas(e) && !isOnGlobe(clientX, clientY)) stopOffGlobe(e);
  };
  const onTouchStart = (e: Event) => {
    const touches = Array.from((e as TouchEvent).touches || []);
    if (onCanvas(e) && !touches.some((t) => isOnGlobe(t.clientX, t.clientY))) stopOffGlobe(e);
  };

  for (const type of POINTER_LIKE_EVENTS)
    container.addEventListener(type, onPointerLike, CAPTURE_OPTS);
  container.addEventListener("touchstart", onTouchStart, CAPTURE_OPTS);
  return () => {
    for (const type of POINTER_LIKE_EVENTS) {
      container.removeEventListener(type, onPointerLike, CAPTURE_OPTS);
    }
    container.removeEventListener("touchstart", onTouchStart, CAPTURE_OPTS);
  };
}

/** Run `handler` with the latest argument at most once per animation frame. */
function coalesceToFrame<T>(handler: (arg: T) => void) {
  let pending: T | null = null;
  let frame = 0;
  return {
    schedule(arg: T) {
      pending = arg;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const latest = pending;
        pending = null;
        if (latest) handler(latest);
      });
    },
    cancel() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pending = null;
    },
  };
}

/** Dim countries outside the active continent/region filter (or restore the default look). */
function applyGeographyFilter(
  map: MapLibreMap,
  filter: UseWorldMapInteractionsProps["geographyFilter"]
) {
  const matches: ExpressionSpecification | undefined = filter
    ? ["==", ["get", filter.type === "continent" ? "_continent" : "_region"], filter.value]
    : undefined;
  map.setPaintProperty(
    "fill-political",
    "fill-opacity",
    matches
      ? ["case", matches, 0.6, 0.08]
      : // matches the configuration POLITICAL layer opacity
        ["case", ["boolean", ["feature-state", "hover"], false], 0.6, 0.12]
  );
  if (map.getLayer("country-name-labels")) {
    map.setPaintProperty(
      "country-name-labels",
      "text-opacity",
      matches ? ["case", matches, COUNTRY_LABEL_OPACITY, 0.1] : COUNTRY_LABEL_OPACITY
    );
  }
}

type SelectedIdx = { data: unknown; idx: number };

/** Mark the selected country's polygon via feature state, clearing only the previous one. */
function syncSelectedCountry(
  map: MapLibreMap,
  layers: MapLayerData[],
  selectedCountryId: string | null | undefined,
  prevRef: React.MutableRefObject<SelectedIdx>
) {
  for (const layer of SELECTED_COUNTRY_LAYERS) {
    if (!map.getLayer(layer.id) && map.getSource("source-political")) map.addLayer(layer);
  }

  const political = layers.find((l) => l.type === "political");
  if (!political || !map.getSource("source-political")) return;

  const idx = selectedCountryId
    ? political.data.features.findIndex(
        (f) =>
          (f.properties?._id || f.properties?.id) === selectedCountryId ||
          (f.properties?._countryId || f.properties?.countryId) === selectedCountryId
      )
    : -1;

  // Clear only the previously selected feature (one call) instead of resetting state on every
  // country polygon each time `layers` changes. When the political data object changed,
  // generated ids may have shifted, so clear the source's feature state instead (MapLibre only
  // removes a single key when an id is given).
  const prev = prevRef.current;
  if (prev.data !== political.data) {
    try {
      map.removeFeatureState({ source: "source-political" });
    } catch (err) {
      console.debug("[useWorldMapInteractions] Reset selected state error:", err);
    }
  } else if (prev.idx >= 0 && prev.idx !== idx) {
    map.setFeatureState({ source: "source-political", id: prev.idx }, { selected: false });
  }

  if (idx >= 0) map.setFeatureState({ source: "source-political", id: idx }, { selected: true });
  prevRef.current = { data: political.data, idx };
}

export function useWorldMapInteractions({
  map,
  isLoaded,
  layers,
  geographyFilter,
  topCountryNames,
  selectedCountryId,
  isMeasuring = false,
  onCountryClick,
  onCountryHover,
  onMapClick,
  onFeatureClick,
  onZoomChange,
  labelFeaturesRef,
  tooltipPopupRef,
}: UseWorldMapInteractionsProps) {
  const hoverRef = useRef<HoverState>({ featureId: null, overlayKey: null, subdivisionId: null });
  const selectedIdxRef = useRef<SelectedIdx>({ data: null, idx: -1 });
  const isDraggingRef = useRef(false);

  // Keep latest callbacks to avoid stale listeners
  const handlersRef = useRef({ onCountryClick, onCountryHover, onMapClick, onFeatureClick });
  // oxlint-disable-next-line
  handlersRef.current = { onCountryClick, onCountryHover, onMapClick, onFeatureClick };

  const updateDistanceFade = useCallback(() => {
    if (!map) return;

    const baseFeatures = labelFeaturesRef.current;
    if (!baseFeatures || baseFeatures.features.length === 0) return;
    const source = map.getSource("source-country-labels");
    if (!source) return;

    const bounds = map.getBounds();
    const viewRadius =
      Math.hypot(bounds.getEast() - bounds.getWest(), bounds.getNorth() - bounds.getSouth()) / 2;

    const updated = computeCountryLabelFade(baseFeatures, {
      center: map.getCenter(),
      zoom: map.getZoom(),
      viewRadius,
      topCountryNames,
    });
    if (!updated) return;

    labelFeaturesRef.current = updated;
    (source as any).setData(updated);
  }, [map, topCountryNames, labelFeaturesRef]);

  const handleMouseMove = useCallback(
    (e: MapMouseEvent) => {
      if (!map || isDraggingRef.current || !map.getLayer("fill-political")) return;
      updateHover(
        {
          map,
          hover: hoverRef.current,
          popup: tooltipPopupRef.current,
          isMeasuring,
          onCountryHover: handlersRef.current.onCountryHover,
        },
        e
      );
    },
    [map, isMeasuring, tooltipPopupRef]
  );

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      if (!map) return;
      const { onMapClick, onFeatureClick, onCountryClick } = handlersRef.current;

      onMapClick?.(e.lngLat.lng, e.lngLat.lat);
      tooltipPopupRef.current?.remove();
      hoverRef.current.overlayKey = null;

      if (!isPointOnGlobeOrMap(map, e.point)) return;

      const feature = pickOverlayFeature(map, e.point);
      onFeatureClick?.(feature);
      if (!feature && map.getLayer("fill-political")) onCountryClick?.(pickCountry(map, e.point));
    },
    [map, tooltipPopupRef]
  );

  // Hover, click, drag and the off-globe event guards
  useEffect(() => {
    if (!map || !isLoaded) return;

    const canvas = map.getCanvas();
    if (!map.getCanvasContainer() || !canvas) return;

    const handleDragStart = () => {
      isDraggingRef.current = true;
      canvas.style.cursor = "grabbing";
    };
    const handleDragEnd = () => {
      isDraggingRef.current = false;
      if (!isMeasuring) canvas.style.cursor = "grab";
    };

    // Hit-testing (two queryRenderedFeatures calls) is the costliest part of hover, and
    // mousemove can fire several times per frame on high-rate pointers. Coalesce to one
    // hit-test per animation frame using the latest event.
    const moves = coalesceToFrame(handleMouseMove);
    const handleMouseLeave = () => {
      moves.cancel();
      clearAllHover(
        map,
        hoverRef.current,
        tooltipPopupRef.current,
        handlersRef.current.onCountryHover
      );
      canvas.style.cursor = "default";
    };

    map.on("mousemove", moves.schedule);
    map.on("click", handleClick);
    map.on("dragstart", handleDragStart);
    map.on("dragend", handleDragEnd);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    const detachGuards = attachGlobeGuards(map);

    return () => {
      moves.cancel();
      map.off("mousemove", moves.schedule);
      map.off("click", handleClick);
      map.off("dragstart", handleDragStart);
      map.off("dragend", handleDragEnd);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      detachGuards();
    };
  }, [map, isLoaded, handleMouseMove, handleClick, isMeasuring, tooltipPopupRef]);

  // Every zoom also ends with a `moveend`, so one listener recomputes the label fade once per
  // gesture (listening to `zoomend` as well pushed the label source twice per zoom).
  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleZoomChange = () => onZoomChange?.(Math.round(map.getZoom() * 10) / 10);
    map.on("moveend", updateDistanceFade);
    map.on("zoomend", handleZoomChange);
    return () => {
      map.off("moveend", updateDistanceFade);
      map.off("zoomend", handleZoomChange);
    };
  }, [map, isLoaded, onZoomChange, updateDistanceFade]);

  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer("fill-political")) return;
    if (layers.find((l) => l.type === "political")?.visible === false) return;
    applyGeographyFilter(map, geographyFilter);
  }, [map, isLoaded, geographyFilter, layers]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    syncSelectedCountry(map, layers, selectedCountryId, selectedIdxRef);
  }, [map, selectedCountryId, isLoaded, layers]);

  return { updateDistanceFade };
}
