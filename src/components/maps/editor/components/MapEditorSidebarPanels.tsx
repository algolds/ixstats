"use client";

import React, { memo, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { LayerPanel } from "~/components/maps/editor/LayerPanel";
import {
  useRealmMapDisplay,
  useRealmRelief,
} from "~/components/maps/core/hooks/useRealmMapDisplay";
import { buildLayers, isMapSwitchedLayer } from "~/components/maps/editor/utils/layer-rows";
import { RELIEF_LAYER_ID } from "~/lib/maps/raster-tiles";
import { sidebarTabsFor, worldTabAvailable } from "~/components/maps/editor/utils/world-tab";
import { LinkageValidationPanel } from "./LinkageValidationPanel";
import { SovereigntyPanel } from "./SovereigntyPanel";
import { PropertiesPanelContent } from "./PropertiesPanelContent";
import { HistoryPanel } from "./HistoryPanel";
import { EditQueuePanel } from "../panels/EditQueuePanel";
import { WikiScannerPanel } from "../panels/WikiScannerPanel";
import { StorylinesPanel } from "../panels/StorylinesPanel";
import { WorldPanel } from "../panels/WorldPanel";
import type { TabId } from "~/components/maps/editor/EditorPanel";
import type { useMapEditorOverlayState } from "../hooks/useMapEditorOverlayState";
import type { LayerStateRecord } from "../types/editor-state";
import { useFeatureActionHandlers } from "./useFeatureActionHandlers";
export type MapEditorOverlayReturnState = ReturnType<typeof useMapEditorOverlayState>;

interface MapEditorSidebarPanelsProps {
  panelId: "panelA" | "panelB";
  state: MapEditorOverlayReturnState;
  brushTargetId: string | null;
  setBrushTargetId: (id: string | null) => void;
  /** The world map the World tab draws its preview on */
  worldMap: MapLibreMap | null;
}

export const MapEditorSidebarPanels = memo(function MapEditorSidebarPanels({
  panelId,
  state,
  brushTargetId,
  setBrushTargetId,
  worldMap,
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
    isSandbox,
  } = state;
  const display = useRealmMapDisplay();
  const relief = useRealmRelief(display);

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
  // The World tab: the realm's map editors, never Ixnay (the sandbox excepted, which shows that tab alone).
  // Saved layouts always carry it, so it is filtered here and never stored.
  const worldTab = {
    isWorldMode,
    canEdit: isAdmin || !!display?.canEdit,
    isIxnay: display?.isIxnay ?? true,
    sandbox: isSandbox,
  };
  tabs = sidebarTabsFor(panelId, tabs, worldTab);

  const [panelBActiveTab, setPanelBActiveTab] = useState<TabId>(() =>
    tabs.includes("properties") ? "properties" : (tabs[0] ?? "properties")
  );

  // A requested tab this panel does not show (`?editor=world` where the World tab is not offered) falls back to its first
  const requestedTab = panelId === "panelA" ? activeSidebarTab : panelBActiveTab;
  const effectiveActiveTab: TabId = tabs.includes(requestedTab)
    ? requestedTab
    : (tabs[0] ?? requestedTab);

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
      layers={buildLayers(layerStates, editorVisibleLayers, relief)}
      onToggleVisibility={(id) => {
        if (id === "climate") toggleEditorLayer("climate");
        else if (id === RELIEF_LAYER_ID) relief.toggle();
        else updateLayer(id, (layer) => ({ visible: !(layer?.visible ?? true) }));
      }}
      onToggleLock={(id) => {
        if (!isMapSwitchedLayer(id)) {
          updateLayer(id, (layer) => ({ locked: !(layer?.locked ?? false) }));
        }
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

  if (isSandbox && tabs.length === 0) return null;

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
            selectedIds={editor.selectedIds}
            onToggleSelect={editor.toggleSelectId}
          />
        ) : undefined
      }
      layersContent={effectiveActiveTab === "layers" ? renderLayersElement() : undefined}
      worldContent={
        effectiveActiveTab === "world" && worldTabAvailable(worldTab) ? (
          <WorldPanel map={worldMap} sandbox={isSandbox} />
        ) : undefined
      }
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
      storiesContent={
        effectiveActiveTab === "stories" && state.activeCountryId ? (
          <StorylinesPanel
            countryId={state.activeCountryId}
            features={editor.allFeatures}
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
