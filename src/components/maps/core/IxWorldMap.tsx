"use client";
import { useRef, useEffect, forwardRef, useImperativeHandle, useState, memo } from "react";
import type { FeatureCollection } from "geojson";
import type { MapLayerType } from "~/lib/maps/map-config";
import { MAP_DEFAULTS, buildBaseStyle } from "~/lib/maps/map-config";
import type { MapTheme } from "~/lib/map-styles/registry";

import { Suspense } from "react";
import { acquireSurface } from "~/lib/maps/map-engine";

// Overlay components + their wiring
import { OVERLAY_LIST } from "~/lib/maps/overlay-registry";

import { useWorldMapLayers } from "./hooks/useWorldMapLayers";
import { useWorldMapInteractions } from "./hooks/useWorldMapInteractions";
import { useWorldMapOverlayFeatures } from "./hooks/useWorldMapOverlayFeatures";
import { useWorldMapDataOverlays } from "./hooks/useWorldMapDataOverlays";
import { Card } from "~/components/ui/card";

// MapLibre types imported dynamically since the module requires browser APIs
type MapLibreMap = import("maplibre-gl").Map;

export interface SelectedCountry {
  featureId: string;
  displayName: string;
  fillColor: string;
  centroidLng: number;
  centroidLat: number;
  countryId: string | null;
}

/** A neighbouring country picked from a panel; centroid is optional (looked up when absent). */
export interface NeighborTarget {
  featureId: string;
  countryId: string | null;
  displayName: string;
  centroidLng?: number;
  centroidLat?: number;
}

export interface SelectedFeature {
  id: string;
  featureType: "city" | "poi" | "capital" | "storyPin";
  name: string;
  countryId: string;
  countryName: string;
  countrySlug: string | null;
  coordinates: [number, number];
  cityType?: string;
  population?: number | null;
  isCapital?: boolean;
  category?: string;
  icon?: string | null;
  description?: string | null;
  ixTimeYear?: number | null;
  eraLabel?: string | null;
  wikiPageTitle?: string | null;
}

export interface HoveredCountry extends SelectedCountry {
  screenX?: number;
  screenY?: number;
}

export interface CapitalsGeoJson {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: {
      id: string;
      name: string;
      countryId: string;
      countryName: string;
      countrySlug: string | null;
      population: number | null;
    };
  }>;
}

export interface MapOverlayFeatures {
  cities: FeatureCollection;
  pois: FeatureCollection;
  subdivisions: FeatureCollection;
  storyPins?: FeatureCollection;
  mapLabels?: FeatureCollection;
}

export interface MapLayerData {
  type: MapLayerType;
  data: FeatureCollection;
  visible: boolean;
}

export type OverlayVisibility = Record<string, boolean>;

interface IxWorldMapProps {
  layers: any[];
  theme?: MapTheme;
  capitals?: CapitalsGeoJson;
  overlayFeatures?: MapOverlayFeatures;
  overlayVisibility?: OverlayVisibility;
  onCountryClick?: (country: SelectedCountry | null) => void;
  onCountryHover?: (country: HoveredCountry | null) => void;
  onMapClick?: (lng: number, lat: number) => void;
  onFeatureClick?: (feature: SelectedFeature | null) => void;
  onReady?: () => void;
  selectedCountryId?: string | null;
  isMeasuring?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
  geographyFilter?: { type: "continent" | "region"; value: string } | null;
  projectionMode?: any;
  topCountryNames?: Set<string>;
  labelsVisible?: boolean;
  onZoomChange?: (zoom: number) => void;
  overlayData?: Record<string, unknown>;
  onRouteClick?: (routeId: string) => void;
  /** IxWorld's ocean and sea names; off unless the map shows IxWorld (AT-2). */
  showOceanLabels?: boolean;
}

export interface IxWorldMapRef {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  fitBounds: (bounds: [[number, number], [number, number]], padding?: number) => void;
  getMap: () => MapLibreMap | null;
}

const IxWorldMap = memo(
  forwardRef<IxWorldMapRef, IxWorldMapProps>(function IxWorldMap(
    {
      layers,
      theme = "standard",
      capitals,
      overlayFeatures,
      overlayVisibility,
      onCountryClick,
      onCountryHover,
      onMapClick,
      onFeatureClick,
      onReady,
      selectedCountryId,
      isMeasuring = false,
      initialCenter,
      initialZoom,
      className = "",
      geographyFilter,
      projectionMode = "dynamic",
      topCountryNames,
      labelsVisible = true,
      onZoomChange,
      overlayData,
      onRouteClick,
      showOceanLabels = false,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [debugError, setDebugError] = useState<string | null>(null);

    const tooltipPopupRef = useRef<any>(null);
    const fullLayerDataRef = useRef<Map<string, FeatureCollection>>(new Map());
    const labelFeaturesRef = useRef<FeatureCollection | null>(null);

    useImperativeHandle(ref, () => ({
      flyTo: (lng: number, lat: number, zoom = 4) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1500 });
      },
      fitBounds: (bounds: [[number, number], [number, number]], padding = 50) => {
        mapRef.current?.fitBounds(bounds, { padding, duration: 1500 });
      },
      getMap: () => mapRef.current,
    }));

    const { updateDistanceFade } = useWorldMapInteractions({
      map: mapRef.current,
      isLoaded,
      layers,
      geographyFilter,
      topCountryNames,
      selectedCountryId,
      isMeasuring,
      onCountryClick,
      onCountryHover,
      onMapClick,
      onFeatureClick,
      onZoomChange,
      labelFeaturesRef,
      tooltipPopupRef,
    });

    useWorldMapLayers({
      map: mapRef.current,
      isLoaded,
      layers,
      projectionMode,
      topCountryNames,
      updateDistanceFade,
      labelFeaturesRef,
      fullLayerDataRef,
      theme,
      showOceanLabels,
      labelsVisible,
    });

    useWorldMapOverlayFeatures({
      map: mapRef.current,
      isLoaded,
      capitals,
      overlayFeatures,
      theme,
      selectedCountryId,
    });

    useWorldMapDataOverlays({
      map: mapRef.current,
      isLoaded,
      overlayFeatures,
      overlayVisibility,
      labelsVisible,
      theme,
      selectedCountryId,
    });

    // Handle theme changes
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;
      try {
        // oxlint-disable-next-line
        const newStyle = buildBaseStyle(theme, projectionMode);
        map.setStyle(newStyle as any, { diff: true });
      } catch (err) {
        console.warn("[IxWorldMap] setStyle error:", err);
      }
    }, [theme, isLoaded]);

    // Initialize a standalone MapLibre instance for the main world map.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      // Borrow the persistent "world" instance (kept warm across navigation).
      const init = () => {
        const handle = acquireSurface("world", {
          container: el,
          initialCenter: initialCenter || MAP_DEFAULTS.center,
          initialZoom: initialZoom ?? MAP_DEFAULTS.zoom,
          minZoom: MAP_DEFAULTS.minZoom,
          maxZoom: MAP_DEFAULTS.maxZoom,
          theme,
          projectionMode,
          interactive: true,
          onCreate: (map, maplibregl) => {
            map.__mlgl = maplibregl;
            map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
          },
          onReady: (map) => {
            mapRef.current = map;

            // Remove stale zoomend handlers to prevent setData zoom thrashing
            if (map.__ixZoomHandler) {
              map.off("zoomend", map.__ixZoomHandler);
              map.__ixZoomHandler = undefined;
            }

            // Tooltip popup lives on the persistent instance; reuse across mounts.
            if (!map.__ixTooltip) {
              map.__ixTooltip = new map.__mlgl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: "ixmap-feature-tooltip",
                offset: 12,
                maxWidth: "220px",
              });
            }
            tooltipPopupRef.current = map.__ixTooltip;

            setIsLoaded(true);
            onReady?.();
          },
        });

        handle.ready.catch((err) => {
          console.error("[IxWorldMap] init error:", err);
          setDebugError(`Load error: ${err instanceof Error ? err.message : String(err)}`);
        });
        return handle;
      };

      // A 0×0 container (hidden tab, collapsed panel, unsettled layout) can't host a map yet —
      // wait for it to get a size instead of giving up.
      let handle: ReturnType<typeof acquireSurface> | null = null;
      let ro: ResizeObserver | null = null;
      const hasSize = () => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      if (hasSize()) {
        handle = init();
      } else {
        ro = new ResizeObserver(() => {
          if (handle || !hasSize()) return;
          ro?.disconnect();
          handle = init();
        });
        ro.observe(el);
      }

      return () => {
        ro?.disconnect();
        handle?.release();
        mapRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className={`absolute inset-0 ${className}`} style={{ position: "absolute", inset: 0 }}>
        <div
          ref={containerRef}
          className="touch-none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {debugError && (
          <div
            role="alert"
            className="bg-surface absolute inset-0 flex items-center justify-center p-4"
          >
            <Card className="max-w-lg p-4">
              <p className="text-destructive font-semibold">The map engine failed to start</p>
              <pre className="text-label text-footnote mt-2 whitespace-pre-wrap">{debugError}</pre>
            </Card>
          </div>
        )}
        {!isLoaded && !debugError && (
          <div
            className="bg-fill-3 absolute inset-0 flex items-center justify-center"
            role="status"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="border-separator border-t-blue h-8 w-8 animate-spin rounded-full border-4" />
              <p className="text-label-secondary text-body">Loading map...</p>
            </div>
          </div>
        )}

        {isLoaded && (
          <Suspense fallback={null}>
            {OVERLAY_LIST.map((def) => {
              const Component = def.component;
              if (!Component || !def.renderProps) return null;
              const isVisible = overlayVisibility?.[def.id] ?? false;
              if (!isVisible) return null; // Only mount when visible
              const data = overlayData?.[def.id];
              if (data === undefined || data === null) return null;
              const props = def.renderProps({
                map: mapRef.current,
                data,
                visible: true,
                onRouteClick: onRouteClick ? (id) => onRouteClick(id) : undefined,
              });
              if (!props) return null;
              return <Component key={`${def.id}-overlay`} {...props} />;
            })}
          </Suspense>
        )}
      </div>
    );
  })
);

export default IxWorldMap;
