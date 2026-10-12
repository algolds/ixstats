import type { LayerSpecification, Map as MapLibreMap, VectorTileSource } from "maplibre-gl";
import { withBasePath } from "~/lib/base-path";
import { TILE_FORMAT_VERSION } from "~/lib/maps/tile-format";

/** Decorative map layers the /maps viewer draws from vector tiles (`/api/map-tiles`), not GeoJSON.
 * Climate stays GeoJSON: it loads only when switched on, and its Arctic zone is a ring around the
 * pole that the tile SQL's antimeridian split can't close over the pole. */
export const TILED_LAYERS = ["altitudes", "rivers", "lakes"] as const;
export type TiledLayer = (typeof TILED_LAYERS)[number];

export const isTiledLayer = (t: string): t is TiledLayer =>
  (TILED_LAYERS as readonly string[]).includes(t);

/** The deepest zoom the tiles are served at; MapLibre overzooms past it. */
export const MAX_TILE_ZOOM = 6;

/** Whether z/x/y is a tile of the pyramid the vector tiles cover (integers, z up to `MAX_TILE_ZOOM`). */
export function isTileCoord(z: number, x: number, y: number): boolean {
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > MAX_TILE_ZOOM) return false;
  const size = 2 ** z;
  return x >= 0 && x < size && y >= 0 && y < size;
}

/** The realm a map's tiles come from and its map version: a new version is a new tile URL. */
export interface TileSource {
  realmId: string;
  version: number;
}

/** Absolute tile URL template (MapLibre fetches tiles from its worker, where relative URLs don't resolve). It names
 * the realm, its map version and this build's tile format, so a changed map or renderer is a new URL. */
export function tileUrlTemplate({ realmId, version }: TileSource, layer: TiledLayer): string {
  const path = `/api/map-tiles/${encodeURIComponent(realmId)}/${version}/f${TILE_FORMAT_VERSION}/${layer}`;
  return `${window.location.origin}${withBasePath(path)}/{z}/{x}/{y}`;
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
  map.addSource(sourceId, { type: "vector", tiles: [url], maxzoom: MAX_TILE_ZOOM });
  for (const spec of specs)
    map.addLayer({ ...spec, "source-layer": layer } as LayerSpecification, beforeId);
}
