"use client";

import React, { memo, useCallback, useState } from "react";
import {
  Globe,
  Hexagon,
  MapPin,
  Bank as Landmark,
  Bookmark as BookMarked,
  Type as TypeIcon,
  PathArrow as Route,
  CloudSunny as CloudSun,
} from "iconoir-react";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { LayerPanel } from "~/components/maps/editor/LayerPanel";
import { LinkageValidationPanel } from "./LinkageValidationPanel";
import { SovereigntyPanel } from "./SovereigntyPanel";
import { PropertiesPanelContent } from "./PropertiesPanelContent";
import { HistoryPanel } from "./HistoryPanel";
import { EditQueuePanel } from "../panels/EditQueuePanel";
import type { TabId } from "~/components/maps/editor/EditorPanel";
import type { useMapEditorOverlayState } from "../hooks/useMapEditorOverlayState";
import type {
  PanelPlacement,
  PanelConfig,
  LayerStateRecord,
  EditorFeature,
} from "../types/editor-state";

export type { PanelPlacement, PanelConfig, LayerStateRecord };

export type MapEditorOverlayReturnState = ReturnType<typeof useMapEditorOverlayState>;

interface MapEditorSidebarPanelsProps {
  panelId: "panelA" | "panelB";
  state: MapEditorOverlayReturnState;
  panelConfigs: {
    panelA: PanelConfig;
    panelB: PanelConfig;
  };
  setPanelConfigs: React.Dispatch<
    React.SetStateAction<{ panelA: PanelConfig; panelB: PanelConfig }>
  >;
  activeSidebarTab: TabId;
  setActiveSidebarTab: (tab: TabId) => void;
  handleMoveTab: (tabId: string, panelId: "panelA" | "panelB") => void;
  handleChangePanelPlacement: (panelId: "panelA" | "panelB", placement: PanelPlacement) => void;
  layerStates: Record<string, LayerStateRecord>;
  setLayerStates: React.Dispatch<React.SetStateAction<Record<string, LayerStateRecord>>>;
  editorVisibleLayers: Set<string>;
  toggleEditorLayer: (layerId: string) => void;
  featureCounts: Record<string, number>;
  brushTargetId: string | null;
  setBrushTargetId: (id: string | null) => void;
}

export const MapEditorSidebarPanels = memo(function MapEditorSidebarPanels({
  panelId,
  state,
  panelConfigs,
  setPanelConfigs,
  activeSidebarTab,
  setActiveSidebarTab,
  handleMoveTab,
  handleChangePanelPlacement,
  layerStates,
  setLayerStates,
  editorVisibleLayers,
  toggleEditorLayer,
  featureCounts,
  brushTargetId,
  setBrushTargetId,
}: MapEditorSidebarPanelsProps) {
  const { editor, isWorldMode, panelsLocked, isAdmin } = state;

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

  const [panelBActiveTab, setPanelBActiveTab] = useState<TabId>(() => {
    return tabs.includes("properties") ? "properties" : (tabs[0] ?? "properties");
  });

  const effectiveActiveTab: TabId = panelId === "panelA" ? activeSidebarTab : panelBActiveTab;

  const handleSelectFeature = useCallback((feat: EditorFeature) => {
    state.handleSelectFeature?.(feat);
  }, [state.handleSelectFeature]);

  const handleEditFeature = useCallback((feat: EditorFeature) => {
    state.handleEditFeature?.(feat);
  }, [state.handleEditFeature]);

  const handleDeleteFeature = useCallback((feat: EditorFeature) => {
    state.handleDeleteFeature?.(feat);
  }, [state.handleDeleteFeature]);

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
            ...prev[id]!,
            visible: !(prev[id]?.visible ?? true),
          },
        }));
      }}
      onToggleLock={(id) => {
        if (id === "climate") return;
        setLayerStates((prev) => ({
          ...prev,
          [id]: {
            ...prev[id]!,
            locked: !(prev[id]?.locked ?? false),
          },
        }));
      }}
      onOpacityChange={(id, val) => {
        setLayerStates((prev) => ({
          ...prev,
          [id]: {
            ...prev[id]!,
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
      guides={editor.guides}
      onClearGuides={() => editor.setGuides([])}
      showGuides={state.showGuides}
      onToggleGuidesVisibility={state.setShowGuides}
      onDeleteGuide={(id: string) =>
        editor.setGuides((prev: { id: string; type: "h" | "v"; value: number }[]) => prev.filter((g) => g.id !== id))
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
      onTabDrop={(tabId) => handleMoveTab(tabId, panelId)}
      placement={config.placement}
      onChangePlacement={(placement) => handleChangePanelPlacement(panelId, placement)}
      isWorldMode={isWorldMode}
      activeTabOverride={effectiveActiveTab}
      onTabChange={(tab) => {
        if (panelId === "panelA") {
          setActiveSidebarTab(tab);
        } else {
          setPanelBActiveTab(tab);
        }
      }}
      linkagesContent={effectiveActiveTab === "linkages" ? <LinkageValidationPanel {...state} /> : undefined}
      sovereigntyContent={effectiveActiveTab === "sovereignty" ? <SovereigntyPanel {...state} /> : undefined}
      historyContent={effectiveActiveTab === "history" ? renderHistoryElement() : undefined}
      queueContent={effectiveActiveTab === "queue" && isWorldMode && isAdmin ? <EditQueuePanel /> : undefined}
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
      propertiesContent={effectiveActiveTab === "properties" ? renderRightPanelContent() : undefined}
      isStacked={isStacked}
      panelsLocked={panelsLocked}
    />
  );
});
