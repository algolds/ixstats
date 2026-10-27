/** Generated political map images for the map import engine tests (no files on disk). */
import sharp from "sharp";

export type Rgb = [number, number, number];

export const OCEAN: Rgb = [32, 96, 192];
export const RED: Rgb = [224, 64, 64];
export const GREEN: Rgb = [64, 176, 64];
export const YELLOW: Rgb = [224, 192, 64];
export const BROWN: Rgb = [176, 112, 48];
export const PURPLE: Rgb = [150, 60, 170];

export const hex = (rgb: Rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

/**
 * The test map's truth at a point (fractional pixels): Red (west) and Green (east) share a wavy border; Yellow and
 * Brown (one nation in two colours) lie under Red; Red has a round lake; Green has an island in the sea and a
 * 8×8 purple speck.
 */
export function truth(x: number, y: number): Rgb {
  if (x >= 140 && x < 154 && y >= 28 && y < 42) return GREEN; // island
  if (x >= 100 && x < 108 && y >= 40 && y < 48) return PURPLE; // speck
  if (y >= 15 && y < 65) {
    const border = 80 + 8 * Math.sin(y / 6);
    if (x >= 20 && x < border) return Math.hypot(x - 45, y - 40) < 8 ? OCEAN : RED;
    if (x >= border && x < 130) return GREEN;
  }
  if (y >= 65 && y < 75) {
    if (x >= 20 && x < 55) return YELLOW;
    if (x >= 55 && x < 80) return BROWN;
  }
  return OCEAN;
}

export const MAP_W = 160;
export const MAP_H = 80;

interface PaintOptions {
  /** Draw a black line over every boundary (about 2 px wide). */
  borders?: boolean;
  /** Anti-alias by averaging 4×4 samples per pixel. */
  antiAlias?: boolean;
  /** Add uniform noise of ± this much to each channel. */
  noise?: number;
}

/** RGB raw pixels of the test map. */
export function paint(options: PaintOptions = {}, width = MAP_W, height = MAP_H): Buffer {
  const raw = Buffer.alloc(width * height * 3);
  let seed = 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const sx = MAP_W / width;
  const sy = MAP_H / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rgb: Rgb;
      if (options.antiAlias) {
        const sum = [0, 0, 0];
        for (let j = 0; j < 4; j++)
          for (let i = 0; i < 4; i++) {
            const c = truth((x + (i + 0.5) / 4) * sx, (y + (j + 0.5) / 4) * sy);
            sum[0] += c[0];
            sum[1] += c[1];
            sum[2] += c[2];
          }
        rgb = [sum[0]! / 16, sum[1]! / 16, sum[2]! / 16].map(Math.round) as Rgb;
      } else {
        rgb = truth((x + 0.5) * sx, (y + 0.5) * sy);
      }
      if (options.borders) {
        const here = truth((x + 0.5) * sx, (y + 0.5) * sy);
        const differs = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ].some(([dx, dy]) => truth((x + 0.5 + dx!) * sx, (y + 0.5 + dy!) * sy) !== here);
        if (differs) rgb = [10, 10, 10];
      }
      if (options.noise) {
        rgb = rgb.map((c) =>
          Math.max(0, Math.min(255, Math.round(c + (random() * 2 - 1) * options.noise!)))
        ) as Rgb;
      }
      raw.set(rgb, (y * width + x) * 3);
    }
  }
  return raw;
}

export function encode(
  raw: Buffer,
  format: "png" | "jpeg",
  width = MAP_W,
  height = MAP_H
): Promise<Buffer> {
  const image = sharp(raw, { raw: { width, height, channels: 3 } });
  return (format === "png" ? image.png() : image.jpeg({ quality: 85 })).toBuffer();
}
