import { Route, Waves } from "lucide-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";

export const RouteEditPlugin: MapEditorPlugin = {
  id: "route-edit",
  name: "Route & Transport Path Editor",
  global: true, // Listens globally to T/Y keys
  modes: ["add-route", "edit-route", "add-river"],

  toolbarItems: [
    { id: "tool-route", mode: "add-route", icon: Route, label: "Route", shortcut: "T", group: 1 },
    { id: "tool-river", mode: "add-river", icon: Waves, label: "River", shortcut: "Y", group: 2 },
  ],

  onKeyDown(e: KeyboardEvent, context: MapEditorContextType) {
    const key = e.key.toLowerCase();
    if (key === "t") {
      context.onModeChange("add-route");
      return true;
    }
    if (key === "y") {
      context.onModeChange("add-river");
      return true;
    }
    return false;
  },
};
