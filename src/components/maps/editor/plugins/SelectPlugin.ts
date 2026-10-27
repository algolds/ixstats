import { CursorPointer as MousePointer2, SelectWindow as LassoSelect } from "iconoir-react";
import type { MapEditorPlugin, ToolbarItem } from "./types";
import { toolShortcuts } from "./shortcuts";

const toolbarItems: ToolbarItem[] = [
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
];

// Undo/redo is owned by the editor's single keyboard handler (useEditorKeyboardShortcuts)
// so one keypress never undoes twice.
export const SelectPlugin: MapEditorPlugin = {
  id: "select",
  name: "Selection",
  global: true,
  modes: ["view", "lasso-select"],
  toolbarItems,
  onKeyDown: toolShortcuts(toolbarItems),
};
