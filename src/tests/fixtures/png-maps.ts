/** Tiny generated map images for the PNG realm-map pipeline tests (no files on disk). */
import sharp from "sharp";

export const MAP_WIDTH = 40;
export const MAP_HEIGHT = 20;
type Rgb = [number, number, number];

/** A 40×20 flat-colour map: Aurelia (red) west, Borealis (green) east, inside a 2px blue ocean. */
export function twoNationPng(): Promise<Buffer> {
  const raw = Buffer.alloc(MAP_WIDTH * MAP_HEIGHT * 3);
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const ocean = x < 2 || x >= MAP_WIDTH - 2 || y < 2 || y >= MAP_HEIGHT - 2;
      const rgb: Rgb = ocean ? [0, 0, 255] : x < MAP_WIDTH / 2 ? [255, 0, 0] : [0, 255, 0];
      raw.set(rgb, (y * MAP_WIDTH + x) * 3);
    }
  }
  return sharp(raw, { raw: { width: MAP_WIDTH, height: MAP_HEIGHT, channels: 3 } })
    .png()
    .toBuffer();
}

/**
 * A 60×30 flat-colour map in a blue ocean: Lakeland (red, x 4–28) with a blue 8×8 lake in its middle, and a red
 * island east of it (x 40–52) — the shapes a traced map must turn into a polygon with a hole plus an island.
 */
export function lakeAndIslandPng(): Promise<Buffer> {
  const [width, height] = [60, 30];
  const raw = Buffer.alloc(width * height * 3);
  const inside = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) =>
    x >= x0 && x < x1 && y >= y0 && y < y1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const land =
        (inside(x, y, 4, 4, 28, 26) && !inside(x, y, 12, 11, 20, 19)) ||
        inside(x, y, 40, 8, 52, 20);
      const rgb: Rgb = land ? [255, 0, 0] : [0, 0, 255];
      raw.set(rgb, (y * width + x) * 3);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A valid 1×1 PNG whose header claims `width`×`height` pixels — enough for a decoder to refuse it on
 * size without anyone allocating a giant image.
 */
export async function pngClaimingSize(width: number, height: number): Promise<Buffer> {
  const png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  // Signature (8 bytes), then the IHDR chunk: length (4), type (4), data (13: width, height, …), CRC (4).
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);
  return png;
}
