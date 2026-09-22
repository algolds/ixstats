import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type React from "react";
import type { EditorMode } from "~/hooks/useMapEditor";
import type { useMapEditorOverlayState } from "../hooks/useMapEditorOverlayState";

export type MapEditorEvent = MapLayerMouseEvent | MouseEvent | TouchEvent;

export interface ToolbarItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
  group: number;
  mode: EditorMode; // The mode this tool activates
  order?: number;
}

export interface SidebarTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<{ context: MapEditorContextType }>;
}

export type PluginStateValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: PluginStateValue }
  | PluginStateValue[];

export type MapEditorOverlayStateReturnType = ReturnType<typeof useMapEditorOverlayState>;

export interface MapEditorContextType {
  /** Core state object returned by useMapEditorOverlayState hook */
  state: MapEditorOverlayStateReturnType;
  /** Reference to the MapLibre Map instance */
  map: MapLibreMap | null;
  /** Set MapLibre Map instance */
  setMap: (map: MapLibreMap | null) => void;
  /** Generic reactive dictionary for plugin custom states */
  pluginStates: Record<string, PluginStateValue>;
  /** Update custom state for a specific plugin */
  setPluginState: (
    pluginId: string,
    state: PluginStateValue | ((prev: PluginStateValue) => PluginStateValue)
  ) => void;
  /** Triggered when active mode is changed */
  onModeChange: (mode: string) => void;
}

export interface MapEditorPlugin {
  id: string;
  name: string;
  /** If true, receives key and map events in all modes */
  global?: boolean;
  /** The modes in which this plugin is active to receive event routing */
  modes?: string[];

  /** Toolbar items registered by this plugin */
  toolbarItems?: ToolbarItem[];

  /** Sidebar tabs registered by this plugin */
  sidebarTabs?: SidebarTab[];

  /** Keydown interceptor. Return true if fully handled to prevent default behavior. */
  onKeyDown?: (e: KeyboardEvent, context: MapEditorContextType) => boolean | void;
  /** Keyup interceptor. Return true if fully handled. */
  onKeyUp?: (e: KeyboardEvent, context: MapEditorContextType) => boolean | void;

  /** Map canvas interaction event handlers */
  mapEvents?: {
    [key: string]: ((e: MapEditorEvent, context: MapEditorContextType) => void) | undefined;
    onClick?: (e: MapEditorEvent, context: MapEditorContextType) => void;
    onMouseMove?: (e: MapEditorEvent, context: MapEditorContextType) => void;
    onMouseDown?: (e: MapEditorEvent, context: MapEditorContextType) => void;
    onMouseUp?: (e: MapEditorEvent, context: MapEditorContextType) => void;
    onDoubleClick?: (e: MapEditorEvent, context: MapEditorContextType) => void;
    onContextMenu?: (e: MapEditorEvent, context: MapEditorContextType) => void;
  };

  /** Custom coordinate snapping function */
  snapPoint?: (coords: [number, number], context: MapEditorContextType) => [number, number];

  /** Custom render overlays layered on top of the Map canvas */
  overlays?: React.ComponentType<{ context: MapEditorContextType }>[];
}
