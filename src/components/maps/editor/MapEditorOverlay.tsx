// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  MousePointer2,
  Pencil,
  Scissors,
  Merge,
  Undo2,
  Redo2,
  Wrench,
  Spline,
  Waves,
  Minimize2,
  Save,
  Check,
  X,
  Paintbrush,
  RefreshCw,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import { ToolOptionsBar } from "~/components/maps/editor/ToolOptionsBar";
import { ProvincePreviewLayer } from "~/components/maps/editor/province-importer";
import { TransportOverlay } from "~/components/maps/overlays/TransportOverlay";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import { haversineDistance } from "~/components/maps/editor/utils/map-helpers";
import { EditorWorkspaceLayout } from "./components/EditorWorkspaceLayout";
import { MapEditorSidebarPanels } from "./components/MapEditorSidebarPanels";
import { MapEditorAuxiliaryOverlays } from "./components/MapEditorAuxiliaryOverlays";

import { useMapEditorOverlayState } from "~/components/maps/editor/hooks/useMapEditorOverlayState";
import { useBorderEditorLayers } from "~/components/maps/editor/hooks/useBorderEditorLayers";
import { EditorHeader } from "~/components/maps/editor/components/EditorHeader";
import { RegionHoverTooltip } from "~/components/maps/editor/components/RegionHoverTooltip";
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
}

export default function MapEditorOverlay({
  countryId,
  onExit,
  isWorldMode = false,
  historicalYear,
}: MapEditorOverlayProps) {
  const mapRef = useRef<EditorMapRef>(null);

  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [brushRadius, setBrushRadius] = useState(20);
  const [brushTargetId, setBrushTargetId] = useState<string | null>(null);
  // Shared world-map instance — stays mounted across view ↔ border_edit so the
  // border editor attaches to it rather than spinning up a second map.
  const [sharedWorldMap, setSharedWorldMap] = useState<import("maplibre-gl").Map | null>(null);

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
    cursorCoords,
    cursorZoom,
    showGrid,
    setShowGrid,
    showGuides,
    setShowGuides,
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
    neighborGeometries: neighborGeoms,
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

  const [routeTypes, setRouteTypes] = React.useState<string[]>(["road"]);

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
      <div className="bg-background absolute inset-0 z-30 flex flex-col">
        {/* Loading splash — fades out when data is ready */}
        {showLoadingScreen && <EditorLoadingScreen countryName={countryInfo?.name} />}

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
              storyCategory={editor.storyPinForm.category}
              onStoryCategoryChange={(cat) =>
                editor.setStoryPinForm((f) => ({ ...f, category: cat }))
              }
              labelFontSize={editor.mapLabelForm.fontSize}
              onLabelFontSizeChange={(size) =>
                editor.setMapLabelForm((f) => ({ ...f, fontSize: size }))
              }
              labelColor={editor.mapLabelForm.color}
              onLabelColorChange={(color) => editor.setMapLabelForm((f) => ({ ...f, color }))}
              labelBold={editor.mapLabelForm.fontWeight === "bold"}
              onLabelBoldChange={(bold) =>
                editor.setMapLabelForm((f) => ({ ...f, fontWeight: bold ? "bold" : "normal" }))
              }
              routeTypes={routeTypes}
              onRouteTypesChange={setRouteTypes}
              selectedCount={
                editor.selectedIds.size > 0
                  ? editor.selectedIds.size
                  : editor.selectedFeature
                    ? 1
                    : 0
              }
              onDuplicate={
                editor.selectedFeature
                  ? () => editor.duplicateFeature(editor.selectedFeature)
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
                        if (!confirm(`Delete "${editor.selectedFeature.name}"?`)) return;
                        await editor.handleDeleteFeature(editor.selectedFeature);
                      }
                    : undefined
              }
              onFinishRoute={editor.finishRoute}
              onUndoWaypoint={editor.undoLastWaypoint}
              onReverseRoute={
                editor.routeWaypoints.length >= 2
                  ? () => editor.setRouteWaypoints([...editor.routeWaypoints].reverse())
                  : undefined
              }
              isSnapEnabled={editor.isSnapEnabled}
              onSnapToggle={() => editor.setIsSnapEnabled((v) => !v)}
              showGaps={editor.showGaps}
              emptyRegionsCount={emptyRegionsCount}
              onCreateCentroidCities={editor.createCentroidCities}
              // City actions / scatter / snapping
              onScatterCities={editor.scatterCities}
              onSnapCityToSubdivisionBorder={
                editor.selectedFeature
                  ? () => editor.snapCityToSubdivisionBorder(editor.selectedFeature.id)
                  : undefined
              }
              onSnapCityToCoastline={
                editor.selectedFeature
                  ? () => editor.snapCityToCoastline(editor.selectedFeature.id)
                  : undefined
              }
              cityCoordinates={editor.selectedFeature?.coordinates}
              onCityCoordinatesChange={
                editor.selectedFeature
                  ? (coords) =>
                      editor.updatePointCoordinates(
                        editor.selectedFeature.id,
                        editor.selectedFeature.type,
                        coords
                      )
                  : undefined
              }
              isPickingLocation={editor.isPickingLocation}
              onTogglePickingLocation={() => editor.setIsPickingLocation((p) => !p)}
              // Subdivision Actions
              onStartSplitSubdivision={() => editor.setMode("split-subdivision")}
              onExecuteSplitSubdivision={editor.executeSplitSubdivision}
              onMergeSelectedSubdivisions={editor.mergeSelectedSubdivisions}
              onApplyGeometryTransformation={editor.applyGeometryTransformation}
              onCancelSplit={() => editor.setMode("edit-subdivision")}
              selectedFeature={editor.selectedFeature}
              // Advanced City Operations
              selectedCitiesCount={selectedCitiesCount}
              onMergeSelectedCities={editor.mergeSelectedCities}
              onScalePopulation={editor.scaleSelectedCitiesPopulation}
              onRotateCities={editor.rotateSelectedCities}
              onSplitCity={editor.splitCity}
              subdivisionColor={editor.subdivisionForm.color}
              onSubdivisionColorChange={(c) =>
                editor.setSubdivisionForm((p) => ({ ...p, color: c }))
              }
              rulerPoints={editor.rulerPoints}
              rulerDistance={rulerDistance}
              onClearRuler={editor.clearRuler}
              wandMatchColor={editor.wandMatchColor}
              onWandMatchColorChange={editor.setWandMatchColor}
              wandMatchLevel={editor.wandMatchLevel}
              onWandMatchLevelChange={editor.setWandMatchLevel}
              wandMatchParent={editor.wandMatchParent}
              onWandMatchParentChange={editor.setWandMatchParent}
            />
          </EditorErrorBoundary>
        )}

        {/* Border Editor context bar — shown when in border edit mode */}
        {activeEditorMode === "border_edit" && borderState.featureId && (
          <EditorErrorBoundary name="BorderToolOptions">
            <div className="border-border bg-card/85 flex h-8 shrink-0 items-center justify-between border-b px-3 backdrop-blur-sm">
              {/* Left Side: Active Tool Options */}
              <div className="flex items-center gap-2">
                <div className="border-border mr-2 flex items-center gap-1.5 border-r pr-2">
                  <Scissors className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-foreground text-[11px] font-semibold">
                    Border Editor ({countryInfo?.name || "unnamed"})
                  </span>
                </div>

                {/* Tool-specific configuration */}
                {borderState.mode === "brush" && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Brush Size
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="200"
                      step="1"
                      value={brushRadius}
                      onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
                      className="accent-primary h-4 w-24"
                    />
                    <span className="text-muted-foreground w-12 text-right font-mono text-[11px] tabular-nums">
                      {brushRadius}km
                    </span>
                  </div>
                )}

                {borderState.mode === "split" && borderState.splitLine.length > 0 && (
                  <span className="animate-pulse text-[11px] font-medium text-amber-500">
                    Split Line: {borderState.splitLine.length} points
                  </span>
                )}

                {borderState.mode === "select" && (
                  <span className="text-muted-foreground text-[11px]">
                    Click a vertex/edge to start editing.
                  </span>
                )}

                {borderState.mode === "vertex_edit" && (
                  <span className="text-muted-foreground text-[11px]">
                    Drag vertices. Click midpoints to add vertices.
                  </span>
                )}

                {borderState.mode === "merge" && (
                  <span className="text-muted-foreground text-[11px]">
                    Select neighbor subdivisions to merge.
                  </span>
                )}

                {borderState.mode === "trace" && (
                  <span className="text-muted-foreground text-[11px]">
                    Click points on river/coast to trace.
                  </span>
                )}
              </div>

              {/* Right Side: Actions (Undo/Redo, Stats, Advanced, Save, Apply, Cancel) */}
              <div className="flex items-center gap-2">
                {/* Undo / Redo */}
                <div className="flex items-center gap-0.5">
                  <button
                    disabled={!(borderState.isDirty && borderState.undoStackState.position >= 0)}
                    onClick={borderActions.undo}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={
                      !(
                        borderState.isDirty &&
                        borderState.undoStackState.position <
                          borderState.undoStackState.entries.length - 1
                      )
                    }
                    onClick={borderActions.redo}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="bg-border h-4 w-px" />

                {/* Area Stats */}
                {borderState.areaKm2 !== null && (
                  <span className="text-muted-foreground text-[11px] font-medium select-none">
                    {borderState.areaKm2 > 1000000
                      ? `${(borderState.areaKm2 / 1000000).toFixed(2)}M km²`
                      : `${Math.round(borderState.areaKm2).toLocaleString()} km²`}
                  </span>
                )}

                <div className="bg-border h-4 w-px" />

                {/* Advanced operations popover */}
                <Popover>
                  <PopoverTrigger className="bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 cursor-pointer items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors">
                    <Wrench className="h-3 w-3" />
                    <span>Advanced</span>
                  </PopoverTrigger>
                  <PopoverContent
                    className="bg-popover border-border text-foreground z-[100] w-48 rounded-md border p-2 shadow-md"
                    align="end"
                  >
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() =>
                          confirm("Repair geometry spikes on this border? You can undo this.") &&
                          void borderActions.repair()
                        }
                        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors"
                        title="Repair geometry spikes"
                      >
                        <Wrench className="h-3.5 w-3.5 text-amber-500" />
                        <span>Repair Spikes</span>
                      </button>
                      <button
                        onClick={() =>
                          confirm("Smooth (Chaikin) this border geometry? You can undo this.") &&
                          void borderActions.smooth()
                        }
                        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors"
                        title="Soften corners (Chaikin smoothing)"
                      >
                        <Spline className="h-3.5 w-3.5 text-blue-500" />
                        <span>Smooth Geometry</span>
                      </button>
                      <button
                        onClick={() =>
                          confirm(
                            "Naturalize this coastline? This subdivides and randomizes the border. You can undo this."
                          ) && void borderActions.naturalize()
                        }
                        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors"
                        title="Subdivide and randomize for organic coastlines"
                      >
                        <Waves className="h-3.5 w-3.5 text-cyan-500" />
                        <span>Naturalize Coastline</span>
                      </button>
                      <button
                        onClick={() =>
                          confirm(
                            "Simplify this border (reduce vertex count)? You can undo this."
                          ) && void borderActions.simplify()
                        }
                        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors"
                        title="Reduce vertex count (Douglas-Peucker)"
                      >
                        <Minimize2 className="h-3.5 w-3.5 text-violet-500" />
                        <span>Simplify (Reduce Vertices)</span>
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="bg-border h-4 w-px" />

                {/* Save Draft */}
                <button
                  onClick={() => void borderActions.save()}
                  disabled={!borderState.isDirty || isSubmitting}
                  className="bg-muted/50 text-foreground hover:bg-accent flex h-6 cursor-pointer items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors disabled:opacity-30"
                  title="Save draft"
                >
                  <Save className="h-3 w-3" />
                  <span>{isSubmitting ? "Saving..." : "Save"}</span>
                </button>

                {/* Revert edits */}
                <button
                  onClick={borderActions.revert}
                  disabled={
                    !borderState.isDirty &&
                    borderState.splitLine.length === 0 &&
                    borderState.mergeTargets.length === 0
                  }
                  className="flex h-6 cursor-pointer items-center gap-1 rounded bg-red-500/10 px-2 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-30"
                  title="Revert all unsaved changes for this feature"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Revert</span>
                </button>

                {/* Apply & Exit */}
                <button
                  onClick={handleBorderToolbarSubmit}
                  disabled={
                    !borderState.isDirty &&
                    !(borderState.mode === "split" && borderState.splitLine.length >= 2) &&
                    !(borderState.mode === "merge" && borderState.mergeTargets.length > 0)
                  }
                  className="flex h-6 cursor-pointer items-center gap-1 rounded bg-emerald-600/20 px-2 text-[11px] font-medium text-emerald-500 transition-colors hover:bg-emerald-600/30 disabled:opacity-30"
                  title="Apply and exit"
                >
                  <Check className="h-3 w-3" />
                  <span>Apply</span>
                </button>

                <div className="bg-border h-4 w-px" />

                {/* Close / Exit Border Editor */}
                <button
                  onClick={handleExitBorderEdit}
                  className="bg-muted hover:bg-accent text-foreground flex h-6 cursor-pointer items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors"
                  title="Close Border Editor"
                >
                  <X className="h-3 w-3" />
                  <span>Close</span>
                </button>
              </div>
            </div>
          </EditorErrorBoundary>
        )}

        {/* Main content: Rail + Canvas + Panel */}
        <div className="flex min-h-0 flex-1">
          {/* Left tool rail — desktop only */}
          <div className="hidden shrink-0 sm:block">
            {isWorldMode && activeEditorMode === "border_edit" ? (
              <div className="border-border bg-card flex h-full w-10 flex-col items-center gap-0.5 border-r py-1">
                {[
                  { id: "select", label: "Select Mode", icon: MousePointer2, shortcut: "V" },
                  { id: "vertex_edit", label: "Edit Vertices", icon: Pencil, shortcut: "P" },
                  { id: "split", label: "Split Borders", icon: Scissors, shortcut: "X" },
                  { id: "merge", label: "Merge Borders", icon: Merge, shortcut: "M" },
                  { id: "trace", label: "Trace Rivers", icon: Waves, shortcut: "T" },
                  { id: "brush", label: "Brush Territory", icon: Paintbrush, shortcut: "B" },
                ].map((tool, i) => {
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
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0a1628]/80 backdrop-blur-sm">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.06)_0%,_transparent_70%)]" />
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
                // One persistent world map for both view and border_edit. Border
                // editing attaches its layers via useBorderEditorLayers, so the map
                // never reloads on mode switch. Country selection is suppressed while
                // editing so clicks drive vertex/split/brush logic instead.
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
              ) : (
                <EditorMap
                  ref={mapRef}
                  countryGeometry={editor.countryGeo?.geometry ?? null}
                  countryCentroid={editor.countryGeo?.centroid ?? null}
                  countryBbox={editor.countryGeo?.bbox ?? null}
                  features={editor.allFeatures ?? []}
                  mode={editor.mode}
                  pendingCoordinates={editor.pendingCoordinates}
                  pendingGeometry={editor.pendingGeometry}
                  selectedFeature={editor.selectedFeature}
                  onMapClick={editor.handleMapClick}
                  isPickingLocation={editor.isPickingLocation}
                  onDrawComplete={editor.handleDrawComplete}
                  onGeometryUpdate={editor.updateSubdivisionGeometry}
                  updatePointCoordinates={editor.updatePointCoordinates}
                  onFeatureSelect={handleSelectFeature}
                  onApplyEyedropper={editor.applyEyedropper}
                  onApplyMagicWand={editor.applyMagicWand}
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
                  onApplyPaintFill={editor.applyPaintFill}
                  guides={editor.guides}
                  setGuides={editor.setGuides}
                  showGuides={showGuides}
                  snapEnabled={snapEnabled}
                  snapTolerance={snapTolerance}
                />
              )}

              {/* Region stats tooltip */}
              <RegionHoverTooltip hoveredFeature={hoveredFeature} editorMode={editor.mode} />

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
              {transportRouteData && mapInstance && (
                <TransportOverlay
                  map={mapInstance}
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
          cursorCoords={cursorCoords}
          mode={editor.mode}
          terrainInfo={
            cursorTerrainInfo
              ? {
                  elevation: cursorTerrainInfo.elevation?.zoneName ?? null,
                  climate: cursorTerrainInfo.climate?.climateName ?? null,
                }
              : editor.pointInfo
                ? {
                    elevation: editor.pointInfo.elevation?.zoneName ?? null,
                    climate: editor.pointInfo.climate?.climateName ?? null,
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
