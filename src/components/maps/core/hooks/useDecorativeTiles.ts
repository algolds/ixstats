import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { TILED_LAYERS, applyVectorTiles, tileUrlTemplate } from "~/lib/maps/decorative-tiles";

/**
 * Draw the decorative layers (altitudes, rivers, lakes) from vector tiles once the realm is known
 * (an id or a slug). A theme change re-applies the shared base style, whose sources are GeoJSON,
 * so they are re-pointed on every style change; a no-op when they are already the realm's tiles.
 */
export function useDecorativeTiles(map: MapLibreMap | null, isLoaded: boolean, realm?: string) {
  useEffect(() => {
    if (!map || !isLoaded || !realm) return;
    const apply = () => {
      for (const layer of TILED_LAYERS) applyVectorTiles(map, layer, tileUrlTemplate(realm, layer));
    };
    apply();
    map.on("styledata", apply);
    return () => {
      map.off("styledata", apply);
    };
  }, [map, isLoaded, realm]);
}
