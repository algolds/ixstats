// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Globe,
  Hexagon,
  MapPin,
  Landmark,
  BookMarked,
  Type as TypeIcon,
  Route,
  MousePointer2,
  Pencil,
  Scissors,
  Merge,
  CloudSun,
} from "lucide-react";

import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { FeatureList } from "~/components/maps/editor/FeatureList";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import { ToolOptionsBar } from "~/components/maps/editor/ToolOptionsBar";
import { BatchActionsBar } from "~/components/maps/editor/BatchActionsBar";
import { LayerPanel } from "~/components/maps/editor/LayerPanel";
import { MobileEditorSheet } from "~/components/maps/editor/MobileEditorSheet";
import {
  ProvinceImportWizard,
  ProvincePreviewLayer,
} from "~/components/maps/editor/province-importer";
import { TransportOverlay } from "~/components/maps/overlays/TransportOverlay";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { KeyboardShortcutSheet } from "~/components/maps/editor/KeyboardShortcutSheet";
import { BorderEditorToolbar } from "~/components/maps/editor/BorderEditorToolbar";
import { Dialog, DialogContent } from "~/components/ui/dialog";

import { useMapEditorOverlayState } from "~/components/maps/editor/hooks/useMapEditorOverlayState";
import { EditorHeader } from "~/components/maps/editor/components/EditorHeader";
import { LinkageValidationPanel } from "~/components/maps/editor/components/LinkageValidationPanel";
import { SovereigntyPanel } from "~/components/maps/editor/components/SovereigntyPanel";
import { PropertiesPanelContent } from "~/components/maps/editor/components/PropertiesPanelContent";
import { RegionHoverTooltip } from "~/components/maps/editor/components/RegionHoverTooltip";
import { EditorDialogs } from "~/components/maps/editor/components/EditorDialogs";
import { MapEditorWelcomeModal } from "~/components/maps/editor/components/MapEditorWelcomeModal";
import { EditorContextMenuWrapper } from "~/components/maps/editor/components/EditorContextMenuWrapper";
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

const BorderEditorMap = dynamic(
  () => import("~/components/maps/editor/BorderEditorMap").then((m) => m.BorderEditorMap),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted flex h-full items-center justify-center">
        <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500" />
        <p className="text-muted-foreground ml-2 text-[11px]">Loading border editor...</p>
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
}

export default function MapEditorOverlay({
  countryId,
  onExit,
  isWorldMode = false,
}: MapEditorOverlayProps) {
  const mapRef = useRef<EditorMapRef>(null);

  const [leftSplitRatio, setLeftSplitRatio] = useState(0.5);
  const [rightSplitRatio, setRightSplitRatio] = useState(0.5);
  const [bottomSplitRatio, setBottomSplitRatio] = useState(0.5);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const bottomDockRef = useRef<HTMLDivElement>(null);

  const handleVerticalSplitResize = (side: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startRatio = side === "left" ? leftSplitRatio : rightSplitRatio;
    const ref = side === "left" ? leftSidebarRef : rightSidebarRef;
    const containerHeight = ref.current?.getBoundingClientRect().height || 500;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaRatio = deltaY / containerHeight;
      const newRatio = Math.min(0.85, Math.max(0.15, startRatio + deltaRatio));
      if (side === "left") {
        setLeftSplitRatio(newRatio);
      } else {
        setRightSplitRatio(newRatio);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleHorizontalSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startRatio = bottomSplitRatio;
    const containerWidth = bottomDockRef.current?.getBoundingClientRect().width || 800;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaRatio = deltaX / containerWidth;
      const newRatio = Math.min(0.85, Math.max(0.15, startRatio + deltaRatio));
      setBottomSplitRatio(newRatio);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

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
    forgeMode,
    setForgeMode,
    showGrid,
    setShowGrid,
    paintMapMode,
    setPaintMapMode,
    hoveredFeature,
    showShortcuts,
    setShowShortcuts,
    contextMenu,
    setContextMenu,
    layerStates,
    setLayerStates,
    handleMapSelect,
    handleBorderToolbarSubmit,
    simplifyAll,
    countryInfo,
    mapInstance,
    worldMapLayers,
    editorVisibleLayers,
    toggleEditorLayer,
    transportRouteData,
    selectedRouteId,
    handleRouteClick,
    paintColors,
    handleSelectFeature,
    handleEditFeature,
    handleDeleteFeature,
    toolsDisabled,
    cursorTerrainInfo,
    setActiveEditorMode,
    featureCounts,
  } = state;

  const renderLayersElement = () => (
    <LayerPanel
      layers={[
        {
          id: "border",
          name: "Country Border",
          icon: Globe,
          visible: layerStates.border?.visible ?? true,
          locked: false,
        },
        {
          id: "climate",
          name: "Climate Zones",
          icon: CloudSun,
          visible: editorVisibleLayers.has("climate"),
          locked: true,
        },
        {
          id: "regions",
          name: "Regions",
          icon: Hexagon,
          visible: layerStates.regions?.visible ?? true,
          locked: layerStates.regions?.locked ?? false,
          opacity: layerStates.regions?.opacity ?? 0.6,
        },
        {
          id: "cities",
          name: "Cities",
          icon: MapPin,
          visible: layerStates.cities?.visible ?? true,
          locked: layerStates.cities?.locked ?? false,
          opacity: layerStates.cities?.opacity ?? 1,
        },
        {
          id: "pois",
          name: "POIs",
          icon: Landmark,
          visible: layerStates.pois?.visible ?? true,
          locked: layerStates.pois?.locked ?? false,
          opacity: layerStates.pois?.opacity ?? 1,
        },
        {
          id: "stories",
          name: "Story Pins",
          icon: BookMarked,
          visible: layerStates.stories?.visible ?? true,
          locked: layerStates.stories?.locked ?? false,
          opacity: layerStates.stories?.opacity ?? 1,
        },
        {
          id: "labels",
          name: "Labels",
          icon: TypeIcon,
          visible: layerStates.labels?.visible ?? true,
          locked: layerStates.labels?.locked ?? false,
          opacity: layerStates.labels?.opacity ?? 1,
        },
        {
          id: "routes",
          name: "Routes",
          icon: Route,
          visible: layerStates.routes?.visible ?? true,
          locked: layerStates.routes?.locked ?? false,
          opacity: layerStates.routes?.opacity ?? 1,
        },
      ]}
      onToggleVisibility={(id) => {
        if (id === "climate") {
          toggleEditorLayer("climate");
          return;
        }
        setLayerStates((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            visible: !(prev[id]?.visible ?? true),
          },
        }));
      }}
      onToggleLock={(id) => {
        if (id === "climate") return;
        setLayerStates((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            locked: !(prev[id]?.locked ?? false),
          },
        }));
      }}
      onOpacityChange={(id, val) => {
        setLayerStates((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            opacity: val,
          },
        }));
      }}
      featureCounts={featureCounts}
      features={editor.allFeatures}
      selectedFeature={editor.selectedFeature}
      onSelectFeature={handleSelectFeature}
      onEditFeature={handleEditFeature}
      onDeleteFeature={handleDeleteFeature}
      selectedIds={editor.selectedIds}
      onToggleSelect={editor.toggleSelectId}
    />
  );

  const renderRightPanelContent = () => <PropertiesPanelContent {...state} />;

  const renderPanel = (panelId: "panelA" | "panelB") => {
    const config = panelConfigs[panelId];
    const isStacked = panelConfigs.panelA.placement === panelConfigs.panelB.placement;
    return (
      <EditorPanel
        mode={editor.mode}
        collapsed={config.collapsed}
        onToggleCollapse={() =>
          setPanelConfigs((prev) => ({
            ...prev,
            [panelId]: { ...prev[panelId], collapsed: !prev[panelId].collapsed },
          }))
        }
        tabs={config.tabs}
        onTabDrop={(tabId) => handleMoveTab(tabId, panelId)}
        placement={config.placement}
        onChangePlacement={(placement) => handleChangePanelPlacement(panelId, placement)}
        isWorldMode={isWorldMode}
        activeTabOverride={activeSidebarTab}
        onTabChange={(tab) => setActiveSidebarTab(tab as any)}
        linkagesContent={<LinkageValidationPanel {...state} />}
        sovereigntyContent={<SovereigntyPanel {...state} />}
        featureCount={editor.allFeatures.length}
        featuresLoading={editor.featuresLoading}
        featureListContent={
          <FeatureList
            features={editor.allFeatures}
            selectedFeature={editor.selectedFeature}
            onSelectFeature={handleSelectFeature}
            onEditFeature={handleEditFeature}
            onDeleteFeature={handleDeleteFeature}
            isLoading={editor.featuresLoading}
            selectedIds={editor.selectedIds}
            onToggleSelect={editor.toggleSelectId}
            collapseAll={
              editor.mode.startsWith("add-") ||
              editor.mode.startsWith("edit-") ||
              editor.mode === "paint"
            }
          />
        }
        layersContent={renderLayersElement()}
        propertiesContent={renderRightPanelContent()}
        isStacked={isStacked}
      />
    );
  };

  const showLoadingScreen = !countryInfo && !isWorldMode;

  return (
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
        forgeMode={forgeMode}
        setForgeMode={setForgeMode}
        setActiveEditorMode={setActiveEditorMode}
        generateTransport={generateTransport}
        recalculateGeo={recalculateGeo}
        simplifyAll={simplifyAll}
        handleRequestExit={handleRequestExit}
        onShowHelp={() => setShowWelcomeModal(true)}
      />

      {/* Photoshop-style context bar */}
      {(!isWorldMode || activeEditorMode === "forge") && (
        <EditorErrorBoundary name="ToolOptions">
          <ToolOptionsBar
            mode={editor.mode}
            cityType={editor.cityForm.cityType}
            onCityTypeChange={(type) => editor.setCityForm((f) => ({ ...f, cityType: type }))}
            isNationalCapital={editor.cityForm.isNationalCapital}
            onCapitalChange={(val) => editor.setCityForm((f) => ({ ...f, isNationalCapital: val }))}
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
            paintMode={paintMapMode}
            onPaintModeChange={(m) => setPaintMapMode(m as any)}
            selectedCount={editor.selectedIds.size}
            onDelete={
              editor.selectedIds.size > 0
                ? async () => {
                    if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
                    await editor.bulkDeleteSelected();
                  }
                : undefined
            }
          />
        </EditorErrorBoundary>
      )}

      {/* Main content: Rail + Canvas + Panel */}
      <div className="flex min-h-0 flex-1">
        {/* Left tool rail — desktop only */}
        <div className="hidden shrink-0 sm:block">
          {isWorldMode && activeEditorMode === "border_edit" ? (
            <div className="border-border bg-card/45 z-10 flex h-full w-12 shrink-0 flex-col items-center gap-2 border-r py-3">
              <button
                onClick={() => borderActions.setMode("select")}
                className={`rounded-md p-2 transition-colors ${
                  borderState.mode === "select"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title="Select Mode"
              >
                <MousePointer2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => borderActions.setMode("vertex_edit")}
                className={`rounded-md p-2 transition-colors ${
                  borderState.mode === "vertex_edit"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title="Edit Vertices"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => borderActions.setMode("split")}
                className={`rounded-md p-2 transition-colors ${
                  borderState.mode === "split"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title="Split Borders"
              >
                <Scissors className="h-4 w-4" />
              </button>
              <button
                onClick={() => borderActions.setMode("merge")}
                className={`rounded-md p-2 transition-colors ${
                  borderState.mode === "merge"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title="Merge Borders"
              >
                <Merge className="h-4 w-4" />
              </button>
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

        {/* Left panel slot */}
        {(!toolsDisabled || isWorldMode) && (
          <div ref={leftSidebarRef} className="hidden h-full shrink-0 sm:flex">
            {panelConfigs.panelA.placement === "left" &&
              panelConfigs.panelB.placement !== "left" && (
                <EditorErrorBoundary name="LeftPanel-A">
                  {renderPanel("panelA")}
                </EditorErrorBoundary>
              )}
            {panelConfigs.panelB.placement === "left" &&
              panelConfigs.panelA.placement !== "left" && (
                <EditorErrorBoundary name="RightPanel-B">
                  {renderPanel("panelB")}
                </EditorErrorBoundary>
              )}
            {panelConfigs.panelA.placement === "left" &&
              panelConfigs.panelB.placement === "left" &&
              (() => {
                const collapsedA = panelConfigs.panelA.collapsed;
                const collapsedB = panelConfigs.panelB.collapsed;

                if (collapsedA && collapsedB) {
                  return (
                    <div className="bg-card/75 border-border flex h-full shrink-0 flex-col border-r backdrop-blur-md">
                      <EditorErrorBoundary name="LeftPanel-A">
                        {renderPanel("panelA")}
                      </EditorErrorBoundary>
                      <EditorErrorBoundary name="RightPanel-B">
                        {renderPanel("panelB")}
                      </EditorErrorBoundary>
                    </div>
                  );
                }

                if (collapsedA) {
                  return (
                    <div className="flex h-full shrink-0 flex-col">
                      <EditorErrorBoundary name="LeftPanel-A">
                        {renderPanel("panelA")}
                      </EditorErrorBoundary>
                      <div className="min-h-0 w-full flex-1">
                        <EditorErrorBoundary name="RightPanel-B">
                          {renderPanel("panelB")}
                        </EditorErrorBoundary>
                      </div>
                    </div>
                  );
                }

                if (collapsedB) {
                  return (
                    <div className="flex h-full shrink-0 flex-col">
                      <div className="min-h-0 w-full flex-1">
                        <EditorErrorBoundary name="LeftPanel-A">
                          {renderPanel("panelA")}
                        </EditorErrorBoundary>
                      </div>
                      <EditorErrorBoundary name="RightPanel-B">
                        {renderPanel("panelB")}
                      </EditorErrorBoundary>
                    </div>
                  );
                }

                // Both are expanded: vertical resizable split
                return (
                  <div className="flex h-full shrink-0 flex-col">
                    <div
                      style={{ height: `calc(${leftSplitRatio * 100}% - 2px)` }}
                      className="min-h-0 w-full shrink-0"
                    >
                      <EditorErrorBoundary name="LeftPanel-A">
                        {renderPanel("panelA")}
                      </EditorErrorBoundary>
                    </div>
                    <div
                      className="h-1 w-full shrink-0 cursor-row-resize bg-neutral-200 transition-colors hover:bg-blue-500/50 dark:bg-neutral-800 dark:hover:bg-blue-500/50"
                      onMouseDown={handleVerticalSplitResize("left")}
                    />
                    <div className="min-h-0 w-full flex-1">
                      <EditorErrorBoundary name="RightPanel-B">
                        {renderPanel("panelB")}
                      </EditorErrorBoundary>
                    </div>
                  </div>
                );
              })()}
          </div>
        )}

        {/* Center slot (Canvas + Bottom panels) */}
        <div className="relative flex h-full min-w-0 flex-1 flex-col">
          {/* Map canvas */}
          <div className="relative min-h-0 min-w-0 flex-1">
            <EditorErrorBoundary name="Map">
              {isWorldMode && activeEditorMode === "view" ? (
                <MapContainer
                  showControls={true}
                  showTools={false}
                  showPopup={false}
                  selectedCountryId={activeCountryId}
                  onCountrySelect={handleMapSelect}
                  forceFlatProjection={true}
                  controlledVisibleLayers={editorVisibleLayers}
                  onToggleLayer={toggleEditorLayer}
                  hideEditButtons={true}
                />
              ) : isWorldMode && activeEditorMode === "border_edit" ? (
                <BorderEditorMap
                  geometry={borderState.geometry}
                  neighborGeometries={neighborGeoms}
                  mode={borderState.mode}
                  splitLine={borderState.splitLine}
                  mergeTargets={borderState.mergeTargets}
                  selectedVertex={borderState.selectedVertex}
                  onMapClick={borderActions.handleMapClick}
                  onVertexDrag={borderActions.handleVertexDrag}
                  onDragEnd={borderActions.commitDrag}
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
                  onDrawComplete={editor.handleDrawComplete}
                  onFeatureSelect={handleSelectFeature}
                  worldMapLayers={worldMapLayers}
                  editorVisibleLayers={editorVisibleLayers}
                  showGrid={showGrid}
                  paintColors={paintColors}
                  routeWaypoints={editor.routeWaypoints}
                  layerVisibility={{
                    regions: layerStates.regions?.visible ?? true,
                    cities: layerStates.cities?.visible ?? true,
                    pois: layerStates.pois?.visible ?? true,
                    stories: layerStates.stories?.visible ?? true,
                    labels: layerStates.labels?.visible ?? true,
                    routes: layerStates.routes?.visible ?? true,
                  }}
                />
              )}

              {/* Border Editor Toolbar Overlay */}
              {activeEditorMode === "border_edit" && borderState.featureId && (
                <div className="absolute top-3 left-3 z-20">
                  <BorderEditorToolbar
                    mode={borderState.mode}
                    onModeChange={borderActions.setMode}
                    canUndo={borderState.isDirty && borderState.undoStackState.position >= 0}
                    canRedo={
                      borderState.isDirty &&
                      borderState.undoStackState.position <
                        borderState.undoStackState.entries.length - 1
                    }
                    onUndo={borderActions.undo}
                    onRedo={borderActions.redo}
                    onSave={() => void borderActions.save()}
                    onSubmit={handleBorderToolbarSubmit}
                    onCancel={() => {
                      borderActions.reset();
                      setActiveEditorMode("view");
                    }}
                    onRepair={() => void borderActions.repair()}
                    onSmooth={() => void borderActions.smooth()}
                    onNaturalize={() => void borderActions.naturalize()}
                    onSimplify={() => void borderActions.simplify()}
                    isDirty={borderState.isDirty}
                    isSaving={isSubmitting}
                    areaKm2={borderState.areaKm2}
                    splitPointCount={borderState.splitLine.length}
                  />
                </div>
              )}

              {/* Paint mode legend */}
              {editor.mode === "paint" && (
                <div className="border-border bg-card/90 absolute bottom-8 left-3 z-20 rounded-lg border px-3 py-2 shadow-md backdrop-blur-sm">
                  <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                    {paintMapMode === "wiki"
                      ? "Wiki Coverage"
                      : paintMapMode.charAt(0).toUpperCase() + paintMapMode.slice(1)}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[9px]">Low</span>
                    <div
                      className="h-2.5 w-24 rounded-sm"
                      style={{
                        background:
                          paintMapMode === "wiki"
                            ? "linear-gradient(to right, hsl(0,70%,50%), hsl(60,70%,50%), hsl(120,70%,50%))"
                            : "linear-gradient(to right, hsl(60,80%,50%), hsl(30,80%,45%), hsl(0,80%,40%))",
                      }}
                    />
                    <span className="text-muted-foreground text-[9px]">High</span>
                  </div>
                </div>
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
                />
              )}
            </EditorErrorBoundary>
          </div>

          {/* Bottom panel slot */}
          {(!toolsDisabled || isWorldMode) && (
            <div
              ref={bottomDockRef}
              className="bg-card/40 hidden w-full shrink-0 flex-row backdrop-blur-md sm:flex"
            >
              {panelConfigs.panelA.placement === "bottom" &&
                panelConfigs.panelB.placement !== "bottom" && (
                  <EditorErrorBoundary name="BottomPanel-A">
                    {renderPanel("panelA")}
                  </EditorErrorBoundary>
                )}
              {panelConfigs.panelB.placement === "bottom" &&
                panelConfigs.panelA.placement !== "bottom" && (
                  <EditorErrorBoundary name="BottomPanel-B">
                    {renderPanel("panelB")}
                  </EditorErrorBoundary>
                )}
              {panelConfigs.panelA.placement === "bottom" &&
                panelConfigs.panelB.placement === "bottom" &&
                (() => {
                  const collapsedA = panelConfigs.panelA.collapsed;
                  const collapsedB = panelConfigs.panelB.collapsed;

                  if (collapsedA && collapsedB) {
                    return (
                      <div className="bg-card/75 border-border flex w-full shrink-0 flex-row gap-2 border-t px-2 py-1 backdrop-blur-md">
                        <EditorErrorBoundary name="BottomPanel-A">
                          {renderPanel("panelA")}
                        </EditorErrorBoundary>
                        <EditorErrorBoundary name="BottomPanel-B">
                          {renderPanel("panelB")}
                        </EditorErrorBoundary>
                      </div>
                    );
                  }

                  if (collapsedA) {
                    return (
                      <div className="flex w-full shrink-0 flex-row items-center">
                        <div className="mr-2 shrink-0">
                          <EditorErrorBoundary name="BottomPanel-A">
                            {renderPanel("panelA")}
                          </EditorErrorBoundary>
                        </div>
                        <div className="h-full min-w-0 flex-1">
                          <EditorErrorBoundary name="BottomPanel-B">
                            {renderPanel("panelB")}
                          </EditorErrorBoundary>
                        </div>
                      </div>
                    );
                  }

                  if (collapsedB) {
                    return (
                      <div className="flex w-full shrink-0 flex-row items-center">
                        <div className="h-full min-w-0 flex-1">
                          <EditorErrorBoundary name="BottomPanel-A">
                            {renderPanel("panelA")}
                          </EditorErrorBoundary>
                        </div>
                        <div className="ml-2 shrink-0">
                          <EditorErrorBoundary name="BottomPanel-B">
                            {renderPanel("panelB")}
                          </EditorErrorBoundary>
                        </div>
                      </div>
                    );
                  }

                  // Both are expanded: horizontal resizable split
                  return (
                    <div className="flex w-full shrink-0 flex-row">
                      <div
                        style={{ width: `calc(${bottomSplitRatio * 100}% - 2px)` }}
                        className="h-full min-w-0 shrink-0"
                      >
                        <EditorErrorBoundary name="BottomPanel-A">
                          {renderPanel("panelA")}
                        </EditorErrorBoundary>
                      </div>
                      <div
                        className="h-full w-1 shrink-0 cursor-col-resize bg-neutral-200 transition-colors hover:bg-blue-500/50 dark:bg-neutral-800 dark:hover:bg-blue-500/50"
                        onMouseDown={handleHorizontalSplitResize}
                      />
                      <div className="h-full min-w-0 flex-1">
                        <EditorErrorBoundary name="BottomPanel-B">
                          {renderPanel("panelB")}
                        </EditorErrorBoundary>
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}
        </div>

        {/* Right panel slot */}
        {(!toolsDisabled || isWorldMode) && (
          <div ref={rightSidebarRef} className="hidden h-full shrink-0 sm:flex">
            {panelConfigs.panelA.placement === "right" &&
              panelConfigs.panelB.placement !== "right" && (
                <EditorErrorBoundary name="LeftPanel-A">
                  {renderPanel("panelA")}
                </EditorErrorBoundary>
              )}
            {panelConfigs.panelB.placement === "right" &&
              panelConfigs.panelA.placement !== "right" && (
                <EditorErrorBoundary name="RightPanel-B">
                  {renderPanel("panelB")}
                </EditorErrorBoundary>
              )}
            {panelConfigs.panelA.placement === "right" &&
              panelConfigs.panelB.placement === "right" &&
              (() => {
                const collapsedA = panelConfigs.panelA.collapsed;
                const collapsedB = panelConfigs.panelB.collapsed;

                if (collapsedA && collapsedB) {
                  return (
                    <div className="bg-card/75 border-border flex h-full shrink-0 flex-col border-l backdrop-blur-md">
                      <EditorErrorBoundary name="LeftPanel-A">
                        {renderPanel("panelA")}
                      </EditorErrorBoundary>
                      <EditorErrorBoundary name="RightPanel-B">
                        {renderPanel("panelB")}
                      </EditorErrorBoundary>
                    </div>
                  );
                }

                if (collapsedA) {
                  return (
                    <div className="flex h-full shrink-0 flex-col">
                      <EditorErrorBoundary name="LeftPanel-A">
                        {renderPanel("panelA")}
                      </EditorErrorBoundary>
                      <div className="min-h-0 w-full flex-1">
                        <EditorErrorBoundary name="RightPanel-B">
                          {renderPanel("panelB")}
                        </EditorErrorBoundary>
                      </div>
                    </div>
                  );
                }

                if (collapsedB) {
                  return (
                    <div className="flex h-full shrink-0 flex-col">
                      <div className="min-h-0 w-full flex-1">
                        <EditorErrorBoundary name="LeftPanel-A">
                          {renderPanel("panelA")}
                        </EditorErrorBoundary>
                      </div>
                      <EditorErrorBoundary name="RightPanel-B">
                        {renderPanel("panelB")}
                      </EditorErrorBoundary>
                    </div>
                  );
                }

                // Both are expanded: vertical resizable split
                return (
                  <div className="flex h-full shrink-0 flex-col">
                    <div
                      style={{ height: `calc(${rightSplitRatio * 100}% - 2px)` }}
                      className="min-h-0 w-full shrink-0"
                    >
                      <EditorErrorBoundary name="LeftPanel-A">
                        {renderPanel("panelA")}
                      </EditorErrorBoundary>
                    </div>
                    <div
                      className="h-1 w-full shrink-0 cursor-row-resize bg-neutral-200 transition-colors hover:bg-blue-500/50 dark:bg-neutral-800 dark:hover:bg-blue-500/50"
                      onMouseDown={handleVerticalSplitResize("right")}
                    />
                    <div className="min-h-0 w-full flex-1">
                      <EditorErrorBoundary name="RightPanel-B">
                        {renderPanel("panelB")}
                      </EditorErrorBoundary>
                    </div>
                  </div>
                );
              })()}
          </div>
        )}
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

      {/* Mobile sheets */}
      {editor.mode !== "view" && editor.mode !== "import-provinces" && (
        <div className="sm:hidden">
          <MobileEditorSheet
            onClose={() => editor.resetForm()}
            title="Properties"
            isEditMode={
              editor.mode.startsWith("add-") ||
              editor.mode.startsWith("edit-") ||
              editor.mode === "paint"
            }
            featureListContent={
              <FeatureList
                features={editor.allFeatures}
                selectedFeature={editor.selectedFeature}
                onSelectFeature={handleSelectFeature}
                onEditFeature={handleEditFeature}
                onDeleteFeature={handleDeleteFeature}
                isLoading={editor.featuresLoading}
              />
            }
          >
            {renderRightPanelContent()}
          </MobileEditorSheet>
        </div>
      )}

      {/* Batch Actions Bar */}
      {editor.selectedIds.size > 1 && (
        <BatchActionsBar
          selectedCount={editor.selectedIds.size}
          subdivisionCount={
            editor.allFeatures.filter(
              (f) => editor.selectedIds.has(f.id) && f.type === "subdivision"
            ).length
          }
          onBatchDelete={async () => {
            if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
            await editor.bulkDeleteSelected();
          }}
          onDeselectAll={editor.clearMultiSelect}
          onBulkEdit={async (field, value) => {
            const result = await editor.bulkEditSelected(field, value);
            if (result.failCount > 0) {
              alert(
                `Bulk edit: ${result.successCount} updated, ${result.failCount} failed. Check console for details.`
              );
            }
            return result;
          }}
          isMutating={editor.isMutating}
        />
      )}

      {/* Context Menu */}
      <EditorContextMenuWrapper
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        editor={editor}
      />

      {/* Keyboard Shortcut Sheet */}
      {showShortcuts && <KeyboardShortcutSheet onClose={() => setShowShortcuts(false)} />}

      {/* Province Import Wizard Dialog */}
      {editor.mode === "import-provinces" && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              importer.reset();
              editor.setMode("view");
            }
          }}
        >
          <DialogContent className="bg-card border-border flex h-[580px] max-h-[85vh] max-w-2xl flex-col overflow-hidden rounded-xl border p-0 shadow-2xl">
            <ProvinceImportWizard
              importer={importer}
              onComplete={() => {
                editor.setMode("view");
                editor.refetchFeatures();
              }}
              onCancel={() => {
                importer.reset();
                editor.setMode("view");
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Editor Dialogs */}
      <EditorDialogs {...state} onExit={onExit} />

      {/* Onboarding Welcome Modal */}
      <MapEditorWelcomeModal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />
    </div>
  );
}
