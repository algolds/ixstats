/**
 * The PNG engine's palette: the colours the map is made of. Either the admin's colour key, or the dominant
 * colours of the image found from a 15-bit colour histogram and clustered perceptually, so the anti-aliasing and
 * JPEG noise around a flat colour join it instead of becoming colours of their own. Dark, nearly grey colours
 * are border lines, never palette colours. Pure.
 */
import { deltaE2000, hexToRgb, rgbHex, rgbToLab, type Lab, type Rgb } from "../colour";
import type { PngEngineOptions } from "../options";
import type { EngineContext } from "../progress";

export interface PaletteEntry {
  hex: string;
  rgb: Rgb;
  lab: Lab;
  /** The colour key's nation for it. */
  nation?: string;
  water?: boolean;
  /** The image's transparent pixels (always water). */
  transparent?: boolean;
}

export interface Histogram {
  /** Pixels per 15-bit colour bin (5 bits per channel). */
  counts: Uint32Array;
  /** Sum of each channel per bin, for the bin's mean colour. */
  sums: Float64Array;
  transparent: number;
  total: number;
}

export const binOf = (r: number, g: number, b: number) =>
  ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

export async function colourHistogram(data: Uint8Array, ctx: EngineContext): Promise<Histogram> {
  const counts = new Uint32Array(32768);
  const sums = new Float64Array(32768 * 3);
  let transparent = 0;
  const pixels = data.length / 4;
  const chunk = 1 << 20;
  for (let start = 0; start < pixels; start += chunk) {
    const end = Math.min(pixels, start + chunk);
    for (let p = start; p < end; p++) {
      const o = p * 4;
      if (data[o + 3]! < 128) {
        transparent++;
        continue;
      }
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      const bin = binOf(r, g, b);
      counts[bin]!++;
      sums[bin * 3] += r;
      sums[bin * 3 + 1] += g;
      sums[bin * 3 + 2] += b;
    }
    await ctx.tick();
  }
  return { counts, sums, transparent, total: pixels };
}

/** A dark, nearly grey colour (a drawn border line), or one near an explicit line colour. */
export function isBorderColour(
  lab: Lab,
  options: PngEngineOptions,
  borderLabs: readonly Lab[]
): boolean {
  if (
    options.borderLightness > 0 &&
    lab[0] < options.borderLightness &&
    Math.hypot(lab[1], lab[2]) < 20
  ) {
    return true;
  }
  return borderLabs.some((b) => deltaE2000(lab, b) <= options.tolerance);
}

const entry = (rgb: Rgb, extra: Partial<PaletteEntry> = {}): PaletteEntry => ({
  hex: rgbHex(rgb),
  rgb,
  lab: rgbToLab(rgb),
  ...extra,
});

/** The palette of a colour key: its colours (each with its nation), then the water colours. */
export function keyPalette(options: PngEngineOptions): PaletteEntry[] {
  const seen = new Set<string>();
  const out: PaletteEntry[] = [];
  for (const { hex, nation } of options.colourKey ?? []) {
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(entry(hexToRgb(hex), { nation }));
  }
  for (const hex of options.waterColours) {
    if (seen.has(hex)) {
      const existing = out.find((e) => e.hex === hex);
      if (existing) existing.water = true;
      continue;
    }
    seen.add(hex);
    out.push(entry(hexToRgb(hex), { water: true }));
  }
  return out;
}

interface Cluster {
  rgb: Rgb;
  lab: Lab;
  count: number;
}

/**
 * The dominant colours of the image. Bins are visited largest first; a bin joins the nearest cluster when it is
 * within a third of the tolerance, or within the tolerance and much smaller than it (a halo of anti-aliasing or
 * compression noise); otherwise a bin covering at least `paletteMinShare` of the image starts a new colour.
 */
export function autoPalette(hist: Histogram, options: PngEngineOptions): PaletteEntry[] {
  const borderLabs = options.borderColours.map((h) => rgbToLab(hexToRgb(h)));
  const opaque = hist.total - hist.transparent;
  const minPixels = Math.max(1, Math.round(opaque * options.paletteMinShare));
  // Bins far too small to start a colour only add to a cluster's count: leave them out.
  const floor = Math.max(1, Math.floor(minPixels / 20));
  const bins: number[] = [];
  for (let i = 0; i < hist.counts.length; i++) if (hist.counts[i]! >= floor) bins.push(i);
  bins.sort((a, b) => hist.counts[b]! - hist.counts[a]!);

  const clusters: Cluster[] = [];
  for (const bin of bins) {
    const count = hist.counts[bin]!;
    const rgb: Rgb = [
      Math.round(hist.sums[bin * 3]! / count),
      Math.round(hist.sums[bin * 3 + 1]! / count),
      Math.round(hist.sums[bin * 3 + 2]! / count),
    ];
    const lab = rgbToLab(rgb);
    if (isBorderColour(lab, options, borderLabs)) continue;
    let nearest: Cluster | null = null;
    let distance = Infinity;
    for (const c of clusters) {
      const d = deltaE2000(lab, c.lab);
      if (d < distance) {
        distance = d;
        nearest = c;
      }
    }
    if (
      nearest &&
      (distance < options.tolerance / 3 ||
        (distance < options.tolerance && count < nearest.count / 10))
    ) {
      nearest.count += count;
      continue;
    }
    if (count < minPixels || clusters.length >= options.maxColours) continue;
    clusters.push({ rgb, lab, count });
  }

  const waterLabs = options.waterColours.map((h) => rgbToLab(hexToRgb(h)));
  return clusters.map((c) =>
    entry(c.rgb, { water: waterLabs.some((w) => deltaE2000(c.lab, w) <= options.tolerance) })
  );
}

/** The largest image colours no palette colour is near (for the report), from the unmatched-pixel histogram. */
export function topUnmatched(
  counts: Uint32Array,
  sums: Float64Array,
  limit = 20
): Array<{ hex: string; pixels: number }> {
  const out: Array<{ hex: string; pixels: number }> = [];
  for (let i = 0; i < counts.length; i++) {
    const n = counts[i]!;
    if (n === 0) continue;
    out.push({
      hex: rgbHex([sums[i * 3]! / n, sums[i * 3 + 1]! / n, sums[i * 3 + 2]! / n]),
      pixels: n,
    });
  }
  return out.sort((a, b) => b.pixels - a.pixels).slice(0, limit);
}
