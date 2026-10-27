import type { LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";

/** Layer spec without its source; paint/layout stay loose because expression arrays defeat MapLibre's union typing. */
export interface LayerDef {
  id: string;
  type: "fill" | "line" | "symbol" | "circle";
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  minzoom?: number;
}

/** Add a GeoJSON source (a collection, or bare features) and the layers drawn from it. */
export function addGeoLayers(
  map: MapLibreMap,
  sourceId: string,
  data: FeatureCollection | Feature[],
  layers: LayerDef[]
) {
  map.addSource(sourceId, {
    type: "geojson",
    data: Array.isArray(data) ? { type: "FeatureCollection", features: data } : data,
  });
  for (const layer of layers)
    map.addLayer({ ...layer, source: sourceId } as unknown as LayerSpecification);
}
