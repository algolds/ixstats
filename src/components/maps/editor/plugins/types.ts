import type { Map as MapLibreMap } from "maplibre-gl";
import type React from "react";
import type { EditorMode } from "~/hooks/useMapEditor";
import type { useMapEditorOverlayState } from "../hooks/useMapEditorOverlayState";

export interface ToolbarItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
  group: number;
  /** The mode this tool activates */
  mode: EditorMode;
  order?: number;
}

export type MapEditorOverlayStateReturnType = ReturnType<typeof useMapEditorOverlayState>;

export interface MapEditorContextType {
  /** Core state object returned by useMapEditorOverlayState hook */
  state: MapEditorOverlayStateReturnType;
  /** Reference to the MapLibre Map instance */
  map: MapLibreMap | null;
  /** Set MapLibre Map instance */
  setMap: (map: MapLibreMap | null) => void;
  /** Triggered when active mode is changed */
  onModeChange: (mode: string) => void;
}

export interface MapEditorPlugin {
  id: string;
  name: string;
  /** If true, receives key events in all modes */
  global?: boolean;
  /** The modes in which this plugin receives key events */
  modes?: string[];
  toolbarItems?: ToolbarItem[];
  /** Keydown interceptor. Return true if fully handled to prevent default behavior. */
  onKeyDown?: (e: KeyboardEvent, context: MapEditorContextType) => boolean | void;
  /** Custom coordinate snapping function */
  snapPoint?: (coords: [number, number], context: MapEditorContextType) => [number, number];
}
