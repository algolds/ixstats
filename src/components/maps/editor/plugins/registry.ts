import type { MapEditorPlugin } from "./types";
import { SelectPlugin } from "./SelectPlugin";
import { SubdivisionDrawPlugin } from "./SubdivisionDrawPlugin";
import { RouteEditPlugin } from "./RouteEditPlugin";
import { PointPlacementPlugin } from "./PointPlacementPlugin";
import { RulerGuidesPlugin } from "./RulerGuidesPlugin";

const PLUGINS: MapEditorPlugin[] = [
  SelectPlugin,
  SubdivisionDrawPlugin,
  RouteEditPlugin,
  PointPlacementPlugin,
  RulerGuidesPlugin,
];

export function getPlugins(): MapEditorPlugin[] {
  return PLUGINS;
}
