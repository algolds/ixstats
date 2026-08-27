"use client";

import { useState, useCallback } from "react";
import type { TabId } from "~/components/maps/editor/EditorPanel";

export type PanelPlacement = "left" | "right" | "bottom";

export interface PanelConfig {
  placement: PanelPlacement;
  collapsed: boolean;
  tabs: TabId[];
}

export function useEditorDockLayout(isWorldMode: boolean = false) {
  const [activeSidebarTab, setActiveSidebarTab] = useState<TabId>(
    isWorldMode ? "linkages" : "layers"
  );

  const [panelConfigs, setPanelConfigs] = useState<{
    panelA: PanelConfig;
    panelB: PanelConfig;
  }>({
    panelA: {
      placement: "left",
      collapsed: false,
      tabs: isWorldMode ? ["linkages", "sovereignty", "layers", "history"] : ["layers", "history"],
    },
    panelB: {
      placement: "right",
      collapsed: false,
      tabs: ["properties"],
    },
  });

  const handleMoveTab = useCallback((tabId: string, targetPanel: "panelA" | "panelB") => {
    const sourcePanel = targetPanel === "panelA" ? "panelB" : "panelA";
    setPanelConfigs((prev) => {
      const sourceTabs = prev[sourcePanel].tabs.filter((t) => t !== tabId);
      const targetTabs = prev[targetPanel].tabs.includes(tabId as TabId)
        ? prev[targetPanel].tabs
        : [...prev[targetPanel].tabs, tabId as TabId];

      return {
        ...prev,
        [sourcePanel]: { ...prev[sourcePanel], tabs: sourceTabs },
        [targetPanel]: { ...prev[targetPanel], tabs: targetTabs },
      };
    });
  }, []);

  const handleChangePanelPlacement = useCallback(
    (panelId: "panelA" | "panelB", placement: PanelPlacement) => {
      setPanelConfigs((prev) => ({
        ...prev,
        [panelId]: { ...prev[panelId], placement },
      }));
    },
    []
  );

  return {
    activeSidebarTab,
    setActiveSidebarTab,
    panelConfigs,
    setPanelConfigs,
    handleMoveTab,
    handleChangePanelPlacement,
  };
}
