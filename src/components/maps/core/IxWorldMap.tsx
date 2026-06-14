// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * IxWorldMap - Core MapLibre GL JS component for the IxEarth fictional world.
 *
 * Features:
 * - Globe projection at low zoom, transitions to mercator at higher zoom
 * - Renders all map layers from GeoJSON data
 * - Country click/hover interactions
 * - Clean, minimal Google Maps-like visual style
 */

import { useRef, useEffect, forwardRef, useImperativeHandle, useState, memo } from "react";
import type { FeatureCollection } from "geojson";
import type { MapLayerType } from "~/lib/map-config";
import { MAP_DEFAULTS, buildBaseStyle } from "~/lib/map-config";

import { Suspense } from "react";

// Overlay components + their wiring
import { OVERLAY_LIST } from "~/lib/overlay-registry";

// Hooks & Helpers
import { useWorldMapLayers } from "./hooks/useWorldMapLayers";
import { useWorldMapInteractions } from "./hooks/useWorldMapInteractions";
import { useWorldMapOverlayFeatures } from "./hooks/useWorldMapOverlayFeatures";
import { useWorldMapDataOverlays } from "./hooks/useWorldMapDataOverlays";

import { getMinArea, filterByArea, PROGRESSIVE_THRESHOLDS } from "./utils/map-core-helpers";

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
  screenX: number;
  screenY: number;
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

export interface IxWorldMapProps {
  layers: any[];
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

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      flyTo: (lng: number, lat: number, zoom = 4) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1500 });
      },
      fitBounds: (bounds: [[number, number], [number, number]], padding = 50) => {
        mapRef.current?.fitBounds(bounds, { padding, duration: 1500 });
      },
      getMap: () => mapRef.current,
    }));

    // ── 1. Hook: Manage Interactions & Event Listeners ──
    const { updateDistanceFade } = useWorldMapInteractions({
      map: mapRef.current,
      isLoaded,
      layers,
      overlayVisibility,
      labelsVisible,
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

    // ── 2. Hook: Manage Base Topography & Boundaries Layers ──
    useWorldMapLayers({
      map: mapRef.current,
      isLoaded,
      layers,
      projectionMode,
      topCountryNames,
      updateDistanceFade,
      labelFeaturesRef,
      fullLayerDataRef,
    });

    // ── 3. Hook: Manage Capitals & subdivisions Overlays ──
    useWorldMapOverlayFeatures({
      map: mapRef.current,
      isLoaded,
      capitals,
      overlayFeatures,
    });

    // ── 4. Hook: Manage Story Pins, Labels & Data Overlays ──
    useWorldMapDataOverlays({
      map: mapRef.current,
      isLoaded,
      overlayFeatures,
      overlayVisibility,
      labelsVisible,
    });

    // Initialize MapLibre Map instance
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;

      let cancelled = false;

      async function initMap() {
        try {
          const mod = await import("maplibre-gl");
          const maplibregl = (
            "Map" in mod ? mod : (mod as Record<string, unknown>).default
          ) as typeof mod;

          if (cancelled || !containerRef.current) return;

          const rect = containerRef.current.getBoundingClientRect();

          if (rect.width === 0 || rect.height === 0) {
            setDebugError(`Container has zero size: ${rect.width}x${rect.height}`);
            return;
          }

          const map = new maplibregl.Map({
            container: containerRef.current,
            style: buildBaseStyle() as maplibregl.StyleSpecification,
            center: initialCenter || MAP_DEFAULTS.center,
            zoom: initialZoom ?? MAP_DEFAULTS.zoom,
            minZoom: MAP_DEFAULTS.minZoom,
            maxZoom: MAP_DEFAULTS.maxZoom,
            attributionControl: false,
            dragRotate: false,
            touchPitch: false,
          });

          map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

          mapRef.current = map;

          // Progressive feature loading based on zoom
          let lastFilterZoom = -1;
          const dataRef = fullLayerDataRef;
          map.on("zoom", () => {
            const zoom = map.getZoom();

            const zoomBucket = Math.floor(zoom);
            if (zoomBucket !== lastFilterZoom) {
              lastFilterZoom = zoomBucket;
              for (const layerType of Object.keys(PROGRESSIVE_THRESHOLDS)) {
                const sourceId = `source-${layerType}`;
                const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
                const fullData = dataRef.current.get(layerType);
                if (!source || !fullData) continue;
                const minArea = getMinArea(layerType, zoom);
                source.setData(filterByArea(fullData, minArea));
              }
            }
          });

          map.on("load", () => {
            if (cancelled) return;

            tooltipPopupRef.current = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
              className: "ixmap-feature-tooltip",
              offset: 12,
              maxWidth: "220px",
            });

            setIsLoaded(true);
            onReady?.();
          });

          map.on("error", (e: any) => {
            const msg = e?.error?.message || e?.message || "";
            if (msg) console.warn("[IxWorldMap] map error:", msg);
          });
        } catch (err) {
          console.error("[IxWorldMap] initMap error:", err);
          setDebugError(`Init error: ${err instanceof Error ? err.message : String(err)}`);
        }
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

    return (
      <div className={`absolute inset-0 ${className}`} style={{ position: "absolute", inset: 0 }}>
        <div
          ref={containerRef}
          className="touch-none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {debugError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-4">
            <div className="max-w-lg rounded-lg bg-white p-4 shadow-lg">
              <p className="font-bold text-red-600">MapLibre import debug:</p>
              <pre className="text-foreground mt-2 text-xs whitespace-pre-wrap">{debugError}</pre>
            </div>
          </div>
        )}
        {!isLoaded && !debugError && (
          <div className="bg-muted absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-blue-500" />
              <p className="text-muted-foreground text-sm">Loading map...</p>
            </div>
          </div>
        )}

        {/* Dynamic Overlay Components */}
        {isLoaded && (
          <Suspense fallback={null}>
            {OVERLAY_LIST.map((def) => {
              const Component = def.component;
              if (!Component || !def.renderProps) return null;
              const data = overlayData?.[def.id];
              if (data === undefined || data === null) return null;
              const props = def.renderProps({
                map: mapRef.current,
                data,
                visible: overlayVisibility?.[def.id] ?? false,
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
