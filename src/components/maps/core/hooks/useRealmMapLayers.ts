import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapLayerData } from "../IxWorldMap";
import type { MapTheme } from "~/lib/map-styles/registry";
import { syncBaseImage, syncUnclaimedHatch } from "../utils/realm-map-layers";

interface UseRealmMapLayersProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  layers: MapLayerData[];
  theme?: MapTheme;
  /** The realm's base image (`Realm.settings.map.baseImage`), or null. */
  baseImageUrl?: string | null;
  /** Credit for the base image, shown in the map's attribution control. */
  attribution?: string | null;
  /** The realm's nations nobody has claimed, hatched on the political layer. */
  unclaimedCountryIds?: readonly string[];
}

const NO_IDS: readonly string[] = [];

/**
 * The realm map's own layers: its base image under the political layer and the unclaimed-nation hatch. They
 * follow the layer data (the political source appears after the first bundle) and the theme (a style swap
 * drops custom layers).
 */
export function useRealmMapLayers({
  map,
  isLoaded,
  layers,
  theme,
  baseImageUrl = null,
  attribution = null,
  unclaimedCountryIds = NO_IDS,
}: UseRealmMapLayersProps) {
  useEffect(() => {
    if (!map || !isLoaded) return;
    try {
      syncBaseImage(map, baseImageUrl, attribution);
    } catch (err) {
      console.warn("[useRealmMapLayers] base image:", err);
    }
  }, [map, isLoaded, baseImageUrl, attribution, theme, layers]);

  const politicalVisible = layers.some((l) => l.type === "political" && l.visible);
  useEffect(() => {
    if (!map || !isLoaded) return;
    try {
      syncUnclaimedHatch(map, unclaimedCountryIds, politicalVisible);
    } catch (err) {
      console.warn("[useRealmMapLayers] unclaimed hatch:", err);
    }
  }, [map, isLoaded, unclaimedCountryIds, politicalVisible, theme, layers]);
}
