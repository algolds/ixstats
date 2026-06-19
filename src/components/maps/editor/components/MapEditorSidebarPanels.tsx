"use client";

import React from "react";
import {
  Globe,
  Hexagon,
  MapPin,
  Landmark,
  BookMarked,
  Type as TypeIcon,
  Route,
  CloudSun,
} from "lucide-react";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { LayerPanel } from "~/components/maps/editor/LayerPanel";
import { FeatureList } from "~/components/maps/editor/FeatureList";
import { LinkageValidationPanel } from "./LinkageValidationPanel";
import { SovereigntyPanel } from "./SovereigntyPanel";
import { PropertiesPanelContent } from "./PropertiesPanelContent";
import type { TabId } from "~/components/maps/editor/EditorPanel";

interface MapEditorSidebarPanelsProps {
  panelId: "panelA" | "panelB";
  state: any; // The state object returned by useMapEditorOverlayState
  panelConfigs: {
    panelA: { placement: "left" | "right" | "bottom"; collapsed: boolean; tabs: TabId[] };
    panelB: { placement: "left" | "right" | "bottom"; collapsed: boolean; tabs: TabId[] };
  };
  setPanelConfigs: React.Dispatch<React.SetStateAction<any>>;
  activeSidebarTab: TabId;
  setActiveSidebarTab: (tab: any) => void;
  handleMoveTab: (tabId: string, panelId: "panelA" | "panelB") => void;
  handleChangePanelPlacement: (panelId: "panelA" | "panelB", placement: any) => void;
  layerStates: any;
  setLayerStates: React.Dispatch<React.SetStateAction<any>>;
  editorVisibleLayers: Set<string>;
  toggleEditorLayer: (layerId: string) => void;
  featureCounts: any;
  brushTargetId: string | null;
  setBrushTargetId: (id: string | null) => void;
}

export function MapEditorSidebarPanels({
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
  const { editor, isWorldMode, panelsLocked } = state;

  const handleSelectFeature = (feat: any) => {
    state.handleSelectFeature?.(feat);
  };
  const handleEditFeature = (feat: any) => {
    state.handleEditFeature?.(feat);
  };
  const handleDeleteFeature = (feat: any) => {
    state.handleDeleteFeature?.(feat);
  };

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
        setLayerStates((prev: any) => ({
          ...prev,
          [id]: {
            ...prev[id],
            visible: !(prev[id]?.visible ?? true),
          },
        }));
      }}
      onToggleLock={(id) => {
        if (id === "climate") return;
        setLayerStates((prev: any) => ({
          ...prev,
          [id]: {
            ...prev[id],
            locked: !(prev[id]?.locked ?? false),
          },
        }));
      }}
      onOpacityChange={(id, val) => {
        setLayerStates((prev: any) => ({
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

  const config = panelConfigs[panelId];
  const isStacked = panelConfigs.panelA.placement === panelConfigs.panelB.placement;
  // World editor: panelB must always have the properties tab — it is the primary
  // interaction surface for the properties panel content. localStorage may have
  // a stale config from a prior session where all tabs were dragged out.
  const tabs: TabId[] =
    panelId === "panelB" && isWorldMode && !config.tabs.includes("properties")
      ? [...config.tabs, "properties" as TabId]
      : config.tabs;

  return (
    <EditorPanel
      mode={editor.mode}
      collapsed={config.collapsed}
      onToggleCollapse={() =>
        setPanelConfigs((prev: any) => ({
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
}
