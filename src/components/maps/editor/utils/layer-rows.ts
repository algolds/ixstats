import type React from "react";
import {
  Globe,
  Hexagon,
  MapPin,
  Bank as Landmark,
  Bookmark as BookMarked,
  Type as TypeIcon,
  PathArrow as Route,
  CloudSunny as CloudSun,
  ModernTv as Mountain,
  SunLight as Relief,
} from "iconoir-react";
import { RELIEF_LAYER_ID } from "~/lib/maps/raster-tiles";
import type { LayerStateRecord } from "../types/editor-state";

interface LayerDef {
  id: string;
  name: string;
  icon: React.ElementType;
  /** Default opacity; omitted for layers without an opacity control. */
  opacity?: number;
}

const LAYER_DEFS: LayerDef[] = [
  { id: "border", name: "Country Border", icon: Globe },
  { id: "climate", name: "Climate Zones", icon: CloudSun },
  { id: RELIEF_LAYER_ID, name: "Relief", icon: Relief },
  { id: "regions", name: "Regions", icon: Hexagon, opacity: 0.6 },
  { id: "cities", name: "Cities", icon: MapPin, opacity: 1 },
  { id: "pois", name: "POIs", icon: Landmark, opacity: 1 },
  { id: "stories", name: "Story Pins", icon: BookMarked, opacity: 1 },
  { id: "labels", name: "Labels", icon: TypeIcon, opacity: 1 },
  { id: "routes", name: "Routes", icon: Route },
  { id: "geography", name: "Peaks, Rivers & Lakes", icon: Mountain, opacity: 1 },
];

/** Whether the realm has relief, and whether its overlay is shown on the map (`useRealmRelief`). */
export interface ReliefRow {
  available: boolean;
  shown: boolean;
}

/**
 * The Layers panel's rows. Climate and Relief are switched through the map (visible layers, raster overlays) and
 * are never lockable; Relief is a row only on a realm that has relief.
 */
export function buildLayers(
  layerStates: Record<string, LayerStateRecord>,
  editorVisibleLayers: Set<string>,
  relief: ReliefRow
) {
  return LAYER_DEFS.filter(({ id }) => id !== RELIEF_LAYER_ID || relief.available).map(
    ({ id, name, icon, opacity }) => {
      if (id === "climate") {
        return { id, name, icon, visible: editorVisibleLayers.has(id), locked: true };
      }
      if (id === RELIEF_LAYER_ID) return { id, name, icon, visible: relief.shown, locked: true };
      const layer = layerStates[id];
      return {
        id,
        name,
        icon,
        visible: layer?.visible ?? true,
        locked: id === "border" ? false : (layer?.locked ?? false),
        ...(opacity !== undefined && { opacity: layer?.opacity ?? opacity }),
      };
    }
  );
}

/** Rows whose visibility is switched elsewhere than the editor's layer state, and that have no lock. */
export const isMapSwitchedLayer = (id: string) => id === "climate" || id === RELIEF_LAYER_ID;
