"use client";

import React, { useRef, useState } from "react";
import { BorderEditorToolOptions } from "~/components/maps/editor/toolbars/options/BorderEditorToolOptions";

import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import type { Polygon, MultiPolygon } from "geojson";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { EditorCanvas } from "./components/EditorCanvas";
import { EditorWorkspaceLayout } from "./components/EditorWorkspaceLayout";
import { BorderToolRail } from "./components/BorderToolRail";
import { ConnectedToolOptionsBar } from "./components/ConnectedToolOptionsBar";
import { MapEditorSidebarPanels } from "./components/MapEditorSidebarPanels";
import { MapEditorAuxiliaryOverlays } from "./components/MapEditorAuxiliaryOverlays";

import { useMapEditorOverlayState } from "~/components/maps/editor/hooks/useMapEditorOverlayState";
import { useBorderEditorLayers } from "~/components/maps/editor/hooks/useBorderEditorLayers";
import { EditorHeader } from "~/components/maps/editor/components/EditorHeader";
import { CursorTerrainProbe } from "~/components/maps/editor/components/CursorTerrainProbe";
import { EditorConfirmHost } from "~/components/maps/editor/components/EditorConfirmDialog";
import { useIsMobile } from "~/hooks/useIsMobile";
import { MapEditorPluginProvider } from "~/components/maps/editor/plugins/context";
import {
  EditorLoadingScreen,
  EditorErrorBoundary,
} from "~/components/maps/editor/utils/editor-overlay-helpers";

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
    handleBorderToolbarSubmit,
    handleExitBorderEdit,
    simplifyAll,
    countryInfo,
    editorVisibleLayers,
    toggleEditorLayer,
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
            <ConnectedToolOptionsBar
              editor={editor}
              onDeleteSelection={() => void state.requestDeleteSelection()}
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
              <BorderToolRail mode={borderState.mode} onModeChange={borderActions.setMode} />
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
            <EditorCanvas
              state={state}
              mapRef={mapRef}
              isWorldMode={isWorldMode}
              initialMapInstance={initialMapInstance}
              historicalYear={historicalYear}
              onSharedWorldMap={setSharedWorldMap}
            />
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
