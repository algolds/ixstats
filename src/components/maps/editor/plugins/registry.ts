import type { MapEditorPlugin } from "./types";
import { SelectPlugin } from "./SelectPlugin";
import { SubdivisionDrawPlugin } from "./SubdivisionDrawPlugin";
import { RouteEditPlugin } from "./RouteEditPlugin";
import { PointPlacementPlugin } from "./PointPlacementPlugin";
import { EyedropperMagicWandPlugin } from "./EyedropperMagicWandPlugin";
import { RulerGuidesPlugin } from "./RulerGuidesPlugin";
import { PaintFillPlugin } from "./PaintFillPlugin";

const PLUGINS: MapEditorPlugin[] = [
  SelectPlugin,
  SubdivisionDrawPlugin,
  RouteEditPlugin,
  PointPlacementPlugin,
  EyedropperMagicWandPlugin,
  RulerGuidesPlugin,
  PaintFillPlugin,
];

export function getPlugins(): MapEditorPlugin[] {
  return PLUGINS;
}

export function getPluginsForMode(mode: string): MapEditorPlugin[] {
  return PLUGINS.filter((p) => p.modes && p.modes.includes(mode));
}

export function getGlobalPlugins(): MapEditorPlugin[] {
  return PLUGINS.filter((p) => p.global);
}
