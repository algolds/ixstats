"use client";

import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  CursorPointer as MousePointer2,
  EditPencil as Pencil,
  Cut as Scissors,
  GitMerge as Merge,
  SeaWaves as Waves,
  ColorPicker as Paintbrush,
  SystemRestart as Loader,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { Tooltip } from "~/components/ui/tooltip";
import { BorderEditorToolOptions } from "~/components/maps/editor/toolbars/options/BorderEditorToolOptions";

import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import { ToolOptionsBar } from "~/components/maps/editor/ToolOptionsBar";
import { ProvincePreviewLayer } from "~/components/maps/editor/province-importer";
import { TransportOverlay } from "~/components/maps/overlays/TransportOverlay";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Polygon, MultiPolygon } from "geojson";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import type { BorderEditMode } from "~/hooks/useBorderEditor";
import { haversineDistance, toPolygonGeometry } from "~/components/maps/editor/utils/map-helpers";
import { EditorWorkspaceLayout } from "./components/EditorWorkspaceLayout";
import { MapEditorSidebarPanels } from "./components/MapEditorSidebarPanels";
import { MapEditorAuxiliaryOverlays } from "./components/MapEditorAuxiliaryOverlays";

import { useMapEditorOverlayState } from "~/components/maps/editor/hooks/useMapEditorOverlayState";
import { useBorderEditorLayers } from "~/components/maps/editor/hooks/useBorderEditorLayers";
import { EditorHeader } from "~/components/maps/editor/components/EditorHeader";
import { RegionHoverTooltip } from "~/components/maps/editor/components/RegionHoverTooltip";
import { CursorTerrainProbe } from "~/components/maps/editor/components/CursorTerrainProbe";
import { EditorConfirmHost } from "~/components/maps/editor/components/EditorConfirmDialog";
import { useIsMobile } from "~/hooks/useIsMobile";
import { HypsometricElevationHUD } from "~/components/maps/editor/components/HypsometricElevationHUD";
import { MapEditorPluginProvider } from "~/components/maps/editor/plugins/context";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import {
  EditorLoadingScreen,
  EditorErrorBoundary,
} from "~/components/maps/editor/utils/editor-overlay-helpers";

const MapContainer = dynamic(
  () => import("~/components/maps/core/MapContainer").then((m) => m.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-fill-3 flex h-full items-center justify-center" role="status">
        <p className="text-label-secondary text-footnote">Loading map canvas…</p>
      </div>
    ),
  }
);

const EditorMap = dynamic(() => import("~/components/maps/editor/EditorMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-fill-3 flex h-full items-center justify-center" role="status">
      <p className="text-label-secondary text-body">Loading map editor…</p>
    </div>
  ),
});

/** Feature layers whose visibility / lock / opacity the Layers panel controls. */
const LAYER_KEYS = [
  "regions",
  "cities",
  "pois",
  "stories",
  "labels",
  "routes",
  "geography",
] as const;

interface MapEditorOverlayProps {
  countryId?: string;
  mapLayers?: MapLayerData[];
  onExit: () => void;
  isWorldMode?: boolean;
  historicalYear?: number | null;
  mapInstance?: import("maplibre-gl").Map | null;
}

export default function MapEditorOverlay({
  countryId,
  onExit,
  isWorldMode = false,
  historicalYear,
  mapInstance: initialMapInstance,
}: MapEditorOverlayProps) {
  const mapRef = useRef<EditorMapRef>(null);
  const realm = useMapRealm();
  // Phones use the bottom sheet; the docked side panels are not mounted there at all.
  const isMobile = useIsMobile();

  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [brushRadius, setBrushRadius] = useState(20);
  const [brushTargetId, setBrushTargetId] = useState<string | null>(null);
  // Shared world-map instance — stays mounted across view ↔ border_edit so the
  // border editor attaches to it rather than spinning up a second map.
  const [sharedWorldMap, setSharedWorldMap] = useState<import("maplibre-gl").Map | null>(
    () => initialMapInstance ?? null
  );

  const state = useMapEditorOverlayState({
    countryId,
    onExit,
    isWorldMode,
    mapRef,
  });

  const {
    activeCountryId,
    activeEditorMode,
    borderState,
    borderActions,
    editor,
    importer,
    neighborGeoms,
    disabledTools,
    activeSidebarTab,
    setActiveSidebarTab,
    isAdmin,
    generateTransport,
    recalculateGeo,
    handleRequestExit,
    isSubmitting,
    panelConfigs,
    setPanelConfigs,
    handleMoveTab,
    handleChangePanelPlacement,
    showGrid,
    setShowGrid,
    showGuides,
    snapEnabled,
    setSnapEnabled,
    snapTolerance,
    setSnapTolerance,
    showShortcuts,
    setShowShortcuts,
    contextMenu,
    setContextMenu,
    layerStates,
    setLayerStates,
    handleMapSelect,
    handleBorderToolbarSubmit,
    handleExitBorderEdit,
    simplifyAll,
    countryInfo,
    mapInstance,
    setMapInstance,
    worldMapLayers,
    editorVisibleLayers,
    toggleEditorLayer,
    transportRouteData,
    selectedRouteId,
    handleRouteClick,
    handleSelectFeature,
    toolsDisabled,
    featureCounts,
    panelsLocked,
    setPanelsLocked,
  } = state;

  // Attach border-editing layers/handlers to the shared world map when active.
  useBorderEditorLayers({
    map: sharedWorldMap,
    isActive: isWorldMode && activeEditorMode === "border_edit",
    geometry: borderState.geometry,
    neighborGeometries: neighborGeoms as
      Array<{ featureId: string; geometry: Polygon | MultiPolygon | null }> | undefined,
    mode: borderState.mode,
    splitLine: borderState.splitLine,
    mergeTargets: borderState.mergeTargets,
    selectedVertex: borderState.selectedVertex,
    onMapClick: borderActions.handleMapClick,
    onVertexDrag: borderActions.handleVertexDrag,
    onDragEnd: borderActions.commitDrag,
    brushRadius,
    brushTargetId,
    onBrushStroke: borderActions.applyBrushTransfer,
    traceStart: borderState.traceStart,
    onToggleMergeTarget: borderActions.toggleMergeTarget,
  });

  const selectedCitiesCount = React.useMemo(() => {
    return editor.allFeatures.filter((f) => editor.selectedIds.has(f.id) && f.type === "city")
      .length;
  }, [editor.allFeatures, editor.selectedIds]);

  const emptyRegionsCount = React.useMemo(() => {
    return editor.emptyRegionsFeatures?.features?.length ?? 0;
  }, [editor.emptyRegionsFeatures]);

  const rulerDistance = React.useMemo(() => {
    let total = 0;
    const pts = editor.rulerPoints;
    if (pts && pts.length > 1) {
      for (let i = 0; i < pts.length - 1; i++) {
        total += haversineDistance(pts[i]!, pts[i + 1]!);
      }
    }
    return total;
  }, [editor.rulerPoints]);

  const [activeEditorMap, setActiveEditorMap] = React.useState<MapLibreMap | null>(null);

  // Stable per-layer props for EditorMap (value-equal objects keep their identity, so the
  // map layers are not re-uploaded on unrelated editor re-renders).
  const layerVisibility = React.useMemo(() => {
    const out: Record<string, boolean> = { border: layerStates.border?.visible ?? true };
    for (const k of LAYER_KEYS) out[k] = layerStates[k]?.visible ?? true;
    return out;
  }, [layerStates]);
  const lockedLayers = React.useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const k of LAYER_KEYS) out[k] = layerStates[k]?.locked ?? false;
    return out;
  }, [layerStates]);
  const layerOpacity = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (const k of LAYER_KEYS) out[k] = layerStates[k]?.opacity ?? (k === "regions" ? 0.6 : 1);
    return out;
  }, [layerStates]);
  const countryGeometry = React.useMemo(
    () => toPolygonGeometry(editor.countryGeo?.geometry as object | null),
    [editor.countryGeo?.geometry]
  );
  const handleEditorMapReady = React.useCallback(
    (map: MapLibreMap | null) => {
      setActiveEditorMap(map);
      setMapInstance(map);
    },
    [setMapInstance]
  );
  const handleEditorMapClick = React.useCallback(
    (lng: number, lat: number) => editor.handleMapClick([lng, lat]),
    [editor]
  );
  const handleUpdatePointCoordinates = React.useCallback(
    (
      id: string,
      type: "city" | "poi" | "storyPin" | "mapLabel" | "peak",
      coords: [number, number]
    ) => editor.updatePointCoordinates(type, id, coords),
    [editor]
  );
  const handleFeatureContextMenu = React.useCallback(
    (
      feature: import("~/hooks/useMapEditor").EditorFeature,
      screenPos: { x: number; y: number }
    ) => {
      setContextMenu({ x: screenPos.x, y: screenPos.y, feature });
    },
    [setContextMenu]
  );
  // The in-progress polyline shown on the map: route waypoints, river path or split line.
  const activePolyline =
    editor.mode === "split-subdivision"
      ? editor.splitLine
      : editor.mode === "add-river"
        ? editor.riverPath
        : editor.routeWaypoints;

  const renderPanel = (panelId: "panelA" | "panelB") => (
    <MapEditorSidebarPanels
      panelId={panelId}
      state={state}
      panelConfigs={panelConfigs}
      setPanelConfigs={setPanelConfigs}
      activeSidebarTab={activeSidebarTab}
      setActiveSidebarTab={setActiveSidebarTab}
      handleMoveTab={handleMoveTab}
      handleChangePanelPlacement={handleChangePanelPlacement}
      layerStates={layerStates}
      setLayerStates={setLayerStates}
      editorVisibleLayers={editorVisibleLayers}
      toggleEditorLayer={toggleEditorLayer}
      featureCounts={featureCounts}
      brushTargetId={brushTargetId}
      setBrushTargetId={setBrushTargetId}
    />
  );

  const showLoadingScreen = !countryInfo && !isWorldMode;

  return (
    <MapEditorPluginProvider state={state}>
      <div
        className={`${
          isWorldMode && initialMapInstance
            ? "pointer-events-none bg-transparent"
            : "bg-surface pointer-events-auto"
        } absolute inset-0 z-30 flex flex-col`}
      >
        {/* Loading splash — fades out when data is ready */}
        {showLoadingScreen && <EditorLoadingScreen />}

        {/* Editor Header */}
        <EditorHeader
          countryInfo={countryInfo}
          activeEditorMode={activeEditorMode}
          isWorldMode={isWorldMode}
          activeCountryId={activeCountryId}
          editor={editor}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          mapRef={mapRef}
          isAdmin={isAdmin}
          editorVisibleLayers={editorVisibleLayers}
          toggleEditorLayer={toggleEditorLayer}
          generateTransport={generateTransport}
          recalculateGeo={recalculateGeo}
          simplifyAll={simplifyAll}
          handleRequestExit={handleRequestExit}
          onShowHelp={() => setShowWelcomeModal(true)}
          countryId={countryId}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          snapTolerance={snapTolerance}
          setSnapTolerance={setSnapTolerance}
          panelsLocked={panelsLocked}
          setPanelsLocked={setPanelsLocked}
          onDeleteSelection={() => void state.requestDeleteSelection()}
          onShowShortcuts={() => setShowShortcuts(true)}
        />

        {/* Photoshop-style context bar — shown when a feature tool is active */}
        {activeEditorMode !== "border_edit" && (
          <EditorErrorBoundary name="ToolOptions">
            <ToolOptionsBar
              mode={editor.mode}
              cityType={editor.cityForm.cityType}
              onCityTypeChange={(type) => editor.setCityForm((f) => ({ ...f, cityType: type }))}
              isNationalCapital={editor.cityForm.isNationalCapital}
              onCapitalChange={(val) =>
                editor.setCityForm((f) => ({ ...f, isNationalCapital: val }))
              }
              subdivisionType={editor.subdivisionForm.type}
              onSubdivisionTypeChange={(type) => editor.setSubdivisionForm((f) => ({ ...f, type }))}
              subdivisionLevel={editor.subdivisionForm.level}
              onSubdivisionLevelChange={(level) =>
                editor.setSubdivisionForm((f) => ({ ...f, level }))
              }
              poiCategory={editor.poiForm.category}
              onPoiCategoryChange={(cat) => editor.setPOIForm((f) => ({ ...f, category: cat }))}
              selectedCount={
                editor.selectedIds.size > 0
                  ? editor.selectedIds.size
                  : editor.selectedFeature
                    ? 1
                    : 0
              }
              onDuplicate={
                editor.selectedFeature
                  ? () => editor.duplicateFeature(editor.selectedFeature!)
                  : undefined
              }
              onDelete={
                editor.selectedIds.size > 0 || editor.selectedFeature
                  ? () => void state.requestDeleteSelection()
                  : undefined
              }
              // Route options
              routeType={editor.routeType}
              onRouteTypeChange={editor.setRouteType}
              routeWaypointsCount={editor.routeWaypoints.length}
              onUndoRouteWaypoint={editor.undoLastWaypoint}
              onClearRouteWaypoints={editor.clearRouteWaypoints}
              editingRouteName={
                editor.selectedFeature?.type === "route" ? editor.selectedFeature.name : undefined
              }
              editingRouteNodesCount={editor.editingRouteVertices.length}
              onRouteEditCommit={editor.commitRouteEdit}
              onRouteEditCancel={editor.cancelRouteEdit}
              showGaps={editor.showGaps}
              emptyRegionsCount={emptyRegionsCount}
              onCreateCentroidCities={() => void editor.createCentroidCities()}
              onCopyCoords={
                editor.selectedFeature?.coordinates
                  ? () => {
                      const c = editor.selectedFeature!.coordinates!;
                      void navigator.clipboard?.writeText(`${c[1].toFixed(5)}, ${c[0].toFixed(5)}`);
                    }
                  : undefined
              }
              onMoveToCoords={
                editor.selectedFeature?.coordinates
                  ? (lng, lat) =>
                      editor.updatePointCoordinates(
                        editor.selectedFeature!.type,
                        editor.selectedFeature!.id,
                        [lng, lat]
                      )
                  : undefined
              }
              // City actions / scatter / snapping
              onScatterCities={(count, type, prefix) => {
                void editor.scatterCities(count, type, prefix);
              }}
              onSnapCityToSubdivisionBorder={
                editor.selectedFeature ? () => editor.snapCityToSubdivisionBorder() : undefined
              }
              onSnapCityToCoastline={
                editor.selectedFeature ? () => editor.snapCityToCoastline() : undefined
              }
              cityCoordinates={editor.selectedFeature?.coordinates}
              onCityCoordinatesChange={
                editor.selectedFeature
                  ? (coords) =>
                      editor.updatePointCoordinates(
                        editor.selectedFeature!.type,
                        editor.selectedFeature!.id,
                        coords
                      )
                  : undefined
              }
              isPickingLocation={editor.isPickingLocation}
              onTogglePickingLocation={() => editor.setIsPickingLocation((p) => !p)}
              // Subdivision Actions
              onStartSplitSubdivision={() => editor.setMode("split-subdivision")}
              onExecuteSplitSubdivision={() => {
                if (editor.selectedFeature) {
                  void editor.executeSplitSubdivision(editor.selectedFeature.id);
                }
              }}
              splitPointsCount={editor.splitLine.length}
              onUndoWaypoint={editor.splitLine.length > 0 ? editor.undoLastSplitPoint : undefined}
              onMergeSelectedSubdivisions={editor.mergeSelectedSubdivisions}
              onApplyGeometryTransformation={(type, value) => {
                if (editor.selectedFeature && (type === "rotate" || type === "scale")) {
                  void editor.applyGeometryTransformation(editor.selectedFeature.id, {
                    type,
                    factor: value,
                  });
                }
              }}
              onCancelSplit={() =>
                editor.setMode(editor.selectedFeature ? "edit-subdivision" : "view")
              }
              selectedFeature={editor.selectedFeature}
              // Advanced City Operations
              selectedCitiesCount={selectedCitiesCount}
              onMergeSelectedCities={editor.mergeSelectedCities}
              onScalePopulation={editor.scaleSelectedCitiesPopulation}
              onRotateCities={editor.rotateSelectedCities}
              onSplitCity={editor.splitCity}
              rulerPoints={editor.rulerPoints}
              rulerDistance={rulerDistance}
              onClearRuler={editor.clearRuler}
              lassoTool={editor.lassoTool}
              onLassoToolChange={editor.setLassoTool}
            />
          </EditorErrorBoundary>
        )}

        {/* Border Editor context bar — shown when in border edit mode */}
        {activeEditorMode === "border_edit" && borderState.featureId && (
          <EditorErrorBoundary name="BorderToolOptions">
            <BorderEditorToolOptions
              countryName={countryInfo?.name}
              borderState={borderState}
              borderActions={borderActions}
              brushRadius={brushRadius}
              setBrushRadius={setBrushRadius}
              isSubmitting={isSubmitting}
              onSubmit={handleBorderToolbarSubmit}
              onExit={handleExitBorderEdit}
            />
          </EditorErrorBoundary>
        )}

        {/* Main content: Rail + Canvas + Panel */}
        <div className="flex min-h-0 flex-1">
          {/* Left tool rail — desktop only */}
          <div className="pointer-events-auto hidden shrink-0 sm:block">
            {isWorldMode && activeEditorMode === "border_edit" ? (
              <FacetMaterial
                material="regular"
                role="toolbar"
                aria-label="Border tools"
                aria-orientation="vertical"
                className="flex h-full w-10 flex-col items-center gap-0.5 rounded-none py-1"
              >
                {(
                  [
                    { id: "select", label: "Select mode", icon: MousePointer2, shortcut: "V" },
                    { id: "vertex_edit", label: "Edit vertices", icon: Pencil, shortcut: "P" },
                    { id: "split", label: "Split borders", icon: Scissors, shortcut: "X" },
                    { id: "merge", label: "Merge borders", icon: Merge, shortcut: "M" },
                    { id: "trace", label: "Trace rivers", icon: Waves, shortcut: "T" },
                    { id: "brush", label: "Brush territory", icon: Paintbrush, shortcut: "B" },
                  ] as const satisfies ReadonlyArray<{
                    id: BorderEditMode;
                    label: string;
                    icon: React.ComponentType<{ className?: string }>;
                    shortcut: string;
                  }>
                ).map((tool, i) => {
                  const isActive = borderState.mode === tool.id;
                  const FallbackIcon = tool.icon;
                  return (
                    <React.Fragment key={tool.id}>
                      {i === 4 && <div className="bg-separator my-0.5 h-px w-5" />}
                      <Tooltip content={tool.label} shortcut={tool.shortcut} side="right">
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          size="icon"
                          onClick={() => borderActions.setMode(tool.id)}
                          aria-label={`${tool.label} (${tool.shortcut})`}
                          aria-pressed={isActive}
                          className={isActive ? "" : "text-label-secondary"}
                        >
                          <FallbackIcon aria-hidden />
                        </Button>
                      </Tooltip>
                    </React.Fragment>
                  );
                })}
              </FacetMaterial>
            ) : (
              <MapEditorToolbar
                mode={editor.mode}
                onModeChange={editor.setMode}
                disabled={isWorldMode ? false : toolsDisabled}
                disabledTools={disabledTools}
              />
            )}
          </div>

          <EditorWorkspaceLayout
            panelConfigs={panelConfigs}
            panelsLocked={panelsLocked}
            toolsDisabled={toolsDisabled}
            isWorldMode={isWorldMode}
            panelA={isMobile ? null : renderPanel("panelA")}
            panelB={isMobile ? null : renderPanel("panelB")}
          >
            {isWorldMode && activeEditorMode === "border_edit" && borderState.isLoading && (
              <div
                role="status"
                className="bg-surface absolute inset-0 z-30 flex items-center justify-center"
              >
                <FacetMaterial
                  material="regular"
                  className="rounded-card flex items-center gap-3 px-5 py-4 text-left"
                >
                  <Loader aria-hidden className="text-label-secondary h-5 w-5 animate-spin" />
                  <div>
                    <h2 className="text-label text-headline">Loading border editor…</h2>
                    {countryInfo?.name && (
                      <p className="text-label-secondary text-footnote mt-0.5">
                        {countryInfo.name}
                      </p>
                    )}
                  </div>
                </FacetMaterial>
              </div>
            )}
            <EditorErrorBoundary name="Map">
              {isWorldMode ? (
                // If a map instance is already warm from parent MapContainer, reuse it directly
                // without creating a second WebGL context. If standalone, mount MapContainer.
                initialMapInstance ? (
                  <div className="pointer-events-none h-full w-full" />
                ) : (
                  <MapContainer
                    showControls={true}
                    showTools={false}
                    showPopup={false}
                    selectedCountryId={activeCountryId}
                    onCountrySelect={handleMapSelect}
                    disableCountrySelect={activeEditorMode === "border_edit"}
                    forceFlatProjection={true}
                    controlledVisibleLayers={editorVisibleLayers}
                    onToggleLayer={toggleEditorLayer}
                    hideEditButtons={true}
                    onMapReady={setSharedWorldMap}
                    realm={realm}
                  />
                )
              ) : (
                <EditorMap
                  ref={mapRef}
                  onMapReady={handleEditorMapReady}
                  countryGeometry={countryGeometry}
                  countryCentroid={editor.countryGeo?.centroid ?? null}
                  countryBbox={editor.countryGeo?.bbox ?? null}
                  features={editor.allFeatures}
                  mode={editor.mode}
                  pendingCoordinates={editor.pendingCoordinates}
                  selectedFeature={editor.selectedFeature}
                  selectedIds={editor.selectedIds}
                  onToggleSelect={editor.toggleSelectId}
                  onMapClick={handleEditorMapClick}
                  isPickingLocation={editor.isPickingLocation}
                  onDrawComplete={editor.handleDrawComplete}
                  onGeometryUpdate={editor.updateSubdivisionGeometry}
                  onVertexEditDirtyChange={state.setVertexEditDirty}
                  updatePointCoordinates={handleUpdatePointCoordinates}
                  onFeatureSelect={handleSelectFeature}
                  worldMapLayers={worldMapLayers}
                  editorVisibleLayers={editorVisibleLayers}
                  showGrid={showGrid}
                  routeWaypoints={activePolyline}
                  drawRouteType={editor.routeType}
                  editingRouteId={editor.editingRouteId}
                  editingRouteVertices={editor.editingRouteVertices}
                  onRouteVerticesUpdate={editor.setEditingRouteVertices}
                  onRouteEditCommit={editor.commitRouteEdit}
                  onRouteEditCancel={editor.cancelRouteEdit}
                  layerVisibility={layerVisibility}
                  lockedLayers={lockedLayers}
                  layerOpacity={layerOpacity}
                  onFeatureContextMenu={handleFeatureContextMenu}
                  gapFeatures={editor.gapFeatures}
                  showGaps={editor.showGaps}
                  emptyRegionsFeatures={editor.emptyRegionsFeatures}
                  showEmptyRegions={editor.showGaps}
                  rulerPoints={editor.rulerPoints}
                  lassoGeometry={editor.lassoGeometry}
                  setLassoGeometry={editor.setLassoGeometry}
                  onAddRulerPoint={editor.addRulerPoint}
                  onApplyLassoSelection={editor.applyLassoSelection}
                  onApplyRectSelection={editor.applyRectSelection}
                  lassoTool={editor.lassoTool}
                  guides={editor.guides}
                  setGuides={editor.setGuides}
                  showGuides={showGuides}
                  snapEnabled={snapEnabled}
                  snapTolerance={snapTolerance}
                />
              )}

              {/* Region stats tooltip */}
              <RegionHoverTooltip features={editor.allFeatures} editorMode={editor.mode} />

              {/* Hypsometric Cross-Section Elevation HUD */}
              {(editor.mode === "ruler" ||
                (editor.rulerPoints && editor.rulerPoints.length > 0)) && (
                <HypsometricElevationHUD
                  rulerPoints={editor.rulerPoints}
                  totalDistanceKm={rulerDistance}
                  onClose={editor.clearRuler}
                />
              )}

              {/* Province import preview overlay */}
              {editor.mode === "import-provinces" &&
                importer.currentProvinces.length > 0 &&
                mapInstance && (
                  <ProvincePreviewLayer
                    map={mapInstance}
                    provinces={importer.currentProvinces}
                    countryBorder={importer.countryBorder}
                    visible
                    cities={importer.alignedCities}
                  />
                )}

              {/* Transport routes overlay */}
              {transportRouteData && (activeEditorMap ?? mapInstance ?? initialMapInstance) && (
                <TransportOverlay
                  map={(activeEditorMap ?? mapInstance ?? initialMapInstance)!}
                  routeData={transportRouteData}
                  visible={layerStates.routes?.visible ?? true}
                  selectedRouteId={selectedRouteId}
                  onRouteClick={handleRouteClick}
                  maxBuiltYear={historicalYear}
                />
              )}
            </EditorErrorBoundary>
          </EditorWorkspaceLayout>
        </div>

        {/* Mobile tool rail */}
        <div className="sm:hidden">
          <MapEditorToolbar
            mode={editor.mode}
            onModeChange={editor.setMode}
            disabled={isWorldMode ? false : toolsDisabled}
            disabledTools={disabledTools}
            horizontal
          />
        </div>

        {/* Status Bar */}
        <EditorStatusBar
          mode={editor.mode}
          featureCount={editor.allFeatures.length}
          selectedCount={editor.selectedIds.size}
          isSaving={editor.isMutating}
          lastSavedAt={editor.lastSavedAt}
          hasUnsavedChanges={state.hasUnsavedChanges}
          error={editor.mutationError}
          onDismissError={() => editor.setMutationError(null)}
          onShowShortcuts={() => setShowShortcuts(true)}
        />

        {/* Leaf-only helpers: terrain lookup under the cursor and the confirm dialog host */}
        <CursorTerrainProbe />
        <EditorConfirmHost />

        {/* Auxiliary Overlays (mobile sheets, welcome modal, import wizards, shortcuts help) */}
        <MapEditorAuxiliaryOverlays
          state={state}
          onExit={onExit}
          showWelcomeModal={showWelcomeModal}
          setShowWelcomeModal={setShowWelcomeModal}
          showShortcuts={showShortcuts}
          setShowShortcuts={setShowShortcuts}
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          brushTargetId={brushTargetId}
          setBrushTargetId={setBrushTargetId}
        />
      </div>
    </MapEditorPluginProvider>
  );
}
