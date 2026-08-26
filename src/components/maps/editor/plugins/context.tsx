"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapEditorContextType } from "./types";
import { getPlugins } from "./registry";

const MapEditorContext = createContext<MapEditorContextType | null>(null);

interface MapEditorPluginProviderProps {
  children: React.ReactNode;
  state: any; // Overlay state
}

export function MapEditorPluginProvider({ children, state }: MapEditorPluginProviderProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [pluginStates, setPluginStates] = useState<Record<string, any>>({});

  const setPluginState = useCallback((pluginId: string, newState: any) => {
    setPluginStates((prev) => ({
      ...prev,
      [pluginId]: typeof newState === "function" ? newState(prev[pluginId]) : newState,
    }));
  }, []);

  const onModeChange = useCallback(
    (newMode: string) => {
      state.editor?.setMode?.(newMode);
    },
    [state.editor]
  );

  const contextValue = useMemo<MapEditorContextType>(
    () => ({
      state,
      map,
      setMap,
      pluginStates,
      setPluginState,
      onModeChange,
    }),
    [state, map, pluginStates, setPluginState, onModeChange]
  );

  // Centralized keyboard event routing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keybindings if the user is typing in form controls
      const activeEl = document.activeElement;
      const inInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.getAttribute("contenteditable") === "true");
      if (inInput) return;

      const activeMode = state.editor?.mode ?? "view";
      const plugins = getPlugins();

      for (const plugin of plugins) {
        // Run handler if plugin is global or matches current mode
        const isTargetMode = plugin.global || (plugin.modes && plugin.modes.includes(activeMode));
        if (isTargetMode && plugin.onKeyDown) {
          const handled = plugin.onKeyDown(e, contextValue);
          if (handled) {
            e.preventDefault();
            break;
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const inInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.getAttribute("contenteditable") === "true");
      if (inInput) return;

      const activeMode = state.editor?.mode ?? "view";
      const plugins = getPlugins();

      for (const plugin of plugins) {
        const isTargetMode = plugin.global || (plugin.modes && plugin.modes.includes(activeMode));
        if (isTargetMode && plugin.onKeyUp) {
          const handled = plugin.onKeyUp(e, contextValue);
          if (handled) {
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [contextValue, state.editor?.mode]);

  return <MapEditorContext.Provider value={contextValue}>{children}</MapEditorContext.Provider>;
}

export function useMapEditorContext() {
  const context = useContext(MapEditorContext);
  if (!context) {
    throw new Error("useMapEditorContext must be used within a MapEditorPluginProvider");
  }
  return context;
}
