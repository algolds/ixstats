"use client";

import React, { memo, useState } from "react";
import {
  Globe,
  Hexagon,
  MapPin,
  Bank as Landmark,
  Bookmark as BookMarked,
  Type as TypeIcon,
  PathArrow as Route,
  CloudSunny as CloudSun,
  ModernTv as Mountain,
} from "iconoir-react";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { LayerPanel } from "~/components/maps/editor/LayerPanel";
import { LinkageValidationPanel } from "./LinkageValidationPanel";
import { SovereigntyPanel } from "./SovereigntyPanel";
import { PropertiesPanelContent } from "./PropertiesPanelContent";
import { HistoryPanel } from "./HistoryPanel";
import { EditQueuePanel } from "../panels/EditQueuePanel";
import { WikiScannerPanel } from "../panels/WikiScannerPanel";
import type { TabId } from "~/components/maps/editor/EditorPanel";
import type { useMapEditorOverlayState } from "../hooks/useMapEditorOverlayState";
import type { LayerStateRecord } from "../types/editor-state";
import { useFeatureActionHandlers } from "./useFeatureActionHandlers";
export type MapEditorOverlayReturnState = ReturnType<typeof useMapEditorOverlayState>;

interface LayerDef {
  id: string;
  name: string;
  icon: React.ElementType;
  /** Default opacity; omitted for layers without an opacity control. */
  opacity?: number;
}

const LAYER_DEFS: LayerDef[] = [
  { id: "border", name: "Country Border", icon: Globe },
  { id: "climate", name: "Climate Zones", icon: CloudSun },
  { id: "regions", name: "Regions", icon: Hexagon, opacity: 0.6 },
  { id: "cities", name: "Cities", icon: MapPin, opacity: 1 },
  { id: "pois", name: "POIs", icon: Landmark, opacity: 1 },
  { id: "stories", name: "Story Pins", icon: BookMarked, opacity: 1 },
  { id: "labels", name: "Labels", icon: TypeIcon, opacity: 1 },
  { id: "routes", name: "Routes", icon: Route },
  { id: "geography", name: "Peaks, Rivers & Lakes", icon: Mountain, opacity: 1 },
];

/** The Climate layer is toggled through the map's visible-layer set and is never lockable. */
function buildLayers(
  layerStates: Record<string, LayerStateRecord>,
  editorVisibleLayers: Set<string>
) {
  return LAYER_DEFS.map(({ id, name, icon, opacity }) => {
    if (id === "climate") {
      return { id, name, icon, visible: editorVisibleLayers.has(id), locked: true };
    }
    const layer = layerStates[id];
    return {
      id,
      name,
      icon,
      visible: layer?.visible ?? true,
      locked: id === "border" ? false : (layer?.locked ?? false),
      ...(opacity !== undefined && { opacity: layer?.opacity ?? opacity }),
    };
  });
}

interface MapEditorSidebarPanelsProps {
  panelId: "panelA" | "panelB";
  state: MapEditorOverlayReturnState;
  brushTargetId: string | null;
  setBrushTargetId: (id: string | null) => void;
}

export const MapEditorSidebarPanels = memo(function MapEditorSidebarPanels({
  panelId,
  state,
  brushTargetId,
  setBrushTargetId,
}: MapEditorSidebarPanelsProps) {
  const {
    editor,
    isWorldMode,
    panelsLocked,
    isAdmin,
    panelConfigs,
    setPanelConfigs,
    activeSidebarTab,
    setActiveSidebarTab,
    layerStates,
    setLayerStates,
    editorVisibleLayers,
    toggleEditorLayer,
    featureCounts,
  } = state;

  const config = panelConfigs[panelId];
  const isStacked = panelConfigs.panelA.placement === panelConfigs.panelB.placement;
  // World editor: panelB must always have the properties tab — it is the primary
  // interaction surface for the properties panel content. localStorage may have
  // a stale config from a prior session where all tabs were dragged out.
  let tabs: TabId[] =
    panelId === "panelB" && isWorldMode && !config.tabs.includes("properties")
      ? [...config.tabs, "properties" as TabId]
      : config.tabs;
  // World editor (admins): surface the map edit-request queue as a panel tab.
  // Injected at render time so a stale localStorage panel config can't hide it.
  if (panelId === "panelA" && isWorldMode && isAdmin && !tabs.includes("queue")) {
    tabs = [...tabs, "queue" as TabId];
  }

  const [panelBActiveTab, setPanelBActiveTab] = useState<TabId>(() =>
    tabs.includes("properties") ? "properties" : (tabs[0] ?? "properties")
  );

  const effectiveActiveTab: TabId = panelId === "panelA" ? activeSidebarTab : panelBActiveTab;

  const {
    onSelectFeature: handleSelectFeature,
    onEditFeature: handleEditFeature,
    onDeleteFeature: handleDeleteFeature,
  } = useFeatureActionHandlers(state);

  const updateLayer = (
    id: string,
    patch: (layer: LayerStateRecord | undefined) => Partial<LayerStateRecord>
  ) => setLayerStates((prev) => ({ ...prev, [id]: { ...prev[id]!, ...patch(prev[id]) } }));

  const renderLayersElement = () => (
    <LayerPanel
      layers={buildLayers(layerStates, editorVisibleLayers)}
      onToggleVisibility={(id) => {
        if (id === "climate") toggleEditorLayer("climate");
        else updateLayer(id, (layer) => ({ visible: !(layer?.visible ?? true) }));
      }}
      onToggleLock={(id) => {
        if (id !== "climate") updateLayer(id, (layer) => ({ locked: !(layer?.locked ?? false) }));
      }}
      onOpacityChange={(id, opacity) => updateLayer(id, () => ({ opacity }))}
      featureCounts={featureCounts}
      features={editor.allFeatures}
      selectedFeature={editor.selectedFeature}
      onSelectFeature={handleSelectFeature}
      onEditFeature={handleEditFeature}
      onDeleteFeature={handleDeleteFeature}
      selectedIds={editor.selectedIds}
      onToggleSelect={editor.toggleSelectId}
      onSelectIds={(ids) => editor.setSelectedIds(new Set(ids))}
      guides={editor.guides}
      onClearGuides={() => editor.setGuides([])}
      showGuides={state.showGuides}
      onToggleGuidesVisibility={state.setShowGuides}
      onDeleteGuide={(id: string) =>
        editor.setGuides((prev: { id: string; type: "h" | "v"; value: number }[]) =>
          prev.filter((g) => g.id !== id)
        )
      }
    />
  );

  const renderRightPanelContent = () => (
    <PropertiesPanelContent
      {...state}
      featureDetails={state.featureDetails ?? null}
      brushTargetId={brushTargetId}
      setBrushTargetId={setBrushTargetId}
    />
  );

  const renderHistoryElement = () => (
    <HistoryPanel
      history={editor.history}
      jumpToHistoryPosition={editor.jumpToHistoryPosition}
      isMutating={editor.isMutating}
    />
  );

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
      onTabDrop={(tabId) => state.handleMoveTab(tabId, panelId)}
      placement={config.placement}
      onChangePlacement={(placement) => state.handleChangePanelPlacement(panelId, placement)}
      isWorldMode={isWorldMode}
      activeTabOverride={effectiveActiveTab}
      onTabChange={(tab) => {
        if (panelId === "panelA") {
          setActiveSidebarTab(tab);
        } else {
          setPanelBActiveTab(tab);
        }
      }}
      linkagesContent={
        effectiveActiveTab === "linkages" ? <LinkageValidationPanel {...state} /> : undefined
      }
      sovereigntyContent={
        effectiveActiveTab === "sovereignty" ? <SovereigntyPanel {...state} /> : undefined
      }
      historyContent={effectiveActiveTab === "history" ? renderHistoryElement() : undefined}
      queueContent={
        effectiveActiveTab === "queue" && isWorldMode && isAdmin ? <EditQueuePanel /> : undefined
      }
      featureCount={editor.allFeatures.length}
      featuresLoading={editor.featuresLoading}
      featureListContent={
        effectiveActiveTab === "features" ? (
          <LayerPanel
            minimal
            features={editor.allFeatures}
            selectedFeature={editor.selectedFeature}
            onSelectFeature={handleSelectFeature}
            onEditFeature={handleEditFeature}
            onDeleteFeature={handleDeleteFeature}
            isLoading={editor.featuresLoading}
            selectedIds={editor.selectedIds}
            onToggleSelect={editor.toggleSelectId}
          />
        ) : undefined
      }
      layersContent={effectiveActiveTab === "layers" ? renderLayersElement() : undefined}
      wikiContent={
        effectiveActiveTab === "wiki" ? (
          <WikiScannerPanel
            scanner={state.wikiScanner}
            onFocusFeature={(id) => {
              const feat = editor.allFeatures.find((f) => f.id === id);
              if (feat) state.handleSelectFeature?.(feat);
            }}
          />
        ) : undefined
      }
      propertiesContent={
        effectiveActiveTab === "properties" ? renderRightPanelContent() : undefined
      }
      isStacked={isStacked}
      panelsLocked={panelsLocked}
    />
  );
});
