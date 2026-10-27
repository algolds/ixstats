import { MapPin, Bank as Landmark, ModernTv as Mountain } from "iconoir-react";
import type { MapEditorPlugin, ToolbarItem } from "./types";
import { toolShortcuts } from "./shortcuts";

const toolbarItems: ToolbarItem[] = [
  {
    id: "tool-city",
    mode: "add-city",
    icon: MapPin,
    label: "City",
    shortcut: "C",
    group: 1,
    order: 2,
  },
  {
    id: "tool-poi",
    mode: "add-poi",
    icon: Landmark,
    label: "POI",
    shortcut: "P",
    group: 1,
    order: 3,
  },
  {
    id: "tool-peak",
    mode: "add-peak",
    icon: Mountain,
    label: "Peak",
    shortcut: "K",
    group: 3,
    order: 1,
  },
];

export const PointPlacementPlugin: MapEditorPlugin = {
  id: "point-placement",
  name: "POI & Feature Placement",
  global: true,
  modes: ["add-city", "add-poi", "add-peak"],
  toolbarItems,
  onKeyDown: toolShortcuts(toolbarItems, { skipInBorderEdit: true }),
};
