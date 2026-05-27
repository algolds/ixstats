"use client";

/**
 * MapContainer - Wrapper component that handles data loading and error states
 * for the IxWorldMap component. Fetches GeoJSON data via tRPC.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useMapDataBatched } from "~/hooks/useMapDataBatched";
import { useMapPinInfo } from "~/hooks/useMapPinInfo";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";
import { api } from "~/trpc/react";
import { MapControls } from "./MapControls";
import { CountryInfoPanel } from "./CountryInfoPanel";
import { FeatureInfoPanel } from "./FeatureInfoPanel";
import { StoryPinModal } from "./StoryPinModal";
import { RouteInfoPanel } from "./RouteInfoPanel";
import MapPinInfoPanel from "./MapPinInfoPanel";
import { MapDynamicIsland } from "./MapDynamicIsland";
import { AnalyticsLegend } from "./AnalyticsLegend";
import { MeasureTool } from "./MeasureTool";
import { MapKeyboardControls } from "./MapKeyboardControls";
import { MapLoadingScreen } from "./MapLoadingScreen";
import { MapWelcomeModal } from "./MapWelcomeModal";
// ProjectionToggle moved into MapSearchOverlay settings panel
import type { MapLayerType, ProjectionMode } from "~/lib/map-config";
import type {
  SelectedCountry,
  SelectedFeature,
  HoveredCountry,
  IxWorldMapRef,
  OverlayVisibility,
} from "./IxWorldMap";
import type { FeatureCollection } from "geojson";

// MapLibre CSS - imported here (not in dynamically-loaded IxWorldMap) so it's in the main bundle
import "maplibre-gl/dist/maplibre-gl.css";

// Dynamic import to avoid SSR issues with MapLibre
// Loading state handled by MapLoadingScreen overlay
const IxWorldMap = dynamic(() => import("./IxWorldMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#0a1628]" />,
});

// Fill overlays (wealth/population/crises) are mutually exclusive — they all
// recolor the same political fill layer via setPaintProperty.
const FILL_OVERLAY_KEYS: (keyof OverlayVisibility)[] = ["wealth", "population", "crises"];

// Editor overlay — dynamically loaded only when user enters edit mode
const MapEditorOverlay = dynamic(() => import("~/components/maps/editor/MapEditorOverlay"), {
  ssr: false,
});

export interface MapContainerProps {
  className?: string;
  showControls?: boolean;
  showTools?: boolean; // Search + measure tools (defaults to showControls)
  showPopup?: boolean;
  initialLayers?: MapLayerType[];
  /** Country ID to auto-select and fly to on mount (for deep linking) */
  initialCountryId?: string;
  /** Initial map center [lng, lat] for coordinate deep-linking (e.g. ?lat=X&lng=Y) */
  initialCenter?: [number, number];
  /** Initial zoom level for coordinate deep-linking (e.g. ?zoom=Z) */
  initialZoom?: number;
  onCountrySelect?: (country: SelectedCountry | null) => void;
}

export function MapContainer({
  className = "",
  showControls = true,
  showTools,
  showPopup = true,
  initialLayers,
  initialCountryId,
  initialCenter,
  initialZoom,
  onCountrySelect,
}: MapContainerProps) {
  const toolsVisible = showTools ?? showControls;
  const mapRef = useRef<IxWorldMapRef>(null);
  const measureToolRef = useRef<{ toggle: () => void }>(null);

  // Real-time sync: invalidate map caches when any geo mutation succeeds
  useMapLiveSync();

  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [_hoveredCountry, setHoveredCountry] = useState<HoveredCountry | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [mapEngineReady, setMapEngineReady] = useState(false);
  const handleMapReady = useCallback(() => setMapEngineReady(true), []);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [mapLoadTimeout, setMapLoadTimeout] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleWebGLErrorEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      setWebglError(customEvent.detail?.error || "WebGL Error detected");
    };

    const handleContextLostEvent = () => {
      setWebglError("WebGL context lost. Hardware acceleration might be disabled or overloaded.");
    };

    window.addEventListener("webgl-error" as any, handleWebGLErrorEvent);
    window.addEventListener("webgl-context-lost" as any, handleContextLostEvent);

    return () => {
      window.removeEventListener("webgl-error" as any, handleWebGLErrorEvent);
      window.removeEventListener("webgl-context-lost" as any, handleContextLostEvent);
    };
  }, []);

  const [geographyFilter, setGeographyFilter] = useState<{
    type: "continent" | "region";
    value: string;
  } | null>(null);
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>("dynamic");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [storyPinModalId, setStoryPinModalId] = useState<string | null>(null);
  const [editingCountryId, setEditingCountryId] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | undefined>(undefined);

  // Get user's country for the editor shortcut
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  const userCountryId = userProfile?.countryId ?? null;

  const {
    mapLayers,
    toggleLayer,
    visibleLayers,
    isLoading,
    error,
    overlayFeatures: batchedOverlayFeatures,
    capitalsGeoJson: batchedCapitalsGeoJson,
  } = useMapDataBatched(initialLayers, currentZoom);

  // Moved after isLoading is declared to avoid TS2448 (used before declaration)
  useEffect(() => {
    if (isLoading || mapEngineReady) return;

    const timer = setTimeout(() => {
      if (!mapEngineReady) {
        setMapLoadTimeout(true);
      }
    }, 8000);

    return () => clearTimeout(timer);
  }, [isLoading, mapEngineReady]);

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

  // Overlay features come from batched query + story pins/labels
  const { data: storyPinsGeoJson } = api.geoFeatures.getAllStoryPins.useQuery(undefined, {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const { data: mapLabelsGeoJson } = api.geoFeatures.getAllMapLabels.useQuery(undefined, {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const overlayFeatures = useMemo(() => {
    if (!batchedOverlayFeatures) return undefined;
    return {
      ...batchedOverlayFeatures,
      storyPins: storyPinsGeoJson ?? undefined,
      mapLabels: mapLabelsGeoJson ?? undefined,
    };
  }, [batchedOverlayFeatures, storyPinsGeoJson, mapLabelsGeoJson]);

  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>({
    cities: true,
    pois: true,
    subdivisions: true,
    wealth: false,
    population: false,
    diplomacy: false,
    crises: false,
    transport: false,
    storyPins: true,
    mapLabels: true,
  });

  // Analytics overlay data — only fetched when the corresponding toggle is ON
  const { data: wealthData } = api.geoCore.getRegionalChoropleth.useQuery(
    { metric: "gdpPerCapita", groupBy: "country" },
    { enabled: overlayVisibility.wealth, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  const { data: populationData } = api.geoCore.getRegionalChoropleth.useQuery(
    { metric: "population", groupBy: "country" },
    { enabled: overlayVisibility.population, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  const { data: crisisData } = api.geoCore.getCrisisRiskMap.useQuery(
    {},
    { enabled: overlayVisibility.crises, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  const { data: diplomacyData } = api.geoCore.getGeopoliticalOverlay.useQuery(undefined, {
    enabled: overlayVisibility.diplomacy,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const { data: transportData } = api.transport.getAllRoutesGeoJSON.useQuery(
    {},
    { enabled: overlayVisibility.transport, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );

  const overlayData = useMemo(
    () => ({
      wealth: wealthData ?? undefined,
      population: populationData ?? undefined,
      crises: crisisData ?? undefined,
      diplomacy: diplomacyData
        ? {
            relations: diplomacyData.relations,
            conflicts: diplomacyData.conflicts,
          }
        : undefined,
      transport: transportData ?? undefined,
    }),
    [wealthData, populationData, crisisData, diplomacyData, transportData]
  );

  const [labelsVisible, setLabelsVisible] = useState(true);
  const toggleLabels = useCallback(() => setLabelsVisible((v) => !v), []);

  // Fill overlays are mutually exclusive — they all color the same political layer

  const toggleOverlay = useCallback((key: keyof OverlayVisibility) => {
    setOverlayVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Fill overlays are mutually exclusive — turning one ON turns others OFF
      if (next[key] && FILL_OVERLAY_KEYS.includes(key)) {
        for (const k of FILL_OVERLAY_KEYS) {
          if (k !== key) next[k] = false;
        }
      }
      return next;
    });
  }, []);

  // Build a layer lookup for the pin tool's client-side query
  const layerDataMap = useMemo(() => {
    const map: Record<string, FeatureCollection | undefined> = {};
    for (const ml of mapLayers) {
      map[ml.type] = ml.data;
    }
    return map;
  }, [mapLayers]);

  // Capitals come from batched query
  const capitalsGeoJson = batchedCapitalsGeoJson;

  // Top-25 countries by composite importance (population + GDP + GDP/capita)
  const { data: topCountryNames } = api.countries.getTopCountriesByImportance.useQuery(
    { limit: 25 },
    { staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  const topCountrySet = useMemo(() => new Set(topCountryNames ?? []), [topCountryNames]);

  // Deep-link: auto-select and fly to a country on mount
  const { data: initialGeo } = api.geoCore.getCountryGeometry.useQuery(
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
      mapRef.current.flyTo((b.minLng + b.maxLng) / 2, (b.minLat + b.maxLat) / 2, 4);
    } else if (initialGeo.centroid) {
      mapRef.current.flyTo(initialGeo.centroid.lng, initialGeo.centroid.lat, 4);
    }
  }, [initialCountryId, initialGeo, onCountrySelect]);

  const measuringRef = useRef(false);
  measuringRef.current = isMeasuring;
  const pinToolRef = useRef(false);
  pinToolRef.current = isPinToolActive;

  const handleFeatureClick = useCallback((feature: SelectedFeature | null) => {
    setSelectedFeature(feature);
    if (feature) {
      // Clear country selection when a feature is selected
      setSelectedCountry(null);
      // Fly to feature location
      mapRef.current?.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
    }
  }, []);

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
    [onCountrySelect]
  );

  const utils = api.useUtils();

  const handleCountryHover = useCallback(
    (country: HoveredCountry | null) => {
      setHoveredCountry(country);
      if (!country) return;
      // Prefetch all panel data on hover (fallback if bulk warm hasn't finished yet)
      if (country.displayName) {
        const wikiOpts = { staleTime: 24 * 60 * 60_000 };
        void utils.countries.getWikiRichIntro.prefetch(
          { countryName: country.displayName },
          wikiOpts
        );
        void utils.countries.getWikiSectionPreviews.prefetch(
          { countryName: country.displayName },
          wikiOpts
        );
        void utils.countries.getWikiPageImages.prefetch(
          { countryName: country.displayName },
          wikiOpts
        );
      }
      if (country.countryId) {
        const opts = { staleTime: 10 * 60_000 };
        void utils.countries.getMapSummary.prefetch({ countryId: country.countryId }, opts);
        void utils.geoCore.getNeighbors.prefetch({ countryId: country.countryId }, opts);
        void utils.geoSovereignty.getCountrySovereignty.prefetch(
          { countryId: country.countryId },
          opts
        );
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

  const handleEditMap = useCallback(() => {
    if (selectedCountry?.countryId) {
      setEditingCountryId(selectedCountry.countryId);
      setIsEditing(true);
    }
  }, [selectedCountry]);

  const handleExitEditor = useCallback(() => {
    setIsEditing(false);
    setEditingCountryId(null);
  }, []);

  const handleOpenMyEditor = useCallback(() => {
    console.log("[MapContainer] handleOpenMyEditor triggered", { userCountryId });
    if (userCountryId) {
      setEditingCountryId(userCountryId);
      setIsEditing(true);
    } else {
      console.warn("[MapContainer] Cannot open editor: userCountryId is missing");
      alert("You must have a country to edit the map. Go to /mycountry to create or claim one.");
    }
  }, [userCountryId]);

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
    (result: {
      type: string;
      id: string;
      name: string;
      countryId: string | null;
      centroidLng: number;
      centroidLat: number;
    }) => {
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
    (neighbor: {
      featureId: string;
      countryId: string | null;
      displayName: string;
      centroidLng?: number;
      centroidLat?: number;
    }) => {
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
        className={`bg-background absolute inset-0 flex items-center justify-center ${className}`}
      >
        <div className="text-center">
          <p className="text-foreground text-lg font-medium">Failed to load map data</p>
          <p className="text-muted-foreground mt-1 text-sm">
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
        labelsVisible={labelsVisible}
        onZoomChange={setCurrentZoom}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        overlayData={overlayData}
        onRouteClick={(id) => setSelectedRouteId(id)}
      />

      {/* Layer controls + tools toolbar */}
      {showControls && (
        <MapControls
          visibleLayers={visibleLayers}
          onToggleLayer={toggleLayer}
          overlayVisibility={overlayVisibility}
          onToggleOverlay={toggleOverlay}
          labelsVisible={labelsVisible}
          onToggleLabels={toggleLabels}
          isMeasuring={isMeasuring}
          onToggleMeasure={() => measureToolRef.current?.toggle()}
          isPinActive={isPinToolActive}
          onTogglePin={togglePinTool}
          toolsVisible={toolsVisible}
          canEdit={!!userCountryId}
          onEditMap={handleOpenMyEditor}
        />
      )}

      {/* MeasureTool (headless — button is in MapControls, this handles map logic + readout) */}
      {toolsVisible && (
        <MeasureTool
          ref={measureToolRef}
          mapRef={mapRef}
          onActiveChange={setIsMeasuring}
          headless
        />
      )}

      {/* Dynamic Island — unified auth, geo search, and settings */}
      {toolsVisible && (
        <MapDynamicIsland
          projectionMode={projectionMode}
          onProjectionChange={setProjectionMode}
          onSearchResult={handleSearchResult}
        />
      )}

      {/* Analytics legend (shows when a fill/line overlay is active) */}
      <AnalyticsLegend overlayVisibility={overlayVisibility} />

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
      {showPopup && selectedCountry && !selectedFeature && !isPinToolActive && !isEditing && (
        <CountryInfoPanel
          key={selectedCountry.featureId}
          country={selectedCountry}
          onClose={handleClosePanel}
          onNeighborClick={handleNeighborClick}
          onGeographyFilter={setGeographyFilter}
          onEditMap={handleEditMap}
        />
      )}

      {/* Feature info panel (city/POI/capital/storyPin) */}
      {showPopup && selectedFeature && !isPinToolActive && !isEditing && (
        <FeatureInfoPanel
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
          onOpenStoryModal={(pinId) => {
            setStoryPinModalId(pinId);
            setSelectedFeature(null);
          }}
        />
      )}

      {/* Story pin modal — immersive reading experience */}
      {storyPinModalId && (
        <StoryPinModal
          pinId={storyPinModalId}
          onClose={() => setStoryPinModalId(null)}
          onFlyTo={(lng, lat) => {
            mapRef.current?.flyTo(lng, lat, 8);
          }}
          onNavigateToPin={(pinId) => setStoryPinModalId(pinId)}
        />
      )}

      {/* Route info panel — shown when a transport route is clicked */}
      {selectedRouteId && !isEditing && (
        <RouteInfoPanel
          routeId={selectedRouteId}
          onClose={() => setSelectedRouteId(null)}
          canEdit={!!userCountryId}
        />
      )}

      {/* Full-screen loading overlay — shows until map data + engine are ready */}
      <MapLoadingScreen isReady={!isLoading && mapEngineReady} />

      {/* First-visit welcome modal — shows after loading screen dismisses */}
      {showControls && <MapWelcomeModal isMapReady={!isLoading && mapEngineReady} />}

      {/* Map editor overlay */}
      {isEditing && editingCountryId && (
        <MapEditorOverlay
          countryId={editingCountryId}
          mapLayers={mapLayers}
          onExit={handleExitEditor}
        />
      )}

      {/* WebGL/Loading Error Fallback Overlay */}
      {(webglError || mapLoadTimeout) && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#0a1628] p-6 text-center">
          <div className="glass-hierarchy-child max-w-md space-y-6 rounded-2xl border border-red-500/20 bg-black/60 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="h-8 w-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-13.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">
                {webglError ? "WebGL Error Detected" : "Map Loading Timeout"}
              </h3>
              <p className="text-sm text-white/60">
                {webglError
                  ? webglError
                  : "The map engine took too long to initialize. Hardware acceleration might be disabled, or your graphics card could be overloaded."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Reload Page
              </button>
              {mapLoadTimeout && !webglError && (
                <button
                  onClick={() => {
                    setMapLoadTimeout(false);
                    setMapEngineReady(true);
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Force Bypass
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
