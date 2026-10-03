import { Ruler } from "iconoir-react";
import type { MapEditorPlugin, MapEditorContextType, ToolbarItem } from "./types";
import { toolShortcuts } from "./shortcuts";

const toolbarItems: ToolbarItem[] = [
  {
    id: "tool-ruler",
    mode: "ruler",
    icon: Ruler,
    label: "Ruler (Measure)",
    shortcut: "U",
    group: 4,
    order: 1,
  },
];

export const RulerGuidesPlugin: MapEditorPlugin = {
  id: "ruler-guides",
  name: "Rulers & Snapping Guides",
  global: true,
  modes: ["ruler"],

  toolbarItems,
  onKeyDown: toolShortcuts(toolbarItems),

  snapPoint(coords: [number, number], context: MapEditorContextType): [number, number] {
    const map = context.map;
    const guides = context.state.editor?.guides;
    const snapEnabled = context.state.snapEnabled;
    const snapTolerance = context.state.snapTolerance ?? 10;

    if (!map || !snapEnabled || !guides || guides.length === 0) return coords;

    const clickScreen = map.project(coords);
    let bestLng = coords[0];
    let bestLat = coords[1];
    let minDistanceX = Infinity;
    let minDistanceY = Infinity;

    for (const guide of guides) {
      if (guide.type === "v") {
        const proj = map.project([guide.value, coords[1]]);
        const dist = Math.abs(clickScreen.x - proj.x);
        if (dist <= snapTolerance && dist < minDistanceX) {
          minDistanceX = dist;
          bestLng = guide.value;
        }
      } else if (guide.type === "h") {
        const proj = map.project([coords[0], guide.value]);
        const dist = Math.abs(clickScreen.y - proj.y);
        if (dist <= snapTolerance && dist < minDistanceY) {
          minDistanceY = dist;
          bestLat = guide.value;
        }
      }
    }

    return [bestLng, bestLat];
  },
};
