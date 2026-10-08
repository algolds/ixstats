/**
 * A realm's map art as Web Mercator raster tiles (`Realm.settings.map.rasterLayers`): the tile pyramid a
 * full-globe equirectangular image becomes, and the URLs the viewer reads it from. Pure, client-safe; the tiles
 * are built by `scripts/realms/build-realm-rasters.ts` (src/server/modules/maps/realm-rasters.build.ts) and
 * served by `/api/map-rasters`.
 *
 * Both projections map longitude linearly to x across the same ±180°, so only rows move: a tile row at zoom z
 * reads an equirectangular image of the zoom's equatorial resolution (256·2^z wide, half as tall), each
 * Mercator row from the image row at its latitude. Mercator stretches rows away from the equator, so a row
 * never skips an image row and linear interpolation between the two nearest is enough.
 */
import { MAX_RASTER_ZOOM, type RealmRasterLayer } from "./realm-map-settings";

export const RASTER_TILE_SIZE = 256;

/** The first zoom whose world (256·2^z px) is at least as wide as the image; MapLibre overzooms past it. */
export function rasterMaxZoom(imageWidth: number): number {
  let z = 0;
  while (RASTER_TILE_SIZE * 2 ** z < imageWidth && z < MAX_RASTER_ZOOM) z++;
  return z;
}

/** The latitude (degrees) at `y` pixels from the top of a Web Mercator world `worldPx` tall. */
export function mercatorLatitude(y: number, worldPx: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / worldPx))) * 180) / Math.PI;
}

/**
 * For each pixel row of tile row `ty` at zoom `z`, the (fractional) row of an equirectangular image `height`
 * tall that shows the same latitude, pixel centres on both sides, clamped to the image.
 */
export function tileSourceRows(z: number, ty: number, height: number): Float64Array {
  const worldPx = RASTER_TILE_SIZE * 2 ** z;
  const rows = new Float64Array(RASTER_TILE_SIZE);
  for (let r = 0; r < RASTER_TILE_SIZE; r++) {
    const lat = mercatorLatitude(ty * RASTER_TILE_SIZE + r + 0.5, worldPx);
    rows[r] = Math.min(height - 1, Math.max(0, ((90 - lat) / 180) * height - 0.5));
  }
  return rows;
}

/** An RGBA image, 4 bytes per pixel, row by row from the top. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * The rows of `src` at the fractional positions `rows`, each interpolated between the two nearest rows with
 * colour weighted by opacity (premultiplied), so a transparent pixel's colour never bleeds into its neighbour.
 */
export function remapRows(src: RgbaImage, rows: Float64Array): Uint8Array {
  const stride = src.width * 4;
  const out = new Uint8Array(rows.length * stride);
  rows.forEach((pos, r) => {
    const top = Math.floor(pos);
    const t = pos - top;
    const a = top * stride;
    const b = Math.min(top + 1, src.height - 1) * stride;
    const o = r * stride;
    for (let i = 0; i < stride; i += 4) {
      const wa = src.data[a + i + 3]! * (1 - t);
      const wb = src.data[b + i + 3]! * t;
      const alpha = wa + wb;
      out[o + i + 3] = Math.round(alpha);
      if (alpha === 0) continue;
      for (let c = 0; c < 3; c++) {
        out[o + i + c] = Math.round(
          (src.data[a + i + c]! * wa + src.data[b + i + c]! * wb) / alpha
        );
      }
    }
  });
  return out;
}

/**
 * Grey in place: each pixel's colour becomes its brightest channel, alpha kept. The eurth-map way (its owner's
 * black-and-white export, pixel for pixel): the sea comes out near-white and the land in light greys.
 */
export function greyPixels(rgba: Uint8Array): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const v = Math.max(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
    rgba[i] = v;
    rgba[i + 1] = v;
    rgba[i + 2] = v;
  }
}

/** z/x/y name a tile of the pyramid (zoom 0..MAX_RASTER_ZOOM). */
export function isRasterTileCoord(z: number, x: number, y: number): boolean {
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > MAX_RASTER_ZOOM) return false;
  const size = 2 ** z;
  return x >= 0 && x < size && y >= 0 && y < size;
}

type LayerRef = Pick<RealmRasterLayer, "id" | "version">;

const layerPath = (realmId: string, layer: LayerRef) =>
  `/api/map-rasters/${encodeURIComponent(realmId)}/${layer.id}/${layer.version}`;

/** The layer's tile URL template (app-relative), versioned so a rebuilt image is never served stale. */
export function rasterTilePath(realmId: string, layer: LayerRef): string {
  return `${layerPath(realmId, layer)}/{z}/{x}/{y}`;
}

/** The layer's legend image (app-relative), when it has one. */
export function rasterLegendPath(realmId: string, layer: LayerRef): string {
  return `${layerPath(realmId, layer)}/legend`;
}

/** The realm's raster layers with `layer` added, or replacing the one with its id. */
export function withRasterLayer(
  layers: readonly RealmRasterLayer[],
  layer: RealmRasterLayer
): RealmRasterLayer[] {
  const at = layers.findIndex((l) => l.id === layer.id);
  return at === -1 ? [...layers, layer] : layers.map((l, i) => (i === at ? layer : l));
}
