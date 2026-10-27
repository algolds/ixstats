import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapLayerData } from "../IxWorldMap";
import type { MapTheme } from "~/lib/map-styles/registry";
import type { RealmRasterLayer } from "~/lib/maps/realm-map-settings";
import { rasterTilePath } from "~/lib/maps/raster-tiles";
import { withBasePath } from "~/lib/base-path";
import { syncBaseImage, syncRasterLayers } from "../utils/realm-map-layers";

interface UseRealmMapLayersProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  layers: MapLayerData[];
  theme?: MapTheme;
  /** The realm's base image (`Realm.settings.map.baseImage`), or null. */
  baseImageUrl?: string | null;
  /** The realm whose raster art `rasterLayers` are. */
  rasterRealmId?: string | null;
  /** The realm's raster art switched on, in drawing order. */
  rasterLayers?: readonly RealmRasterLayer[];
}

const NO_RASTERS: readonly RealmRasterLayer[] = [];

/**
 * The realm map's own layers: its raster art and its base image under the political layer. They follow the layer
 * data (the political source appears after the first bundle) and the theme (a style swap drops custom layers).
 */
export function useRealmMapLayers({
  map,
  isLoaded,
  layers,
  theme,
  baseImageUrl = null,
  rasterRealmId = null,
  rasterLayers = NO_RASTERS,
}: UseRealmMapLayersProps) {
  useEffect(() => {
    if (!map || !isLoaded) return;
    try {
      syncBaseImage(map, baseImageUrl);
    } catch (err) {
      console.warn("[useRealmMapLayers] base image:", err);
    }
  }, [map, isLoaded, baseImageUrl, theme, layers]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    // Absolute: MapLibre fetches tiles from its worker, where relative URLs don't resolve
    const urlFor = (layer: RealmRasterLayer) =>
      `${window.location.origin}${withBasePath(rasterTilePath(rasterRealmId ?? "", layer))}`;
    try {
      syncRasterLayers(map, rasterRealmId ? rasterLayers : NO_RASTERS, urlFor);
    } catch (err) {
      console.warn("[useRealmMapLayers] raster art:", err);
    }
  }, [map, isLoaded, rasterRealmId, rasterLayers, theme, layers]);
}
