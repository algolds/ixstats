// @ts-nocheck
import { Route } from "lucide-react";
import type { MapEditorPlugin, MapEditorContextType } from "./types";

export const RouteEditPlugin: MapEditorPlugin = {
  id: "route-edit",
  name: "Route & Transport Path Editor",
  global: true, // Listens globally to T key
  modes: ["add-route", "edit-route"],

  toolbarItems: [
    { id: "tool-route", mode: "add-route", icon: Route, label: "Route", shortcut: "T", group: 1 },
  ],

  onKeyDown(e: KeyboardEvent, context: MapEditorContextType) {
    if (e.key.toLowerCase() === "t") {
      context.onModeChange("add-route");
      return true;
    }
    return false;
  },
};
