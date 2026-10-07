/**
 * The label raster: every pixel snapped to a palette colour (label = palette index + 1), then cleaned so that
 * neighbouring nations touch. Border lines and pixels near no palette colour (anti-aliasing between colours, JPEG
 * noise, text) start as 0 and are given to the nearest labelled region by repeated one-pixel growth, which splits a
 * line between the regions on either side. A 3×3 majority vote first removes one-pixel lines and specks of a wrong
 * colour (a blend that happens to look like a third nation). Pure.
 */
import { binOf, isBorderColour, type PaletteEntry } from "./palette";
import { hexToRgb, nearestColourFast, rgbToLab } from "../colour";
import type { PngEngineOptions } from "../options";
import type { EngineContext } from "../progress";

const BORDER = 0xfffe;
const UNKNOWN = 0xffff;

export interface SnapResult {
  labels: Uint16Array;
  /** Pixels per palette entry after snapping. */
  counts: Uint32Array;
  borderPixels: number;
  unknownPixels: number;
  /** Unmatched (non-border) pixels per 15-bit bin, and their channel sums. */
  unmatchedCounts: Uint32Array;
  unmatchedSums: Float64Array;
}

/**
 * Snap every pixel to the nearest palette colour within the tolerance. Each distinct colour is classified once
 * (a 24-bit lookup table), so a flat map costs one table read per pixel.
 */
export async function snapToPalette(
  data: Uint8Array,
  palette: readonly PaletteEntry[],
  options: PngEngineOptions,
  ctx: EngineContext
): Promise<SnapResult> {
  const pixels = data.length / 4;
  const labels = new Uint16Array(pixels);
  const counts = new Uint32Array(palette.length);
  const lut = new Uint16Array(1 << 24);
  const labs = palette.map((p) => p.lab);
  const borderLabs = options.borderColours.map((h) => rgbToLab(hexToRgb(h)));
  const transparentLabel = palette.findIndex((p) => p.transparent) + 1;
  const unmatchedCounts = new Uint32Array(32768);
  const unmatchedSums = new Float64Array(32768 * 3);
  let borderPixels = 0;
  let unknownPixels = 0;

  const classify = (r: number, g: number, b: number): number => {
    const lab = rgbToLab([r, g, b]);
    const { index, distance } = nearestColourFast(lab, labs);
    if (index >= 0 && distance <= options.tolerance) return index + 1;
    return isBorderColour(lab, options, borderLabs) ? BORDER : UNKNOWN;
  };

  const chunk = 1 << 19;
  for (let start = 0; start < pixels; start += chunk) {
    const end = Math.min(pixels, start + chunk);
    for (let p = start; p < end; p++) {
      const o = p * 4;
      if (data[o + 3]! < 128 && transparentLabel > 0) {
        labels[p] = transparentLabel;
        counts[transparentLabel - 1]!++;
        continue;
      }
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      const key = (r << 16) | (g << 8) | b;
      let v = lut[key]!;
      if (v === 0) {
        v = classify(r, g, b);
        lut[key] = v;
      }
      if (v === BORDER) {
        borderPixels++;
      } else if (v === UNKNOWN) {
        unknownPixels++;
        const bin = binOf(r, g, b);
        unmatchedCounts[bin]!++;
        unmatchedSums[bin * 3] += r;
        unmatchedSums[bin * 3 + 1] += g;
        unmatchedSums[bin * 3 + 2] += b;
      } else {
        labels[p] = v;
        counts[v - 1]!++;
      }
    }
    await ctx.tick();
  }
  return { labels, counts, borderPixels, unknownPixels, unmatchedCounts, unmatchedSums };
}

/**
 * Colours that exist only as thin lines are not nations: the fringe JPEG leaves along a black border, or the
 * blend between two colours. A label of which fewer than `minInteriorShare` of the pixels have all four
 * neighbours of the same label is cleared to 0 (to be filled from its neighbours). Returns the cleared labels.
 */
export async function clearLineLabels(
  labels: Uint16Array,
  width: number,
  height: number,
  labelCount: number,
  ctx: EngineContext,
  minInteriorShare = 0.05
): Promise<Set<number>> {
  const total = new Uint32Array(labelCount + 1);
  const interior = new Uint32Array(labelCount + 1);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const p = row + x;
      const l = labels[p]!;
      if (l === 0) continue;
      total[l]!++;
      if (
        x > 0 &&
        y > 0 &&
        x + 1 < width &&
        y + 1 < height &&
        labels[p - 1] === l &&
        labels[p + 1] === l &&
        labels[p - width] === l &&
        labels[p + width] === l
      ) {
        interior[l]!++;
      }
    }
    if ((y & 127) === 0) await ctx.tick();
  }
  const cleared = new Set<number>();
  const flag = new Uint8Array(labelCount + 1);
  for (let l = 1; l <= labelCount; l++) {
    if (total[l]! > 0 && interior[l]! < total[l]! * minInteriorShare) {
      cleared.add(l);
      flag[l] = 1;
    }
  }
  if (cleared.size > 0) {
    for (let p = 0; p < labels.length; p++) if (flag[labels[p]!]) labels[p] = 0;
  }
  return cleared;
}

/**
 * One 3×3 majority pass: a labelled pixel with at most one same-label neighbour (of eight) takes the label at
 * least five of its neighbours share. Returns how many pixels changed.
 */
export async function majorityFilter(
  labels: Uint16Array,
  width: number,
  height: number,
  ctx: EngineContext
): Promise<number> {
  const changed: number[] = [];
  const offsets = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];
  const seen = new Uint16Array(8);
  const tally = new Uint8Array(8);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const p = row + x;
      const l = labels[p]!;
      if (l === 0) continue;
      if (labels[p - 1] === l && labels[p + 1] === l && labels[p - width] === l && labels[p + width] === l) continue;
      let same = 0;
      let distinct = 0;
      for (let k = 0; k < 8; k++) {
        const n = labels[p + offsets[k]!]!;
        if (n === l) {
          same++;
          continue;
        }
        if (n === 0) continue;
        let j = 0;
        while (j < distinct && seen[j] !== n) j++;
        if (j === distinct) {
          seen[distinct] = n;
          tally[distinct++] = 0;
        }
        tally[j]!++;
      }
      if (same > 1) continue;
      for (let j = 0; j < distinct; j++) {
        if (tally[j]! >= 5) {
          changed.push(p, seen[j]!);
          break;
        }
      }
    }
    if ((y & 63) === 0) await ctx.tick();
  }
  for (let i = 0; i < changed.length; i += 2) labels[changed[i]!] = changed[i + 1]!;
  return changed.length / 2;
}

/**
 * Give every unlabelled pixel (border lines, unmatched colours) to the nearest labelled region: each pass, a
 * pixel with a labelled 4-neighbour takes the most common such label (as it was before the pass, so growth is
 * even in every direction). Pixels with no labelled pixel anywhere in reach stay 0. Returns how many were filled.
 */
export async function fillUnlabelled(
  labels: Uint16Array,
  width: number,
  height: number,
  ctx: EngineContext
): Promise<number> {
  let remaining = 0;
  for (let p = 0; p < labels.length; p++) if (labels[p] === 0) remaining++;
  if (remaining === 0 || remaining === labels.length) return 0;
  let todo = new Int32Array(remaining);
  let n = 0;
  for (let p = 0; p < labels.length; p++) if (labels[p] === 0) todo[n++] = p;

  let filled = 0;
  const pendingIndex = new Int32Array(remaining);
  const pendingLabel = new Uint16Array(remaining);
  const around = [0, 0, 0, 0];
  while (n > 0) {
    let pending = 0;
    let keep = 0;
    for (let i = 0; i < n; i++) {
      const p = todo[i]!;
      const x = p % width;
      around[0] = p >= width ? labels[p - width]! : 0;
      around[1] = x > 0 ? labels[p - 1]! : 0;
      around[2] = x < width - 1 ? labels[p + 1]! : 0;
      around[3] = p + width < labels.length ? labels[p + width]! : 0;
      let best = 0;
      let bestCount = 0;
      for (let k = 0; k < 4; k++) {
        const l = around[k]!;
        if (l === 0) continue;
        let count = 0;
        for (let m = 0; m < 4; m++) if (around[m] === l) count++;
        if (count > bestCount) {
          best = l;
          bestCount = count;
        }
      }
      if (best) {
        pendingIndex[pending] = p;
        pendingLabel[pending++] = best;
      } else {
        todo[keep++] = p;
      }
      if ((i & 0xfffff) === 0xfffff) await ctx.tick();
    }
    if (pending === 0) break;
    for (let i = 0; i < pending; i++) labels[pendingIndex[i]!] = pendingLabel[i]!;
    filled += pending;
    n = keep;
    if (n < todo.length / 4) todo = todo.slice(0, n);
    await ctx.tick();
  }
  return filled;
}
