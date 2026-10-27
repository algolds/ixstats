import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  TILED_LAYERS,
  applyVectorTiles,
  tileUrlTemplate,
  type TileSource,
} from "~/lib/maps/decorative-tiles";

/**
 * Draw the decorative layers (altitudes, rivers, lakes) from the realm's vector tiles once its map version is
 * known; a new version points the sources at new URLs. A theme change re-applies the shared base style, whose
 * sources are GeoJSON, so they are re-pointed on every style change; a no-op when they are already these tiles.
 */
export function useDecorativeTiles(
  map: MapLibreMap | null,
  isLoaded: boolean,
  source?: TileSource
) {
  const realmId = source?.realmId;
  const version = source?.version;
  useEffect(() => {
    if (!map || !isLoaded || realmId === undefined || version === undefined) return;
    const apply = () => {
      for (const layer of TILED_LAYERS) {
        applyVectorTiles(map, layer, tileUrlTemplate({ realmId, version }, layer));
      }
    };
    apply();
    map.on("styledata", apply);
    return () => {
      map.off("styledata", apply);
    };
  }, [map, isLoaded, realmId, version]);
}
