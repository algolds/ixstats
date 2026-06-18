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
  FloatingImportPanel,
} from "~/components/maps/editor/province-importer";
import { TransportOverlay } from "~/components/maps/overlays/TransportOverlay";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { KeyboardShortcutSheet } from "~/components/maps/editor/KeyboardShortcutSheet";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";

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
  historicalYear?: number | null;
}

export default function MapEditorOverlay({
  countryId,
  onExit,
  isWorldMode = false,
  historicalYear,
}: MapEditorOverlayProps) {
  const mapRef = useRef<EditorMapRef>(null);

  const [leftSplitRatio, setLeftSplitRatio] = useState(0.5);
  const [rightSplitRatio, setRightSplitRatio] = useState(0.5);
  const [bottomSplitRatio, setBottomSplitRatio] = useState(0.5);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [brushRadius, setBrushRadius] = useState(20);
  const [brushTargetId, setBrushTargetId] = useState<string | null>(null);

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
    showGrid,
    setShowGrid,
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
    handleEditFeature,
    handleDeleteFeature,
    toolsDisabled,
    cursorTerrainInfo,
    featureCounts,
    panelsLocked,
    setPanelsLocked,
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

  const renderRightPanelContent = () => (
    <PropertiesPanelContent
      {...state}
      brushTargetId={brushTargetId}
      setBrushTargetId={setBrushTargetId}
    />
  );

  const renderPanel = (panelId: "panelA" | "panelB") => {
    const config = panelConfigs[panelId];
    const isStacked = panelConfigs.panelA.placement === panelConfigs.panelB.placement;
    // World editor: panelB must always have the properties tab — it is the primary
    // interaction surface for the properties panel content. localStorage may have
    // a stale config from a prior session where all tabs were dragged out.
    const tabs =
      panelId === "panelB" && isWorldMode && !config.tabs.includes("properties")
        ? [...config.tabs, "properties"]
        : config.tabs;
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
        tabs={tabs}
        onTabDrop={(tabId) => handleMoveTab(tabId, panelId)}
        placement={config.placement}
        onChangePlacement={(placement) => handleChangePanelPlacement(panelId, placement)}
        isWorldMode={isWorldMode}
        activeTabOverride={panelId === "panelA" ? activeSidebarTab : undefined}
        onTabChange={(tab) => {
          // panelB is independent — only sync the page-level tab when panelA changes
          if (panelId === "panelA") setActiveSidebarTab(tab as any);
        }}
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
            collapseAll={editor.mode.startsWith("add-") || editor.mode.startsWith("edit-")}
          />
        }
        layersContent={renderLayersElement()}
        propertiesContent={renderRightPanelContent()}
        isStacked={isStacked}
        panelsLocked={panelsLocked}
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
      {(!isWorldMode || editor.mode !== "view") && activeEditorMode !== "border_edit" && (
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
                      onClick={() => void borderActions.repair()}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors"
                      title="Repair geometry spikes"
                    >
                      <Wrench className="h-3.5 w-3.5 text-amber-500" />
                      <span>Repair Spikes</span>
                    </button>
                    <button
                      onClick={() => void borderActions.smooth()}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors"
                      title="Soften corners (Chaikin smoothing)"
                    >
                      <Spline className="h-3.5 w-3.5 text-blue-500" />
                      <span>Smooth Geometry</span>
                    </button>
                    <button
                      onClick={() => void borderActions.naturalize()}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors"
                      title="Subdivide and randomize for organic coastlines"
                    >
                      <Waves className="h-3.5 w-3.5 text-cyan-500" />
                      <span>Naturalize Coastline</span>
                    </button>
                    <button
                      onClick={() => void borderActions.simplify()}
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
                disabled={!borderState.isDirty}
                className="flex h-6 cursor-pointer items-center gap-1 rounded bg-red-500/10 px-2 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-30"
                title="Revert all unsaved changes for this feature"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Revert</span>
              </button>

              {/* Apply & Exit */}
              <button
                onClick={handleBorderToolbarSubmit}
                disabled={!borderState.isDirty}
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

        {/* Left panel slot */}
        {(!toolsDisabled || isWorldMode) && (
          <div
            ref={leftSidebarRef}
            data-testid="editor-panel-A"
            className="hidden h-full shrink-0 sm:flex"
          >
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
                    {!panelsLocked ? (
                      <div
                        className="h-1 w-full shrink-0 cursor-row-resize bg-neutral-200 transition-colors hover:bg-blue-500/50 dark:bg-neutral-800 dark:hover:bg-blue-500/50"
                        onMouseDown={handleVerticalSplitResize("left")}
                      />
                    ) : (
                      <div className="bg-border h-px w-full shrink-0" />
                    )}
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
          <div className="relative min-h-0 min-w-0 flex-1" data-map-container>
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
                  worldMapLayers={worldMapLayers}
                  brushRadius={brushRadius}
                  brushTargetId={brushTargetId}
                  onBrushStroke={borderActions.applyBrushTransfer}
                  traceStart={borderState.traceStart}
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
                  routeWaypoints={editor.routeWaypoints}
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
                />
              )}

              {/* Border Editor Toolbar Overlay removed - integrated in horizontal options bar */}

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
                      {!panelsLocked ? (
                        <div
                          className="h-full w-1 shrink-0 cursor-col-resize bg-neutral-200 transition-colors hover:bg-blue-500/50 dark:bg-neutral-800 dark:hover:bg-blue-500/50"
                          onMouseDown={handleHorizontalSplitResize}
                        />
                      ) : (
                        <div className="bg-border h-full w-px shrink-0" />
                      )}
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
          <div
            ref={rightSidebarRef}
            data-testid="editor-panel-B"
            className="hidden h-full shrink-0 sm:flex"
          >
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
                    {!panelsLocked ? (
                      <div
                        className="h-1 w-full shrink-0 cursor-row-resize bg-neutral-200 transition-colors hover:bg-blue-500/50 dark:bg-neutral-800 dark:hover:bg-blue-500/50"
                        onMouseDown={handleVerticalSplitResize("right")}
                      />
                    ) : (
                      <div className="bg-border h-px w-full shrink-0" />
                    )}
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
            isEditMode={editor.mode.startsWith("add-") || editor.mode.startsWith("edit-")}
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

      {/* Province Import Wizard Floating Panel */}
      {editor.mode === "import-provinces" && (
        <FloatingImportPanel
          onClose={() => {
            importer.reset();
            editor.setMode("view");
          }}
        >
          <ProvinceImportWizard
            importer={importer}
            onComplete={() => {
              editor.setMode("view");
              editor.refetchFeatures();
              importer.reset();
            }}
            onCancel={() => {
              importer.reset();
              editor.setMode("view");
            }}
          />
        </FloatingImportPanel>
      )}

      {/* Editor Dialogs */}
      <EditorDialogs {...state} onExit={onExit} />

      {/* Onboarding Welcome Modal */}
      <MapEditorWelcomeModal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />
    </div>
  );
}
