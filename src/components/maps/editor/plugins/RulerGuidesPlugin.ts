import { Ruler } from "iconoir-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";

export const RulerGuidesPlugin: MapEditorPlugin = {
  id: "ruler-guides",
  name: "Rulers & Snapping Guides",
  global: true, // Keydown listens globally to U key
  modes: ["ruler"],

  toolbarItems: [
    {
      id: "tool-ruler",
      mode: "ruler",
      icon: Ruler,
      label: "Ruler (Measure)",
      shortcut: "U",
      group: 4,
    },
  ],

  onKeyDown(e: KeyboardEvent, context: MapEditorContextType) {
    if (e.key.toLowerCase() === "u") {
      context.onModeChange("ruler");
      return true;
    }
    return false;
  },

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
