import { PathArrow as Route, SeaWaves as Waves } from "iconoir-react";
import type { MapEditorPlugin, ToolbarItem } from "./types";
import { toolShortcuts } from "./shortcuts";

const toolbarItems: ToolbarItem[] = [
  {
    id: "tool-route",
    mode: "add-route",
    icon: Route,
    label: "Route",
    shortcut: "T",
    group: 2,
    order: 1,
  },
  {
    id: "tool-river",
    mode: "add-river",
    icon: Waves,
    label: "River",
    shortcut: "Y",
    group: 3,
    order: 2,
  },
];

export const RouteEditPlugin: MapEditorPlugin = {
  id: "route-edit",
  name: "Route & Transport Path Editor",
  global: true,
  modes: ["add-route", "edit-route", "add-river"],
  toolbarItems,
  onKeyDown: toolShortcuts(toolbarItems),
};
