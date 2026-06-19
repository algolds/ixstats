// @ts-nocheck
import { MapPin, Landmark, BookMarked, Type } from "lucide-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";

export const PointPlacementPlugin: MapEditorPlugin = {
  id: "point-placement",
  name: "POI & Label Placement",
  global: true, // Listens globally to C/P/S/L keys
  modes: ["add-city", "add-poi", "add-story-pin", "add-label"],

  toolbarItems: [
    { id: "tool-city", mode: "add-city", icon: MapPin, label: "City", shortcut: "C", group: 2 },
    { id: "tool-poi", mode: "add-poi", icon: Landmark, label: "POI", shortcut: "P", group: 2 },
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
    const key = e.key.toLowerCase();
    if (key === "c") {
      context.onModeChange("add-city");
      return true;
    }
    if (key === "p") {
      context.onModeChange("add-poi");
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
