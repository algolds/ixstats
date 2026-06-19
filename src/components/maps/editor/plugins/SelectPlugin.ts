// @ts-nocheck
import { MousePointer2, Hand, LassoSelect } from "lucide-react";
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
    const key = e.key.toLowerCase();
    if (key === "v") {
      context.onModeChange("view");
      return true;
    }
    if (key === "h") {
      context.onModeChange("pan");
      return true;
    }
    if (key === "m") {
      context.onModeChange("lasso-select");
      return true;
    }
    return false;
  },

  mapEvents: {
    onClick(e: any, context: MapEditorContextType) {
      const mode = context.state.editor?.mode ?? "view";
      if (mode !== "view" && mode !== "pan") return;

      const map = context.map;
      if (!map) return;

      const interactiveLayers = [
        "editor-subdivisions-fill",
        "editor-points-capital",
        "editor-points-city",
        "editor-points-poi",
        "editor-points-story-pin",
        "editor-points-map-label",
        "editor-points-labels",
        "editor-map-labels",
        "editor-gaps-fill",
      ];

      const bbox = [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6],
      ] as [any, any];

      const hits = map.queryRenderedFeatures(bbox, { layers: interactiveLayers });
      if (hits.length > 0) {
        const sortedHits = [...hits].sort((a, b) => {
          const aId = a.layer.id;
          const bId = b.layer.id;
          const isPointA = aId.startsWith("editor-points-") || aId === "editor-map-labels";
          const isPointB = bId.startsWith("editor-points-") || bId === "editor-map-labels";
          if (isPointA && !isPointB) return -1;
          if (!isPointA && isPointB) return 1;
          return 0;
        });

        const hitId = sortedHits[0]?.properties?.id as string | undefined;
        if (hitId) {
          const match = context.state.editor?.allFeatures?.find((f: any) => f.id === hitId);
          if (match && context.state.handleSelectFeature) {
            e.preventDefault();
            context.state.handleSelectFeature(match);
            return;
          }
        }
      }

      // If clicked empty space, deselect selection
      if (mode === "view" && context.state.handleSelectFeature) {
        context.state.handleSelectFeature(null);
      }
    },
  },
};
