import { Hexagon, Droplet } from "iconoir-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";

export const SubdivisionDrawPlugin: MapEditorPlugin = {
  id: "subdivision-draw",
  name: "Subdivision Drawing",
  global: true, // Keydown listens globally to R/J keys
  modes: ["add-subdivision", "add-lake"],

  toolbarItems: [
    {
      id: "tool-region",
      mode: "add-subdivision",
      icon: Hexagon,
      label: "Region",
      shortcut: "R",
      group: 1,
    },
    {
      id: "tool-lake",
      mode: "add-lake",
      icon: Droplet,
      label: "Lake",
      shortcut: "J",
      group: 2,
    },
  ],

  onKeyDown(e: KeyboardEvent, context: MapEditorContextType) {
    const key = e.key.toLowerCase();
    if (key === "r") {
      context.onModeChange("add-subdivision");
      return true;
    }
    if (key === "j") {
      context.onModeChange("add-lake");
      return true;
    }
    return false;
  },
};
