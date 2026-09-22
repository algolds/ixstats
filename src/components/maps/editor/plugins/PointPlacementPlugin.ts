import {
  MapPin,
  Bank as Landmark,
  ModernTv as Mountain,
} from "iconoir-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";
import { isKeyboardInputTarget } from "../hooks/drag-utils";

export const PointPlacementPlugin: MapEditorPlugin = {
  id: "point-placement",
  name: "POI & Feature Placement",
  global: true, // Listens globally to C/P/K keys
  modes: ["add-city", "add-poi", "add-peak"],

  toolbarItems: [
    { id: "tool-city", mode: "add-city", icon: MapPin, label: "City", shortcut: "C", group: 1, order: 2 },
    { id: "tool-poi", mode: "add-poi", icon: Landmark, label: "POI", shortcut: "P", group: 1, order: 3 },
    { id: "tool-peak", mode: "add-peak", icon: Mountain, label: "Peak", shortcut: "K", group: 3, order: 1 },
  ],

  onKeyDown(e: KeyboardEvent, context: MapEditorContextType) {
    if (isKeyboardInputTarget(e.target) || isKeyboardInputTarget(document.activeElement)) {
      return false;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;

    // In border edit mode, let border editor handle its own shortcuts (e.g. P for pencil/vertex_edit)
    if (context.state.activeEditorMode === "border_edit") {
      return false;
    }

    const key = e.key.toLowerCase();
    if (key === "c") {
      context.onModeChange("add-city");
      return true;
    }
    if (key === "p") {
      context.onModeChange("add-poi");
      return true;
    }
    if (key === "k") {
      context.onModeChange("add-peak");
      return true;
    }
    return false;
  },
};
