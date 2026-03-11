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
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import {
  MAP_DEFAULTS,
  OCEAN_COLOR,
  LAYER_CONFIGS,
} from "~/lib/map-config";

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
  /** Background map layers (world map context) */
  worldMapLayers?: import("~/components/maps/core/IxWorldMap").MapLayerData[];
}

const EditorMap = forwardRef<EditorMapRef, EditorMapProps>(
  function EditorMap(
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
      worldMapLayers,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const drawVerticesRef = useRef<[number, number][]>([]);
    const modeRef = useRef(mode);
    modeRef.current = mode;

    useImperativeHandle(ref, () => ({
      flyTo: (lng: number, lat: number, zoom = 6) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1000 });
      },
      getMap: () => mapRef.current,
    }));

    // Initialize map
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;
      let cancelled = false;

      async function initMap() {
        const mod = await import("maplibre-gl");
        const maplibregl = ("Map" in mod ? mod : (mod as Record<string, unknown>).default) as typeof mod;

        if (cancelled || !containerRef.current) return;

        const center: [number, number] = countryCentroid
          ? [countryCentroid.lng, countryCentroid.lat]
          : MAP_DEFAULTS.center;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            name: "IxEarth-Editor",
            sources: {},
            layers: [
              {
                id: "ocean-background",
                type: "background",
                paint: { "background-color": OCEAN_COLOR },
              },
            ],
          } as maplibregl.StyleSpecification,
          center,
          zoom: 4,
          minZoom: 1,
          maxZoom: 14,
          attributionControl: false,
        });

        map.addControl(
          new maplibregl.NavigationControl({ showCompass: true }),
          "top-right"
        );

        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;
          setIsLoaded(true);
        });
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

    // Render world map context layers (altitudes, rivers, lakes) as background
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded || !worldMapLayers || worldMapLayers.length === 0) return;

      // Sort by zIndex so altitude goes first, then rivers/lakes on top
      const sorted = [...worldMapLayers].sort(
        (a, b) => (LAYER_CONFIGS[a.type]?.zIndex ?? 0) - (LAYER_CONFIGS[b.type]?.zIndex ?? 0)
      );

      for (const layer of sorted) {
        const sourceId = `editor-ctx-${layer.type}`;
        const fillId = `editor-ctx-fill-${layer.type}`;
        const strokeId = `editor-ctx-stroke-${layer.type}`;
        const config = LAYER_CONFIGS[layer.type];
        if (!config) continue;

        try {
          if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as any).setData(layer.data);
          } else {
            map.addSource(sourceId, { type: "geojson", data: layer.data as any });

            // Fill paint - altitude uses per-feature fill colors, others use config
            const fillPaint: Record<string, unknown> = {};

            if (config.fillColor === "from-property") {
              fillPaint["fill-color"] = ["coalesce", ["get", "fill"], "#e8e5da"];
            } else {
              fillPaint["fill-color"] = config.fillColor;
            }

            // Slightly reduce opacity for editor context (so features stand out)
            fillPaint["fill-opacity"] = layer.type === "altitudes" ? 0.5 : config.fillOpacity;

            map.addLayer({
              id: fillId,
              type: "fill",
              source: sourceId,
              paint: fillPaint as any,
            });

            // Add stroke for rivers/lakes if config has one
            if (config.strokeColor) {
              map.addLayer({
                id: strokeId,
                type: "line",
                source: sourceId,
                paint: {
                  "line-color": config.strokeColor,
                  "line-width": config.strokeWidth ?? 0.5,
                  "line-opacity": 0.6,
                },
              });
            }
          }
        } catch (err) {
          console.warn(`[EditorMap] context layer ${layer.type} error:`, err);
        }
      }
    }, [isLoaded, worldMapLayers]);

    // Render country boundary
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded || !countryGeometry) return;

      const sourceId = "editor-country-boundary";
      const fillId = "editor-country-fill";
      const strokeId = "editor-country-stroke";

      const geojson = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            geometry: countryGeometry,
            properties: {},
          },
        ],
      };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as any).setData(geojson);
      } else {
        map.addSource(sourceId, { type: "geojson", data: geojson });
        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": countryColor ?? "#c8e6c9",
            "fill-opacity": 0.25,
          },
        });
        map.addLayer({
          id: strokeId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#10b981",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      }
    }, [isLoaded, countryGeometry, countryColor]);

    // Render existing features (cities, subdivisions, POIs)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      // Cities + POIs as points
      const pointFeatures = features
        .filter((f) => f.coordinates)
        .map((f) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: f.coordinates!,
          },
          properties: {
            id: f.id,
            name: f.name,
            featureType: f.type,
            isCapital: f.properties.isNationalCapital ?? false,
          },
        }));

      const pointsGeoJson = { type: "FeatureCollection" as const, features: pointFeatures };

      if (map.getSource("editor-points")) {
        (map.getSource("editor-points") as any).setData(pointsGeoJson);
      } else {
        map.addSource("editor-points", { type: "geojson", data: pointsGeoJson });
        // Capital star
        map.addLayer({
          id: "editor-points-capital",
          type: "circle",
          source: "editor-points",
          filter: ["==", ["get", "isCapital"], true],
          paint: {
            "circle-radius": 7,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        // City dots
        map.addLayer({
          id: "editor-points-city",
          type: "circle",
          source: "editor-points",
          filter: ["all", ["==", ["get", "featureType"], "city"], ["!=", ["get", "isCapital"], true]],
          paint: {
            "circle-radius": 5,
            "circle-color": "#3b82f6",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
          },
        });
        // POI dots
        map.addLayer({
          id: "editor-points-poi",
          type: "circle",
          source: "editor-points",
          filter: ["==", ["get", "featureType"], "poi"],
          paint: {
            "circle-radius": 4,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
          },
        });
        // Labels
        map.addLayer({
          id: "editor-points-labels",
          type: "symbol",
          source: "editor-points",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": "#374151",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
      }

      // Subdivisions as polygons
      const polyFeatures = features
        .filter((f) => f.geometry)
        .map((f) => ({
          type: "Feature" as const,
          geometry: f.geometry as any,
          properties: { id: f.id, name: f.name },
        }));

      const polysGeoJson = { type: "FeatureCollection" as const, features: polyFeatures };

      if (map.getSource("editor-subdivisions")) {
        (map.getSource("editor-subdivisions") as any).setData(polysGeoJson);
      } else {
        map.addSource("editor-subdivisions", { type: "geojson", data: polysGeoJson });
        map.addLayer({
          id: "editor-subdivisions-fill",
          type: "fill",
          source: "editor-subdivisions",
          paint: {
            "fill-color": "#a78bfa",
            "fill-opacity": 0.15,
          },
        });
        map.addLayer({
          id: "editor-subdivisions-stroke",
          type: "line",
          source: "editor-subdivisions",
          paint: {
            "line-color": "#7c3aed",
            "line-width": 1.5,
            "line-dasharray": [3, 2],
          },
        });
        map.addLayer({
          id: "editor-subdivisions-labels",
          type: "symbol",
          source: "editor-subdivisions",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 12,
          },
          paint: {
            "text-color": "#6d28d9",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
      }
    }, [isLoaded, features]);

    // Render pending marker
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const geojson = pendingCoordinates
        ? {
            type: "FeatureCollection" as const,
            features: [
              {
                type: "Feature" as const,
                geometry: { type: "Point" as const, coordinates: pendingCoordinates },
                properties: {},
              },
            ],
          }
        : { type: "FeatureCollection" as const, features: [] as any[] };

      if (map.getSource("editor-pending-point")) {
        (map.getSource("editor-pending-point") as any).setData(geojson);
      } else {
        map.addSource("editor-pending-point", { type: "geojson", data: geojson });
        map.addLayer({
          id: "editor-pending-point-layer",
          type: "circle",
          source: "editor-pending-point",
          paint: {
            "circle-radius": 8,
            "circle-color": "#10b981",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.8,
          },
        });
      }
    }, [isLoaded, pendingCoordinates]);

    // Draw mode for subdivisions — simple click-to-draw polygon
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      // Manage draw polygon source
      if (!map.getSource("editor-draw-polygon")) {
        map.addSource("editor-draw-polygon", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "editor-draw-polygon-fill",
          type: "fill",
          source: "editor-draw-polygon",
          paint: { "fill-color": "#10b981", "fill-opacity": 0.2 },
        });
        map.addLayer({
          id: "editor-draw-polygon-stroke",
          type: "line",
          source: "editor-draw-polygon",
          paint: { "line-color": "#10b981", "line-width": 2 },
        });
        map.addSource("editor-draw-vertices", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "editor-draw-vertices-layer",
          type: "circle",
          source: "editor-draw-vertices",
          paint: {
            "circle-radius": 5,
            "circle-color": "#10b981",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
      }
    }, [isLoaded]);

    // Update draw polygon visualization
    const updateDrawVisualization = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;

      const vertices = drawVerticesRef.current;

      // Update vertices
      const verticesGeoJson = {
        type: "FeatureCollection" as const,
        features: vertices.map((v) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: v },
          properties: {},
        })),
      };
      (map.getSource("editor-draw-vertices") as any)?.setData(verticesGeoJson);

      // Update polygon (close it if >= 3 vertices)
      if (vertices.length >= 3) {
        const polyGeoJson = {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "Polygon" as const,
                coordinates: [[...vertices, vertices[0]]],
              },
              properties: {},
            },
          ],
        };
        (map.getSource("editor-draw-polygon") as any)?.setData(polyGeoJson);
      } else if (vertices.length >= 2) {
        // Show as line
        const lineGeoJson = {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "LineString" as const,
                coordinates: vertices,
              },
              properties: {},
            },
          ],
        };
        (map.getSource("editor-draw-polygon") as any)?.setData(lineGeoJson);
      } else {
        (map.getSource("editor-draw-polygon") as any)?.setData({
          type: "FeatureCollection",
          features: [],
        });
      }
    }, []);

    // Handle map clicks
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const onClick = (e: any) => {
        const currentMode = modeRef.current;

        if (currentMode === "add-city" || currentMode === "add-poi") {
          onMapClick(e.lngLat.lng, e.lngLat.lat);
        } else if (currentMode === "add-subdivision") {
          drawVerticesRef.current.push([e.lngLat.lng, e.lngLat.lat]);
          updateDrawVisualization();
        }
      };

      const onDblClick = (e: any) => {
        const currentMode = modeRef.current;
        if (currentMode === "add-subdivision" && drawVerticesRef.current.length >= 3) {
          e.preventDefault();
          // Complete the polygon
          const vertices = drawVerticesRef.current;
          const geometry = {
            type: "Polygon" as const,
            coordinates: [[...vertices, vertices[0]]],
          };
          onDrawComplete(geometry);
          drawVerticesRef.current = [];
          updateDrawVisualization();
        }
      };

      map.on("click", onClick);
      map.on("dblclick", onDblClick);

      return () => {
        map.off("click", onClick);
        map.off("dblclick", onDblClick);
      };
    }, [isLoaded, onMapClick, onDrawComplete, updateDrawVisualization]);

    // Update cursor based on mode
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      if (mode === "view") {
        map.getCanvas().style.cursor = "";
      } else {
        map.getCanvas().style.cursor = "crosshair";
      }
    }, [mode, isLoaded]);

    // Clear draw state when mode changes away from subdivision
    useEffect(() => {
      if (mode !== "add-subdivision") {
        drawVerticesRef.current = [];
        updateDrawVisualization();
      }
    }, [mode, updateDrawVisualization]);

    return (
      <div className="relative h-full w-full" style={{ minHeight: 400 }}>
        <div
          ref={containerRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/20 border-t-emerald-500" />
              <p className="text-sm text-muted-foreground">Loading map editor...</p>
            </div>
          </div>
        )}
        {/* Mode indicator overlay */}
        {mode !== "view" && (
          <div className="absolute bottom-4 left-4 rounded-lg bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md">
            {mode === "add-city" && "Click to place city"}
            {mode === "add-subdivision" && (
              drawVerticesRef.current.length >= 3
                ? "Double-click to finish polygon"
                : "Click to add polygon vertices"
            )}
            {mode === "add-poi" && "Click to place point of interest"}
          </div>
        )}
      </div>
    );
  }
);

export default EditorMap;
