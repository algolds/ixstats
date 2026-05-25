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

import {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useState,
  memo,
} from "react";
import type { FeatureCollection } from "geojson";
import {
  LAYER_CONFIGS,
  MAP_DEFAULTS,
  INTERACTION_COLORS,
  WATER_BODY_LABELS,
  buildBaseStyle,
  MAP_SYMBOL_FONTS,
  getProjectionSpec,
  type MapLayerType,
  type ProjectionMode,
  DEMOTED_COUNTRY_NAMES,
} from "~/lib/map-config";

import { lazy, Suspense } from "react";

const ChoroplethOverlay = lazy(() =>
  import("~/components/maps/overlays/ChoroplethOverlay").then((m) => ({
    default: m.ChoroplethOverlay,
  }))
);
const RiskHeatmapOverlay = lazy(() =>
  import("~/components/maps/overlays/RiskHeatmapOverlay").then((m) => ({
    default: m.RiskHeatmapOverlay,
  }))
);
const GeopoliticalOverlay = lazy(() =>
  import("~/components/maps/overlays/GeopoliticalOverlay").then((m) => ({
    default: m.GeopoliticalOverlay,
  }))
);
const TransportOverlay = lazy(() =>
  import("~/components/maps/overlays/TransportOverlay").then((m) => ({
    default: m.TransportOverlay,
  }))
);
import { registerStoryPinIcons } from "~/lib/story-pin-icons";

// MapLibre types imported dynamically since the module requires browser APIs
type MapLibreMap = import("maplibre-gl").Map;

/** Data-driven opacity for country labels.
 *  Combines zoom/importance/area progressive reveal with distance-from-viewport fade.
 *  _distFade (0–1) is updated on camera move; labels far from center fade out when zoomed in.
 *  Top-25 countries (_importance=1) always visible, demoted (_importance=-1) only at zoom>=5.5. */
const COUNTRY_LABEL_OPACITY: unknown = ["coalesce", ["get", "_distFade"], 0];

/** Escape HTML entities for safe insertion into popup innerHTML */
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Area thresholds for progressive feature loading based on zoom */
const PROGRESSIVE_THRESHOLDS: Record<string, [number, number][]> = {
  // [zoom, minAreaSqKm] — features below threshold are hidden
  rivers: [
    [0, 3000],
    [3, 1000],
    [5, 200],
    [6, 0],
  ],
  lakes: [
    [0, 5000],
    [3, 1000],
    [5, 200],
    [6, 0],
  ],
};

/** Get the minimum area for a layer type at a given zoom level */
function getMinArea(layerType: string, zoom: number): number {
  const thresholds = PROGRESSIVE_THRESHOLDS[layerType];
  if (!thresholds) return 0;
  let minArea = thresholds[0][1];
  for (const [z, area] of thresholds) {
    if (zoom >= z) minArea = area;
  }
  return minArea;
}

/** Filter a FeatureCollection by minimum area */
function filterByArea(data: FeatureCollection, minArea: number): FeatureCollection {
  if (minArea <= 0) return data;
  return {
    ...data,
    features: data.features.filter((f) => {
      const area = (f.properties?._areaSqKm as number) ?? 0;
      return area >= minArea;
    }),
  };
}

export interface MapLayerData {
  type: MapLayerType;
  data: FeatureCollection;
  visible: boolean;
}

export interface SelectedCountry {
  featureId: string;
  displayName: string;
  fillColor: string;
  centroidLng: number;
  centroidLat: number;
  /** Linked IxStats country ID (null if unclaimed territory) */
  countryId: string | null;
}

/** Represents a clicked city, POI, or capital marker on the map */
export interface SelectedFeature {
  id: string;
  featureType: "city" | "poi" | "capital" | "storyPin";
  name: string;
  countryId: string;
  countryName: string;
  countrySlug: string | null;
  coordinates: [number, number];
  /** City-specific */
  cityType?: string;
  population?: number | null;
  isCapital?: boolean;
  /** POI-specific */
  category?: string;
  icon?: string | null;
  description?: string | null;
  /** Story Pin-specific */
  ixTimeYear?: number | null;
  eraLabel?: string | null;
  /** Wiki link */
  wikiPageTitle?: string | null;
}

export interface HoveredCountry extends SelectedCountry {
  /** Screen X relative to map container */
  screenX: number;
  /** Screen Y relative to map container */
  screenY: number;
}

/** GeoJSON FeatureCollection of capital city points */
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

/** Overlay feature collections from getAllMapFeatures */
export interface MapOverlayFeatures {
  cities: FeatureCollection;
  pois: FeatureCollection;
  subdivisions: FeatureCollection;
  storyPins?: FeatureCollection;
  mapLabels?: FeatureCollection;
}

/** Which overlays are visible */
export type OverlayVisibility = Record<
  | "cities"
  | "pois"
  | "subdivisions"
  | "wealth"
  | "population"
  | "diplomacy"
  | "crises"
  | "transport"
  | "storyPins"
  | "mapLabels",
  boolean
>;

export interface IxWorldMapProps {
  layers: MapLayerData[];
  capitals?: CapitalsGeoJson;
  /** Overlay features (cities, POIs, subdivisions) for the world map */
  overlayFeatures?: MapOverlayFeatures;
  /** Which overlay groups are currently visible */
  overlayVisibility?: OverlayVisibility;
  onCountryClick?: (country: SelectedCountry | null) => void;
  onCountryHover?: (country: HoveredCountry | null) => void;
  /** Raw map click with coordinates — fired regardless of whether a feature was hit */
  onMapClick?: (lng: number, lat: number) => void;
  /** Fired when a city, POI, or capital marker is clicked */
  onFeatureClick?: (feature: SelectedFeature | null) => void;
  /** Called once when the MapLibre engine has fully initialized */
  onReady?: () => void;
  selectedCountryId?: string | null;
  /** When true, suppress cursor management so MeasureTool controls it */
  isMeasuring?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
  /** Active geography filter — dims non-matching countries on the political layer */
  geographyFilter?: { type: "continent" | "region"; value: string } | null;
  /** Projection mode: dynamic (default), globe, or mercator */
  projectionMode?: ProjectionMode;
  /** Set of top-20 country names by composite importance — always labeled at any zoom */
  topCountryNames?: Set<string>;
  /** Whether text labels are visible (country names, ocean labels, etc.) */
  labelsVisible?: boolean;
  /** Fired when zoom level changes (for LOD-based data loading) */
  onZoomChange?: (zoom: number) => void;
  /** GeoJSON data for visualization overlays */
  overlayData?: {
    wealth?: import("geojson").FeatureCollection & {
      metadata?: { minVal: number; maxVal: number };
    };
    population?: import("geojson").FeatureCollection & {
      metadata?: { minVal: number; maxVal: number };
    };
    diplomacy?: {
      relations: import("geojson").FeatureCollection;
      conflicts: import("geojson").FeatureCollection;
    };
    crises?: {
      riskMap: import("geojson").FeatureCollection;
      crisisEvents: import("geojson").FeatureCollection;
    };
    transport?: import("geojson").FeatureCollection;
  };
  /** Called when user clicks a transport route on the map */
  onRouteClick?: (routeId: string) => void;
}

export interface IxWorldMapRef {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  fitBounds: (bounds: [[number, number], [number, number]], padding?: number) => void;
  getMap: () => MapLibreMap | null;
}

/**
 * Generate a 5-pointed star image as ImageData for MapLibre addImage().
 * Follows wiki/cartographic convention: filled star for national capitals.
 */
function createStarImage(size: number, fillColor: string, strokeColor: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 1;
  const innerR = outerR * 0.4;
  const spikes = 5;

  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 2) * -1 + (Math.PI / spikes) * i;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
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
    const hoveredFeatureIdRef = useRef<number | null>(null);
    // Lightweight hover tooltip popup (Google Maps–style)
    const tooltipPopupRef = useRef<import("maplibre-gl").Popup | null>(null);
    const hoveredOverlayIdRef = useRef<string | null>(null);
    const hoveredSubdivisionIdRef = useRef<number | null>(null);
    // Store full unfiltered data for progressive layers so we can re-filter on zoom
    const fullLayerDataRef = useRef<Map<string, FeatureCollection>>(new Map());
    // Store base label features for distance-fade updates on camera move
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

    const updateDistanceFade = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;

      const baseFeatures = labelFeaturesRef.current;
      if (!baseFeatures || baseFeatures.features.length === 0) return;
      const source = map.getSource("source-country-labels") as
        | { setData: (data: unknown) => void }
        | undefined;
      if (!source) return;

      const center = map.getCenter();
      const zoom = map.getZoom();

      // Compute visible radius in degrees based on viewport bounds
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

          // Always show top 25 countries at any zoom/position
          if (isTop) {
            return {
              ...f,
              properties: { ...props, _importance: 1, _distFade: 1 },
            };
          }

          // Demoted countries (small islands, etc.) only show at high zoom
          if (isDemoted) {
            if (zoom < 5.5) {
              return { ...f, properties: { ...props, _importance: -1, _distFade: 0 } };
            }
          }

          // Normal countries: progressive reveal based on zoom and distance from center
          const geometry = f.geometry;
          if (!("coordinates" in geometry)) return f;
          const coords = geometry.coordinates as [number, number];
          const dlng = coords[0] - center.lng;
          const dlat = coords[1] - center.lat;
          const dist = Math.sqrt(dlng * dlng + dlat * dlat);

          // Normalize: 0 at center, 1 at edge of viewport
          const normDist = dist / Math.max(viewRadius, 1);

          // Fade: full opacity within inner 60% of view, fading to 0 at 120%
          const rawFade = Math.max(0, Math.min(1, (1.2 - normDist) / 0.6));

          // Progressive zoom reveal: non-top countries start appearing at z=2.5, fully active at z=4.0
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
      source.setData(updated as unknown as GeoJSON.GeoJSON);
    }, [topCountryNames]);

    // Update projection when mode changes
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;
      const spec = getProjectionSpec(projectionMode);
      (map as unknown as { setProjection: (spec: unknown) => void }).setProjection(spec);
    }, [projectionMode, isLoaded]);

    // Initialize map
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

          // NavigationControl removed — zoom via scroll/pinch/keyboard.
          // Editor has its own compact zoom control in EditorMap.

          mapRef.current = map;

          // Progressive feature loading based on zoom
          let lastFilterZoom = -1;
          const dataRef = fullLayerDataRef;
          map.on("zoom", () => {
            const zoom = map.getZoom();

            // Update progressive layer data (debounced to whole zoom levels)
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

            // Equator and Prime Meridian reference lines
            map.addSource("graticule", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: { label: "Equator" },
                    geometry: {
                      type: "LineString",
                      coordinates: [
                        [-180, 0],
                        [180, 0],
                      ],
                    },
                  },
                  {
                    type: "Feature",
                    properties: { label: "Prime Meridian" },
                    geometry: {
                      type: "LineString",
                      coordinates: [
                        [56.1842, -90],
                        [56.1842, 90],
                      ],
                    },
                  },
                ],
              },
            });
            map.addLayer({
              id: "graticule-lines",
              type: "line",
              source: "graticule",
              paint: {
                "line-color": "rgba(0,0,0,0.12)",
                "line-width": 0.8,
                "line-dasharray": [6, 4],
              } as maplibregl.LineLayerSpecification["paint"],
            });

            // Ocean & sea name labels
            map.addSource("source-ocean-labels", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: WATER_BODY_LABELS.map((wb, i) => ({
                  type: "Feature" as const,
                  id: i,
                  geometry: { type: "Point" as const, coordinates: wb.coordinates },
                  properties: { name: wb.name, wbType: wb.type, rank: wb.rank },
                })),
              },
            });
            map.addLayer({
              id: "ocean-labels",
              type: "symbol",
              source: "source-ocean-labels",
              layout: {
                "text-field": ["get", "name"] as unknown as string,
                "text-font": [...MAP_SYMBOL_FONTS.regular],
                "text-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  0.5,
                  ["match", ["get", "rank"], "major", 14, "medium", 10, 8],
                  3,
                  ["match", ["get", "rank"], "major", 20, "medium", 14, 11],
                  6,
                  ["match", ["get", "rank"], "major", 26, "medium", 18, 14],
                ] as unknown as number,
                "text-letter-spacing": [
                  "match",
                  ["get", "rank"],
                  "major",
                  0.2,
                  "medium",
                  0.1,
                  0.05,
                ] as unknown as number,
                "text-allow-overlap": false,
                "text-max-width": 12,
                "text-padding": 5,
              },
              paint: {
                "text-color": [
                  "match",
                  ["get", "rank"],
                  "major",
                  "#1a5276",
                  "medium",
                  "#2874a6",
                  "#3498db",
                ] as unknown as string,
                "text-halo-color": "rgba(179, 205, 224, 0.6)",
                "text-halo-width": 1,
                "text-opacity": [
                  "step",
                  ["zoom"],
                  ["match", ["get", "rank"], "major", 0.8, 0],
                  1.5,
                  ["match", ["get", "rank"], "major", 0.9, "medium", 0.7, 0],
                  3,
                  0.9,
                ] as unknown as number,
              },
              minzoom: 0.5,
            });

            // Create lightweight hover tooltip popup
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

    // Add/update layers when data changes
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      // Sort layers by zIndex
      const sortedLayers = [...layers].sort(
        (a, b) => (LAYER_CONFIGS[a.type]?.zIndex ?? 0) - (LAYER_CONFIGS[b.type]?.zIndex ?? 0)
      );

      for (const layer of sortedLayers) {
        const sourceId = `source-${layer.type}`;
        const fillLayerId = `fill-${layer.type}`;
        const strokeLayerId = `stroke-${layer.type}`;
        const config = LAYER_CONFIGS[layer.type];
        if (!config) continue;

        try {
          // Store full data for progressive layers (rivers/lakes) so zoom handler can re-filter
          if (PROGRESSIVE_THRESHOLDS[layer.type]) {
            fullLayerDataRef.current.set(layer.type, layer.data);
          }

          // Apply area-based filtering for progressive layers
          const minArea = getMinArea(layer.type, map.getZoom());
          const sourceData = minArea > 0 ? filterByArea(layer.data, minArea) : layer.data;

          // Add or update source
          const existingSource = map.getSource(sourceId);
          if (existingSource) {
            (existingSource as maplibregl.GeoJSONSource).setData(sourceData);
          } else {
            map.addSource(sourceId, {
              type: "geojson",
              data: sourceData,
              generateId: true,
            });

            // Add line layer (rivers and other linear features)
            if (config.type === "line") {
              map.addLayer({
                id: fillLayerId,
                type: "line",
                source: sourceId,
                paint: {
                  "line-color": config.strokeColor ?? "#7cb5d2",
                  "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    0,
                    config.strokeWidth ?? 1,
                    6,
                    (config.strokeWidth ?? 1) * 3,
                  ],
                  "line-opacity": layer.visible ? 0.7 : 0,
                } as maplibregl.LineLayerSpecification["paint"],
                layout: {
                  "line-cap": "round",
                  "line-join": "round",
                },
              });
            }

            // Add fill layer
            if (config.type === "fill") {
              const fillPaint: Record<string, unknown> = {
                "fill-opacity": layer.visible ? config.fillOpacity : 0,
              };

              if (config.fillColor === "from-property") {
                fillPaint["fill-color"] = ["coalesce", ["get", "_fillColor"], "#e8e5da"];
              } else {
                fillPaint["fill-color"] = config.fillColor;
              }

              map.addLayer({
                id: fillLayerId,
                type: "fill",
                source: sourceId,
                paint: fillPaint as maplibregl.FillLayerSpecification["paint"],
              });

              // Add stroke layer for political boundaries
              if (config.strokeColor) {
                map.addLayer({
                  id: strokeLayerId,
                  type: "line",
                  source: sourceId,
                  paint: {
                    "line-color": config.strokeColor,
                    "line-width": config.strokeWidth ?? 1,
                    "line-opacity": layer.visible ? 0.8 : 0,
                  },
                });
              }

              // Sovereignty visual layers (only for political)
              if (layer.type === "political") {
                // Dashed border around subject territories
                if (!map.getLayer("sovereignty-border")) {
                  map.addLayer({
                    id: "sovereignty-border",
                    type: "line",
                    source: sourceId,
                    filter: ["has", "_sovereignId"],
                    paint: {
                      "line-color": ["coalesce", ["get", "_fillColor"], "#888"] as any,
                      "line-width": 2.5,
                      "line-dasharray": [4, 2],
                      "line-opacity": layer.visible ? 0.7 : 0,
                    },
                  });
                }

                // Relationship label at subject territory centroids
                if (!map.getLayer("sovereignty-labels")) {
                  map.addLayer({
                    id: "sovereignty-labels",
                    type: "symbol",
                    source: sourceId,
                    filter: ["has", "_sovereignId"],
                    layout: {
                      "text-field": [
                        "concat",
                        ["get", "_displayName"],
                        "\n",
                        ["get", "_relationLabel"],
                        " of ",
                        ["get", "_sovereignName"],
                      ] as any,
                      "text-size": 9,
                      "text-offset": [0, 1.5],
                      "text-allow-overlap": false,
                    },
                    paint: {
                      "text-color": "#6b5b3d",
                      "text-halo-color": "#ffffff",
                      "text-halo-width": 1.5,
                    },
                    minzoom: 4,
                  });
                }
              }
            }

            // Handle country_labels layer: update source-country-labels
            if (layer.type === "country_labels") {
              labelFeaturesRef.current = layer.data;
              const existingLabelSource = map.getSource("source-country-labels") as
                | maplibregl.GeoJSONSource
                | undefined;
              if (existingLabelSource) {
                existingLabelSource.setData(layer.data as unknown as GeoJSON.GeoJSON);
                updateDistanceFade();
              } else {
                console.log("[IxWorldMap] Initializing country labels layer", {
                  featureCount: (layer.data as any)?.features?.length,
                });
                map.addSource("source-country-labels", {
                  type: "geojson",
                  data: layer.data as unknown as GeoJSON.GeoJSON,
                });
                map.addLayer({
                  id: "country-name-labels",
                  type: "symbol",
                  source: "source-country-labels",
                  layout: {
                    "text-field": ["get", "_displayName"] as unknown as string,
                    "text-font": [...MAP_SYMBOL_FONTS.regular],
                    "text-size": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      1.5,
                      10,
                      3,
                      12,
                      5,
                      14,
                    ] as unknown as number,
                    "text-allow-overlap": false,
                    "text-ignore-placement": false,
                    "text-optional": true,
                    "text-padding": 2,
                    "text-max-width": 8,
                  },
                  paint: {
                    "text-color": "#2c2c2c",
                    "text-halo-color": "#ffffff",
                    "text-halo-width": 1.8,
                    "text-halo-blur": 0.5,
                    "text-opacity": COUNTRY_LABEL_OPACITY as unknown as number,
                  },
                  minzoom: 1.5,
                });
                updateDistanceFade();
              }
              // Ensure visibility is synced
              if (map.getLayer("country-name-labels")) {
                map.setLayoutProperty(
                  "country-name-labels",
                  "visibility",
                  layer.visible ? "visible" : "none"
                );
              }
              continue;
            }
          }
        } catch (err) {
          console.error("[IxWorldMap] Failed to add layer", layer.type, err);
        }

        // Update visibility
        const fillLayer = map.getLayer(fillLayerId);
        if (fillLayer) {
          // Political layer uses data-driven expression for hover highlight
          if (layer.type === "political") {
            map.setPaintProperty(
              fillLayerId,
              "fill-opacity",
              layer.visible
                ? ["case", ["boolean", ["feature-state", "hover"], false], 0.6, config.fillOpacity]
                : 0
            );
          } else if (layer.type === "altitudes") {
            // When political layer is off, boost altitude opacity for vivid topo colors
            const politicalVisible = sortedLayers.some((l) => l.type === "political" && l.visible);
            map.setPaintProperty(
              fillLayerId,
              "fill-opacity",
              layer.visible ? (politicalVisible ? config.fillOpacity : 1.0) : 0
            );
          } else if (config.type === "line") {
            map.setPaintProperty(fillLayerId, "line-opacity", layer.visible ? 0.7 : 0);
          } else {
            map.setPaintProperty(
              fillLayerId,
              "fill-opacity",
              layer.visible ? config.fillOpacity : 0
            );
          }
        }
        const strokeLayer = map.getLayer(strokeLayerId);
        if (strokeLayer) {
          map.setPaintProperty(strokeLayerId, "line-opacity", layer.visible ? 0.8 : 0);
        }

        // Sovereignty layers follow political visibility
        if (layer.type === "political") {
          if (map.getLayer("sovereignty-border")) {
            map.setPaintProperty("sovereignty-border", "line-opacity", layer.visible ? 0.7 : 0);
          }
          if (map.getLayer("sovereignty-labels")) {
            map.setPaintProperty("sovereignty-labels", "text-opacity", layer.visible ? 1 : 0);
          }
          if (map.getLayer("country-name-labels")) {
            map.setPaintProperty(
              "country-name-labels",
              "text-opacity",
              layer.visible ? (COUNTRY_LABEL_OPACITY as unknown as number) : 0
            );
          }
        }
      }
    }, [layers, isLoaded, topCountryNames, updateDistanceFade]);

    // Geography filter — dim non-matching countries when a continent/region badge is clicked
    useEffect(() => {
      const map = mapRef.current;
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
          0.6, // Full opacity for matching countries
          0.08, // Dimmed for non-matching
        ]);
        // Dim country labels for non-matching countries
        if (map.getLayer("country-name-labels")) {
          map.setPaintProperty("country-name-labels", "text-opacity", [
            "case",
            ["==", ["get", propKey], geographyFilter.value],
            COUNTRY_LABEL_OPACITY,
            0.1,
          ] as unknown as number);
        }
      } else if (isVisible) {
        // Restore normal hover-based opacity
        map.setPaintProperty(fillLayerId, "fill-opacity", [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.6,
          LAYER_CONFIGS.political.fillOpacity,
        ]);
        // Restore normal country label opacity
        if (map.getLayer("country-name-labels")) {
          map.setPaintProperty(
            "country-name-labels",
            "text-opacity",
            COUNTRY_LABEL_OPACITY as unknown as number
          );
        }
      }
    }, [geographyFilter, isLoaded, layers]);

    // Distance-fade: update _distFade on labels when camera moves so far-away labels fade out
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      map.on("moveend", updateDistanceFade);
      map.on("zoomend", updateDistanceFade);

      // Fire zoom change callback for LOD-based data loading
      const handleZoomChange = () => {
        onZoomChange?.(Math.round(map.getZoom() * 10) / 10);
      };
      map.on("zoomend", handleZoomChange);

      return () => {
        map.off("moveend", updateDistanceFade);
        map.off("zoomend", updateDistanceFade);
        map.off("zoomend", handleZoomChange);
      };
    }, [isLoaded, onZoomChange, updateDistanceFade]);

    // Render capital city markers
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded || !capitals || capitals.features.length === 0) return;

      const sourceId = "source-capitals";
      const starLayerId = "capitals-star";
      const labelLayerId = "capitals-label";

      try {
        // Add star image if not yet loaded
        if (!map.hasImage("capital-star")) {
          const starImg = createStarImage(24, "#d4a017", "#7a5c00");
          map.addImage("capital-star", starImg, { sdf: false });
        }

        // Add or update source
        const existing = map.getSource(sourceId);
        if (existing) {
          (existing as maplibregl.GeoJSONSource).setData(capitals as unknown as GeoJSON.GeoJSON);
        } else {
          map.addSource(sourceId, {
            type: "geojson",
            data: capitals as unknown as GeoJSON.GeoJSON,
          });

          // Star icon layer
          map.addLayer({
            id: starLayerId,
            type: "symbol",
            source: sourceId,
            layout: {
              "icon-image": "capital-star",
              "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                0.45,
                5,
                0.7,
                8,
                0.9,
              ] as unknown as number,
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
            paint: {
              "icon-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3,
                0.7,
                4,
                1,
              ] as unknown as number,
            },
            minzoom: 3,
          });

          // City name label (appears at higher zoom)
          map.addLayer({
            id: labelLayerId,
            type: "symbol",
            source: sourceId,
            layout: {
              "text-field": ["get", "name"] as unknown as string,
              "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 8, 13] as unknown as number,
              "text-offset": [0, 1.2],
              "text-anchor": "top",
              "text-allow-overlap": false,
              "text-optional": true,
              "text-font": [...MAP_SYMBOL_FONTS.regular],
            },
            paint: {
              "text-color": "#333",
              "text-halo-color": "#fff",
              "text-halo-width": 1.5,
            },
            minzoom: 4,
          });
        }
      } catch (err) {
        console.warn("[IxWorldMap] capitals layer error:", err);
      }
    }, [capitals, isLoaded]);

    // Render overlay features (non-capital cities, POIs, subdivisions)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded || !overlayFeatures) return;

      // --- Subdivisions (polygons, rendered first so circles sit on top) ---
      const subSource = "source-overlay-subdivisions";
      const subFillId = "overlay-subdivisions-fill";
      const subStrokeId = "overlay-subdivisions-stroke";
      const subLabelId = "overlay-subdivisions-label";

      try {
        if (map.getSource(subSource)) {
          (map.getSource(subSource) as maplibregl.GeoJSONSource).setData(
            overlayFeatures.subdivisions as unknown as GeoJSON.GeoJSON
          );
        } else {
          map.addSource(subSource, {
            type: "geojson",
            data: overlayFeatures.subdivisions as unknown as GeoJSON.GeoJSON,
            generateId: true,
          });
          map.addLayer({
            id: subFillId,
            type: "fill",
            source: subSource,
            paint: {
              "fill-color": "#a78bfa",
              "fill-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4,
                ["case", ["boolean", ["feature-state", "hover"], false], 0.15, 0.04],
                7,
                ["case", ["boolean", ["feature-state", "hover"], false], 0.25, 0.1],
              ] as unknown as number,
            },
            minzoom: 4,
          });
          map.addLayer({
            id: subStrokeId,
            type: "line",
            source: subSource,
            paint: {
              "line-color": "#7c3aed",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4,
                ["case", ["boolean", ["feature-state", "hover"], false], 1.5, 0.6],
                8,
                ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1.4],
              ] as unknown as number,
              "line-dasharray": [3, 2] as unknown as number[],
              "line-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4,
                0.5,
                6,
                0.8,
                8,
                1.0,
              ] as unknown as number,
            },
            minzoom: 4,
          });
          map.addLayer({
            id: subLabelId,
            type: "symbol",
            source: subSource,
            layout: {
              "text-field": ["get", "name"] as unknown as string,
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4,
                8,
                7,
                11,
                10,
                14,
              ] as unknown as number,
              "text-allow-overlap": false,
              "text-optional": true,
              "text-padding": 8 as unknown as number,
              "text-font": [...MAP_SYMBOL_FONTS.regular],
              // Larger regions show labels first via area-based priority
              "symbol-sort-key": [
                "case",
                ["has", "areaSqKm"],
                ["-", ["get", "areaSqKm"]],
                0,
              ] as unknown as number,
            },
            paint: {
              "text-color": "#6d28d9",
              "text-halo-color": "#fff",
              "text-halo-width": 1.5,
              "text-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4,
                0,
                5,
                0.7,
                7,
                1,
              ] as unknown as number,
            },
            minzoom: 4.5,
          });
        }
      } catch (err) {
        console.warn("[IxWorldMap] overlay subdivisions error:", err);
      }

      // --- Cities (non-capital) ---
      const citySource = "source-overlay-cities";
      const cityCircleId = "overlay-cities-circle";
      const cityLabelId = "overlay-cities-label";

      // Filter out capitals (already shown as gold stars)
      const nonCapitalCities: FeatureCollection = {
        ...overlayFeatures.cities,
        features: overlayFeatures.cities.features.filter((f) => !f.properties?.isCapital),
      };

      try {
        const enableCityClustering = nonCapitalCities.features.length > 50;
        if (map.getSource(citySource)) {
          (map.getSource(citySource) as maplibregl.GeoJSONSource).setData(
            nonCapitalCities as unknown as GeoJSON.GeoJSON
          );
        } else {
          map.addSource(citySource, {
            type: "geojson",
            data: nonCapitalCities as unknown as GeoJSON.GeoJSON,
            ...(enableCityClustering
              ? {
                  cluster: true,
                  clusterMaxZoom: 8,
                  clusterRadius: 40,
                }
              : {}),
          });

          if (enableCityClustering) {
            // Cluster circle layer — shows count when cities overlap at low zoom
            map.addLayer({
              id: `${cityCircleId}-cluster`,
              type: "circle",
              source: citySource,
              filter: ["has", "point_count"],
              paint: {
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  12,
                  10,
                  16,
                  50,
                  22,
                ] as unknown as number,
                "circle-color": [
                  "step",
                  ["get", "point_count"],
                  "#93c5fd",
                  10,
                  "#3b82f6",
                  50,
                  "#1e40af",
                ] as unknown as string,
                "circle-stroke-color": "#fff",
                "circle-stroke-width": 1.5,
              },
              minzoom: 3,
            });
            map.addLayer({
              id: `${cityCircleId}-cluster-count`,
              type: "symbol",
              source: citySource,
              filter: ["has", "point_count"],
              layout: {
                "text-field": "{point_count_abbreviated}",
                "text-size": 11,
                "text-font": [...MAP_SYMBOL_FONTS.regular],
              },
              paint: { "text-color": "#fff" },
              minzoom: 3,
            });
          }

          // Individual city circles (unclustered or all if < 50)
          map.addLayer({
            id: cityCircleId,
            type: "circle",
            source: citySource,
            ...(enableCityClustering ? { filter: ["!", ["has", "point_count"]] } : {}),
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4,
                ["case", ["==", ["get", "cityType"], "major"], 4.5, 3],
                8,
                ["case", ["==", ["get", "cityType"], "major"], 8, 6],
              ] as unknown as number,
              "circle-color": "#3b82f6",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1.2,
            },
            minzoom: 4,
          });
          map.addLayer({
            id: cityLabelId,
            type: "symbol",
            source: citySource,
            ...(enableCityClustering ? { filter: ["!", ["has", "point_count"]] } : {}),
            layout: {
              "text-field": ["get", "name"] as unknown as string,
              "text-size": ["interpolate", ["linear"], ["zoom"], 6, 9, 10, 12] as unknown as number,
              "text-offset": [0, 1.2],
              "text-anchor": "top" as const,
              "text-allow-overlap": false,
              "text-optional": true,
              "text-font": [...MAP_SYMBOL_FONTS.regular],
              // Priority by population — larger cities get labels first
              "symbol-sort-key": [
                "case",
                ["has", "population"],
                ["-", ["get", "population"]],
                0,
              ] as unknown as number,
            },
            paint: { "text-color": "#1e40af", "text-halo-color": "#fff", "text-halo-width": 1.5 },
            minzoom: 6,
          });
        }
      } catch (err) {
        console.warn("[IxWorldMap] overlay cities error:", err);
      }

      // --- POIs ---
      const poiSource = "source-overlay-pois";
      const poiCircleId = "overlay-pois-circle";
      const poiLabelId = "overlay-pois-label";

      try {
        const enablePoiClustering = overlayFeatures.pois.features.length > 30;
        if (map.getSource(poiSource)) {
          (map.getSource(poiSource) as maplibregl.GeoJSONSource).setData(
            overlayFeatures.pois as unknown as GeoJSON.GeoJSON
          );
        } else {
          map.addSource(poiSource, {
            type: "geojson",
            data: overlayFeatures.pois as unknown as GeoJSON.GeoJSON,
            ...(enablePoiClustering
              ? {
                  cluster: true,
                  clusterMaxZoom: 10,
                  clusterRadius: 35,
                }
              : {}),
          });

          if (enablePoiClustering) {
            map.addLayer({
              id: `${poiCircleId}-cluster`,
              type: "circle",
              source: poiSource,
              filter: ["has", "point_count"],
              paint: {
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  10,
                  5,
                  14,
                  20,
                  18,
                ] as unknown as number,
                "circle-color": [
                  "step",
                  ["get", "point_count"],
                  "#fcd34d",
                  5,
                  "#f59e0b",
                  20,
                  "#d97706",
                ] as unknown as string,
                "circle-stroke-color": "#fff",
                "circle-stroke-width": 1,
              },
              minzoom: 5,
            });
            map.addLayer({
              id: `${poiCircleId}-cluster-count`,
              type: "symbol",
              source: poiSource,
              filter: ["has", "point_count"],
              layout: {
                "text-field": "{point_count_abbreviated}",
                "text-size": 10,
                "text-font": [...MAP_SYMBOL_FONTS.regular],
              },
              paint: { "text-color": "#78350f" },
              minzoom: 5,
            });
          }

          map.addLayer({
            id: poiCircleId,
            type: "circle",
            source: poiSource,
            ...(enablePoiClustering ? { filter: ["!", ["has", "point_count"]] } : {}),
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6,
                2.5,
                10,
                5,
              ] as unknown as number,
              "circle-color": "#f59e0b",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1,
            },
            minzoom: 6,
          });
          map.addLayer({
            id: poiLabelId,
            type: "symbol",
            source: poiSource,
            ...(enablePoiClustering ? { filter: ["!", ["has", "point_count"]] } : {}),
            layout: {
              "text-field": ["get", "name"] as unknown as string,
              "text-size": ["interpolate", ["linear"], ["zoom"], 8, 8, 12, 11] as unknown as number,
              "text-offset": [0, 1.1],
              "text-anchor": "top" as const,
              "text-allow-overlap": false,
              "text-optional": true,
              "text-font": [...MAP_SYMBOL_FONTS.regular],
            },
            paint: { "text-color": "#92400e", "text-halo-color": "#fff", "text-halo-width": 1.2 },
            minzoom: 8,
          });
        }
      } catch (err) {
        console.warn("[IxWorldMap] overlay POIs error:", err);
      }

      // --- Story Pins (icon-based with glow + clustering) ---
      if (overlayFeatures.storyPins) {
        const spSource = "source-story-pins";
        const spIconId = "story-pins-icon";
        const spGlowId = "story-pins-glow";
        const spLabelId = "story-pins-label";
        const spClusterId = "story-pins-cluster";
        const spClusterCountId = "story-pins-cluster-count";

        try {
          // Register category icons (27 variants: 9 categories × 3 importance levels)
          registerStoryPinIcons(map);

          // Category color expression for fallback/glow/labels
          const SP_COLORS: Record<string, string> = {
            battle: "#dc2626",
            founding: "#2563eb",
            treaty: "#16a34a",
            cultural: "#9333ea",
            religious: "#ca8a04",
            natural: "#059669",
            trade: "#ea580c",
            exploration: "#0891b2",
            disaster: "#6b7280",
          };
          const colorExpr: unknown[] = ["match", ["get", "category"]];
          for (const [cat, color] of Object.entries(SP_COLORS)) {
            colorExpr.push(cat, color);
          }
          colorExpr.push("#6b7280");

          if (map.getSource(spSource)) {
            (map.getSource(spSource) as maplibregl.GeoJSONSource).setData(
              overlayFeatures.storyPins as unknown as GeoJSON.GeoJSON
            );
          } else {
            map.addSource(spSource, {
              type: "geojson",
              data: overlayFeatures.storyPins as unknown as GeoJSON.GeoJSON,
              cluster: true,
              clusterMaxZoom: 8,
              clusterRadius: 50,
            });

            // Cluster circles
            map.addLayer({
              id: spClusterId,
              type: "circle",
              source: spSource,
              filter: ["has", "point_count"],
              paint: {
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  16,
                  10,
                  22,
                  30,
                  28,
                ] as unknown as number,
                "circle-color": "#7c3aed",
                "circle-stroke-color": "#fff",
                "circle-stroke-width": 2,
                "circle-opacity": 0.85,
              },
              minzoom: 3,
            });

            // Cluster count label
            map.addLayer({
              id: spClusterCountId,
              type: "symbol",
              source: spSource,
              filter: ["has", "point_count"],
              layout: {
                "text-field": ["get", "point_count_abbreviated"] as unknown as string,
                "text-size": 12,
                "text-font": [...MAP_SYMBOL_FONTS.regular],
              },
              paint: {
                "text-color": "#ffffff",
              },
            });

            // Glow layer (behind icons) for major/legendary pins
            map.addLayer({
              id: spGlowId,
              type: "circle",
              source: spSource,
              filter: ["all", ["!", ["has", "point_count"]], [">=", ["get", "importance"], 1]],
              paint: {
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  4,
                  ["case", [">=", ["get", "importance"], 2], 18, 14],
                  8,
                  ["case", [">=", ["get", "importance"], 2], 28, 22],
                  12,
                  ["case", [">=", ["get", "importance"], 2], 36, 28],
                ] as unknown as number,
                "circle-color": colorExpr as unknown as string,
                "circle-opacity": [
                  "case",
                  [">=", ["get", "importance"], 2],
                  0.25,
                  0.15,
                ] as unknown as number,
                "circle-blur": 0.6,
              },
              minzoom: 3,
            });

            // Icon layer (unclustered points)
            map.addLayer({
              id: spIconId,
              type: "symbol",
              source: spSource,
              filter: ["!", ["has", "point_count"]],
              layout: {
                "icon-image": [
                  "concat",
                  "story-pin-",
                  ["get", "category"],
                  "-",
                  ["to-string", ["coalesce", ["get", "importance"], 0]],
                ] as unknown as string,
                "icon-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  3,
                  0.5,
                  6,
                  0.75,
                  10,
                  1,
                ] as unknown as number,
                "icon-allow-overlap": true,
                "icon-anchor": "center" as const,
              },
              minzoom: 3,
            });

            // Title label layer
            map.addLayer({
              id: spLabelId,
              type: "symbol",
              source: spSource,
              filter: ["!", ["has", "point_count"]],
              layout: {
                "text-field": ["get", "title"] as unknown as string,
                "text-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  5,
                  8,
                  10,
                  11,
                ] as unknown as number,
                "text-offset": [0, 1.8],
                "text-anchor": "top" as const,
                "text-allow-overlap": false,
                "text-optional": true,
                "text-max-width": 12,
                "text-font": [
                  "case",
                  [">=", ["coalesce", ["get", "importance"], 0], 1],
                  ["literal", [...MAP_SYMBOL_FONTS.bold]],
                  ["literal", [...MAP_SYMBOL_FONTS.sans]],
                ] as unknown as string[],
              },
              paint: {
                "text-color": colorExpr as unknown as string,
                "text-halo-color": "#fff",
                "text-halo-width": 1.5,
              },
              minzoom: 5,
            });
          }
        } catch (err) {
          console.warn("[IxWorldMap] story pins error:", err);
        }
      }

      // --- Custom Map Labels ---
      if (overlayFeatures.mapLabels) {
        const mlSource = "source-map-labels";
        const mlLayerId = "custom-map-labels";

        try {
          if (map.getSource(mlSource)) {
            (map.getSource(mlSource) as maplibregl.GeoJSONSource).setData(
              overlayFeatures.mapLabels as unknown as GeoJSON.GeoJSON
            );
          } else {
            map.addSource(mlSource, {
              type: "geojson",
              data: overlayFeatures.mapLabels as unknown as GeoJSON.GeoJSON,
            });
            map.addLayer({
              id: mlLayerId,
              type: "symbol",
              source: mlSource,
              layout: {
                "text-field": ["get", "text"] as unknown as string,
                "text-size": ["get", "fontSize"] as unknown as number,
                "text-rotate": ["get", "rotation"] as unknown as number,
                "text-letter-spacing": ["get", "letterSpacing"] as unknown as number,
                "text-font": [
                  "case",
                  ["==", ["get", "fontWeight"], "bold"],
                  ["literal", [...MAP_SYMBOL_FONTS.bold]],
                  ["literal", [...MAP_SYMBOL_FONTS.regular]],
                ] as unknown as string[],
                "text-allow-overlap": false,
                "text-optional": true,
                "text-max-width": 30,
              },
              paint: {
                "text-color": ["get", "color"] as unknown as string,
                "text-opacity": ["get", "opacity"] as unknown as number,
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.5,
                "text-halo-blur": 0.5,
              },
              minzoom: 3,
            });
          }
        } catch (err) {
          console.warn("[IxWorldMap] map labels error:", err);
        }
      }
    }, [overlayFeatures, isLoaded]);

    // Update overlay visibility
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded || !overlayVisibility) return;

      const overlayLayers: Record<string, string[]> = {
        cities: [
          "overlay-cities-circle",
          "overlay-cities-label",
          "overlay-cities-circle-cluster",
          "overlay-cities-circle-cluster-count",
        ],
        pois: [
          "overlay-pois-circle",
          "overlay-pois-label",
          "overlay-pois-circle-cluster",
          "overlay-pois-circle-cluster-count",
        ],
        subdivisions: [
          "overlay-subdivisions-fill",
          "overlay-subdivisions-stroke",
          "overlay-subdivisions-label",
        ],
        storyPins: [
          "story-pins-icon",
          "story-pins-glow",
          "story-pins-label",
          "story-pins-cluster",
          "story-pins-cluster-count",
        ],
        mapLabels: ["custom-map-labels"],
      };

      for (const [key, layerIds] of Object.entries(overlayLayers)) {
        const visible = overlayVisibility[key as keyof OverlayVisibility];
        for (const id of layerIds) {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
          }
        }
      }
    }, [overlayVisibility, isLoaded]);

    // Toggle all text label layers on/off
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const labelLayerIds = [
        "country-name-labels",
        "sovereignty-labels",
        "ocean-labels",
        "capitals-label",
        "capitals-star",
        "overlay-subdivisions-label",
        "overlay-cities-label",
        "overlay-pois-label",
      ];

      for (const id of labelLayerIds) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", labelsVisible ? "visible" : "none");
        }
      }
    }, [labelsVisible, isLoaded]);

    // Check if a screen point is outside the visible globe disc (globe projection only)
    const isOutsideGlobe = useCallback(
      (map: maplibregl.Map, point: { x: number; y: number }): boolean => {
        if (map.getZoom() >= 4) return false; // fully mercator, no globe clipping needed
        const canvas = map.getCanvas();
        const cx = canvas.clientWidth / 2;
        const cy = canvas.clientHeight / 2;
        const dx = point.x - cx;
        const dy = point.y - cy;
        const cursorDistSq = dx * dx + dy * dy;
        // Estimate globe radius: project a point 88° from center along meridian
        const center = map.getCenter();
        let edgeLat = center.lat - 88;
        if (edgeLat < -90) edgeLat = center.lat + 88;
        const edgeScreen = map.project({ lng: center.lng, lat: edgeLat });
        const rx = edgeScreen.x - cx;
        const ry = edgeScreen.y - cy;
        const radiusSq = rx * rx + ry * ry;
        return radiusSq > 0 && cursorDistSq > radiusSq;
      },
      []
    );

    // Handle country hover + overlay feature tooltips
    const handleMouseMove = useCallback(
      (e: maplibregl.MapMouseEvent) => {
        const map = mapRef.current;
        if (!map || !map.getLayer("fill-political")) return;

        // In globe mode, ignore interactions outside the visible globe disc
        if (isOutsideGlobe(map, e.point)) {
          if (hoveredFeatureIdRef.current !== null) {
            map.setFeatureState(
              { source: "source-political", id: hoveredFeatureIdRef.current },
              { hover: false }
            );
            hoveredFeatureIdRef.current = null;
          }
          onCountryHover?.(null);
          // Hide tooltip and clear subdivision hover
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
          if (!isMeasuring) map.getCanvas().style.cursor = "";
          return;
        }

        // --- Overlay feature tooltip (Google Maps–style) ---
        const overlayLayerIds = [
          "overlay-cities-circle",
          "capitals-star",
          "overlay-pois-circle",
          "overlay-subdivisions-fill",
          "story-pins-icon",
        ].filter((id) => map.getLayer(id));

        let overlayHit: maplibregl.MapGeoJSONFeature | null = null;
        if (overlayLayerIds.length > 0) {
          const hits = map.queryRenderedFeatures(e.point, { layers: overlayLayerIds });
          if (hits.length > 0) overlayHit = hits[0];
        }

        if (overlayHit) {
          const props = overlayHit.properties ?? {};
          const name = String(props.name ?? props.title ?? "");
          const layerId = overlayHit.layer?.id ?? "";
          const featureKey = `${layerId}:${props.id ?? name}`;

          // Subdivision hover highlight (feature state)
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

          // Only update popup if we moved to a different feature
          if (featureKey !== hoveredOverlayIdRef.current && name) {
            hoveredOverlayIdRef.current = featureKey;

            // Build label with type hint
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
            // Same feature — just reposition for subdivisions (large polygons)
            tooltipPopupRef.current?.setLngLat(e.lngLat);
          }

          if (!isMeasuring) map.getCanvas().style.cursor = "pointer";
        } else {
          // No overlay hit — hide tooltip and clear subdivision highlight
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

        // --- Country hover highlight ---
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["fill-political"],
        });

        // Reset previous hover
        if (hoveredFeatureIdRef.current !== null) {
          map.setFeatureState(
            { source: "source-political", id: hoveredFeatureIdRef.current },
            { hover: false }
          );
        }

        if (features.length > 0) {
          const feature = features[0];
          const featureId = feature.id as number;
          hoveredFeatureIdRef.current = featureId;

          map.setFeatureState({ source: "source-political", id: featureId }, { hover: true });

          if (!isMeasuring && !overlayHit) map.getCanvas().style.cursor = "pointer";

          onCountryHover?.({
            featureId: feature.properties?._id || "",
            displayName: feature.properties?._displayName || "Unknown",
            fillColor: feature.properties?._fillColor || "#e8e5da",
            centroidLng: feature.properties?._centroidLng || 0,
            centroidLat: feature.properties?._centroidLat || 0,
            countryId: (feature.properties?._countryId as string) || null,
            screenX: e.point.x,
            screenY: e.point.y,
          });
        } else {
          hoveredFeatureIdRef.current = null;
          onCountryHover?.(null);
          if (!isMeasuring && !overlayHit) map.getCanvas().style.cursor = "";
        }
      },
      [onCountryHover, isOutsideGlobe, isMeasuring]
    );

    // Handle country + feature click
    const handleClick = useCallback(
      (e: maplibregl.MapMouseEvent) => {
        const map = mapRef.current;
        if (!map) return;

        // Always fire raw map click with coordinates
        onMapClick?.(e.lngLat.lng, e.lngLat.lat);

        // Hide hover tooltip on click
        tooltipPopupRef.current?.remove();
        hoveredOverlayIdRef.current = null;

        // In globe mode, ignore clicks outside the visible globe disc
        if (isOutsideGlobe(map, e.point)) return;

        // 1. Check overlay features first (cities > capitals > POIs)
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
            const coords = (hit.geometry as GeoJSON.Point).coordinates as [number, number];
            const layerId = hit.layer?.id;

            const featureType: "city" | "poi" | "capital" | "storyPin" =
              layerId === "story-pins-icon"
                ? "storyPin"
                : layerId === "overlay-pois-circle"
                  ? "poi"
                  : layerId === "capitals-star"
                    ? "capital"
                    : "city";

            const selected: SelectedFeature = {
              id: String(props.id ?? ""),
              featureType: featureType as SelectedFeature["featureType"],
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

            onFeatureClick?.(selected);
            return; // Don't also select the country underneath
          }
        }

        // 2. Fall through to political layer — clear any feature selection
        onFeatureClick?.(null);

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

          onCountryClick?.(country);
        } else {
          onCountryClick?.(null);
        }
      },
      [onCountryClick, onMapClick, onFeatureClick, isOutsideGlobe]
    );

    // Attach event listeners
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      map.on("mousemove", handleMouseMove);
      map.on("click", handleClick);

      // Clean up tooltip when mouse leaves the map
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
      };
      map.getCanvas().addEventListener("mouseleave", handleMouseLeave);

      return () => {
        map.off("mousemove", handleMouseMove);
        map.off("click", handleClick);
        map.getCanvas().removeEventListener("mouseleave", handleMouseLeave);
      };
    }, [isLoaded, handleMouseMove, handleClick]);

    // Handle selected country highlight
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      // Add or update selected country highlight layer
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

      // Clear all selected states
      const political = layers.find((l) => l.type === "political");
      if (political) {
        for (let i = 0; i < political.data.features.length; i++) {
          map.setFeatureState({ source: "source-political", id: i }, { selected: false });
        }

        // Set selected state
        if (selectedCountryId) {
          const idx = political.data.features.findIndex(
            (f) => (f.properties?._id || f.properties?.id) === selectedCountryId
          );
          if (idx >= 0) {
            map.setFeatureState({ source: "source-political", id: idx }, { selected: true });
          }
        }
      }
    }, [selectedCountryId, isLoaded, layers]);

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

        {/* Analytics overlay renderers (imperative — manage MapLibre sources/layers) */}
        <Suspense fallback={null}>
          {isLoaded && overlayData?.wealth && (
            <ChoroplethOverlay
              key="wealth-overlay"
              map={mapRef.current}
              data={overlayData.wealth}
              visible={overlayVisibility?.wealth ?? false}
              layerId="wealth"
              colorScale="wealth"
              metadata={overlayData.wealth.metadata}
            />
          )}
          {isLoaded && overlayData?.population && (
            <ChoroplethOverlay
              key="population-overlay"
              map={mapRef.current}
              data={overlayData.population}
              visible={overlayVisibility?.population ?? false}
              layerId="population"
              colorScale="population"
              metadata={overlayData.population.metadata}
            />
          )}
          {isLoaded && overlayData?.crises && (
            <RiskHeatmapOverlay
              map={mapRef.current}
              riskData={overlayData.crises.riskMap}
              crisisEvents={overlayData.crises.crisisEvents}
              visible={overlayVisibility?.crises ?? false}
            />
          )}
          {isLoaded && overlayData?.diplomacy && (
            <GeopoliticalOverlay
              map={mapRef.current}
              relations={overlayData.diplomacy.relations}
              conflicts={overlayData.diplomacy.conflicts}
              visible={overlayVisibility?.diplomacy ?? false}
            />
          )}
          {isLoaded && overlayData?.transport && (
            <TransportOverlay
              map={mapRef.current}
              routeData={overlayData.transport}
              visible={overlayVisibility?.transport ?? false}
              onRouteClick={onRouteClick ? (id) => onRouteClick(id) : undefined}
            />
          )}
        </Suspense>
      </div>
    );
  })
);

export default IxWorldMap;
