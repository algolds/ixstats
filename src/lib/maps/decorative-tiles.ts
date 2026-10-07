import type { LayerSpecification, Map as MapLibreMap, VectorTileSource } from "maplibre-gl";
import { withBasePath } from "~/lib/base-path";

/** Decorative map layers the /maps viewer draws from vector tiles (`/api/map-tiles`), not GeoJSON.
 * Climate stays GeoJSON: it loads only when switched on, and its Arctic zone is a ring around the
 * pole that the tile SQL's antimeridian split can't close over the pole. */
export const TILED_LAYERS = ["altitudes", "rivers", "lakes"] as const;
export type TiledLayer = (typeof TILED_LAYERS)[number];

export const isTiledLayer = (t: string): t is TiledLayer =>
  (TILED_LAYERS as readonly string[]).includes(t);

/** Absolute tile URL template (MapLibre fetches tiles from its worker, where relative URLs don't resolve). */
export function tileUrlTemplate(realmId: string, layer: TiledLayer): string {
  return `${window.location.origin}${withBasePath(`/api/map-tiles/${encodeURIComponent(realmId)}/${layer}`)}/{z}/{x}/{y}`;
}

/**
 * Point `source-<layer>` at vector tiles. The base style is shared with embeds and the editor, which
 * keep GeoJSON, so the viewer swaps the source in place: its layers are re-added at the same position
 * with the same paint, layout and filter, reading `source-layer` <layer>.
 */
export function applyVectorTiles(map: MapLibreMap, layer: TiledLayer, url: string): void {
  const sourceId = `source-${layer}`;
  const source = map.getSource(sourceId);
  if (source?.type === "vector") {
    const vector = source as VectorTileSource;
    if (vector.tiles?.[0] !== url) vector.setTiles([url]);
    return;
  }
  const order = map.getStyle().layers;
  const specs = order.filter((l) => "source" in l && l.source === sourceId);
  const last = specs.length ? order.indexOf(specs[specs.length - 1]!) : -1;
  const beforeId = last >= 0 ? order[last + 1]?.id : undefined;
  for (const spec of specs) map.removeLayer(spec.id);
  if (source) map.removeSource(sourceId);
  map.addSource(sourceId, { type: "vector", tiles: [url], maxzoom: 6 });
  for (const spec of specs)
    map.addLayer({ ...spec, "source-layer": layer } as LayerSpecification, beforeId);
}
