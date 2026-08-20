import { PaintBucket } from "lucide-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";

export const PaintFillPlugin: MapEditorPlugin = {
  id: "paint-fill",
  name: "Paint Fill",
  global: true, // Keydown listens globally to G key
  modes: ["paint-fill"],

  toolbarItems: [
    {
      id: "tool-paint-fill",
      mode: "paint-fill",
      icon: PaintBucket,
      label: "Paint Fill",
      shortcut: "G",
      group: 4,
    },
  ],

  onKeyDown(e: KeyboardEvent, context: MapEditorContextType) {
    if (e.key.toLowerCase() === "g") {
      context.onModeChange("paint-fill");
      return true;
    }
    return false;
  },
};
