/**
 * Colour maths for the map import engine: sRGB → CIE Lab, CIEDE2000 distance, and hex parsing. A map's colours
 * are compared perceptually, so an anti-aliased or JPEG-shifted pixel snaps to the nation colour it looks like.
 * Pure, client-safe.
 */
import { hexToRgbArray, rgbToHex } from "~/lib/color";

export type Rgb = [number, number, number];
export type Lab = [number, number, number];

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "#rrggbb" (lower case) from "#RGB", "rrggbb" or "#RRGGBB"; null for anything else. */
export function normalizeHex(input: string): string | null {
  const match = HEX.exec(input.trim());
  if (!match) return null;
  const body = match[1]!.length === 3 ? [...match[1]!].map((c) => c + c).join("") : match[1]!;
  return `#${body.toLowerCase()}`;
}

export const hexToRgb = (hex: string): Rgb => hexToRgbArray(hex);
export const rgbHex = (rgb: Rgb): string => rgbToHex(rgb[0], rgb[1], rgb[2]);

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function labF(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
}

/** CIE L*a*b* (D65) of an sRGB colour. */
export function rgbToLab([r, g, b]: Rgb): Lab {
  const lr = linear(r);
  const lg = linear(g);
  const lb = linear(b);
  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883;
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const DEG = Math.PI / 180;

/** CIEDE2000 colour difference: about 1 is a just-noticeable difference, 10+ is clearly another colour. */
export function deltaE2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cMean7 = ((c1 + c2) / 2) ** 7;
  const g = 0.5 * (1 - Math.sqrt(cMean7 / (cMean7 + 25 ** 7)));
  const ap1 = a1 * (1 + g);
  const ap2 = a2 * (1 + g);
  const cp1 = Math.hypot(ap1, b1);
  const cp2 = Math.hypot(ap2, b2);
  const hue = (b: number, ap: number) => {
    if (b === 0 && ap === 0) return 0;
    const h = Math.atan2(b, ap) / DEG;
    return h < 0 ? h + 360 : h;
  };
  const hp1 = hue(b1, ap1);
  const hp2 = hue(b2, ap2);

  const dL = l2 - l1;
  const dC = cp2 - cp1;
  let dh = 0;
  if (cp1 * cp2 !== 0) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((dh / 2) * DEG);

  const lMean = (l1 + l2) / 2;
  const cpMean = (cp1 + cp2) / 2;
  let hMean = hp1 + hp2;
  if (cp1 * cp2 !== 0) {
    if (Math.abs(hp1 - hp2) <= 180) hMean /= 2;
    else hMean = hp1 + hp2 < 360 ? (hMean + 360) / 2 : (hMean - 360) / 2;
  }
  const t =
    1 -
    0.17 * Math.cos((hMean - 30) * DEG) +
    0.24 * Math.cos(2 * hMean * DEG) +
    0.32 * Math.cos((3 * hMean + 6) * DEG) -
    0.2 * Math.cos((4 * hMean - 63) * DEG);
  const dTheta = 30 * Math.exp(-(((hMean - 275) / 25) ** 2));
  const cpMean7 = cpMean ** 7;
  const rc = 2 * Math.sqrt(cpMean7 / (cpMean7 + 25 ** 7));
  const sl = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2);
  const sc = 1 + 0.045 * cpMean;
  const sh = 1 + 0.015 * cpMean * t;
  const rt = -Math.sin(2 * dTheta * DEG) * rc;
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
}

/** Relative luminance-like lightness (0 black, 100 white): the L* of the colour. */
export const lightness = (rgb: Rgb): number => rgbToLab(rgb)[0];

/**
 * nearestColour for large palettes: rank by plain Lab distance (cheap), then decide among the closest few by
 * CIEDE2000. The perceptual nearest is all but always among them, at a fraction of the cost.
 */
export function nearestColourFast(
  lab: Lab,
  palette: readonly Lab[],
  candidates = 4
): { index: number; distance: number } {
  if (palette.length <= candidates) return nearestColour(lab, palette);
  const best: number[] = [];
  const bestD: number[] = [];
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i]!;
    const d = (p[0] - lab[0]) ** 2 + (p[1] - lab[1]) ** 2 + (p[2] - lab[2]) ** 2;
    if (best.length < candidates || d < bestD[best.length - 1]!) {
      let k = Math.min(best.length, candidates - 1);
      if (best.length < candidates) {
        best.push(i);
        bestD.push(d);
      }
      while (k > 0 && bestD[k - 1]! > d) {
        best[k] = best[k - 1]!;
        bestD[k] = bestD[k - 1]!;
        k--;
      }
      best[k] = i;
      bestD[k] = d;
    }
  }
  let index = -1;
  let distance = Infinity;
  for (const i of best) {
    const d = deltaE2000(lab, palette[i]!);
    if (d < distance) {
      distance = d;
      index = i;
    }
  }
  return { index, distance };
}

/** The nearest of `palette` (Lab) to `lab`, with its distance; index -1 for an empty palette. */
export function nearestColour(
  lab: Lab,
  palette: readonly Lab[]
): { index: number; distance: number } {
  let index = -1;
  let distance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = deltaE2000(lab, palette[i]!);
    if (d < distance) {
      distance = d;
      index = i;
    }
  }
  return { index, distance };
}
