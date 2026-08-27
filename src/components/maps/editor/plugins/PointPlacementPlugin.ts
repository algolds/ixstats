import {
  MapPin,
  Bank as Landmark,
  Bookmark as BookMarked,
  Type,
  ModernTv as Mountain,
} from "iconoir-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";

export const PointPlacementPlugin: MapEditorPlugin = {
  id: "point-placement",
  name: "POI & Label Placement",
  global: true, // Listens globally to C/P/S/L/K keys
  modes: ["add-city", "add-poi", "add-story-pin", "add-label", "add-peak"],

  toolbarItems: [
    { id: "tool-city", mode: "add-city", icon: MapPin, label: "City", shortcut: "C", group: 2 },
    { id: "tool-poi", mode: "add-poi", icon: Landmark, label: "POI", shortcut: "P", group: 2 },
    { id: "tool-peak", mode: "add-peak", icon: Mountain, label: "Peak", shortcut: "K", group: 2 },
    {
      id: "tool-story",
      mode: "add-story-pin",
      icon: BookMarked,
      label: "Story",
      shortcut: "S",
      group: 2,
    },
    { id: "tool-label", mode: "add-label", icon: Type, label: "Label", shortcut: "L", group: 3 },
  ],

  onKeyDown(e: KeyboardEvent, context: MapEditorContextType) {
    const activeEl = document.activeElement;
    const inInput =
      activeEl &&
      (activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "SELECT" ||
        activeEl.getAttribute("contenteditable") === "true");
    if (inInput) return false;
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
    if (key === "s") {
      context.onModeChange("add-story-pin");
      return true;
    }
    if (key === "l") {
      context.onModeChange("add-label");
      return true;
    }
    return false;
  },
};
