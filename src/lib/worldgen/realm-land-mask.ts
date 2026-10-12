/**
 * The layers of a realm's own map that the generator fits a world around ("This realm's map"). The editor has
 * them decoded already (`useMapData`), so the World tab hands them to the worker as they are.
 */

import type { FeatureCollection } from "geojson";
import type { LandMaskLayers } from "./land-mask";

/** A loaded map layer, as the editor holds it. */
interface LoadedLayer {
  type: string;
  data: FeatureCollection;
}

const MASK_LAYERS = ["background", "political", "altitudes"] as const;

/** The background, political and altitude layers among `layers`; one not loaded yet is left out. */
export function landMaskLayersFrom(layers: readonly LoadedLayer[]): LandMaskLayers {
  const mask: LandMaskLayers = {};
  for (const type of MASK_LAYERS) {
    const layer = layers.find((candidate) => candidate.type === type);
    if (layer) mask[type] = layer.data;
  }
  return mask;
}

/** Whether the realm has borders to keep: a political layer with at least one feature. */
export const hasRealmBorders = (mask: LandMaskLayers): boolean =>
  (mask.political?.features.length ?? 0) > 0;
