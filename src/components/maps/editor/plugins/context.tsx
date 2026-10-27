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
import type { MapEditorContextType, MapEditorOverlayStateReturnType } from "./types";
import { getPlugins } from "./registry";
import { isEditorConfirmOpen } from "../components/EditorConfirmDialog";
import { isKeyboardInputTarget } from "../hooks/drag-utils";

const MapEditorContext = createContext<MapEditorContextType | null>(null);

interface MapEditorPluginProviderProps {
  children: React.ReactNode;
  state: MapEditorOverlayStateReturnType;
}

export function MapEditorPluginProvider({ children, state }: MapEditorPluginProviderProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
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
      onModeChange,
    }),
    [map, onModeChange]
  );

  // Centralized keyboard event routing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Typing in form controls, border editing (its own tool letters) and dialogs own the keyboard.
      if (isKeyboardInputTarget(document.activeElement)) return;
      const current = stateRef.current;
      if (
        current.activeEditorMode === "border_edit" ||
        current.showShortcuts ||
        isEditorConfirmOpen() ||
        e.defaultPrevented
      ) {
        return;
      }

      const activeMode = current.editor?.mode ?? "view";
      for (const plugin of getPlugins()) {
        const isTargetMode = plugin.global || plugin.modes?.includes(activeMode);
        if (isTargetMode && plugin.onKeyDown?.(e, contextValue)) {
          e.preventDefault();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
