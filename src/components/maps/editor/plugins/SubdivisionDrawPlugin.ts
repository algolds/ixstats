import { Hexagon, Droplet } from "iconoir-react";
import type { MapEditorPlugin, ToolbarItem } from "./types";
import { toolShortcuts } from "./shortcuts";

const toolbarItems: ToolbarItem[] = [
  {
    id: "tool-region",
    mode: "add-subdivision",
    icon: Hexagon,
    label: "Region",
    shortcut: "R",
    group: 1,
    order: 1,
  },
  {
    id: "tool-lake",
    mode: "add-lake",
    icon: Droplet,
    label: "Lake",
    shortcut: "J",
    group: 3,
    order: 3,
  },
];

export const SubdivisionDrawPlugin: MapEditorPlugin = {
  id: "subdivision-draw",
  name: "Subdivision Drawing",
  global: true,
  modes: ["add-subdivision", "add-lake"],
  toolbarItems,
  onKeyDown: toolShortcuts(toolbarItems),
};
