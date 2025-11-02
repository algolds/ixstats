/**
 * MapEditorContainer Component
 *
 * Full-screen map container with editing capabilities for country subdivisions,
 * cities, and POIs. Integrates with MapLibre GL JS for rendering and drawing.
 */

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Point, GeoJsonProperties } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { MAPLIBRE_CONFIG, IXEARTH_SCALE_SYSTEM } from "~/lib/ixearth-constants";
import { api } from "~/trpc/react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { DrawCustomMode } from "@mapbox/mapbox-gl-draw";
import { createGoogleMapsStyle } from "~/lib/maps/google-map-style";
import type { ProjectionType } from "~/types/maps";

/**
 * Drawing mode types
 */
export type DrawingMode = "polygon" | "point" | "edit" | "delete" | null;

/**
 * Layer visibility configuration
 */
export interface LayerVisibility {
  boundaries: boolean;
  subdivisions: boolean;
  cities: boolean;
  pois: boolean;
}

/**
 * Map editor event handlers
 */
export interface MapEditorHandlers {
  onFeatureCreate?: (feature: Feature) => void;
  onFeatureUpdate?: (feature: Feature) => void;
  onFeatureDelete?: (featureId: string) => void;
  onCoordinateClick?: (lng: number, lat: number) => void;
  // onModeChange removed - caused infinite loop, mode is controlled via drawingMode prop
}

/**
 * Props for MapEditorContainer
 */
export interface MapEditorContainerProps {
  /** Country ID to load boundaries for */
  countryId: string;

  /** Initial center coordinates [longitude, latitude] */
  initialCenter?: [number, number];

  /** Initial zoom level */
  initialZoom?: number;

  /** Active drawing mode */
  drawingMode?: DrawingMode;

  /** Layer visibility settings */
  layerVisibility?: Partial<LayerVisibility>;

  /** Event handlers */
  handlers?: MapEditorHandlers;

  /** Loading state from parent */
  isLoading?: boolean;

  /** Current projection type */
  projection?: ProjectionType;

  /** Callback when projection changes */
  onProjectionChange?: (projection: ProjectionType) => void;

  /** Map type (map/climate/terrain) */
  mapType?: 'map' | 'climate' | 'terrain';
}

/**
 * Default layer visibility
 */
const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  boundaries: true,
  subdivisions: true,
  cities: true,
  pois: true,
};

/**
 * MapEditorContainer Component
 *
 * Provides a full-featured map editing interface with:
 * - MapLibre GL JS rendering
 * - MapLibre-Geoman drawing tools
 * - Country boundary display
 * - Polygon (subdivision) drawing
 * - Point (city/POI) placement
 * - Feature editing and deletion
 */
export function MapEditorContainer({
  countryId,
  initialCenter = MAPLIBRE_CONFIG.defaultCenter,
  initialZoom = 6,
  drawingMode = null,
  layerVisibility: visibilityOverrides = {},
  handlers = {},
  isLoading = false,
  projection = 'mercator',
  onProjectionChange,
  mapType = 'map',
}: MapEditorContainerProps) {
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const drawControls = useRef<MapboxDraw | null>(null);
  const projectionTransitioning = useRef<boolean>(false);
  const projectionTimeout = useRef<NodeJS.Timeout | null>(null);
  const currentProjectionRef = useRef<ProjectionType>(projection);
  const hasZoomedToBoundary = useRef<boolean>(false);

  // State
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [activeFeature, setActiveFeature] = useState<any>(null);

  // Fetch WGS84 centroid for navigation
  const {
    data: centroidData,
    isLoading: isCentroidLoading,
  } = api.mapEditor.getCountryCentroidWGS84.useQuery(
    { countryId },
    {
      enabled: !!countryId,
      staleTime: 10 * 60 * 1000, // 10 minutes (rarely changes)
    }
  );

  // Fetch user's subdivisions for the country (including draft/pending for visibility)
  const {
    data: subdivisionsData,
    isLoading: isSubdivisionsLoading,
  } = api.mapEditor.getMySubdivisions.useQuery(
    {
      countryId,
      limit: 100,
      offset: 0,
    },
    {
      enabled: !!countryId,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

  // Fetch user's cities for the country (including draft/pending for visibility)
  const {
    data: citiesData,
    isLoading: isCitiesLoading,
  } = api.mapEditor.getMyCities.useQuery(
    {
      countryId,
      limit: 100,
      offset: 0,
    },
    {
      enabled: !!countryId,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

  // Fetch ALL national capitals globally (for display on map)
  const {
    data: nationalCapitalsData,
    isLoading: isNationalCapitalsLoading,
  } = api.mapEditor.getAllNationalCapitals.useQuery(
    {},
    {
      staleTime: 10 * 60 * 1000, // 10 minutes (changes rarely)
    }
  );

  // Fetch user's POIs for the country (including draft/pending for visibility)
  const {
    data: poisData,
    isLoading: isPOIsLoading,
  } = api.mapEditor.getMyPOIs.useQuery(
    {
      countryId,
      limit: 100,
      offset: 0,
    },
    {
      enabled: !!countryId,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

  // Merge visibility settings
  const layerVisibility: LayerVisibility = {
    ...DEFAULT_LAYER_VISIBILITY,
    ...visibilityOverrides,
  };

  /**
   * Initialize MapLibre GL JS map (ONCE ONLY)
   */
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const style = createGoogleMapsStyle(basePath, mapType, projection);

      // Create map instance with unified style system (matches GoogleMapContainer)
      // Start at default position - flyTo will navigate to country after style loads
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: style,
        center: MAPLIBRE_CONFIG.defaultCenter, // [0, 0] - SAME AS GoogleMapContainer
        zoom: MAPLIBRE_CONFIG.defaultZoom, // 2.2 - SAME AS GoogleMapContainer
        minZoom: MAPLIBRE_CONFIG.minZoom,
        maxZoom: MAPLIBRE_CONFIG.maxZoom,
        // Projection is set in style, not here
      });

      // Error handling
      map.current.on("error", (e: any) => {
        // Log detailed error information for debugging
        console.error('[MapEditorContainer] Map error details:', JSON.stringify({
          errorMessage: e?.error?.message || String(e?.error || 'unknown'),
          errorStatus: e?.error?.status,
          sourceId: e?.sourceId,
          tile: e?.tile ? `${e.tile.tileID.canonical.z}/${e.tile.tileID.canonical.x}/${e.tile.tileID.canonical.y}` : null,
          type: e?.type,
        }, null, 2));
      });

      // Map and style loaded - use styledata to ensure style is fully ready
      map.current.on("load", () => {
        setIsMapLoaded(true);
        setMapError(null);

        // Check if style is already loaded
        if (map.current?.isStyleLoaded()) {
          setIsStyleLoaded(true);
        }
      });

      // Style loaded event - fired when style is fully loaded and ready
      map.current.on("styledata", () => {
        if (map.current?.isStyleLoaded()) {
          setIsStyleLoaded(true);

          // Lock projection to mercator for editing (no auto-switching)
          // Editor requires consistent projection for accurate drawing
          // Must be done after style loads
          map.current.setProjection({ type: 'mercator' });
        }
      });

      // Add navigation controls
      map.current.addControl(new maplibregl.NavigationControl(), "top-right");

      // Add scale control
      map.current.addControl(
        new maplibregl.ScaleControl({
          maxWidth: 200,
          unit: "imperial",
        }),
        "bottom-right"
      );

      // Expose map instance for external control
      (window as any).__mapEditorInstance = map.current;

    } catch (error) {
      console.error("[MapEditorContainer] Map initialization error:", error);
      setMapError("Failed to initialize map");
    }

    // Cleanup
    return () => {
      // Clear projection timeout
      if (projectionTimeout.current) {
        clearTimeout(projectionTimeout.current);
        projectionTimeout.current = null;
      }

      // Remove map instance from window
      delete (window as any).__mapEditorInstance;

      // Remove map
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Initialize ONCE only

  /**
   * Map Click Handler for Coordinate Capture
   * Separate useEffect to avoid stale closures - updates when drawingMode or handlers change
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Click handler for coordinate capture
    // Allow clicks in null (view) mode and "point" mode (city/POI placement)
    // Don't capture clicks in "polygon" mode (let MapboxDraw handle subdivision drawing)
    const handleMapClick = (e: any) => {
      console.log("[MapEditorContainer] Map clicked:", {
        drawingMode,
        hasHandler: !!handlers.onCoordinateClick,
        coords: { lng: e.lngLat.lng, lat: e.lngLat.lat }
      });

      if ((drawingMode === null || drawingMode === "point") && handlers.onCoordinateClick) {
        handlers.onCoordinateClick(e.lngLat.lng, e.lngLat.lat);
      }
    };

    map.current.on("click", handleMapClick);

    return () => {
      if (map.current) {
        map.current.off("click", handleMapClick);
      }
    };
  }, [drawingMode, handlers, isMapLoaded]);

  /**
   * Update map style when mapType or projection changes
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const style = createGoogleMapsStyle(basePath, mapType, projection);

    // Get current zoom and center before style change
    const currentZoom = map.current.getZoom();
    const currentCenter = map.current.getCenter();

    map.current.setStyle(style);

    // Restore position after style loads (setStyle resets view)
    map.current.once('styledata', () => {
      if (!map.current) return;

      // Only restore zoom/center if we've already navigated to the country
      // This prevents overriding the initial flyTo navigation
      if (hasZoomedToBoundary.current) {
        map.current.setZoom(currentZoom);
        map.current.setCenter(currentCenter);
      }

      // Mark style as loaded
      setIsStyleLoaded(true);
    });
  }, [mapType, projection, isMapLoaded]);

  /**
   * Notify parent of projection changes
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Skip if projection hasn't changed
    if (currentProjectionRef.current === projection) return;

    console.log(`[MapEditorContainer] Projection changed to: ${projection}`);

    // Update ref to track current projection
    currentProjectionRef.current = projection;

    // Notify parent of projection change
    onProjectionChange?.(projection);
  }, [projection, isMapLoaded, onProjectionChange]);

  /**
   * Initialize MapboxDraw controls
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !isStyleLoaded) return;

    const mapInstance = map.current;

    // Double-check style is loaded
    if (!mapInstance.isStyleLoaded()) {
      console.warn("[MapEditorContainer] Style not loaded, skipping draw controls setup");
      // Clear any old broken reference
      drawControls.current = null;
      return;
    }

    try {
      // Initialize MapboxDraw
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          point: true,
          trash: true,
        },
        styles: [
          // Polygon fill
          {
            id: "gl-draw-polygon-fill",
            type: "fill",
            filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
            paint: {
              "fill-color": "#10b981",
              "fill-opacity": 0.3,
            },
          },
          // Polygon outline
          {
            id: "gl-draw-polygon-stroke",
            type: "line",
            filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": "#10b981",
              "line-width": 2,
            },
          },
          // Point (marker)
          {
            id: "gl-draw-point",
            type: "circle",
            filter: ["all", ["==", "$type", "Point"], ["!=", "mode", "static"]],
            paint: {
              "circle-radius": 6,
              "circle-color": "#10b981",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          },
          // Vertex points
          {
            id: "gl-draw-polygon-and-line-vertex",
            type: "circle",
            filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
            paint: {
              "circle-radius": 5,
              "circle-color": "#ffffff",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#10b981",
            },
          },
        ],
      });

      mapInstance.addControl(draw as any, "top-left");
      drawControls.current = draw;

      // Expose draw instance globally for BorderEditor to access
      (window as any).__mapboxDrawInstance = draw;
      console.log("[MapEditorContainer] MapboxDraw instance exposed globally");

      // Event handlers
      const handleCreate = (e: any) => {
        const feature = e.features[0] as Feature;

        if (handlers.onFeatureCreate) {
          handlers.onFeatureCreate(feature);
        }

        setActiveFeature(feature);
      };

      const handleUpdate = (e: any) => {
        const feature = e.features[0] as Feature;

        if (handlers.onFeatureUpdate) {
          handlers.onFeatureUpdate(feature);
        }

        setActiveFeature(feature);
      };

      const handleDelete = (e: any) => {
        const feature = e.features[0] as Feature;

        if (handlers.onFeatureDelete && feature.id) {
          handlers.onFeatureDelete(String(feature.id));
        }

        setActiveFeature(null);
      };

      // Register event listeners
      mapInstance.on("draw.create", handleCreate);
      mapInstance.on("draw.update", handleUpdate);
      mapInstance.on("draw.delete", handleDelete);

      return () => {
        // Cleanup global reference
        if ((window as any).__mapboxDrawInstance === draw) {
          delete (window as any).__mapboxDrawInstance;
        }

        // Cleanup event listeners (check if map still exists)
        if (map.current) {
          map.current.off("draw.create", handleCreate);
          map.current.off("draw.update", handleUpdate);
          map.current.off("draw.delete", handleDelete);

          // Remove draw control
          if (draw) {
            try {
              map.current.removeControl(draw as any);
            } catch (e) {
              // Control might have been removed already
              console.warn("[MapEditorContainer] Failed to remove draw control:", e);
            }
          }
        }
      };
    } catch (error) {
      console.error("[MapEditorContainer] Error initializing MapboxDraw:", error);
      setMapError("Failed to initialize drawing tools");
      // Clear broken reference
      drawControls.current = null;
    }
  }, [isMapLoaded, isStyleLoaded, handlers]);

  /**
   * Handle drawing mode changes
   */
  useEffect(() => {
    // Add defensive check - drawControls might not be initialized yet
    if (!drawControls.current) {
      if (drawingMode !== null) {
        console.warn("[MapEditorContainer] Drawing mode requested but draw controls not initialized yet");
      }
      return;
    }

    const draw = drawControls.current;

    // Additional safety check
    if (!draw || typeof draw.changeMode !== 'function') {
      console.warn("[MapEditorContainer] Draw controls exist but changeMode not available");
      return;
    }

    // Validate that draw is in a good state
    try {
      // Test if draw has access to the map
      if (!draw.getAll) {
        console.warn("[MapEditorContainer] Draw instance is invalid, clearing reference");
        drawControls.current = null;
        return;
      }
    } catch (e) {
      console.warn("[MapEditorContainer] Draw instance validation failed, clearing reference");
      drawControls.current = null;
      return;
    }

    try {
      // Change mode based on drawingMode prop
      switch (drawingMode) {
        case "polygon":
          draw.changeMode("draw_polygon");
          break;
        case "point":
          draw.changeMode("draw_point");
          break;
        case "edit":
          // Edit mode - use simple_select to let user click features to edit
          // direct_select requires a featureId, which we don't have yet
          draw.changeMode("simple_select");
          break;
        case "delete":
          // Delete mode - user can select and press delete or use trash button
          draw.changeMode("simple_select");
          break;
        case null:
          // No active mode - simple select
          draw.changeMode("simple_select");
          break;
      }

      // DO NOT call handlers.onModeChange here!
      // This creates an infinite loop because:
      // 1. Parent changes drawingMode prop
      // 2. This effect runs and would call onModeChange
      // 3. onModeChange dispatches SET_MODE in parent
      // 4. Parent re-renders with "new" state (even if same value)
      // 5. Back to step 1 = infinite loop
      //
      // The parent controls the mode via the drawingMode prop.
      // We only need to sync the MapboxDraw control to match the prop.
    } catch (error) {
      console.error("[MapEditorContainer] Error changing drawing mode:", error);
      // Clear the broken reference so it will be reinitialized
      drawControls.current = null;
      // Don't set an error state here, as the draw controls will be reinitialized
      // when the map/style are ready
    }
  }, [drawingMode, isMapLoaded, isStyleLoaded]); // Add dependencies to ensure map is ready

  /**
   * Cursor Changes Based on Drawing Mode
   * Provides visual feedback for active tool
   */
  useEffect(() => {
    if (!map.current) return;

    const canvas = map.current.getCanvas();
    if (!canvas) return;

    // Set cursor based on active drawing mode
    if (drawingMode === "polygon" || drawingMode === "point") {
      canvas.style.cursor = "crosshair";
    } else if (drawingMode === "edit") {
      canvas.style.cursor = "pointer";
    } else if (drawingMode === "delete") {
      canvas.style.cursor = "not-allowed";
    } else {
      canvas.style.cursor = "";
    }
  }, [drawingMode]);

  /**
   * Load country boundary highlighting (user's country)
   * This adds a bright gold outline by filtering the existing political vector tile layer
   */
  useEffect(() => {
    console.log("[MapEditorContainer] Boundary effect triggered - map:", !!map.current, "loaded:", isMapLoaded, "style:", isStyleLoaded, "country:", countryId);

    if (!map.current || !isMapLoaded || !isStyleLoaded) return;

    const mapInstance = map.current;

    // Double-check style is loaded
    if (!mapInstance.isStyleLoaded()) {
      console.warn("[MapEditorContainer] Style check failed, aborting");
      return;
    }

    console.log("[MapEditorContainer] Starting boundary highlighting for country:", countryId);

    try {
      // Remove existing editor country layers (if any)
      if (mapInstance.getLayer("editor-country-fill")) {
        mapInstance.removeLayer("editor-country-fill");
      }
      if (mapInstance.getLayer("editor-country-outline")) {
        mapInstance.removeLayer("editor-country-outline");
      }

      // No need to add a source - we reuse the existing 'political' vector tile source
      // This ensures coordinates are always in the correct projection (WGS84)

      // Add semi-transparent gold fill (filters political layer by country_id)
      mapInstance.addLayer({
        id: "editor-country-fill",
        type: "fill",
        source: "political",
        "source-layer": "map_layer_political", // Vector tile layer name
        filter: ["==", ["get", "country_id"], countryId], // Only show this country
        paint: {
          "fill-color": "#d4af37", // Gold
          "fill-opacity": 0.15, // Subtle highlight
        },
      });

      // Add bright gold outline (3px for visibility)
      mapInstance.addLayer({
        id: "editor-country-outline",
        type: "line",
        source: "political",
        "source-layer": "map_layer_political",
        filter: ["==", ["get", "country_id"], countryId],
        paint: {
          "line-color": "#d4af37", // Gold
          "line-width": 3,
          "line-opacity": 1,
        },
      });

      console.log("[MapEditorContainer] Country boundary highlighting added");

      // Navigate to country using WGS84 centroid from database
      if (!hasZoomedToBoundary.current && centroidData?.lng && centroidData?.lat) {
        console.log(`[MapEditorContainer] Navigating to WGS84 centroid: [${centroidData.lng}, ${centroidData.lat}]`);

        mapInstance.flyTo({
          center: [centroidData.lng, centroidData.lat],
          zoom: 6,
          duration: 2000,
          essential: true,
        });

        hasZoomedToBoundary.current = true;
        console.log("[MapEditorContainer] Navigation complete");
      }
    } catch (error) {
      console.error("[MapEditorContainer] Error loading country boundary:", error);
    }
  }, [isMapLoaded, isStyleLoaded, centroidData, countryId]);

  /**
   * Grey out non-owned countries
   * This modifies the political layer to show other countries in grey
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !isStyleLoaded) return;

    const mapInstance = map.current;

    // Double-check style is loaded
    if (!mapInstance.isStyleLoaded()) {
      return;
    }

    try {
      // Update country fills to grey out non-owned countries
      if (mapInstance.getLayer("countries")) {
        mapInstance.setPaintProperty("countries", "fill-color", [
          "case",
          ["==", ["get", "country_id"], countryId], // If this is the user's country
          ["get", "fill"], // Use original color
          "#666666", // Otherwise use grey
        ]);

        // Reduce opacity for non-owned countries
        mapInstance.setPaintProperty("countries", "fill-opacity", [
          "case",
          ["==", ["get", "country_id"], countryId],
          [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.5,
            0.3,
          ],
          0.15, // Non-owned countries are very faint
        ]);
      }

      // Update country borders to grey out non-owned countries
      if (mapInstance.getLayer("country-borders")) {
        mapInstance.setPaintProperty("country-borders", "line-color", [
          "case",
          ["==", ["get", "country_id"], countryId],
          ["get", "stroke"], // Use original border color
          "#888888", // Otherwise use light grey
        ]);

        // Thin borders for non-owned countries
        mapInstance.setPaintProperty("country-borders", "line-width", [
          "case",
          ["==", ["get", "country_id"], countryId],
          2, // Normal width for owned country
          0.5, // Very thin for others
        ]);
      }

      // Grey out country labels for non-owned countries
      if (mapInstance.getLayer("country-labels")) {
        mapInstance.setPaintProperty("country-labels", "text-color", [
          "case",
          ["==", ["get", "country_id"], countryId],
          "#ffffff", // White for owned country
          "#999999", // Grey for others
        ]);

        // Reduce label opacity for non-owned countries
        mapInstance.setPaintProperty("country-labels", "text-opacity", [
          "case",
          ["==", ["get", "country_id"], countryId],
          1.0,
          0.4, // Faint labels for others
        ]);
      }

      console.log("[MapEditorContainer] Non-owned countries greyed out");
    } catch (error) {
      console.error("[MapEditorContainer] Error greying out countries:", error);
    }
  }, [isMapLoaded, isStyleLoaded, countryId]);

  /**
   * Load subdivisions layer
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !isStyleLoaded || !subdivisionsData?.subdivisions) return;

    const mapInstance = map.current;

    // Double-check style is loaded
    if (!mapInstance.isStyleLoaded()) {
      return;
    }

    try {
      // Remove existing subdivision layers
      if (mapInstance.getLayer("subdivisions-fill")) {
        mapInstance.removeLayer("subdivisions-fill");
      }
      if (mapInstance.getLayer("subdivisions-outline")) {
        mapInstance.removeLayer("subdivisions-outline");
      }
      if (mapInstance.getSource("subdivisions")) {
        mapInstance.removeSource("subdivisions");
      }

      // Create FeatureCollection from subdivisions
      const subdivisionFeatures: Feature[] = subdivisionsData.subdivisions
        .filter((sub) => sub.geometry)
        .map((sub) => ({
          type: "Feature",
          id: sub.id,
          properties: {
            id: sub.id,
            name: sub.name,
            type: sub.type,
            level: sub.level,
            population: sub.population,
            capital: sub.capital,
            areaSqKm: sub.areaSqKm,
          },
          geometry: sub.geometry as any,
        }));

      if (subdivisionFeatures.length > 0) {
        const featureCollection: FeatureCollection = {
          type: "FeatureCollection",
          features: subdivisionFeatures,
        };

        // Add subdivisions source
        mapInstance.addSource("subdivisions", {
          type: "geojson",
          data: featureCollection,
        });

        // Add fill layer
        mapInstance.addLayer({
          id: "subdivisions-fill",
          type: "fill",
          source: "subdivisions",
          paint: {
            "fill-color": "#10b981",
            "fill-opacity": layerVisibility.subdivisions ? 0.2 : 0,
          },
        });

        // Add outline layer
        mapInstance.addLayer({
          id: "subdivisions-outline",
          type: "line",
          source: "subdivisions",
          paint: {
            "line-color": "#10b981",
            "line-width": 1.5,
            "line-opacity": layerVisibility.subdivisions ? 1 : 0,
          },
        });

      }
    } catch (error) {
      console.error("[MapEditorContainer] Error loading subdivisions:", error);
    }
  }, [isMapLoaded, isStyleLoaded, subdivisionsData, layerVisibility.subdivisions]);

  /**
   * Load cities layer (user's country cities)
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !isStyleLoaded || !citiesData?.cities) return;

    const mapInstance = map.current;

    // Double-check style is loaded
    if (!mapInstance.isStyleLoaded()) {
      return;
    }

    try {
      // Remove existing city layers
      if (mapInstance.getLayer("cities-points")) {
        mapInstance.removeLayer("cities-points");
      }
      if (mapInstance.getLayer("cities-labels")) {
        mapInstance.removeLayer("cities-labels");
      }
      if (mapInstance.getSource("cities")) {
        mapInstance.removeSource("cities");
      }

      // Create FeatureCollection from cities
      const cityFeatures: Feature[] = citiesData.cities
        .filter((city) => city.coordinates)
        .map((city) => ({
          type: "Feature",
          id: city.id,
          properties: {
            id: city.id,
            name: city.name,
            type: city.type,
            population: city.population,
            isNationalCapital: city.isNationalCapital,
            isSubdivisionCapital: city.isSubdivisionCapital,
            elevation: city.elevation,
            foundedYear: city.foundedYear,
          },
          geometry: city.coordinates as any,
        }));

      if (cityFeatures.length > 0) {
        const featureCollection: FeatureCollection = {
          type: "FeatureCollection",
          features: cityFeatures,
        };

        // Add cities source
        mapInstance.addSource("cities", {
          type: "geojson",
          data: featureCollection,
        });

        // Add circle layer for cities
        mapInstance.addLayer({
          id: "cities-points",
          type: "circle",
          source: "cities",
          paint: {
            "circle-radius": [
              "case",
              ["get", "isNationalCapital"],
              8,
              ["get", "isSubdivisionCapital"],
              6,
              4,
            ],
            "circle-color": [
              "case",
              ["get", "isNationalCapital"],
              "#f59e0b",
              ["get", "isSubdivisionCapital"],
              "#8b5cf6",
              "#3b82f6",
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": layerVisibility.cities ? 1 : 0,
          },
        });

        // Add labels layer for cities
        mapInstance.addLayer({
          id: "cities-labels",
          type: "symbol",
          source: "cities",
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-size": 12,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#000000",
            "text-halo-width": 1.5,
            "text-opacity": layerVisibility.cities ? 1 : 0,
          },
        });

      }
    } catch (error) {
      console.error("[MapEditorContainer] Error loading cities:", error);
    }
  }, [isMapLoaded, isStyleLoaded, citiesData, layerVisibility.cities]);

  /**
   * Load national capitals layer (ALL countries globally)
   * This ensures national capitals are visible on the main map regardless of which country is being edited
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !isStyleLoaded || !nationalCapitalsData?.capitals) return;

    const mapInstance = map.current;

    // Double-check style is loaded
    if (!mapInstance.isStyleLoaded()) {
      return;
    }

    try {
      // Remove existing national capitals layers
      if (mapInstance.getLayer("national-capitals-points")) {
        mapInstance.removeLayer("national-capitals-points");
      }
      if (mapInstance.getLayer("national-capitals-labels")) {
        mapInstance.removeLayer("national-capitals-labels");
      }
      if (mapInstance.getSource("national-capitals")) {
        mapInstance.removeSource("national-capitals");
      }

      // Create FeatureCollection from national capitals
      const capitalFeatures: Feature[] = nationalCapitalsData.capitals
        .filter((capital) => capital.coordinates && capital.status === 'approved') // Only show approved capitals
        .map((capital) => ({
          type: "Feature",
          id: capital.id,
          properties: {
            id: capital.id,
            name: capital.name,
            countryName: capital.country?.name || '',
            population: capital.population,
          },
          geometry: capital.coordinates as any,
        }));

      if (capitalFeatures.length > 0) {
        const featureCollection: FeatureCollection = {
          type: "FeatureCollection",
          features: capitalFeatures,
        };

        // Add national capitals source
        mapInstance.addSource("national-capitals", {
          type: "geojson",
          data: featureCollection,
        });

        // Add circle layer for national capitals (larger and gold)
        mapInstance.addLayer({
          id: "national-capitals-points",
          type: "circle",
          source: "national-capitals",
          paint: {
            "circle-radius": 10, // Larger than regular cities
            "circle-color": "#fbbf24", // Bright gold for capitals
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
            "circle-opacity": 1,
          },
        });

        // Add labels layer for national capitals
        mapInstance.addLayer({
          id: "national-capitals-labels",
          type: "symbol",
          source: "national-capitals",
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-offset": [0, 1.5],
            "text-anchor": "top",
            "text-size": 14, // Larger labels
          },
          paint: {
            "text-color": "#fbbf24", // Gold text
            "text-halo-color": "#000000",
            "text-halo-width": 2,
            "text-opacity": 1,
          },
        });

        console.log("[MapEditorContainer] National capitals layer loaded:", capitalFeatures.length, "capitals");
      }
    } catch (error) {
      console.error("[MapEditorContainer] Error loading national capitals:", error);
    }
  }, [isMapLoaded, isStyleLoaded, nationalCapitalsData]);

  /**
   * Load POIs layer
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !isStyleLoaded || !poisData?.pois) return;

    const mapInstance = map.current;

    // Double-check style is loaded
    if (!mapInstance.isStyleLoaded()) {
      return;
    }

    try {
      // Remove existing POI layers
      if (mapInstance.getLayer("pois-points")) {
        mapInstance.removeLayer("pois-points");
      }
      if (mapInstance.getLayer("pois-labels")) {
        mapInstance.removeLayer("pois-labels");
      }
      if (mapInstance.getSource("pois")) {
        mapInstance.removeSource("pois");
      }

      // Create FeatureCollection from POIs
      const poiFeatures: Feature[] = poisData.pois
        .filter((poi) => poi.coordinates)
        .map((poi) => ({
          type: "Feature",
          id: poi.id,
          properties: {
            id: poi.id,
            name: poi.name,
            category: poi.category,
            icon: poi.icon,
            description: poi.description,
          },
          geometry: poi.coordinates as any,
        }));

      if (poiFeatures.length > 0) {
        const featureCollection: FeatureCollection = {
          type: "FeatureCollection",
          features: poiFeatures,
        };

        // Add POIs source
        mapInstance.addSource("pois", {
          type: "geojson",
          data: featureCollection,
        });

        // Add circle layer for POIs
        mapInstance.addLayer({
          id: "pois-points",
          type: "circle",
          source: "pois",
          paint: {
            "circle-radius": 5,
            "circle-color": [
              "match",
              ["get", "category"],
              "monument",
              "#ef4444",
              "landmark",
              "#f59e0b",
              "military",
              "#dc2626",
              "cultural",
              "#8b5cf6",
              "natural",
              "#10b981",
              "religious",
              "#6366f1",
              "government",
              "#3b82f6",
              "#6b7280", // default
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": layerVisibility.pois ? 1 : 0,
          },
        });

        // Add labels layer for POIs
        mapInstance.addLayer({
          id: "pois-labels",
          type: "symbol",
          source: "pois",
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            "text-offset": [0, 1],
            "text-anchor": "top",
            "text-size": 10,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#000000",
            "text-halo-width": 1,
            "text-opacity": layerVisibility.pois ? 1 : 0,
          },
        });

      }
    } catch (error) {
      console.error("[MapEditorContainer] Error loading POIs:", error);
    }
  }, [isMapLoaded, isStyleLoaded, poisData, layerVisibility.pois]);

  /**
   * Update layer visibility
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !isStyleLoaded) return;

    const mapInstance = map.current;

    // Double-check style is loaded
    if (!mapInstance.isStyleLoaded()) {
      return;
    }

    try {
      // Update editor country boundary visibility (gold highlight)
      if (mapInstance.getLayer("editor-country-fill")) {
        mapInstance.setPaintProperty(
          "editor-country-fill",
          "fill-opacity",
          layerVisibility.boundaries ? 0.15 : 0
        );
      }
      if (mapInstance.getLayer("editor-country-outline")) {
        mapInstance.setPaintProperty(
          "editor-country-outline",
          "line-opacity",
          layerVisibility.boundaries ? 1 : 0
        );
      }

      // Update subdivisions visibility
      if (mapInstance.getLayer("subdivisions-fill")) {
        mapInstance.setPaintProperty(
          "subdivisions-fill",
          "fill-opacity",
          layerVisibility.subdivisions ? 0.2 : 0
        );
      }
      if (mapInstance.getLayer("subdivisions-outline")) {
        mapInstance.setPaintProperty(
          "subdivisions-outline",
          "line-opacity",
          layerVisibility.subdivisions ? 1 : 0
        );
      }

      // Update cities visibility
      if (mapInstance.getLayer("cities-points")) {
        mapInstance.setPaintProperty(
          "cities-points",
          "circle-opacity",
          layerVisibility.cities ? 1 : 0
        );
      }
      if (mapInstance.getLayer("cities-labels")) {
        mapInstance.setPaintProperty(
          "cities-labels",
          "text-opacity",
          layerVisibility.cities ? 1 : 0
        );
      }

      // Update POIs visibility
      if (mapInstance.getLayer("pois-points")) {
        mapInstance.setPaintProperty(
          "pois-points",
          "circle-opacity",
          layerVisibility.pois ? 1 : 0
        );
      }
      if (mapInstance.getLayer("pois-labels")) {
        mapInstance.setPaintProperty(
          "pois-labels",
          "text-opacity",
          layerVisibility.pois ? 1 : 0
        );
      }
    } catch (error) {
      console.error("[MapEditorContainer] Error updating layer visibility:", error);
    }
  }, [layerVisibility, isMapLoaded, isStyleLoaded]);


  // Determine loading states
  // Initial loading: blocks everything until map is ready
  const isInitialLoading = isLoading || !isMapLoaded || !isStyleLoaded;

  // Data loading: doesn't block navigation, just shows loading indicator
  const isDataLoading =
    isSubdivisionsLoading ||
    isCitiesLoading ||
    isPOIsLoading;

  return (
    <div className="relative h-full w-full">
      {/* Map container */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* Initial loading overlay (blocks entire map) */}
      {isInitialLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10">
          <div className="glass-panel p-8 text-center">
            <div className="w-12 h-12 border-4 border-gold-500/30 border-t-gold-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Loading map editor...</p>
            <div className="text-slate-400 text-sm mt-2 space-y-1">
              {!isMapLoaded && <div>Initializing map...</div>}
              {isMapLoaded && !isStyleLoaded && <div>Loading map style...</div>}
            </div>
          </div>
        </div>
      )}

      {/* Drawing Mode Instructions (Centered Top) */}
      {drawingMode && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
          <div className="glass-panel px-6 py-3 bg-blue-500/20 border border-blue-400/30">
            <p className="text-white font-semibold text-center">
              {drawingMode === "polygon" && "✏️ Click map to draw polygon • Double-click to finish"}
              {drawingMode === "point" && "📍 Click map to place point"}
              {drawingMode === "edit" && "✏️ Click features to edit"}
              {drawingMode === "delete" && "🗑️ Click features to delete"}
            </p>
          </div>
        </div>
      )}

      {/* Data loading indicator (non-blocking, corner indicator) */}
      {!isInitialLoading && isDataLoading && (
        <div className="absolute top-4 right-4 z-20">
          <div className="glass-panel px-4 py-2 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
            <span className="text-white text-sm">Loading data...</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {mapError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="glass-panel px-6 py-3 bg-red-500/20 border border-red-500/50">
            <p className="text-red-200 text-sm font-medium">{mapError}</p>
          </div>
        </div>
      )}

      {/* Info display (bottom-left) */}
      {isMapLoaded && !isInitialLoading && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="glass-panel px-4 py-2 text-xs">
            <div className="text-white font-medium mb-1">Country: {countryId}</div>
            <div className="text-slate-400">
              Mode: {drawingMode ? drawingMode.charAt(0).toUpperCase() + drawingMode.slice(1) : "View"}
            </div>
            {drawingMode && (
              <div className="text-gold-400 mt-1">
                {drawingMode === "polygon" && "Click to draw subdivision boundaries"}
                {drawingMode === "point" && "Click to place a city or POI"}
                {drawingMode === "edit" && "Click features to edit"}
                {drawingMode === "delete" && "Click features to delete"}
              </div>
            )}
            {/* Layer stats */}
            <div className="text-slate-500 text-[10px] mt-2 pt-2 border-t border-slate-700">
              {subdivisionsData && (
                <div>Subdivisions: {subdivisionsData.subdivisions.length}</div>
              )}
              {citiesData && <div>Cities: {citiesData.cities.length}</div>}
              {poisData && <div>POIs: {poisData.pois.length}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Type exports for external use
 */
export type { Feature, FeatureCollection, Polygon, MultiPolygon, Point, GeoJsonProperties };
