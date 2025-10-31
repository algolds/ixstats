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
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";
import { MAPLIBRE_CONFIG, IXEARTH_SCALE_SYSTEM } from "~/lib/ixearth-constants";
import { api } from "~/trpc/react";

// Dynamic import for MapLibre-Geoman
let geomanInstance: any = null;

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
  onModeChange?: (mode: DrawingMode) => void;
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

  /** Country boundary GeoJSON (optional, will be loaded via API if not provided) */
  countryBoundary?: Feature<Polygon | MultiPolygon> | null;

  /** Event handlers */
  handlers?: MapEditorHandlers;

  /** Loading state from parent */
  isLoading?: boolean;

  /** Whether to fetch country boundary automatically via API */
  fetchCountryBoundary?: boolean;
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
  countryBoundary = null,
  handlers = {},
  isLoading = false,
  fetchCountryBoundary = true,
}: MapEditorContainerProps) {
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const geomanControls = useRef<any>(null);

  // State
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isGeomanLoaded, setIsGeomanLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [activeFeature, setActiveFeature] = useState<any>(null);
  const [loadedBoundary, setLoadedBoundary] = useState<Feature<Polygon | MultiPolygon> | null>(
    countryBoundary
  );

  // Fetch country boundary via tRPC if not provided and fetchCountryBoundary is true
  const {
    data: boundaryData,
    isLoading: isBoundaryLoading,
    error: boundaryError,
  } = api.geo.getCountryBorders.useQuery(
    {
      countryIds: [countryId],
      simplify: false,
    },
    {
      enabled: fetchCountryBoundary && !countryBoundary && !!countryId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Fetch user's subdivisions for the country
  const {
    data: subdivisionsData,
    isLoading: isSubdivisionsLoading,
  } = api.mapEditor.getCountrySubdivisions.useQuery(
    {
      countryId,
      includeGeometry: true,
    },
    {
      enabled: !!countryId,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

  // Fetch user's cities for the country
  const {
    data: citiesData,
    isLoading: isCitiesLoading,
  } = api.mapEditor.getCountryCities.useQuery(
    {
      countryId,
    },
    {
      enabled: !!countryId,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

  // Fetch user's POIs for the country
  const {
    data: poisData,
    isLoading: isPOIsLoading,
  } = api.mapEditor.getCountryPOIs.useQuery(
    {
      countryId,
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
   * Process boundary data from API
   */
  useEffect(() => {
    if (boundaryData && boundaryData.features && boundaryData.features.length > 0) {
      const countryFeature = boundaryData.features[0];
      if (countryFeature && countryFeature.geometry) {
        setLoadedBoundary(countryFeature as Feature<Polygon | MultiPolygon>);
      }
    }
  }, [boundaryData]);

  /**
   * Handle boundary loading errors
   */
  useEffect(() => {
    if (boundaryError) {
      console.error("[MapEditorContainer] Error loading country boundary:", boundaryError);
      setMapError("Failed to load country boundary");
    }
  }, [boundaryError]);

  /**
   * Load MapLibre-Geoman dynamically
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadGeoman = async () => {
      try {
        if (!geomanInstance) {
          const geoman = await import("@geoman-io/maplibre-geoman-free");
          geomanInstance = geoman.default || geoman;
        }
        setIsGeomanLoaded(true);
      } catch (error) {
        console.error("[MapEditorContainer] Failed to load MapLibre-Geoman:", error);
        setMapError("Failed to load drawing tools");
      }
    };

    loadGeoman();
  }, []);

  /**
   * Initialize MapLibre GL JS map
   */
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

      // Create map instance
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            "raster-tiles": {
              type: "raster",
              tiles: [
                "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
          },
          layers: [
            {
              id: "osm-tiles",
              type: "raster",
              source: "raster-tiles",
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 2,
        maxZoom: MAPLIBRE_CONFIG.maxZoom,
      });

      // Error handling
      map.current.on("error", (e) => {
        console.error("[MapEditorContainer] Map error:", e);
        setMapError("Map rendering error occurred");
      });

      // Map loaded
      map.current.on("load", () => {
        setIsMapLoaded(true);
        setMapError(null);
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

      // Click handler for coordinate capture
      map.current.on("click", (e) => {
        if (drawingMode === null && handlers.onCoordinateClick) {
          handlers.onCoordinateClick(e.lngLat.lng, e.lngLat.lat);
        }
      });

    } catch (error) {
      console.error("[MapEditorContainer] Map initialization error:", error);
      setMapError("Failed to initialize map");
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [initialCenter, initialZoom, drawingMode, handlers]);

  /**
   * Load country boundary as base layer
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !loadedBoundary) return;

    const mapInstance = map.current;

    try {
      // Remove existing boundary layers
      if (mapInstance.getLayer("country-boundary-fill")) {
        mapInstance.removeLayer("country-boundary-fill");
      }
      if (mapInstance.getLayer("country-boundary-outline")) {
        mapInstance.removeLayer("country-boundary-outline");
      }
      if (mapInstance.getSource("country-boundary")) {
        mapInstance.removeSource("country-boundary");
      }

      // Add country boundary source
      mapInstance.addSource("country-boundary", {
        type: "geojson",
        data: loadedBoundary as any,
      });

      // Add fill layer
      mapInstance.addLayer({
        id: "country-boundary-fill",
        type: "fill",
        source: "country-boundary",
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": layerVisibility.boundaries ? 0.1 : 0,
        },
      });

      // Add outline layer
      mapInstance.addLayer({
        id: "country-boundary-outline",
        type: "line",
        source: "country-boundary",
        paint: {
          "line-color": "#3b82f6",
          "line-width": 2,
          "line-opacity": layerVisibility.boundaries ? 1 : 0,
        },
      });

      // Fit bounds to country boundary
      const geometry = loadedBoundary.geometry;
      let coordinates: number[][];

      if (geometry.type === "Polygon") {
        coordinates = geometry.coordinates[0] as number[][];
      } else if (geometry.type === "MultiPolygon") {
        // Use the first polygon of the MultiPolygon
        coordinates = geometry.coordinates[0][0] as number[][];
      } else {
        console.warn("[MapEditorContainer] Unsupported geometry type:", geometry.type);
        return;
      }

      if (coordinates && coordinates.length > 0) {
        const bounds = coordinates.reduce(
          (bounds, coord) => {
            return bounds.extend(coord as [number, number]);
          },
          new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number])
        );

        mapInstance.fitBounds(bounds, {
          padding: 50,
          maxZoom: 10,
        });
      }

    } catch (error) {
      console.error("[MapEditorContainer] Error loading country boundary:", error);
      setMapError("Failed to display country boundary");
    }
  }, [map.current, isMapLoaded, loadedBoundary, layerVisibility.boundaries]);

  /**
   * Initialize MapLibre-Geoman controls
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !isGeomanLoaded || !geomanInstance) return;

    const mapInstance = map.current;

    try {
      // Initialize Geoman controls
      if (!(mapInstance as any).pm) {
        geomanInstance.addControls(mapInstance, {
          position: "topleft",
          drawControls: true,
          editControls: true,
          optionsControls: true,
          customControls: true,
          oneBlock: false,
        });
      }

      const pm = (mapInstance as any).pm;
      geomanControls.current = pm;

      // Configure toolbar
      pm.Toolbar.setBlockPosition("top-left");

      // Configure global drawing options
      pm.setGlobalOptions({
        snappable: true,
        snapDistance: 20,
        allowSelfIntersection: false,
        continueDrawing: false,
        templineStyle: {
          color: "#10b981",
          weight: 2,
          opacity: 0.8,
        },
        hintlineStyle: {
          color: "#10b981",
          weight: 2,
          opacity: 0.6,
          dashArray: [5, 5],
        },
        pathOptions: {
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.3,
          weight: 2,
        },
      });

      // Event handlers
      const handleDrawStart = () => {
        console.log("[MapEditorContainer] Draw started");
      };

      const handleCreate = (e: any) => {
        const feature = e.layer.toGeoJSON() as Feature;
        console.log("[MapEditorContainer] Feature created:", feature);

        if (handlers.onFeatureCreate) {
          handlers.onFeatureCreate(feature);
        }

        setActiveFeature(e.layer);
      };

      const handleEdit = (e: any) => {
        const feature = e.layer.toGeoJSON() as Feature;
        console.log("[MapEditorContainer] Feature edited:", feature);

        if (handlers.onFeatureUpdate) {
          handlers.onFeatureUpdate(feature);
        }
      };

      const handleRemove = (e: any) => {
        console.log("[MapEditorContainer] Feature removed");

        if (handlers.onFeatureDelete && e.layer.feature?.id) {
          handlers.onFeatureDelete(e.layer.feature.id);
        }

        setActiveFeature(null);
      };

      // Register event listeners
      mapInstance.on("pm:drawstart", handleDrawStart);
      mapInstance.on("pm:create", handleCreate);
      mapInstance.on("pm:edit", handleEdit);
      mapInstance.on("pm:remove", handleRemove);

      return () => {
        // Cleanup event listeners
        mapInstance.off("pm:drawstart", handleDrawStart);
        mapInstance.off("pm:create", handleCreate);
        mapInstance.off("pm:edit", handleEdit);
        mapInstance.off("pm:remove", handleRemove);

        // Disable Geoman
        if (pm) {
          pm.disableGlobalEditMode();
          pm.disableDraw();
          pm.removeControls();
        }
      };
    } catch (error) {
      console.error("[MapEditorContainer] Error initializing Geoman:", error);
      setMapError("Failed to initialize drawing tools");
    }
  }, [map.current, isMapLoaded, isGeomanLoaded, handlers]);

  /**
   * Handle drawing mode changes
   */
  useEffect(() => {
    if (!geomanControls.current) return;

    const pm = geomanControls.current;

    try {
      // Disable all modes first
      pm.disableDraw();
      pm.disableGlobalEditMode();

      // Enable requested mode
      switch (drawingMode) {
        case "polygon":
          pm.enableDraw("Polygon");
          break;
        case "point":
          pm.enableDraw("Marker");
          break;
        case "edit":
          pm.enableGlobalEditMode();
          break;
        case "delete":
          // Delete mode is handled via clicking on features
          break;
        case null:
          // No active mode
          break;
      }

      if (handlers.onModeChange) {
        handlers.onModeChange(drawingMode);
      }
    } catch (error) {
      console.error("[MapEditorContainer] Error changing drawing mode:", error);
    }
  }, [drawingMode, handlers]);

  /**
   * Load subdivisions layer
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !subdivisionsData?.subdivisions) return;

    const mapInstance = map.current;

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

        console.log(`[MapEditorContainer] Loaded ${subdivisionFeatures.length} subdivisions`);
      }
    } catch (error) {
      console.error("[MapEditorContainer] Error loading subdivisions:", error);
    }
  }, [map.current, isMapLoaded, subdivisionsData, layerVisibility.subdivisions]);

  /**
   * Load cities layer
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !citiesData?.cities) return;

    const mapInstance = map.current;

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

        console.log(`[MapEditorContainer] Loaded ${cityFeatures.length} cities`);
      }
    } catch (error) {
      console.error("[MapEditorContainer] Error loading cities:", error);
    }
  }, [map.current, isMapLoaded, citiesData, layerVisibility.cities]);

  /**
   * Load POIs layer
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded || !poisData?.pois) return;

    const mapInstance = map.current;

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

        console.log(`[MapEditorContainer] Loaded ${poiFeatures.length} POIs`);
      }
    } catch (error) {
      console.error("[MapEditorContainer] Error loading POIs:", error);
    }
  }, [map.current, isMapLoaded, poisData, layerVisibility.pois]);

  /**
   * Update layer visibility
   */
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const mapInstance = map.current;

    try {
      // Update country boundary visibility
      if (mapInstance.getLayer("country-boundary-fill")) {
        mapInstance.setPaintProperty(
          "country-boundary-fill",
          "fill-opacity",
          layerVisibility.boundaries ? 0.1 : 0
        );
      }
      if (mapInstance.getLayer("country-boundary-outline")) {
        mapInstance.setPaintProperty(
          "country-boundary-outline",
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
  }, [layerVisibility, isMapLoaded]);

  /**
   * Expose map instance for external control
   */
  useEffect(() => {
    if (map.current && isMapLoaded) {
      (window as any).__mapEditorInstance = map.current;
    }

    return () => {
      delete (window as any).__mapEditorInstance;
    };
  }, [isMapLoaded]);

  // Determine overall loading state
  const isAnyLoading =
    isLoading ||
    !isMapLoaded ||
    isBoundaryLoading ||
    isSubdivisionsLoading ||
    isCitiesLoading ||
    isPOIsLoading;

  return (
    <div className="relative h-full w-full">
      {/* Map container */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* Loading overlay */}
      {isAnyLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10">
          <div className="glass-panel p-8 text-center">
            <div className="w-12 h-12 border-4 border-gold-500/30 border-t-gold-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Loading map editor...</p>
            <div className="text-slate-400 text-sm mt-2 space-y-1">
              {!isMapLoaded && <div>Initializing map...</div>}
              {isBoundaryLoading && <div>Loading country boundary...</div>}
              {isSubdivisionsLoading && <div>Loading subdivisions...</div>}
              {isCitiesLoading && <div>Loading cities...</div>}
              {isPOIsLoading && <div>Loading points of interest...</div>}
            </div>
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
      {isMapLoaded && !isAnyLoading && (
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
