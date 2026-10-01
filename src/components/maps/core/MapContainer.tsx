"use client";

/**
 * MapContainer - Wrapper component that handles data loading and error states
 * for the IxWorldMap component. Fetches GeoJSON data via tRPC.
 */

import { useRef, useMemo, useCallback, useState, useEffect, useDeferredValue } from "react";
import { Xmark, WarningTriangle } from "iconoir-react";
import dynamic from "next/dynamic";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { useIsAdmin, useIsStaff } from "~/hooks/usePermissions";
import { useMapPinInfo } from "~/hooks/useMapPinInfo";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { MapControls } from "./MapControls";
import { useIsMobile } from "~/hooks/useIsMobile";
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
import { TimelineScrubber } from "./TimelineScrubber";
import { MapRealmProvider } from "./MapRealmContext";
import type { FeatureCollection } from "geojson";
import type { MapLayerType } from "~/lib/maps/map-config";
import type { SelectedCountry, IxWorldMapRef, MapLayerData } from "./IxWorldMap";

// MapLibre CSS - imported here so it's in the main bundle
import "maplibre-gl/dist/maplibre-gl.css";

// Extracted hooks
import { useMapState } from "./hooks/useMapState";
import { useMapDataQueries } from "./hooks/useMapDataQueries";
import { getMapZoomBucket } from "~/hooks/useMapDataBatched";
import { useMapTour } from "./hooks/useMapTour";
import { TourHUD } from "./components/TourHUD";

const IxWorldMap = dynamic(() => import("./IxWorldMap"), {
  ssr: false,
  loading: () => <div className="bg-map-ocean absolute inset-0" />,
});

const MapEditorOverlay = dynamic(() => import("~/components/maps/editor/MapEditorOverlay"), {
  ssr: false,
});

const BETA_DISMISS_KEY = "ixmaps:beta-notice-dismissed";

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
  /** Exposes the live MapLibre instance so callers can attach overlays/editors. */
  onMapReady?: (map: import("maplibre-gl").Map | null) => void;
  /** Suppress country click-to-select + flyTo (e.g. while a border editor owns clicks). */
  disableCountrySelect?: boolean;
  /** Realm slug to show (`?realm=`); undefined = the viewer's realm. Editors opened here edit it too. */
  realm?: string;
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
  onMapReady,
  disableCountrySelect = false,
  realm,
}: MapContainerProps) {
  const utils = api.useUtils();
  const isAdmin = useIsAdmin();
  const isStaff = useIsStaff();
  const [showGatekeepingWarning, setShowGatekeepingWarning] = useState(true);
  const isMobile = useIsMobile();
  const toolsVisible = showTools ?? showControls;
  const mapRef = useRef<IxWorldMapRef>(null);
  const measureToolRef = useRef<{ toggle: () => void }>(null);

  // Real-time sync: invalidate map caches when any geo mutation succeeds
  useMapLiveSync();

  // Clear the exposed map handle when this container unmounts.
  useEffect(() => {
    return () => onMapReady?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  } = useMapPinInfo(realm);

  // Fetch user profile to get countryId first
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  const userCountryId = userProfile?.countryId ?? null;

  // Loaded layers, read lazily by click handlers (pin tool, neighbour lookup). The layers are
  // fetched after useMapState runs, so they are handed over through a ref-backed getter.
  const mapLayersRef = useRef<MapLayerData[]>([]);
  const getMapLayers = useCallback(() => mapLayersRef.current, []);

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
    getMapLayers,
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
    realm,
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
    userCountryId,
  });

  useEffect(() => {
    mapLayersRef.current = mapLayers;
  }, [mapLayers]);

  const deferredOverlayData = useDeferredValue(overlayData);

  // 1.5 Hook: Tour & Demo Mode State Machine
  const {
    tourState,
    currentStepIndex,
    isPaused,
    progress,
    startTour,
    exitTour,
    nextStep,
    prevStep,
    togglePause,
    currentStepData,
    totalSteps,
  } = useMapTour({
    mapRef,
    projectionMode,
    setProjectionMode,
    setSelectedCountry,
    mapLayers,
  });

  // Timeline scrubber: when the user scrubs to a past IxTime, fetch the
  // "as-of" political FeatureCollection and swap it into the political layer.
  // `null` = at "now", live data flows through.
  const [historicalIxTime, setHistoricalIxTime] = useState<number | null>(null);

  // Parent control state for the welcome & help modal
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean | undefined>(undefined);

  const historicalYear =
    historicalIxTime === null ? null : IxTime.getCurrentGameYear(historicalIxTime);

  const { data: historicalPolitical } = api.geoCore.getWorldMapAsOf.useQuery(
    { ixTime: historicalIxTime as number, realm },
    {
      enabled: historicalIxTime !== null,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
    }
  );

  // Inject computed parameters back into state refs/configs
  const activeMapLayers = useMemo(() => {
    const visibilityAdjusted = !controlledVisibleLayers
      ? mapLayers
      : mapLayers.map((layer) => ({
          ...layer,
          visible: controlledVisibleLayers.has(layer.type),
        }));

    // When scrubbed to a past date, swap the political layer's data for the
    // historical FeatureCollection. If the historical query has not returned
    // yet, keep the live layer so the map doesn't blink.
    if (historicalIxTime === null || !historicalPolitical) {
      return visibilityAdjusted;
    }
    return visibilityAdjusted.map((layer) =>
      layer.type === "political"
        ? { ...layer, data: historicalPolitical as FeatureCollection }
        : layer
    );
  }, [mapLayers, controlledVisibleLayers, historicalIxTime, historicalPolitical]);

  // Stable callbacks for the memoised IxWorldMap. Inline arrows here re-rendered the map
  // component (and re-ran all four of its layer hooks) on every container render.
  const onMapReadyRef = useRef(onMapReady);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);
  const handleMapReady = useCallback(() => {
    setMapEngineReady(true);
    onMapReadyRef.current?.(mapRef.current?.getMap() ?? null);
  }, [setMapEngineReady]);

  const handleRouteClick = useCallback(
    (id: string) => setSelectedRouteId(id),
    [setSelectedRouteId]
  );

  // Only the LOD bucket matters to data loading, so ignore zoom changes inside a bucket
  // instead of re-rendering the whole container after every zoom gesture.
  const handleZoomChange = useCallback(
    (zoom: number) =>
      setCurrentZoom((prev) =>
        prev !== undefined && getMapZoomBucket(prev) === getMapZoomBucket(zoom) ? prev : zoom
      ),
    [setCurrentZoom]
  );

  const handleToggleMeasure = useCallback(() => measureToolRef.current?.toggle(), []);
  const handleOpenWelcome = useCallback(() => setIsWelcomeOpen(true), []);
  const noopProjectionChange = useCallback(() => {}, []);
  const effectiveProjection = forceFlatProjection ? "mercator" : projectionMode;
  const handleProjectionChange = forceFlatProjection ? noopProjectionChange : setProjectionMode;

  // Bottom-left notices: the private-beta banner stays dismissed for this browser.
  // Read after mount (not in the initialiser) so server and client render the same markup.
  const [betaDismissed, setBetaDismissed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(BETA_DISMISS_KEY) === "1") setBetaDismissed(true);
    } catch {
      /* storage unavailable — show the notice */
    }
  }, []);
  const dismissBeta = useCallback(() => {
    setShowGatekeepingWarning(false);
    setBetaDismissed(true);
    try {
      localStorage.setItem(BETA_DISMISS_KEY, "1");
    } catch {
      /* storage unavailable (private mode) — dismissal lasts for this visit only */
    }
  }, []);

  const countryPanelOpen =
    showPopup && !!selectedCountry && !selectedFeature && !isPinToolActive && !isEditing;
  const featurePanelOpen = showPopup && !!selectedFeature && !isPinToolActive && !isEditing;
  /** A right-hand side panel (desktop) / bottom sheet (mobile) is showing. */
  const sidePanelOpen = countryPanelOpen || featurePanelOpen;

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
        role="alert"
        className={`bg-surface absolute inset-0 flex items-center justify-center p-6 ${className}`}
      >
        <div className="max-w-sm space-y-3 text-center">
          <WarningTriangle className="text-destructive mx-auto h-6 w-6" aria-hidden />
          <p className="text-label text-title-3">Couldn&apos;t load the map</p>
          <p className="text-label-secondary text-body">
            {error.message || "The map data didn't arrive. Check your connection and try again."}
          </p>
          <Button type="button" onClick={() => void utils.geoCore.getMapBundle.invalidate()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const tourIdle = tourState === "idle";
  const showBetaNotice = !isStaff && showGatekeepingWarning && !betaDismissed;
  const mapReady = !isPreloading && mapEngineReady;

  return (
    <div className={`absolute inset-0 pb-[env(safe-area-inset-bottom)] ${className}`}>
      <IxWorldMap
        ref={mapRef}
        layers={activeMapLayers}
        capitals={capitalsGeoJson}
        overlayFeatures={overlayFeatures ?? undefined}
        overlayVisibility={overlayVisibility}
        onCountryClick={disableCountrySelect || !tourIdle ? undefined : handleCountryClick}
        onCountryHover={tourIdle ? handleCountryHover : undefined}
        onMapClick={handleMapClick}
        onFeatureClick={tourIdle ? handleFeatureClick : undefined}
        onReady={handleMapReady}
        selectedCountryId={selectedCountry?.countryId || selectedCountry?.featureId}
        isMeasuring={isMeasuring}
        geographyFilter={geographyFilter}
        projectionMode={effectiveProjection}
        topCountryNames={topCountrySet}
        labelsVisible={labelsVisible}
        onZoomChange={handleZoomChange}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        overlayData={deferredOverlayData}
        onRouteClick={handleRouteClick}
      />

      {/* Layer controls + tools toolbar */}
      {showControls && tourIdle && (
        <MapControls
          variant={isMobile ? "mobile" : "desktop"}
          visibleLayers={controlledVisibleLayers ?? visibleLayers}
          onToggleLayer={onToggleLayer ?? toggleLayer}
          overlayVisibility={overlayVisibility}
          onToggleOverlay={toggleOverlay}
          labelsVisible={labelsVisible}
          onToggleLabels={toggleLabels}
          isMeasuring={isMeasuring}
          onToggleMeasure={handleToggleMeasure}
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
      {toolsVisible && tourIdle && (
        <MapDynamicIsland
          projectionMode={effectiveProjection}
          onProjectionChange={handleProjectionChange}
          onSearchResult={handleSearchResult}
          onOpenWelcome={handleOpenWelcome}
          realm={realm}
        />
      )}

      {/* Bottom-left stack: analytics legend + private-beta notice. Stacked in one column so
          they never overlap each other; hidden on mobile while the bottom sheet is up. */}
      <div
        className={`pointer-events-none absolute bottom-4 left-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-col-reverse items-start gap-2 sm:bottom-6 ${
          sidePanelOpen ? "max-sm:hidden" : ""
        }`}
      >
        <AnalyticsLegend overlayVisibility={overlayVisibility} overlayData={overlayData} />

        {showBetaNotice && (
          <FacetMaterial
            material="regular"
            role="note"
            className="rounded-card pointer-events-auto w-full max-w-sm p-3"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2">
              <WarningTriangle className="text-yellow mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <h4 className="text-label text-headline">Maps private beta</h4>
                <p className="text-label-secondary text-footnote leading-relaxed">
                  Explore the world map, terrain and other nations freely. Adding your own borders
                  or claiming territory isn&apos;t open to external players yet.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={dismissBeta}
                className="text-label-secondary -m-2 h-8 w-8 shrink-0 rounded-full"
                aria-label="Dismiss private beta notice"
              >
                <Xmark aria-hidden />
              </Button>
            </div>
          </FacetMaterial>
        )}
      </div>

      {/* Keyboard navigation + bottom-right credits (shifted left of the desktop side panel) */}
      <MapKeyboardControls
        mapRef={mapRef}
        onEscapePress={handleEscapePress}
        projectionMode={effectiveProjection}
        onProjectionChange={handleProjectionChange}
        measureAvailable={toolsVisible}
        sidePanelOpen={sidePanelOpen}
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
      {countryPanelOpen && selectedCountry && (
        <CountryInfoPanel
          key={selectedCountry.featureId}
          country={selectedCountry}
          onClose={handleClosePanel}
          onNeighborClick={handleNeighborClick}
          onGeographyFilter={setGeographyFilter}
          onEditMap={handleEditMap}
        />
      )}

      {/* Feature info panel */}
      {featurePanelOpen && selectedFeature && (
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
      {showLoading && <MapLoadingScreen isReady={mapReady} />}

      {/* First-visit welcome modal */}
      {showControls && (
        <MapWelcomeModal
          isMapReady={mapReady}
          onStartTour={startTour}
          isOpen={isWelcomeOpen}
          onClose={() => setIsWelcomeOpen(false)}
        />
      )}

      {/* Tour / Demo Mode HUD overlay (renders nothing while idle) */}
      {!tourIdle && (
        <TourHUD
          tourState={tourState}
          currentStepIndex={currentStepIndex}
          isPaused={isPaused}
          progress={progress}
          exitTour={exitTour}
          nextStep={nextStep}
          prevStep={prevStep}
          togglePause={togglePause}
          currentStepData={currentStepData}
          totalSteps={totalSteps}
        />
      )}

      {/* The country editor only ever edits the viewer's own (active) nation, so it works in that
          nation's realm — undefined = the viewer's realm — even when opened from /maps?realm=<other> */}
      <MapRealmProvider value={undefined}>
        {isEditing && editingCountryId && (
          <MapEditorOverlay
            countryId={editingCountryId}
            mapLayers={mapLayers}
            onExit={handleExitEditor}
            historicalYear={historicalYear}
            mapInstance={mapRef.current?.getMap() ?? null}
          />
        )}
      </MapRealmProvider>

      {/* The world editor edits the realm this map shows (ruling E-r) */}
      <MapRealmProvider value={realm}>
        {isWorldEditing && (
          <MapEditorOverlay
            isWorldMode={true}
            mapLayers={mapLayers}
            onExit={() => setIsWorldEditing(false)}
            historicalYear={historicalYear}
            mapInstance={mapRef.current?.getMap() ?? null}
          />
        )}
      </MapRealmProvider>

      {/* Historical timeline scrubber (read-only). Collapsed to a pill until opened; hidden on
          mobile while the bottom sheet is up and shifted clear of the desktop side panel. */}
      {showControls && tourIdle && !isEditing && !isWorldEditing && (
        <TimelineScrubber
          value={historicalIxTime}
          onChange={setHistoricalIxTime}
          className={sidePanelOpen ? "max-sm:hidden sm:right-[25rem]" : undefined}
        />
      )}

      {/* WebGL/Loading Error Fallback Overlay */}
      {(webglError || (mapLoadTimeout && !mapEngineReady)) && (
        <div
          role="alert"
          className="bg-map-ocean z-chrome absolute inset-0 flex items-center justify-center p-6 text-center"
        >
          <FacetMaterial material="thick" className="rounded-card max-w-md space-y-6 p-8">
            <WarningTriangle className="text-destructive mx-auto h-8 w-8" aria-hidden />
            <div className="space-y-2">
              <h3 className="text-label text-title-2">
                {webglError ? "WebGL Error Detected" : "Map Loading Timeout"}
              </h3>
              <p className="text-label-secondary text-body">
                {webglError
                  ? "WebGL is either disabled, crashed, or not supported by your browser. Please check your hardware acceleration settings."
                  : "The map engine is taking longer than expected to load. This might be due to slow network speeds or database recovery mode."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {!webglError && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setMapLoadTimeout(false)}
                  className="w-full sm:flex-1"
                >
                  Keep waiting
                </Button>
              )}
              <Button
                type="button"
                size="lg"
                onClick={() => window.location.reload()}
                className="bg-blue text-on-blue hover:bg-blue/90 w-full sm:flex-1"
              >
                Reload page
              </Button>
            </div>
          </FacetMaterial>
        </div>
      )}
    </div>
  );
}
