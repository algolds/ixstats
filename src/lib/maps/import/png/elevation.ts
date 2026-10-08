/**
 * Elevation bands from a geography map's hypsometric tints, and the IxWorld altitude style each band takes.
 *
 *   land pixels snapped to the nearest band colour (CIEDE2000, within `tolerance`); everything else on the land
 *   (rivers, borders, labels, flags, symbols, shading blends) starts unlabelled; ice (`ice` mask) is the lowest
 *   band, as its elevation is not drawn
 *   → one 5 × 5 mode pass in which unlabelled pixels count too: a grid line or a label's halo whose colour is
 *     near a band's tint is thinner than the window, so it is cleared
 *   → unlabelled pixels filled from the bands around them (the sea bounds the fill)
 *   → a patch of a band that touches neither the band below nor the band above it is cleared and filled again:
 *     tints step one band at a time, so such a patch is a flag, a symbol or a label's halo in a band's colour
 *   → `smoothing` passes of a 5 × 5 mode filter, which rounds the bands' pixel steps
 *   → land the fill never reached (an island of cleared patches only) is the lowest band.
 *
 * IxWorld's altitude layer has a coast band (`coastlines`, the whole land) and eight bands above it
 * (`Altitude-1` .. `Altitude-8`, ELEVATION_ZONES). A realm's band takes the IxWorld band whose range holds the
 * band's lowest elevation, or the next band up when a lower realm band already took that one. Pure.
 */
import { ELEVATION_ZONES } from "~/lib/maps/elevation-config";
import { pngEngineOptionsSchema } from "../options";
import type { EngineContext } from "../progress";
import type { DecodedImage } from "./decode";
import { fillUnlabelled, snapToPalette } from "./label-raster";
import { keyPalette } from "./palette";
import { findRegions, forOverlaps } from "./regions";

export interface ElevationBand {
  /** The band's tint on the map ("#rrggbb"). */
  color: string;
  /** Lowest elevation, metres. */
  min: number;
  /** Highest elevation, metres; null for the open top band. */
  max: number | null;
}

/** How a band is stored: the IxWorld altitude band it is drawn as, and its own elevations. */
export interface BandStyle {
  subgroup: string;
  fill: string;
  zoneId: string;
  label: string;
}

/** Sea pixels while a land raster (bands, climate zones) is filled: they bound the fill and are never filled. */
export const SEA_BARRIER = 0xffff;
const MODE_RADIUS = 2;

const zoneIndexOf = (metres: number) => {
  const i = ELEVATION_ZONES.findIndex((z) => metres >= z.elevationMin && metres <= z.elevationMax);
  return i >= 0 ? i : metres < 0 ? 0 : ELEVATION_ZONES.length - 1;
};

/** "50–500 m", "8,000 m and above". */
export function bandLabel(band: ElevationBand): string {
  const m = (v: number) => v.toLocaleString("en-US");
  return band.max === null ? `${m(band.min)} m and above` : `${m(band.min)}–${m(band.max)} m`;
}

/** Each band's IxWorld style (bands sorted by `min`; see the module comment). */
export function altitudeStyles(bands: readonly ElevationBand[]): BandStyle[] {
  let previous = -1;
  return bands.map((band) => {
    const index = Math.min(
      ELEVATION_ZONES.length - 1,
      Math.max(zoneIndexOf(band.min), previous + 1)
    );
    previous = index;
    const zone = ELEVATION_ZONES[index]!;
    return {
      subgroup: index === 0 ? "coastlines" : `Altitude-${index}`,
      fill: zone.color.slice(0, 7).toLowerCase(),
      zoneId: zone.zoneId,
      label: bandLabel(band),
    };
  });
}

/**
 * Clear (to 0) every patch of a band above the lowest that touches neither the band below nor the band above.
 * Labels are band index + 1; the sea is SEA_BARRIER. Returns how many pixels were cleared.
 */
export async function clearSkippedBands(
  labels: Uint16Array,
  width: number,
  height: number,
  ctx: EngineContext
): Promise<number> {
  const { runs, region, regionLabel } = await findRegions(labels, width, height, ctx, true);
  const stepped = new Uint8Array(regionLabel.length);
  const touch = (a: number, b: number) => {
    if (Math.abs(runs.label[a]! - runs.label[b]!) !== 1) return;
    stepped[region[a]!] = 1;
    stepped[region[b]!] = 1;
  };
  for (let y = 0; y < height; y++) {
    for (let i = runs.rowStart[y]! + 1; i < runs.rowStart[y + 1]!; i++) touch(i - 1, i);
    if (y + 1 < height) forOverlaps(runs, y, touch);
  }
  let cleared = 0;
  for (let i = 0; i < runs.count; i++) {
    const label = runs.label[i]!;
    if (label <= 1 || label === SEA_BARRIER || stepped[region[i]!]) continue;
    labels.fill(0, runs.row[i]! * width + runs.start[i]!, runs.row[i]! * width + runs.end[i]!);
    cleared += runs.end[i]! - runs.start[i]!;
  }
  return cleared;
}

/** Add (`sign` 1) or remove (-1) column `x` of rows y-r..y+r to the window's label counts. */
function countColumn(
  counts: Int32Array,
  labels: Uint16Array,
  width: number,
  height: number,
  x: number,
  y: number,
  sign: number
) {
  if (x < 0 || x >= width) return;
  for (let yy = Math.max(0, y - MODE_RADIUS); yy <= Math.min(height - 1, y + MODE_RADIUS); yy++) {
    const l = labels[yy * width + x]!;
    if (l !== SEA_BARRIER) counts[l]! += sign;
  }
}

/** The most common label of the window (0, unlabelled, too when `withUnlabelled`); the pixel's own wins a tie. */
function modeOf(counts: Int32Array, own: number, withUnlabelled: boolean): number {
  let best = own;
  for (let l = withUnlabelled ? 0 : 1; l < counts.length; l++) {
    if (counts[l]! > counts[best]!) best = l;
  }
  return best;
}

/**
 * One 5 × 5 mode-filter pass over the labelled land (labels 1..bandCount; the sea is neither changed nor counted).
 * With `withUnlabelled`, unlabelled pixels (0) count as a label that can win, so a thin line in a band's tint
 * among unmatched pixels (a grid line, a label's halo) is cleared instead of kept. Returns how many changed.
 */
export async function modeFilter(
  labels: Uint16Array,
  width: number,
  height: number,
  bandCount: number,
  ctx: EngineContext,
  withUnlabelled = false
): Promise<number> {
  const out = labels.slice();
  const counts = new Int32Array(bandCount + 1);
  let changed = 0;
  for (let y = 0; y < height; y++) {
    counts.fill(0);
    for (let x = -MODE_RADIUS; x < MODE_RADIUS; x++)
      countColumn(counts, labels, width, height, x, y, 1);
    for (let x = 0; x < width; x++) {
      countColumn(counts, labels, width, height, x + MODE_RADIUS, y, 1);
      const p = y * width + x;
      const own = labels[p]!;
      if (own !== SEA_BARRIER && own !== 0) {
        const mode = modeOf(counts, own, withUnlabelled);
        if (mode !== own) {
          out[p] = mode;
          changed++;
        }
      }
      countColumn(counts, labels, width, height, x - MODE_RADIUS, y, -1);
    }
    if ((y & 63) === 0) await ctx.tick();
  }
  labels.set(out);
  return changed;
}

export interface ElevationRasterOptions {
  /** CIEDE2000 distance within which a pixel is a band's tint. */
  tolerance: number;
  /** Mode-filter passes. */
  smoothing: number;
}

/**
 * The bands on the land (see the module comment): label = band index + 1 (bands sorted by `min`), the sea and
 * lakes 0. `isLand` is the blank map's land; `isIce` marks ice, which is the lowest band.
 */
export async function elevationLabels(
  image: DecodedImage,
  bands: readonly ElevationBand[],
  isLand: (p: number) => boolean,
  isIce: (p: number) => boolean,
  options: ElevationRasterOptions,
  ctx: EngineContext
): Promise<{ labels: Uint16Array; unmatched: number; cleared: number; smoothed: number }> {
  const { width, height } = image;
  const snapOptions = pngEngineOptionsSchema.parse({
    tolerance: options.tolerance,
    borderLightness: 0,
    colourKey: bands.map((band, i) => ({ hex: band.color.toLowerCase(), nation: String(i) })),
  });
  const palette = keyPalette(snapOptions);
  const bandOf = palette.map((entry) => Number(entry.nation) + 1);
  const { labels } = await snapToPalette(image.data, palette, snapOptions, ctx);
  let unmatched = 0;
  for (let p = 0; p < labels.length; p++) {
    if (!isLand(p)) labels[p] = SEA_BARRIER;
    else if (isIce(p)) labels[p] = 1;
    else if (labels[p] === 0) unmatched++;
    else labels[p] = bandOf[labels[p]! - 1]!;
  }
  await modeFilter(labels, width, height, bands.length, ctx, true);
  await fillUnlabelled(labels, width, height, ctx, SEA_BARRIER);
  const cleared = await clearSkippedBands(labels, width, height, ctx);
  await fillUnlabelled(labels, width, height, ctx, SEA_BARRIER);
  let smoothed = 0;
  for (let i = 0; i < options.smoothing; i++)
    smoothed += await modeFilter(labels, width, height, bands.length, ctx);
  for (let p = 0; p < labels.length; p++) {
    if (labels[p] === SEA_BARRIER) labels[p] = 0;
    else if (labels[p] === 0) labels[p] = 1;
  }
  return { labels, unmatched, cleared, smoothed };
}
