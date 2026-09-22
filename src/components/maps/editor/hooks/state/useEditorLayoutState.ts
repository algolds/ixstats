"use client";

import { useState, useEffect, useCallback } from "react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type { TabId } from "~/components/maps/editor/EditorPanel";
import type { PanelPlacement, PanelConfig } from "~/components/maps/editor/types/editor-state";

interface UseEditorLayoutStateProps {
  isWorldMode: boolean;
  activeEditorMode: "view" | "border_edit";
  editorMode: string;
  mapSelectedCountry: SelectedCountry | null;
}

export function useEditorLayoutState({
  isWorldMode,
  activeEditorMode,
  editorMode,
  mapSelectedCountry,
}: UseEditorLayoutStateProps) {
  const [panelConfigs, setPanelConfigs] = useState<{
    panelA: PanelConfig;
    panelB: PanelConfig;
  }>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ixworld-editor-panels-config-v4");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.panelA && parsed.panelB) {
            return parsed;
          }
        } catch (_) {}
      }
    }
    return {
      panelA: {
        placement: "left",
        tabs: isWorldMode ? ["linkages", "sovereignty", "layers"] : ["layers"],
        collapsed: false,
      },
      panelB: {
        placement: "right",
        tabs: ["properties", "history"],
        collapsed: false,
      },
    };
  });

  // Save config to local storage on change
  useEffect(() => {
    localStorage.setItem("ixworld-editor-panels-config-v4", JSON.stringify(panelConfigs));
  }, [panelConfigs]);

  // Sync tab requirements on mode shift
  useEffect(() => {
    setPanelConfigs((prev) => {
      let changed = false;
      const next = {
        panelA: { ...prev.panelA, tabs: [...prev.panelA.tabs] },
        panelB: { ...prev.panelB, tabs: [...prev.panelB.tabs] },
      };

      if (isWorldMode) {
        const oldLenA = next.panelA.tabs.length;
        const oldLenB = next.panelB.tabs.length;
        next.panelA.tabs = next.panelA.tabs.filter((t) => t !== "features");
        next.panelB.tabs = next.panelB.tabs.filter((t) => t !== "features");
        if (next.panelA.tabs.length !== oldLenA || next.panelB.tabs.length !== oldLenB) {
          changed = true;
        }

        if (!next.panelA.tabs.includes("layers") && !next.panelB.tabs.includes("layers")) {
          next.panelA.tabs.push("layers");
          changed = true;
        }
        if (!next.panelA.tabs.includes("linkages") && !next.panelB.tabs.includes("linkages")) {
          next.panelA.tabs.push("linkages");
          changed = true;
        }
        if (
          !next.panelA.tabs.includes("sovereignty") &&
          !next.panelB.tabs.includes("sovereignty")
        ) {
          next.panelA.tabs.push("sovereignty");
          changed = true;
        }
      } else {
        const oldLenA = next.panelA.tabs.length;
        const oldLenB = next.panelB.tabs.length;
        next.panelA.tabs = next.panelA.tabs.filter(
          (t) => t !== "linkages" && t !== "sovereignty" && t !== "features"
        );
        next.panelB.tabs = next.panelB.tabs.filter(
          (t) => t !== "linkages" && t !== "sovereignty" && t !== "features"
        );
        if (next.panelA.tabs.length !== oldLenA || next.panelB.tabs.length !== oldLenB) {
          changed = true;
        }
        if (!next.panelA.tabs.includes("layers") && !next.panelB.tabs.includes("layers")) {
          next.panelA.tabs.push("layers");
          changed = true;
        }
      }

      if (!next.panelA.tabs.includes("properties") && !next.panelB.tabs.includes("properties")) {
        next.panelB.tabs.push("properties");
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [isWorldMode]);

  const handleMoveTab = useCallback((tabId: TabId | string, targetPanelId: "panelA" | "panelB") => {
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

  const handleChangePanelPlacement = useCallback(
    (panelId: "panelA" | "panelB", placement: PanelPlacement) => {
      setPanelConfigs((prev) => ({
        ...prev,
        [panelId]: {
          ...prev[panelId],
          placement,
        },
      }));
    },
    []
  );

  const expandPropertiesPanel = useCallback(() => {
    setPanelConfigs((prev) => {
      let changed = false;
      const next = { ...prev };
      if (prev.panelA.tabs.includes("properties") && prev.panelA.collapsed) {
        next.panelA = { ...prev.panelA, collapsed: false };
        changed = true;
      }
      if (prev.panelB.tabs.includes("properties") && prev.panelB.collapsed) {
        next.panelB = { ...prev.panelB, collapsed: false };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  // Auto-expand/collapse whichever panel contains "properties" tab when mode changes
  useEffect(() => {
    const shouldExpand = isWorldMode
      ? activeEditorMode !== "view" || !!mapSelectedCountry
      : editorMode !== "view" && editorMode !== "import-provinces";

    if (shouldExpand) {
      setPanelConfigs((prev) => {
        let changed = false;
        const next = { ...prev };
        if (prev.panelA.tabs.includes("properties") && prev.panelA.collapsed) {
          next.panelA = { ...prev.panelA, collapsed: false };
          changed = true;
        }
        if (prev.panelB.tabs.includes("properties") && prev.panelB.collapsed) {
          next.panelB = { ...prev.panelB, collapsed: false };
          changed = true;
        }
        return changed ? next : prev;
      });
    }
  }, [editorMode, activeEditorMode, mapSelectedCountry, isWorldMode]);

  const [panelsLocked, setPanelsLockedState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ixworld-editor-panels-locked");
      return stored === "true";
    }
    return false;
  });

  const setPanelsLocked = useCallback((v: boolean) => {
    setPanelsLockedState(v);
    localStorage.setItem("ixworld-editor-panels-locked", String(v));
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
