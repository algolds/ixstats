/**
 * The layers of a realm's own map that the generator fits a world around ("This realm's map"). The editor loads
 * them from the versioned layer route; the World tab reads the same queries, so nothing is downloaded twice.
 */

import type { FeatureCollection } from "geojson";
import type { MapLayerType } from "~/lib/maps/map-config";
import type { LandMaskLayers } from "./land-mask";

/** The layers a land mask is made of: land from the background and political layers, relief hints from altitudes. */
export const MASK_LAYER_TYPES = [
  "background",
  "political",
  "altitudes",
] as const satisfies readonly MapLayerType[];

/** The mask layers among `layers` (decoded, by layer type); one that did not arrive is left out. */
export function landMaskLayersFrom(
  layers: Readonly<Record<string, FeatureCollection>> | undefined
): LandMaskLayers {
  const mask: LandMaskLayers = {};
  for (const type of MASK_LAYER_TYPES) {
    const layer = layers?.[type];
    if (layer) mask[type] = layer;
  }
  return mask;
}

/** Whether the realm has borders to keep: a political layer with at least one feature. */
export const hasRealmBorders = (mask: LandMaskLayers): boolean =>
  (mask.political?.features.length ?? 0) > 0;
