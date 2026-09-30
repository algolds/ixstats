"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { EditorMode } from "~/hooks/useMapEditor";
import type {
  MapEditorContextType,
  PluginStateValue,
  MapEditorOverlayStateReturnType,
} from "./types";
import { getPlugins } from "./registry";
import { isEditorConfirmOpen } from "../components/EditorConfirmDialog";

const MapEditorContext = createContext<MapEditorContextType | null>(null);

interface MapEditorPluginProviderProps {
  children: React.ReactNode;
  state: MapEditorOverlayStateReturnType;
}

export function MapEditorPluginProvider({ children, state }: MapEditorPluginProviderProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [pluginStates, setPluginStates] = useState<Record<string, PluginStateValue>>({});

  const setPluginState = useCallback(
    (
      pluginId: string,
      newState: PluginStateValue | ((prev: PluginStateValue) => PluginStateValue)
    ) => {
      setPluginStates((prev) => ({
        ...prev,
        [pluginId]:
          typeof newState === "function"
            ? (newState as (p: PluginStateValue) => PluginStateValue)(prev[pluginId] ?? null)
            : newState,
      }));
    },
    []
  );

  // Plugins read `context.state` at event time, so the context exposes it through a
  // getter over a ref: the context object (and every consumer's callbacks/effects)
  // stays stable while the editor state changes underneath it.
  const stateRef = useRef(state);
  // oxlint-disable-next-line -- latest-value ref read by plugin handlers
  stateRef.current = state;

  const onModeChange = useCallback((newMode: string) => {
    const current = stateRef.current;
    const mode = newMode as EditorMode;
    // Respect the same gating as the tool rail: no tools until a country/shape is ready.
    if (mode !== "view" && mode !== "lasso-select" && mode !== "ruler") {
      if (!current.isWorldMode && current.toolsDisabled) return;
      if (current.disabledTools?.includes(mode)) return;
    }
    current.editor?.setMode?.(mode);
  }, []);

  const contextValue = useMemo<MapEditorContextType>(
    () => ({
      get state() {
        return stateRef.current;
      },
      map,
      setMap,
      pluginStates,
      setPluginState,
      onModeChange,
    }),
    [map, pluginStates, setPluginState, onModeChange]
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
      // Border editing (world editor) has its own tool letters; dialogs own the keyboard.
      const current = stateRef.current;
      if (
        current.activeEditorMode === "border_edit" ||
        current.showShortcuts ||
        isEditorConfirmOpen()
      ) {
        return;
      }
      if (e.defaultPrevented) return;

      const activeMode = current.editor?.mode ?? "view";
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
      const current = stateRef.current;
      if (current.activeEditorMode === "border_edit") return;

      const activeMode = current.editor?.mode ?? "view";
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
  }, [contextValue]);

  return <MapEditorContext.Provider value={contextValue}>{children}</MapEditorContext.Provider>;
}

export function useMapEditorContext() {
  const context = useContext(MapEditorContext);
  if (!context) {
    throw new Error("useMapEditorContext must be used within a MapEditorPluginProvider");
  }
  return context;
}
