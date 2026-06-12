"use client";

/**
 * MapContainer - Wrapper component that handles data loading and error states
 * for the IxWorldMap component. Fetches GeoJSON data via tRPC.
 */

import { useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useIsAdmin } from "~/hooks/usePermissions";
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
import type { MapLayerType } from "~/lib/map-config";
import type { SelectedCountry, IxWorldMapRef } from "./IxWorldMap";

// MapLibre CSS - imported here so it's in the main bundle
import "maplibre-gl/dist/maplibre-gl.css";

// Extracted hooks
import { useMapState } from "./hooks/useMapState";
import { useMapDataQueries } from "./hooks/useMapDataQueries";

const IxWorldMap = dynamic(() => import("./IxWorldMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#0a1628]" />,
});

const MapEditorOverlay = dynamic(() => import("~/components/maps/editor/MapEditorOverlay"), {
  ssr: false,
});

export interface MapContainerProps {
  className?: string;
  showControls?: boolean;
  showTools?: boolean; // Search + measure tools
  showPopup?: boolean;
  showLoading?: boolean; // Full-screen loading overlay
  initialLayers?: MapLayerType[];
  initialCountryId?: string;
  selectedCountryId?: string | null;
  initialCenter?: [number, number];
  initialZoom?: number;
  onCountrySelect?: (country: SelectedCountry | null) => void;
  forceFlatProjection?: boolean;
  controlledVisibleLayers?: Set<MapLayerType>;
  onToggleLayer?: (layer: MapLayerType) => void;
  hideEditButtons?: boolean;
}

export function MapContainer({
  className = "",
  showControls = true,
  showTools,
  showPopup = true,
  showLoading = true,
  initialLayers,
  initialCountryId,
  selectedCountryId,
  initialCenter,
  initialZoom,
  onCountrySelect,
  forceFlatProjection = false,
  controlledVisibleLayers,
  onToggleLayer,
  hideEditButtons = false,
}: MapContainerProps) {
  const isAdmin = useIsAdmin();
  const toolsVisible = showTools ?? showControls;
  const mapRef = useRef<IxWorldMapRef>(null);
  const measureToolRef = useRef<{ toggle: () => void }>(null);

  // Real-time sync: invalidate map caches when any geo mutation succeeds
  useMapLiveSync();

  // Pin tool state
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

  // Fetch user profile to get countryId first
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  const userCountryId = userProfile?.countryId ?? null;

  // 1. Hook: Manage State (selections, controls, UI panels)
  const {
    selectedCountry,
    setSelectedCountry,
    selectedFeature,
    setSelectedFeature,
    isMeasuring,
    setIsMeasuring,
    mapEngineReady,
    setMapEngineReady,
    webglError,
    mapLoadTimeout,
    setMapLoadTimeout,
    geographyFilter,
    setGeographyFilter,
    projectionMode,
    setProjectionMode,
    isEditing,
    isWorldEditing,
    setIsWorldEditing,
    selectedRouteId,
    setSelectedRouteId,
    storyPinModalId,
    setStoryPinModalId,
    editingCountryId,
    currentZoom,
    setCurrentZoom,
    overlayVisibility,
    labelsVisible,
    toggleLabels,
    toggleOverlay,
    handleFeatureClick,
    handleCountryClick,
    handleCountryHover,
    handleMapClick,
    handleClosePanel,
    handleEditMap,
    handleExitEditor,
    handleOpenMyEditor,
    handleOpenWorldEditor,
    handleEscapePress,
    handleSearchResult,
    handleNeighborClick,
  } = useMapState({
    userCountryId, // passed from fetched profile
    isAdmin,
    onCountrySelect,
    mapRef,
    measureToolRef,
    mapLayers: [], // will be bound from queries
    layerDataMap: {}, // will be bound from queries
    isPinToolActive,
    pinPosition,
    dropPin,
    clearPin,
  });

  // 2. Hook: Manage Queries & Prefetching
  const {
    userCountryId: _queriedUserCountryId,
    mapLayers,
    toggleLayer,
    visibleLayers,
    overlayFeatures,
    capitalsGeoJson,
    topCountrySet,
    isPreloading,
    overlayData,
    error,
  } = useMapDataQueries({
    initialLayers,
    currentZoom,
    initialCountryId,
    selectedCountryId,
    overlayVisibility,
    mapEngineReady,
    setMapLoadTimeout,
    mapRef,
    setSelectedCountry,
    onCountrySelect,
    selectedCountry,
  });

  // Bind aggregated layer properties needed by state handlers
  const layerDataMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const ml of mapLayers) {
      map[ml.type] = ml.data;
    }
    return map;
  }, [mapLayers]);

  // Inject computed parameters back into state refs/configs
  const activeMapLayers = useMemo(() => {
    if (!controlledVisibleLayers) return mapLayers;
    return mapLayers.map((layer) => ({
      ...layer,
      visible: controlledVisibleLayers.has(layer.type),
    }));
  }, [mapLayers, controlledVisibleLayers]);

  // Setup callbacks/variables that link mapLayers / userCountryId
  const handleMapClickWithLayers = useCallback(
    (lng: number, lat: number) => {
      handleMapClick(lng, lat);
    },
    [handleMapClick]
  );

  const handleNeighborClickWithLayers = useCallback(
    (neighbor: any) => {
      handleNeighborClick(neighbor);
    },
    [handleNeighborClick]
  );

  const handleOpenMyEditorWithUser = useCallback(() => {
    if (userCountryId) {
      handleOpenMyEditor();
    } else {
      alert("You must have a country to edit the map. Go to /mycountry to create or claim one.");
    }
  }, [userCountryId, handleOpenMyEditor]);

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
        layers={activeMapLayers}
        capitals={capitalsGeoJson}
        overlayFeatures={overlayFeatures ?? undefined}
        overlayVisibility={overlayVisibility}
        onCountryClick={handleCountryClick}
        onCountryHover={handleCountryHover}
        onMapClick={handleMapClickWithLayers}
        onFeatureClick={handleFeatureClick}
        onReady={() => setMapEngineReady(true)}
        selectedCountryId={selectedCountry?.featureId}
        isMeasuring={isMeasuring}
        geographyFilter={geographyFilter}
        projectionMode={forceFlatProjection ? "mercator" : projectionMode}
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
          visibleLayers={controlledVisibleLayers ?? visibleLayers}
          onToggleLayer={onToggleLayer ?? toggleLayer}
          overlayVisibility={overlayVisibility}
          onToggleOverlay={toggleOverlay}
          labelsVisible={labelsVisible}
          onToggleLabels={toggleLabels}
          isMeasuring={isMeasuring}
          onToggleMeasure={() => measureToolRef.current?.toggle()}
          isPinActive={isPinToolActive}
          onTogglePin={togglePinTool}
          toolsVisible={toolsVisible}
          canEdit={hideEditButtons || isEditing || isWorldEditing ? false : !!userCountryId}
          onEditMap={handleOpenMyEditorWithUser}
          showWorldEditor={hideEditButtons || isEditing || isWorldEditing ? false : isAdmin}
          onOpenWorldEditor={handleOpenWorldEditor}
        />
      )}

      {/* MeasureTool */}
      {toolsVisible && (
        <MeasureTool
          ref={measureToolRef}
          mapRef={mapRef}
          onActiveChange={setIsMeasuring}
          headless
        />
      )}

      {/* Dynamic Island */}
      {toolsVisible && (
        <MapDynamicIsland
          projectionMode={forceFlatProjection ? "mercator" : projectionMode}
          onProjectionChange={forceFlatProjection ? () => {} : setProjectionMode}
          onSearchResult={handleSearchResult}
        />
      )}

      {/* Analytics legend */}
      <AnalyticsLegend overlayVisibility={overlayVisibility} />

      {/* Keyboard navigation */}
      <MapKeyboardControls
        mapRef={mapRef}
        onEscapePress={handleEscapePress}
        projectionMode={forceFlatProjection ? "mercator" : projectionMode}
        onProjectionChange={forceFlatProjection ? () => {} : setProjectionMode}
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
          onNeighborClick={handleNeighborClickWithLayers}
          onGeographyFilter={setGeographyFilter}
          onEditMap={handleEditMap}
        />
      )}

      {/* Feature info panel */}
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

      {/* Story pin modal */}
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

      {/* Route info panel */}
      {selectedRouteId && !isEditing && (
        <RouteInfoPanel
          routeId={selectedRouteId}
          onClose={() => setSelectedRouteId(null)}
          canEdit={!!userCountryId}
        />
      )}

      {/* Full-screen loading overlay */}
      {showLoading && <MapLoadingScreen isReady={!isPreloading && mapEngineReady} />}

      {/* First-visit welcome modal */}
      {showControls && <MapWelcomeModal isMapReady={!isPreloading && mapEngineReady} />}

      {/* Map editor overlay */}
      {isEditing && editingCountryId && (
        <MapEditorOverlay
          countryId={editingCountryId}
          mapLayers={mapLayers}
          onExit={handleExitEditor}
        />
      )}

      {/* World map editor overlay */}
      {isWorldEditing && (
        <MapEditorOverlay
          isWorldMode={true}
          mapLayers={mapLayers}
          onExit={() => setIsWorldEditing(false)}
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
                  ? "WebGL is either disabled, crashed, or not supported by your browser. Please check your hardware acceleration settings."
                  : "The map engine is taking longer than expected to load. This might be due to slow network speeds or database recovery mode."}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-500 active:scale-[0.98]"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
