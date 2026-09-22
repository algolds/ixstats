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
} from "iconoir-react";
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
import { HypsometricElevationHUD } from "~/components/maps/editor/components/HypsometricElevationHUD";
import { MapEditorPluginProvider } from "~/components/maps/editor/plugins/context";
import {
  EditorLoadingScreen,
  EditorErrorBoundary,
} from "~/components/maps/editor/utils/editor-overlay-helpers";

const MapContainer = dynamic(
  () => import("~/components/maps/core/MapContainer").then((m) => m.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted flex h-full items-center justify-center">
        <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500" />
        <p className="text-muted-foreground ml-2 text-[11px]">Loading map canvas...</p>
      </div>
    ),
  }
);

const EditorMap = dynamic(() => import("~/components/maps/editor/EditorMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500" />
        <p className="text-muted-foreground text-sm">Loading map editor...</p>
      </div>
    </div>
  ),
});

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
    cursorZoom,
    showGrid,
    setShowGrid,
    showGuides,
    snapEnabled,
    setSnapEnabled,
    snapTolerance,
    setSnapTolerance,
    hoveredFeature,
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
    cursorTerrainInfo,
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
      | Array<{ featureId: string; geometry: Polygon | MultiPolygon | null }>
      | undefined,
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
            ? "bg-transparent pointer-events-none"
            : "bg-background pointer-events-auto"
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
                editor.selectedIds.size > 0
                  ? async () => {
                      if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
                      await editor.bulkDeleteSelected();
                    }
                  : editor.selectedFeature
                    ? async () => {
                        const sel = editor.selectedFeature;
                        if (!sel) return;
                        if (!confirm(`Delete "${sel.name}"?`)) return;
                        await editor.handleDeleteFeature(sel);
                      }
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
              onCreateCentroidCities={editor.createCentroidCities}
              // City actions / scatter / snapping
              onScatterCities={(count, type, prefix) => {
                if (editor.selectedFeature) {
                  editor.scatterCities(count, type, prefix);
                }
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
                  void editor.executeSplitSubdivision(editor.selectedFeature.id, []);
                }
              }}
              onMergeSelectedSubdivisions={editor.mergeSelectedSubdivisions}
              onApplyGeometryTransformation={(type, value) => {
                if (editor.selectedFeature && (type === "rotate" || type === "scale")) {
                  void editor.applyGeometryTransformation(editor.selectedFeature.id, {
                    type,
                    factor: value,
                  });
                }
              }}
              onCancelSplit={() => editor.setMode("edit-subdivision")}
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
              <div className="border-border bg-card flex h-full w-10 flex-col items-center gap-0.5 border-r py-1">
                {(
                  [
                    { id: "select", label: "Select Mode", icon: MousePointer2, shortcut: "V" },
                    { id: "vertex_edit", label: "Edit Vertices", icon: Pencil, shortcut: "P" },
                    { id: "split", label: "Split Borders", icon: Scissors, shortcut: "X" },
                    { id: "merge", label: "Merge Borders", icon: Merge, shortcut: "M" },
                    { id: "trace", label: "Trace Rivers", icon: Waves, shortcut: "T" },
                    { id: "brush", label: "Brush Territory", icon: Paintbrush, shortcut: "B" },
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
                      {i === 4 && <div className="bg-border my-0.5 h-px w-5 animate-none" />}
                      <div className="group relative flex items-center">
                        <button
                          onClick={() => borderActions.setMode(tool.id)}
                          className={`group relative flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          }`}
                          title={`${tool.label} (${tool.shortcut})`}
                        >
                          <FallbackIcon className="h-4 w-4" />

                          <div className="bg-popover text-popover-foreground ring-border pointer-events-none absolute top-1/2 left-full z-50 ml-1.5 hidden -translate-y-1/2 rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap shadow-md ring-1 group-hover:block">
                            {tool.label}
                            <span className="bg-muted text-muted-foreground ml-1.5 rounded px-1 py-0.5 text-[10px]">
                              {tool.shortcut}
                            </span>
                          </div>
                        </button>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
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
            panelA={renderPanel("panelA")}
            panelB={renderPanel("panelB")}
          >
            {isWorldMode && activeEditorMode === "border_edit" && borderState.isLoading && (
              <div className="bg-map-ocean/80 absolute inset-0 z-30 flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-emerald-500)_0%,transparent_70%)] opacity-[0.06]" />
                <div className="relative z-10 flex flex-col items-center gap-4 text-center">
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full border border-dashed border-emerald-500/30" />
                    <div className="absolute inset-2 animate-[spin_4s_linear_infinite_reverse] rounded-full border border-emerald-400/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="border-muted-foreground/20 h-6 w-6 animate-spin rounded-full border-2 border-t-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-foreground text-xs font-semibold">
                      Loading Border Editor...
                    </h2>
                    {countryInfo?.name && (
                      <p className="text-muted-foreground mt-1 text-[10px]">{countryInfo.name}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <EditorErrorBoundary name="Map">
              {isWorldMode ? (
                // If a map instance is already warm from parent MapContainer, reuse it directly
                // without creating a second WebGL context. If standalone, mount MapContainer.
                initialMapInstance ? (
                  <div className="h-full w-full pointer-events-none" />
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
                  />
                )
              ) : (
                <EditorMap
                  ref={mapRef}
                  onMapReady={(map) => {
                    setActiveEditorMap(map);
                    setMapInstance(map);
                  }}
                  countryGeometry={toPolygonGeometry(editor.countryGeo?.geometry as object | null)}
                  countryCentroid={editor.countryGeo?.centroid ?? null}
                  countryBbox={editor.countryGeo?.bbox ?? null}
                  features={editor.allFeatures ?? []}
                  mode={editor.mode}
                  pendingCoordinates={editor.pendingCoordinates}
                  selectedFeature={editor.selectedFeature}
                  selectedIds={editor.selectedIds}
                  onToggleSelect={editor.toggleSelectId}
                  onMapClick={(lng, lat) => editor.handleMapClick([lng, lat])}
                  isPickingLocation={editor.isPickingLocation}
                  onDrawComplete={editor.handleDrawComplete}
                  onGeometryUpdate={editor.updateSubdivisionGeometry}
                  updatePointCoordinates={(id, type, coords) =>
                    editor.updatePointCoordinates(type, id, coords)
                  }
                  onFeatureSelect={handleSelectFeature}
                  worldMapLayers={worldMapLayers}
                  editorVisibleLayers={editorVisibleLayers}
                  showGrid={showGrid}
                  routeWaypoints={editor.routeWaypoints}
                  editingRouteId={editor.editingRouteId}
                  editingRouteVertices={editor.editingRouteVertices}
                  onRouteVerticesUpdate={editor.setEditingRouteVertices}
                  onRouteEditCommit={editor.commitRouteEdit}
                  onRouteEditCancel={editor.cancelRouteEdit}
                  layerVisibility={{
                    regions: layerStates.regions?.visible ?? true,
                    cities: layerStates.cities?.visible ?? true,
                    pois: layerStates.pois?.visible ?? true,
                    stories: layerStates.stories?.visible ?? true,
                    labels: layerStates.labels?.visible ?? true,
                    routes: layerStates.routes?.visible ?? true,
                  }}
                  lockedLayers={{
                    regions: layerStates.regions?.locked ?? false,
                    cities: layerStates.cities?.locked ?? false,
                    pois: layerStates.pois?.locked ?? false,
                    stories: layerStates.stories?.locked ?? false,
                    labels: layerStates.labels?.locked ?? false,
                    routes: layerStates.routes?.locked ?? false,
                  }}
                  layerOpacity={{
                    regions: layerStates.regions?.opacity ?? 0.6,
                    cities: layerStates.cities?.opacity ?? 1,
                    pois: layerStates.pois?.opacity ?? 1,
                    stories: layerStates.stories?.opacity ?? 1,
                    labels: layerStates.labels?.opacity ?? 1,
                    routes: layerStates.routes?.opacity ?? 1,
                  }}
                  onFeatureContextMenu={(feature, screenPos) => {
                    setContextMenu({
                      x: screenPos.x,
                      y: screenPos.y,
                      feature,
                    });
                  }}
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
              <RegionHoverTooltip hoveredFeature={hoveredFeature} editorMode={editor.mode} />

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
          terrainInfo={
            cursorTerrainInfo
              ? {
                  elevation: cursorTerrainInfo.elevation?.zoneName ?? null,
                  climate: cursorTerrainInfo.climate?.climateName ?? null,
                }
              : null
          }
          zoom={cursorZoom}
          featureCount={editor.allFeatures.length}
        />

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
