// @ts-nocheck
import { Hexagon } from "lucide-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";

export const SubdivisionDrawPlugin: MapEditorPlugin = {
  id: "subdivision-draw",
  name: "Subdivision Drawing",
  global: true, // Keydown listens globally to R key
  modes: ["add-subdivision"],

  toolbarItems: [
    {
      id: "tool-region",
      mode: "add-subdivision",
      icon: Hexagon,
      label: "Region",
      shortcut: "R",
      group: 1,
    },
  ],

  onKeyDown(e: KeyboardEvent, context: MapEditorContextType) {
    if (e.key.toLowerCase() === "r") {
      context.onModeChange("add-subdivision");
      return true;
    }
    return false;
  },
};
