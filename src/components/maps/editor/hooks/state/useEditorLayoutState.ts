"use client";

import { useState, useEffect, useCallback } from "react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type { TabId } from "~/components/maps/editor/EditorPanel";
import type { PanelPlacement, PanelConfig } from "~/components/maps/editor/types/editor-state";

type PanelId = "panelA" | "panelB";
type PanelConfigs = Record<PanelId, PanelConfig>;

const PANELS_CONFIG_KEY = "ixworld-editor-panels-config-v4";
const PANELS_LOCKED_KEY = "ixworld-editor-panels-locked";

interface UseEditorLayoutStateProps {
  isWorldMode: boolean;
  activeEditorMode: "view" | "border_edit";
  editorMode: string;
  mapSelectedCountry: SelectedCountry | null;
}

function defaultPanelConfigs(isWorldMode: boolean): PanelConfigs {
  return {
    panelA: {
      placement: "left",
      tabs: isWorldMode ? ["linkages", "sovereignty", "layers"] : ["layers", "wiki", "stories"],
      collapsed: false,
    },
    panelB: { placement: "right", tabs: ["properties", "history"], collapsed: false },
  };
}

function loadPanelConfigs(isWorldMode: boolean): PanelConfigs {
  if (typeof window === "undefined") return defaultPanelConfigs(isWorldMode);
  try {
    const parsed = JSON.parse(localStorage.getItem(PANELS_CONFIG_KEY) ?? "null");
    if (parsed?.panelA && parsed?.panelB) return parsed;
  } catch {
    // corrupt stored layout: defaults apply
  }
  return defaultPanelConfigs(isWorldMode);
}

/** Drops tabs the current mode doesn't use and adds the ones it requires (saved layouts predate some). */
function syncRequiredTabs(prev: PanelConfigs, isWorldMode: boolean): PanelConfigs {
  const removed = new Set<TabId>(
    isWorldMode ? ["features", "stories"] : ["features", "linkages", "sovereignty"]
  );
  const next: PanelConfigs = {
    panelA: { ...prev.panelA, tabs: prev.panelA.tabs.filter((t) => !removed.has(t)) },
    panelB: { ...prev.panelB, tabs: prev.panelB.tabs.filter((t) => !removed.has(t)) },
  };
  let changed =
    next.panelA.tabs.length !== prev.panelA.tabs.length ||
    next.panelB.tabs.length !== prev.panelB.tabs.length;

  const ensureTab = (tab: TabId, panel: PanelId) => {
    if (next.panelA.tabs.includes(tab) || next.panelB.tabs.includes(tab)) return;
    next[panel].tabs.push(tab);
    changed = true;
  };
  const required: TabId[] = isWorldMode
    ? ["layers", "linkages", "sovereignty"]
    : ["layers", "wiki", "stories"];
  for (const tab of required) ensureTab(tab, "panelA");
  ensureTab("properties", "panelB");

  return changed ? next : prev;
}

/** Expands whichever panel holds the "properties" tab. */
function expandPropertiesPanels(prev: PanelConfigs): PanelConfigs {
  const needsExpand = (id: PanelId) => prev[id].tabs.includes("properties") && prev[id].collapsed;
  if (!needsExpand("panelA") && !needsExpand("panelB")) return prev;
  return {
    panelA: needsExpand("panelA") ? { ...prev.panelA, collapsed: false } : prev.panelA,
    panelB: needsExpand("panelB") ? { ...prev.panelB, collapsed: false } : prev.panelB,
  };
}

export function useEditorLayoutState({
  isWorldMode,
  activeEditorMode,
  editorMode,
  mapSelectedCountry,
}: UseEditorLayoutStateProps) {
  const [panelConfigs, setPanelConfigs] = useState<PanelConfigs>(() =>
    loadPanelConfigs(isWorldMode)
  );

  useEffect(() => {
    localStorage.setItem(PANELS_CONFIG_KEY, JSON.stringify(panelConfigs));
  }, [panelConfigs]);

  useEffect(() => {
    setPanelConfigs((prev) => syncRequiredTabs(prev, isWorldMode));
  }, [isWorldMode]);

  const handleMoveTab = useCallback((tabId: TabId | string, targetPanelId: PanelId) => {
    const validTab = tabId as TabId;
    setPanelConfigs((prev) => {
      const sourcePanelId = targetPanelId === "panelA" ? "panelB" : "panelA";
      if (prev[targetPanelId].tabs.includes(validTab)) return prev;
      return {
        ...prev,
        [sourcePanelId]: {
          ...prev[sourcePanelId],
          tabs: prev[sourcePanelId].tabs.filter((t) => t !== validTab),
        },
        [targetPanelId]: {
          ...prev[targetPanelId],
          tabs: [...prev[targetPanelId].tabs, validTab],
          collapsed: false,
        },
      };
    });
  }, []);

  const handleChangePanelPlacement = useCallback((panelId: PanelId, placement: PanelPlacement) => {
    setPanelConfigs((prev) => ({ ...prev, [panelId]: { ...prev[panelId], placement } }));
  }, []);

  const expandPropertiesPanel = useCallback(() => {
    setPanelConfigs(expandPropertiesPanels);
  }, []);

  // Auto-expand the properties panel when a feature/tool needs it
  useEffect(() => {
    const shouldExpand = isWorldMode
      ? activeEditorMode !== "view" || !!mapSelectedCountry
      : editorMode !== "view" && editorMode !== "import-provinces";
    if (shouldExpand) setPanelConfigs(expandPropertiesPanels);
  }, [editorMode, activeEditorMode, mapSelectedCountry, isWorldMode]);

  const [panelsLocked, setPanelsLockedState] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem(PANELS_LOCKED_KEY) === "true"
  );

  const setPanelsLocked = useCallback((v: boolean) => {
    setPanelsLockedState(v);
    localStorage.setItem(PANELS_LOCKED_KEY, String(v));
  }, []);

  return {
    panelConfigs,
    setPanelConfigs,
    handleMoveTab,
    handleChangePanelPlacement,
    expandPropertiesPanel,
    panelsLocked,
    setPanelsLocked,
  };
}
