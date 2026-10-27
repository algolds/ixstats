import type { ImageSource, Map as MapLibreMap, RasterTileSource } from "maplibre-gl";
import { RASTER_TILE_SIZE } from "~/lib/maps/raster-tiles";
import type { RealmRasterLayer } from "~/lib/maps/realm-map-settings";

/**
 * A realm map's own style layers: its raster art (tiled base maps and overlays) and the base raster image under
 * the political layer. Each `sync…` call is idempotent: it adds, updates or removes its source and layer so the
 * persistent world map (shared between realms) shows only what the current realm asks for.
 */

export const BASE_IMAGE_SOURCE_ID = "realm-base-image";
export const BASE_IMAGE_LAYER_ID = "realm-base-image";
/** Each raster art layer is a source and a layer of this id plus the layer's id. */
export const RASTER_LAYER_PREFIX = "realm-raster-";
const POLITICAL_FILL_ID = "fill-political";

/**
 * Where a full-globe equirectangular image is pinned: its corners at ±180° and ±85° (the Web Mercator limit),
 * top-left first, clockwise. MapLibre stretches the image linearly between them in the map's projection.
 */
export const BASE_IMAGE_COORDINATES: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [-180, 85],
  [180, 85],
  [180, -85],
  [-180, -85],
];

/** The first data layer in the style (the map's own fills and lines), which the base image goes under. */
function firstDataLayerId(map: MapLibreMap): string | undefined {
  return map
    .getStyle()
    ?.layers?.find(
      (layer) =>
        layer.id !== BASE_IMAGE_LAYER_ID &&
        (layer.id.startsWith("fill-") || layer.id.startsWith("stroke-"))
    )?.id;
}

/**
 * Show `url` as the realm's base image (null removes it). Its credit is the realm's credit line, shown with the
 * map's attribution (bottom right) whether or not the art is on.
 */
export function syncBaseImage(map: MapLibreMap, url: string | null): void {
  const source = map.getSource(BASE_IMAGE_SOURCE_ID) as ImageSource | undefined;
  if (!url) {
    if (map.getLayer(BASE_IMAGE_LAYER_ID)) map.removeLayer(BASE_IMAGE_LAYER_ID);
    if (source) map.removeSource(BASE_IMAGE_SOURCE_ID);
    return;
  }
  if (source && (source as unknown as { url?: string }).url !== url) {
    source.updateImage({ url, coordinates: BASE_IMAGE_COORDINATES });
  } else if (!source) {
    map.addSource(BASE_IMAGE_SOURCE_ID, {
      type: "image",
      url,
      coordinates: BASE_IMAGE_COORDINATES,
    });
  }
  if (!map.getLayer(BASE_IMAGE_LAYER_ID)) {
    map.addLayer(
      {
        id: BASE_IMAGE_LAYER_ID,
        type: "raster",
        source: BASE_IMAGE_SOURCE_ID,
        paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
      },
      firstDataLayerId(map)
    );
  }
}

export const rasterStyleId = (layerId: string) => `${RASTER_LAYER_PREFIX}${layerId}`;

/** Where a raster art layer goes: a base map under every data layer, an overlay just under the political layer. */
function rasterAnchor(map: MapLibreMap, kind: RealmRasterLayer["kind"]): string | undefined {
  if (kind === "overlay" && map.getLayer(POLITICAL_FILL_ID)) return POLITICAL_FILL_ID;
  return firstDataLayerId(map);
}

/**
 * Show exactly `layers` (the realm's raster art switched on, in drawing order) as raster tile layers, read from
 * `urlFor(layer)`. Layers switched off, of another realm or of an older version are removed; the rest are kept
 * and put back in order (the political layer and the data layers may have been added since).
 */
export function syncRasterLayers(
  map: MapLibreMap,
  layers: readonly RealmRasterLayer[],
  urlFor: (layer: RealmRasterLayer) => string
): void {
  const wanted = new Map(layers.map((layer) => [rasterStyleId(layer.id), urlFor(layer)]));
  for (const { id } of map.getStyle()?.layers ?? []) {
    if (!id.startsWith(RASTER_LAYER_PREFIX)) continue;
    const source = map.getSource(id) as RasterTileSource | undefined;
    if (source?.tiles?.[0] === wanted.get(id)) continue;
    map.removeLayer(id);
    if (source) map.removeSource(id);
  }
  for (const layer of layers) {
    const id = rasterStyleId(layer.id);
    if (!map.getSource(id)) {
      map.addSource(id, {
        type: "raster",
        tiles: [wanted.get(id)!],
        tileSize: RASTER_TILE_SIZE,
        maxzoom: layer.maxZoom,
      });
    }
    const before = rasterAnchor(map, layer.kind);
    if (map.getLayer(id)) map.moveLayer(id, before);
    else map.addLayer({ id, type: "raster", source: id }, before);
  }
}
