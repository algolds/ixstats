import {
  CursorPointer as MousePointer2,
  SelectWindow as LassoSelect,
} from "iconoir-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";
import { isKeyboardInputTarget } from "../hooks/drag-utils";

export const SelectPlugin: MapEditorPlugin = {
  id: "select",
  name: "Selection",
  global: true, // Listens globally to V/M keys to switch tools
  modes: ["view", "lasso-select"],

  toolbarItems: [
    {
      id: "tool-select",
      mode: "view",
      icon: MousePointer2,
      label: "Select",
      shortcut: "V",
      group: 0,
      order: 1,
    },
    {
      id: "tool-lasso",
      mode: "lasso-select",
      icon: LassoSelect,
      label: "Lasso Select",
      shortcut: "M",
      group: 0,
      order: 2,
    },
  ],

  onKeyDown(e: KeyboardEvent, context: MapEditorContextType) {
    if (isKeyboardInputTarget(e.target) || isKeyboardInputTarget(document.activeElement)) {
      return false;
    }

    const isMod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Map canvas undo / redo
    if (isMod && key === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        context.state.editor.redo();
      } else {
        context.state.editor.undo();
      }
      return true;
    }

    if (isMod && key === "y") {
      e.preventDefault();
      context.state.editor.redo();
      return true;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) {
      return false;
    }

    if (key === "v") {
      context.onModeChange("view");
      return true;
    }
    if (key === "m") {
      context.onModeChange("lasso-select");
      return true;
    }
    return false;
  },
};
