import type { Map as MapLibreMap } from "maplibre-gl";
import type React from "react";
import type { EditorMode } from "~/hooks/useMapEditor";

export interface ToolbarItem {
  id: string;
  icon: any; // Lucide or custom icon component
  label: string;
  shortcut: string;
  group: number;
  mode: EditorMode; // The mode this tool activates
}

export interface SidebarTab {
  id: string;
  label: string;
  icon: any;
  component: React.ComponentType<{ context: MapEditorContextType }>;
}

export interface MapEditorContextType {
  /** Core state object returned by useMapEditorOverlayState hook */
  state: any;
  /** Reference to the MapLibre Map instance */
  map: MapLibreMap | null;
  /** Set MapLibre Map instance */
  setMap: (map: MapLibreMap | null) => void;
  /** Generic reactive dictionary for plugin custom states */
  pluginStates: Record<string, any>;
  /** Update custom state for a specific plugin */
  setPluginState: (pluginId: string, state: any) => void;
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
    onClick?: (e: any, context: MapEditorContextType) => void;
    onMouseMove?: (e: any, context: MapEditorContextType) => void;
    onMouseDown?: (e: any, context: MapEditorContextType) => void;
    onMouseUp?: (e: any, context: MapEditorContextType) => void;
    onDoubleClick?: (e: any, context: MapEditorContextType) => void;
    onContextMenu?: (e: any, context: MapEditorContextType) => void;
  };

  /** Custom coordinate snapping function */
  snapPoint?: (coords: [number, number], context: MapEditorContextType) => [number, number];

  /** Custom render overlays layered on top of the Map canvas */
  overlays?: React.ComponentType<{ context: MapEditorContextType }>[];
}
