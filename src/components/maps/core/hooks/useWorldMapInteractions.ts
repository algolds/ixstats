import { useEffect, useCallback, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { SelectedCountry, SelectedFeature, HoveredCountry } from "../IxWorldMap";
import { DEMOTED_COUNTRY_NAMES, INTERACTION_COLORS } from "~/lib/maps/map-config";
import { escHtml, COUNTRY_LABEL_OPACITY } from "../utils/map-core-helpers";
import { transientMapStore } from "../../editor/utils/transientStore";

interface UseWorldMapInteractionsProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  layers: any[];
  overlayVisibility?: Record<string, boolean>;
  labelsVisible?: boolean;
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

export function useWorldMapInteractions({
  map,
  isLoaded,
  layers,
  // oxlint-disable-next-line eslint/no-unused-vars
  overlayVisibility,
  // oxlint-disable-next-line eslint/no-unused-vars
  labelsVisible,
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
  const hoveredFeatureIdRef = useRef<number | null>(null);
  const hoveredOverlayIdRef = useRef<string | null>(null);
  const hoveredSubdivisionIdRef = useRef<number | null>(null);

  // Keep latest refs to avoid stale callbacks
  const onCountryClickRef = useRef(onCountryClick);
  onCountryClickRef.current = onCountryClick;
  const onCountryHoverRef = useRef(onCountryHover);
  onCountryHoverRef.current = onCountryHover;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onFeatureClickRef = useRef(onFeatureClick);
  onFeatureClickRef.current = onFeatureClick;

  const updateDistanceFade = useCallback(() => {
    if (!map) return;

    const baseFeatures = labelFeaturesRef.current;
    if (!baseFeatures || baseFeatures.features.length === 0) return;
    const source = map.getSource("source-country-labels");
    if (!source) return;

    const center = map.getCenter();
    const zoom = map.getZoom();

    const bounds = map.getBounds();
    const visibleLngSpan = bounds.getEast() - bounds.getWest();
    const visibleLatSpan = bounds.getNorth() - bounds.getSouth();
    const viewRadius =
      Math.sqrt(visibleLngSpan * visibleLngSpan + visibleLatSpan * visibleLatSpan) / 2;

    const updated: FeatureCollection = {
      ...baseFeatures,
      features: baseFeatures.features.map((f) => {
        const props = f.properties as Record<string, any>;
        const name = props?._displayName as string;
        const isTop = topCountryNames?.has(name);
        const isDemoted = DEMOTED_COUNTRY_NAMES.includes(name as any);

        if (isTop) {
          return {
            ...f,
            properties: { ...props, _importance: 1, _distFade: 1 },
          };
        }

        if (isDemoted) {
          if (zoom < 5.5) {
            return { ...f, properties: { ...props, _importance: -1, _distFade: 0 } };
          }
        }

        const geometry = f.geometry;
        if (!("coordinates" in geometry)) return f;
        const coords = geometry.coordinates as [number, number];
        const dlng = coords[0] - center.lng;
        const dlat = coords[1] - center.lat;
        const dist = Math.sqrt(dlng * dlng + dlat * dlat);

        const normDist = dist / Math.max(viewRadius, 1);
        const rawFade = Math.max(0, Math.min(1, (1.2 - normDist) / 0.6));
        const zoomFade = Math.max(0, Math.min(1, (zoom - 2.5) / 1.5));
        const fade = zoomFade * rawFade;

        return {
          ...f,
          properties: {
            ...props,
            _importance: isDemoted ? -1 : 0,
            _distFade: Math.round(fade * 100) / 100,
          },
        };
      }),
    };

    labelFeaturesRef.current = updated;
    (source as any).setData(updated);
  }, [map, topCountryNames, labelFeaturesRef]);

  // Check if a screen point is on the visible globe or map surface
  const isPointOnGlobeOrMap = useCallback(
    (pt: { x: number; y: number }): boolean => {
      if (!map) return false;
      try {
        if (map.transform && typeof (map.transform as any).isPointOnMapSurface === "function") {
          return (map.transform as any).isPointOnMapSurface(pt);
        }
      } catch (_) {}

      // Fallback for flat projection / high zoom or missing transform method
      if (map.getZoom() >= 4.5) return true;
      const canvas = map.getCanvas();
      if (!canvas) return true;
      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const cursorDistSq = dx * dx + dy * dy;

      const center = map.getCenter();
      let edgeLat = center.lat - 88;
      if (edgeLat < -90) edgeLat = center.lat + 88;
      const edgeScreen = map.project({ lng: center.lng, lat: edgeLat });
      const rx = edgeScreen.x - cx;
      const ry = edgeScreen.y - cy;
      const radiusSq = rx * rx + ry * ry;
      return radiusSq > 0 ? cursorDistSq <= radiusSq : true;
    },
    [map]
  );

  // Check if a screen point is outside the visible globe disc (globe projection only)
  const isOutsideGlobe = useCallback(
    (pt: { x: number; y: number }): boolean => {
      return !isPointOnGlobeOrMap(pt);
    },
    [isPointOnGlobeOrMap]
  );

  const isDraggingRef = useRef(false);

  // Handle country hover + overlay feature tooltips
  const handleMouseMove = useCallback(
    (e: any) => {
      if (!map || isDraggingRef.current) return;
      if (!map.getLayer("fill-political")) return;

      if (isOutsideGlobe(e.point)) {
        if (hoveredFeatureIdRef.current !== null && map.getSource("source-political")) {
          map.setFeatureState(
            { source: "source-political", id: hoveredFeatureIdRef.current },
            { hover: false }
          );
        }
        hoveredFeatureIdRef.current = null;
        onCountryHoverRef.current?.(null);

        if (tooltipPopupRef.current?.isOpen()) tooltipPopupRef.current.remove();
        hoveredOverlayIdRef.current = null;

        if (
          hoveredSubdivisionIdRef.current !== null &&
          map.getSource("source-overlay-subdivisions")
        ) {
          map.setFeatureState(
            { source: "source-overlay-subdivisions", id: hoveredSubdivisionIdRef.current },
            { hover: false }
          );
          hoveredSubdivisionIdRef.current = null;
        }
        if (!isMeasuring) map.getCanvas().style.cursor = "default";
        return;
      }

      const overlayLayerIds = [
        "overlay-cities-circle",
        "capitals-star",
        "overlay-pois-circle",
        "overlay-subdivisions-fill",
        "story-pins-icon",
      ].filter((id) => map.getLayer(id));

      let overlayHit: any = null;
      if (overlayLayerIds.length > 0) {
        const hits = map.queryRenderedFeatures(e.point, { layers: overlayLayerIds });
        if (hits.length > 0) overlayHit = hits[0];
      }

      if (overlayHit) {
        const props = overlayHit.properties ?? {};
        const name = String(props.name ?? props.title ?? "");
        const layerId = overlayHit.layer?.id ?? "";
        const featureKey = `${layerId}:${props.id ?? name}`;

        const isSubHover = layerId === "overlay-subdivisions-fill";
        const subId = isSubHover ? (overlayHit.id as number) : null;
        if (hoveredSubdivisionIdRef.current !== subId) {
          if (
            hoveredSubdivisionIdRef.current !== null &&
            map.getSource("source-overlay-subdivisions")
          ) {
            map.setFeatureState(
              { source: "source-overlay-subdivisions", id: hoveredSubdivisionIdRef.current },
              { hover: false }
            );
          }
          if (subId !== null && map.getSource("source-overlay-subdivisions")) {
            map.setFeatureState(
              { source: "source-overlay-subdivisions", id: subId },
              { hover: true }
            );
          }
          hoveredSubdivisionIdRef.current = subId;
        }

        if (featureKey !== hoveredOverlayIdRef.current && name) {
          hoveredOverlayIdRef.current = featureKey;

          let typeHint = "";
          if (layerId === "capitals-star") typeHint = "Capital";
          else if (layerId === "overlay-cities-circle")
            typeHint = props.cityType ? String(props.cityType) : "City";
          else if (layerId === "overlay-pois-circle")
            typeHint = props.category ? String(props.category) : "POI";
          else if (layerId === "overlay-subdivisions-fill")
            typeHint = props.type ? String(props.type) : "Region";
          else if (layerId === "story-pins-icon") typeHint = "Story Pin";

          const safeName = escHtml(name);
          const safeType = escHtml(typeHint);
          const popContent = safeType
            ? `<strong>${safeName}</strong><span class="ixmap-tt-type">${safeType}</span>`
            : `<strong>${safeName}</strong>`;

          const popup = tooltipPopupRef.current;
          if (popup) {
            popup.setLngLat(e.lngLat).setHTML(popContent).addTo(map);
          }
        } else if (hoveredOverlayIdRef.current === featureKey) {
          tooltipPopupRef.current?.setLngLat(e.lngLat);
        }

        if (!isMeasuring) map.getCanvas().style.cursor = "pointer";
      } else {
        if (hoveredOverlayIdRef.current) {
          hoveredOverlayIdRef.current = null;
          tooltipPopupRef.current?.remove();
        }
        if (
          hoveredSubdivisionIdRef.current !== null &&
          map.getSource("source-overlay-subdivisions")
        ) {
          map.setFeatureState(
            { source: "source-overlay-subdivisions", id: hoveredSubdivisionIdRef.current },
            { hover: false }
          );
          hoveredSubdivisionIdRef.current = null;
        }
      }

      const features = map.queryRenderedFeatures(e.point, {
        layers: ["fill-political"],
      });

      const nextFeature = features[0] || null;
      const nextFeatureId = nextFeature?.id != null ? (nextFeature.id as number) : null;

      if (hoveredFeatureIdRef.current !== nextFeatureId) {
        if (hoveredFeatureIdRef.current !== null && map.getSource("source-political")) {
          try {
            map.setFeatureState(
              { source: "source-political", id: hoveredFeatureIdRef.current },
              { hover: false }
            );
          } catch (_) {}
        }

        hoveredFeatureIdRef.current = nextFeatureId;

        if (nextFeatureId !== null) {
          if (map.getSource("source-political")) {
            try {
              map.setFeatureState(
                { source: "source-political", id: nextFeatureId },
                { hover: true }
              );
            } catch (_) {}
          }
          if (!isMeasuring && !overlayHit) map.getCanvas().style.cursor = "pointer";

          const hoveredId =
            (nextFeature.properties?._countryId as string) ||
            (nextFeature.properties?._id as string) ||
            String(nextFeatureId);
          transientMapStore.setHoveredFeatureId(hoveredId);
          if (e.lngLat) {
            transientMapStore.setCursorCoords([e.lngLat.lng, e.lngLat.lat]);
          }

          onCountryHoverRef.current?.({
            featureId: nextFeature.properties?._id || "",
            displayName: nextFeature.properties?._displayName || "Unknown",
            fillColor: nextFeature.properties?._fillColor || "#e8e5da",
            centroidLng: nextFeature.properties?._centroidLng || 0,
            centroidLat: nextFeature.properties?._centroidLat || 0,
            countryId: (nextFeature.properties?._countryId as string) || null,
          });
        } else {
          transientMapStore.setHoveredFeatureId(null);
          transientMapStore.setCursorCoords(null);
          onCountryHoverRef.current?.(null);
          if (!isMeasuring && !overlayHit) map.getCanvas().style.cursor = "";
        }
      }
    },
    [map, isOutsideGlobe, isMeasuring, tooltipPopupRef]
  );

  // Handle country + feature click
  const handleClick = useCallback(
    (e: any) => {
      if (!map) return;

      onMapClickRef.current?.(e.lngLat.lng, e.lngLat.lat);
      tooltipPopupRef.current?.remove();
      hoveredOverlayIdRef.current = null;

      if (isOutsideGlobe(e.point)) return;

      const overlayLayerIds = [
        "overlay-cities-circle",
        "capitals-star",
        "overlay-pois-circle",
        "story-pins-icon",
      ].filter((id) => map.getLayer(id));

      if (overlayLayerIds.length > 0) {
        const overlayHits = map.queryRenderedFeatures(e.point, {
          layers: overlayLayerIds,
        });

        if (overlayHits.length > 0) {
          const hit = overlayHits[0];
          const props = hit.properties ?? {};
          const coords = (hit.geometry as any).coordinates as [number, number];
          const layerId = hit.layer?.id;

          const featureType =
            layerId === "story-pins-icon"
              ? "storyPin"
              : layerId === "overlay-pois-circle"
                ? "poi"
                : layerId === "capitals-star"
                  ? "capital"
                  : "city";

          const selected: SelectedFeature = {
            id: String(props.id ?? ""),
            featureType,
            name: String(featureType === "storyPin" ? (props.title ?? "") : (props.name ?? "")),
            countryId: String(props.countryId ?? ""),
            countryName: String(props.countryName ?? ""),
            countrySlug: props.countrySlug ? String(props.countrySlug) : null,
            coordinates: coords,
            ...(featureType !== "poi" &&
              featureType !== "storyPin" && {
                cityType: props.cityType ? String(props.cityType) : undefined,
                population: props.population != null ? Number(props.population) : null,
                isCapital: featureType === "capital" || !!props.isCapital,
              }),
            ...(featureType === "poi" && {
              category: props.category ? String(props.category) : undefined,
              icon: props.icon ? String(props.icon) : null,
              description: props.description ? String(props.description) : null,
            }),
            ...(featureType === "storyPin" && {
              category: props.category ? String(props.category) : undefined,
              ixTimeYear: props.ixTimeYear != null ? Number(props.ixTimeYear) : null,
              eraLabel: props.eraLabel ? String(props.eraLabel) : null,
            }),
            wikiPageTitle: props.wikiPageTitle ? String(props.wikiPageTitle) : null,
          };

          onFeatureClickRef.current?.(selected);
          return;
        }
      }

      onFeatureClickRef.current?.(null);

      if (!map.getLayer("fill-political")) return;
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["fill-political"],
      });

      if (features.length > 0) {
        const feature = features[0];
        const country: SelectedCountry = {
          featureId: feature.properties?._id || "",
          displayName: feature.properties?._displayName || "Unknown",
          fillColor: feature.properties?._fillColor || "#e8e5da",
          centroidLng: feature.properties?._centroidLng || 0,
          centroidLat: feature.properties?._centroidLat || 0,
          countryId: (feature.properties?._countryId as string) || null,
        };

        onCountryClickRef.current?.(country);
      } else {
        onCountryClickRef.current?.(null);
      }
    },
    [map, isOutsideGlobe, tooltipPopupRef]
  );

  // Bind mouse move, drag, clicks, and capture interceptors to constrain controls to the globe surface
  useEffect(() => {
    if (!map || !isLoaded) return;

    const canvasContainer = map.getCanvasContainer();
    const canvas = map.getCanvas();
    if (!canvasContainer || !canvas) return;

    const handleDragStart = () => {
      isDraggingRef.current = true;
      canvas.style.cursor = "grabbing";
    };

    const handleDragEnd = () => {
      isDraggingRef.current = false;
      if (!isMeasuring) {
        canvas.style.cursor = "grab";
      }
    };

    map.on("mousemove", handleMouseMove);
    map.on("click", handleClick);
    map.on("dragstart", handleDragStart);
    map.on("dragend", handleDragEnd);

    // Coordinate conversion from client viewport to canvas
    const getCanvasPoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    // Capture & stop mouse/pointer events that originate outside the globe disc
    const handleCaptureMouseDown = (e: MouseEvent) => {
      if (e.target !== canvas && e.target !== canvasContainer) return;
      const pt = getCanvasPoint(e.clientX, e.clientY);
      if (!isPointOnGlobeOrMap(pt)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleCapturePointerDown = (e: PointerEvent) => {
      if (e.target !== canvas && e.target !== canvasContainer) return;
      const pt = getCanvasPoint(e.clientX, e.clientY);
      if (!isPointOnGlobeOrMap(pt)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleCaptureTouchStart = (e: TouchEvent) => {
      if (e.target !== canvas && e.target !== canvasContainer) return;
      const touches = Array.from(e.touches || []);
      const anyTouchOnGlobe =
        touches.length > 0 &&
        touches.some((t) => {
          const pt = getCanvasPoint(t.clientX, t.clientY);
          return isPointOnGlobeOrMap(pt);
        });
      if (!anyTouchOnGlobe) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleCaptureDblClick = (e: MouseEvent) => {
      if (e.target !== canvas && e.target !== canvasContainer) return;
      const pt = getCanvasPoint(e.clientX, e.clientY);
      if (!isPointOnGlobeOrMap(pt)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleCaptureWheel = (e: WheelEvent) => {
      if (e.target !== canvas && e.target !== canvasContainer) return;
      const pt = getCanvasPoint(e.clientX, e.clientY);
      if (!isPointOnGlobeOrMap(pt)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleCaptureContextMenu = (e: MouseEvent) => {
      if (e.target !== canvas && e.target !== canvasContainer) return;
      const pt = getCanvasPoint(e.clientX, e.clientY);
      if (!isPointOnGlobeOrMap(pt)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const captureOpts: AddEventListenerOptions = { capture: true, passive: false };

    canvasContainer.addEventListener("mousedown", handleCaptureMouseDown, captureOpts);
    canvasContainer.addEventListener("pointerdown", handleCapturePointerDown, captureOpts);
    canvasContainer.addEventListener("touchstart", handleCaptureTouchStart, captureOpts);
    canvasContainer.addEventListener("dblclick", handleCaptureDblClick, captureOpts);
    canvasContainer.addEventListener("wheel", handleCaptureWheel, captureOpts);
    canvasContainer.addEventListener("contextmenu", handleCaptureContextMenu, captureOpts);

    const handleMouseLeave = () => {
      tooltipPopupRef.current?.remove();
      hoveredOverlayIdRef.current = null;
      if (
        hoveredSubdivisionIdRef.current !== null &&
        map.getSource("source-overlay-subdivisions")
      ) {
        map.setFeatureState(
          { source: "source-overlay-subdivisions", id: hoveredSubdivisionIdRef.current },
          { hover: false }
        );
        hoveredSubdivisionIdRef.current = null;
      }
      if (hoveredFeatureIdRef.current !== null && map.getSource("source-political")) {
        map.setFeatureState(
          { source: "source-political", id: hoveredFeatureIdRef.current },
          { hover: false }
        );
      }
      hoveredFeatureIdRef.current = null;
      canvas.style.cursor = "default";
    };
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("click", handleClick);
      map.off("dragstart", handleDragStart);
      map.off("dragend", handleDragEnd);

      canvasContainer.removeEventListener("mousedown", handleCaptureMouseDown, captureOpts);
      canvasContainer.removeEventListener("pointerdown", handleCapturePointerDown, captureOpts);
      canvasContainer.removeEventListener("touchstart", handleCaptureTouchStart, captureOpts);
      canvasContainer.removeEventListener("dblclick", handleCaptureDblClick, captureOpts);
      canvasContainer.removeEventListener("wheel", handleCaptureWheel, captureOpts);
      canvasContainer.removeEventListener("contextmenu", handleCaptureContextMenu, captureOpts);

      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [map, isLoaded, handleMouseMove, handleClick, isPointOnGlobeOrMap, isMeasuring, tooltipPopupRef]);

  // Bind move/zoom end labels distance fade
  useEffect(() => {
    if (!map || !isLoaded) return;

    map.on("moveend", updateDistanceFade);
    map.on("zoomend", updateDistanceFade);

    const handleZoomChange = () => {
      onZoomChange?.(Math.round(map.getZoom() * 10) / 10);
    };
    map.on("zoomend", handleZoomChange);

    return () => {
      map.off("moveend", updateDistanceFade);
      map.off("zoomend", updateDistanceFade);
      map.off("zoomend", handleZoomChange);
    };
  }, [map, isLoaded, onZoomChange, updateDistanceFade]);

  // Geography filtering effects
  useEffect(() => {
    if (!map || !isLoaded) return;

    const fillLayerId = "fill-political";
    if (!map.getLayer(fillLayerId)) return;

    const politicalLayer = layers.find((l) => l.type === "political");
    const isVisible = politicalLayer?.visible !== false;

    if (geographyFilter && isVisible) {
      const propKey = geographyFilter.type === "continent" ? "_continent" : "_region";
      map.setPaintProperty(fillLayerId, "fill-opacity", [
        "case",
        ["==", ["get", propKey], geographyFilter.value],
        0.6,
        0.08,
      ]);
      if (map.getLayer("country-name-labels")) {
        map.setPaintProperty("country-name-labels", "text-opacity", [
          "case",
          ["==", ["get", propKey], geographyFilter.value],
          COUNTRY_LABEL_OPACITY,
          0.1,
        ] as any);
      }
    } else if (isVisible) {
      map.setPaintProperty(fillLayerId, "fill-opacity", [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        0.6,
        0.12, // match configuration POLITICAL layer opacity
      ]);
      if (map.getLayer("country-name-labels")) {
        map.setPaintProperty("country-name-labels", "text-opacity", COUNTRY_LABEL_OPACITY as any);
      }
    }
  }, [map, isLoaded, geographyFilter, layers]);

  // Highlight selected country
  useEffect(() => {
    if (!map || !isLoaded) return;

    if (!map.getLayer("selected-country-outline")) {
      if (map.getSource("source-political")) {
        map.addLayer({
          id: "selected-country-fill",
          type: "fill",
          source: "source-political",
          paint: {
            "fill-color": INTERACTION_COLORS.selected,
            "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.4, 0],
          },
        });
        map.addLayer({
          id: "selected-country-outline",
          type: "line",
          source: "source-political",
          paint: {
            "line-color": INTERACTION_COLORS.selectedStroke,
            "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 0],
          },
        });
      }
    }

    const political = layers.find((l) => l.type === "political");
    if (political && map.getSource("source-political")) {
      for (let i = 0; i < political.data.features.length; i++) {
        map.setFeatureState({ source: "source-political", id: i }, { selected: false });
      }

      if (selectedCountryId) {
        const idx = political.data.features.findIndex(
          (f: any) =>
            (f.properties?._id || f.properties?.id) === selectedCountryId ||
            (f.properties?._countryId || f.properties?.countryId) === selectedCountryId
        );
        if (idx >= 0) {
          map.setFeatureState({ source: "source-political", id: idx }, { selected: true });
        }
      }
    }
  }, [map, selectedCountryId, isLoaded, layers]);

  return {
    updateDistanceFade,
  };
}
