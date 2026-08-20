import { Pipette, Wand2 } from "lucide-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";

export const EyedropperMagicWandPlugin: MapEditorPlugin = {
  id: "eyedropper-magic-wand",
  name: "Style & Selection Sampling",
  global: true, // Keydown listens globally to I/W keys
  modes: ["eyedropper", "magic-wand"],

  toolbarItems: [
    {
      id: "tool-magic-wand",
      mode: "magic-wand",
      icon: Wand2,
      label: "Magic Wand",
      shortcut: "W",
      group: 0,
    },
    {
      id: "tool-eyedropper",
      mode: "eyedropper",
      icon: Pipette,
      label: "Eyedropper",
      shortcut: "I",
      group: 3,
    },
  ],

  onKeyDown(e: KeyboardEvent, context: MapEditorContextType) {
    const key = e.key.toLowerCase();
    if (key === "i") {
      context.onModeChange("eyedropper");
      return true;
    }
    if (key === "w") {
      context.onModeChange("magic-wand");
      return true;
    }
    return false;
  },
};
