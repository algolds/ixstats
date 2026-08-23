import { CursorPointer as MousePointer2, HandBrake as Hand, SelectWindow as LassoSelect } from "iconoir-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";

export const SelectPlugin: MapEditorPlugin = {
  id: "select",
  name: "Selection & Pan",
  global: true, // Listens globally to V/H/M keys to switch tools
  modes: ["view", "pan", "lasso-select"],

  toolbarItems: [
    {
      id: "tool-select",
      mode: "view",
      icon: MousePointer2,
      label: "Select",
      shortcut: "V",
      group: 0,
    },
    { id: "tool-pan", mode: "pan", icon: Hand, label: "Hand (Pan)", shortcut: "H", group: 0 },
    {
      id: "tool-lasso",
      mode: "lasso-select",
      icon: LassoSelect,
      label: "Lasso Select",
      shortcut: "M",
      group: 0,
    },
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

    const key = e.key.toLowerCase();
    if (key === "v") {
      context.onModeChange("view");
      return true;
    }
    if (key === "h") {
      context.onModeChange("pan");
      return true;
    }
    if (key === "m" && !e.ctrlKey && !e.metaKey) {
      context.onModeChange("lasso-select");
      return true;
    }
    return false;
  },
};
