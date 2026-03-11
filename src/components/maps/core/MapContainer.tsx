"use client";

/**
 * MapContainer - Wrapper component that handles data loading and error states
 * for the IxWorldMap component. Fetches GeoJSON data via tRPC.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useMapData } from "~/hooks/useMapData";
import { useMapPinInfo } from "~/hooks/useMapPinInfo";
import { api } from "~/trpc/react";
import { MapControls } from "./MapControls";
import { CountryInfoPanel } from "./CountryInfoPanel";
import { FeatureInfoPanel } from "./FeatureInfoPanel";
import MapPinInfoPanel from "./MapPinInfoPanel";
import { MapSearchOverlay } from "./MapSearchOverlay";
import { MeasureTool } from "./MeasureTool";
import { MapKeyboardControls } from "./MapKeyboardControls";
import { MapLoadingScreen } from "./MapLoadingScreen";
import { ProjectionToggle } from "./ProjectionToggle";
import type { MapLayerType, ProjectionMode } from "~/lib/map-config";
import type { SelectedCountry, SelectedFeature, HoveredCountry, IxWorldMapRef, OverlayVisibility } from "./IxWorldMap";
import type { FeatureCollection } from "geojson";

// MapLibre CSS - imported here (not in dynamically-loaded IxWorldMap) so it's in the main bundle
import "maplibre-gl/dist/maplibre-gl.css";

// Dynamic import to avoid SSR issues with MapLibre
// Loading state handled by MapLoadingScreen overlay
const IxWorldMap = dynamic(() => import("./IxWorldMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#0a1628]" />,
});

export interface MapContainerProps {
  className?: string;
  showControls?: boolean;
  showTools?: boolean;      // Search + measure tools (defaults to showControls)
  showPopup?: boolean;
  initialLayers?: MapLayerType[];
  /** Country ID to auto-select and fly to on mount (for deep linking) */
  initialCountryId?: string;
  onCountrySelect?: (country: SelectedCountry | null) => void;
}

export function MapContainer({
  className = "",
  showControls = true,
  showTools,
  showPopup = true,
  initialLayers,
  initialCountryId,
  onCountrySelect,
}: MapContainerProps) {
  const toolsVisible = showTools ?? showControls;
  const mapRef = useRef<IxWorldMapRef>(null);
  const [selectedCountry, setSelectedCountry] =
    useState<SelectedCountry | null>(null);
  const [hoveredCountry, setHoveredCountry] =
    useState<HoveredCountry | null>(null);
  const [selectedFeature, setSelectedFeature] =
    useState<SelectedFeature | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [mapEngineReady, setMapEngineReady] = useState(false);
  const handleMapReady = useCallback(() => setMapEngineReady(true), []);
  const [geographyFilter, setGeographyFilter] = useState<{ type: "continent" | "region"; value: string } | null>(null);
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>("dynamic");

  const {
    mapLayers,
    toggleLayer,
    visibleLayers,
    isLoading,
    error,
  } = useMapData(initialLayers);

  const {
    isPinToolActive,
    togglePinTool,
    pinPosition,
    clientResult,
    serverResult,
    isServerLoading,
    dropPin,
    clearPin,
  } = useMapPinInfo();

  // Overlay features (cities, POIs, subdivisions)
  const { data: overlayFeatures } = api.geo.getAllMapFeatures.useQuery(undefined, {
    staleTime: 10 * 60_000,
    gcTime: 2 * 60 * 60_000,
  });

  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>({
    cities: true,
    pois: true,
    subdivisions: true,
  });

  const toggleOverlay = useCallback((key: keyof OverlayVisibility) => {
    setOverlayVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Build a layer lookup for the pin tool's client-side query
  const layerDataMap = useMemo(() => {
    const map: Record<string, FeatureCollection | undefined> = {};
    for (const ml of mapLayers) {
      map[ml.type] = ml.data;
    }
    return map;
  }, [mapLayers]);

  const { data: capitalsGeoJson } = api.geo.getCapitalCities.useQuery(undefined, {
    staleTime: 30 * 60_000,
    gcTime: 2 * 60 * 60_000,
  });

  // Top-20 countries by composite importance (population + GDP + GDP/capita)
  const { data: topCountryNames } = api.countries.getTopCountriesByImportance.useQuery(
    { limit: 20 },
    { staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  const topCountrySet = useMemo(
    () => new Set(topCountryNames ?? []),
    [topCountryNames]
  );

  // Deep-link: auto-select and fly to a country on mount
  const { data: initialGeo } = api.geo.getCountryGeometry.useQuery(
    { countryId: initialCountryId! },
    { enabled: !!initialCountryId, staleTime: 30 * 60_000 }
  );
  const deepLinkFiredRef = useRef(false);

  useEffect(() => {
    if (!initialCountryId || !initialGeo || deepLinkFiredRef.current) return;
    if (!mapRef.current) return;

    deepLinkFiredRef.current = true;
    const country: SelectedCountry = {
      featureId: initialGeo.featureId,
      displayName: initialGeo.displayName,
      fillColor: "#e8e5da",
      centroidLng: initialGeo.centroid?.lng ?? 0,
      centroidLat: initialGeo.centroid?.lat ?? 0,
      countryId: initialGeo.country?.id ?? null,
    };
    setSelectedCountry(country);
    onCountrySelect?.(country);

    if (initialGeo.bbox) {
      const b = initialGeo.bbox;
      mapRef.current.flyTo(
        (b.minLng + b.maxLng) / 2,
        (b.minLat + b.maxLat) / 2,
        4
      );
    } else if (initialGeo.centroid) {
      mapRef.current.flyTo(initialGeo.centroid.lng, initialGeo.centroid.lat, 4);
    }
  }, [initialCountryId, initialGeo, onCountrySelect]);

  const measuringRef = useRef(false);
  measuringRef.current = isMeasuring;
  const pinToolRef = useRef(false);
  pinToolRef.current = isPinToolActive;

  const handleFeatureClick = useCallback(
    (feature: SelectedFeature | null) => {
      setSelectedFeature(feature);
      if (feature) {
        // Clear country selection when a feature is selected
        setSelectedCountry(null);
        // Fly to feature location
        mapRef.current?.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
      }
    },
    []
  );

  const handleCountryClick = useCallback(
    (country: SelectedCountry | null) => {
      // Suppress country selection while measure tool is active
      if (measuringRef.current) return;

      // Pin tool mode: suppress country selection (handleMapClick handles pin)
      if (pinToolRef.current) return;

      setSelectedFeature(null); // Clear feature selection when clicking country
      setSelectedCountry(country);
      setGeographyFilter(null); // Clear geography filter on new country selection
      onCountrySelect?.(country);

      // Fly to country — smart zoom: stay flat when already in Mercator projection
      if (country && mapRef.current) {
        const currentZoom = mapRef.current.getMap()?.getZoom() ?? 1.8;
        // If already in flat projection (zoom >= 4), stay at current zoom
        // Only zoom to 4 from globe mode
        const targetZoom = currentZoom >= 4 ? Math.max(currentZoom, 4) : 4;
        mapRef.current.flyTo(country.centroidLng, country.centroidLat, targetZoom);
      }
    },
    [onCountrySelect, dropPin, layerDataMap]
  );

  const utils = api.useUtils();

  const handleCountryHover = useCallback(
    (country: HoveredCountry | null) => {
      setHoveredCountry(country);
      if (!country) return;
      // Prefetch all panel data on hover (fallback if bulk warm hasn't finished yet)
      if (country.displayName) {
        const wikiOpts = { staleTime: 24 * 60 * 60_000 };
        void utils.countries.getWikiRichIntro.prefetch({ countryName: country.displayName }, wikiOpts);
        void utils.countries.getWikiSectionPreviews.prefetch({ countryName: country.displayName }, wikiOpts);
        void utils.countries.getWikiPageImages.prefetch({ countryName: country.displayName }, wikiOpts);
      }
      if (country.countryId) {
        const opts = { staleTime: 10 * 60_000 };
        void utils.countries.getMapSummary.prefetch({ countryId: country.countryId }, opts);
        void utils.geo.getNeighbors.prefetch({ countryId: country.countryId }, opts);
        void utils.geo.getCountrySovereignty.prefetch({ countryId: country.countryId }, opts);
      }
    },
    [utils]
  );

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (pinToolRef.current) {
        dropPin(lng, lat, layerDataMap);
      }
    },
    [dropPin, layerDataMap]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedCountry(null);
    onCountrySelect?.(null);
  }, [onCountrySelect]);

  /** Escape key: close panels in priority order */
  const handleEscapePress = useCallback(() => {
    if (isPinToolActive && pinPosition) {
      clearPin();
    } else if (selectedFeature) {
      setSelectedFeature(null);
    } else if (selectedCountry) {
      setSelectedCountry(null);
      onCountrySelect?.(null);
    }
  }, [isPinToolActive, pinPosition, clearPin, selectedFeature, selectedCountry, onCountrySelect]);

  /** Search result → fly to + optionally select as country */
  const handleSearchResult = useCallback(
    (result: { type: string; id: string; name: string; countryId: string | null; centroidLng: number; centroidLat: number }) => {
      const zoom = result.type === "country" ? 4 : result.type === "subdivision" ? 6 : 8;
      mapRef.current?.flyTo(result.centroidLng, result.centroidLat, zoom);

      if (result.type === "country") {
        const country: SelectedCountry = {
          featureId: result.id,
          displayName: result.name,
          fillColor: "#e8e5da",
          centroidLng: result.centroidLng,
          centroidLat: result.centroidLat,
          countryId: result.countryId,
        };
        setSelectedCountry(country);
        onCountrySelect?.(country);
      }
    },
    [onCountrySelect]
  );

  /** Neighbor chip click → fly to + select */
  const handleNeighborClick = useCallback(
    (neighbor: { featureId: string; countryId: string | null; displayName: string; centroidLng?: number; centroidLat?: number }) => {
      let lng = neighbor.centroidLng ?? 0;
      let lat = neighbor.centroidLat ?? 0;

      // Fallback: look up centroid from loaded political layer features
      if (lng === 0 && lat === 0) {
        const politicalLayer = mapLayers.find((l) => l.type === "political");
        if (politicalLayer?.data) {
          const match = politicalLayer.data.features.find(
            (f) =>
              f.properties?._id === neighbor.featureId ||
              f.properties?._displayName === neighbor.displayName
          );
          if (match?.properties) {
            lng = match.properties._centroidLng ?? 0;
            lat = match.properties._centroidLat ?? 0;
          }
        }
      }

      const country: SelectedCountry = {
        featureId: neighbor.featureId,
        displayName: neighbor.displayName,
        fillColor: "#e8e5da",
        centroidLng: lng,
        centroidLat: lat,
        countryId: neighbor.countryId,
      };
      setSelectedCountry(country);
      setGeographyFilter(null); // Clear geography filter on neighbor navigation
      onCountrySelect?.(country);

      // Fly to country — smart zoom: stay flat when already in Mercator
      if (mapRef.current && (lng !== 0 || lat !== 0)) {
        const currentZoom = mapRef.current.getMap()?.getZoom() ?? 1.8;
        const targetZoom = currentZoom >= 4 ? Math.max(currentZoom, 4) : 4;
        mapRef.current.flyTo(lng, lat, targetZoom);
      }
    },
    [onCountrySelect, mapLayers]
  );

  if (error) {
    return (
      <div
        className={`absolute inset-0 flex items-center justify-center bg-background ${className}`}
      >
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            Failed to load map data
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error.message || "Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 pb-[env(safe-area-inset-bottom)] ${className}`}>
      <IxWorldMap
        ref={mapRef}
        layers={mapLayers}
        capitals={capitalsGeoJson}
        overlayFeatures={overlayFeatures ?? undefined}
        overlayVisibility={overlayVisibility}
        onCountryClick={handleCountryClick}
        onCountryHover={handleCountryHover}
        onMapClick={handleMapClick}
        onFeatureClick={handleFeatureClick}
        onReady={handleMapReady}
        selectedCountryId={selectedCountry?.featureId}
        isMeasuring={isMeasuring}
        geographyFilter={geographyFilter}
        projectionMode={projectionMode}
        topCountryNames={topCountrySet}
      />

      {/* Layer controls + tools toolbar */}
      {showControls && (
        <MapControls
          visibleLayers={visibleLayers}
          onToggleLayer={toggleLayer}
          hoveredCountry={hoveredCountry}
          overlayVisibility={overlayVisibility}
          onToggleOverlay={toggleOverlay}
        >
          {toolsVisible && <MeasureTool mapRef={mapRef} onActiveChange={setIsMeasuring} />}
          {toolsVisible && (
            <button
              onClick={togglePinTool}
              className={`flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-md transition-colors sm:min-h-0 sm:min-w-0 ${
                isPinToolActive
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-card text-foreground hover:bg-accent"
              }`}
              title="Pin Info Tool — click map to inspect location"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Pin
            </button>
          )}
        </MapControls>
      )}

      {/* Search overlay */}
      {toolsVisible && (
        <MapSearchOverlay onSelectResult={handleSearchResult} />
      )}

      {/* Projection toggle (top-right, below NavigationControl) */}
      {showControls && (
        <ProjectionToggle
          projectionMode={projectionMode}
          onProjectionChange={setProjectionMode}
        />
      )}

      {/* Keyboard navigation (always active) */}
      <MapKeyboardControls
        mapRef={mapRef}
        onEscapePress={handleEscapePress}
        projectionMode={projectionMode}
        onProjectionChange={setProjectionMode}
      />

      {/* Pin info panel */}
      {isPinToolActive && pinPosition && (
        <MapPinInfoPanel
          pinPosition={pinPosition}
          clientResult={clientResult}
          serverResult={serverResult}
          isServerLoading={isServerLoading}
          onClose={clearPin}
        />
      )}

      {/* Country info panel */}
      {showPopup && selectedCountry && !selectedFeature && !isPinToolActive && (
        <CountryInfoPanel
          key={selectedCountry.featureId}
          country={selectedCountry}
          onClose={handleClosePanel}
          onNeighborClick={handleNeighborClick}
          onGeographyFilter={setGeographyFilter}
        />
      )}

      {/* Feature info panel (city/POI/capital) */}
      {showPopup && selectedFeature && !isPinToolActive && (
        <FeatureInfoPanel
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
        />
      )}

      {/* Full-screen loading overlay — shows until map data + engine are ready */}
      <MapLoadingScreen isReady={!isLoading && mapEngineReady} />
    </div>
  );
}
