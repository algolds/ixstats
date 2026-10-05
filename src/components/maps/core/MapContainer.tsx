"use client";

import { useRef, useCallback, useState, useEffect, useDeferredValue, type RefObject } from "react";
import dynamic from "next/dynamic";
import { useIsAdmin } from "~/hooks/usePermissions";
import { useNotify } from "~/hooks/useNotify";
import { useMapPinInfo } from "~/hooks/useMapPinInfo";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";
import { api } from "~/trpc/react";
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
import type { MapLayerType, ProjectionMode } from "~/lib/maps/map-config";
import type { SelectedCountry, IxWorldMapRef, MapLayerData } from "./IxWorldMap";

import "maplibre-gl/dist/maplibre-gl.css";

import { useMapState } from "./hooks/useMapState";
import { useMapDataQueries } from "./hooks/useMapDataQueries";
import { getMapZoomBucket } from "~/hooks/useMapDataBatched";
import { useMapTour } from "./hooks/useMapTour";
import { TourHUD } from "./components/TourHUD";
import { MapFailureOverlay, MapLoadError } from "./components/MapNotices";
import { useHistoricalMapLayers } from "./hooks/useHistoricalMapLayers";
import { isIxWorldView } from "~/lib/realms/realm-ids";

const IxWorldMap = dynamic(() => import("./IxWorldMap"), {
  ssr: false,
  loading: () => <div className="bg-map-ocean absolute inset-0" />,
});

const MapEditorOverlay = dynamic(() => import("~/components/maps/editor/MapEditorOverlay"), {
  ssr: false,
});

interface MapContainerProps {
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

type MapState = ReturnType<typeof useMapState>;
type MapPin = ReturnType<typeof useMapPinInfo>;

interface MapInfoPanelsProps {
  state: MapState;
  pin: MapPin;
  mapRef: RefObject<IxWorldMapRef | null>;
  countryPanelOpen: boolean;
  featurePanelOpen: boolean;
  canEdit: boolean;
}

const whenTrue = <T,>(condition: boolean, value: T) => (condition ? value : undefined);

const selectedMapId = (country: SelectedCountry | null) => country?.countryId || country?.featureId;

/** `sidePanelOpen`: a right-hand side panel (desktop) / bottom sheet (mobile) is showing. */
function getPanelFlags(allowed: boolean, country: unknown, feature: unknown) {
  const countryPanelOpen = allowed && !!country && !feature;
  const featurePanelOpen = allowed && !!feature;
  return {
    countryPanelOpen,
    featurePanelOpen,
    sidePanelOpen: countryPanelOpen || featurePanelOpen,
  };
}

function MapInfoPanels({
  state,
  pin,
  mapRef,
  countryPanelOpen,
  featurePanelOpen,
  canEdit,
}: MapInfoPanelsProps) {
  const { selectedCountry, selectedFeature, storyPinModalId, selectedRouteId } = state;
  return (
    <>
      {pin.isPinToolActive && pin.pinPosition && (
        <MapPinInfoPanel
          pinPosition={pin.pinPosition}
          clientResult={pin.clientResult}
          serverResult={pin.serverResult}
          isServerLoading={pin.isServerLoading}
          onClose={pin.clearPin}
        />
      )}

      {countryPanelOpen && selectedCountry && (
        <CountryInfoPanel
          key={selectedCountry.featureId}
          country={selectedCountry}
          onClose={state.handleClosePanel}
          onNeighborClick={state.handleNeighborClick}
          onGeographyFilter={state.setGeographyFilter}
          onEditMap={state.handleEditMap}
        />
      )}

      {featurePanelOpen && selectedFeature && (
        <FeatureInfoPanel
          feature={selectedFeature}
          onClose={() => state.setSelectedFeature(null)}
          onOpenStoryModal={(pinId) => {
            state.setStoryPinModalId(pinId);
            state.setSelectedFeature(null);
          }}
        />
      )}

      {storyPinModalId && (
        <StoryPinModal
          pinId={storyPinModalId}
          onClose={() => state.setStoryPinModalId(null)}
          onFlyTo={(lng, lat) => mapRef.current?.flyTo(lng, lat, 8)}
          onNavigateToPin={state.setStoryPinModalId}
        />
      )}

      {selectedRouteId && !state.isEditing && (
        <RouteInfoPanel
          routeId={selectedRouteId}
          onClose={() => state.setSelectedRouteId(null)}
          canEdit={canEdit}
        />
      )}
    </>
  );
}

interface MapEditorsProps {
  state: MapState;
  mapLayers: MapLayerData[];
  realm: string | undefined;
  historicalYear: number | null;
  mapRef: RefObject<IxWorldMapRef | null>;
}

function MapEditors({ state, mapLayers, realm, historicalYear, mapRef }: MapEditorsProps) {
  const shared = { mapLayers, historicalYear, mapInstance: mapRef.current?.getMap() ?? null };
  return (
    <>
      {/* The country editor only ever edits the viewer's own (active) nation, so it works in that
          nation's realm (undefined = the viewer's realm) even when opened from /maps?realm=<other> */}
      <MapRealmProvider value={undefined}>
        {state.isEditing && state.editingCountryId && (
          <MapEditorOverlay
            countryId={state.editingCountryId}
            onExit={state.handleExitEditor}
            {...shared}
          />
        )}
      </MapRealmProvider>
      {/* The world editor edits the realm this map shows (ruling E-r) */}
      <MapRealmProvider value={realm}>
        {state.isWorldEditing && (
          <MapEditorOverlay isWorldMode onExit={() => state.setIsWorldEditing(false)} {...shared} />
        )}
      </MapRealmProvider>
    </>
  );
}

interface MapToolbarsProps {
  state: MapState;
  pin: MapPin;
  mapRef: RefObject<IxWorldMapRef | null>;
  measureToolRef: RefObject<{ toggle: () => void } | null>;
  showControls: boolean;
  toolsVisible: boolean;
  tourIdle: boolean;
  visibleLayers: Set<MapLayerType>;
  onToggleLayer: (layer: MapLayerType) => void;
  hasCountry: boolean;
  isAdmin: boolean;
  hideEditButtons: boolean;
  onEditMap: () => void;
  projectionMode: ProjectionMode;
  onProjectionChange: (mode: ProjectionMode) => void;
  onOpenWelcome: () => void;
  realm: string | undefined;
}

function MapToolbars({
  state,
  pin,
  mapRef,
  measureToolRef,
  showControls,
  toolsVisible,
  tourIdle,
  visibleLayers,
  onToggleLayer,
  hasCountry,
  isAdmin,
  hideEditButtons,
  onEditMap,
  projectionMode,
  onProjectionChange,
  onOpenWelcome,
  realm,
}: MapToolbarsProps) {
  const isMobile = useIsMobile();
  const editAllowed = !hideEditButtons && !state.isEditing && !state.isWorldEditing;
  const toggleMeasure = useCallback(() => measureToolRef.current?.toggle(), [measureToolRef]);
  return (
    <>
      {showControls && tourIdle && (
        <MapControls
          variant={isMobile ? "mobile" : "desktop"}
          visibleLayers={visibleLayers}
          onToggleLayer={onToggleLayer}
          overlayVisibility={state.overlayVisibility}
          onToggleOverlay={state.toggleOverlay}
          labelsVisible={state.labelsVisible}
          onToggleLabels={state.toggleLabels}
          isMeasuring={state.isMeasuring}
          onToggleMeasure={toggleMeasure}
          isPinActive={pin.isPinToolActive}
          onTogglePin={pin.togglePinTool}
          toolsVisible={toolsVisible}
          canEdit={editAllowed && hasCountry}
          onEditMap={onEditMap}
          showWorldEditor={editAllowed && isAdmin}
          onOpenWorldEditor={state.handleOpenWorldEditor}
        />
      )}

      {toolsVisible && (
        <MeasureTool
          ref={measureToolRef}
          mapRef={mapRef}
          onActiveChange={state.setIsMeasuring}
          headless
        />
      )}

      {toolsVisible && tourIdle && (
        <MapDynamicIsland
          projectionMode={projectionMode}
          onProjectionChange={onProjectionChange}
          onSearchResult={state.handleSearchResult}
          onOpenWelcome={onOpenWelcome}
          realm={realm}
        />
      )}
    </>
  );
}

interface MapOverlaysProps {
  state: MapState;
  tour: ReturnType<typeof useMapTour>;
  /** The IxWorld tour is offered only on IxWorld's map. */
  tourAvailable: boolean;
  showLoading: boolean;
  showControls: boolean;
  mapReady: boolean;
  isWelcomeOpen: boolean | undefined;
  onCloseWelcome: () => void;
  historicalIxTime: number | null;
  onHistoricalChange: (ixTime: number | null) => void;
  sidePanelOpen: boolean;
}

/** Full-screen loading, first-visit welcome, tour HUD and the WebGL / timeout fallback. */
function MapOverlays({
  state,
  tour,
  tourAvailable,
  showLoading,
  showControls,
  mapReady,
  isWelcomeOpen,
  onCloseWelcome,
  historicalIxTime,
  onHistoricalChange,
  sidePanelOpen,
}: MapOverlaysProps) {
  const tourIdle = tour.tourState === "idle";
  const failed = state.webglError || (state.mapLoadTimeout && !state.mapEngineReady);
  return (
    <>
      {showLoading && <MapLoadingScreen isReady={mapReady} />}

      {showControls && (
        <MapWelcomeModal
          isMapReady={mapReady}
          onStartTour={tourAvailable ? tour.startTour : undefined}
          isOpen={isWelcomeOpen}
          onClose={onCloseWelcome}
        />
      )}

      {!tourIdle && <TourHUD {...tour} />}

      {/* Historical timeline scrubber (read-only). Collapsed to a pill until opened; hidden on
          mobile while the bottom sheet is up and shifted clear of the desktop side panel. */}
      {showControls && tourIdle && !state.isEditing && !state.isWorldEditing && (
        <TimelineScrubber
          value={historicalIxTime}
          onChange={onHistoricalChange}
          className={sidePanelOpen ? "max-sm:hidden sm:right-[25rem]" : undefined}
        />
      )}

      {failed && (
        <MapFailureOverlay
          webglError={!!state.webglError}
          onKeepWaiting={() => state.setMapLoadTimeout(false)}
        />
      )}
    </>
  );
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
  const toolsVisible = showTools ?? showControls;
  const mapRef = useRef<IxWorldMapRef>(null);
  const measureToolRef = useRef<{ toggle: () => void }>(null);

  useMapLiveSync();

  useEffect(() => {
    return () => onMapReady?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pin = useMapPinInfo(realm);

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  const userCountryId = userProfile?.countryId ?? null;
  // Ocean labels and the guided tour describe IxWorld only (AT-2).
  const ixWorld = isIxWorldView(realm, userProfile?.country?.realmId);

  // Loaded layers, read lazily by click handlers (pin tool, neighbour lookup). The layers are
  // fetched after useMapState runs, so they are handed over through a ref-backed getter.
  const mapLayersRef = useRef<MapLayerData[]>([]);
  const getMapLayers = useCallback(() => mapLayersRef.current, []);

  const state = useMapState({
    userCountryId,
    onCountrySelect,
    mapRef,
    getMapLayers,
    isPinToolActive: pin.isPinToolActive,
    pinPosition: pin.pinPosition,
    dropPin: pin.dropPin,
    clearPin: pin.clearPin,
  });
  const { selectedCountry, setMapEngineReady, setProjectionMode, isEditing } = state;

  const {
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
    currentZoom: state.currentZoom,
    initialCountryId,
    selectedCountryId,
    overlayVisibility: state.overlayVisibility,
    mapEngineReady: state.mapEngineReady,
    setMapLoadTimeout: state.setMapLoadTimeout,
    mapRef,
    setSelectedCountry: state.setSelectedCountry,
    onCountrySelect,
    selectedCountry,
  });

  useEffect(() => {
    mapLayersRef.current = mapLayers;
  }, [mapLayers]);

  const deferredOverlayData = useDeferredValue(overlayData);

  const tour = useMapTour({
    mapRef,
    projectionMode: state.projectionMode,
    setProjectionMode,
    setSelectedCountry: state.setSelectedCountry,
    mapLayers,
  });

  const { activeMapLayers, historicalIxTime, setHistoricalIxTime, historicalYear } =
    useHistoricalMapLayers(mapLayers, controlledVisibleLayers, realm);

  // Parent control state for the welcome & help modal
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean | undefined>(undefined);

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

  // Only the LOD bucket matters to data loading, so ignore zoom changes inside a bucket
  // instead of re-rendering the whole container after every zoom gesture.
  const { setCurrentZoom } = state;
  const handleZoomChange = useCallback(
    (zoom: number) =>
      setCurrentZoom((prev) =>
        prev !== undefined && getMapZoomBucket(prev) === getMapZoomBucket(zoom) ? prev : zoom
      ),
    [setCurrentZoom]
  );

  const handleOpenWelcome = useCallback(() => setIsWelcomeOpen(true), []);
  const noopProjectionChange = useCallback(() => {}, []);
  const effectiveProjection = forceFlatProjection ? "mercator" : state.projectionMode;
  const handleProjectionChange = forceFlatProjection ? noopProjectionChange : setProjectionMode;

  const { handleOpenMyEditor } = state;
  const notify = useNotify();
  const handleOpenMyEditorWithUser = useCallback(() => {
    if (userCountryId) {
      handleOpenMyEditor();
    } else {
      notify.warning(
        "You need a country to edit the map",
        "Create or claim one from MyCountry first."
      );
    }
  }, [userCountryId, handleOpenMyEditor, notify]);

  if (error) {
    return (
      <MapLoadError
        className={className}
        message={error.message}
        onRetry={() => void utils.geoCore.getMapBundle.invalidate()}
      />
    );
  }

  const { countryPanelOpen, featurePanelOpen, sidePanelOpen } = getPanelFlags(
    showPopup && !pin.isPinToolActive && !isEditing,
    selectedCountry,
    state.selectedFeature
  );

  const tourIdle = tour.tourState === "idle";
  const mapReady = !isPreloading && state.mapEngineReady;

  return (
    <div className={`absolute inset-0 pb-[env(safe-area-inset-bottom)] ${className}`}>
      <IxWorldMap
        ref={mapRef}
        layers={activeMapLayers}
        capitals={capitalsGeoJson}
        overlayFeatures={overlayFeatures}
        overlayVisibility={state.overlayVisibility}
        onCountryClick={whenTrue(tourIdle && !disableCountrySelect, state.handleCountryClick)}
        onCountryHover={whenTrue(tourIdle, state.handleCountryHover)}
        onMapClick={state.handleMapClick}
        onFeatureClick={whenTrue(tourIdle, state.handleFeatureClick)}
        onReady={handleMapReady}
        selectedCountryId={selectedMapId(selectedCountry)}
        isMeasuring={state.isMeasuring}
        geographyFilter={state.geographyFilter}
        projectionMode={effectiveProjection}
        topCountryNames={topCountrySet}
        labelsVisible={state.labelsVisible}
        onZoomChange={handleZoomChange}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        overlayData={deferredOverlayData}
        onRouteClick={state.setSelectedRouteId}
        showOceanLabels={ixWorld}
      />

      <MapToolbars
        state={state}
        pin={pin}
        mapRef={mapRef}
        measureToolRef={measureToolRef}
        showControls={showControls}
        toolsVisible={toolsVisible}
        tourIdle={tourIdle}
        visibleLayers={controlledVisibleLayers ?? visibleLayers}
        onToggleLayer={onToggleLayer ?? toggleLayer}
        hasCountry={!!userCountryId}
        isAdmin={isAdmin}
        hideEditButtons={hideEditButtons}
        onEditMap={handleOpenMyEditorWithUser}
        projectionMode={effectiveProjection}
        onProjectionChange={handleProjectionChange}
        onOpenWelcome={handleOpenWelcome}
        realm={realm}
      />

      {/* Bottom-left stack: analytics legend; hidden on mobile while the bottom sheet is up. */}
      <div
        className={`pointer-events-none absolute bottom-4 left-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-col-reverse items-start gap-2 sm:bottom-6 ${
          sidePanelOpen ? "max-sm:hidden" : ""
        }`}
      >
        <AnalyticsLegend overlayVisibility={state.overlayVisibility} overlayData={overlayData} />
      </div>

      {/* Keyboard navigation + bottom-right credits (shifted left of the desktop side panel) */}
      <MapKeyboardControls
        mapRef={mapRef}
        onEscapePress={state.handleEscapePress}
        projectionMode={effectiveProjection}
        onProjectionChange={handleProjectionChange}
        measureAvailable={toolsVisible}
        sidePanelOpen={sidePanelOpen}
      />

      {/* Feature panels read the wiki of the realm this map shows */}
      <MapRealmProvider value={realm}>
        <MapInfoPanels
          state={state}
          pin={pin}
          mapRef={mapRef}
          countryPanelOpen={countryPanelOpen}
          featurePanelOpen={featurePanelOpen}
          canEdit={!!userCountryId}
        />
      </MapRealmProvider>

      <MapOverlays
        state={state}
        tour={tour}
        tourAvailable={ixWorld}
        showLoading={showLoading}
        showControls={showControls}
        mapReady={mapReady}
        isWelcomeOpen={isWelcomeOpen}
        onCloseWelcome={() => setIsWelcomeOpen(false)}
        historicalIxTime={historicalIxTime}
        onHistoricalChange={setHistoricalIxTime}
        sidePanelOpen={sidePanelOpen}
      />

      <MapEditors
        state={state}
        mapLayers={mapLayers}
        realm={realm}
        historicalYear={historicalYear}
        mapRef={mapRef}
      />
    </div>
  );
}
